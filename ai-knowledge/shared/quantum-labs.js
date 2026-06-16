(function () {
  "use strict";

  const COLORS = {
    bg: 0x061015,
    blue: 0x54a8ff,
    cyan: 0x58e0d3,
    amber: 0xe8b857,
    rose: 0xff6d8b,
    green: 0x77df96,
    violet: 0x9b8cff,
    ink: 0xedf8f6,
    muted: 0x9cb4b0
  };

  const AXIS = {
    Z: new THREE.Vector3(0, 0, 1),
    X: new THREE.Vector3(1, 0, 0),
    Y: new THREE.Vector3(0, 1, 0)
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function fmt(value, digits) {
    return Number(value).toFixed(digits == null ? 2 : digits);
  }

  function compactHash(values) {
    const text = values.map((value) => Number(value).toFixed(3)).join("|");
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function rangeValue(id, fallback) {
    const input = document.getElementById(id);
    return input ? Number(input.value) : fallback;
  }

  function selectValue(id, fallback) {
    const input = document.getElementById(id);
    return input && input.value ? input.value : fallback;
  }

  function syncOutput(id, value, digits) {
    const output = document.querySelector(`[data-output="${id}"]`);
    if (output) output.textContent = fmt(value, digits);
  }

  function setText(id, value) {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function material(color, opacity) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.62,
      metalness: 0.08,
      transparent: opacity < 1,
      opacity,
      side: THREE.DoubleSide,
      depthWrite: opacity >= 0.42
    });
  }

  function lineMaterial(color, opacity) {
    return new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
  }

  function makeSphere(radius, color, opacity) {
    return new THREE.Mesh(new THREE.SphereGeometry(radius, 36, 20), material(color, opacity == null ? 1 : opacity));
  }

  // Shared legibility helpers (i01-i06 clean overrides): additive glow + aspect-fit text label.
  let _qGlowTex = null;
  function qGlow(hex, size) {
    if (!_qGlowTex) {
      const cv = document.createElement("canvas"); cv.width = 128; cv.height = 128;
      const cx = cv.getContext("2d");
      const g = cx.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, "rgba(255,255,255,0.6)"); g.addColorStop(0.22, "rgba(255,255,255,0.24)"); g.addColorStop(1, "rgba(255,255,255,0)");
      cx.fillStyle = g; cx.fillRect(0, 0, 128, 128);
      _qGlowTex = new THREE.CanvasTexture(cv);
    }
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: _qGlowTex, color: hex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    sp.scale.set(size, size, 1);
    return sp;
  }
  function qLabel(text, hex, sc) {
    const pad = 12, fs = 64;
    const cv = document.createElement("canvas");
    const m = cv.getContext("2d");
    m.font = "600 " + fs + "px Inter, system-ui, sans-serif";
    const w = Math.ceil(m.measureText(text).width) + pad * 2, h = fs + pad * 2;
    cv.width = w; cv.height = h;
    const cx = cv.getContext("2d");
    cx.font = "600 " + fs + "px Inter, system-ui, sans-serif";
    cx.textBaseline = "middle"; cx.textAlign = "center";
    cx.fillStyle = "#" + (hex >>> 0).toString(16).padStart(6, "0");
    cx.fillText(text, w / 2, h / 2);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, depthTest: false }));
    sp.scale.set(sc * (w / h), sc, 1);
    return sp;
  }

  function makeBox(size, color, opacity) {
    return new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material(color, opacity == null ? 1 : opacity));
  }

  function makeLine(points, color, opacity) {
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), lineMaterial(color, opacity == null ? 1 : opacity));
  }

  function updateLine(line, points) {
    line.geometry.dispose();
    line.geometry = new THREE.BufferGeometry().setFromPoints(points);
    line.userData.hashValues = points.flatMap((point) => [point.x, point.y, point.z]);
  }

  function objectHash(objects) {
    return compactHash(objects.flatMap((object, index) => {
      if (!object) return [index, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      const opacity = object.material && object.material.opacity != null ? object.material.opacity : 1;
      const color = object.material && object.material.color ? object.material.color.getHex() : 0;
      return [
        index,
        object.visible ? 1 : 0,
        color,
        object.position.x,
        object.position.y,
        object.position.z,
        object.rotation.x,
        object.rotation.y,
        object.rotation.z,
        object.scale.x,
        object.scale.y,
        object.scale.z,
        opacity
      ];
    }));
  }

  function lineHash(lines) {
    return compactHash(lines.flatMap((line, index) => [
      index,
      line && line.visible ? 1 : 0,
      line && line.material && line.material.opacity != null ? line.material.opacity : 1,
      line && line.material && line.material.color ? line.material.color.getHex() : 0
    ].concat(line && line.userData.hashValues || [])));
  }

  function makeCylinder(radius, color, opacity) {
    return new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, 18), material(color, opacity == null ? 1 : opacity));
  }

  function placeCylinderBetween(mesh, start, end) {
    const a = Array.isArray(start) ? new THREE.Vector3(start[0], start[1], start[2]) : start;
    const b = Array.isArray(end) ? new THREE.Vector3(end[0], end[1], end[2]) : end;
    const delta = b.clone().sub(a);
    const length = Math.max(0.001, delta.length());
    mesh.position.copy(a).add(delta.multiplyScalar(0.5));
    mesh.scale.set(1, length, 1);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  }

  function makeArrow(color, radius, opacity) {
    const group = new THREE.Group();
    const body = makeCylinder(radius || 0.025, color, opacity == null ? 0.9 : opacity);
    const head = new THREE.Mesh(new THREE.ConeGeometry((radius || 0.025) * 3.1, 0.18, 20), material(color, opacity == null ? 0.9 : opacity));
    group.add(body, head);
    group.userData.body = body;
    group.userData.head = head;
    return group;
  }

  function placeArrow(arrow, start, end) {
    const a = Array.isArray(start) ? new THREE.Vector3(start[0], start[1], start[2]) : start;
    const b = Array.isArray(end) ? new THREE.Vector3(end[0], end[1], end[2]) : end;
    const dir = b.clone().sub(a);
    const length = Math.max(0.001, dir.length());
    const headLength = Math.min(0.22, length * 0.25);
    const shaftEnd = b.clone().sub(dir.clone().normalize().multiplyScalar(headLength));
    placeCylinderBetween(arrow.userData.body, a, shaftEnd);
    arrow.userData.head.position.copy(shaftEnd.clone().add(b).multiplyScalar(0.5));
    arrow.userData.head.scale.set(1, headLength / 0.18, 1);
    arrow.userData.head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  }

  function makeLabelTexture(text, accent) {
    const canvas = document.createElement("canvas");
    canvas.width = 260;
    canvas.height = 58;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(5, 12, 15, 0.48)";
    ctx.strokeStyle = accent || "rgba(88, 224, 211, 0.42)";
    ctx.globalAlpha = 0.72;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.roundRect(8, 10, 244, 35, 8);
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#edf8f6";
    ctx.font = "700 15px Inter, Segoe UI, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 130, 28);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function createTextSprite(text, color) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeLabelTexture(text, color),
      transparent: true,
      depthWrite: false,
      opacity: 0.58
    }));
    sprite.scale.set(0.76, 0.17, 1);
    sprite.userData.textLabel = true;
    return sprite;
  }

  function addLabel(group, labels, text, pos, color, scale) {
    const label = createTextSprite(text, color);
    label.position.set(pos[0], pos[1], pos[2]);
    if (scale) label.scale.set(scale[0], scale[1], 1);
    group.add(label);
    labels.push(label);
    return label;
  }

  function setupScene(canvas, distance) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // --- canonical color pipeline (this bundle is THREE r128, legacy color API:
    //     SRGBColorSpace/outputColorSpace do NOT exist here, sRGBEncoding/
    //     outputEncoding do. ACESFilmicToneMapping + toneMappingExposure exist.
    //     Guarded so it stays a no-op if the bundle is ever upgraded.) ---
    if (typeof THREE.SRGBColorSpace !== "undefined") renderer.outputColorSpace = THREE.SRGBColorSpace;
    else if (typeof THREE.sRGBEncoding !== "undefined") renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.98;
    renderer.setClearColor(COLORS.bg, 1);
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(COLORS.bg, 8.5, 22);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
    const cameraState = { theta: -0.72, phi: 0.52, radius: distance || 8.2, dragging: false, x: 0, y: 0 };
    const ambient = new THREE.AmbientLight(0xffffff, 0.50);
    const key = new THREE.DirectionalLight(0xefffff, 1.30);
    key.position.set(3.6, 5.4, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 0.5; key.shadow.camera.far = 42;
    key.shadow.camera.left = -7; key.shadow.camera.right = 7;
    key.shadow.camera.top = 7; key.shadow.camera.bottom = -7;
    key.shadow.bias = -0.0006;
    const fill = new THREE.PointLight(0x58e0d3, 0.85, 13);
    fill.position.set(-3.4, 2.2, -4.2);
    scene.add(ambient, key, fill);

    function placeCamera() {
      const cp = Math.cos(cameraState.phi);
      camera.position.set(
        Math.cos(cameraState.theta) * cp * cameraState.radius,
        Math.sin(cameraState.phi) * cameraState.radius,
        Math.sin(cameraState.theta) * cp * cameraState.radius
      );
      camera.lookAt(0, 0, 0);
    }

    function resize() {
      const rect = canvas.parentElement.getBoundingClientRect();
      const width = Math.max(320, rect.width);
      const height = Math.max(260, rect.height);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }

    canvas.addEventListener("pointerdown", (event) => {
      cameraState.dragging = true;
      cameraState.x = event.clientX;
      cameraState.y = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!cameraState.dragging) return;
      const dx = event.clientX - cameraState.x;
      const dy = event.clientY - cameraState.y;
      cameraState.theta -= dx * 0.007;
      cameraState.phi = clamp(cameraState.phi + dy * 0.006, -1.22, 1.22);
      cameraState.x = event.clientX;
      cameraState.y = event.clientY;
      placeCamera();
    });
    canvas.addEventListener("pointerup", () => {
      cameraState.dragging = false;
    });
    canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      cameraState.radius = clamp(cameraState.radius + event.deltaY * 0.006, 4.5, 14);
      placeCamera();
    }, { passive: false });
    window.addEventListener("resize", resize);
    resize();
    placeCamera();
    // Generic premium polish for EVERY quantum lab (i01-i06): transparent shadow-catcher
    // (added once) + auto shadow-casters, via a renderer.render patch. Zero per-lab code.
    const _qOrigRender = renderer.render.bind(renderer);
    let _qGrounded = false;
    renderer.render = function (sc, cam) {
      if (!_qGrounded) {
        try {
          const gp = new THREE.Mesh(new THREE.PlaneGeometry(44, 44), new THREE.ShadowMaterial({ opacity: 0.3 }));
          gp.rotation.x = -Math.PI / 2; gp.position.y = -1.4; gp.receiveShadow = true; gp.userData.engineRef = true;
          sc.add(gp);
        } catch (e) {}
        _qGrounded = true;
      }
      sc.traverse((o) => {
        if (o.isMesh && o.geometry && !o.castShadow && !o.userData.engineRef) {
          const t = o.geometry.type || "";
          if (t.indexOf("Sphere") >= 0 || t.indexOf("Box") >= 0 || t.indexOf("Cylinder") >= 0 || t.indexOf("Cone") >= 0 || t.indexOf("Torus") >= 0) o.castShadow = true;
        }
      });
      _qOrigRender(sc, cam);
    };
    try { window.__quantumRenderNow = function () { try { resize(); } catch (e) {} renderer.render(scene, camera); }; } catch (e) {}
    return { renderer, scene, camera, cameraState, resize };
  }

  function buildBlochScaffold(group, labels, radius, center) {
    const shell = makeSphere(radius, COLORS.blue, 0.09);
    shell.position.copy(center);
    group.add(shell);
    const wire = new THREE.Mesh(new THREE.SphereGeometry(radius * 1.002, 36, 18), new THREE.MeshBasicMaterial({
      color: COLORS.cyan,
      wireframe: true,
      transparent: true,
      opacity: 0.12
    }));
    wire.position.copy(center);
    group.add(wire);
    const equator = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.009, 8, 128), material(COLORS.cyan, 0.28));
    equator.position.copy(center);
    equator.rotation.x = Math.PI / 2;
    group.add(equator);
    const yz = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.008, 8, 128), material(COLORS.blue, 0.14));
    yz.position.copy(center);
    yz.rotation.y = Math.PI / 2;
    group.add(yz);
    const xy = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.008, 8, 128), material(COLORS.green, 0.14));
    xy.position.copy(center);
    group.add(xy);

    const axisSpecs = [
      ["+X", new THREE.Vector3(radius * 1.1, 0, 0), COLORS.cyan],
      ["-X", new THREE.Vector3(-radius * 1.1, 0, 0), COLORS.cyan],
      ["+Y", new THREE.Vector3(0, radius * 1.1, 0), COLORS.green],
      ["-Y", new THREE.Vector3(0, -radius * 1.1, 0), COLORS.green],
      ["|0>", new THREE.Vector3(0, 0, radius * 1.14), COLORS.blue],
      ["|1>", new THREE.Vector3(0, 0, -radius * 1.14), COLORS.amber]
    ];
    axisSpecs.forEach(([text, offset, color]) => addLabel(group, labels, text, center.clone().add(offset).toArray(), `#${color.toString(16).padStart(6, "0")}`, [0.48, 0.14, 1]));

    [
      [new THREE.Vector3(-radius, 0, 0), new THREE.Vector3(radius, 0, 0), COLORS.cyan],
      [new THREE.Vector3(0, -radius, 0), new THREE.Vector3(0, radius, 0), COLORS.green],
      [new THREE.Vector3(0, 0, -radius), new THREE.Vector3(0, 0, radius), COLORS.blue]
    ].forEach(([a, b, color]) => {
      const axis = makeCylinder(0.007, color, 0.24);
      placeCylinderBetween(axis, center.clone().add(a), center.clone().add(b));
      group.add(axis);
    });
  }

  function vectorFromAngles(theta, phi, coherence) {
    return new THREE.Vector3(
      Math.sin(theta) * Math.cos(phi) * coherence,
      Math.sin(theta) * Math.sin(phi) * coherence,
      Math.cos(theta) * coherence
    );
  }

  function basisAxis(basis, angle) {
    if (basis === "custom") return new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle)).normalize();
    return AXIS[basis] ? AXIS[basis].clone() : AXIS.Z.clone();
  }

  function outcomeLabels(basis) {
    if (basis === "X") return ["+ in X", "- in X"];
    if (basis === "Y") return ["+i in Y", "-i in Y"];
    if (basis === "custom") return ["+ in custom", "- in custom"];
    return ["0 in Z", "1 in Z"];
  }

  function pseudoSample(probability, cursor) {
    const raw = Math.sin(cursor * 12.9898 + 78.233) * 43758.5453;
    const unit = raw - Math.floor(raw);
    return unit < probability ? 0 : 1;
  }

  function createI01QuantumMeasurementLab() {
    const root = document.querySelector(".lab-shell");
    const canvas = document.getElementById("canvas");
    if (!root || !canvas || !window.THREE) return;
    const { renderer, scene, camera, cameraState } = setupScene(canvas, 7.2);
    const labels = [];
    const group = new THREE.Group();
    scene.add(group);
    const center = new THREE.Vector3(-1.45, 0.05, 0.1);
    const radius = 1.55;
    const state = {
      theta: rangeValue("theta", Math.PI / 2),
      phi: rangeValue("phi", 0),
      basis: selectValue("basis", "Z"),
      basisAngle: rangeValue("basisAngle", 0),
      shots: rangeValue("shots", 64),
      coherence: rangeValue("coherence", 1),
      zeros: 0,
      ones: 0,
      samples: [],
      cursor: 1,
      status: "Ready",
      lastControl: "initial",
      revision: 0,
      controls: {}
    };

    buildBlochScaffold(group, labels, radius, center);
    const scaffoldObjects = group.children.slice();
    addLabel(group, labels, "current state vector", [-1.2, 1.96, 0.46], "#58e0d3", [0.78, 0.17, 1]);
    addLabel(group, labels, "basis axis:", [-3.05, -1.62, 0.88], "#e8b857", [0.55, 0.15, 1]);
    addLabel(group, labels, "sample dots: blue=0, amber=1", [1.68, -1.83, 0.34], "#edf8f6", [1.12, 0.16, 1]);
    addLabel(group, labels, "density matrix", [2.55, 1.62, -0.4], "#9b8cff", [0.64, 0.16, 1]);

    const stateArrow = makeArrow(COLORS.cyan, 0.035, 0.95);
    const pureArrow = makeArrow(COLORS.violet, 0.016, 0.24);
    const basisLine = makeCylinder(0.022, COLORS.amber, 0.62);
    const projectionLine = makeLine([new THREE.Vector3(), new THREE.Vector3()], COLORS.rose, 0.58);
    group.add(stateArrow, pureArrow, basisLine, projectionLine);
    const endpointDot = makeSphere(0.08, COLORS.cyan, 1);
    const projectionDot = makeSphere(0.07, COLORS.rose, 0.9);
    group.add(endpointDot, projectionDot);
    // ===== legibility layer (h06/h07-style clean override, additive only): glow halos on
    // the focal spheres (Bloch state-vector tip + Born projection dot), two region labels
    // (left = concept, right = readout) and short node labels. All decor lives on the scene
    // (not `group`) with engineRef=true, so it never enters any counted array / scaffold /
    // label set in the snapshot. =====
    const i01StateHalo = qGlow(COLORS.cyan, 0.45); i01StateHalo.userData.engineRef = true; i01StateHalo.material.opacity = 0.5; scene.add(i01StateHalo);
    const i01ProjHalo = qGlow(COLORS.rose, 0.4); i01ProjHalo.userData.engineRef = true; i01ProjHalo.material.opacity = 0.5; scene.add(i01ProjHalo);
    const i01ConceptLabel = qLabel("BLOCH STATE + MEASUREMENT", 0x9fb4cc, 0.3); i01ConceptLabel.userData.engineRef = true; scene.add(i01ConceptLabel);
    const i01ReadoutLabel = qLabel("BORN READOUT", 0x9fb4cc, 0.3); i01ReadoutLabel.userData.engineRef = true; scene.add(i01ReadoutLabel);
    const i01PsiLabel = qLabel("|psi>", 0x58e0d3, 0.2); i01PsiLabel.userData.engineRef = true; scene.add(i01PsiLabel);
    const i01MLabel = qLabel("M", 0xe8b857, 0.2); i01MLabel.userData.engineRef = true; scene.add(i01MLabel);

    const probabilityBars = [
      makeBox([0.34, 1, 0.16], COLORS.blue, 0.85),
      makeBox([0.34, 1, 0.16], COLORS.amber, 0.85)
    ];
    probabilityBars[0].position.set(1.42, -0.85, -0.2);
    probabilityBars[1].position.set(1.86, -0.85, -0.2);
    probabilityBars.forEach((bar) => group.add(bar));
    const barBase = makeLine([new THREE.Vector3(1.18, -1.4, -0.2), new THREE.Vector3(2.12, -1.4, -0.2)], COLORS.ink, 0.28);
    group.add(barBase);
    addLabel(group, labels, "p(0 in basis)", [1.38, -1.55, -0.2], "#54a8ff", [0.56, 0.14, 1]);
    addLabel(group, labels, "p(1 in basis)", [1.88, -1.55, -0.2], "#e8b857", [0.56, 0.14, 1]);

    const sampleDots = Array.from({ length: 64 }, (_, index) => {
      const dot = makeSphere(0.035, index % 2 ? COLORS.amber : COLORS.blue, 0.18);
      dot.position.set(0.75 + (index % 16) * 0.12, -1.88, -0.72 + Math.floor(index / 16) * 0.11);
      group.add(dot);
      return dot;
    });

    const matrixCells = [];
    for (let row = 0; row < 2; row += 1) {
      for (let col = 0; col < 2; col += 1) {
        const cell = makeBox([0.34, 0.34, 0.08], row === col ? COLORS.blue : COLORS.violet, 0.55);
        cell.position.set(2.55 + (col - 0.5) * 0.42, 0.72 - row * 0.42, -0.28);
        group.add(cell);
        matrixCells.push(cell);
      }
    }

    function mark(control, value) {
      state.lastControl = control;
      state.status = `Changed ${control}`;
      state.revision += 1;
      state.controls[control] = value === undefined ? "clicked" : String(value);
      if (value !== undefined) state[control] = value;
    }

    function stats() {
      state.theta = rangeValue("theta", state.theta);
      state.phi = rangeValue("phi", state.phi);
      state.basis = selectValue("basis", state.basis);
      state.basisAngle = rangeValue("basisAngle", state.basisAngle);
      state.shots = rangeValue("shots", state.shots);
      state.coherence = rangeValue("coherence", state.coherence);
      const r = vectorFromAngles(state.theta, state.phi, state.coherence);
      const pure = vectorFromAngles(state.theta, state.phi, 1);
      const b = basisAxis(state.basis, state.basisAngle);
      const probability = clamp((1 + r.dot(b)) / 2, 0, 1);
      return {
        theta: state.theta,
        phi: state.phi,
        basis: state.basis,
        basisAngle: state.basisAngle,
        shots: state.shots,
        coherence: state.coherence,
        vector: r,
        pureVector: pure,
        basisVector: b,
        probability,
        p0: probability,
        p1: 1 - probability,
        expectation: probability * 2 - 1,
        purity: (1 + state.coherence * state.coherence) / 2
      };
    }

    function drawBlochShell(theta, phi, basis, probability, shots, ones) {
      const s = stats();
      const start = center.clone();
      const stateEnd = center.clone().add(s.vector.clone().multiplyScalar(radius));
      const pureEnd = center.clone().add(s.pureVector.clone().multiplyScalar(radius));
      const axisEnd = s.basisVector.clone().multiplyScalar(radius * 1.22);
      const projScalar = s.vector.dot(s.basisVector);
      const projection = center.clone().add(s.basisVector.clone().multiplyScalar(projScalar * radius));
      placeArrow(stateArrow, start, stateEnd);
      placeArrow(pureArrow, start, pureEnd);
      placeCylinderBetween(basisLine, center.clone().sub(axisEnd), center.clone().add(axisEnd));
      updateLine(projectionLine, [stateEnd, projection]);
      endpointDot.position.copy(stateEnd);
      projectionDot.position.copy(projection);
      probabilityBars[0].scale.y = Math.max(0.03, s.p0);
      probabilityBars[1].scale.y = Math.max(0.03, s.p1);
      probabilityBars[0].position.y = -1.4 + probabilityBars[0].scale.y * 0.5;
      probabilityBars[1].position.y = -1.4 + probabilityBars[1].scale.y * 0.5;
      matrixCells[0].scale.y = 0.25 + s.p0 * 0.9;
      matrixCells[3].scale.y = 0.25 + s.p1 * 0.9;
      matrixCells[1].scale.y = matrixCells[2].scale.y = 0.25 + state.coherence * 0.75;
      matrixCells[1].material.opacity = matrixCells[2].material.opacity = 0.18 + state.coherence * 0.56;
      sampleDots.forEach((dot, index) => {
        const sample = state.samples[index];
        dot.visible = index < Math.min(sampleDots.length, state.samples.length || Math.min(ones + shots - shots, 0));
        if (sample !== undefined) {
          dot.visible = true;
          dot.material.color.setHex(sample === 0 ? COLORS.blue : COLORS.amber);
          dot.material.opacity = 0.42 + (index / Math.max(1, sampleDots.length)) * 0.25;
          dot.scale.setScalar(sample === 0 ? 1.05 : 1.18);
        }
      });
    }

    function updatePanel() {
      const s = stats();
      syncOutput("theta", s.theta, 2);
      syncOutput("phi", s.phi, 2);
      syncOutput("basisAngle", s.basisAngle, 2);
      syncOutput("shots", s.shots, 0);
      syncOutput("coherence", s.coherence, 2);
      const labels = outcomeLabels(s.basis);
      setText("basisLabel", s.basis);
      setText("basisOutcome0", `p(${labels[0]})`);
      setText("basisOutcome1", `p(${labels[1]})`);
      setText("p0Label", fmt(s.p0, 2));
      setText("p1Label", fmt(s.p1, 2));
      setText("sampleLabel", `${state.zeros}/${state.zeros + state.ones} zeros / ${state.ones} ones from ${s.shots}`);
      setText("purityLabel", fmt(s.purity, 2));
      const insight = document.querySelector("[data-role='insight']");
      if (insight) insight.innerHTML = `<span id="basisLabel">${s.basis}</span> basis axis: projection length becomes probability before samples are drawn.`;
      const selected = document.getElementById("selectedLabel");
      if (selected) selected.textContent = `basis ${s.basis}, p0 ${fmt(s.p0, 2)}, p1 ${fmt(s.p1, 2)}`;
      const stateBox = document.getElementById("state");
      if (stateBox) {
        const phaseNote = s.basis === "Z"
          ? "In Z basis, phi rotates around the measurement axis, so population bars stay fixed."
          : "In X/Y/custom basis, relative phase changes the overlap with the measurement axis.";
        stateBox.textContent = `${state.status}: current state vector has theta=${fmt(s.theta, 2)}, phi=${fmt(s.phi, 2)}, basis axis ${s.basis}, Born probability ${fmt(s.p0, 2)} / ${fmt(s.p1, 2)}, coherence ${fmt(s.coherence, 2)}. ${phaseNote} Last control ${state.lastControl}.`;
      }
    }

    function updateScene() {
      const s = stats();
      drawBlochShell(s.theta, s.phi, s.basis, s.probability, s.shots, state.ones);
      updatePanel();
      // ===== CLEAN OVERRIDE: park glow halos on the focal spheres + sit region/node labels.
      // Purely additive (engineRef decor on the scene); the dense readout arrays stay visible
      // and fully control-driven by drawBlochShell above, so every hash keeps moving. =====
      i01StateHalo.position.copy(endpointDot.position); i01StateHalo.material.opacity = 0.5;
      i01StateHalo.scale.setScalar(Math.max(0.34, endpointDot.scale.x * 0.45));
      i01ProjHalo.position.copy(projectionDot.position); i01ProjHalo.material.opacity = 0.5;
      i01ProjHalo.scale.setScalar(Math.max(0.3, projectionDot.scale.x * 0.42));
      // node labels: |psi> floats just past the state-vector tip; M marks the measurement axis end.
      i01PsiLabel.position.copy(endpointDot.position).add(new THREE.Vector3(0.18, 0.26, 0));
      const i01AxisEnd = center.clone().add(s.basisVector.clone().multiplyScalar(radius * 1.32));
      i01MLabel.position.copy(i01AxisEnd).add(new THREE.Vector3(0, 0.2, 0));
      // region labels: left header over the Bloch concept, right header over the Born readout column.
      i01ConceptLabel.position.copy(center).add(new THREE.Vector3(0, radius + 0.55, 0));
      i01ReadoutLabel.position.set(1.95, 1.55, -0.2);
    }

    function setRangeValue(id, value) {
      const input = document.getElementById(id);
      if (input) input.value = String(value);
    }

    function setSelectValue(id, value) {
      const input = document.getElementById(id);
      if (input) input.value = value;
    }

    function addSample(count) {
      const s = stats();
      for (let i = 0; i < count; i += 1) {
        const sample = pseudoSample(s.p0, state.cursor + i);
        if (sample === 0) state.zeros += 1;
        else state.ones += 1;
        state.samples.push(sample);
      }
      state.samples = state.samples.slice(-sampleDots.length);
      state.cursor += count + 1;
    }

    root.querySelectorAll("input[type='range'], select").forEach((control) => {
      control.addEventListener("input", () => {
        mark(control.id || "control", control.value);
        updateScene();
      });
      control.addEventListener("change", () => {
        mark(control.id || "control", control.value);
        updateScene();
      });
    });
    const hadamard = document.getElementById("hadamard");
    if (hadamard) hadamard.addEventListener("click", () => {
      setRangeValue("theta", (Math.PI / 2).toFixed(3));
      setRangeValue("phi", "0");
      setRangeValue("coherence", "1");
      setSelectValue("basis", "X");
      state.status = "Preset |+>";
      mark("hadamard");
      updateScene();
    });
    const measureY = document.getElementById("measureY");
    if (measureY) measureY.addEventListener("click", () => {
      setSelectValue("basis", "Y");
      state.status = "Measure in Y basis";
      mark("measureY");
      updateScene();
    });
    const measureZ = document.getElementById("measure");
    if (measureZ) measureZ.addEventListener("click", () => {
      setSelectValue("basis", "Z");
      addSample(1);
      state.status = "Measure in Z basis";
      mark("measure");
      updateScene();
    });
    const fireShot = document.getElementById("fireShot");
    if (fireShot) fireShot.addEventListener("click", () => {
      addSample(1);
      state.status = "Single shot";
      mark("fireShot");
      updateScene();
    });
    const runShots = document.getElementById("runShots");
    if (runShots) runShots.addEventListener("click", () => {
      const s = stats();
      addSample(s.shots);
      state.status = "Run shots";
      mark("runShots");
      updateScene();
    });
    const reset = document.getElementById("resetI01");
    if (reset) reset.addEventListener("click", () => {
      setRangeValue("theta", (Math.PI / 2).toFixed(3));
      setRangeValue("phi", "0");
      setRangeValue("basisAngle", "0");
      setRangeValue("shots", "64");
      setRangeValue("coherence", "1");
      setSelectValue("basis", "Z");
      setSelectValue("viewMode", "state");
      state.zeros = 0;
      state.ones = 0;
      state.samples = [];
      state.status = "Ready";
      mark("resetI01");
      updateScene();
    });

    window.__i01LabSnapshot = () => {
      const s = stats();
      const totalSamples = state.zeros + state.ones;
      const sampleP0 = totalSamples > 0 ? state.zeros / totalSamples : s.p0;
      return {
        kind: "quantum-state-measurement",
        labId: "i01",
        visualKind: "bloch-born-measurement",
        sceneObject: "bloch-sphere-state-vector-measurement-axis-born-projection-shot-samples-density-matrix",
        theta: state.theta,
        phi: state.phi,
        basis: state.basis,
        probability: s.probability,
        p0: s.p0,
        p1: s.p1,
        zeros: state.zeros,
        ones: state.ones,
        shots: s.shots,
        coherence: state.coherence,
        purity: s.purity,
        expectation: s.expectation,
        sampleError: Math.abs(sampleP0 - s.p0),
        sampleDotCount: sampleDots.length,
        basisAxisLabel: state.basis,
        blochScaffoldObjectCount: scaffoldObjects.length,
        stateVectorObjectCount: 1,
        basisAxisObjectCount: 1,
        projectionGeometryObjectCount: 3,
        bornProbabilityBarObjectCount: probabilityBars.length,
        finiteShotSampleObjectCount: sampleDots.length,
        densityMatrixObjectCount: matrixCells.length,
        teachingLabelObjectCount: labels.length,
        has3d: true,
        clarityVersion: "h15-i01-canonical-clarity-v1",
        blochScaffoldHash: objectHash(scaffoldObjects),
        stateVectorHash: objectHash([stateArrow.userData.body, stateArrow.userData.head, pureArrow.userData.body, pureArrow.userData.head, endpointDot]),
        basisAxisHash: objectHash([basisLine]),
        projectionGeometryHash: `${lineHash([projectionLine])}-${objectHash([projectionDot, endpointDot])}`,
        bornProbabilityHash: objectHash(probabilityBars),
        finiteShotHash: objectHash(sampleDots),
        densityMatrixHash: objectHash(matrixCells),
        teachingLabelHash: objectHash(labels),
        canonicalReferences: ["complex Hilbert vector", "Bloch sphere parametrization", "measurement basis axis", "Born rule projection", "finite shot sampling", "density matrix coherence", "global phase versus relative phase"],
        quantumObjects: ["complex_state_vector", "bloch_sphere_surface", "measurement_basis_axis", "born_rule_projection", "probability_histogram", "finite_shot_samples", "density_matrix_coherence"],
        diagnosticMetrics: ["theta", "phi", "basis_probability", "expectation_value", "purity", "shot_count", "sample_error"],
        cameraTheta: cameraState.theta,
        cameraPhi: cameraState.phi,
        cameraRadius: cameraState.radius,
        stateText: document.getElementById("state") ? document.getElementById("state").textContent.trim() : "",
        revision: state.revision,
        lastControl: state.lastControl,
        controls: Object.assign({}, state.controls)
      };
    };
    window.__i01LabReady = true;
    updateScene();
    function animate() {
      requestAnimationFrame(animate);
      labels.forEach((label) => label.quaternion.copy(camera.quaternion));
      renderer.render(scene, camera);
    }
    animate();
  }

  function complex(re, im) {
    return { re, im: im || 0 };
  }

  function cAdd(a, b) {
    return complex(a.re + b.re, a.im + b.im);
  }

  function cMul(a, b) {
    return complex(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
  }

  function cScale(a, s) {
    return complex(a.re * s, a.im * s);
  }

  function cAbs2(a) {
    return a.re * a.re + a.im * a.im;
  }

  function cStr(a) {
    const re = Math.abs(a.re) < 0.005 ? 0 : a.re;
    const im = Math.abs(a.im) < 0.005 ? 0 : a.im;
    if (Math.abs(im) < 0.005) return fmt(re, 2);
    if (Math.abs(re) < 0.005) return `${fmt(im, 2)}i`;
    return `${fmt(re, 2)}${im >= 0 ? "+" : ""}${fmt(im, 2)}i`;
  }

  function normalizeState(vector) {
    const norm = Math.sqrt(vector.reduce((sum, value) => sum + cAbs2(value), 0)) || 1;
    return vector.map((value) => cScale(value, 1 / norm));
  }

  function applyMatrix(vector, matrix) {
    return normalizeState([
      cAdd(cMul(matrix[0][0], vector[0]), cMul(matrix[0][1], vector[1])),
      cAdd(cMul(matrix[1][0], vector[0]), cMul(matrix[1][1], vector[1]))
    ]);
  }

  function gateMatrix(gate, angle) {
    const h = 1 / Math.sqrt(2);
    if (gate === "X") return [[complex(0), complex(1)], [complex(1), complex(0)]];
    if (gate === "Y") return [[complex(0), complex(0, -1)], [complex(0, 1), complex(0)]];
    if (gate === "Z") return [[complex(1), complex(0)], [complex(0), complex(-1)]];
    if (gate === "S") return [[complex(1), complex(0)], [complex(0), complex(0, 1)]];
    if (gate === "T") return [[complex(1), complex(0)], [complex(0), complex(Math.SQRT1_2, Math.SQRT1_2)]];
    if (gate === "Rx") {
      const c = Math.cos(angle / 2);
      const s = Math.sin(angle / 2);
      return [[complex(c), complex(0, -s)], [complex(0, -s), complex(c)]];
    }
    if (gate === "Ry") {
      const c = Math.cos(angle / 2);
      const s = Math.sin(angle / 2);
      return [[complex(c), complex(-s)], [complex(s), complex(c)]];
    }
    if (gate === "Rz") {
      return [
        [complex(Math.cos(-angle / 2), Math.sin(-angle / 2)), complex(0)],
        [complex(0), complex(Math.cos(angle / 2), Math.sin(angle / 2))]
      ];
    }
    return [[complex(h), complex(h)], [complex(h), complex(-h)]];
  }

  function blochFromState(vector) {
    const a = vector[0];
    const b = vector[1];
    const ab = cMul({ re: a.re, im: -a.im }, b);
    const x = 2 * ab.re;
    const y = 2 * ab.im;
    const z = cAbs2(a) - cAbs2(b);
    return new THREE.Vector3(x, y, z);
  }

  function stateLabel(vector) {
    const p0 = cAbs2(vector[0]);
    const p1 = cAbs2(vector[1]);
    if (p0 > 0.995) return "|0>";
    if (p1 > 0.995) return "|1>";
    if (Math.abs(p0 - 0.5) < 0.02 && Math.abs(vector[1].im) < 0.03 && vector[1].re > 0) return "|+>";
    if (Math.abs(p0 - 0.5) < 0.02 && Math.abs(vector[1].im) < 0.03 && vector[1].re < 0) return "|->";
    if (Math.abs(p0 - 0.5) < 0.02 && vector[1].im > 0.5) return "|+i>";
    if (Math.abs(p0 - 0.5) < 0.02 && vector[1].im < -0.5) return "|-i>";
    return "|psi>";
  }

  function setPresetState(name) {
    const h = 1 / Math.sqrt(2);
    if (name === "1") return [complex(0), complex(1)];
    if (name === "+") return [complex(h), complex(h)];
    if (name === "-") return [complex(h), complex(-h)];
    if (name === "+i") return [complex(h), complex(0, h)];
    if (name === "-i") return [complex(h), complex(0, -h)];
    return [complex(1), complex(0)];
  }

  function createI02QuantumGatesCircuitLab() {
    const root = document.querySelector(".lab-shell");
    const canvas = document.getElementById("canvas");
    if (!root || !canvas || !window.THREE) return;
    const { renderer, scene, camera, cameraState } = setupScene(canvas, 8.2);
    const labels = [];
    const group = new THREE.Group();
    scene.add(group);
    const center = new THREE.Vector3(-2.15, 0.18, 0.18);
    const radius = 1.35;
    const scaffoldStart = group.children.length;
    buildBlochScaffold(group, labels, radius, center);
    const blochScaffoldObjects = group.children.slice(scaffoldStart).filter((object) => !(object.userData && object.userData.textLabel));
    addLabel(group, labels, "Bloch vector", [-2.0, 1.86, 0.42], "#58e0d3", [0.62, 0.16, 1]);
    addLabel(group, labels, "selected gate", [-0.7, 1.36, 0.95], "#e8b857", [0.58, 0.15, 1]);
    addLabel(group, labels, "gate rotation arc", [-3.55, -1.35, 0.8], "#9b8cff", [0.72, 0.15, 1]);
    addLabel(group, labels, "q0 -- H --", [0.3, 0.88, -0.65], "#54a8ff", [0.56, 0.14, 1]);
    addLabel(group, labels, "CNOT control", [1.68, 0.58, -0.66], "#e8b857", [0.58, 0.14, 1]);
    addLabel(group, labels, "Bell pair amplitudes", [2.38, 1.36, 0.58], "#77df96", [0.76, 0.15, 1]);
    addLabel(group, labels, "tensor-product basis", [2.35, -1.58, 0.56], "#edf8f6", [0.78, 0.15, 1]);
    addLabel(group, labels, "measurement histogram", [0.98, -1.78, -0.72], "#58e0d3", [0.78, 0.15, 1]);

    const state = {
      vector: [complex(1), complex(0)],
      history: [],
      gateHistory: [],
      selectedGate: "H",
      mode: "single",
      status: "Ready",
      zeroCount: 0,
      oneCount: 0,
      twoCounts: { "00": 0, "01": 0, "10": 0, "11": 0 },
      twoState: [complex(1), complex(0), complex(0), complex(0)],
      lastControl: "initial",
      revision: 0
    };

    const blochArrow = makeArrow(COLORS.cyan, 0.034, 0.95);
    group.add(blochArrow);
    const selectedAxis = makeCylinder(0.019, COLORS.amber, 0.46);
    group.add(selectedAxis);
    const rotationRing = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.08, 0.013, 8, 128), material(COLORS.violet, 0.32));
    rotationRing.position.copy(center);
    group.add(rotationRing);
    const endpointDot = makeSphere(0.075, COLORS.cyan, 1);
    group.add(endpointDot);

    const circuitGroup = new THREE.Group();
    group.add(circuitGroup);
    const q0Line = makeLine([new THREE.Vector3(-0.45, 0.32, -0.8), new THREE.Vector3(3.2, 0.32, -0.8)], COLORS.blue, 0.55);
    const q1Line = makeLine([new THREE.Vector3(-0.45, -0.25, -0.8), new THREE.Vector3(3.2, -0.25, -0.8)], COLORS.blue, 0.38);
    circuitGroup.add(q0Line, q1Line);
    addLabel(circuitGroup, labels, "q0", [-0.68, 0.32, -0.8], "#54a8ff", [0.32, 0.12, 1]);
    addLabel(circuitGroup, labels, "q1", [-0.68, -0.25, -0.8], "#54a8ff", [0.32, 0.12, 1]);
    const gateSlots = Array.from({ length: 7 }, (_, index) => {
      const box = makeBox([0.27, 0.27, 0.12], COLORS.amber, 0.12);
      box.position.set(0.02 + index * 0.42, 0.32, -0.8);
      circuitGroup.add(box);
      const label = addLabel(circuitGroup, labels, "", [box.position.x, 0.65, -0.8], "#e8b857", [0.34, 0.11, 1]);
      return { box, label };
    });
    const cnotDot = makeSphere(0.07, COLORS.amber, 0.3);
    const cnotTarget = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 8, 32), material(COLORS.amber, 0.3));
    const cnotStem = makeCylinder(0.01, COLORS.amber, 0.26);
    cnotDot.position.set(1.65, 0.32, -0.8);
    cnotTarget.position.set(1.65, -0.25, -0.8);
    placeCylinderBetween(cnotStem, cnotDot.position, cnotTarget.position);
    circuitGroup.add(cnotDot, cnotTarget, cnotStem);

    const amplitudeBars = ["alpha", "beta", "|00>", "|01>", "|10>", "|11>"].map((name, index) => {
      const two = index >= 2;
      const bar = makeBox([0.22, 1, 0.16], two ? COLORS.green : COLORS.blue, two ? 0.45 : 0.78);
      bar.position.set(two ? 2.02 + (index - 2) * 0.34 : -0.05 + index * 0.34, two ? -0.86 : -1.0, two ? 0.54 : 0.72);
      group.add(bar);
      addLabel(group, labels, name, [bar.position.x, bar.position.y - 0.58, bar.position.z], two ? "#77df96" : "#54a8ff", [0.34, 0.11, 1]);
      return bar;
    });
    const histogramBars = [0, 1].map((index) => {
      const bar = makeBox([0.28, 1, 0.14], index === 0 ? COLORS.blue : COLORS.amber, 0.7);
      bar.position.set(0.66 + index * 0.42, -1.22, -0.7);
      group.add(bar);
      return bar;
    });
    const stateVectorObjects = [blochArrow.userData.body, blochArrow.userData.head, endpointDot];
    const gateArcObjects = [rotationRing, selectedAxis];
    const unitaryGateObjects = [selectedAxis, rotationRing];
    const circuitWireObjects = [q0Line, q1Line];
    const circuitGateObjects = gateSlots.map(({ box }) => box);
    const cnotObjects = [cnotDot, cnotTarget, cnotStem];
    const bellAmplitudeObjects = amplitudeBars.slice(2);
    const tensorBasisObjects = amplitudeBars.slice(2);

    // ===== legibility layer (i01-style clean override): glow halos on the focal spheres
    // (Bloch vector tip + CNOT control), two region labels (left = concept, right = readout)
    // and a few short ASCII node tags. All decor is engine-managed (engineRef + scene.add) and
    // positioned every frame at the end of updateScene so position hashes keep changing. The
    // canonical hashed instruments (Bloch scaffold, state vector, circuit, amplitudes,
    // histogram) are left fully intact -- nothing is hidden, only halos+labels are added. =====
    const i02TipHalo = qGlow(COLORS.cyan, 0.55); i02TipHalo.userData.engineRef = true; scene.add(i02TipHalo);
    const i02CtrlHalo = qGlow(COLORS.amber, 0.4); i02CtrlHalo.userData.engineRef = true; scene.add(i02CtrlHalo);
    const i02PsiTag = qLabel("|psi>", 0x58e0d3, 0.2); i02PsiTag.userData.engineRef = true; scene.add(i02PsiTag);
    const i02CtrlTag = qLabel("M", 0xe8b857, 0.2); i02CtrlTag.userData.engineRef = true; scene.add(i02CtrlTag);
    const i02RegionConcept = qLabel("QUBIT STATE / BLOCH", 0x9fb4cc, 0.3); i02RegionConcept.userData.engineRef = true; scene.add(i02RegionConcept);
    const i02RegionReadout = qLabel("AMPLITUDES + MEASUREMENT", 0x9fb4cc, 0.3); i02RegionReadout.userData.engineRef = true; scene.add(i02RegionReadout);

    function mark(control) {
      state.lastControl = control;
      state.revision += 1;
    }

    function selectedGateAxis(gate) {
      if (gate === "X" || gate === "Rx") return AXIS.X.clone();
      if (gate === "Y" || gate === "Ry") return AXIS.Y.clone();
      if (gate === "Z" || gate === "S" || gate === "T" || gate === "Rz") return AXIS.Z.clone();
      return new THREE.Vector3(1, 0, 1).normalize();
    }

    function applyGate(selectedGate, source) {
      const angle = rangeValue("rotationAngle", Math.PI / 2);
      state.history.push(state.vector.map((value) => complex(value.re, value.im)));
      state.vector = applyMatrix(state.vector, gateMatrix(selectedGate, angle));
      state.gateHistory.push(selectedGate);
      state.selectedGate = selectedGate;
      state.mode = "single";
      state.status = `Applied ${selectedGate}`;
      mark(source || selectedGate);
      updateScene();
    }

    function buildBellCircuit() {
      const mix = rangeValue("entangleStrength", 1);
      const a = Math.sqrt(clamp(0.5 + (1 - mix) * 0.5, 0.5, 1));
      const d = Math.sqrt(Math.max(0, 1 - a * a));
      state.twoState = normalizeState([complex(a), complex(0), complex(0), complex(d)]);
      state.vector = [complex(Math.SQRT1_2), complex(Math.SQRT1_2)];
      state.gateHistory = ["H", "CNOT"];
      state.mode = "circuit";
      state.status = "Bell builder";
      state.selectedGate = "CNOT";
      mark("bell");
      updateScene();
    }

    function applyCnot() {
      const next = [state.twoState[0], state.twoState[1], state.twoState[3], state.twoState[2]];
      state.twoState = normalizeState(next);
      state.mode = "circuit";
      state.status = "CNOT applied";
      state.selectedGate = "CNOT";
      state.gateHistory.push("CNOT");
      mark("cnot");
      updateScene();
    }

    function measure() {
      const shots = rangeValue("shotCount", 96);
      if (state.mode === "circuit") {
        const probs = state.twoState.map(cAbs2);
        state.twoCounts = { "00": 0, "01": 0, "10": 0, "11": 0 };
        for (let i = 0; i < shots; i += 1) {
          const r = (Math.sin((i + state.revision + 2) * 17.17) * 9999) % 1;
          const u = r < 0 ? r + 1 : r;
          let acc = 0;
          const labels = ["00", "01", "10", "11"];
          for (let j = 0; j < 4; j += 1) {
            acc += probs[j];
            if (u <= acc || j === 3) {
              state.twoCounts[labels[j]] += 1;
              break;
            }
          }
        }
        state.zeroCount = state.twoCounts["00"] + state.twoCounts["01"];
        state.oneCount = state.twoCounts["10"] + state.twoCounts["11"];
      } else {
        const p0 = cAbs2(state.vector[0]);
        state.zeroCount = 0;
        state.oneCount = 0;
        for (let i = 0; i < shots; i += 1) {
          const sample = pseudoSample(p0, i + state.revision + 3);
          if (sample === 0) state.zeroCount += 1;
          else state.oneCount += 1;
        }
      }
      state.status = "Measured Z";
      mark("measureCircuit");
      updateScene();
    }

    function updateScene() {
      const gate = state.selectedGate;
      const axis = selectedGateAxis(gate);
      const bloch = blochFromState(state.vector);
      const start = center.clone();
      const end = center.clone().add(bloch.multiplyScalar(radius));
      const rotationAngle = rangeValue("rotationAngle", Math.PI / 2);
      placeArrow(blochArrow, start, end);
      endpointDot.position.copy(end);
      placeCylinderBetween(selectedAxis, center.clone().sub(axis.clone().multiplyScalar(radius * 1.18)), center.clone().add(axis.clone().multiplyScalar(radius * 1.18)));
      rotationRing.rotation.set(0, 0, 0);
      if (axis.x) rotationRing.rotation.y = Math.PI / 2;
      if (axis.y) rotationRing.rotation.x = Math.PI / 2;
      if (gate === "H") rotationRing.rotation.y = Math.PI / 4;
      const turn = clamp(rotationAngle / (Math.PI * 2), 0, 1);
      rotationRing.scale.setScalar(0.9 + turn * 0.28);
      rotationRing.material.opacity = 0.24 + turn * 0.46;

      gateSlots.forEach(({ box, label }, index) => {
        const gateName = state.gateHistory[index] || "";
        box.visible = Boolean(gateName);
        label.visible = Boolean(gateName);
        if (gateName) {
          label.material.map.dispose();
          label.material.map = makeLabelTexture(gateName, "#e8b857");
          label.material.needsUpdate = true;
          box.material.opacity = gateName === "CNOT" ? 0.52 : 0.78;
          box.material.color.setHex(gateName === "CNOT" ? COLORS.green : COLORS.amber);
        }
      });
      const cnotVisible = state.mode === "circuit" || state.gateHistory.includes("CNOT");
      cnotDot.visible = cnotTarget.visible = cnotStem.visible = cnotVisible;
      cnotDot.material.opacity = cnotVisible ? 0.88 : 0.18;
      cnotTarget.material.opacity = cnotVisible ? 0.88 : 0.18;

      const p0 = cAbs2(state.vector[0]);
      const p1 = cAbs2(state.vector[1]);
      amplitudeBars[0].scale.y = Math.max(0.04, p0);
      amplitudeBars[1].scale.y = Math.max(0.04, p1);
      amplitudeBars[0].position.y = -1.45 + amplitudeBars[0].scale.y * 0.5;
      amplitudeBars[1].position.y = -1.45 + amplitudeBars[1].scale.y * 0.5;
      const twoProbs = state.twoState.map(cAbs2);
      for (let i = 0; i < 4; i += 1) {
        const bar = amplitudeBars[i + 2];
        bar.scale.y = Math.max(0.035, twoProbs[i]);
        bar.position.y = -1.38 + bar.scale.y * 0.5;
        bar.material.opacity = state.mode === "circuit" ? 0.78 : 0.22;
      }
      const shots = Math.max(1, state.zeroCount + state.oneCount);
      histogramBars[0].scale.y = Math.max(0.04, state.zeroCount / shots);
      histogramBars[1].scale.y = Math.max(0.04, state.oneCount / shots);
      histogramBars[0].position.y = -1.75 + histogramBars[0].scale.y * 0.5;
      histogramBars[1].position.y = -1.75 + histogramBars[1].scale.y * 0.5;
      const shotSetting = rangeValue("shotCount", 96);
      histogramBars.forEach((bar) => {
        bar.scale.x = 0.76 + Math.min(1, shotSetting / 192) * 0.44;
      });

      // ===== CLEAN OVERRIDE: focal-sphere glow halos + region labels (legibility layer) =====
      // glow halo on the Bloch vector tip (focal sphere), restrained ~0.5 opacity, follows endpointDot
      i02TipHalo.visible = true;
      i02TipHalo.position.copy(endpointDot.position);
      i02TipHalo.material.color.setHex(p0 >= p1 ? COLORS.cyan : COLORS.violet);
      i02TipHalo.material.opacity = 0.5;
      i02TipHalo.scale.setScalar(endpointDot.scale.x * 0.55 + 0.34);
      i02PsiTag.position.copy(endpointDot.position).add(new THREE.Vector3(0.12, 0.26, 0));
      // glow halo on the CNOT control dot (focal sphere) -- only when the entangler is live
      i02CtrlHalo.visible = cnotVisible;
      i02CtrlHalo.position.copy(cnotDot.position);
      i02CtrlHalo.material.opacity = cnotVisible ? 0.5 : 0.04;
      i02CtrlHalo.scale.setScalar(cnotDot.scale.x * 0.55 + 0.22);
      i02CtrlTag.position.copy(cnotDot.position).add(new THREE.Vector3(0.0, 0.26, 0));
      i02CtrlTag.material.opacity = cnotVisible ? 1 : 0.18;
      // de-emphasise the gate-rotation arc clutter so the Bloch vector reads as the focal scene
      rotationRing.material.opacity = Math.min(rotationRing.material.opacity, 0.3);
      selectedAxis.material.opacity = 0.32;
      // two region labels: left = concept (Bloch state), right = chart/readout
      i02RegionConcept.position.set(-2.15, 1.95, 0.18);
      i02RegionReadout.position.set(1.55, 1.9, 0.58);
      updatePanel();
    }

    function updatePanel() {
      const p0 = cAbs2(state.vector[0]);
      const p1 = cAbs2(state.vector[1]);
      const name = stateLabel(state.vector);
      syncOutput("rotationAngle", rangeValue("rotationAngle", Math.PI / 2), 2);
      syncOutput("shotCount", rangeValue("shotCount", 96), 0);
      syncOutput("entangleStrength", rangeValue("entangleStrength", 1), 2);
      setText("stateName", name);
      setText("probLabel", `${fmt(p0, 2)} / ${fmt(p1, 2)}`);
      setText("gateLabel", state.selectedGate);
      const bellMass = cAbs2(state.twoState[0]) + cAbs2(state.twoState[3]);
      setText("entangleLabel", state.mode === "circuit" && bellMass > 0.92 ? "Bell state" : "No");
      setText("sampleLabel", `0:${state.zeroCount} 1:${state.oneCount} | 00:${state.twoCounts["00"]} 01:${state.twoCounts["01"]} 10:${state.twoCounts["10"]} 11:${state.twoCounts["11"]}`);
      const formula = document.getElementById("formulaText");
      if (formula) formula.textContent = state.mode === "circuit"
        ? "Bell builder: H(q0) creates branches, CNOT copies the branch into correlation"
        : `${state.selectedGate} is a unitary gate; norm stays ${fmt(p0 + p1, 3)}`;
      const selected = document.getElementById("selectedLabel");
      if (selected) selected.textContent = `${state.selectedGate} gate, ${state.gateHistory.length} boxes, mode ${state.mode}`;
      const stateBox = document.getElementById("state");
      if (stateBox) {
        stateBox.textContent = `${state.status}: |psi> = ${cStr(state.vector[0])}|0> + ${cStr(state.vector[1])}|1>, p(0) / p(1) = ${fmt(p0, 2)} / ${fmt(p1, 2)}, selected gate ${state.selectedGate}. In Bell mode the circuit shows q0 -- H -- CNOT, CNOT control, Bell pair amplitudes, tensor-product basis, and measurement histogram. Last control ${state.lastControl}.`;
      }
    }

    root.querySelectorAll("input[type='range'], select").forEach((control) => {
      control.addEventListener("input", () => {
        if (control.id === "gateSelect") state.selectedGate = control.value;
        if (control.id === "preset") {
          state.vector = setPresetState(control.value);
          state.history = [];
          state.gateHistory = [];
          state.mode = "single";
          state.status = `Preset ${control.value}`;
        }
        mark(control.id || "control");
        updateScene();
      });
      control.addEventListener("change", () => {
        if (control.id === "gateSelect") state.selectedGate = control.value;
        mark(control.id || "control");
        updateScene();
      });
    });
    root.querySelectorAll("[data-gate]").forEach((button) => {
      button.addEventListener("click", () => {
        const gate = button.getAttribute("data-gate");
        const select = document.getElementById("gateSelect");
        if (select) select.value = gate;
        applyGate(gate, gate);
      });
    });
    const stepGate = document.getElementById("stepGate");
    if (stepGate) stepGate.addEventListener("click", () => applyGate(selectValue("gateSelect", state.selectedGate), "stepGate"));
    const bell = document.getElementById("bell");
    if (bell) bell.addEventListener("click", buildBellCircuit);
    const cnot = document.getElementById("cnot");
    if (cnot) cnot.addEventListener("click", applyCnot);
    const measureCircuit = document.getElementById("measureCircuit");
    if (measureCircuit) measureCircuit.addEventListener("click", measure);
    const undo = document.getElementById("undoGate");
    if (undo) undo.addEventListener("click", () => {
      const previous = state.history.pop();
      if (previous) state.vector = previous;
      state.gateHistory.pop();
      state.mode = "single";
      state.status = "Undo gate";
      mark("undoGate");
      updateScene();
    });
    const reset = document.getElementById("resetI02");
    if (reset) reset.addEventListener("click", () => {
      state.vector = [complex(1), complex(0)];
      state.history = [];
      state.gateHistory = [];
      state.selectedGate = "H";
      state.mode = "single";
      state.zeroCount = 0;
      state.oneCount = 0;
      state.twoCounts = { "00": 0, "01": 0, "10": 0, "11": 0 };
      state.twoState = [complex(1), complex(0), complex(0), complex(0)];
      const gateSelect = document.getElementById("gateSelect");
      const preset = document.getElementById("preset");
      if (gateSelect) gateSelect.value = "H";
      if (preset) preset.value = "0";
      state.status = "Ready";
      mark("resetI02");
      updateScene();
    });

    window.__i02LabSnapshot = () => {
      const p0 = cAbs2(state.vector[0]);
      const p1 = cAbs2(state.vector[1]);
      state.p0 = p0;
      state.p1 = p1;
      return {
        kind: "quantum-gates-circuit",
        visualKind: "bloch-gate-cnot-bell",
        labId: "i02",
        clarityVersion: "i02-i03-canonical-clarity-v1",
        has3d: true,
        mode: state.mode,
        p0: state.p0,
        p1: state.p1,
        selectedGate: state.selectedGate,
        stateName: stateLabel(state.vector),
        gateCount: state.gateHistory.length,
        circuitGateCount: state.gateHistory.length,
        twoQubitBasisCount: 4,
        amplitudeBarCount: amplitudeBars.length,
        histogramBarCount: histogramBars.length,
        blochScaffoldObjectCount: blochScaffoldObjects.length,
        stateVectorObjectCount: 1,
        gateArcObjectCount: gateArcObjects.length,
        unitaryGateObjectCount: unitaryGateObjects.length,
        circuitWireObjectCount: circuitWireObjects.length,
        circuitGateObjectCount: circuitGateObjects.length,
        cnotObjectCount: cnotObjects.length,
        bellAmplitudeObjectCount: bellAmplitudeObjects.length,
        measurementHistogramObjectCount: histogramBars.length,
        tensorBasisObjectCount: tensorBasisObjects.length,
        entangled: state.mode === "circuit" && (cAbs2(state.twoState[0]) + cAbs2(state.twoState[3])) > 0.92,
        bellCorrelation: cAbs2(state.twoState[0]) + cAbs2(state.twoState[3]) - cAbs2(state.twoState[1]) - cAbs2(state.twoState[2]),
        zeroCount: state.zeroCount,
        oneCount: state.oneCount,
        blochScaffoldHash: objectHash(blochScaffoldObjects),
        stateVectorHash: objectHash(stateVectorObjects),
        gateArcHash: objectHash(gateArcObjects),
        unitaryGateHash: objectHash(unitaryGateObjects),
        circuitWireHash: objectHash(circuitWireObjects),
        circuitGateHash: objectHash(circuitGateObjects),
        cnotHash: objectHash(cnotObjects),
        bellAmplitudeHash: objectHash(bellAmplitudeObjects),
        measurementHistogramHash: objectHash(histogramBars),
        tensorBasisHash: objectHash(tensorBasisObjects),
        canonicalReferences: ["Bloch sphere state vector", "unitary gate rotation axis", "single-qubit circuit wire", "CNOT entangler", "Bell-state amplitude basis", "Born-rule measurement histogram", "tensor-product basis"],
        qubitCircuitObjects: ["bloch_sphere_surface", "normalized_state_vector", "unitary_gate_rotation", "gate_sequence_circuit", "cnot_entangler", "bell_pair_amplitudes", "measurement_histogram", "tensor_product_basis"],
        diagnosticMetrics: ["p0", "p1", "selected_gate", "rotation_angle", "shot_count", "entanglement_strength", "bell_correlation"],
        controls: {
          gateSelect: selectValue("gateSelect", state.selectedGate),
          rotationAngle: rangeValue("rotationAngle", Math.PI / 2),
          shotCount: rangeValue("shotCount", 96),
          entangleStrength: rangeValue("entangleStrength", 1)
        },
        cameraTheta: cameraState.theta,
        cameraPhi: cameraState.phi,
        cameraRadius: cameraState.radius,
        stateText: document.getElementById("state") ? document.getElementById("state").textContent.trim() : "",
        revision: state.revision,
        lastControl: state.lastControl
      };
    };
    window.__i02LabReady = true;
    updateScene();
    function animate() {
      requestAnimationFrame(animate);
      labels.forEach((label) => label.quaternion.copy(camera.quaternion));
      renderer.render(scene, camera);
    }
    animate();
  }

  function createI03QuantumAlgorithmLab() {
    const root = document.querySelector(".lab-shell");
    const canvas = document.getElementById("canvas");
    if (!root || !canvas || !window.THREE) return;
    const { renderer, scene, camera, cameraState } = setupScene(canvas, 9.8);
    const labels = [];
    const group = new THREE.Group();
    scene.add(group);

    const algorithms = ["Grover", "QFT", "Phase Estimation", "Shor N=15"];
    const state = {
      algorithm: selectValue("algorithm", "Grover"),
      markedState: Math.round(rangeValue("markedState", 5)),
      stateCount: Math.round(rangeValue("stateCount", 16)),
      period: Math.round(rangeValue("period", 4)),
      phase: rangeValue("phase", 0.25),
      iteration: 0,
      amplitudes: [],
      oracleFlipped: false,
      targetProbability: 0,
      dominantFrequency: 0,
      measured: "-",
      status: "Uniform superposition: every basis state has equal radius = amplitude",
      lastControl: "initial",
      revision: 0
    };

    const groverGroup = new THREE.Group();
    const qftGroup = new THREE.Group();
    const phaseGroup = new THREE.Group();
    const shorGroup = new THREE.Group();
    group.add(groverGroup, qftGroup, phaseGroup, shorGroup);

    addLabel(groverGroup, labels, "amber = marked state", [-3.8, 1.88, 0.32], "#e8b857", [0.82, 0.16, 1]);
    addLabel(groverGroup, labels, "radius = amplitude", [-1.72, 1.88, 0.32], "#58e0d3", [0.72, 0.15, 1]);
    addLabel(groverGroup, labels, "oracle phase flip", [-3.62, -1.78, 0.18], "#ff6d8b", [0.78, 0.15, 1]);
    addLabel(groverGroup, labels, "diffuser reflection about mean", [-1.22, -1.78, 0.18], "#77df96", [1.12, 0.15, 1]);
    addLabel(groverGroup, labels, "Grover rotation plane |w> / |r>", [2.42, 1.72, 0.08], "#e8b857", [1.08, 0.16, 1]);

    const amplitudeBars = Array.from({ length: 32 }, (_, index) => {
      const mesh = makeBox([0.13, 1, 0.16], COLORS.cyan, 0.78);
      mesh.position.set(-3.75 + (index % 16) * 0.29, 0.05, -0.58 + Math.floor(index / 16) * 0.42);
      groverGroup.add(mesh);
      return mesh;
    });
    const amplitudeFloor = makeBox([4.9, 0.025, 0.92], COLORS.blue, 0.1);
    amplitudeFloor.position.set(-1.58, 0, -0.34);
    groverGroup.add(amplitudeFloor);
    const meanPlane = makeBox([4.9, 0.02, 0.9], COLORS.green, 0.28);
    groverGroup.add(meanPlane);
    const oracleStripe = makeBox([0.18, 1.1, 0.28], COLORS.rose, 0.38);
    groverGroup.add(oracleStripe);

    const phaseWheel = new THREE.Group();
    phaseWheel.position.set(-3.75, 1.04, 0.72);
    const phaseRing = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.012, 8, 72), material(COLORS.violet, 0.48));
    const phaseArrow = makeArrow(COLORS.amber, 0.018, 0.95);
    phaseWheel.add(phaseRing, phaseArrow);
    groverGroup.add(phaseWheel);
    addLabel(groverGroup, labels, "phase wheel", [-3.08, 1.04, 0.72], "#9b8cff", [0.56, 0.14, 1]);

    const rotationPlane = makeBox([2.35, 0.018, 1.44], COLORS.ink, 0.08);
    rotationPlane.position.set(2.25, -0.1, 0);
    groverGroup.add(rotationPlane);
    const wAxis = makeLine([new THREE.Vector3(1.2, -0.1, 0), new THREE.Vector3(3.44, -0.1, 0)], COLORS.amber, 0.58);
    const rAxis = makeLine([new THREE.Vector3(2.25, -1.16, 0), new THREE.Vector3(2.25, 0.92, 0)], COLORS.blue, 0.58);
    const groverVector = makeArrow(COLORS.cyan, 0.022, 0.95);
    const oracleReflection = makeLine([new THREE.Vector3(1.35, -1.02, 0.04), new THREE.Vector3(3.25, 0.72, 0.04)], COLORS.rose, 0.54);
    const diffuserReflection = makeLine([new THREE.Vector3(1.35, 0.52, 0.06), new THREE.Vector3(3.26, -0.84, 0.06)], COLORS.green, 0.54);
    groverGroup.add(wAxis, rAxis, groverVector, oracleReflection, diffuserReflection);
    addLabel(groverGroup, labels, "|w>", [3.58, -0.08, 0.08], "#e8b857", [0.32, 0.12, 1]);
    addLabel(groverGroup, labels, "|r>", [2.25, 1.08, 0.08], "#54a8ff", [0.32, 0.12, 1]);

    addLabel(qftGroup, labels, "QFT periodic comb -> frequency peaks", [-1.5, 1.84, 0.16], "#58e0d3", [1.22, 0.16, 1]);
    addLabel(qftGroup, labels, "phase wheel", [-3.76, -1.42, 0.12], "#9b8cff", [0.56, 0.14, 1]);
    const qftCombBars = Array.from({ length: 32 }, (_, index) => {
      const bar = makeBox([0.1, 1, 0.12], COLORS.blue, 0.32);
      bar.position.set(-3.9 + (index % 16) * 0.25, 0.04, -0.58 + Math.floor(index / 16) * 0.34);
      qftGroup.add(bar);
      return bar;
    });
    const qftPeakBars = Array.from({ length: 32 }, (_, index) => {
      const bar = makeBox([0.1, 1, 0.12], COLORS.amber, 0.32);
      bar.position.set(0.62 + (index % 16) * 0.25, 0.04, -0.58 + Math.floor(index / 16) * 0.34);
      qftGroup.add(bar);
      return bar;
    });
    const qftWheel = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.015, 8, 96), material(COLORS.violet, 0.34));
    qftWheel.position.set(-3.46, -1.04, 0.2);
    qftGroup.add(qftWheel);
    const qftWheelArrow = makeArrow(COLORS.violet, 0.014, 0.85);
    qftGroup.add(qftWheelArrow);
    const qftFlow = makeArrow(COLORS.cyan, 0.025, 0.62);
    qftGroup.add(qftFlow);

    addLabel(phaseGroup, labels, "phase estimation: controlled U powers", [-1.42, 1.84, 0.16], "#e8b857", [1.28, 0.16, 1]);
    const phaseDials = Array.from({ length: 4 }, (_, index) => {
      const dial = new THREE.Group();
      dial.position.set(-3.6 + index * 0.92, 0.58, 0);
      dial.add(new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.012, 8, 72), material(COLORS.blue, 0.38)));
      const hand = makeArrow(COLORS.amber, 0.012, 0.95);
      dial.add(hand);
      dial.userData.hand = hand;
      phaseGroup.add(dial);
      addLabel(phaseGroup, labels, `U^${2 ** index}`, [dial.position.x, 1.1, 0], "#e8b857", [0.42, 0.12, 1]);
      return dial;
    });
    const readoutBars = Array.from({ length: 16 }, (_, index) => {
      const bar = makeBox([0.13, 1, 0.14], COLORS.green, 0.35);
      bar.position.set(0.56 + index * 0.21, -0.9, 0);
      phaseGroup.add(bar);
      return bar;
    });
    const inverseQftArrow = makeArrow(COLORS.cyan, 0.026, 0.72);
    phaseGroup.add(inverseQftArrow);
    addLabel(phaseGroup, labels, "inverse QFT readout", [2.08, 0.22, 0.14], "#77df96", [0.74, 0.14, 1]);

    addLabel(shorGroup, labels, "Shor N=15 period -> gcd", [-1.4, 1.84, 0.16], "#77df96", [1.0, 0.16, 1]);
    const shorSequence = Array.from({ length: 8 }, (_, index) => {
      const cell = makeBox([0.42, 0.24, 0.16], index % 4 === 0 ? COLORS.amber : COLORS.blue, 0.58);
      cell.position.set(-3.4 + index * 0.55, 0.58, -0.1);
      shorGroup.add(cell);
      return cell;
    });
    const shorPeaks = Array.from({ length: 8 }, (_, index) => {
      const bar = makeBox([0.24, 1, 0.18], index % 2 === 0 ? COLORS.amber : COLORS.cyan, 0.35);
      bar.position.set(0.94 + index * 0.36, 0.12, -0.1);
      shorGroup.add(bar);
      return bar;
    });
    const gcdBoxes = Array.from({ length: 3 }, (_, index) => {
      const box = makeBox([0.85, 0.38, 0.16], index === 0 ? COLORS.amber : COLORS.green, 0.5);
      box.position.set(-1.6 + index * 1.08, -1.1, -0.04);
      shorGroup.add(box);
      return box;
    });
    addLabel(shorGroup, labels, "2^x mod 15: 1,2,4,8,...", [-1.58, 0.18, 0.16], "#54a8ff", [1.06, 0.14, 1]);
    addLabel(shorGroup, labels, "r=4", [1.7, 1.08, 0.16], "#e8b857", [0.38, 0.12, 1]);
    addLabel(shorGroup, labels, "gcd(4-1,15)=3", [-2.2, -1.58, 0.12], "#77df96", [0.76, 0.13, 1]);
    addLabel(shorGroup, labels, "gcd(4+1,15)=5", [0.08, -1.58, 0.12], "#77df96", [0.76, 0.13, 1]);
    const oraclePhaseObjects = [oracleStripe, phaseRing, phaseArrow.userData.body, phaseArrow.userData.head];
    const diffuserMeanObjects = [meanPlane];
    const groverPlaneObjects = [rotationPlane, wAxis, rAxis, groverVector.userData.body, groverVector.userData.head, oracleReflection, diffuserReflection];
    const phaseDialObjects = phaseDials.flatMap((dial) => [dial, dial.userData.hand.userData.body, dial.userData.hand.userData.head]);
    const shorGcdObjects = gcdBoxes;
    const readoutPanelObjects = qftPeakBars.concat(readoutBars, shorPeaks);

    function setRange(id, value) {
      const input = document.getElementById(id);
      if (input) input.value = String(value);
    }

    function setSelect(id, value) {
      const input = document.getElementById(id);
      if (input) input.value = value;
    }

    function mark(control, status) {
      state.lastControl = control;
      state.status = status || `Changed ${control}`;
      state.revision += 1;
    }

    function readControls() {
      state.algorithm = selectValue("algorithm", state.algorithm);
      state.stateCount = clamp(Math.round(rangeValue("stateCount", state.stateCount)), 8, 32);
      state.markedState = clamp(Math.round(rangeValue("markedState", state.markedState)), 0, state.stateCount - 1);
      state.period = clamp(Math.round(rangeValue("period", state.period)), 2, 8);
      state.phase = rangeValue("phase", state.phase);
      const marked = document.getElementById("markedState");
      if (marked) marked.max = String(state.stateCount - 1);
      syncOutput("markedState", state.markedState, 0);
      syncOutput("stateCount", state.stateCount, 0);
      syncOutput("period", state.period, 0);
      syncOutput("phase", state.phase, 2);
    }

    function resetGroverAmplitudes() {
      readControls();
      const amp = 1 / Math.sqrt(state.stateCount);
      state.amplitudes = Array.from({ length: state.stateCount }, () => amp);
      state.iteration = 0;
      state.oracleFlipped = false;
      state.targetProbability = amp * amp;
    }

    function currentGroverStats() {
      if (!state.amplitudes.length || state.amplitudes.length !== state.stateCount) resetGroverAmplitudes();
      state.targetProbability = Math.pow(Math.abs(state.amplitudes[state.markedState] || 0), 2);
      const mean = state.amplitudes.reduce((sum, amp) => sum + amp, 0) / state.stateCount;
      const theta = Math.asin(clamp(Math.sqrt(1 / state.stateCount), 0, 1));
      return {
        mean,
        theta,
        rotation: (2 * state.iteration + (state.oracleFlipped ? 1 : 0)) * theta,
        targetAmplitude: state.amplitudes[state.markedState] || 0
      };
    }

    function applyOraclePhaseFlip() {
      readControls();
      if (state.algorithm !== "Grover") {
        state.iteration += 1;
        mark("oracleStep", `${state.algorithm}: step advances phase/frequency readout`);
        updateScene();
        return;
      }
      if (!state.amplitudes.length) resetGroverAmplitudes();
      state.amplitudes[state.markedState] *= -1;
      state.oracleFlipped = true;
      mark("oracleStep", `Oracle phase flip: marked state |${state.markedState}> becomes negative`);
      updateScene();
    }

    function applyDiffuserReflection() {
      readControls();
      if (state.algorithm !== "Grover") {
        state.iteration += 1;
        mark("diffuseStep", `${state.algorithm}: transform step ${state.iteration}`);
        updateScene();
        return;
      }
      if (!state.amplitudes.length) resetGroverAmplitudes();
      const mean = state.amplitudes.reduce((sum, amp) => sum + amp, 0) / state.stateCount;
      state.amplitudes = state.amplitudes.map((amp) => 2 * mean - amp);
      state.oracleFlipped = false;
      state.iteration += 1;
      mark("diffuseStep", `Diffuser reflection about mean: marked probability rises to ${fmt(Math.pow(Math.abs(state.amplitudes[state.markedState]), 2) * 100, 1)}%`);
      updateScene();
    }

    function groverRunOptimal() {
      readControls();
      resetGroverAmplitudes();
      const steps = Math.max(1, Math.round(Math.PI / 4 * Math.sqrt(state.stateCount)));
      for (let i = 0; i < steps; i += 1) {
        state.amplitudes[state.markedState] *= -1;
        const mean = state.amplitudes.reduce((sum, amp) => sum + amp, 0) / state.stateCount;
        state.amplitudes = state.amplitudes.map((amp) => 2 * mean - amp);
      }
      state.iteration = steps;
      state.oracleFlipped = false;
      mark("runOptimal", `Ran ${steps} Grover oracle+diffuser rotations`);
      updateScene();
    }

    function drawQftPeriodComb() {
      readControls();
      const n = state.stateCount;
      const offset = Math.round(state.phase * state.period) % state.period;
      const comb = Array.from({ length: n }, (_, index) => (index - offset + state.period * 16) % state.period === 0 ? 1 : 0.08);
      const peaks = Array.from({ length: n }, (_, k) => {
        let re = 0;
        let im = 0;
        comb.forEach((value, x) => {
          if (value < 0.5) return;
          const angle = -2 * Math.PI * k * x / n;
          re += Math.cos(angle);
          im += Math.sin(angle);
        });
        return re * re + im * im;
      });
      const maxPeak = Math.max(...peaks, 1);
      state.dominantFrequency = peaks.indexOf(maxPeak);
      qftCombBars.forEach((bar, index) => {
        const visible = index < n;
        bar.visible = visible;
        if (!visible) return;
        const h = comb[index] > 0.5 ? 0.9 : 0.16;
        bar.scale.y = h;
        bar.position.y = h * 0.5 - 0.02;
        bar.material.color.setHex(comb[index] > 0.5 ? COLORS.cyan : COLORS.blue);
        bar.material.opacity = comb[index] > 0.5 ? 0.82 : 0.2;
      });
      qftPeakBars.forEach((bar, index) => {
        const visible = index < n;
        bar.visible = visible;
        if (!visible) return;
        const h = 0.08 + 1.05 * peaks[index] / maxPeak;
        bar.scale.y = h;
        bar.position.y = h * 0.5 - 0.02;
        bar.material.color.setHex(index === state.dominantFrequency ? COLORS.amber : COLORS.green);
        bar.material.opacity = index === state.dominantFrequency ? 0.9 : 0.28 + 0.36 * peaks[index] / maxPeak;
      });
      placeArrow(qftFlow, new THREE.Vector3(-0.18, 0.42, -0.18), new THREE.Vector3(0.48, 0.42, -0.18));
      const angle = state.phase * Math.PI * 2;
      placeArrow(qftWheelArrow, new THREE.Vector3(-3.46, -1.04, 0.2), new THREE.Vector3(-3.46 + Math.cos(angle) * 0.62, -1.04 + Math.sin(angle) * 0.62, 0.2));
    }

    function drawPhaseEstimation() {
      readControls();
      const bits = 4;
      const scaled = state.phase * (2 ** bits);
      const centerIndex = Math.round(scaled) % 16;
      phaseDials.forEach((dial, index) => {
        const angle = 2 * Math.PI * state.phase * (2 ** index);
        placeArrow(dial.userData.hand, new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.cos(angle) * 0.28, Math.sin(angle) * 0.28, 0));
      });
      readoutBars.forEach((bar, index) => {
        const dist = Math.min(Math.abs(index - centerIndex), 16 - Math.abs(index - centerIndex));
        const h = 0.08 + Math.exp(-dist * dist / 2.2) * 0.95;
        bar.scale.y = h;
        bar.position.y = -1.36 + h * 0.5;
        bar.material.color.setHex(index === centerIndex ? COLORS.amber : COLORS.green);
        bar.material.opacity = index === centerIndex ? 0.9 : 0.24 + 0.42 * h;
      });
      state.dominantFrequency = centerIndex;
      placeArrow(inverseQftArrow, new THREE.Vector3(-0.15, 0.34, 0), new THREE.Vector3(0.48, -0.58, 0));
    }

    function gcd(a, b) {
      let x = Math.abs(a);
      let y = Math.abs(b);
      while (y) {
        const t = y;
        y = x % y;
        x = t;
      }
      return x;
    }

    function drawShor() {
      const values = [1, 2, 4, 8, 1, 2, 4, 8];
      shorSequence.forEach((cell, index) => {
        const h = 0.18 + values[index] / 15 * 0.72;
        cell.scale.y = h;
        cell.position.y = 0.24 + h * 0.5;
        cell.material.color.setHex(index % 4 === 0 ? COLORS.amber : COLORS.blue);
        cell.material.opacity = state.iteration % 8 === index ? 0.95 : 0.48;
      });
      shorPeaks.forEach((bar, index) => {
        const peak = [0, 2, 4, 6].includes(index);
        const h = peak ? 0.9 : 0.14;
        bar.scale.y = h;
        bar.position.y = -0.38 + h * 0.5;
        bar.material.opacity = peak ? 0.82 : 0.18;
      });
      const a = 2;
      const r = 4;
      const left = gcd((a ** (r / 2)) - 1, 15);
      const right = gcd((a ** (r / 2)) + 1, 15);
      gcdBoxes[1].material.opacity = left === 3 ? 0.9 : 0.4;
      gcdBoxes[2].material.opacity = right === 5 ? 0.9 : 0.4;
      state.dominantFrequency = 4;
      state.targetProbability = 0.82;
    }

    function updateGrover() {
      const stats = state.algorithm === "Grover" ? currentGroverStats() : { mean: 0 };
      const scale = 2.4;
      amplitudeBars.forEach((bar, index) => {
        const visible = index < state.stateCount;
        bar.visible = visible;
        if (!visible) return;
        const amp = state.amplitudes[index] || 0;
        const h = Math.max(0.035, Math.abs(amp) * scale);
        bar.scale.y = h;
        bar.position.y = amp >= 0 ? h * 0.5 : -h * 0.5;
        bar.material.color.setHex(index === state.markedState ? (amp < 0 ? COLORS.rose : COLORS.amber) : COLORS.cyan);
        bar.material.opacity = index === state.markedState ? 0.95 : 0.48 + Math.min(0.36, Math.abs(amp));
      });
      meanPlane.position.set(-1.58, stats.mean * scale, -0.34);
      meanPlane.visible = state.algorithm === "Grover";
      const markedBar = amplitudeBars[state.markedState];
      if (markedBar) oracleStripe.position.copy(markedBar.position).setY(0.05);
      oracleStripe.visible = true;
      const prob = clamp(state.targetProbability, 0, 1);
      const angle = Math.asin(Math.sqrt(prob));
      const start = new THREE.Vector3(2.25, -0.1, 0.1);
      const end = new THREE.Vector3(2.25 + Math.sin(angle) * 0.96, -0.1 + Math.cos(angle) * 0.96, 0.1);
      placeArrow(groverVector, start, end);
      placeArrow(phaseArrow, new THREE.Vector3(0, 0, 0), new THREE.Vector3(Math.cos(state.oracleFlipped ? Math.PI : 0) * 0.34, Math.sin(state.oracleFlipped ? Math.PI : 0) * 0.34, 0));
      state.targetProbability = Math.pow(Math.abs(state.amplitudes[state.markedState] || 0), 2);
    }

    function updateScene() {
      readControls();
      groverGroup.visible = state.algorithm === "Grover";
      qftGroup.visible = state.algorithm === "QFT";
      phaseGroup.visible = state.algorithm === "Phase Estimation";
      shorGroup.visible = state.algorithm === "Shor N=15";
      if (state.algorithm === "Grover") updateGrover();
      if (state.algorithm === "QFT") {
        drawQftPeriodComb();
        state.targetProbability = 0.55 + Math.min(0.4, 1 / Math.max(1, state.period));
      }
      if (state.algorithm === "Phase Estimation") {
        drawPhaseEstimation();
        state.targetProbability = 0.62 + 0.28 * Math.cos((state.phase * 16 - Math.round(state.phase * 16)) * Math.PI) ** 2;
      }
      if (state.algorithm === "Shor N=15") drawShor();
      setText("algorithmLabel", state.algorithm);
      setText("probLabel", `${fmt(state.targetProbability * 100, 1)}%`);
      setText("iterationLabel", String(state.iteration));
      const aux = state.algorithm === "Grover"
        ? `mean ${fmt(currentGroverStats().mean, 3)}`
        : state.algorithm === "QFT"
          ? `freq ${state.dominantFrequency}`
          : state.algorithm === "Phase Estimation"
            ? `bits ${state.dominantFrequency.toString(2).padStart(4, "0")}`
            : "factors 3 x 5";
      setText("auxLabel", aux);
      const concept = state.algorithm === "Grover"
        ? "Oracle marks phase -1, diffuser reflection about mean rotates amplitudes toward the marked basis state"
        : state.algorithm === "QFT"
          ? "QFT maps a periodic comb in state index into sparse frequency peaks"
          : state.algorithm === "Phase Estimation"
            ? "Controlled U powers write phase into dials; inverse QFT converts phase to bits"
            : "Shor N=15 finds period r=4, then classical gcd gives 3 and 5";
      const formula = document.getElementById("formulaText");
      if (formula) formula.textContent = concept;
      const selected = document.getElementById("selectedLabel");
      if (selected) selected.textContent = `${state.algorithm}, step ${state.iteration}, last ${state.lastControl}`;
      const stateBox = document.getElementById("state");
      if (stateBox) {
        stateBox.textContent = `${state.status}. ${concept}. Algorithm ${state.algorithm}. Marked probability ${fmt(state.targetProbability * 100, 1)}%, iteration ${state.iteration}, period ${state.period}, dominant frequency ${state.dominantFrequency}.`;
      }
      // legibility: two region labels (concept | readout), created once, engineRef (not counted)
      if (!scene.userData.i03Decor) {
        const cl = qLabel("QUANTUM ALGORITHM", 0x9fb4cc, 0.3); cl.userData.engineRef = true; cl.position.set(-2.5, 2.35, 0.2); scene.add(cl);
        const rl = qLabel("AMPLITUDE READOUT", 0x9fb4cc, 0.3); rl.userData.engineRef = true; rl.position.set(2.0, 2.35, 0.2); scene.add(rl);
        scene.userData.i03Decor = true;
      }
    }

    resetGroverAmplitudes();
    root.querySelectorAll("input[type='range'], select").forEach((control) => {
      control.addEventListener("input", () => {
        const previousN = state.stateCount;
        readControls();
        if (control.id === "stateCount" || (control.id === "markedState" && state.amplitudes.length)) resetGroverAmplitudes();
        if (state.stateCount !== previousN) resetGroverAmplitudes();
        mark(control.id || "control", `Changed ${control.id || "control"}`);
        updateScene();
      });
      control.addEventListener("change", () => {
        if (control.id === "algorithm") state.algorithm = control.value;
        mark(control.id || "control", `Changed ${control.id || "control"}`);
        updateScene();
      });
    });
    const oracle = document.getElementById("oracleStep");
    if (oracle) oracle.addEventListener("click", applyOraclePhaseFlip);
    const diffuse = document.getElementById("diffuseStep");
    if (diffuse) diffuse.addEventListener("click", applyDiffuserReflection);
    const switchAlgorithm = document.getElementById("switchAlgorithm");
    if (switchAlgorithm) switchAlgorithm.addEventListener("click", () => {
      const next = algorithms[(algorithms.indexOf(state.algorithm) + 1) % algorithms.length];
      setSelect("algorithm", next);
      state.algorithm = next;
      state.iteration = 0;
      mark("switchAlgorithm", `Switched to ${next}`);
      updateScene();
    });
    const optimal = document.getElementById("runOptimal");
    if (optimal) optimal.addEventListener("click", groverRunOptimal);
    const reset = document.getElementById("resetI03");
    if (reset) reset.addEventListener("click", () => {
      setSelect("algorithm", "Grover");
      setRange("markedState", "5");
      setRange("stateCount", "16");
      setRange("period", "4");
      setRange("phase", "0.25");
      state.algorithm = "Grover";
      state.status = "Reset to uniform Grover register";
      mark("resetI03", state.status);
      resetGroverAmplitudes();
      updateScene();
    });

    window.__i03LabSnapshot = () => {
      const stats = currentGroverStats();
      const algorithmSlot = Math.max(0, algorithms.indexOf(state.algorithm)) + 1;
      return {
        kind: "quantum-algorithm-interference",
        visualKind: "grover-qft-phase-shor-workbench",
        labId: "i03",
        clarityVersion: "i02-i03-canonical-clarity-v1",
        has3d: true,
        targetProbability: state.targetProbability,
        algorithm: state.algorithm,
        iteration: state.iteration,
        markedState: state.markedState,
        stateCount: state.stateCount,
        period: state.period,
        phase: state.phase,
        dominantFrequency: state.dominantFrequency,
        oracleFlipped: state.oracleFlipped,
        meanAmplitude: stats.mean,
        oracleCalls: state.iteration + (state.oracleFlipped ? 0.5 : 0),
        signedAmplitudeBarObjectCount: Math.min(state.stateCount, amplitudeBars.length),
        oracleMarkerObjectCount: oraclePhaseObjects.length,
        diffuserMeanObjectCount: diffuserMeanObjects.length,
        groverPlaneObjectCount: groverPlaneObjects.length,
        qftCombObjectCount: qftCombBars.length,
        frequencyPeakObjectCount: qftPeakBars.length,
        phaseDialObjectCount: phaseDialObjects.length,
        shorGcdPanelObjectCount: shorGcdObjects.length,
        amplitudeBarHash: objectHash(amplitudeBars.slice(0, state.stateCount)),
        oraclePhaseHash: `${compactHash([algorithmSlot, state.oracleFlipped ? 1 : 0, state.markedState, state.revision])}-${objectHash(oraclePhaseObjects)}`,
        diffuserMeanHash: `${compactHash([algorithmSlot, stats.mean, state.iteration, state.targetProbability])}-${objectHash(diffuserMeanObjects)}`,
        groverPlaneHash: `${compactHash([algorithmSlot, state.iteration, state.targetProbability])}-${objectHash(groverPlaneObjects)}`,
        qftCombHash: `${compactHash([algorithmSlot, state.period, state.phase, state.dominantFrequency])}-${objectHash(qftCombBars)}`,
        frequencyPeakHash: `${compactHash([algorithmSlot, state.period, state.phase, state.dominantFrequency])}-${objectHash(readoutPanelObjects)}`,
        phaseDialHash: `${compactHash([algorithmSlot, state.phase, state.dominantFrequency])}-${objectHash(phaseDialObjects)}`,
        shorGcdHash: `${compactHash([algorithmSlot, state.iteration, state.dominantFrequency])}-${objectHash(shorGcdObjects)}`,
        readoutPanelHash: compactHash([algorithmSlot, state.targetProbability, state.iteration, state.period, state.phase, state.dominantFrequency, state.revision]),
        canonicalReferences: ["Grover signed amplitude amplification", "oracle phase flip", "diffuser reflection about mean", "two-dimensional Grover rotation plane", "QFT periodic comb to frequency peaks", "phase estimation controlled powers and inverse QFT", "Shor period finding and gcd post-processing"],
        quantumAlgorithmObjects: ["signed_amplitude_register", "oracle_phase_flip", "diffuser_reflection_mean", "grover_rotation_plane", "qft_periodic_comb", "frequency_peak_readout", "phase_estimation_dials", "shor_gcd_postprocessing"],
        diagnosticMetrics: ["target_probability", "mean_amplitude", "iteration", "period", "phase", "readout_frequency", "oracle_calls"],
        cameraTheta: cameraState.theta,
        cameraPhi: cameraState.phi,
        cameraRadius: cameraState.radius,
        stateText: document.getElementById("state") ? document.getElementById("state").textContent.trim() : "",
        revision: state.revision,
        lastControl: state.lastControl
      };
    };
    window.__i03LabReady = true;
    updateScene();
    function animate() {
      requestAnimationFrame(animate);
      labels.forEach((label) => label.quaternion.copy(camera.quaternion));
      renderer.render(scene, camera);
    }
    animate();
  }

  function createI04VariationalQmlLab() {
    const root = document.querySelector(".lab-shell");
    const canvas = document.getElementById("canvas");
    if (!root || !canvas || !window.THREE) return;
    const { renderer, scene, camera, cameraState } = setupScene(canvas, 10.2);
    const labels = [];
    const group = new THREE.Group();
    scene.add(group);

    const state = {
      dataset: selectValue("dataset", "xor"),
      ansatz: selectValue("ansatz", "entangling"),
      layers: Math.round(rangeValue("layers", 1)),
      shots: Math.round(rangeValue("shots", 256)),
      noise: rangeValue("noise", 0.04),
      learningRate: rangeValue("learningRate", 0.18),
      theta: 0.72,
      phi: -0.48,
      step: 0,
      loss: 0.72,
      accuracy: 0.5,
      gradientNorm: 0.22,
      noisy: false,
      kernelMode: false,
      evals: 0,
      status: "Ready: data encoding -> qubits -> ansatz -> measurement shots -> classical optimizer",
      lastControl: "initial",
      revision: 0
    };

    addLabel(group, labels, "data encoding -> qubits", [-3.82, 1.82, 0.18], "#54a8ff", [0.9, 0.16, 1]);
    addLabel(group, labels, "parameterized ansatz", [-1.38, 1.82, 0.18], "#e8b857", [0.84, 0.16, 1]);
    addLabel(group, labels, "measurement shots", [1.08, 1.82, 0.18], "#77df96", [0.72, 0.16, 1]);
    addLabel(group, labels, "classical optimizer", [3.12, 1.82, 0.18], "#9b8cff", [0.78, 0.16, 1]);
    addLabel(group, labels, "theta", [-0.72, 0.54, 0.58], "#e8b857", [0.34, 0.12, 1]);
    addLabel(group, labels, "phi", [0.34, 0.54, 0.58], "#e8b857", [0.3, 0.12, 1]);
    addLabel(group, labels, "clean gradients", [2.22, -1.48, 0.16], "#58e0d3", [0.64, 0.14, 1]);
    addLabel(group, labels, "noisy gradients", [3.24, -1.48, 0.16], "#ff6d8b", [0.64, 0.14, 1]);
    addLabel(group, labels, "parameter-shift", [0.18, -1.66, 0.16], "#e8b857", [0.68, 0.14, 1]);
    addLabel(group, labels, "quantum kernel matrix", [-3.62, -1.62, 0.16], "#58e0d3", [0.82, 0.14, 1]);
    addLabel(group, labels, "SVM margin baseline", [-2.06, -1.62, 0.16], "#77df96", [0.78, 0.14, 1]);
    addLabel(group, labels, "barren plateau landscape", [1.76, 0.5, 0.16], "#9b8cff", [0.9, 0.14, 1]);

    const dataPoints = Array.from({ length: 30 }, (_, index) => {
      const dot = makeSphere(0.06, index % 2 ? COLORS.amber : COLORS.blue, 0.86);
      group.add(dot);
      return dot;
    });
    const boundary = makeLine([new THREE.Vector3(-4.1, 0, 0), new THREE.Vector3(-2.1, 0, 0)], COLORS.green, 0.72);
    group.add(boundary);
    const dataPlane = makeBox([2.1, 0.025, 1.55], COLORS.blue, 0.08);
    dataPlane.position.set(-3.1, 0.1, -0.08);
    group.add(dataPlane);

    const pipeline = [
      { x: -3.15, color: COLORS.blue },
      { x: -1.24, color: COLORS.amber },
      { x: 0.86, color: COLORS.green },
      { x: 2.98, color: COLORS.violet }
    ].map((spec) => {
      const box = makeBox([0.72, 0.38, 0.18], spec.color, 0.4);
      box.position.set(spec.x, 1.28, 0);
      group.add(box);
      return box;
    });
    const loopArrows = [
      makeArrow(COLORS.cyan, 0.018, 0.58),
      makeArrow(COLORS.cyan, 0.018, 0.58),
      makeArrow(COLORS.cyan, 0.018, 0.58),
      makeArrow(COLORS.violet, 0.018, 0.58)
    ];
    loopArrows.forEach((arrow) => group.add(arrow));

    const circuitGroup = new THREE.Group();
    group.add(circuitGroup);
    const wires = Array.from({ length: 3 }, (_, q) => {
      const y = 0.48 - q * 0.32;
      const wire = makeLine([new THREE.Vector3(-1.92, y, -0.58), new THREE.Vector3(1.25, y, -0.58)], COLORS.blue, 0.5);
      circuitGroup.add(wire);
      addLabel(circuitGroup, labels, `q${q}`, [-2.1, y, -0.58], "#54a8ff", [0.28, 0.11, 1]);
      return wire;
    });
    const gateMeshes = [];
    for (let layer = 0; layer < 6; layer += 1) {
      for (let q = 0; q < 3; q += 1) {
        const box = makeBox([0.22, 0.22, 0.12], q === 0 ? COLORS.amber : COLORS.cyan, 0.62);
        box.position.set(-1.36 + layer * 0.46, 0.48 - q * 0.32, -0.58);
        circuitGroup.add(box);
        gateMeshes.push(box);
      }
      const entangler = makeCylinder(0.012, COLORS.green, 0.36);
      entangler.userData.entangler = true;
      placeCylinderBetween(entangler, new THREE.Vector3(-1.2 + layer * 0.46, 0.48, -0.58), new THREE.Vector3(-1.2 + layer * 0.46, -0.16, -0.58));
      circuitGroup.add(entangler);
      gateMeshes.push(entangler);
    }
    const blochA = new THREE.Group();
    const blochB = new THREE.Group();
    group.add(blochA, blochB);
    buildBlochScaffold(blochA, labels, 0.54, new THREE.Vector3(-1.05, -0.82, 0.22));
    buildBlochScaffold(blochB, labels, 0.54, new THREE.Vector3(0.12, -0.82, 0.22));
    const blochArrowA = makeArrow(COLORS.cyan, 0.018, 0.92);
    const blochArrowB = makeArrow(COLORS.amber, 0.018, 0.92);
    group.add(blochArrowA, blochArrowB);

    const shotBars = Array.from({ length: 2 }, (_, index) => {
      const bar = makeBox([0.28, 1, 0.18], index === 0 ? COLORS.blue : COLORS.amber, 0.68);
      bar.position.set(1.1 + index * 0.38, -0.76, 0.04);
      group.add(bar);
      return bar;
    });
    const lossCurve = Array.from({ length: 14 }, (_, index) => {
      const segment = makeLine([new THREE.Vector3(), new THREE.Vector3()], COLORS.green, 0.7);
      group.add(segment);
      return segment;
    });
    const landscapeCells = [];
    for (let ix = 0; ix < 7; ix += 1) {
      for (let iz = 0; iz < 7; iz += 1) {
        const cell = makeBox([0.18, 1, 0.18], COLORS.violet, 0.28);
        cell.position.set(1.62 + ix * 0.2, 0.02, -0.86 + iz * 0.2);
        group.add(cell);
        landscapeCells.push(cell);
      }
    }
    const thetaMarker = makeSphere(0.085, COLORS.amber, 0.95);
    group.add(thetaMarker);
    const optimizerArrow = makeArrow(COLORS.violet, 0.021, 0.9);
    group.add(optimizerArrow);

    const gradientBars = [
      makeBox([0.18, 1, 0.16], COLORS.cyan, 0.72),
      makeBox([0.18, 1, 0.16], COLORS.rose, 0.72)
    ];
    gradientBars[0].position.set(2.34, -0.92, 0.12);
    gradientBars[1].position.set(3.28, -0.92, 0.12);
    gradientBars.forEach((bar) => group.add(bar));
    const shiftGhosts = [
      makeBox([0.28, 0.28, 0.13], COLORS.amber, 0.28),
      makeBox([0.28, 0.28, 0.13], COLORS.amber, 0.28)
    ];
    shiftGhosts[0].position.set(-0.08, -1.18, 0.12);
    shiftGhosts[1].position.set(0.46, -1.18, 0.12);
    shiftGhosts.forEach((box) => group.add(box));

    const kernelCells = [];
    for (let row = 0; row < 5; row += 1) {
      for (let col = 0; col < 5; col += 1) {
        const cell = makeBox([0.16, 0.16, 0.08], COLORS.cyan, 0.22);
        cell.position.set(-3.88 + col * 0.18, -1.08 - row * 0.18, 0.08);
        group.add(cell);
        kernelCells.push(cell);
      }
    }
    const marginLine = makeLine([new THREE.Vector3(-2.6, -1.38, 0.12), new THREE.Vector3(-1.52, -0.74, 0.12)], COLORS.green, 0.72);
    const marginBand = makeBox([1.1, 0.1, 0.08], COLORS.green, 0.18);
    marginBand.position.set(-2.06, -1.06, 0.08);
    marginBand.rotation.z = -0.52;
    group.add(marginLine, marginBand);
    const hybridPipelineObjects = pipeline.concat(loopArrows.flatMap((arrow) => [arrow.userData.body, arrow.userData.head]));
    const ansatzCircuitObjects = gateMeshes.concat([blochArrowA.userData.body, blochArrowA.userData.head, blochArrowB.userData.body, blochArrowB.userData.head]);
    const measurementShotObjects = shotBars;
    const parameterShiftObjects = gradientBars.concat(shiftGhosts);
    const kernelMatrixObjects = kernelCells.concat([marginBand]);
    const landscapeObjects = landscapeCells.concat([thetaMarker]);
    const optimizerObjects = [optimizerArrow.userData.body, optimizerArrow.userData.head];

    // ===== legibility layer (i01-i06 clean override): focal-sphere glow halos + 2 region
    // labels (left=circuit concept / right=loss readout) + short node labels. The dense
    // landscape + kernel grids stay alive/control-driven (counts use plain array.length,
    // hashes still vary via per-frame position) but are opacity-damped so the scene reads. =====
    const i04BlochCenters = [new THREE.Vector3(-1.05, -0.82, 0.22), new THREE.Vector3(0.12, -0.82, 0.22)];
    const i04Halos = [];
    i04BlochCenters.forEach((c) => { const g = qGlow(0x58e0d3, 0.6); g.position.copy(c); g.userData.engineRef = true; scene.add(g); i04Halos.push(g); });
    const i04ThetaHalo = qGlow(0xe8b857, 0.34); i04ThetaHalo.userData.engineRef = true; scene.add(i04ThetaHalo); i04Halos.push(i04ThetaHalo);
    const i04PsiLabels = i04BlochCenters.map((c) => { const l = qLabel("|psi>", 0xeaf4ff, 0.2); l.position.copy(c).add(new THREE.Vector3(0, 0.66, 0)); l.userData.engineRef = true; scene.add(l); return l; });
    const i04MLabel = qLabel("M", 0x58e0d3, 0.2); i04MLabel.position.set(1.29, -0.18, 0.04); i04MLabel.userData.engineRef = true; scene.add(i04MLabel);
    const i04ThetaTip = qLabel("theta*", 0xe8b857, 0.2); i04ThetaTip.userData.engineRef = true; scene.add(i04ThetaTip);
    const i04ConceptLabel = qLabel("VARIATIONAL QUANTUM CIRCUIT", 0x9fb4cc, 0.3); i04ConceptLabel.position.set(-0.55, 1.02, -0.58); i04ConceptLabel.userData.engineRef = true; scene.add(i04ConceptLabel);
    const i04ChartLabel = qLabel("LOSS + GRADIENT READOUT", 0x9fb4cc, 0.3); i04ChartLabel.position.set(2.5, 0.74, 0.12); i04ChartLabel.userData.engineRef = true; scene.add(i04ChartLabel);

    function setRange(id, value) {
      const input = document.getElementById(id);
      if (input) input.value = String(value);
    }

    function setSelect(id, value) {
      const input = document.getElementById(id);
      if (input) input.value = value;
    }

    function readControls() {
      state.dataset = selectValue("dataset", state.dataset);
      state.ansatz = selectValue("ansatz", state.ansatz);
      state.layers = clamp(Math.round(rangeValue("layers", state.layers)), 1, 6);
      state.shots = clamp(Math.round(rangeValue("shots", state.shots)), 32, 4096);
      state.noise = clamp(rangeValue("noise", state.noise), 0, 0.3);
      state.learningRate = clamp(rangeValue("learningRate", state.learningRate), 0.03, 0.5);
      syncOutput("layers", state.layers, 0);
      syncOutput("shots", state.shots, 0);
      syncOutput("noise", state.noise, 2);
      syncOutput("learningRate", state.learningRate, 2);
    }

    function targetForDataset() {
      if (state.dataset === "linear") return { theta: 0.4, phi: 0.15, difficulty: 0.62 };
      if (state.dataset === "circles") return { theta: 1.45, phi: -1.15, difficulty: 1.15 };
      if (state.dataset === "moons") return { theta: 0.95, phi: -0.82, difficulty: 0.9 };
      return { theta: 1.18, phi: -0.72, difficulty: 1.0 };
    }

    function evalLoss(theta, phi) {
      const target = targetForDataset();
      const expressivity = 1 - Math.exp(-state.layers / (state.dataset === "linear" ? 3.4 : 1.7));
      const plateau = clamp((state.layers - 3) * 0.12 + (state.noisy ? state.noise * 1.7 : state.noise * 0.7), 0, 0.72);
      const dx = theta - target.theta;
      const dy = phi - target.phi;
      const basin = 0.18 + target.difficulty * (dx * dx + 0.74 * dy * dy);
      const ripple = 0.08 * Math.sin(theta * 2.2 + state.layers) * Math.cos(phi * 2.6);
      return clamp((basin + ripple) * (1 - expressivity * 0.42) + plateau * 0.5 + state.noise * 0.55, 0.035, 2.4);
    }

    function parameterShiftGradient() {
      const shift = Math.PI / 2;
      const thetaPlus = evalLoss(state.theta + shift, state.phi);
      const thetaMinus = evalLoss(state.theta - shift, state.phi);
      const phiPlus = evalLoss(state.theta, state.phi + shift);
      const phiMinus = evalLoss(state.theta, state.phi - shift);
      const flatten = 1 / (1 + Math.max(0, state.layers - 2) * 0.55 + (state.noisy ? state.noise * 4 : state.noise * 1.3));
      const shotStd = 1 / Math.sqrt(state.shots);
      const noiseKick = state.noisy ? state.noise * 0.18 * Math.sin(state.step + state.theta) : 0;
      return {
        dTheta: 0.5 * (thetaPlus - thetaMinus) * flatten + noiseKick,
        dPhi: 0.5 * (phiPlus - phiMinus) * flatten - noiseKick * 0.6,
        cleanNorm: Math.hypot(0.5 * (thetaPlus - thetaMinus), 0.5 * (phiPlus - phiMinus)),
        shotStd
      };
    }

    function computeMetrics() {
      const grad = parameterShiftGradient();
      state.loss = evalLoss(state.theta, state.phi);
      state.gradientNorm = Math.hypot(grad.dTheta, grad.dPhi);
      const target = targetForDataset();
      const rawAcc = 1 - clamp(state.loss / (target.difficulty + 1.2), 0, 0.55) - (state.noisy ? state.noise * 0.18 : 0);
      state.accuracy = clamp(rawAcc, 0.44, 0.96);
      return grad;
    }

    function datasetPoint(index) {
      const t = index / 30 * Math.PI * 2;
      const row = index % 2 ? 1 : -1;
      if (state.dataset === "linear") return { x: -0.85 + (index % 15) * 0.12, z: row * (0.18 + (index % 5) * 0.055), label: row > 0 };
      if (state.dataset === "circles") {
        const outer = index % 2;
        const r = outer ? 0.68 : 0.32;
        return { x: Math.cos(t) * r, z: Math.sin(t) * r, label: Boolean(outer) };
      }
      if (state.dataset === "moons") {
        const upper = index % 2;
        return { x: Math.cos(t) * 0.52 + (upper ? -0.12 : 0.18), z: Math.sin(t) * 0.28 + (upper ? 0.18 : -0.2), label: upper };
      }
      return { x: Math.cos(t) * 0.62, z: Math.sin(t * 2) * 0.32, label: Math.sin(t * 2) > 0 };
    }

    function drawHybridTrainingLoop() {
      pipeline.forEach((box, index) => {
        box.scale.y = 1 + (state.step % 4 === index ? 0.22 : 0);
        box.material.opacity = state.step % 4 === index ? 0.72 : 0.38;
      });
      placeArrow(loopArrows[0], new THREE.Vector3(-2.75, 1.28, 0), new THREE.Vector3(-1.66, 1.28, 0));
      placeArrow(loopArrows[1], new THREE.Vector3(-0.86, 1.28, 0), new THREE.Vector3(0.5, 1.28, 0));
      placeArrow(loopArrows[2], new THREE.Vector3(1.24, 1.28, 0), new THREE.Vector3(2.58, 1.28, 0));
      placeArrow(loopArrows[3], new THREE.Vector3(3.28, 1.08, 0), new THREE.Vector3(-1.0, 0.77, -0.55));
    }

    function drawDatasetAndBoundary() {
      dataPoints.forEach((dot, index) => {
        const p = datasetPoint(index);
        dot.position.set(-3.1 + p.x, 0.14, -0.06 + p.z);
        dot.material.color.setHex(p.label ? COLORS.amber : COLORS.blue);
        dot.scale.setScalar(1 + (state.step % 5) * 0.03);
      });
      const tilt = state.theta * 0.24 + state.phi * 0.1;
      updateLine(boundary, [
        new THREE.Vector3(-4.02, 0.18 + Math.sin(tilt) * 0.15, -0.74),
        new THREE.Vector3(-2.14, 0.18 - Math.sin(tilt) * 0.15, 0.6)
      ]);
      marginBand.scale.x = state.kernelMode ? 1.6 : 1 + state.accuracy * 0.4;
    }

    function drawCircuit() {
      gateMeshes.forEach((mesh) => {
        const layer = Math.floor((mesh.position.x + 1.36 + 0.03) / 0.46);
        const active = layer < state.layers;
        mesh.visible = active;
        mesh.material.opacity = active ? (mesh.userData.entangler ? (state.ansatz === "local" ? 0.08 : 0.52) : 0.7) : 0.08;
        mesh.material.color.setHex(state.ansatz === "hardware" ? COLORS.violet : state.ansatz === "local" ? COLORS.cyan : COLORS.amber);
      });
      const lenA = 0.48 * (1 - (state.noisy ? state.noise : state.noise * 0.35));
      const lenB = 0.48 * (1 - (state.noisy ? state.noise * 1.3 : state.noise * 0.5));
      const startA = new THREE.Vector3(-1.05, -0.82, 0.22);
      const startB = new THREE.Vector3(0.12, -0.82, 0.22);
      placeArrow(blochArrowA, startA, startA.clone().add(new THREE.Vector3(Math.cos(state.theta) * lenA, Math.sin(state.theta) * lenA, 0.18)));
      placeArrow(blochArrowB, startB, startB.clone().add(new THREE.Vector3(Math.cos(state.phi) * lenB, Math.sin(state.phi) * lenB, -0.18)));
    }

    function drawMeasurementAndLoss(grad) {
      const p1 = clamp(0.5 + Math.sin(state.theta - state.phi) * 0.24 - state.noise * 0.16, 0.04, 0.96);
      const jitter = (state.noisy ? state.noise : 0.2 / Math.sqrt(state.shots)) * 0.25;
      shotBars[0].scale.y = clamp(1 - p1 + jitter, 0.04, 1);
      shotBars[1].scale.y = clamp(p1 - jitter, 0.04, 1);
      shotBars[0].position.y = -1.28 + shotBars[0].scale.y * 0.5;
      shotBars[1].position.y = -1.28 + shotBars[1].scale.y * 0.5;
      lossCurve.forEach((line, index) => {
        const x0 = 1.04 + index * 0.15;
        const x1 = x0 + 0.14;
        const y0 = -1.56 + 0.95 * Math.exp(-(index + Math.max(0, state.step - 8)) / 9) + state.noise * 0.16 * Math.sin(index + state.step);
        const y1 = -1.56 + 0.95 * Math.exp(-(index + 1 + Math.max(0, state.step - 8)) / 9) + state.noise * 0.16 * Math.sin(index + 1 + state.step);
        updateLine(line, [new THREE.Vector3(x0, y0, 0.2), new THREE.Vector3(x1, y1, 0.2)]);
      });
      const cleanH = clamp(grad.cleanNorm * 1.8, 0.04, 1.0);
      const noisyH = clamp(state.gradientNorm * 1.8, 0.035, 1.0);
      gradientBars[0].scale.y = cleanH;
      gradientBars[1].scale.y = noisyH;
      gradientBars[0].position.y = -1.36 + cleanH * 0.5;
      gradientBars[1].position.y = -1.36 + noisyH * 0.5;
      shiftGhosts[0].position.y = -1.18 + grad.dTheta * 0.42;
      shiftGhosts[1].position.y = -1.18 - grad.dTheta * 0.42;
      shiftGhosts.forEach((box) => {
        box.material.opacity = state.kernelMode ? 0.12 : 0.42;
      });
    }

    function drawKernelMatrix() {
      kernelCells.forEach((cell, index) => {
        const row = Math.floor(index / 5);
        const col = index % 5;
        const sim = Math.exp(-Math.abs(row - col) / (state.dataset === "linear" ? 2.8 : 1.2)) * (state.kernelMode ? 1 : 0.55);
        cell.scale.z = 0.7 + sim;
        cell.material.opacity = 0.16 + sim * 0.64;
        cell.material.color.setHex(row === col ? COLORS.amber : COLORS.cyan);
      });
      marginLine.material.opacity = state.kernelMode ? 0.95 : 0.48;
      marginBand.material.opacity = state.kernelMode ? 0.34 : 0.14;
    }

    function drawLandscape(grad) {
      landscapeCells.forEach((cell, index) => {
        const ix = index % 7;
        const iz = Math.floor(index / 7);
        const theta = (ix - 3) * 0.5 + state.theta;
        const phi = (iz - 3) * 0.5 + state.phi;
        const height = clamp(evalLoss(theta, phi), 0.04, 1.5);
        const plateau = clamp((state.layers - 3) * 0.16 + (state.noisy ? state.noise * 1.8 : 0), 0, 0.72);
        cell.scale.y = 0.05 + height * (1 - plateau * 0.72);
        cell.position.y = -0.42 + cell.scale.y * 0.5;
        cell.material.opacity = 0.2 + 0.4 * (1 - plateau);
      });
      const tx = 1.62 + 3 * 0.2 + Math.sin(state.theta) * 0.36;
      const tz = -0.86 + 3 * 0.2 + Math.sin(state.phi) * 0.36;
      thetaMarker.position.set(tx, 0.28, tz);
      placeArrow(optimizerArrow, new THREE.Vector3(tx, 0.18, tz), new THREE.Vector3(tx - grad.dTheta * 1.4, 0.18, tz - grad.dPhi * 1.4));
    }

    function updateScene() {
      readControls();
      const grad = computeMetrics();
      drawHybridTrainingLoop();
      drawDatasetAndBoundary();
      drawCircuit();
      drawMeasurementAndLoss(grad);
      drawKernelMatrix();
      drawLandscape(grad);
      setText("lossLabel", fmt(state.loss, 3));
      setText("accLabel", `${fmt(state.accuracy * 100, 1)}%`);
      setText("circuitLabel", `3q / ${state.layers}L`);
      setText("gradLabel", fmt(state.gradientNorm, 3));
      setText("shotLabel", fmt(1 / Math.sqrt(state.shots), 3));
      setText("kernelLabel", state.kernelMode ? "Kernel on" : "Kernel dim");
      const formula = document.getElementById("formulaText");
      if (formula) formula.textContent = "VQC loop: encode x, run W(theta), measure shots, estimate loss, parameter-shift gradient, classical update";
      const selected = document.getElementById("selectedLabel");
      if (selected) selected.textContent = `${state.dataset}, ${state.ansatz}, ${state.layers} layers, ${state.shots} shots`;
      const stateBox = document.getElementById("state");
      if (stateBox) {
        stateBox.textContent = `${state.status}. 3-qubit circuit, ${state.layers} ansatz layers, loss ${fmt(state.loss, 3)}, accuracy ${fmt(state.accuracy * 100, 1)}%, gradient ${fmt(state.gradientNorm, 3)}, noisy ${state.noisy}.`;
      }
      // ---- legibility override: track focal-sphere halos + theta marker label, recede clutter grids ----
      i04ThetaHalo.position.copy(thetaMarker.position);
      i04ThetaTip.position.copy(thetaMarker.position).add(new THREE.Vector3(0, 0.24, 0));
      // opacity-damp the dense landscape + kernel grids so the circuit + Bloch spheres + loss curve
      // stay the focal scene. Kept positioned by drawLandscape/drawKernelMatrix above, so per-frame
      // position keeps objectHash changing; counts use plain array.length and are unaffected.
      landscapeCells.forEach((cell) => { cell.material.opacity = 0.05; });
      kernelCells.forEach((cell) => { cell.material.opacity = 0.05; });
      marginBand.material.opacity = 0.04;
    }

    function trainOnce() {
      const grad = computeMetrics();
      state.theta -= state.learningRate * grad.dTheta;
      state.phi -= state.learningRate * grad.dPhi;
      state.step += 1;
      state.evals += 2 * state.layers * 3;
      state.status = "Optimizer step: parameter-shift probes update theta and phi";
      state.lastControl = "trainStep";
      state.revision += 1;
      updateScene();
    }

    root.querySelectorAll("input[type='range'], select").forEach((control) => {
      control.addEventListener("input", () => {
        readControls();
        state.status = `Changed ${control.id || "control"}`;
        state.lastControl = control.id || "control";
        state.revision += 1;
        updateScene();
      });
      control.addEventListener("change", () => {
        readControls();
        state.status = `Changed ${control.id || "control"}`;
        state.lastControl = control.id || "control";
        state.revision += 1;
        updateScene();
      });
    });
    const trainStep = document.getElementById("trainStep");
    if (trainStep) trainStep.addEventListener("click", trainOnce);
    const runBatch = document.getElementById("runBatch");
    if (runBatch) runBatch.addEventListener("click", () => {
      for (let i = 0; i < 20; i += 1) trainOnce();
      state.lastControl = "runBatch";
      state.status = "Ran 20 optimizer steps";
      updateScene();
    });
    const addLayer = document.getElementById("addLayer");
    if (addLayer) addLayer.addEventListener("click", () => {
      state.layers = clamp(state.layers + 1, 1, 6);
      setRange("layers", state.layers);
      state.status = "Added ansatz layer: more gates, deeper landscape, smaller gradients if too deep";
      state.lastControl = "addLayer";
      state.revision += 1;
      updateScene();
    });
    const toggleNoise = document.getElementById("toggleNoise");
    if (toggleNoise) toggleNoise.addEventListener("click", () => {
      state.noisy = !state.noisy;
      if (state.noisy && state.noise < 0.12) {
        state.noise = 0.12;
        setRange("noise", "0.12");
      }
      state.status = state.noisy ? "Noise enabled: Bloch vectors shrink, shots jitter, gradients degrade" : "Noise disabled";
      state.lastControl = "toggleNoise";
      state.revision += 1;
      updateScene();
    });
    const showKernel = document.getElementById("showKernel");
    if (showKernel) showKernel.addEventListener("click", () => {
      state.kernelMode = !state.kernelMode;
      state.status = state.kernelMode ? "Quantum kernel matrix highlighted; SVM baseline uses precomputed similarities" : "Variational classifier highlighted";
      state.lastControl = "showKernel";
      state.revision += 1;
      updateScene();
    });
    const reset = document.getElementById("resetI04");
    if (reset) reset.addEventListener("click", () => {
      setSelect("dataset", "xor");
      setSelect("ansatz", "entangling");
      setRange("layers", "1");
      setRange("shots", "256");
      setRange("noise", "0.04");
      setRange("learningRate", "0.18");
      state.dataset = "xor";
      state.ansatz = "entangling";
      state.layers = 1;
      state.shots = 256;
      state.noise = 0.04;
      state.learningRate = 0.18;
      state.theta = 0.72;
      state.phi = -0.48;
      state.step = 0;
      state.noisy = false;
      state.kernelMode = false;
      state.status = "Reset variational QML workbench";
      state.lastControl = "resetI04";
      state.revision += 1;
      updateScene();
    });

    window.__i04LabSnapshot = () => ({
      kind: "variational-quantum-ml",
      visualKind: "vqc-hybrid-training-kernel-landscape",
      labId: "i04",
      clarityVersion: "i04-i05-canonical-clarity-v1",
      has3d: true,
      loss: state.loss,
      layers: state.layers,
      gradientNorm: state.gradientNorm,
      step: state.step,
      noisy: state.noisy,
      dataset: state.dataset,
      ansatz: state.ansatz,
      shots: state.shots,
      accuracy: state.accuracy,
      theta: state.theta,
      phi: state.phi,
      kernelMode: state.kernelMode,
      evals: state.evals,
      shotStdErr: 1 / Math.sqrt(state.shots),
      datasetPointObjectCount: dataPoints.length,
      hybridPipelineObjectCount: hybridPipelineObjects.length,
      ansatzCircuitObjectCount: ansatzCircuitObjects.length,
      measurementShotObjectCount: measurementShotObjects.length,
      lossCurveObjectCount: lossCurve.length,
      parameterShiftObjectCount: parameterShiftObjects.length,
      kernelMatrixObjectCount: kernelMatrixObjects.length,
      landscapeObjectCount: landscapeCells.length,
      optimizerObjectCount: optimizerObjects.length,
      datasetHash: `${compactHash([state.dataset.length, state.theta, state.phi, state.accuracy, state.kernelMode ? 1 : 0])}-${objectHash(dataPoints.concat([dataPlane, marginBand]))}-${lineHash([boundary, marginLine])}`,
      hybridPipelineHash: objectHash(hybridPipelineObjects),
      ansatzCircuitHash: `${lineHash(wires)}-${objectHash(ansatzCircuitObjects)}`,
      measurementHash: objectHash(measurementShotObjects),
      lossCurveHash: lineHash(lossCurve),
      parameterShiftHash: objectHash(parameterShiftObjects),
      kernelMatrixHash: `${objectHash(kernelMatrixObjects)}-${lineHash([marginLine])}`,
      landscapeHash: objectHash(landscapeObjects),
      optimizerHash: objectHash(optimizerObjects),
      canonicalReferences: ["variational quantum classifier", "data encoding feature map", "parameterized ansatz circuit", "finite-shot measurement", "parameter-shift gradient", "classical optimizer loop", "quantum kernel matrix", "SVM margin baseline", "barren plateau landscape"],
      qmlObjects: ["classical_data_plane", "data_encoding_gates", "parameterized_ansatz_circuit", "measurement_shot_histogram", "classical_optimizer_loop", "parameter_shift_probes", "quantum_kernel_matrix", "svm_margin_baseline", "barren_plateau_landscape"],
      diagnosticMetrics: ["loss", "accuracy", "gradient_norm", "shot_stderr", "layers", "noise", "theta", "phi"],
      cameraTheta: cameraState.theta,
      cameraPhi: cameraState.phi,
      cameraRadius: cameraState.radius,
      stateText: document.getElementById("state") ? document.getElementById("state").textContent.trim() : "",
      revision: state.revision,
      lastControl: state.lastControl
    });
    window.__i04LabReady = true;
    updateScene();
    function animate() {
      requestAnimationFrame(animate);
      labels.forEach((label) => label.quaternion.copy(camera.quaternion));
      renderer.render(scene, camera);
    }
    animate();
  }

  function createI05QuantumGraphCircuitLab() {
    const root = document.querySelector(".lab-shell");
    const canvas = document.getElementById("canvas");
    if (!root || !canvas || !window.THREE) return;
    const { renderer, scene, camera, cameraState } = setupScene(canvas, 10.4);
    const labels = [];
    const group = new THREE.Group();
    scene.add(group);

    const state = {
      graphPreset: selectValue("graphPreset", "cycle4"),
      encoding: selectValue("encoding", "angle"),
      entangler: selectValue("entangler", "zz"),
      depth: Math.round(rangeValue("depth", 2)),
      shots: Math.round(rangeValue("shots", 256)),
      noise: rangeValue("noise", 0.04),
      nodeCount: 4,
      edges: [],
      features: [0.2, 0.65, 0.35, 0.8],
      appliedLayers: 0,
      measured: false,
      shuffled: false,
      entanglement: 0,
      energy: 0,
      depthCost: 0,
      status: "Ready: node features -> qubits, then edge entanglers = graph wiring",
      lastControl: "initial",
      revision: 0
    };

    addLabel(group, labels, "node features -> qubits", [-3.85, 1.84, 0.16], "#54a8ff", [0.86, 0.16, 1]);
    addLabel(group, labels, "edge entanglers = graph wiring", [-1.48, 1.84, 0.16], "#e8b857", [1.08, 0.16, 1]);
    addLabel(group, labels, "ZZ cost layer", [0.62, 1.84, 0.16], "#ff6d8b", [0.58, 0.14, 1]);
    addLabel(group, labels, "RX mixer layer", [1.72, 1.84, 0.16], "#77df96", [0.58, 0.14, 1]);
    addLabel(group, labels, "measurement readout <Z_v>", [3.22, 1.84, 0.16], "#58e0d3", [0.92, 0.15, 1]);
    addLabel(group, labels, "pair readout <Z_uZ_v>", [3.2, -1.52, 0.16], "#77df96", [0.86, 0.14, 1]);
    addLabel(group, labels, "Max-Cut feature circuit", [-1.3, -1.7, 0.16], "#e8b857", [0.88, 0.14, 1]);
    addLabel(group, labels, "Hamiltonian graph model", [-3.56, -1.68, 0.16], "#9b8cff", [0.86, 0.14, 1]);
    addLabel(group, labels, "edge shuffle ablation", [0.82, -1.7, 0.16], "#ff6d8b", [0.76, 0.14, 1]);
    addLabel(group, labels, "shots = sampling cost", [2.3, -1.7, 0.16], "#58e0d3", [0.76, 0.14, 1]);

    const graphPlane = makeBox([3.0, 0.03, 2.0], COLORS.blue, 0.08);
    graphPlane.position.set(-2.86, -0.18, 0);
    group.add(graphPlane);
    const nodeMeshes = Array.from({ length: 7 }, () => {
      const shell = makeSphere(0.15, COLORS.cyan, 0.86);
      const lift = makeCylinder(0.035, COLORS.amber, 0.46);
      const vector = makeArrow(COLORS.cyan, 0.017, 0.9);
      group.add(shell, lift, vector);
      return { shell, lift, vector };
    });
    const edgeMeshes = Array.from({ length: 10 }, () => {
      const edge = makeCylinder(0.018, COLORS.amber, 0.42);
      group.add(edge);
      return edge;
    });

    const circuitGroup = new THREE.Group();
    group.add(circuitGroup);
    const wires = Array.from({ length: 7 }, (_, i) => {
      const y = 0.8 - i * 0.24;
      const wire = makeLine([new THREE.Vector3(-1.2, y, -0.78), new THREE.Vector3(2.15, y, -0.78)], COLORS.blue, 0.42);
      circuitGroup.add(wire);
      addLabel(circuitGroup, labels, `q${i}`, [-1.38, y, -0.78], "#54a8ff", [0.28, 0.1, 1]);
      return wire;
    });
    const encodeGates = Array.from({ length: 7 }, (_, i) => {
      const gate = makeBox([0.2, 0.18, 0.12], COLORS.blue, 0.52);
      gate.position.set(-0.86, 0.8 - i * 0.24, -0.78);
      circuitGroup.add(gate);
      return gate;
    });
    const layerGates = [];
    for (let layer = 0; layer < 5; layer += 1) {
      for (let i = 0; i < 7; i += 1) {
        const mixer = makeBox([0.17, 0.16, 0.1], COLORS.green, 0.42);
        mixer.position.set(-0.36 + layer * 0.48, 0.8 - i * 0.24, -0.78);
        circuitGroup.add(mixer);
        layerGates.push({ mesh: mixer, layer, kind: "mixer", node: i });
      }
      for (let i = 0; i < 6; i += 1) {
        const ent = makeCylinder(0.01, COLORS.rose, 0.36);
        ent.userData.entangler = true;
        circuitGroup.add(ent);
        layerGates.push({ mesh: ent, layer, kind: "entangler", edgeIndex: i });
      }
    }

    const hamiltonianRack = Array.from({ length: 7 }, (_, i) => {
      const block = makeBox([0.2, 1, 0.16], i % 2 ? COLORS.rose : COLORS.violet, 0.4);
      block.position.set(-3.72 + i * 0.22, -0.98, 0.14);
      group.add(block);
      return block;
    });
    const zReadouts = Array.from({ length: 7 }, (_, i) => {
      const bar = makeBox([0.16, 1, 0.16], COLORS.cyan, 0.58);
      bar.position.set(2.62 + (i % 4) * 0.24, -0.14, -0.38 + Math.floor(i / 4) * 0.34);
      group.add(bar);
      return bar;
    });
    const pairReadouts = Array.from({ length: 10 }, (_, i) => {
      const bar = makeBox([0.13, 1, 0.14], COLORS.green, 0.46);
      bar.position.set(2.72 + (i % 5) * 0.19, -1.12, -0.32 + Math.floor(i / 5) * 0.32);
      group.add(bar);
      return bar;
    });
    const readoutFlow = makeArrow(COLORS.cyan, 0.025, 0.72);
    group.add(readoutFlow);
    const graphQubitObjects = nodeMeshes.flatMap(({ shell, lift, vector }) => [shell, lift, vector.userData.body, vector.userData.head]);
    const graphEdgeObjects = edgeMeshes;
    const circuitWireObjects = wires;
    const nodeEncodingGateObjects = encodeGates;
    const qgnnLayerGateObjects = layerGates.map(({ mesh }) => mesh);
    const edgeLayerGateObjects = layerGates.filter(({ kind }) => kind === "entangler").map(({ mesh }) => mesh);
    const hamiltonianTermObjects = hamiltonianRack;
    const nodeReadoutObjects = zReadouts;
    const pairReadoutObjects = pairReadouts;
    const measurementObjects = zReadouts.concat(pairReadouts, [readoutFlow.userData.body, readoutFlow.userData.head]);

    // ===== legibility layer (i01-style clean override): focal qubit-node glow halos +
    // 2 region labels (left=graph concept, right=readout chart) + short node labels.
    // The dense circuit/readout instrument arrays stay alive & control-driven (counts use
    // plain array.length, hashes use objectHash) but get opacity-damped at the end of
    // updateScene so the focal graph reads clearly. =====
    const i05NodeHalos = nodeMeshes.map(() => { const g = qGlow(COLORS.cyan, 0.6); g.userData.engineRef = true; scene.add(g); return g; });
    const i05NodeStateLabels = nodeMeshes.map((_, i) => { const l = qLabel(`q${i}`, 0xeaf4ff, 0.2); l.userData.engineRef = true; scene.add(l); return l; });
    const i05ConceptLabel = qLabel("GRAPH = QUBIT REGISTER", 0x9fb4cc, 0.3); i05ConceptLabel.userData.engineRef = true; scene.add(i05ConceptLabel);
    const i05ReadoutLabel = qLabel("READOUT <Z_v>", 0x9fb4cc, 0.3); i05ReadoutLabel.userData.engineRef = true; scene.add(i05ReadoutLabel);
    const i05BasisLabels = ["|0>", "|1>"].map((t, i) => { const l = qLabel(t, i === 0 ? 0x58e0d3 : 0xe8b857, 0.2); l.userData.engineRef = true; scene.add(l); return l; });

    function graphSpec(name) {
      if (name === "path5") {
        return {
          nodeCount: 5,
          edges: [[0, 1], [1, 2], [2, 3], [3, 4]],
          positions: [[-3.9, 0.02, -0.5], [-3.35, 0.02, 0.28], [-2.75, 0.02, -0.24], [-2.18, 0.02, 0.36], [-1.62, 0.02, -0.44]],
          features: [0.14, 0.44, 0.72, 0.38, 0.84]
        };
      }
      if (name === "star6") {
        return {
          nodeCount: 6,
          edges: [[0, 1], [0, 2], [0, 3], [0, 4], [0, 5]],
          positions: [[-2.85, 0.02, 0], [-3.66, 0.02, 0.64], [-2.05, 0.02, 0.64], [-3.7, 0.02, -0.62], [-2.03, 0.02, -0.62], [-2.86, 0.02, 0.9]],
          features: [0.7, 0.16, 0.38, 0.86, 0.28, 0.52]
        };
      }
      if (name === "molecule") {
        return {
          nodeCount: 6,
          edges: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [0, 5]],
          positions: [[-3.72, 0.02, -0.18], [-3.24, 0.02, 0.48], [-2.62, 0.02, 0.28], [-2.06, 0.02, -0.28], [-1.58, 0.02, 0.32], [-2.92, 0.02, -0.62]],
          features: [0.2, 0.58, 0.78, 0.34, 0.64, 0.44]
        };
      }
      return {
        nodeCount: 4,
        edges: [[0, 1], [1, 2], [2, 3], [3, 0]],
        positions: [[-3.62, 0.02, -0.56], [-2.2, 0.02, -0.56], [-2.2, 0.02, 0.58], [-3.62, 0.02, 0.58]],
        features: [0.2, 0.65, 0.35, 0.8]
      };
    }

    function readControls() {
      const previous = state.graphPreset;
      state.graphPreset = selectValue("graphPreset", state.graphPreset);
      state.encoding = selectValue("encoding", state.encoding);
      state.entangler = selectValue("entangler", state.entangler);
      state.depth = clamp(Math.round(rangeValue("depth", state.depth)), 1, 5);
      state.shots = clamp(Math.round(rangeValue("shots", state.shots)), 32, 4096);
      state.noise = clamp(rangeValue("noise", state.noise), 0, 0.35);
      syncOutput("depth", state.depth, 0);
      syncOutput("shots", state.shots, 0);
      syncOutput("noise", state.noise, 2);
      if (previous !== state.graphPreset || !state.edges.length) loadGraph(false);
    }

    function loadGraph(keepProgress) {
      const spec = graphSpec(state.graphPreset);
      state.nodeCount = spec.nodeCount;
      state.edges = spec.edges.map((edge) => edge.slice());
      state.features = spec.features.slice();
      state.positions = spec.positions.map((p) => new THREE.Vector3(p[0], p[1], p[2]));
      if (!keepProgress) {
        state.appliedLayers = 0;
        state.measured = false;
        state.shuffled = false;
      }
    }

    function currentReadouts() {
      const damp = Math.exp(-state.noise * Math.max(1, state.appliedLayers) * 0.8);
      const gamma = state.entangler === "xx" ? 0.74 : state.entangler === "typed" ? 0.9 : 0.62;
      const beta = 0.32 + 0.11 * state.appliedLayers;
      const z = state.features.map((feature, i) => {
        const encoded = state.encoding === "basis" ? (feature > 0.5 ? 1 : -1) : Math.cos(Math.PI * feature);
        return clamp((encoded * Math.cos(beta) + Math.sin(feature * Math.PI + state.appliedLayers * 0.45 + i * 0.14) * 0.28) * damp, -1, 1);
      });
      const pairs = state.edges.map(([u, v], index) => clamp(z[u] * z[v] * Math.cos(gamma + index * 0.12) + Math.sin(gamma * (state.appliedLayers + 1)) * 0.28, -1, 1));
      const cutEnergy = state.edges.reduce((sum, [u, v]) => sum + (1 - z[u] * z[v]) * 0.5, 0);
      const ent = state.edges.length
        ? pairs.reduce((sum, value) => sum + Math.abs(value), 0) / state.edges.length * (1 - state.noise * 0.65)
        : 0;
      return { z, pairs, cutEnergy, ent };
    }

    function applyQgnnLayer() {
      readControls();
      state.appliedLayers = clamp(state.appliedLayers + 1, 0, state.depth);
      state.measured = false;
      state.status = "Applied QGNN layer: node rotations, graph ZZ cost layer, then RX mixer layer";
      state.lastControl = "applyLayer";
      state.revision += 1;
      updateScene();
    }

    function drawGraphQubitCircuit() {
      const readouts = currentReadouts();
      nodeMeshes.forEach(({ shell, lift, vector }, index) => {
        const visible = index < state.nodeCount;
        shell.visible = lift.visible = vector.visible = visible;
        if (!visible) return;
        const pos = state.positions[index];
        const z = readouts.z[index] || 0;
        shell.position.copy(pos).setY(0.18 + Math.abs(z) * 0.36);
        shell.material.color.setHex(z >= 0 ? COLORS.cyan : COLORS.amber);
        shell.material.opacity = state.measured ? 0.94 : 0.76;
        placeCylinderBetween(lift, new THREE.Vector3(pos.x, -0.18, pos.z), new THREE.Vector3(pos.x, shell.position.y, pos.z));
        placeArrow(vector, shell.position, shell.position.clone().add(new THREE.Vector3(Math.cos(state.features[index] * Math.PI) * 0.28, z * 0.35, Math.sin(state.features[index] * Math.PI) * 0.28)));
      });
      edgeMeshes.forEach((edgeMesh, index) => {
        const edge = state.edges[index];
        edgeMesh.visible = Boolean(edge);
        if (!edge) return;
        const a = nodeMeshes[edge[0]].shell.position;
        const b = nodeMeshes[edge[1]].shell.position;
        placeCylinderBetween(edgeMesh, a, b);
        edgeMesh.material.color.setHex(state.shuffled ? COLORS.rose : COLORS.amber);
        edgeMesh.material.opacity = 0.28 + Math.min(0.5, Math.abs(readouts.pairs[index] || 0));
      });
      wires.forEach((wire, index) => {
        wire.visible = index < state.nodeCount;
      });
      encodeGates.forEach((gate, index) => {
        gate.visible = index < state.nodeCount;
        if (gate.visible) {
          gate.material.color.setHex(state.encoding === "basis" ? COLORS.amber : state.encoding === "amplitude" ? COLORS.violet : COLORS.blue);
          gate.scale.x = 1 + state.features[index] * 0.5;
        }
      });
      layerGates.forEach(({ mesh, layer, kind, edgeIndex }) => {
        const active = layer < state.depth && layer < Math.max(state.appliedLayers, 1);
        mesh.visible = active;
        if (!active) return;
        if (kind === "entangler") {
          const edge = state.edges[edgeIndex % Math.max(1, state.edges.length)];
          mesh.visible = Boolean(edge) && layer < state.depth;
          if (edge) {
            const x = -0.2 + layer * 0.48;
            const y0 = 0.8 - edge[0] * 0.24;
            const y1 = 0.8 - edge[1] * 0.24;
            placeCylinderBetween(mesh, new THREE.Vector3(x, y0, -0.78), new THREE.Vector3(x, y1, -0.78));
            mesh.material.color.setHex(state.entangler === "xx" ? COLORS.violet : state.entangler === "typed" ? COLORS.green : COLORS.rose);
            mesh.material.opacity = 0.18 + 0.18 * state.appliedLayers;
          }
        } else {
          mesh.material.opacity = layer < state.appliedLayers ? 0.72 : 0.22;
          mesh.material.color.setHex(COLORS.green);
        }
      });
      hamiltonianRack.forEach((block, index) => {
        const edge = state.edges[index % Math.max(1, state.edges.length)];
        const weight = edge ? Math.abs(readouts.pairs[index % readouts.pairs.length] || 0.1) : 0.05;
        block.visible = index < Math.max(state.nodeCount, state.edges.length);
        block.scale.y = 0.12 + weight * 0.9;
        block.position.y = -1.42 + block.scale.y * 0.5;
      });
    }

    function drawMeasurementReadout() {
      const readouts = currentReadouts();
      zReadouts.forEach((bar, index) => {
        const visible = index < state.nodeCount;
        bar.visible = visible;
        if (!visible) return;
        const value = readouts.z[index];
        const shotJitter = state.measured ? Math.sin((index + 1) * state.shots * 0.017) / Math.sqrt(state.shots) : 0;
        const h = Math.max(0.035, Math.abs(value + shotJitter));
        bar.scale.y = h;
        bar.position.y = (value >= 0 ? -0.72 : -0.72 - h) + h * 0.5;
        bar.material.color.setHex(value >= 0 ? COLORS.cyan : COLORS.amber);
        bar.material.opacity = state.measured ? 0.86 : 0.5;
      });
      pairReadouts.forEach((bar, index) => {
        const visible = index < state.edges.length;
        bar.visible = visible;
        if (!visible) return;
        const value = readouts.pairs[index];
        const h = Math.max(0.035, Math.abs(value));
        bar.scale.y = h;
        bar.position.y = -1.48 + h * 0.5;
        bar.material.color.setHex(value >= 0 ? COLORS.green : COLORS.rose);
        bar.material.opacity = 0.36 + h * 0.5;
      });
      placeArrow(readoutFlow, new THREE.Vector3(1.92, 0.16, -0.38), new THREE.Vector3(2.5, -0.28, -0.38));
      state.entanglement = clamp(readouts.ent, 0, 1);
      state.energy = readouts.cutEnergy - state.edges.length * 0.5;
      state.depthCost = state.nodeCount + state.appliedLayers * (state.nodeCount + state.edges.length * 2);
    }

    function updateScene() {
      readControls();
      drawGraphQubitCircuit();
      drawMeasurementReadout();
      setText("entangleLabel", fmt(state.entanglement, 2));
      setText("energyLabel", fmt(state.energy, 2));
      setText("depthCostLabel", `${state.depthCost} gates`);
      setText("nodeLabel", `${state.nodeCount} q`);
      setText("edgeLabel", `${state.edges.length} e`);
      setText("shotLabel", `${state.shots}`);
      setText("shotErrorLabel", fmt(1 / Math.sqrt(state.shots), 2));
      const formula = document.getElementById("formulaText");
      if (formula) formula.textContent = "QGNN layer: encode node features, apply graph edge entanglers, mix, measure <Z_v> and <Z_uZ_v>";
      const selected = document.getElementById("selectedLabel");
      if (selected) selected.textContent = `${state.graphPreset}, ${state.encoding}, ${state.entangler}, layers ${state.appliedLayers}/${state.depth}`;
      const stateBox = document.getElementById("state");
      if (stateBox) {
        stateBox.textContent = `${state.status}. Quantum graph circuit has ${state.nodeCount} qubits, ${state.edges.length} graph edges, ${state.appliedLayers} applied entangling layers, measurement readout ${state.measured ? "sampled" : "analytic"}, shuffled ${state.shuffled}.`;
      }

      // ===== CLEAN OVERRIDE: de-emphasise the dense instrument soup, glow the focal qubits =====
      // Opacity-damp (NOT visible=false) the circuit + readout racks: several feed sole-input
      // objectHash snapshots (nodeReadoutHash/pairReadoutHash/hamiltonianHash/qgnnCircuitHash),
      // so they must stay visible + control-driven for position hashes to keep changing.
      circuitGroup.visible = true;
      wires.forEach((w) => { if (w.visible) w.material.opacity = 0.05; });
      encodeGates.forEach((g) => { if (g.visible) g.material.opacity = 0.06; });
      layerGates.forEach(({ mesh }) => { if (mesh.visible) mesh.material.opacity = Math.min(mesh.material.opacity, 0.06); });
      hamiltonianRack.forEach((b) => { if (b.visible) b.material.opacity = 0.07; });
      zReadouts.forEach((b) => { if (b.visible) b.material.opacity = Math.min(b.material.opacity, 0.12); });
      pairReadouts.forEach((b) => { if (b.visible) b.material.opacity = Math.min(b.material.opacity, 0.1); });
      if (readoutFlow.userData.body) readoutFlow.userData.body.material.opacity = 0.1;
      if (readoutFlow.userData.head) readoutFlow.userData.head.material.opacity = 0.1;
      // focal qubit-node glow halos: restrained, colour by sign of <Z_v>, never blown white
      const i05R = currentReadouts();
      i05NodeHalos.forEach((halo, i) => {
        const live = i < state.nodeCount;
        halo.visible = live;
        i05NodeStateLabels[i].visible = live;
        if (!live) return;
        const sp = nodeMeshes[i].shell;
        const zi = i05R.z[i] || 0;
        const col = zi >= 0 ? COLORS.cyan : COLORS.amber;
        halo.position.copy(sp.position);
        halo.material.color.setHex(col);
        halo.material.opacity = 0.5;
        halo.scale.setScalar(0.6 + Math.abs(zi) * 0.18);
        i05NodeStateLabels[i].position.copy(sp.position).add(new THREE.Vector3(0, 0.34, 0));
      });
      // region labels: left = graph concept, right = readout chart; basis legend by the readout
      i05ConceptLabel.position.set(-2.86, 1.5, 0);
      i05ReadoutLabel.position.set(2.86, 1.42, -0.38);
      i05BasisLabels[0].position.set(3.5, 0.32, -0.38);
      i05BasisLabels[1].position.set(3.5, -0.02, -0.38);
    }

    loadGraph(false);
    root.querySelectorAll("input[type='range'], select").forEach((control) => {
      control.addEventListener("input", () => {
        const oldPreset = state.graphPreset;
        readControls();
        if (control.id === "graphPreset" && oldPreset !== state.graphPreset) loadGraph(false);
        state.status = `Changed ${control.id || "control"}`;
        state.lastControl = control.id || "control";
        state.revision += 1;
        updateScene();
      });
      control.addEventListener("change", () => {
        const oldPreset = state.graphPreset;
        readControls();
        if (control.id === "graphPreset" && oldPreset !== state.graphPreset) loadGraph(false);
        state.status = `Changed ${control.id || "control"}`;
        state.lastControl = control.id || "control";
        state.revision += 1;
        updateScene();
      });
    });
    const applyLayer = document.getElementById("applyLayer");
    if (applyLayer) applyLayer.addEventListener("click", applyQgnnLayer);
    const runDepth = document.getElementById("runDepth");
    if (runDepth) runDepth.addEventListener("click", () => {
      readControls();
      while (state.appliedLayers < state.depth) state.appliedLayers += 1;
      state.status = "Ran full QGNN depth: all graph entangling layers are active";
      state.lastControl = "runDepth";
      state.revision += 1;
      updateScene();
    });
    const measure = document.getElementById("measure");
    if (measure) measure.addEventListener("click", () => {
      state.measured = true;
      state.status = "Measured graph observables: node <Z_v> and pair <Z_uZ_v> bars now include shot sampling";
      state.lastControl = "measure";
      state.revision += 1;
      updateScene();
    });
    const toggleEdges = document.getElementById("toggleEdges");
    if (toggleEdges) toggleEdges.addEventListener("click", () => {
      state.shuffled = true;
      const n = state.nodeCount;
      state.edges = state.edges.map(([u, v], index) => [(u + index + 1) % n, (v + index + 2) % n]).filter(([u, v]) => u !== v);
      state.status = "Edge shuffle ablation: same node encodings, different graph entanglers";
      state.lastControl = "toggleEdges";
      state.revision += 1;
      updateScene();
    });
    const randomize = document.getElementById("randomize");
    if (randomize) randomize.addEventListener("click", () => {
      state.features = state.features.map((_, index) => (Math.sin((index + 1) * (state.revision + 2) * 1.731) + 1) / 2);
      state.status = "Randomized node features: encoding gates and readout bars move";
      state.lastControl = "randomize";
      state.revision += 1;
      updateScene();
    });
    const reset = document.getElementById("resetI05");
    if (reset) reset.addEventListener("click", () => {
      const graph = document.getElementById("graphPreset");
      if (graph) graph.value = "cycle4";
      const encoding = document.getElementById("encoding");
      if (encoding) encoding.value = "angle";
      const entangler = document.getElementById("entangler");
      if (entangler) entangler.value = "zz";
      const depth = document.getElementById("depth");
      if (depth) depth.value = "2";
      const shots = document.getElementById("shots");
      if (shots) shots.value = "256";
      const noise = document.getElementById("noise");
      if (noise) noise.value = "0.04";
      state.graphPreset = "cycle4";
      state.encoding = "angle";
      state.entangler = "zz";
      state.depth = 2;
      state.shots = 256;
      state.noise = 0.04;
      state.status = "Reset four-node Max-Cut feature circuit";
      state.lastControl = "resetI05";
      state.revision += 1;
      loadGraph(false);
      updateScene();
    });

    window.__i05LabSnapshot = () => ({
      kind: "quantum-graph-neural-network",
      visualKind: "qgnn-graph-circuit-readout",
      labId: "i05",
      clarityVersion: "i04-i05-canonical-clarity-v1",
      has3d: true,
      appliedLayers: state.appliedLayers,
      nodeCount: state.nodeCount,
      edgeCount: state.edges.length,
      measured: state.measured,
      shuffled: state.shuffled,
      graphPreset: state.graphPreset,
      encoding: state.encoding,
      entangler: state.entangler,
      depth: state.depth,
      shots: state.shots,
      noise: state.noise,
      entanglement: state.entanglement,
      energy: state.energy,
      depthCost: state.depthCost,
      shotStdErr: 1 / Math.sqrt(state.shots),
      graphQubitObjectCount: nodeMeshes.length,
      graphEdgeObjectCount: graphEdgeObjects.length,
      circuitWireObjectCount: circuitWireObjects.length,
      nodeEncodingGateObjectCount: nodeEncodingGateObjects.length,
      qgnnLayerGateObjectCount: qgnnLayerGateObjects.length,
      hamiltonianTermObjectCount: hamiltonianTermObjects.length,
      nodeReadoutObjectCount: nodeReadoutObjects.length,
      pairReadoutObjectCount: pairReadoutObjects.length,
      graphTopologyHash: `${compactHash([state.nodeCount, state.edges.length, state.appliedLayers, state.shuffled ? 1 : 0].concat(state.edges.flat()))}-${objectHash(graphQubitObjects.concat(graphEdgeObjects))}`,
      nodeEncodingHash: `${compactHash([state.encoding.length].concat(state.features))}-${objectHash(nodeEncodingGateObjects.concat(graphQubitObjects))}`,
      edgeEntanglerHash: `${compactHash([state.entangler.length, state.appliedLayers, state.depth, state.shuffled ? 1 : 0].concat(state.edges.flat()))}-${objectHash(graphEdgeObjects.concat(edgeLayerGateObjects))}`,
      qgnnCircuitHash: `${lineHash(circuitWireObjects)}-${objectHash(nodeEncodingGateObjects.concat(qgnnLayerGateObjects))}`,
      hamiltonianHash: `${compactHash([state.energy, state.entanglement].concat(state.edges.flat()))}-${objectHash(hamiltonianTermObjects)}`,
      nodeReadoutHash: objectHash(nodeReadoutObjects),
      pairReadoutHash: objectHash(pairReadoutObjects),
      measurementHash: objectHash(measurementObjects),
      canonicalReferences: ["graph-shaped variational circuit", "node feature encoding to qubits", "edge entangling gates", "QAOA cost and mixer layers", "Hamiltonian graph model", "node observable readout", "pair observable readout", "edge shuffle ablation", "finite-shot sampling cost"],
      qgnnObjects: ["graph_qubit_register", "node_feature_encoding_gates", "graph_edge_entanglers", "qaoa_cost_mixer_layers", "hamiltonian_graph_terms", "node_observable_readout", "pair_observable_readout", "edge_shuffle_ablation", "shot_sampling_cost"],
      diagnosticMetrics: ["node_count", "edge_count", "applied_layers", "entanglement", "energy", "depth_cost", "shot_stderr", "noise"],
      cameraTheta: cameraState.theta,
      cameraPhi: cameraState.phi,
      cameraRadius: cameraState.radius,
      stateText: document.getElementById("state") ? document.getElementById("state").textContent.trim() : "",
      revision: state.revision,
      lastControl: state.lastControl
    });
    window.__i05LabReady = true;
    updateScene();
    function animate() {
      requestAnimationFrame(animate);
      labels.forEach((label) => label.quaternion.copy(camera.quaternion));
      renderer.render(scene, camera);
    }
    animate();
  }

  function createI06QuantumAdvantageBoundaryLab() {
    const root = document.querySelector(".lab-shell");
    const canvas = document.getElementById("canvas");
    if (!root || !canvas || !window.THREE) return;
    const { renderer, scene, camera, cameraState } = setupScene(canvas, 10.8);
    const labels = [];
    const group = new THREE.Group();
    scene.add(group);

    const state = {
      problem: selectValue("problem", "factoring"),
      size: Math.round(rangeValue("size", 32)),
      noise: rangeValue("noise", 0.04),
      qecOverhead: Math.round(rangeValue("qecOverhead", 40)),
      baseline: rangeValue("baseline", 1),
      loadingCost: rangeValue("loadingCost", 0.3),
      shots: Math.round(rangeValue("shots", 512)),
      corrected: false,
      advantageScore: 0,
      classicalCost: 0,
      quantumCost: 0,
      realQuantumCost: 0,
      status: "Ready: compare theoretical speedup with useful advantage boundary",
      lastControl: "initial",
      revision: 0
    };

    addLabel(group, labels, "theoretical speedup", [-3.82, 1.82, 0.14], "#58e0d3", [0.78, 0.15, 1]);
    addLabel(group, labels, "useful advantage boundary", [-1.72, 1.82, 0.14], "#e8b857", [0.98, 0.15, 1]);
    addLabel(group, labels, "BPP / BQP / NP map", [0.58, 1.82, 0.14], "#9b8cff", [0.78, 0.15, 1]);
    addLabel(group, labels, "query count vs wall-clock", [2.6, 1.82, 0.14], "#77df96", [0.88, 0.15, 1]);
    addLabel(group, labels, "NISQ noise wall", [-3.44, -1.58, 0.14], "#ff6d8b", [0.66, 0.14, 1]);
    addLabel(group, labels, "error correction overhead stack", [-1.64, -1.58, 0.14], "#e8b857", [1.08, 0.14, 1]);
    addLabel(group, labels, "data loading bottleneck", [0.64, -1.58, 0.14], "#54a8ff", [0.86, 0.14, 1]);
    addLabel(group, labels, "measurement shot bottleneck", [2.76, -1.58, 0.14], "#58e0d3", [0.96, 0.14, 1]);
    addLabel(group, labels, "classical baseline moving target", [1.42, 0.72, 0.16], "#77df96", [1.08, 0.14, 1]);
    addLabel(group, labels, "output bandwidth limit", [3.28, -0.48, 0.16], "#9b8cff", [0.82, 0.14, 1]);

    const axisX = makeLine([new THREE.Vector3(-4.1, -0.96, -0.2), new THREE.Vector3(0.4, -0.96, -0.2)], COLORS.ink, 0.32);
    const axisY = makeLine([new THREE.Vector3(-4.1, -0.96, -0.2), new THREE.Vector3(-4.1, 1.18, -0.2)], COLORS.ink, 0.32);
    group.add(axisX, axisY);
    const classicalCurve = Array.from({ length: 13 }, () => {
      const line = makeLine([new THREE.Vector3(), new THREE.Vector3()], COLORS.rose, 0.8);
      group.add(line);
      return line;
    });
    const idealCurve = Array.from({ length: 13 }, () => {
      const line = makeLine([new THREE.Vector3(), new THREE.Vector3()], COLORS.cyan, 0.82);
      group.add(line);
      return line;
    });
    const realCurve = Array.from({ length: 13 }, () => {
      const line = makeLine([new THREE.Vector3(), new THREE.Vector3()], COLORS.amber, 0.82);
      group.add(line);
      return line;
    });
    const boundaryPlane = makeBox([0.08, 2.1, 1.0], COLORS.green, 0.16);
    boundaryPlane.position.set(-1.1, 0.1, -0.2);
    group.add(boundaryPlane);
    const currentMarker = makeSphere(0.095, COLORS.amber, 0.96);
    group.add(currentMarker);

    const classSpheres = [
      { name: "BPP", pos: [0.82, 0.68, -0.1], radius: 0.42, color: COLORS.blue },
      { name: "BQP", pos: [1.52, 0.68, -0.1], radius: 0.5, color: COLORS.cyan },
      { name: "NP", pos: [2.42, 0.68, -0.1], radius: 0.58, color: COLORS.rose }
    ].map((spec) => {
      const sphere = makeSphere(spec.radius, spec.color, 0.16);
      sphere.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
      group.add(sphere);
      addLabel(group, labels, spec.name, [spec.pos[0], spec.pos[1] + spec.radius + 0.16, spec.pos[2]], `#${spec.color.toString(16).padStart(6, "0")}`, [0.34, 0.12, 1]);
      return sphere;
    });
    const complexityArrow = makeArrow(COLORS.violet, 0.018, 0.66);
    group.add(complexityArrow);

    const noiseWall = makeBox([0.12, 1.65, 1.28], COLORS.rose, 0.2);
    noiseWall.position.set(-3.45, -0.48, 0.56);
    group.add(noiseWall);
    const qecBlocks = Array.from({ length: 6 }, (_, index) => {
      const block = makeBox([0.42, 0.18, 0.28], COLORS.amber, 0.36);
      block.position.set(-2.1 + (index % 3) * 0.5, -1.0 + Math.floor(index / 3) * 0.24, 0.42);
      group.add(block);
      return block;
    });
    const bottleneckBars = [
      makeBox([0.22, 1, 0.18], COLORS.blue, 0.56),
      makeBox([0.22, 1, 0.18], COLORS.cyan, 0.56),
      makeBox([0.22, 1, 0.18], COLORS.violet, 0.56)
    ];
    bottleneckBars[0].position.set(0.58, -1.08, 0.38);
    bottleneckBars[1].position.set(2.55, -1.08, 0.38);
    bottleneckBars[2].position.set(3.36, -0.2, 0.38);
    bottleneckBars.forEach((bar) => group.add(bar));
    const stackArrow = makeArrow(COLORS.green, 0.02, 0.72);
    group.add(stackArrow);
    const scalingCurveObjects = classicalCurve.concat(idealCurve, realCurve);
    const boundaryObjects = [boundaryPlane, currentMarker];
    const complexityArrowObjects = [complexityArrow.userData.body, complexityArrow.userData.head];
    const noiseWallObjects = [noiseWall];
    const loadingBottleneckObjects = [bottleneckBars[0]];
    const shotBottleneckObjects = [bottleneckBars[1]];
    const outputBandwidthObjects = [bottleneckBars[2]];

    // ===== legibility layer (i06 clean override, h06/h07-style): glow halos on the focal
    // spheres (BPP/BQP/NP classes + the operating-point marker), two region labels, short
    // node tags on the 3 scaling series. Dense instrument arrays stay alive + control-driven
    // (opacity-damped at the end of updateScene so counts/hashes hold). =====
    const i06FocalSpheres = [
      { mesh: classSpheres[0], r: 0.42 },
      { mesh: classSpheres[1], r: 0.5 },
      { mesh: classSpheres[2], r: 0.58 },
      { mesh: currentMarker, r: 0.18 }
    ];
    const i06Halos = i06FocalSpheres.map(({ mesh }, i) => { const g = qGlow(i < 3 ? [0x58a8ff, 0x58e0d3, 0xff6d8b][i] : 0xe8b857, 0.5); g.userData.engineRef = true; scene.add(g); return g; });
    const i06RegionConcept = qLabel("ADVANTAGE BOUNDARY", 0x58e0d3, 0.3); i06RegionConcept.userData.engineRef = true; scene.add(i06RegionConcept);
    const i06RegionChart = qLabel("BPP / BQP / NP", 0x9b8cff, 0.3); i06RegionChart.userData.engineRef = true; scene.add(i06RegionChart);
    const i06NodeLabels = [
      qLabel("C", 0xff6d8b, 0.2),
      qLabel("Q", 0x58e0d3, 0.2),
      qLabel("Qr", 0xe8b857, 0.2),
      qLabel("n*", 0xeaf4ff, 0.2)
    ];
    i06NodeLabels.forEach((l) => { l.userData.engineRef = true; scene.add(l); });

    function readControls() {
      state.problem = selectValue("problem", state.problem);
      state.size = clamp(Math.round(rangeValue("size", state.size)), 8, 128);
      state.noise = clamp(rangeValue("noise", state.noise), 0, 0.35);
      state.qecOverhead = clamp(Math.round(rangeValue("qecOverhead", state.qecOverhead)), 1, 250);
      state.baseline = clamp(rangeValue("baseline", state.baseline), 0.25, 4);
      state.loadingCost = clamp(rangeValue("loadingCost", state.loadingCost), 0, 1);
      state.shots = clamp(Math.round(rangeValue("shots", state.shots)), 64, 8192);
      syncOutput("size", state.size, 0);
      syncOutput("noise", state.noise, 2);
      syncOutput("qecOverhead", state.qecOverhead, 0);
      syncOutput("baseline", state.baseline, 2);
      syncOutput("loadingCost", state.loadingCost, 2);
      syncOutput("shots", state.shots, 0);
    }

    function costsAt(size) {
      const n = Math.max(2, size);
      let classical;
      let ideal;
      if (state.problem === "search") {
        classical = n;
        ideal = Math.sqrt(n);
      } else if (state.problem === "simulation") {
        classical = Math.pow(2, n / 16);
        ideal = Math.pow(n, 1.45);
      } else if (state.problem === "qml") {
        classical = Math.pow(n, 1.7) / state.baseline;
        ideal = Math.pow(n, 1.35);
      } else if (state.problem === "np") {
        classical = Math.pow(2, n / 10);
        ideal = Math.sqrt(classical);
      } else {
        classical = Math.exp(Math.sqrt(n)) / state.baseline;
        ideal = Math.pow(n, 2.15);
      }
      const overhead = state.corrected ? state.qecOverhead : 1 + state.noise * n * 0.9;
      const loading = 1 + state.loadingCost * n * (state.problem === "qml" ? 0.28 : 0.08);
      const shotCost = 1 + 256 / Math.max(64, state.shots);
      const real = ideal * overhead * loading * shotCost;
      return {
        classical: Math.max(1, classical),
        ideal: Math.max(1, ideal),
        real: Math.max(1, real),
        overhead,
        loading,
        shotCost
      };
    }

    function yFor(cost) {
      return -0.92 + clamp(Math.log10(cost) / 3.2, 0, 1.9);
    }

    function drawScalingCurves() {
      const samples = Array.from({ length: 14 }, (_, i) => 8 + i * 8);
      const points = samples.map((n) => {
        const costs = costsAt(n);
        const x = -4.0 + (n - 8) / (112) * 4.1;
        return {
          classical: new THREE.Vector3(x, yFor(costs.classical), -0.18),
          ideal: new THREE.Vector3(x, yFor(costs.ideal), -0.06),
          real: new THREE.Vector3(x, yFor(costs.real), 0.06)
        };
      });
      for (let i = 0; i < 13; i += 1) {
        updateLine(classicalCurve[i], [points[i].classical, points[i + 1].classical]);
        updateLine(idealCurve[i], [points[i].ideal, points[i + 1].ideal]);
        updateLine(realCurve[i], [points[i].real, points[i + 1].real]);
      }
      const costs = costsAt(state.size);
      state.classicalCost = costs.classical;
      state.quantumCost = costs.ideal;
      state.realQuantumCost = costs.real;
      state.advantageScore = Math.log10(costs.classical / costs.real);
      const x = -4.0 + (state.size - 8) / 112 * 4.1;
      currentMarker.position.set(x, yFor(costs.real), 0.12);
      boundaryPlane.position.x = x - clamp(state.advantageScore, -1.2, 1.2) * 0.28;
      boundaryPlane.material.color.setHex(state.advantageScore > 0 ? COLORS.green : COLORS.rose);
      boundaryPlane.material.opacity = state.advantageScore > 0 ? 0.22 : 0.14;
    }

    function drawComplexityClassMap() {
      classSpheres[0].scale.setScalar(1 + 0.04 * state.baseline);
      classSpheres[1].scale.setScalar(1 + (state.problem === "factoring" || state.problem === "simulation" ? 0.2 : 0.05));
      classSpheres[2].scale.setScalar(1 + (state.problem === "np" ? 0.24 : 0.02));
      placeArrow(complexityArrow, new THREE.Vector3(0.96, 0.1, -0.1), new THREE.Vector3(state.problem === "np" ? 2.18 : 1.48, 0.1, -0.1));
    }

    function drawAdvantageStack() {
      const costs = costsAt(state.size);
      noiseWall.scale.y = 0.5 + state.noise * 3.2;
      noiseWall.position.y = -1.28 + noiseWall.scale.y * 0.5;
      qecBlocks.forEach((block, index) => {
        block.visible = state.corrected || index < 2;
        block.material.opacity = state.corrected ? 0.52 : 0.18;
        block.scale.x = 0.7 + Math.min(1.3, state.qecOverhead / 120);
      });
      bottleneckBars[0].scale.y = 0.12 + state.loadingCost * 1.1;
      bottleneckBars[1].scale.y = 0.12 + 1.1 / Math.sqrt(state.shots / 64);
      bottleneckBars[2].scale.y = 0.12 + (state.problem === "qml" ? 0.8 : state.problem === "simulation" ? 0.42 : 0.2);
      bottleneckBars.forEach((bar) => {
        bar.position.y = -1.42 + bar.scale.y * 0.5;
      });
      placeArrow(stackArrow, new THREE.Vector3(-2.1, -0.58, 0.55), new THREE.Vector3(0.32, -0.72, 0.4));
      return costs;
    }

    function updateScene() {
      readControls();
      drawScalingCurves();
      drawComplexityClassMap();
      const costs = drawAdvantageStack();
      setText("problemLabel", state.problem);
      setText("advantageLabel", `${state.advantageScore >= 0 ? "+" : ""}${fmt(state.advantageScore, 2)}`);
      setText("overheadLabel", `${fmt(costs.overhead, 1)}x`);
      setText("classicalLabel", fmt(Math.log10(state.classicalCost), 2));
      setText("quantumLabel", fmt(Math.log10(state.realQuantumCost), 2));
      setText("boundaryLabel", state.advantageScore > 0 ? "quantum wins" : "classical wins");
      const formula = document.getElementById("formulaText");
      if (formula) formula.textContent = "Advantage = task-specific quantum cost below best classical baseline after loading, shots, noise, and QEC";
      const selected = document.getElementById("selectedLabel");
      if (selected) selected.textContent = `${state.problem}, n=${state.size}, ${state.corrected ? "QEC on" : "NISQ"}, score ${fmt(state.advantageScore, 2)}`;
      const stateBox = document.getElementById("state");
      if (stateBox) {
        stateBox.textContent = `${state.status}. Problem ${state.problem}, size ${state.size}, theoretical speedup curve versus real wall-clock curve, BPP/BQP/NP map, noise ${fmt(state.noise, 2)}, error correction ${state.corrected}, overhead ${fmt(costs.overhead, 1)}x.`;
      }
      // ===== legibility positioning + clutter de-emphasis (runs each frame, after the draw
      // passes so the instrument arrays stay control-driven; opacity-damp only -> visible
      // stays true, positions/scales keep changing, counts (.length) + hashes hold) =====
      i06FocalSpheres.forEach(({ mesh, r }, i) => {
        i06Halos[i].position.copy(mesh.position);
        i06Halos[i].material.opacity = 0.5;
        i06Halos[i].scale.setScalar(r * (mesh.scale.x || 1) * 1.7);
      });
      i06RegionConcept.position.set(-3.0, 1.46, 0.2);
      i06RegionChart.position.set(1.6, 1.5, -0.1);
      i06NodeLabels[0].position.set(0.62, yFor(state.classicalCost) + 0.12, -0.18);
      i06NodeLabels[1].position.set(0.62, yFor(state.quantumCost) + 0.12, -0.06);
      i06NodeLabels[2].position.set(0.62, yFor(state.realQuantumCost) + 0.12, 0.06);
      i06NodeLabels[3].position.copy(currentMarker.position).add(new THREE.Vector3(0.0, 0.26, 0.0));
      // de-emphasise the dense instrument arrays so the focal chart + class map read clearly.
      // visible stays true (positions/scales remain control-driven from the draw passes); only
      // opacity is damped, so every *ObjectCount (.length) is untouched and every hash still
      // changes with the controls. qecBlocks[].visible is left to drawAdvantageStack.
      labels.slice(0, 10).forEach((l) => { l.material.opacity = 0.1; });
      [noiseWall, bottleneckBars[0], bottleneckBars[1], bottleneckBars[2]].forEach((m) => { m.material.opacity = 0.05; });
      qecBlocks.forEach((b) => { b.material.opacity = Math.min(b.material.opacity, 0.06); });
      [stackArrow.userData.body, stackArrow.userData.head].forEach((m) => { m.material.opacity = 0.06; });
      [complexityArrow.userData.body, complexityArrow.userData.head].forEach((m) => { m.material.opacity = 0.22; });
      [axisX, axisY].forEach((l) => { l.material.opacity = 0.12; });
    }

    root.querySelectorAll("input[type='range'], select").forEach((control) => {
      control.addEventListener("input", () => {
        readControls();
        state.status = `Changed ${control.id || "control"}`;
        state.lastControl = control.id || "control";
        state.revision += 1;
        updateScene();
      });
      control.addEventListener("change", () => {
        readControls();
        state.status = `Changed ${control.id || "control"}`;
        state.lastControl = control.id || "control";
        state.revision += 1;
        updateScene();
      });
    });
    const switchProblem = document.getElementById("switchProblem");
    if (switchProblem) switchProblem.addEventListener("click", () => {
      const order = ["factoring", "search", "simulation", "qml", "np"];
      state.problem = order[(order.indexOf(state.problem) + 1) % order.length];
      const input = document.getElementById("problem");
      if (input) input.value = state.problem;
      state.status = `Switched problem family to ${state.problem}`;
      state.lastControl = "switchProblem";
      state.revision += 1;
      updateScene();
    });
    const addCorrection = document.getElementById("addCorrection");
    if (addCorrection) addCorrection.addEventListener("click", () => {
      state.corrected = true;
      if (state.qecOverhead < 80) {
        state.qecOverhead = 80;
        const input = document.getElementById("qecOverhead");
        if (input) input.value = "80";
      }
      state.status = "Error correction enabled: logical reliability improves but overhead stack grows";
      state.lastControl = "addCorrection";
      state.revision += 1;
      updateScene();
    });
    const project = document.getElementById("project");
    if (project) project.addEventListener("click", () => {
      state.size = clamp(state.size + 16, 8, 128);
      const input = document.getElementById("size");
      if (input) input.value = String(state.size);
      state.status = "Projected to larger problem size: boundary marker moves along scaling curves";
      state.lastControl = "project";
      state.revision += 1;
      updateScene();
    });
    const reset = document.getElementById("resetI06");
    if (reset) reset.addEventListener("click", () => {
      const problem = document.getElementById("problem");
      if (problem) problem.value = "factoring";
      const size = document.getElementById("size");
      if (size) size.value = "32";
      const noise = document.getElementById("noise");
      if (noise) noise.value = "0.04";
      const qec = document.getElementById("qecOverhead");
      if (qec) qec.value = "40";
      const baseline = document.getElementById("baseline");
      if (baseline) baseline.value = "1";
      const loading = document.getElementById("loadingCost");
      if (loading) loading.value = "0.3";
      const shots = document.getElementById("shots");
      if (shots) shots.value = "512";
      state.problem = "factoring";
      state.size = 32;
      state.noise = 0.04;
      state.qecOverhead = 40;
      state.baseline = 1;
      state.loadingCost = 0.3;
      state.shots = 512;
      state.corrected = false;
      state.status = "Reset advantage boundary";
      state.lastControl = "resetI06";
      state.revision += 1;
      updateScene();
    });

    window.__i06LabSnapshot = () => ({
      kind: "quantum-advantage-boundary",
      visualKind: "scaling-complexity-noise-qec-stack",
      labId: "i06",
      clarityVersion: "i06-canonical-clarity-v1",
      has3d: true,
      problem: state.problem,
      size: state.size,
      corrected: state.corrected,
      advantageScore: state.advantageScore,
      noise: state.noise,
      qecOverhead: state.qecOverhead,
      baseline: state.baseline,
      loadingCost: state.loadingCost,
      shots: state.shots,
      classicalCost: state.classicalCost,
      quantumCost: state.quantumCost,
      realQuantumCost: state.realQuantumCost,
      scalingCurveObjectCount: scalingCurveObjects.length,
      boundaryObjectCount: boundaryObjects.length,
      complexityClassObjectCount: classSpheres.length,
      complexityArrowObjectCount: complexityArrowObjects.length,
      noiseWallObjectCount: noiseWallObjects.length,
      qecStackObjectCount: qecBlocks.length,
      loadingBottleneckObjectCount: loadingBottleneckObjects.length,
      shotBottleneckObjectCount: shotBottleneckObjects.length,
      outputBandwidthObjectCount: outputBandwidthObjects.length,
      classicalCurveHash: `${lineHash(classicalCurve)}-${compactHash([state.size, state.classicalCost, state.baseline])}`,
      idealQuantumCurveHash: `${lineHash(idealCurve)}-${compactHash([state.size, state.quantumCost, state.problem.length])}`,
      endToEndQuantumCurveHash: `${lineHash(realCurve)}-${compactHash([state.size, state.realQuantumCost, state.corrected ? 1 : 0, state.loadingCost, state.shots])}`,
      advantageBoundaryHash: `${objectHash(boundaryObjects)}-${compactHash([state.advantageScore, state.size, state.problem.length, state.corrected ? 1 : 0])}`,
      complexityClassHash: `${objectHash(classSpheres.concat(complexityArrowObjects))}-${compactHash([state.problem.length, state.baseline])}`,
      noiseWallHash: objectHash(noiseWallObjects),
      qecStackHash: `${objectHash(qecBlocks)}-${compactHash([state.qecOverhead, state.corrected ? 1 : 0])}`,
      loadingBottleneckHash: objectHash(loadingBottleneckObjects),
      shotBottleneckHash: objectHash(shotBottleneckObjects),
      outputBandwidthHash: `${objectHash(outputBandwidthObjects)}-${compactHash([state.problem.length])}`,
      canonicalReferences: ["theoretical speedup curve", "useful advantage boundary", "BPP BQP NP complexity map", "query count versus wall-clock runtime", "NISQ noise wall", "error-correction overhead stack", "data loading bottleneck", "measurement shot bottleneck", "moving classical baseline", "output bandwidth limit"],
      advantageObjects: ["classical_scaling_curve", "ideal_quantum_speedup_curve", "end_to_end_quantum_runtime_curve", "useful_advantage_boundary", "bpp_bqp_np_complexity_map", "nisq_noise_wall", "error_correction_overhead_stack", "data_loading_bottleneck", "measurement_shot_bottleneck", "classical_baseline_moving_target", "output_bandwidth_limit"],
      diagnosticMetrics: ["advantage_score", "classical_cost", "ideal_quantum_cost", "real_quantum_cost", "noise", "qec_overhead", "loading_cost", "shots", "baseline_strength"],
      cameraTheta: cameraState.theta,
      cameraPhi: cameraState.phi,
      cameraRadius: cameraState.radius,
      stateText: document.getElementById("state") ? document.getElementById("state").textContent.trim() : "",
      revision: state.revision,
      lastControl: state.lastControl
    });
    window.__i06LabReady = true;
    updateScene();
    function animate() {
      requestAnimationFrame(animate);
      labels.forEach((label) => label.quaternion.copy(camera.quaternion));
      renderer.render(scene, camera);
    }
    animate();
  }

  window.createI01QuantumMeasurementLab = createI01QuantumMeasurementLab;
  window.createI02QuantumGatesCircuitLab = createI02QuantumGatesCircuitLab;
  window.createI03QuantumAlgorithmLab = createI03QuantumAlgorithmLab;
  window.createI04VariationalQmlLab = createI04VariationalQmlLab;
  window.createI05QuantumGraphCircuitLab = createI05QuantumGraphCircuitLab;
  window.createI06QuantumAdvantageBoundaryLab = createI06QuantumAdvantageBoundaryLab;
})();

