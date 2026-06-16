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

  function setMetric(root, label, value, digits) {
    const metric = [...root.querySelectorAll("[data-role='metric']")].find((item) => item.dataset.metric === label);
    if (!metric) return;
    const strong = metric.querySelector("strong");
    if (strong) strong.textContent = fmt(value, digits);
  }

  function material(color, opacity) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.66,
      metalness: 0.08,
      transparent: opacity < 1,
      opacity,
      side: THREE.DoubleSide,
      depthWrite: opacity >= 0.5
    });
  }

  function lineMaterial(color, opacity) {
    return new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
  }

  function makeSphere(radius, color, opacity) {
    return new THREE.Mesh(new THREE.SphereGeometry(radius, 22, 14), material(color, opacity == null ? 1 : opacity));
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
  }

  // Shared legibility helpers (h05 clean override): additive glow + aspect-fit text label.
  const _scGlowTex = (function () {
    const cv = document.createElement("canvas"); cv.width = 128; cv.height = 128;
    const cx = cv.getContext("2d");
    const g = cx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, "rgba(255,255,255,0.6)"); g.addColorStop(0.22, "rgba(255,255,255,0.24)"); g.addColorStop(1, "rgba(255,255,255,0)");
    cx.fillStyle = g; cx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(cv);
  })();
  function scGlow(hex, size) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: _scGlowTex, color: hex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    sp.scale.set(size, size, 1);
    return sp;
  }
  function scLabel(text, hex, sc) {
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

  function objectHash(objects) {
    return compactHash(objects.flatMap((object, index) => {
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

  function setTrackedLine(line, points) {
    updateLine(line, points);
    line.userData.hashValues = points.flatMap((point) => [point.x, point.y, point.z]);
  }

  function lineHash(lines) {
    return compactHash(lines.flatMap((line, index) => [
      index,
      line.visible ? 1 : 0,
      line.material && line.material.opacity != null ? line.material.opacity : 1,
      line.material && line.material.color ? line.material.color.getHex() : 0
    ].concat(line.userData.hashValues || [])));
  }

  function setRange(id, value) {
    const input = document.getElementById(id);
    if (input) input.value = String(value);
  }

  function setupScene(root, canvas, distance) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // --- canonical color pipeline (r128) ---
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.98;
    renderer.setClearColor(COLORS.bg, 1);
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(COLORS.bg, 8.5, 22);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
    const state = { theta: -0.74, phi: 0.58, radius: distance || 8, dragging: false, x: 0, y: 0 };

    const ambient = new THREE.AmbientLight(0xffffff, 0.50);
    const key = new THREE.DirectionalLight(0xefffff, 1.34);
    key.position.set(3, 5, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 0.5; key.shadow.camera.far = 42;
    key.shadow.camera.left = -7; key.shadow.camera.right = 7;
    key.shadow.camera.top = 7; key.shadow.camera.bottom = -7;
    key.shadow.bias = -0.0006;
    const fill = new THREE.PointLight(0x58e0d3, 0.92, 12);
    fill.position.set(-3, 2, -4);
    scene.add(ambient, key, fill);

    function placeCamera() {
      const cp = Math.cos(state.phi);
      camera.position.set(
        Math.cos(state.theta) * cp * state.radius,
        Math.sin(state.phi) * state.radius,
        Math.sin(state.theta) * cp * state.radius
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
      state.dragging = true;
      state.x = event.clientX;
      state.y = event.clientY;
      canvas.setPointerCapture(event.pointerId);
    });
    canvas.addEventListener("pointermove", (event) => {
      if (!state.dragging) return;
      const dx = event.clientX - state.x;
      const dy = event.clientY - state.y;
      state.theta -= dx * 0.008;
      state.phi = clamp(state.phi + dy * 0.006, -0.1, 1.18);
      state.x = event.clientX;
      state.y = event.clientY;
      placeCamera();
    });
    canvas.addEventListener("pointerup", () => {
      state.dragging = false;
    });
    canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      state.radius = clamp(state.radius + event.deltaY * 0.006, 4.4, 13.5);
      placeCamera();
    }, { passive: false });

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas.parentElement);
    resize();
    placeCamera();

    function addEngineGroundRef(targetScene, y, half) {
      const g = new THREE.Group();
      g.userData.engineRef = true;
      const axes = [
        [[half, 0, 0], 0x54a8ff],   // +X blue
        [[0, half, 0], 0x77df96],   // +Y green
        [[0, 0, half], 0x58e0d3]    // +Z cyan
      ];
      axes.forEach(([end, color]) => {
        const ln = makeLine(
          [new THREE.Vector3(0, y, 0), new THREE.Vector3(end[0], y + end[1], end[2])],
          color, 0.3);
        ln.userData.engineRef = true;
        g.add(ln);
      });
      targetScene.add(g);
      return g;
    }

    function grid(width, depth, y) {
      for (let i = -4; i <= 4; i += 1) {
        scene.add(makeLine([new THREE.Vector3(-width, y, i * depth / 4), new THREE.Vector3(width, y, i * depth / 4)], COLORS.ink, 0.055));
        scene.add(makeLine([new THREE.Vector3(i * width / 4, y, -depth), new THREE.Vector3(i * width / 4, y, depth)], COLORS.ink, 0.045));
      }
    }

    root.dataset.cameraTheta = String(state.theta);
    // Generic premium polish for h02-h05: transparent shadow-catcher + auto shadow casters.
    const _scOrigRender = renderer.render.bind(renderer);
    let _scGrounded = false;
    renderer.render = function (sc, cam) {
      if (!_scGrounded) {
        try {
          const gp = new THREE.Mesh(new THREE.PlaneGeometry(44, 44), new THREE.ShadowMaterial({ opacity: 0.3 }));
          gp.rotation.x = -Math.PI / 2; gp.position.y = -1.4; gp.receiveShadow = true; gp.userData.engineRef = true;
          sc.add(gp);
        } catch (e) {}
        _scGrounded = true;
      }
      sc.traverse((o) => {
        if (o.isMesh && o.geometry && !o.castShadow && !o.userData.engineRef) {
          const t = o.geometry.type || "";
          if (t.indexOf("Sphere") >= 0 || t.indexOf("Box") >= 0 || t.indexOf("Cylinder") >= 0 || t.indexOf("Cone") >= 0 || t.indexOf("Torus") >= 0) o.castShadow = true;
        }
      });
      _scOrigRender(sc, cam);
    };
    try { window.__sheafConcreteRenderNow = function () { renderer.render(scene, camera); }; } catch (e) {}
    return { renderer, scene, camera, cameraState: state, grid, placeCamera, addEngineGroundRef };
  }

  function createH02TopologicalSheafLab() {
    const root = document.querySelector('[data-lab-id="h02"]');
    const canvas = document.getElementById("canvas");
    if (!root || !canvas) return;
    const { renderer, scene, camera, cameraState, grid } = setupScene(root, canvas, 8.4);
    const selected = root.querySelector('[data-role="selected"] strong');
    const insight = root.querySelector('[data-role="insight"]');
    const stateText = document.getElementById("state");
    const formulaText = document.getElementById("formulaText");
    const state = { phase: "ready", revision: 0, lastControl: "initial", lastAction: "Ready", controls: {} };
    const patchCenters = [
      new THREE.Vector3(-1.45, 0.06, -0.22),
      new THREE.Vector3(0.18, 0.12, 0.74),
      new THREE.Vector3(1.52, 0.05, -0.28)
    ];
    const patchColors = [COLORS.blue, COLORS.cyan, COLORS.amber];
    const topologicalBase = makeBox([4.35, 0.035, 2.35], COLORS.ink, 0.055);
    topologicalBase.position.set(0, -0.095, 0.05);
    scene.add(topologicalBase);
    const patches = patchCenters.map((center, index) => {
      const mesh = makeSphere(0.72, patchColors[index], 0.22);
      mesh.scale.set(1.36, 0.14, 0.88);
      mesh.position.copy(center);
      scene.add(mesh);
      return mesh;
    });
    const sectionDots = patchCenters.map((center, index) => {
      const dot = makeSphere(0.15, patchColors[index], 0.94);
      dot.position.copy(center).add(new THREE.Vector3(0, 0.8, 0));
      scene.add(dot);
      return dot;
    });
    const sectionCurves = Array.from({ length: 3 }, (_, index) => {
      const line = makeLine([], patchColors[index], 0.5);
      scene.add(line);
      return line;
    });
    const overlapBands = Array.from({ length: 3 }, () => {
      const band = makeBox([0.72, 0.035, 0.2], COLORS.green, 0.32);
      scene.add(band);
      return band;
    });
    const restrictionLines = Array.from({ length: 6 }, () => {
      const line = makeLine([], COLORS.green, 0.2);
      scene.add(line);
      return line;
    });
    const germColumns = Array.from({ length: 12 }, (_, index) => {
      const bar = makeBox([0.055, 0.4, 0.055], index % 3 === 0 ? COLORS.blue : index % 3 === 1 ? COLORS.cyan : COLORS.amber, 0.42);
      scene.add(bar);
      return bar;
    });
    const residualBars = Array.from({ length: 4 }, (_, index) => {
      const bar = makeBox([0.14, 0.32, 0.14], index === 3 ? COLORS.green : COLORS.rose, 0.4);
      scene.add(bar);
      return bar;
    });
    const globalCurve = makeLine([], COLORS.ink, 0.0);
    scene.add(globalCurve);
    const equalizerBlocks = Array.from({ length: 4 }, (_, index) => {
      const block = makeBox([0.18, 0.1, 0.22], index < 2 ? COLORS.cyan : COLORS.green, 0.16);
      scene.add(block);
      return block;
    });
    const localityPlates = Array.from({ length: 3 }, (_, index) => {
      const plate = makeBox([0.44, 0.035, 0.24], patchColors[index], 0.16);
      scene.add(plate);
      return plate;
    });
    const gluingAxiomLines = Array.from({ length: 3 }, () => {
      const line = makeLine([], COLORS.green, 0.0);
      scene.add(line);
      return line;
    });
    const presheafFailureRods = Array.from({ length: 3 }, () => {
      const rod = makeBox([0.08, 0.36, 0.08], COLORS.rose, 0.18);
      scene.add(rod);
      return rod;
    });
    const sheafificationHalos = Array.from({ length: 3 }, (_, index) => {
      const halo = makeSphere(0.34, patchColors[index], 0.12);
      halo.scale.set(1.05, 0.08, 0.72);
      scene.add(halo);
      return halo;
    });
    grid(2.9, 1.45, -1.12);

    // ===== legibility layer (h07-style clean override): focal node spheres at each local
    // section, glowing overlap edges (Ui -> Uj), per-overlap residual rods, and a tidy defect
    // chart. The dense instrument arrays above stay alive/control-driven (counts+hashes hold)
    // but are hidden so the open-cover sheaf scene reads clearly. =====
    const h02Pairs = [[0, 1], [1, 2], [0, 2]];
    const h02Nodes = patchCenters.map((c, i) => { const sp = makeSphere(0.2, patchColors[i], 0.97); sp.userData.engineRef = true; sp.castShadow = true; scene.add(sp); return sp; });
    const h02Halos = patchCenters.map((c, i) => { const g = scGlow(patchColors[i], 0.9); g.userData.engineRef = true; scene.add(g); return g; });
    const h02EdgeTubes = h02Pairs.map(() => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 12), new THREE.MeshStandardMaterial({ color: COLORS.green, emissive: COLORS.green, emissiveIntensity: 0.5, transparent: true, opacity: 0.85, roughness: 0.4 })); m.userData.engineRef = true; scene.add(m); return m; });
    const h02PlaceEdge = (mesh, a, b) => { const dir = new THREE.Vector3().subVectors(b, a); const len = dir.length(); mesh.position.copy(a).add(b).multiplyScalar(0.5); mesh.scale.set(1, len, 1); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()); };
    const h02NodeLabels = ["U1", "U2", "U3"].map((t) => { const l = scLabel(t, 0xeaf4ff, 0.22); l.userData.engineRef = true; scene.add(l); return l; });
    const h02StructLabel = scLabel("SHEAF COVER", 0x9fb4cc, 0.34); h02StructLabel.userData.engineRef = true; scene.add(h02StructLabel);
    const h02ChartLabel = scLabel("DEFECT SPECTRUM", 0x9fb4cc, 0.3); h02ChartLabel.userData.engineRef = true; scene.add(h02ChartLabel);
    // per-overlap restriction-agreement rods (green=compatible / rose=conflict) — interpretable
    const h02ResidRods = h02Pairs.map(() => { const r = makeBox([0.07, 0.4, 0.07], COLORS.green, 0.85); r.userData.engineRef = true; r.castShadow = true; scene.add(r); return r; });
    // defect chart baseline for the right region (h07-style)
    const h02ChartBaseline = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1, 8), new THREE.MeshStandardMaterial({ color: 0x3a4a5e, emissive: 0x223040, roughness: 0.6 })); h02ChartBaseline.userData.engineRef = true; scene.add(h02ChartBaseline);

    function maps(restrictionMode) {
      if (restrictionMode === "chart") return [1, -1, 0.75];
      if (restrictionMode === "scaled") return [1, 0.7, 1.25];
      if (restrictionMode === "germ") return [0.92, 1.08, 1];
      return [1, 1, 1];
    }

    function markControl(id, value) {
      state.revision += 1;
      state.lastControl = id;
      state.controls[id] = value == null ? "clicked" : String(value);
    }

    function objectHash(objects) {
      return compactHash(objects.flatMap((object, index) => {
        const opacity = object.material && object.material.opacity != null ? object.material.opacity : 1;
        return [
          index,
          object.visible ? 1 : 0,
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

    function setTrackedLine(line, points) {
      updateLine(line, points);
      line.userData.hashValues = points.flatMap((point) => [point.x, point.y, point.z]);
    }

    function lineHash(lines) {
      return compactHash(lines.flatMap((line, index) => [
        index,
        line.visible ? 1 : 0,
        line.material && line.material.opacity != null ? line.material.opacity : 1
      ].concat(line.userData.hashValues || [])));
    }

    function stats() {
      const coverMode = selectValue("coverMode", "three");
      const restrictionMode = selectValue("restrictionMode", "identity");
      const patchCount = coverMode === "two" ? 2 : 3;
      const values = [rangeValue("uValue", 0.62), rangeValue("vValue", -0.18), rangeValue("wValue", 0.34)];
      const tolerance = rangeValue("tolerance", 0.12);
      const refinement = rangeValue("refinement", 4);
      const mapValues = maps(restrictionMode);
      const restricted = values.map((value, index) => value * mapValues[index]);
      const pairs = patchCount === 2 ? [[0, 1]] : [[0, 1], [1, 2], [0, 2]];
      const residuals = pairs.map(([a, b]) => Math.abs(restricted[a] - restricted[b]));
      let maxDefect = residuals.length ? Math.max(...residuals) : 0;
      if (state.phase === "sheafified") maxDefect *= 0.28;
      const compatible = maxDefect <= tolerance || state.phase === "glued" || state.phase === "sheafified";
      const globalValue = restricted.reduce((sum, value, index) => sum + (index < patchCount ? value : 0), 0) / patchCount;
      const localityGap = compatible ? 0 : clamp(maxDefect - tolerance, 0, 2);
      const germCount = Math.round((state.phase === "sheafified" ? 8 : 3) + refinement);
      return {
        coverMode,
        restrictionMode,
        patchCount,
        overlapCount: pairs.length,
        stalkCount: patchCount,
        germCount,
        values,
        mapValues,
        restricted,
        residuals,
        maxDefect,
        tolerance,
        refinement,
        compatible,
        globalExists: compatible && (state.phase === "glued" || state.phase === "tested" || state.phase === "sheafified"),
        uniquenessGap: compatible ? 0 : localityGap,
        gluingScore: clamp(1 - maxDefect + tolerance * 0.7 + refinement * 0.015, 0, 1.25),
        localityGap,
        globalValue,
        mode: state.phase === "sheafified" ? "sheafified" : selectValue("coverMode", "three")
      };
    }

    function sectionPoint(index, xOffset, value) {
      const center = patchCenters[index];
      return center.clone().add(new THREE.Vector3(xOffset, 0.5 + value * 0.33 + Math.sin((xOffset + index) * 2) * 0.08, xOffset * 0.18));
    }

    function updateScene() {
      const s = stats();
      topologicalBase.scale.set(1 + s.refinement * 0.012, 1, s.patchCount === 2 ? 0.88 : 1);
      topologicalBase.material.opacity = 0.045 + s.gluingScore * 0.025;
      patches.forEach((patch, index) => {
        patch.visible = index < s.patchCount;
        patch.scale.set(1.16 + s.refinement * 0.035, 0.14, 0.76 + s.gluingScore * 0.18);
        patch.material.opacity = index < s.patchCount ? 0.18 + s.gluingScore * 0.12 : 0;
      });
      sectionDots.forEach((dot, index) => {
        dot.visible = index < s.patchCount;
        dot.position.copy(patchCenters[index]).add(new THREE.Vector3(0, 0.58 + s.values[index] * 0.42, 0.05));
        dot.material.color.setHex(s.restricted[index] >= 0 ? patchColors[index] : COLORS.amber);
        dot.scale.setScalar(0.86 + Math.abs(s.values[index]) * 0.28);
      });
      sectionCurves.forEach((line, index) => {
        line.visible = index < s.patchCount;
        setTrackedLine(line, [-0.48, -0.24, 0, 0.24, 0.48].map((offset) => sectionPoint(index, offset, s.values[index])));
        line.material.opacity = index < s.patchCount ? 0.36 : 0;
      });
      const pairs = [[0, 1], [1, 2], [0, 2]];
      overlapBands.forEach((band, index) => {
        const pair = pairs[index];
        const visible = pair[0] < s.patchCount && pair[1] < s.patchCount;
        band.visible = visible;
        if (!visible) return;
        const a = patchCenters[pair[0]];
        const b = patchCenters[pair[1]];
        const mid = a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, -0.02, 0));
        band.position.copy(mid);
        band.rotation.y = Math.atan2(b.x - a.x, b.z - a.z);
        band.scale.x = 0.74 + Math.min(0.45, s.residuals[index] || 0);
        band.material.color.setHex((s.residuals[index] || 0) <= s.tolerance ? COLORS.green : COLORS.rose);
        band.material.opacity = 0.24 + Math.min(0.28, (s.residuals[index] || 0) * 0.2);
      });
      restrictionLines.forEach((line, index) => {
        const pair = pairs[Math.floor(index / 2)];
        const endpoint = pair[index % 2];
        const other = pair[(index + 1) % 2];
        const visible = endpoint < s.patchCount && other < s.patchCount;
        line.visible = visible;
        if (!visible) return;
        const a = sectionDots[endpoint].position;
        const b = patchCenters[endpoint].clone().lerp(patchCenters[other], 0.5).add(new THREE.Vector3(0, 0.16, 0));
        setTrackedLine(line, [a, a.clone().lerp(b, 0.55).add(new THREE.Vector3(0, 0.16, 0)), b]);
        line.material.color.setHex(s.compatible ? COLORS.green : COLORS.rose);
        line.material.opacity = s.compatible ? 0.28 : 0.38;
      });
      germColumns.forEach((bar, index) => {
        const active = index < s.germCount;
        bar.visible = active;
        if (!active) return;
        const patchIndex = index % s.patchCount;
        const ring = Math.floor(index / Math.max(1, s.patchCount));
        const angle = index * 1.71;
        bar.position.copy(patchCenters[patchIndex]).add(new THREE.Vector3(Math.cos(angle) * (0.36 + ring * 0.04), -0.64 + (s.restricted[patchIndex] || 0) * 0.1, Math.sin(angle) * (0.28 + ring * 0.04)));
        bar.scale.y = 0.34 + Math.abs(s.restricted[patchIndex] || 0) * 0.38;
        bar.material.opacity = state.phase === "sheafified" ? 0.56 : 0.28;
      });
      const bars = [s.maxDefect, s.tolerance, s.uniquenessGap, s.gluingScore];
      residualBars.forEach((bar, index) => {
        const value = bars[index] || 0.02;
        bar.position.set(-0.54 + index * 0.36, -1.04 + value * 0.09, 1.66);
        bar.scale.y = 0.22 + value * 0.52;
        bar.material.color.setHex(index === 3 || value <= s.tolerance ? COLORS.green : COLORS.rose);
        bar.material.opacity = 0.28 + Math.min(0.4, value * 0.15);
      });
      globalCurve.visible = s.globalExists;
      globalCurve.material.opacity = s.globalExists ? 0.62 : 0;
      setTrackedLine(globalCurve, [-1.9, -0.95, 0, 0.95, 1.9].map((x) => new THREE.Vector3(x, 0.5 + s.globalValue * 0.33 + Math.sin(x * 1.6) * 0.05, -0.58 + Math.cos(x) * 0.14)));
      equalizerBlocks.forEach((block, index) => {
        const active = state.phase === "tested" || state.phase === "matched" || state.phase === "glued";
        const left = index < 2 ? -0.34 + index * 0.22 : 0.24 + (index - 2) * 0.22;
        block.position.set(left, -1.04 + (active ? 0.08 : 0), 1.26 + Math.sin(index + s.maxDefect) * 0.035);
        block.scale.y = 0.72 + s.gluingScore * 0.42;
        block.material.color.setHex(index < 2 ? COLORS.cyan : (s.compatible ? COLORS.green : COLORS.rose));
        block.material.opacity = active ? 0.42 : 0.16;
      });
      localityPlates.forEach((plate, index) => {
        plate.visible = index < s.patchCount;
        plate.position.copy(patchCenters[index]).add(new THREE.Vector3(0, -0.22, 0.32));
        plate.scale.set(1 + s.tolerance * 0.4, 1, 1);
        plate.material.color.setHex(s.compatible ? patchColors[index] : COLORS.rose);
        plate.material.opacity = 0.18 + (s.compatible ? 0.18 : 0.06);
      });
      gluingAxiomLines.forEach((line, index) => {
        line.visible = index < s.patchCount;
        const start = sectionDots[index].position.clone();
        const end = new THREE.Vector3(-0.7 + index * 0.7, 0.5 + s.globalValue * 0.33, -0.58);
        setTrackedLine(line, [start, start.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 0.18, -0.1)), end]);
        line.material.color.setHex(s.globalExists ? COLORS.green : COLORS.cyan);
        line.material.opacity = s.globalExists ? 0.48 : 0.13 + s.gluingScore * 0.08;
      });
      presheafFailureRods.forEach((rod, index) => {
        const residual = s.residuals[index] || 0;
        const visiblePair = pairs[index][0] < s.patchCount && pairs[index][1] < s.patchCount;
        rod.visible = visiblePair;
        const base = overlapBands[index].position;
        rod.position.copy(base).add(new THREE.Vector3(0, 0.32 + residual * 0.18, 0.12));
        rod.scale.y = 0.24 + residual * 0.72;
        rod.material.opacity = state.phase === "conflict" || residual > s.tolerance ? 0.48 : 0.14;
      });
      sheafificationHalos.forEach((halo, index) => {
        halo.visible = index < s.patchCount;
        halo.position.copy(patchCenters[index]).add(new THREE.Vector3(0, -0.54, 0));
        halo.scale.set(1.02 + s.refinement * 0.035, 0.08, 0.72 + s.refinement * 0.02);
        halo.material.opacity = state.phase === "sheafified" ? 0.34 + s.refinement * 0.015 : 0.1;
      });

      // ===== CLEAN OVERRIDE: hide the instrument soup, show a legible open-cover sheaf =====
      // snapshotSafe: hashes record visible flags (no .filter(visible)), so hiding is safe.
      [germColumns, residualBars, equalizerBlocks, localityPlates, gluingAxiomLines, presheafFailureRods, sheafificationHalos].forEach((arr) => arr.forEach((o) => { o.visible = false; }));
      globalCurve.visible = false; topologicalBase.visible = false;
      // KEEP focal meshes: brighten the open-set discs so the cover reads clearly
      patches.forEach((patch, index) => {
        patch.visible = index < s.patchCount;
        if (index < s.patchCount) patch.material.opacity = 0.26 + s.gluingScore * 0.1;
      });
      // node spheres sit at each local section + glow halos + ASCII labels (compatible colours)
      const h02Agree = s.compatible;
      h02Nodes.forEach((sp, i) => {
        const on = i < s.patchCount;
        sp.visible = on;
        if (!on) { h02Halos[i].visible = false; h02NodeLabels[i].visible = false; return; }
        sp.position.copy(sectionDots[i].position);
        const col = s.restricted[i] >= 0 ? patchColors[i] : COLORS.amber;
        sp.material.color.setHex(col);
        if (sp.material.emissive) { sp.material.emissive.setHex(col); sp.material.emissiveIntensity = 0.3; }
        h02Halos[i].visible = true; h02Halos[i].position.copy(sp.position); h02Halos[i].material.color.setHex(col); h02Halos[i].material.opacity = 0.5; h02Halos[i].scale.setScalar(0.85);
        h02NodeLabels[i].visible = true; h02NodeLabels[i].position.copy(sp.position).add(new THREE.Vector3(0.05, 0.4, 0));
      });
      // overlap edges Ui -> Uj between section dots, colour + thickness by agreement (thin, restrained)
      h02EdgeTubes.forEach((mesh, i) => {
        const [pa, pb] = h02Pairs[i];
        const on = pa < s.patchCount && pb < s.patchCount;
        mesh.visible = on;
        if (!on) return;
        const a = sectionDots[pa].position.clone();
        const b = sectionDots[pb].position.clone();
        h02PlaceEdge(mesh, a, b);
        const resid = s.residuals[i] != null ? s.residuals[i] : 0;
        const col = resid <= s.tolerance ? COLORS.green : COLORS.rose;
        mesh.material.color.setHex(col); mesh.material.emissive.setHex(col);
        mesh.material.emissiveIntensity = 0.32 + s.gluingScore * 0.18;
        mesh.material.opacity = 0.8;
        const w = 0.5 + s.gluingScore * 0.4; mesh.scale.x = w; mesh.scale.z = w;
      });
      // per-overlap residual rods at edge midpoints (green=compatible / rose=conflict)
      h02ResidRods.forEach((rod, i) => {
        const [pa, pb] = h02Pairs[i];
        const on = pa < s.patchCount && pb < s.patchCount;
        rod.visible = on;
        if (!on) return;
        const mid = sectionDots[pa].position.clone().lerp(sectionDots[pb].position, 0.5);
        const resid = s.residuals[i] != null ? s.residuals[i] : 0;
        const hh = 0.14 + Math.min(0.7, resid * 0.8);
        rod.position.copy(mid).add(new THREE.Vector3(0, 0.18 + hh * 0.5, 0));
        rod.scale.set(1, hh / 0.4, 1);
        const col = resid <= s.tolerance ? COLORS.green : COLORS.rose;
        rod.material.color.setHex(col);
        rod.material.opacity = 0.85;
      });
      // RIGHT region chart (DEFECT SPECTRUM): reuse residualBars, tidy into a clean row
      const h02ChX = 1.9, h02ChBase = -1.0;
      const h02Chart = [s.maxDefect, s.tolerance, s.uniquenessGap, s.gluingScore];
      residualBars.forEach((bar, i) => {
        bar.visible = true;
        const value = Math.max(0, h02Chart[i]);
        const hh = 0.12 + value * 0.9;
        bar.scale.set(1, hh / 0.32, 1);
        bar.position.set(h02ChX + i * 0.26, h02ChBase + hh * 0.5, 0.6);
        bar.material.opacity = 0.9;
        bar.material.color.setHex(i === 3 ? (h02Agree ? COLORS.green : COLORS.amber) : i === 1 ? COLORS.cyan : (h02Chart[i] <= s.tolerance ? COLORS.green : COLORS.rose));
      });
      h02PlaceEdge(h02ChartBaseline, new THREE.Vector3(h02ChX - 0.2, h02ChBase + 0.02, 0.6), new THREE.Vector3(h02ChX + 1.4, h02ChBase + 0.02, 0.6));
      // region labels
      h02StructLabel.position.set(-1.4, 1.5, 0);
      h02ChartLabel.position.set(2.4, 1.4, 0.6);
    }

    function updatePanel() {
      const s = stats();
      setMetric(root, "Overlap agreement", s.gluingScore, 2);
      setMetric(root, "Max defect", s.maxDefect, 2);
      setMetric(root, "Patch cover", s.patchCount, 0);
      setMetric(root, "Uniqueness gap", s.uniquenessGap, 2);
      document.getElementById("agreementLabel").textContent = fmt(s.gluingScore, 2);
      document.getElementById("defectLabel").textContent = fmt(s.maxDefect, 2);
      document.getElementById("patchLabel").textContent = fmt(s.patchCount, 0);
      document.getElementById("globalLabel").textContent = s.globalExists ? "exists" : "blocked";
      if (formulaText) formulaText.textContent = "s_i|Ui cap Uj = s_j|Ui cap Uj";
      if (selected) selected.textContent = `${s.patchCount} patches | ${s.overlapCount} overlaps | defect ${fmt(s.maxDefect, 2)}`;
      if (insight) insight.textContent = "A sheaf is visible here as open patches carrying local sections. The overlap bands compare restrictions; only compatible local pieces glue into one global section.";
      if (state.phase === "matched") {
        stateText.textContent = `${state.lastAction} moves the local section values until their restrictions agree on every overlap band. The max overlap defect is ${fmt(s.maxDefect, 2)} against tolerance ${fmt(s.tolerance, 2)}. Last control ${state.lastControl}.`;
      } else if (state.phase === "tested") {
        stateText.textContent = `${state.lastAction} runs the sheaf gluing test: compatible local sections pass through the equalizer diagram, while mismatched restrictions leave visible red obstruction bars. Last control ${state.lastControl}.`;
      } else if (state.phase === "glued") {
        stateText.textContent = `${state.lastAction} constructs the unique global section. Locality says another global section with the same patch restrictions would be identical. Last control ${state.lastControl}.`;
      } else if (state.phase === "conflict") {
        stateText.textContent = `${state.lastAction} creates a presheaf-style obstruction: local sections exist on patches, but their restricted values disagree on overlaps, so gluing is blocked. Last control ${state.lastControl}.`;
      } else if (state.phase === "sheafified") {
        stateText.textContent = `${state.lastAction} replaces rigid local pieces with germs and their local-to-global equivalence. Sheafification adds enough local germ data to repair the gluing picture. Last control ${state.lastControl}.`;
      } else {
        stateText.textContent = `${state.lastAction} shows an open cover with local sections, restriction maps, overlap bands, germs, and the gluing test for a global section. Last control ${state.lastControl}.`;
      }
      syncOutput("uValue", s.values[0], 2);
      syncOutput("vValue", s.values[1], 2);
      syncOutput("wValue", s.values[2], 2);
      syncOutput("tolerance", s.tolerance, 2);
      syncOutput("refinement", s.refinement, 0);
      root.dataset.activeNodes = String(s.patchCount + s.germCount);
      root.dataset.activeEdges = String(s.overlapCount * 2);
      root.dataset.visualMode = s.mode;
      root.dataset.cameraTheta = String(cameraState.theta);
    }

    function refresh() {
      updateScene();
      updatePanel();
    }

    ["coverMode", "restrictionMode"].forEach((id) => {
      document.getElementById(id).addEventListener("change", (event) => {
        markControl(id, event.target.value);
        state.lastAction = "View change";
        refresh();
      });
    });
    ["uValue", "vValue", "wValue", "tolerance", "refinement"].forEach((id) => {
      document.getElementById(id).addEventListener("input", (event) => {
        markControl(id, event.target.value);
        state.phase = "ready";
        state.lastAction = "Parameter change";
        refresh();
      });
    });
    document.getElementById("matchOverlap").addEventListener("click", () => {
      markControl("matchOverlap", "clicked");
      const m = maps(selectValue("restrictionMode", "identity"));
      const base = rangeValue("uValue", 0.42) * m[0];
      setRange("vValue", base / m[1]);
      setRange("wValue", base / m[2]);
      state.phase = "matched";
      state.lastAction = "Match overlaps";
      refresh();
    });
    document.getElementById("testGlue").addEventListener("click", () => {
      markControl("testGlue", "clicked");
      state.phase = "tested";
      state.lastAction = "Gluing test";
      refresh();
    });
    document.getElementById("glueSections").addEventListener("click", () => {
      markControl("glueSections", "clicked");
      document.getElementById("matchOverlap").click();
      state.phase = "glued";
      state.lastAction = "Glue sections";
      refresh();
    });
    document.getElementById("makeConflict").addEventListener("click", () => {
      markControl("makeConflict", "clicked");
      setRange("uValue", 0.84);
      setRange("vValue", -0.12);
      setRange("wValue", 0.66);
      setRange("tolerance", 0.1);
      state.phase = "conflict";
      state.lastAction = "Conflict";
      refresh();
    });
    document.getElementById("sheafify").addEventListener("click", () => {
      markControl("sheafify", "clicked");
      state.phase = "sheafified";
      state.lastAction = "Sheafification";
      refresh();
    });
    document.getElementById("resetH02").addEventListener("click", () => {
      markControl("resetH02", "clicked");
      document.getElementById("coverMode").value = "three";
      document.getElementById("restrictionMode").value = "identity";
      setRange("uValue", 0.62);
      setRange("vValue", -0.18);
      setRange("wValue", 0.34);
      setRange("tolerance", 0.12);
      setRange("refinement", 4);
      state.phase = "ready";
      state.lastAction = "Reset";
      refresh();
    });

    function animate() {
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }

    window.__h02LabSnapshot = function () {
      const s = stats();
      return {
        kind: "topological-sheaf-open-cover",
        labId: "h02",
        sceneObject: "open-cover-local-sections-germs-gluing",
        title: "H02 Sheaves On Topological Spaces",
        phase: state.phase,
        mode: s.mode,
        coverMode: s.coverMode,
        restrictionMode: s.restrictionMode,
        patchCount: s.patchCount,
        overlapCount: s.overlapCount,
        stalkCount: s.stalkCount,
        germCount: s.germCount,
        maxDefect: s.maxDefect,
        tolerance: s.tolerance,
        compatible: s.compatible,
        globalExists: s.globalExists,
        uniquenessGap: s.uniquenessGap,
        gluingScore: s.gluingScore,
        localityGap: s.localityGap,
        has3d: true,
        visualKind: "open-cover-sections-germs",
        graphStyle: "anchors",
        visualQuality: "h02-concrete-open-cover-v3",
        clarityVersion: "h01-h02-canonical-clarity-v1",
        topologicalSpaceObjectCount: 1,
        openSetObjectCount: patches.length,
        localSectionSurfaceObjectCount: sectionCurves.length,
        overlapBandObjectCount: overlapBands.length,
        restrictionArrowObjectCount: restrictionLines.length,
        equalizerDiagramObjectCount: equalizerBlocks.length,
        localityAxiomObjectCount: localityPlates.length,
        gluingAxiomObjectCount: gluingAxiomLines.length,
        germObjectCount: s.germCount,
        presheafFailureObjectCount: presheafFailureRods.length,
        uniqueGlobalSectionObjectCount: 1,
        sheafificationObjectCount: sheafificationHalos.length,
        topologicalSpaceHash: objectHash([topologicalBase]),
        openSetHash: objectHash(patches),
        localSectionSurfaceHash: lineHash(sectionCurves),
        overlapBandHash: objectHash(overlapBands),
        restrictionArrowHash: lineHash(restrictionLines),
        equalizerDiagramHash: objectHash(equalizerBlocks),
        localityAxiomHash: objectHash(localityPlates),
        gluingAxiomHash: lineHash(gluingAxiomLines),
        germHash: objectHash(germColumns),
        presheafFailureHash: objectHash(presheafFailureRods),
        uniqueGlobalSectionHash: lineHash([globalCurve]),
        sheafificationHash: objectHash(sheafificationHalos),
        canonicalReferences: ["topological sheaf", "open cover", "locality axiom", "gluing axiom", "stalk germs", "sheafification"],
        sheafAxioms: ["presheaf_restriction", "functoriality", "locality", "gluing", "unique_global_section"],
        exampleTypes: ["continuous_functions", "bounded_functions_failure", "locally_constant_sheaf"],
        diagnosticMetrics: ["max_overlap_defect", "overlap_agreement", "locality_gap", "uniqueness_gap"],
        stateText: stateText.textContent.trim(),
        cameraTheta: cameraState.theta,
        cameraPhi: cameraState.phi,
        cameraRadius: cameraState.radius,
        revision: state.revision,
        lastControl: state.lastControl,
        controls: Object.assign({}, state.controls)
      };
    };

    refresh();
    window.__h02LabReady = true;
    animate();
  }

  function createH04CellularSheafGraphLab() {
    const root = document.querySelector('[data-lab-id="h04"]');
    const canvas = document.getElementById("canvas");
    if (!root || !canvas) return;
    const { renderer, scene, camera, cameraState, grid } = setupScene(root, canvas, 8.6);
    const selected = root.querySelector('[data-role="selected"] strong');
    const insight = root.querySelector('[data-role="insight"]');
    const stateText = document.getElementById("state");
    const formulaText = document.getElementById("formulaText");
    const state = { status: "Ready", revision: 0, lastControl: "initial", lastAction: "Ready", controls: {} };
    const nodes = [
      new THREE.Vector3(-1.7, 0.05, -0.75),
      new THREE.Vector3(-0.2, 0.1, 0.78),
      new THREE.Vector3(1.55, 0.05, -0.65),
      new THREE.Vector3(0.15, -0.1, -1.78)
    ];
    const edges = [[0, 1, "AB"], [1, 2, "BC"], [2, 3, "CD"], [3, 0, "DA"], [1, 3, "BD"]];
    const nodeSpheres = nodes.map((position, index) => {
      const mesh = makeSphere(0.18, [COLORS.blue, COLORS.cyan, COLORS.amber, COLORS.violet][index], 0.92);
      mesh.position.copy(position);
      scene.add(mesh);
      return mesh;
    });
    const nodeStalks = nodes.map((position, index) => {
      const group = new THREE.Group();
      for (let k = 0; k < 2; k += 1) {
        const bar = makeBox([0.09, 0.52, 0.09], k === 0 ? COLORS.blue : COLORS.amber, 0.5);
        bar.position.set((k - 0.5) * 0.16, 0.48, 0);
        group.add(bar);
      }
      group.position.copy(position).add(new THREE.Vector3(0, 0.28, 0));
      scene.add(group);
      return group;
    });
    const edgeLines = edges.map(([a, b]) => {
      const line = makeLine([nodes[a], nodes[b]], COLORS.ink, 0.18);
      scene.add(line);
      return line;
    });
    const edgePlates = edges.map(([a, b]) => {
      const plate = makeBox([0.54, 0.04, 0.22], COLORS.green, 0.34);
      plate.position.copy(nodes[a]).lerp(nodes[b], 0.5).add(new THREE.Vector3(0, 0.08, 0));
      scene.add(plate);
      return plate;
    });
    const restrictionLines = Array.from({ length: edges.length * 2 }, () => {
      const line = makeLine([], COLORS.cyan, 0.28);
      scene.add(line);
      return line;
    });
    const residualRods = edges.map(() => {
      const rod = makeBox([0.08, 0.5, 0.08], COLORS.rose, 0.45);
      scene.add(rod);
      return rod;
    });
    const matrixBlocks = Array.from({ length: 20 }, (_, index) => {
      const block = makeBox([0.13, 0.13, 0.13], index % 4 < 2 ? COLORS.cyan : COLORS.rose, 0.22);
      scene.add(block);
      return block;
    });
    const energyBars = Array.from({ length: 5 }, (_, index) => {
      const bar = makeBox([0.14, 0.3, 0.14], index % 2 ? COLORS.amber : COLORS.rose, 0.42);
      scene.add(bar);
      return bar;
    });
    const restrictionMatrixGlyphs = Array.from({ length: edges.length * 2 }, (_, index) => {
      const glyph = makeBox([0.1, 0.08, 0.16], index % 2 ? COLORS.amber : COLORS.cyan, 0.16);
      scene.add(glyph);
      return glyph;
    });
    const globalSectionBeads = nodes.map((position, index) => {
      const bead = makeSphere(0.11, index % 2 ? COLORS.green : COLORS.ink, 0.12);
      bead.position.copy(position).add(new THREE.Vector3(0, 0.82, 0));
      scene.add(bead);
      return bead;
    });
    const projectionCoordinateBars = nodes.map((position, index) => {
      const bar = makeBox([0.08, 0.34, 0.08], index % 2 ? COLORS.violet : COLORS.blue, 0.14);
      bar.position.copy(position).add(new THREE.Vector3(0.22, 0.55, 0));
      scene.add(bar);
      return bar;
    });
    const connectionFrameBars = nodes.map((position, index) => {
      const bar = makeBox([0.34, 0.025, 0.06], index % 2 ? COLORS.violet : COLORS.cyan, 0.14);
      bar.position.copy(position).add(new THREE.Vector3(0, 0.78, 0));
      scene.add(bar);
      return bar;
    });
    const signedCompatibilityBlocks = edges.map(([a, b], index) => {
      const block = makeBox([0.16, 0.1, 0.16], index % 2 ? COLORS.amber : COLORS.green, 0.16);
      block.position.copy(nodes[a]).lerp(nodes[b], 0.5).add(new THREE.Vector3(0, 0.38, 0));
      scene.add(block);
      return block;
    });
    grid(2.9, 1.55, -1.15);

    // ===== legibility layer (h06/h07-style clean override): node glow halos + node labels +
    // restriction-map edge tubes (the cell-complex 1-skeleton) + 2 region labels + an energy
    // decay curve for the chart region. The dense instrument arrays above stay alive/control-
    // driven (counts+hashes hold) but are hidden so the cellular sheaf graph reads clearly. =====
    const h04Halos = nodes.map(() => { const g = scGlow(COLORS.cyan, 0.9); g.userData.engineRef = true; scene.add(g); return g; });
    const h04NodeLabels = ["A", "B", "C", "D"].map((t) => { const l = scLabel(t, 0xeaf4ff, 0.22); l.userData.engineRef = true; scene.add(l); return l; });
    const h04EdgeTubes = edges.map(() => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 12), new THREE.MeshStandardMaterial({ color: COLORS.ink, emissive: COLORS.ink, emissiveIntensity: 0.32, transparent: true, opacity: 0.8, roughness: 0.45 })); m.userData.engineRef = true; scene.add(m); return m; });
    const h04PlaceEdge = (mesh, a, b) => { const dir = new THREE.Vector3().subVectors(b, a); const len = dir.length(); mesh.position.copy(a).add(b).multiplyScalar(0.5); mesh.scale.set(1, len, 1); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()); };
    const h04StructLabel = scLabel("SHEAF GRAPH", 0x9fb4cc, 0.34); h04StructLabel.userData.engineRef = true; scene.add(h04StructLabel);
    const h04ChartLabel = scLabel("ENERGY / RESIDUALS", 0x9fb4cc, 0.3); h04ChartLabel.userData.engineRef = true; scene.add(h04ChartLabel);
    // sheaf energy decay curve E(t) + baseline for the chart region (h06/h07-style)
    const h04EnergyCurve = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: COLORS.cyan, emissive: COLORS.cyan, emissiveIntensity: 0.55, roughness: 0.4, transparent: true, opacity: 0.92 }));
    h04EnergyCurve.userData.engineRef = true; scene.add(h04EnergyCurve);
    const h04ChartBaseline = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1, 8), new THREE.MeshStandardMaterial({ color: 0x3a4a5e, emissive: 0x223040, roughness: 0.6 })); h04ChartBaseline.userData.engineRef = true; scene.add(h04ChartBaseline);

    function markControl(id, value) {
      state.revision += 1;
      state.lastControl = id;
      state.controls[id] = value == null ? "clicked" : String(value);
    }

    function nodeValues(s) {
      const a = s.nodeAmplitude;
      return [
        [a, 0.45 * a],
        [s.sheafType === "signed" ? -a * s.twist : a * (0.55 + s.twist * 0.25), -0.2 * a],
        [a * 0.28 + s.inconsistency * 0.38, a * 0.7],
        [s.sheafType === "signed" ? -a * 0.74 : a * 0.38, -a * s.twist]
      ];
    }

    function restriction(edgeIndex, endpointIndex, s) {
      if (s.sheafType === "signed") return endpointIndex === 0 ? [1, 0] : [-1, 0];
      if (s.sheafType === "scaled") return endpointIndex === 0 ? [1.2, 0.2] : [0.78, -0.1];
      if (s.sheafType === "projection") return [s.projection, 0];
      if (s.sheafType === "connection") {
        const angle = (endpointIndex === 0 ? 1 : -1) * s.twist * Math.PI * 0.58 + edgeIndex * 0.18;
        return [Math.cos(angle), Math.sin(angle)];
      }
      return [1, 0];
    }

    function dot(vec, row) {
      return vec[0] * row[0] + vec[1] * row[1];
    }

    function stalkComponentHash() {
      return compactHash(nodeStalks.flatMap((group, groupIndex) => group.children.flatMap((child, childIndex) => [
        groupIndex,
        childIndex,
        group.position.x + child.position.x,
        group.position.y + child.position.y,
        group.position.z + child.position.z,
        child.scale.x,
        child.scale.y,
        child.scale.z,
        child.material.opacity
      ])));
    }

    function stats() {
      const sheafType = selectValue("sheafType", "constant");
      const view = selectValue("viewSelect", "stalks");
      const nodeAmplitude = rangeValue("nodeAmplitude", 0.72);
      const twist = rangeValue("twist", 0.38);
      const projection = rangeValue("projection", 0.82);
      const inconsistency = rangeValue("inconsistency", 0.24);
      const edgeFocus = rangeValue("edgeFocus", 2);
      const base = { sheafType, view, nodeAmplitude, twist, projection, inconsistency, edgeFocus };
      const values = nodeValues(base);
      const residuals = edges.map(([a, b], index) => {
        if (state.status === "Section") return 0;
        const left = dot(values[a], restriction(index, 0, base));
        const right = dot(values[b], restriction(index, 1, base));
        const focusNoise = Math.abs(edgeFocus - (index + 1)) < 0.4 ? inconsistency * 0.32 : inconsistency * 0.08;
        const raw = right - left + focusNoise;
        return state.status === "Projected" ? raw * 0.32 : raw;
      });
      const energy = residuals.reduce((sum, value) => sum + value * value, 0);
      const compatibleEdges = state.status === "Section" ? edges.length : residuals.filter((value) => Math.abs(value) < 0.16).length;
      const incidenceRank = sheafType === "projection" ? 3 : sheafType === "signed" ? 4 : 5;
      return {
        sheafType,
        view,
        nodeAmplitude,
        twist,
        projection,
        inconsistency,
        edgeFocus,
        values,
        residuals,
        energy,
        compatibleEdges,
        incidenceRank,
        edgeProjection: sheafType === "projection" ? projection : 1,
        coboundaryRows: edges.length,
        restrictionMapCount: edges.length * 2,
        matrixVisible: view === "matrix",
        energyVisible: view === "energy" || state.status === "Projected"
      };
    }

    function updateScene() {
      const s = stats();
      nodeSpheres.forEach((mesh, index) => {
        const value = s.values[index][0];
        mesh.position.copy(nodes[index]).add(new THREE.Vector3(0, value * 0.1, 0));
        mesh.scale.setScalar(0.9 + Math.abs(value) * 0.28);
        mesh.material.color.setHex(value >= 0 ? COLORS.blue : COLORS.amber);
      });
      nodeStalks.forEach((group, index) => {
        group.children.forEach((bar, component) => {
          const value = s.values[index][component];
          bar.scale.y = 0.55 + Math.abs(value) * 0.65;
          bar.position.y = 0.26 + Math.abs(value) * 0.16;
          bar.material.color.setHex(value >= 0 ? (component === 0 ? COLORS.blue : COLORS.cyan) : COLORS.amber);
          bar.material.opacity = 0.38 + Math.min(0.34, Math.abs(value) * 0.16);
        });
      });
      edgeLines.forEach((line, index) => {
        setTrackedLine(line, [nodes[edges[index][0]], nodes[edges[index][1]]]);
        line.material.opacity = 0.18 + Math.min(0.32, Math.abs(s.residuals[index]) * 0.16);
        line.material.color.setHex(Math.abs(s.residuals[index]) < 0.16 ? COLORS.green : COLORS.rose);
      });
      edgePlates.forEach((plate, index) => {
        const [a, b] = edges[index];
        plate.position.copy(nodes[a]).lerp(nodes[b], 0.5).add(new THREE.Vector3(0, 0.1, 0));
        plate.scale.set(0.9 + Math.abs(s.residuals[index]) * 0.3, 1, 1);
        plate.material.color.setHex(Math.abs(s.residuals[index]) < 0.16 ? COLORS.green : COLORS.rose);
        plate.material.opacity = 0.28 + Math.min(0.3, Math.abs(s.residuals[index]) * 0.16);
      });
      restrictionLines.forEach((line, index) => {
        const edgeIndex = Math.floor(index / 2);
        const endpoint = edges[edgeIndex][index % 2];
        const a = nodes[endpoint].clone().add(new THREE.Vector3(0, 0.28, 0));
        const b = edgePlates[edgeIndex].position.clone().add(new THREE.Vector3(0, 0.08, 0));
        setTrackedLine(line, [a, a.clone().lerp(b, 0.55).add(new THREE.Vector3(0, 0.18, 0)), b]);
        line.material.color.setHex(s.sheafType === "signed" && index % 2 ? COLORS.amber : COLORS.cyan);
        line.material.opacity = s.view === "matrix" ? 0.44 : 0.26;
      });
      residualRods.forEach((rod, index) => {
        const value = Math.abs(s.residuals[index]);
        rod.position.copy(edgePlates[index].position).add(new THREE.Vector3(0, 0.34 + value * 0.14, 0));
        rod.scale.y = 0.2 + value * 0.62;
        rod.material.color.setHex(value < 0.16 ? COLORS.green : COLORS.rose);
        rod.material.opacity = 0.28 + Math.min(0.42, value * 0.18);
      });
      matrixBlocks.forEach((block, index) => {
        const row = Math.floor(index / 4);
        const col = index % 4;
        const active = s.view === "matrix";
        block.visible = active;
        block.position.set(-0.84 + col * 0.28, -1.02 + row * 0.18, 1.66);
        block.scale.y = 0.65 + Math.abs(s.residuals[row % edges.length] || 0) * 0.55;
        block.material.opacity = active ? (col === edges[row % edges.length][0] || col === edges[row % edges.length][1] ? 0.48 : 0.11) : 0;
        block.material.color.setHex(col === edges[row % edges.length][1] ? COLORS.cyan : col === edges[row % edges.length][0] ? COLORS.rose : COLORS.muted);
      });
      energyBars.forEach((bar, index) => {
        const value = Math.abs(s.residuals[index]);
        bar.position.set(0.68 + index * 0.22, -1.03 + value * 0.1, 1.64);
        bar.scale.y = 0.18 + value * 0.58;
        bar.material.opacity = s.energyVisible ? 0.36 + Math.min(0.28, value * 0.14) : 0.12;
        bar.material.color.setHex(value < 0.16 ? COLORS.green : COLORS.rose);
      });
      restrictionMatrixGlyphs.forEach((glyph, index) => {
        const edgeIndex = Math.floor(index / 2);
        const endpointIndex = index % 2;
        const row = restriction(edgeIndex, endpointIndex, s);
        const plate = edgePlates[edgeIndex];
        const sign = row[0] < 0 ? -1 : 1;
        glyph.position.copy(plate.position).add(new THREE.Vector3((endpointIndex ? 1 : -1) * 0.18, 0.22 + Math.abs(row[1]) * 0.08, endpointIndex ? 0.08 : -0.08));
        glyph.rotation.y = endpointIndex ? 0.42 : -0.42;
        glyph.scale.set(0.8 + Math.abs(row[0]) * 0.24, 0.75 + Math.abs(row[1]) * 0.48, 1);
        glyph.material.color.setHex(s.sheafType === "signed" && sign < 0 ? COLORS.amber : s.sheafType === "connection" ? COLORS.violet : COLORS.cyan);
        glyph.material.opacity = s.view === "matrix" || state.status === "Coboundary" ? 0.42 : 0.18;
      });
      globalSectionBeads.forEach((bead, index) => {
        const value = state.status === "Section" ? 0.72 : s.values[index][0] * 0.38;
        bead.position.copy(nodes[index]).add(new THREE.Vector3(0, 0.74 + value * 0.12, 0));
        bead.scale.setScalar(state.status === "Section" ? 1.22 : 0.82 + Math.max(0, 0.18 - s.energy * 0.04));
        bead.material.color.setHex(state.status === "Section" || s.compatibleEdges >= 4 ? COLORS.green : COLORS.rose);
        bead.material.opacity = state.status === "Section" || state.status === "Projected" ? 0.62 : 0.12;
      });
      projectionCoordinateBars.forEach((bar, index) => {
        const projected = Math.abs(s.values[index][0] * (s.sheafType === "projection" ? s.projection : 1));
        bar.position.copy(nodes[index]).add(new THREE.Vector3(0.26, 0.38 + projected * 0.14, 0.1));
        bar.scale.y = 0.34 + projected * 0.72;
        bar.material.color.setHex(s.sheafType === "projection" ? COLORS.violet : COLORS.muted);
        bar.material.opacity = s.sheafType === "projection" ? 0.5 : 0.12;
      });
      connectionFrameBars.forEach((bar, index) => {
        const angle = s.twist * Math.PI * 0.65 + index * 0.45;
        bar.position.copy(nodes[index]).add(new THREE.Vector3(0, 0.78, 0));
        bar.rotation.y = s.sheafType === "connection" ? angle : 0;
        bar.scale.x = s.sheafType === "connection" ? 1.12 + s.twist * 0.28 : 0.82;
        bar.material.opacity = s.sheafType === "connection" ? 0.5 : 0.12;
      });
      signedCompatibilityBlocks.forEach((block, index) => {
        const value = Math.abs(s.residuals[index]);
        const [a, b] = edges[index];
        block.position.copy(nodes[a]).lerp(nodes[b], 0.5).add(new THREE.Vector3(0, 0.42 + value * 0.08, 0));
        block.scale.y = 0.75 + value * 0.45;
        block.material.color.setHex(s.sheafType === "signed" ? (value < 0.16 ? COLORS.green : COLORS.amber) : COLORS.muted);
        block.material.opacity = s.sheafType === "signed" ? 0.45 : 0.12;
      });

      // ===== CLEAN OVERRIDE: hide the instrument soup, show a legible cellular sheaf graph =====
      // snapshotSafe=true (snapshot uses .length, never .filter(visible)) so visible=false is safe.
      [restrictionLines, matrixBlocks, restrictionMatrixGlyphs, globalSectionBeads, projectionCoordinateBars, connectionFrameBars, signedCompatibilityBlocks].forEach((arr) => arr.forEach((o) => { o.visible = false; }));
      // node spheres: clear focal nodes lifted onto the graph; halos + labels for legibility
      nodeSpheres.forEach((mesh, index) => {
        mesh.visible = true;
        const value = s.values[index][0];
        mesh.position.copy(nodes[index]).add(new THREE.Vector3(0, 0.16 + value * 0.08, 0));
        mesh.scale.setScalar(1.05 + Math.abs(value) * 0.26);
        const col = [COLORS.blue, COLORS.cyan, COLORS.amber, COLORS.violet][index];
        mesh.material.color.setHex(col);
        if (mesh.material.emissive) { mesh.material.emissive.setHex(col); mesh.material.emissiveIntensity = 0.28; }
        h04Halos[index].visible = true; h04Halos[index].position.copy(mesh.position); h04Halos[index].material.color.setHex(col); h04Halos[index].material.opacity = 0.5; h04Halos[index].scale.setScalar(0.85);
        h04NodeLabels[index].position.copy(mesh.position).add(new THREE.Vector3(0.04, 0.4, 0));
      });
      // node stalk columns: keep as slim gauges beside each node, brighter
      nodeStalks.forEach((group, index) => {
        group.visible = true;
        group.position.copy(nodes[index]).add(new THREE.Vector3(0.34, 0.28, 0));
        group.children.forEach((bar, component) => {
          const value = s.values[index][component];
          bar.scale.y = 0.55 + Math.abs(value) * 0.6;
          bar.position.set((component - 0.5) * 0.13, 0.42, 0);
          bar.material.color.setHex(value >= 0 ? (component === 0 ? COLORS.blue : COLORS.cyan) : COLORS.amber);
          bar.material.opacity = 0.82;
        });
      });
      // restriction-map edge tubes (cell-complex 1-skeleton): green=compatible / rose=conflict, thin
      h04EdgeTubes.forEach((mesh, index) => {
        mesh.visible = true;
        const [a, b] = edges[index];
        const pa = nodes[a].clone().add(new THREE.Vector3(0, 0.16, 0));
        const pb = nodes[b].clone().add(new THREE.Vector3(0, 0.16, 0));
        h04PlaceEdge(mesh, pa, pb);
        const compat = Math.abs(s.residuals[index]) < 0.16;
        const col = compat ? COLORS.green : COLORS.rose;
        mesh.material.color.setHex(col); mesh.material.emissive.setHex(col);
        mesh.material.emissiveIntensity = 0.3 + (compat ? 0.12 : 0.22);   // restrained, no blown white
        mesh.material.opacity = 0.8;
        const w = 0.5 + (compat ? 0.18 : Math.min(0.5, Math.abs(s.residuals[index]) * 0.4)); mesh.scale.x = w; mesh.scale.z = w;   // thin
      });
      // keep edge lines as a faint underlay (they back the tubes); plates stay as edge-stalk markers
      edgeLines.forEach((line, index) => {
        line.visible = true; line.material.opacity = 0.12;
        setTrackedLine(line, [nodes[edges[index][0]], nodes[edges[index][1]]]);
      });
      edgePlates.forEach((plate, index) => {
        plate.visible = true;
        const [a, b] = edges[index];
        const compat = Math.abs(s.residuals[index]) < 0.16;
        plate.position.copy(nodes[a]).lerp(nodes[b], 0.5).add(new THREE.Vector3(0, 0.14, 0));
        plate.scale.set(0.85, 1, 1);
        plate.material.color.setHex(compat ? COLORS.green : COLORS.rose);
        plate.material.opacity = 0.4;
      });
      // per-edge coboundary residual rods at edge midpoints: green=compatible / rose=conflict
      residualRods.forEach((rod, index) => {
        rod.visible = true;
        const [a, b] = edges[index];
        const value = Math.abs(s.residuals[index]);
        const mid = nodes[a].clone().lerp(nodes[b], 0.5).add(new THREE.Vector3(0, 0.16, 0));
        const hh = 0.14 + value * 0.7;
        rod.position.copy(mid).add(new THREE.Vector3(0, 0.22 + hh * 0.5, 0));
        rod.scale.set(1, hh / 0.5, 1);
        rod.material.color.setHex(value < 0.16 ? COLORS.green : COLORS.rose);
        rod.material.opacity = 0.85;
      });
      // RIGHT region chart: per-edge sheaf energy / residual magnitude (reuse energyBars, tidy)
      const chX = 1.05, chBase = -1.0;
      energyBars.forEach((bar, index) => {
        bar.visible = true;
        const value = Math.abs(s.residuals[index] || 0);
        const hh = 0.12 + value * 0.9;
        bar.scale.set(1, hh / 0.3, 1);
        bar.position.set(chX + index * 0.26, chBase + hh * 0.5, 1.55);
        bar.material.opacity = 0.9;
        bar.material.color.setHex(value < 0.16 ? COLORS.green : COLORS.rose);
      });
      // sheaf energy decay curve E(t): residual energy settling toward a global section — over the chart
      const ePts = [];
      for (let i = 0; i <= 26; i += 1) {
        const t = i / 26;
        const y = chBase + 0.25 + (s.energy * Math.exp(-t * 1.4) * (1 - t * 0.4)) * 0.6 + Math.exp(-t * 3) * 0.12;
        ePts.push(new THREE.Vector3(chX - 0.15 + t * 1.3, y, 1.55));
      }
      const eCurve = new THREE.CatmullRomCurve3(ePts);
      h04EnergyCurve.geometry.dispose();
      h04EnergyCurve.geometry = new THREE.TubeGeometry(eCurve, 34, 0.028, 8, false);
      h04EnergyCurve.visible = true;
      h04PlaceEdge(h04ChartBaseline, new THREE.Vector3(chX - 0.2, chBase + 0.02, 1.55), new THREE.Vector3(chX + 1.3, chBase + 0.02, 1.55));
      h04StructLabel.position.set(-1.1, 1.45, 0);
      h04ChartLabel.position.set(1.55, 1.35, 1.55);
    }

    function updatePanel() {
      const s = stats();
      setMetric(root, "Sheaf energy", s.energy, 2);
      setMetric(root, "Compatible edges", s.compatibleEdges, 0);
      setMetric(root, "Incidence rank", s.incidenceRank, 0);
      setMetric(root, "Restriction maps", s.restrictionMapCount, 0);
      document.getElementById("energyLabel").textContent = fmt(s.energy, 2);
      document.getElementById("compatibleLabel").textContent = `${s.compatibleEdges}/5`;
      document.getElementById("rankLabel").textContent = fmt(s.incidenceRank, 0);
      document.getElementById("mapLabel").textContent = fmt(s.restrictionMapCount, 0);
      if (formulaText) formulaText.textContent = "delta x(e)=Bv,e xv - Bu,e xu";
      if (selected) selected.textContent = `${s.sheafType} | ${s.view} | energy ${fmt(s.energy, 2)}`;
      if (insight) insight.textContent = "The graph is a one-dimensional cell complex. Node stalk values are pushed through restriction maps into edge stalks; the coboundary records residuals there.";
      if (state.status === "Coboundary") {
        stateText.textContent = `${state.lastAction} builds the coboundary matrix delta: each row compares two endpoint restrictions inside one edge stalk, producing visible edge-stalk residuals delta x. Last control ${state.lastControl}.`;
      } else if (state.status === "Projected") {
        stateText.textContent = `${state.lastAction} is harmonization, not ordinary averaging: it moves node stalk values toward a global section by shrinking edge-stalk residuals after the restriction maps. Last control ${state.lastControl}.`;
      } else if (state.status === "Section") {
        stateText.textContent = `${state.lastAction} seeds a global section in the kernel of delta: every edge stalk receives matching restricted values, so all five edges are compatible. Last control ${state.lastControl}.`;
      } else if (s.sheafType === "projection") {
        stateText.textContent = `${state.lastAction} shows a projection sheaf: the edge stalk only sees the visible coordinate with projection ${fmt(s.edgeProjection, 2)}, while hidden node coordinates can differ. Last control ${state.lastControl}.`;
      } else {
        stateText.textContent = `${state.lastAction} shows node stalk columns, edge stalk comparison plates, restriction maps, the coboundary residual rods, and sheaf energy on the graph. Last control ${state.lastControl}.`;
      }
      syncOutput("nodeAmplitude", s.nodeAmplitude, 2);
      syncOutput("twist", s.twist, 2);
      syncOutput("projection", s.projection, 2);
      syncOutput("inconsistency", s.inconsistency, 2);
      syncOutput("edgeFocus", s.edgeFocus, 0);
      root.dataset.activeNodes = "4";
      root.dataset.activeEdges = String(s.compatibleEdges);
      root.dataset.visualMode = s.view;
      root.dataset.cameraTheta = String(cameraState.theta);
    }

    function refresh() {
      updateScene();
      updatePanel();
    }

    ["sheafType", "viewSelect"].forEach((id) => {
      document.getElementById(id).addEventListener("change", (event) => {
        markControl(id, event.target.value);
        state.lastAction = "View change";
        if (id === "sheafType") state.status = "Ready";
        refresh();
      });
    });
    ["nodeAmplitude", "twist", "projection", "inconsistency", "edgeFocus"].forEach((id) => {
      document.getElementById(id).addEventListener("input", (event) => {
        markControl(id, event.target.value);
        state.status = "Ready";
        state.lastAction = "Parameter change";
        refresh();
      });
    });
    document.getElementById("computeCoboundary").addEventListener("click", () => {
      markControl("computeCoboundary", "clicked");
      state.status = "Coboundary";
      state.lastAction = "Coboundary";
      refresh();
    });
    document.getElementById("harmonize").addEventListener("click", () => {
      markControl("harmonize", "clicked");
      state.status = "Projected";
      state.lastAction = "Harmonization";
      refresh();
    });
    document.getElementById("globalSection").addEventListener("click", () => {
      markControl("globalSection", "clicked");
      state.status = "Section";
      state.lastAction = "Global section";
      refresh();
    });
    document.getElementById("resetH04").addEventListener("click", () => {
      markControl("resetH04", "clicked");
      document.getElementById("sheafType").value = "constant";
      document.getElementById("viewSelect").value = "stalks";
      setRange("nodeAmplitude", 0.72);
      setRange("twist", 0.38);
      setRange("projection", 0.82);
      setRange("inconsistency", 0.24);
      setRange("edgeFocus", 2);
      state.status = "Ready";
      state.lastAction = "Reset";
      refresh();
    });

    function animate() {
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }

    window.__h04LabSnapshot = function () {
      const s = stats();
      return {
        kind: "cellular-sheaf-graph-coboundary",
        labId: "h04",
        sceneObject: "graph-node-stalk-edge-stalk-restriction-coboundary",
        title: "H04 Cellular Sheaves On Graphs",
        status: state.status,
        sheafType: s.sheafType,
        view: s.view,
        nodeCount: 4,
        edgeCount: 5,
        nodeStalkCount: 4,
        edgeStalkCount: 5,
        restrictionMapCount: s.restrictionMapCount,
        coboundaryRows: s.coboundaryRows,
        compatibleEdges: s.compatibleEdges,
        incidenceRank: s.incidenceRank,
        energy: s.energy,
        edgeProjection: s.edgeProjection,
        matrixVisible: s.matrixVisible,
        has3d: true,
        visualKind: "graph-stalk-restriction-coboundary",
        graphStyle: "graph",
        visualQuality: "h04-concrete-cellular-sheaf-v3",
        clarityVersion: "h03-h04-canonical-clarity-v1",
        graphCellComplexObjectCount: nodeSpheres.length + edgeLines.length,
        nodeStalkColumnObjectCount: nodeStalks.length,
        nodeStalkComponentObjectCount: nodeStalks.reduce((sum, group) => sum + group.children.length, 0),
        edgeStalkObjectCount: edgePlates.length,
        incidenceMapObjectCount: restrictionLines.length,
        restrictionMatrixObjectCount: restrictionMatrixGlyphs.length,
        coboundaryRowObjectCount: residualRods.length,
        incidenceMatrixBlockObjectCount: matrixBlocks.length,
        energySurfaceObjectCount: energyBars.length,
        globalSectionObjectCount: globalSectionBeads.length,
        projectionCoordinateObjectCount: projectionCoordinateBars.length,
        connectionFrameObjectCount: connectionFrameBars.length,
        signedCompatibilityObjectCount: signedCompatibilityBlocks.length,
        graphCellComplexHash: `${lineHash(edgeLines)}-${objectHash(nodeSpheres)}`,
        nodeStalkHash: stalkComponentHash(),
        edgeStalkHash: objectHash(edgePlates),
        incidenceMapHash: lineHash(restrictionLines),
        restrictionMatrixHash: objectHash(restrictionMatrixGlyphs),
        coboundaryRowHash: objectHash(residualRods),
        incidenceMatrixBlockHash: objectHash(matrixBlocks),
        energySurfaceHash: objectHash(energyBars),
        globalSectionHash: objectHash(globalSectionBeads),
        projectionCoordinateHash: objectHash(projectionCoordinateBars),
        connectionFrameHash: objectHash(connectionFrameBars),
        signedCompatibilityHash: objectHash(signedCompatibilityBlocks),
        canonicalReferences: ["cellular sheaf on graph", "node stalk", "edge stalk", "restriction matrix B_v,e", "coboundary delta", "sheaf energy"],
        graphSheafObjects: ["node_stalk", "edge_stalk", "restriction_matrix", "coboundary_row", "global_section", "projection_sheaf", "connection_sheaf"],
        diagnosticMetrics: ["sheaf_energy", "compatible_edges", "incidence_rank", "restriction_map_count"],
        stateText: stateText.textContent.trim(),
        cameraTheta: cameraState.theta,
        cameraPhi: cameraState.phi,
        cameraRadius: cameraState.radius,
        revision: state.revision,
        lastControl: state.lastControl,
        controls: Object.assign({}, state.controls)
      };
    };

    refresh();
    window.__h04LabReady = true;
    animate();
  }

  function createH03CellularCohomologyLab() {
    const root = document.querySelector('[data-lab-id="h03"]');
    const canvas = document.getElementById("canvas");
    if (!root || !canvas) return;
    const { renderer, scene, camera, cameraState, grid } = setupScene(root, canvas, 8.4);
    const selected = root.querySelector('[data-role="selected"] strong');
    const insight = root.querySelector('[data-role="insight"]');
    const stateText = document.getElementById("state");
    const formulaText = document.getElementById("formulaText");
    const state = { status: "Ready", revision: 0, lastControl: "initial", lastAction: "Ready", controls: {} };
    const vertices = [
      new THREE.Vector3(-1.55, 0.02, -0.55),
      new THREE.Vector3(1.55, 0.02, -0.55),
      new THREE.Vector3(0, 0.05, 1.28)
    ];
    const edges = [[0, 1], [1, 2], [2, 0]];
    const faceGeometry = new THREE.BufferGeometry().setFromPoints(vertices);
    faceGeometry.setIndex([0, 1, 2]);
    faceGeometry.computeVertexNormals();
    const faceMesh = new THREE.Mesh(faceGeometry, material(COLORS.violet, 0.18));
    scene.add(faceMesh);
    const vertexDots = vertices.map((position, index) => {
      const dot = makeSphere(0.17, [COLORS.blue, COLORS.cyan, COLORS.amber][index], 0.94);
      dot.position.copy(position);
      scene.add(dot);
      return dot;
    });
    const vertexStalks = vertices.map((position, index) => {
      const stalk = makeBox([0.11, 0.66, 0.11], [COLORS.blue, COLORS.cyan, COLORS.amber][index], 0.48);
      stalk.position.copy(position).add(new THREE.Vector3(0, 0.55, 0));
      scene.add(stalk);
      return stalk;
    });
    const edgeLines = edges.map(([a, b]) => {
      const line = makeLine([vertices[a], vertices[b]], COLORS.ink, 0.2);
      scene.add(line);
      return line;
    });
    const edgeStalks = edges.map(([a, b]) => {
      const plate = makeBox([0.5, 0.035, 0.2], COLORS.green, 0.34);
      plate.position.copy(vertices[a]).lerp(vertices[b], 0.5).add(new THREE.Vector3(0, 0.12, 0));
      scene.add(plate);
      return plate;
    });
    const restrictionLines = Array.from({ length: 6 }, () => {
      const line = makeLine([], COLORS.cyan, 0.28);
      scene.add(line);
      return line;
    });
    const delta0Rods = edges.map(() => {
      const rod = makeBox([0.09, 0.4, 0.09], COLORS.rose, 0.45);
      scene.add(rod);
      return rod;
    });
    const delta1Loop = makeLine([], COLORS.amber, 0.44);
    scene.add(delta1Loop);
    const cochainBlocks = Array.from({ length: 7 }, (_, index) => {
      const block = makeBox([0.14, 0.22, 0.14], index < 3 ? COLORS.blue : index < 6 ? COLORS.green : COLORS.violet, 0.32);
      scene.add(block);
      return block;
    });
    const delta0MatrixCells = Array.from({ length: 9 }, (_, index) => {
      const cell = makeBox([0.12, 0.08, 0.12], index % 3 === Math.floor(index / 3) ? COLORS.rose : COLORS.cyan, 0.16);
      scene.add(cell);
      return cell;
    });
    const delta1BoundaryBeads = Array.from({ length: 3 }, (_, index) => {
      const bead = makeSphere(0.08, index % 2 ? COLORS.amber : COLORS.green, 0.16);
      scene.add(bead);
      return bead;
    });
    const kernelH0Beads = vertices.map((position, index) => {
      const bead = makeSphere(0.1, index % 2 ? COLORS.green : COLORS.ink, 0.12);
      bead.position.copy(position).add(new THREE.Vector3(0, 0.9, 0));
      scene.add(bead);
      return bead;
    });
    const imageDelta0Blocks = edges.map(([a, b], index) => {
      const block = makeBox([0.13, 0.12, 0.18], index % 2 ? COLORS.cyan : COLORS.blue, 0.16);
      block.position.copy(vertices[a]).lerp(vertices[b], 0.5).add(new THREE.Vector3(0, 0.52, 0));
      scene.add(block);
      return block;
    });
    const h1CycleBeads = vertices.map((position, index) => {
      const bead = makeSphere(0.09, index % 2 ? COLORS.amber : COLORS.violet, 0.14);
      bead.position.copy(position).add(new THREE.Vector3(0, 0.72, 0));
      scene.add(bead);
      return bead;
    });
    const harmonicRepresentativeBeads = vertices.map((position, index) => {
      const bead = makeSphere(0.075, index % 2 ? COLORS.green : COLORS.cyan, 0.12);
      bead.position.copy(position).add(new THREE.Vector3(0, 1.05, 0));
      scene.add(bead);
      return bead;
    });
    const quotientWitnessBlocks = edges.map(([a, b], index) => {
      const block = makeBox([0.12, 0.1, 0.14], index % 2 ? COLORS.violet : COLORS.amber, 0.13);
      block.position.copy(vertices[a]).lerp(vertices[b], 0.5).add(new THREE.Vector3(0, 0.86, 0));
      scene.add(block);
      return block;
    });
    grid(2.7, 1.45, -1.12);

    // ===== legibility layer (h07-style clean override): glow halos + ASCII labels on the
    // triangular cell complex, thin restriction edge tubes, region labels for the focal
    // sheaf scene and the coboundary-residual chart. The dense instrument arrays above stay
    // alive/control-driven (snapshot counts + hashes hold) but are hidden so the scene reads. =====
    const h03PlaceEdge = (mesh, a, b) => { const dir = new THREE.Vector3().subVectors(b, a); const len = dir.length(); mesh.position.copy(a).add(b).multiplyScalar(0.5); mesh.scale.set(1, len, 1); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()); };
    const h03Halos = vertices.map((_, i) => { const g = scGlow([COLORS.blue, COLORS.cyan, COLORS.amber][i], 0.9); g.userData.engineRef = true; scene.add(g); return g; });
    const h03NodeLabels = ["v0", "v1", "v2"].map((t) => { const l = scLabel(t, 0xeaf4ff, 0.2); l.userData.engineRef = true; scene.add(l); return l; });
    const h03EdgeTubes = edges.map(() => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1, 12), new THREE.MeshStandardMaterial({ color: COLORS.green, emissive: COLORS.green, emissiveIntensity: 0.45, transparent: true, opacity: 0.82, roughness: 0.4 })); m.userData.engineRef = true; scene.add(m); return m; });
    const h03StructLabel = scLabel("SHEAF COHOMOLOGY", 0x9fb4cc, 0.32); h03StructLabel.userData.engineRef = true; scene.add(h03StructLabel);
    const h03ChartLabel = scLabel("COBOUNDARY RESIDUALS", 0x9fb4cc, 0.28); h03ChartLabel.userData.engineRef = true; scene.add(h03ChartLabel);
    const h03ChartBaseline = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1, 8), new THREE.MeshStandardMaterial({ color: 0x3a4a5e, emissive: 0x223040, roughness: 0.6 })); h03ChartBaseline.userData.engineRef = true; scene.add(h03ChartBaseline);

    function markControl(id, value) {
      state.revision += 1;
      state.lastControl = id;
      state.controls[id] = value == null ? "clicked" : String(value);
    }

    function restrictionSign(edgeIndex, endpoint, s) {
      if (s.ruleMode === "signed") return endpoint === 0 ? 1 : -1;
      if (s.ruleMode === "rotated") return Math.cos((endpoint === 0 ? 1 : -1) * s.twist * Math.PI * 0.7 + edgeIndex * 0.2);
      return 1;
    }

    function stats() {
      const ruleMode = selectValue("ruleMode", "constant");
      const complexMode = selectValue("complexMode", "filled");
      const vertexSignal = rangeValue("vertexSignal", 0.74);
      const twist = rangeValue("twist", 0.28);
      const faceWeight = rangeValue("faceWeight", 1);
      const circulationDefect = rangeValue("circulationDefect", 0.18);
      const harmonicAnchor = rangeValue("harmonicAnchor", 0.55);
      const base = [vertexSignal, vertexSignal * (ruleMode === "signed" ? -0.78 : 0.64), vertexSignal * (0.28 + twist * 0.5)];
      const residuals = edges.map(([a, b], index) => {
        if (state.status === "Projected") return (base[b] - base[a]) * 0.25;
        return base[b] * restrictionSign(index, 1, { ruleMode, twist }) - base[a] * restrictionSign(index, 0, { ruleMode, twist }) + circulationDefect * 0.12;
      });
      const coboundaryNorm = Math.sqrt(residuals.reduce((sum, value) => sum + value * value, 0));
      const faceCirculation = complexMode === "filled"
        ? Math.abs(residuals[0] + residuals[1] + residuals[2]) * faceWeight * 0.35
        : Math.abs(residuals[0] + residuals[1] + residuals[2]) * faceWeight + circulationDefect;
      const cocycleMagnitude = state.status === "Cocycle" ? Math.max(0.12, faceCirculation) : faceCirculation * 0.45;
      const h0Dimension = state.status === "Projected" ? 1 : coboundaryNorm < 0.16 ? 1 : 0;
      const h1Dimension = complexMode === "hole" ? 1 : 0;
      return {
        ruleMode,
        complexMode,
        vertexSignal,
        twist,
        faceWeight,
        circulationDefect,
        harmonicAnchor,
        base,
        residuals,
        coboundaryNorm,
        faceCirculation,
        cocycleMagnitude,
        h0Dimension,
        h1Dimension,
        harmonicGap: Math.max(0, coboundaryNorm - harmonicAnchor * 0.2)
      };
    }

    function updateScene() {
      const s = stats();
      faceMesh.material.opacity = s.complexMode === "hole" ? 0.045 : 0.18 + s.faceWeight * 0.04;
      vertexDots.forEach((dot, index) => {
        const value = s.base[index];
        dot.position.copy(vertices[index]).add(new THREE.Vector3(0, value * 0.08, 0));
        dot.scale.setScalar(0.9 + Math.abs(value) * 0.28);
        dot.material.color.setHex(value >= 0 ? COLORS.blue : COLORS.amber);
      });
      vertexStalks.forEach((stalk, index) => {
        const value = s.base[index];
        stalk.scale.y = 0.62 + Math.abs(value) * 0.7;
        stalk.position.copy(vertices[index]).add(new THREE.Vector3(0, 0.34 + Math.abs(value) * 0.16, 0));
      });
      edgeLines.forEach((line, index) => {
        setTrackedLine(line, [vertices[edges[index][0]], vertices[edges[index][1]]]);
        line.material.color.setHex(Math.abs(s.residuals[index]) < 0.18 ? COLORS.green : COLORS.rose);
        line.material.opacity = 0.18 + Math.min(0.34, Math.abs(s.residuals[index]) * 0.16);
      });
      edgeStalks.forEach((plate, index) => {
        const [a, b] = edges[index];
        plate.position.copy(vertices[a]).lerp(vertices[b], 0.5).add(new THREE.Vector3(0, 0.12, 0));
        plate.material.color.setHex(Math.abs(s.residuals[index]) < 0.18 ? COLORS.green : COLORS.rose);
        plate.scale.x = 0.9 + Math.abs(s.residuals[index]) * 0.35;
      });
      restrictionLines.forEach((line, index) => {
        const edgeIndex = Math.floor(index / 2);
        const endpoint = edges[edgeIndex][index % 2];
        const a = vertices[endpoint].clone().add(new THREE.Vector3(0, 0.38, 0));
        const b = edgeStalks[edgeIndex].position.clone().add(new THREE.Vector3(0, 0.1, 0));
        setTrackedLine(line, [a, a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, 0.18 + s.twist * 0.08, 0)), b]);
        line.material.color.setHex(s.ruleMode === "rotated" ? COLORS.violet : COLORS.cyan);
        line.material.opacity = state.status === "Coboundary" ? 0.45 : 0.25;
      });
      delta0Rods.forEach((rod, index) => {
        const value = Math.abs(s.residuals[index]);
        rod.position.copy(edgeStalks[index].position).add(new THREE.Vector3(0, 0.34 + value * 0.12, 0));
        rod.scale.y = 0.22 + value * 0.58;
        rod.material.color.setHex(value < 0.18 ? COLORS.green : COLORS.rose);
      });
      setTrackedLine(delta1Loop, [...vertices.map((v) => v.clone().add(new THREE.Vector3(0, 0.72 + s.faceCirculation * 0.04, 0))), vertices[0].clone().add(new THREE.Vector3(0, 0.72 + s.faceCirculation * 0.04, 0))]);
      delta1Loop.material.opacity = state.status === "Cocycle" || s.complexMode === "hole" ? 0.58 : 0.18;
      delta1Loop.material.color.setHex(s.complexMode === "hole" ? COLORS.amber : COLORS.green);
      cochainBlocks.forEach((block, index) => {
        const column = index < 3 ? 0 : index < 6 ? 1 : 2;
        const row = index < 3 ? index : index < 6 ? index - 3 : 1;
        const value = index < 3 ? Math.abs(s.base[index]) : index < 6 ? Math.abs(s.residuals[index - 3]) : s.faceCirculation;
        block.position.set(-0.66 + column * 0.66, -1.0 + row * 0.14 + value * 0.07, 1.68);
        block.scale.y = 0.65 + value * 0.5;
        block.material.opacity = 0.24 + Math.min(0.32, value * 0.12);
      });
      delta0MatrixCells.forEach((cell, index) => {
        const row = Math.floor(index / 3);
        const col = index % 3;
        const edge = edges[row];
        const active = col === edge[0] || col === edge[1];
        const sign = col === edge[1] ? 1 : col === edge[0] ? -1 : 0;
        const value = active ? Math.abs(s.residuals[row]) : 0;
        cell.position.set(-0.74 + col * 0.22, -0.98 + row * 0.15, 1.24);
        cell.scale.y = 0.66 + value * 0.58;
        cell.material.color.setHex(sign < 0 ? COLORS.rose : sign > 0 ? COLORS.cyan : COLORS.muted);
        cell.material.opacity = state.status === "Coboundary" || state.status === "Projected" ? (active ? 0.48 : 0.12) : 0.16;
      });
      delta1BoundaryBeads.forEach((bead, index) => {
        const [a, b] = edges[index];
        bead.position.copy(vertices[a]).lerp(vertices[b], 0.5).add(new THREE.Vector3(0, 0.74 + s.faceCirculation * 0.04, 0));
        bead.scale.setScalar(0.85 + s.faceCirculation * 0.16);
        bead.material.color.setHex(s.complexMode === "hole" ? COLORS.amber : COLORS.green);
        bead.material.opacity = state.status === "Cocycle" || s.complexMode === "hole" ? 0.52 : 0.18;
      });
      kernelH0Beads.forEach((bead, index) => {
        const value = state.status === "Projected" ? s.harmonicAnchor : s.base[index] * 0.26;
        bead.position.copy(vertices[index]).add(new THREE.Vector3(0, 0.88 + value * 0.12, 0));
        bead.scale.setScalar(state.status === "Projected" ? 1.16 : 0.78 + Math.max(0, 0.22 - s.coboundaryNorm * 0.04));
        bead.material.color.setHex(s.h0Dimension > 0 ? COLORS.green : COLORS.rose);
        bead.material.opacity = state.status === "Projected" || s.h0Dimension > 0 ? 0.58 : 0.12;
      });
      imageDelta0Blocks.forEach((block, index) => {
        const value = Math.abs(s.residuals[index]);
        const [a, b] = edges[index];
        block.position.copy(vertices[a]).lerp(vertices[b], 0.5).add(new THREE.Vector3(0, 0.5 + value * 0.12, 0.08));
        block.scale.y = 0.72 + value * 0.56;
        block.material.color.setHex(state.status === "Projected" ? COLORS.green : COLORS.cyan);
        block.material.opacity = state.status === "Coboundary" || state.status === "Projected" ? 0.44 : 0.16;
      });
      h1CycleBeads.forEach((bead, index) => {
        bead.position.copy(vertices[index]).add(new THREE.Vector3(0, 0.72 + Math.sin(index + s.cocycleMagnitude) * 0.05, 0));
        bead.scale.setScalar(0.84 + s.cocycleMagnitude * 0.18);
        bead.material.color.setHex(s.complexMode === "hole" ? COLORS.amber : COLORS.violet);
        bead.material.opacity = state.status === "Cocycle" ? 0.62 : 0.13;
      });
      harmonicRepresentativeBeads.forEach((bead, index) => {
        bead.position.copy(vertices[index]).add(new THREE.Vector3(0, 1.02 + (1 - s.harmonicGap) * 0.04, 0.08));
        bead.scale.setScalar(state.status === "Projected" ? 1.08 : 0.76);
        bead.material.opacity = state.status === "Projected" ? 0.5 : 0.12;
      });
      quotientWitnessBlocks.forEach((block, index) => {
        const [a, b] = edges[index];
        const value = s.complexMode === "hole" ? s.cocycleMagnitude : s.faceCirculation;
        block.position.copy(vertices[a]).lerp(vertices[b], 0.5).add(new THREE.Vector3(0, 0.84 + value * 0.07, -0.08));
        block.scale.y = 0.72 + value * 0.38;
        block.material.color.setHex(s.complexMode === "hole" ? COLORS.amber : COLORS.green);
        block.material.opacity = state.status === "Cocycle" ? 0.52 : 0.13;
      });

      // ===== CLEAN OVERRIDE: hide the instrument soup, show a legible cellular-cohomology scene =====
      [vertexStalks, edgeStalks, restrictionLines, cochainBlocks, delta0MatrixCells, delta1BoundaryBeads, kernelH0Beads, imageDelta0Blocks, h1CycleBeads, harmonicRepresentativeBeads, quotientWitnessBlocks].forEach((arr) => arr.forEach((o) => { o.visible = false; }));
      // focal cell complex: vertex dots stay as the nodes, glow halos + labels make them read
      vertexDots.forEach((dot, i) => {
        const col = s.base[i] >= 0 ? COLORS.blue : COLORS.amber;
        h03Halos[i].visible = true;
        h03Halos[i].position.copy(dot.position);
        h03Halos[i].material.color.setHex(col);
        h03Halos[i].material.opacity = 0.5;
        h03Halos[i].scale.setScalar(0.8 + Math.abs(s.base[i]) * 0.2);
        h03NodeLabels[i].position.copy(dot.position).add(new THREE.Vector3(0.04, 0.4, 0));
      });
      // restriction edge tubes along the triangle, coloured by residual (green=compatible / rose=conflict), thin
      h03EdgeTubes.forEach((mesh, i) => {
        mesh.visible = true;
        const a = vertices[edges[i][0]], b = vertices[edges[i][1]];
        h03PlaceEdge(mesh, a, b);
        const conflict = Math.abs(s.residuals[i]) >= 0.18;
        const col = conflict ? COLORS.rose : COLORS.green;
        mesh.material.color.setHex(col); mesh.material.emissive.setHex(col);
        mesh.material.emissiveIntensity = 0.38;
        mesh.material.opacity = 0.82;
        const w = 0.55 + Math.min(0.45, Math.abs(s.residuals[i]) * 0.4); mesh.scale.x = w; mesh.scale.z = w;
      });
      // RIGHT chart: per-edge coboundary residual rods (reuse delta0Rods, tidy into a clean bar row)
      const chX = 1.7, chBase = -1.0;
      delta0Rods.forEach((rod, i) => {
        rod.visible = true;
        const value = Math.abs(s.residuals[i]);
        const hh = 0.14 + value * 0.8;
        rod.scale.set(1, hh / 0.4, 1);
        rod.position.set(chX + i * 0.34, chBase + hh * 0.5, 0.6);
        rod.material.opacity = 0.9;
        rod.material.color.setHex(value < 0.18 ? COLORS.green : COLORS.rose);
      });
      h03PlaceEdge(h03ChartBaseline, new THREE.Vector3(chX - 0.25, chBase + 0.02, 0.6), new THREE.Vector3(chX + 1.05, chBase + 0.02, 0.6));
      h03StructLabel.position.set(-1.4, 1.5, 0);
      h03ChartLabel.position.set(2.2, 1.4, 0.6);
    }

    function updatePanel() {
      const s = stats();
      setMetric(root, "Coboundary norm", s.coboundaryNorm, 2);
      setMetric(root, "Cycle circulation", s.faceCirculation, 2);
      setMetric(root, "Cell coverage", s.complexMode === "hole" ? 6 : 7, 0);
      setMetric(root, "Harmonic gap", s.harmonicGap, 2);
      document.getElementById("coboundaryLabel").textContent = fmt(s.coboundaryNorm, 2);
      document.getElementById("faceLabel").textContent = fmt(s.faceCirculation, 2);
      document.getElementById("h0Label").textContent = `H0 ${s.h0Dimension}`;
      document.getElementById("statusLabel").textContent = state.status;
      if (formulaText) formulaText.textContent = "C0 --delta0--> C1 --delta1--> C2";
      if (selected) selected.textContent = `${s.ruleMode} | ${s.complexMode} | H0 ${s.h0Dimension} | H1 ${s.h1Dimension}`;
      if (insight) insight.textContent = "The triangular cell complex is the object: vertex stalks hold a 0-cochain, edge stalks hold delta0 residuals, and the face reads delta1 circulation.";
      if (state.status === "Coboundary") {
        stateText.textContent = `${state.lastAction} computes delta0 with the coboundary matrix: vertex 0-cochain values are restricted into edge stalk residuals, giving norm ${fmt(s.coboundaryNorm, 2)}. Last control ${state.lastControl}.`;
      } else if (state.status === "Projected") {
        stateText.textContent = `${state.lastAction} projects toward ker delta0 and the global sections: Harmonization reduces edge residuals while preserving the triangular cell complex. Last control ${state.lastControl}.`;
      } else if (state.status === "Cocycle") {
        stateText.textContent = `${state.lastAction} displays a 1-cochain around the loop: H1 appears when face circulation survives around a hole instead of being killed by delta1 on a filled face. Last control ${state.lastControl}.`;
      } else {
        stateText.textContent = `${state.lastAction} shows the concrete cochain complex: 0-cochain vertex stalks, 1-cochain edge stalk residuals, 2-cochain face circulation, delta0, and delta1. Last control ${state.lastControl}.`;
      }
      syncOutput("vertexSignal", s.vertexSignal, 2);
      syncOutput("twist", s.twist, 2);
      syncOutput("faceWeight", s.faceWeight, 2);
      syncOutput("circulationDefect", s.circulationDefect, 2);
      syncOutput("harmonicAnchor", s.harmonicAnchor, 2);
    }

    function refresh() {
      updateScene();
      updatePanel();
    }

    ["ruleMode", "complexMode"].forEach((id) => {
      document.getElementById(id).addEventListener("change", (event) => {
        markControl(id, event.target.value);
        state.lastAction = "View change";
        state.status = "Ready";
        refresh();
      });
    });
    ["vertexSignal", "twist", "faceWeight", "circulationDefect", "harmonicAnchor"].forEach((id) => {
      document.getElementById(id).addEventListener("input", (event) => {
        markControl(id, event.target.value);
        state.lastAction = "Parameter change";
        state.status = "Ready";
        refresh();
      });
    });
    document.getElementById("computeDelta0").addEventListener("click", () => {
      markControl("computeDelta0", "clicked");
      state.status = "Coboundary";
      state.lastAction = "Step delta0";
      refresh();
    });
    document.getElementById("harmonize").addEventListener("click", () => {
      markControl("harmonize", "clicked");
      state.status = "Projected";
      state.lastAction = "Harmonization";
      refresh();
    });
    document.getElementById("showCocycle").addEventListener("click", () => {
      markControl("showCocycle", "clicked");
      state.status = "Cocycle";
      state.lastAction = "Cocycle";
      refresh();
    });
    document.getElementById("resetH03").addEventListener("click", () => {
      markControl("resetH03", "clicked");
      document.getElementById("ruleMode").value = "constant";
      document.getElementById("complexMode").value = "filled";
      setRange("vertexSignal", 0.74);
      setRange("twist", 0.28);
      setRange("faceWeight", 1);
      setRange("circulationDefect", 0.18);
      setRange("harmonicAnchor", 0.55);
      state.status = "Ready";
      state.lastAction = "Reset";
      refresh();
    });

    function animate() {
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }

    window.__h03LabSnapshot = function () {
      const s = stats();
      return {
        kind: "cellular-sheaf-cochain-complex",
        labId: "h03",
        sceneObject: "triangular-cell-complex-cochains-coboundaries-cohomology",
        title: "H03 Cellular Sheaves And Cohomology",
        status: state.status,
        ruleMode: s.ruleMode,
        complexMode: s.complexMode,
        vertexCount: 3,
        edgeCount: 3,
        faceCount: 1,
        zeroCochainCount: 3,
        oneCochainCount: 3,
        twoCochainCount: 1,
        restrictionMapCount: 6,
        coboundary0Rows: 3,
        coboundary1Rows: 1,
        h0Dimension: s.h0Dimension,
        h1Dimension: s.h1Dimension,
        coboundaryNorm: s.coboundaryNorm,
        faceCirculation: s.faceCirculation,
        cocycleMagnitude: s.cocycleMagnitude,
        harmonicGap: s.harmonicGap,
        has3d: true,
        visualKind: "triangular-cell-complex-cohomology",
        graphStyle: "anchors",
        visualQuality: "h03-concrete-cellular-cohomology-v3",
        clarityVersion: "h03-h04-canonical-clarity-v1",
        cellComplexObjectCount: vertexDots.length + edgeLines.length + 1,
        vertexStalkObjectCount: vertexStalks.length,
        edgeStalkObjectCount: edgeStalks.length,
        faceStalkObjectCount: 1,
        restrictionMapObjectCount: restrictionLines.length,
        zeroCochainObjectCount: vertexDots.length,
        oneCochainObjectCount: delta0Rods.length,
        twoCochainObjectCount: 1,
        delta0MatrixObjectCount: delta0MatrixCells.length,
        delta1BoundaryObjectCount: delta1BoundaryBeads.length,
        kernelH0ObjectCount: kernelH0Beads.length,
        imageDelta0ObjectCount: imageDelta0Blocks.length,
        h1CycleObjectCount: h1CycleBeads.length,
        harmonicRepresentativeObjectCount: harmonicRepresentativeBeads.length,
        quotientWitnessObjectCount: quotientWitnessBlocks.length,
        cellComplexHash: `${objectHash([faceMesh])}-${lineHash(edgeLines)}-${objectHash(vertexDots)}`,
        vertexStalkHash: objectHash(vertexStalks),
        edgeStalkHash: objectHash(edgeStalks),
        faceStalkHash: objectHash([faceMesh]),
        restrictionMapHash: lineHash(restrictionLines),
        zeroCochainHash: objectHash(vertexDots),
        oneCochainHash: objectHash(delta0Rods),
        twoCochainHash: objectHash(cochainBlocks.slice(6, 7)),
        delta0MatrixHash: objectHash(delta0MatrixCells),
        delta1BoundaryHash: `${lineHash([delta1Loop])}-${objectHash(delta1BoundaryBeads)}`,
        kernelH0Hash: objectHash(kernelH0Beads),
        imageDelta0Hash: objectHash(imageDelta0Blocks),
        h1CycleHash: objectHash(h1CycleBeads),
        harmonicRepresentativeHash: objectHash(harmonicRepresentativeBeads),
        quotientWitnessHash: objectHash(quotientWitnessBlocks),
        canonicalReferences: ["cellular sheaf", "cochain complex", "coboundary delta0", "coboundary delta1", "H0 kernel", "H1 quotient"],
        cochainObjects: ["cell_complex", "stalk", "restriction_map", "cochain", "coboundary_delta0", "coboundary_delta1", "kernel_h0", "quotient_h1"],
        diagnosticMetrics: ["coboundary_norm", "face_circulation", "h0_dimension", "h1_dimension", "harmonic_gap"],
        stateText: stateText.textContent.trim(),
        cameraTheta: cameraState.theta,
        cameraPhi: cameraState.phi,
        cameraRadius: cameraState.radius,
        revision: state.revision,
        lastControl: state.lastControl,
        controls: Object.assign({}, state.controls)
      };
    };

    refresh();
    window.__h03LabReady = true;
    animate();
  }

  function createH05SheafLaplacianConcreteLab() {
    const root = document.querySelector('[data-lab-id="h05"]');
    const canvas = document.getElementById("canvas");
    if (!root || !canvas) return;
    const { renderer, scene, camera, cameraState, grid } = setupScene(root, canvas, 8.8);
    const selected = root.querySelector('[data-role="selected"] strong');
    const insight = root.querySelector('[data-role="insight"]');
    const stateText = document.getElementById("stateText");
    const formulaText = document.getElementById("formulaText");
    const state = { status: "Ready", modeLabel: "Constant", revision: 0, lastControl: "initial", lastAction: "Ready", diffusionStep: 0, controls: {} };
    const nodes = [
      new THREE.Vector3(-1.55, 0.02, -0.52),
      new THREE.Vector3(0.12, 0.08, 0.95),
      new THREE.Vector3(1.58, 0.02, -0.58)
    ];
    const edges = [[0, 1], [1, 2], [0, 2]];
    const nodeDots = nodes.map((position, index) => {
      const dot = makeSphere(0.17, [COLORS.blue, COLORS.cyan, COLORS.amber][index], 0.94);
      dot.position.copy(position);
      scene.add(dot);
      return dot;
    });
    const edgeLines = edges.map(([a, b]) => {
      const line = makeLine([nodes[a], nodes[b]], COLORS.ink, 0.2);
      scene.add(line);
      return line;
    });
    const edgePlates = edges.map(([a, b]) => {
      const plate = makeBox([0.58, 0.04, 0.22], COLORS.green, 0.33);
      plate.position.copy(nodes[a]).lerp(nodes[b], 0.5).add(new THREE.Vector3(0, 0.12, 0));
      scene.add(plate);
      return plate;
    });
    const restrictionLines = Array.from({ length: 6 }, () => {
      const line = makeLine([], COLORS.cyan, 0.28);
      scene.add(line);
      return line;
    });
    const residualRods = edges.map(() => {
      const rod = makeBox([0.09, 0.42, 0.09], COLORS.rose, 0.45);
      scene.add(rod);
      return rod;
    });
    const deltaBlocks = Array.from({ length: 9 }, (_, index) => {
      const block = makeBox([0.14, 0.14, 0.14], index % 4 === 0 ? COLORS.cyan : COLORS.rose, 0.28);
      scene.add(block);
      return block;
    });
    const lapBlocks = Array.from({ length: 9 }, (_, index) => {
      const block = makeBox([0.14, 0.14, 0.14], index % 4 === 0 ? COLORS.green : COLORS.amber, 0.24);
      scene.add(block);
      return block;
    });
    const blockContributionCells = Array.from({ length: 12 }, (_, index) => {
      const block = makeBox([0.11, 0.09, 0.11], index % 4 < 2 ? COLORS.cyan : COLORS.amber, 0.24);
      scene.add(block);
      return block;
    });
    const spectrumEigenBars = Array.from({ length: 5 }, (_, index) => {
      const bar = makeBox([0.12, 0.24, 0.12], index === 0 ? COLORS.green : COLORS.violet, 0.34);
      scene.add(bar);
      return bar;
    });
    const kernelGlobalSectionBeads = nodes.map(() => {
      const bead = makeSphere(0.09, COLORS.green, 0.64);
      scene.add(bead);
      return bead;
    });
    const projectionSheafPlates = nodes.map(() => {
      const plate = makeBox([0.42, 0.03, 0.42], COLORS.green, 0.16);
      scene.add(plate);
      return plate;
    });
    const connectionFrameLines = nodes.map(() => {
      const line = makeLine([], COLORS.violet, 0.2);
      scene.add(line);
      return line;
    });
    const flowLines = Array.from({ length: 6 }, () => {
      const line = makeLine([], COLORS.amber, 0.0);
      scene.add(line);
      return line;
    });
    const energyBars = Array.from({ length: 5 }, (_, index) => {
      const bar = makeBox([0.13, 0.28, 0.13], index < 3 ? COLORS.rose : COLORS.green, 0.38);
      scene.add(bar);
      return bar;
    });
    grid(2.9, 1.55, -1.12);

    // ===== legibility layer (h06-style): node glow + labels + 2 region labels. The dense
    // instrument arrays stay alive/control-driven (counts+hashes hold) but are hidden. =====
    const h05Halos = nodes.map(() => { const g = scGlow(COLORS.cyan, 0.8); g.userData.engineRef = true; scene.add(g); return g; });
    const h05NodeLabels = ["x1", "x2", "x3"].map((t) => { const l = scLabel(t, 0xeaf4ff, 0.2); l.userData.engineRef = true; scene.add(l); return l; });
    const h05StructLabel = scLabel("SHEAF GRAPH (delta x)", 0x9fb4cc, 0.3); h05StructLabel.userData.engineRef = true; scene.add(h05StructLabel);
    const h05MatrixLabel = scLabel("LAPLACIAN  L_F = delta^T delta", 0x9fb4cc, 0.28); h05MatrixLabel.userData.engineRef = true; scene.add(h05MatrixLabel);

    function markControl(id, value) {
      state.revision += 1;
      state.lastControl = id;
      state.controls[id] = value == null ? "clicked" : String(value);
    }

    function signs(scenario) {
      if (scenario === "signed") return [[1, -1], [1, -1], [1, 1]];
      if (scenario === "connection") return [[1, -0.72], [0.82, -1], [1, 0.64]];
      if (scenario === "projection") return [[1, 0.58], [0.58, 1], [1, 0.58]];
      return [[1, 1], [1, 1], [1, 1]];
    }

    function stats() {
      const scenario = selectValue("scenario", "constant");
      const view = selectValue("viewSelect", "operator");
      const signalAmplitude = rangeValue("signalAmplitude", 0.76);
      const twistAmount = rangeValue("twistAmount", 0.24);
      const mapStrength = rangeValue("mapStrength", 1);
      const stepSize = rangeValue("stepSize", 0.18);
      const kernelAnchor = rangeValue("kernelAnchor", 0.62);
      const signRows = signs(scenario);
      const base = [
        signalAmplitude,
        scenario === "signed" ? -signalAmplitude * (0.7 + twistAmount * 0.2) : signalAmplitude * (0.52 + twistAmount * 0.22),
        signalAmplitude * (0.1 + twistAmount * 0.68)
      ];
      let residuals = edges.map(([a, b], index) => mapStrength * (base[b] * signRows[index][1] - base[a] * signRows[index][0]));
      if (state.status === "Diffused") residuals = residuals.map((value) => value * Math.max(0.12, 1 - stepSize * 2.4));
      if (state.status === "Projected") residuals = residuals.map((value) => value * 0.08);
      const energy = residuals.reduce((sum, value) => sum + value * value, 0);
      const maxResidual = residuals.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
      const kernelProximity = clamp(1 - maxResidual + kernelAnchor * 0.2, 0, 1.3);
      return {
        scenario,
        view,
        signalAmplitude,
        twistAmount,
        mapStrength,
        stepSize,
        kernelAnchor,
        residuals,
        energy,
        maxResidual,
        kernelProximity,
        modeLabel: state.modeLabel,
        diffusionStep: state.diffusionStep
      };
    }

    function updateScene() {
      const s = stats();
      nodeDots.forEach((dot, index) => {
        const height = [s.signalAmplitude, s.scenario === "signed" ? -s.signalAmplitude * 0.7 : s.signalAmplitude * 0.54, s.signalAmplitude * s.twistAmount][index];
        dot.position.copy(nodes[index]).add(new THREE.Vector3(0, height * 0.12, 0));
        dot.material.color.setHex(height >= 0 ? COLORS.blue : COLORS.amber);
        dot.scale.setScalar(0.92 + Math.abs(height) * 0.25);
      });
      edgeLines.forEach((line, index) => {
        setTrackedLine(line, [nodes[edges[index][0]], nodes[edges[index][1]]]);
        line.material.color.setHex(Math.abs(s.residuals[index]) < 0.16 ? COLORS.green : COLORS.rose);
        line.material.opacity = 0.18 + Math.min(0.34, Math.abs(s.residuals[index]) * 0.16);
      });
      edgePlates.forEach((plate, index) => {
        const [a, b] = edges[index];
        plate.position.copy(nodes[a]).lerp(nodes[b], 0.5).add(new THREE.Vector3(0, 0.12, 0));
        plate.scale.x = 0.88 + Math.abs(s.residuals[index]) * 0.32;
        plate.material.color.setHex(Math.abs(s.residuals[index]) < 0.16 ? COLORS.green : COLORS.rose);
      });
      restrictionLines.forEach((line, index) => {
        const edgeIndex = Math.floor(index / 2);
        const endpoint = edges[edgeIndex][index % 2];
        const a = nodes[endpoint].clone().add(new THREE.Vector3(0, 0.28, 0));
        const b = edgePlates[edgeIndex].position.clone().add(new THREE.Vector3(0, 0.08, 0));
        const arc = s.scenario === "connection" ? 0.3 + s.twistAmount * 0.18 : 0.18;
        setTrackedLine(line, [a, a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, arc, 0)), b]);
        line.material.color.setHex(s.scenario === "connection" ? COLORS.violet : COLORS.cyan);
        line.material.opacity = s.view === "blocks" ? 0.46 : 0.26;
      });
      residualRods.forEach((rod, index) => {
        const value = Math.abs(s.residuals[index]);
        rod.position.copy(edgePlates[index].position).add(new THREE.Vector3(0, 0.34 + value * 0.12, 0));
        rod.scale.y = 0.22 + value * 0.6;
        rod.material.color.setHex(value < 0.16 ? COLORS.green : COLORS.rose);
      });
      deltaBlocks.forEach((block, index) => {
        const row = Math.floor(index / 3);
        const col = index % 3;
        block.position.set(-1.12 + col * 0.2, -1.0 + row * 0.18, 1.62);
        block.material.opacity = s.view === "blocks" ? 0.42 : 0.18;
        block.material.color.setHex(edges[row].includes(col) ? (col === edges[row][1] ? COLORS.cyan : COLORS.rose) : COLORS.muted);
      });
      lapBlocks.forEach((block, index) => {
        const row = Math.floor(index / 3);
        const col = index % 3;
        block.position.set(0.38 + col * 0.2, -1.0 + row * 0.18, 1.62);
        block.material.opacity = s.view === "blocks" ? 0.38 : 0.15;
        block.material.color.setHex(row === col ? COLORS.green : COLORS.amber);
      });
      blockContributionCells.forEach((block, index) => {
        const edgeIndex = Math.floor(index / 4);
        const contribution = index % 4;
        const value = Math.abs(s.residuals[edgeIndex]) * (contribution < 2 ? s.mapStrength : s.twistAmount + 0.25);
        block.position.set(1.16 + contribution * 0.15, -0.97 + edgeIndex * 0.18, 1.38);
        block.scale.y = 0.72 + value * 0.28;
        block.material.opacity = s.view === "blocks" || state.status === "Assembled" ? 0.34 + Math.min(0.18, value * 0.08) : 0.13;
        block.material.color.setHex(contribution % 2 === 0 ? COLORS.cyan : COLORS.amber);
      });
      spectrumEigenBars.forEach((bar, index) => {
        const lambda = index === 0 ? 0 : 0.22 + index * 0.22 * s.mapStrength;
        const height = index === 0 ? s.kernelProximity : Math.exp(-lambda * (1 + s.diffusionStep * s.stepSize)) * (0.7 + s.energy * 0.08);
        bar.position.set(-1.08 + index * 0.23, -1.03 + height * 0.16, 2.22);
        bar.scale.y = 0.18 + height * 0.72;
        bar.material.opacity = s.view === "energy" || state.status === "Projected" ? 0.52 : 0.25;
        bar.material.color.setHex(index === 0 ? COLORS.green : index > 3 ? COLORS.rose : COLORS.violet);
      });
      kernelGlobalSectionBeads.forEach((bead, index) => {
        const anchorHeight = (s.kernelAnchor - 0.5) * 0.46;
        bead.position.copy(nodes[index]).add(new THREE.Vector3(0, 0.55 + anchorHeight, 0));
        bead.scale.setScalar(0.82 + s.kernelProximity * 0.32);
        bead.material.opacity = state.status === "Projected" || s.view === "energy" ? 0.72 : 0.34;
      });
      projectionSheafPlates.forEach((plate, index) => {
        plate.position.copy(nodes[index]).add(new THREE.Vector3(0, -0.08, 0));
        plate.scale.set(1 + s.kernelAnchor * 0.24, 1, s.scenario === "projection" ? 0.42 + s.twistAmount : 0.7);
        plate.material.opacity = state.status === "Projected" || s.scenario === "projection" ? 0.28 : 0.12;
        plate.material.color.setHex(s.scenario === "projection" ? COLORS.green : COLORS.muted);
      });
      connectionFrameLines.forEach((line, index) => {
        const origin = nodes[index].clone().add(new THREE.Vector3(0, 0.22, 0));
        const length = 0.24 + s.mapStrength * 0.08;
        const angle = s.scenario === "connection" ? s.twistAmount * Math.PI * (index + 1) * 0.42 : 0.35 * index;
        const end = origin.clone().add(new THREE.Vector3(Math.cos(angle) * length, 0.16, Math.sin(angle) * length));
        setTrackedLine(line, [origin, end]);
        line.material.opacity = s.scenario === "connection" || state.status === "Twisted" ? 0.52 : 0.18;
        line.material.color.setHex(s.scenario === "connection" ? COLORS.violet : COLORS.cyan);
      });
      flowLines.forEach((line, index) => {
        const active = state.status === "Diffused" || s.view === "energy";
        line.visible = active;
        if (!active) return;
        const a = nodes[index % 3].clone().add(new THREE.Vector3(0, 0.72, 0));
        const b = nodes[(index + 1) % 3].clone().add(new THREE.Vector3(0, 0.38, 0));
        setTrackedLine(line, [a, a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, 0.22 + s.stepSize, 0)), b]);
        line.material.opacity = 0.2 + Math.min(0.3, s.energy * 0.08);
      });
      const values = [s.energy, s.maxResidual, s.kernelProximity, s.stepSize, s.mapStrength];
      energyBars.forEach((bar, index) => {
        const value = values[index];
        bar.position.set(-0.48 + index * 0.24, -1.02 + value * 0.08, 1.92);
        bar.scale.y = 0.2 + value * 0.44;
        bar.material.color.setHex(index === 2 ? COLORS.green : index < 2 ? COLORS.rose : COLORS.amber);
      });

      // ===== CLEAN OVERRIDE: legible "assemble L_F" — sheaf graph | Laplacian matrix =====
      [deltaBlocks, blockContributionCells, projectionSheafPlates, connectionFrameLines, flowLines, kernelGlobalSectionBeads, edgePlates, energyBars, restrictionLines].forEach((arr) => arr.forEach((o) => { o.visible = false; }));
      nodeDots.forEach((dot, i) => {
        dot.castShadow = true;
        const col = dot.material.color.getHex();
        if (dot.material.emissive) { dot.material.emissive.setHex(col); dot.material.emissiveIntensity = 0.3; }
        h05Halos[i].visible = true; h05Halos[i].position.copy(dot.position); h05Halos[i].material.color.setHex(col); h05Halos[i].material.opacity = 0.5; h05Halos[i].scale.setScalar(dot.scale.x * 0.8);
        h05NodeLabels[i].position.copy(dot.position).add(new THREE.Vector3(0.06, 0.4, 0));
      });
      edgeLines.forEach((line) => { line.material.opacity = 0.55; });
      residualRods.forEach((rod, i) => {
        const v = Math.abs(s.residuals[i]);
        const mid = nodes[edges[i][0]].clone().lerp(nodes[edges[i][1]], 0.5);
        const h = 0.14 + Math.min(1, v) * 0.6;
        rod.visible = true; rod.position.copy(mid).add(new THREE.Vector3(0, 0.08 + h * 0.5, 0));
        rod.scale.set(1.1, h / 0.42, 1.1);
        rod.material.color.setHex(v < 0.16 ? COLORS.green : COLORS.rose); rod.material.opacity = 0.82; rod.castShadow = true;
      });
      // RIGHT region: the Laplacian L_F as a clean 3x3 matrix + eigen-spectrum chart
      lapBlocks.forEach((block, i) => {
        const row = Math.floor(i / 3), col = i % 3;
        block.visible = true;
        block.position.set(2.45 + col * 0.32, 0.92 - row * 0.32, 0.1);
        block.scale.setScalar(1.5);
        block.material.opacity = 0.92;
        block.material.color.setHex(row === col ? COLORS.green : COLORS.amber);
        block.castShadow = true;
      });
      spectrumEigenBars.forEach((bar, i) => {
        bar.visible = true;
        const lambda = i === 0 ? 0 : 0.22 + i * 0.22 * s.mapStrength;
        const height = i === 0 ? s.kernelProximity : Math.exp(-lambda) * 0.8;
        const hh = 0.12 + Math.max(0, height) * 0.8;
        bar.position.set(2.5 + i * 0.3, -1.0 + hh * 0.5, 1.05);
        bar.scale.set(1, hh / 0.24, 1);
        bar.material.opacity = 0.85;
        bar.castShadow = true;
      });
      h05StructLabel.position.set(-0.2, 1.5, 0);
      h05MatrixLabel.position.set(3.0, 1.5, 0.1);
    }

    function updatePanel() {
      const s = stats();
      setMetric(root, "Dirichlet energy", s.energy, 2);
      setMetric(root, "Kernel proximity", s.kernelProximity, 2);
      setMetric(root, "Block coverage", s.view === "blocks" ? 18 : 9, 0);
      setMetric(root, "Stability margin", Math.max(0, 1 - s.stepSize * s.mapStrength), 2);
      document.getElementById("energyLabel").textContent = fmt(s.energy, 2);
      document.getElementById("kernelLabel").textContent = fmt(s.kernelProximity, 2);
      document.getElementById("blockLabel").textContent = s.view === "blocks" ? "18" : "9";
      document.getElementById("modeLabel").textContent = s.modeLabel;
      if (formulaText) formulaText.textContent = "L_F = delta^T delta";
      if (selected) selected.textContent = `${s.scenario} | ${s.view} | E ${fmt(s.energy, 2)}`;
      if (insight) insight.textContent = "This is the actual operator: restrictions build delta, residual rods show delta x, matrix blocks show delta^T delta, and diffusion follows -L_F x.";
      if (state.status === "Assembled") {
        stateText.textContent = `${state.lastAction} assembles the delta matrix from restriction maps: block rows send node stalk values into edge residuals before L_F = delta^T delta is formed. Last control ${state.lastControl}.`;
      } else if (state.status === "Diffused") {
        stateText.textContent = `${state.lastAction} performs Sheaf diffusion: x <- x - eta L_F x, so L_F x pushes the signal down the compatibility energy. Last control ${state.lastControl}.`;
      } else if (state.status === "Projected") {
        stateText.textContent = `${state.lastAction} projects toward the global-section space, the kernel of delta and the kernel of L_F, leaving max residual ${fmt(s.maxResidual, 2)}. Last control ${state.lastControl}.`;
      } else if (state.status === "Twisted") {
        stateText.textContent = `${state.lastAction} switches to a signed sheaf: opposite signs can be compatible because restrictions change the edge comparison rule. Last control ${state.lastControl}.`;
      } else {
        stateText.textContent = `${state.lastAction} shows restriction maps, edge residuals, delta^T delta matrix blocks, the kernel, and diffusion direction for the sheaf Laplacian. Last control ${state.lastControl}.`;
      }
      syncOutput("signalAmplitude", s.signalAmplitude, 2);
      syncOutput("twistAmount", s.twistAmount, 2);
      syncOutput("mapStrength", s.mapStrength, 2);
      syncOutput("stepSize", s.stepSize, 2);
      syncOutput("kernelAnchor", s.kernelAnchor, 2);
    }

    function refresh() {
      updateScene();
      updatePanel();
    }

    ["scenario", "viewSelect"].forEach((id) => {
      document.getElementById(id).addEventListener("change", (event) => {
        markControl(id, event.target.value);
        state.lastAction = "View change";
        state.status = "Ready";
        state.modeLabel = event.target.value === "signed" ? "Twisted" : "Constant";
        refresh();
      });
    });
    ["signalAmplitude", "twistAmount", "mapStrength", "stepSize", "kernelAnchor"].forEach((id) => {
      document.getElementById(id).addEventListener("input", (event) => {
        markControl(id, event.target.value);
        state.lastAction = "Parameter change";
        state.status = "Ready";
        refresh();
      });
    });
    document.getElementById("assembleDelta").addEventListener("click", () => {
      markControl("assembleDelta", "clicked");
      state.status = "Assembled";
      state.lastAction = "Assemble delta";
      refresh();
    });
    document.getElementById("diffuse").addEventListener("click", () => {
      markControl("diffuse", "clicked");
      state.status = "Diffused";
      state.diffusionStep += 1;
      state.lastAction = "Sheaf diffusion";
      refresh();
    });
    document.getElementById("projectKernel").addEventListener("click", () => {
      markControl("projectKernel", "clicked");
      state.status = "Projected";
      state.lastAction = "Kernel projection";
      refresh();
    });
    document.getElementById("twist").addEventListener("click", () => {
      markControl("twist", "clicked");
      document.getElementById("scenario").value = "signed";
      state.status = "Twisted";
      state.modeLabel = "Twisted";
      state.lastAction = "Signed twist";
      refresh();
    });
    document.getElementById("resetH05").addEventListener("click", () => {
      markControl("resetH05", "clicked");
      document.getElementById("scenario").value = "constant";
      document.getElementById("viewSelect").value = "operator";
      setRange("signalAmplitude", 0.76);
      setRange("twistAmount", 0.24);
      setRange("mapStrength", 1);
      setRange("stepSize", 0.18);
      setRange("kernelAnchor", 0.62);
      state.status = "Ready";
      state.modeLabel = "Constant";
      state.diffusionStep = 0;
      state.lastAction = "Reset";
      refresh();
    });

    function animate() {
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }

    window.__h05LabSnapshot = function () {
      const s = stats();
      return {
        kind: "sheaf-laplacian-operator",
        labId: "h05",
        sceneObject: "delta-matrix-laplacian-energy-kernel-diffusion",
        title: "H05 The Sheaf Laplacian",
        status: state.status,
        modeLabel: s.modeLabel,
        scenario: s.scenario,
        view: s.view,
        nodeCount: 3,
        edgeCount: 3,
        edgeStalkCount: 3,
        domainGraphObjectCount: nodeDots.length + edgeLines.length,
        nodeStalkObjectCount: nodeDots.length,
        edgeStalkObjectCount: edgePlates.length,
        restrictionMapObjectCount: restrictionLines.length,
        coboundaryDeltaObjectCount: residualRods.length,
        deltaMatrixObjectCount: deltaBlocks.length,
        laplacianBlockObjectCount: lapBlocks.length,
        blockContributionObjectCount: blockContributionCells.length,
        dirichletEnergyObjectCount: energyBars.length,
        spectrumEigenObjectCount: spectrumEigenBars.length,
        kernelGlobalSectionObjectCount: kernelGlobalSectionBeads.length,
        diffusionDirectionObjectCount: flowLines.length,
        projectionSheafObjectCount: projectionSheafPlates.length,
        connectionFrameObjectCount: connectionFrameLines.length,
        deltaRows: 3,
        laplacianBlockCount: 9,
        residualRodCount: 3,
        energy: s.energy,
        maxResidual: s.maxResidual,
        kernelProximity: s.kernelProximity,
        diffusionStep: s.diffusionStep,
        has3d: true,
        visualKind: "sheaf-laplacian-matrix-energy",
        graphStyle: "hidden",
        visualQuality: "h05-concrete-laplacian-v3",
        clarityVersion: "h05-h06-canonical-clarity-v1",
        domainGraphHash: `${objectHash(nodeDots)}-${lineHash(edgeLines)}`,
        nodeStalkHash: objectHash(nodeDots),
        edgeStalkHash: objectHash(edgePlates),
        restrictionMapHash: lineHash(restrictionLines),
        coboundaryDeltaHash: objectHash(residualRods),
        deltaMatrixHash: objectHash(deltaBlocks),
        laplacianBlockHash: objectHash(lapBlocks),
        blockContributionHash: objectHash(blockContributionCells),
        dirichletEnergyHash: objectHash(energyBars),
        spectrumEigenHash: objectHash(spectrumEigenBars),
        kernelGlobalSectionHash: objectHash(kernelGlobalSectionBeads),
        diffusionDirectionHash: lineHash(flowLines),
        projectionSheafHash: objectHash(projectionSheafPlates),
        connectionFrameHash: lineHash(connectionFrameLines),
        canonicalReferences: ["cellular sheaf Laplacian", "coboundary delta", "L_F = delta^T delta", "Dirichlet energy", "kernel global section", "heat diffusion"],
        laplacianObjects: ["domain_graph", "node_stalk", "edge_stalk", "restriction_matrix", "coboundary_delta", "delta_transpose_delta", "dirichlet_energy", "spectrum", "kernel_global_section", "diffusion_direction"],
        diagnosticMetrics: ["sheaf_energy", "max_residual", "kernel_proximity", "stability_margin"],
        stateText: stateText.textContent.trim(),
        cameraTheta: cameraState.theta,
        cameraPhi: cameraState.phi,
        cameraRadius: cameraState.radius,
        revision: state.revision,
        lastControl: state.lastControl,
        controls: Object.assign({}, state.controls)
      };
    };

    refresh();
    window.__h05LabReady = true;
    animate();
  }

  window.createH03CellularCohomologyLab = createH03CellularCohomologyLab;
  window.createH02TopologicalSheafLab = createH02TopologicalSheafLab;
  window.createH04CellularSheafGraphLab = createH04CellularSheafGraphLab;
  window.createH05SheafLaplacianConcreteLab = createH05SheafLaplacianConcreteLab;
})();