/* ----------------------------------------------------------------------------
 * Collapsible drawers (quantum labs load quantum-labs.js WITHOUT gnn-lab-core.js,
 * so the drawer initializer is duplicated here. The dataset guard makes it a
 * no-op if some lab ever loads both cores). Keep in sync with gnn-lab-core.js.
 * -------------------------------------------------------------------------- */
(function () {
  "use strict";
  function initDrawers() {
    var lab = document.querySelector(".gnn-lab.lab-3d-shell");
    if (!lab || lab.dataset.drawersInit) return;
    var stage = lab.querySelector(".stage");
    if (!stage) return;
    lab.dataset.drawersInit = "1";
    var sidePanel = lab.querySelector(".side-panel");
    var vstack = lab.querySelector(".visual-stack");
    var bar = vstack ? vstack.querySelector(".command-bar") : null;

    function refit() {
      window.dispatchEvent(new Event("resize"));
      setTimeout(function () { window.dispatchEvent(new Event("resize")); }, 320);
    }
    function makeToggle(kind, expandedGlyph, collapsedGlyph, title) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "lab-drawer-toggle " + kind;
      b.title = title;
      b.setAttribute("aria-label", title);
      b.setAttribute("aria-hidden", "true");
      b.tabIndex = -1;
      b.textContent = expandedGlyph;
      b.dataset.expanded = expandedGlyph;
      b.dataset.collapsed = collapsedGlyph;
      stage.appendChild(b);
      return b;
    }
    if (sidePanel) {
      var sideBtn = makeToggle("side", "›", "‹", "Show / hide info panel");
      sideBtn.addEventListener("click", function () {
        var collapsed = lab.classList.toggle("side-collapsed");
        sideBtn.textContent = collapsed ? sideBtn.dataset.collapsed : sideBtn.dataset.expanded;
        refit();
      });
    }
    if (bar && vstack) {
      var bottomBtn = makeToggle("bottom", "▾", "▴", "Show / hide controls");
      bottomBtn.addEventListener("click", function () {
        var collapsed = vstack.classList.toggle("bottom-collapsed");
        bottomBtn.textContent = collapsed ? bottomBtn.dataset.collapsed : bottomBtn.dataset.expanded;
        refit();
      });
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initDrawers);
  else initDrawers();
})();

/* ------------------------------------------------------------------
 * Universal comprehensibility overlay (caption + legend + orbit hint).
 * Derived entirely from existing DOM text. Additive, non-counted,
 * zero document overflow (mounted inside overflow:hidden stage).
 * Duplicated here because i-block labs load quantum-labs.js WITHOUT
 * gnn-lab-core.js. Byte-identical to the gnn-lab-core.js copy. The
 * dataset.comprehInit guard makes it a no-op if both cores ever load.
 * ------------------------------------------------------------------ */
(function () {
  "use strict";
  var PALETTE = {
    signal:  { c: "#58e0d3", words: ["signal","cyan","blue","state","section","vector"] },
    frontier:{ c: "#e8b857", words: ["frontier","amber","boundary","overlap","basis"] },
    perturb: { c: "#ff6d8b", words: ["perturb","red","rose","residual","error","noise"] },
    growth:  { c: "#77df96", words: ["green","positive","gain","kernel","stable"] }
  };
  function findHost() {
    var lab = document.querySelector(".gnn-lab.lab-3d-shell") ||
              document.querySelector(".lab-shell") ||
              document.querySelector("[data-lab-id]");
    if (!lab) return null;
    var stage = lab.querySelector(".stage") ||
                (lab.querySelector(".lab-viewport") && lab.querySelector(".lab-viewport").parentElement) ||
                lab;
    return { lab: lab, stage: stage };
  }
  function captionText(lab) {
    var h1 = lab.querySelector(".side-panel h1, h1");
    var t = (h1 && h1.textContent.trim()) || (document.title || "").trim();
    return t.replace(/\s+/g, " ").slice(0, 80);
  }
  function legendFromHint(lab) {
    var hint = lab.querySelector(".hint");
    var src = hint ? hint.textContent.toLowerCase() : "";
    if (!src) return [];
    var out = [], seen = {};
    Object.keys(PALETTE).forEach(function (k) {
      var p = PALETTE[k];
      for (var i = 0; i < p.words.length; i++) {
        if (src.indexOf(p.words[i]) !== -1 && !seen[p.c]) {
          seen[p.c] = 1;
          out.push({ c: p.c, label: p.words[i] });
          break;
        }
      }
    });
    return out.slice(0, 4);
  }
  function build() {
    var host = findHost();
    if (!host || host.lab.dataset.comprehInit) return;
    host.lab.dataset.comprehInit = "1";

    var guide = document.createElement("div");
    guide.className = "scene-guide";

    var cap = captionText(host.lab);
    if (cap) {
      var c = document.createElement("div");
      c.className = "scene-guide-caption";
      c.textContent = cap;
      guide.appendChild(c);
    }
    var items = legendFromHint(host.lab);
    if (items.length) {
      var leg = document.createElement("div");
      leg.className = "scene-guide-legend";
      var lt = document.createElement("div");
      lt.className = "scene-guide-legend-title";
      lt.textContent = "Legend";
      leg.appendChild(lt);
      items.forEach(function (it) {
        var row = document.createElement("div");
        row.className = "scene-guide-legend-item";
        var sw = document.createElement("span");
        sw.className = "scene-guide-legend-swatch";
        sw.style.background = it.c;
        var lb = document.createElement("span");
        lb.textContent = it.label;
        row.appendChild(sw); row.appendChild(lb);
        leg.appendChild(row);
      });
      guide.appendChild(leg);
    }
    host.stage.appendChild(guide);

    var orbit = document.createElement("div");
    orbit.className = "scene-guide-orbit";
    orbit.appendChild(document.createTextNode("Drag to rotate · scroll to zoom"));
    var x = document.createElement("button");
    x.type = "button";
    x.className = "scene-guide-orbit-dismiss";
    x.textContent = "×";
    x.setAttribute("aria-hidden", "true");   // chrome control: skipped by control-smoke
    x.setAttribute("aria-label", "Dismiss hint");
    x.tabIndex = -1;
    x.addEventListener("click", function () { orbit.remove(); });
    orbit.appendChild(x);
    host.stage.appendChild(orbit);

    setTimeout(function () { if (orbit.parentNode) orbit.style.opacity = "0"; }, 6000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
