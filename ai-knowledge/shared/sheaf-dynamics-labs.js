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
    if (strong) strong.textContent = typeof value === "string" ? value : fmt(value, digits);
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
    return new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 16), material(color, opacity == null ? 1 : opacity));
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

  function setupScene(canvas, distance) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor(COLORS.bg, 1);
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x061015, 8, 16);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
    const cameraState = { theta: -0.74, phi: 0.58, radius: distance || 8.8, dragging: false, x: 0, y: 0 };

    const ambient = new THREE.AmbientLight(0xffffff, 0.62);
    const key = new THREE.DirectionalLight(0xefffff, 1.25);
    key.position.set(3, 5, 4);
    const fill = new THREE.PointLight(0x58e0d3, 1.05, 12);
    fill.position.set(-3, 2, -4);
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
      cameraState.theta -= dx * 0.008;
      cameraState.phi = clamp(cameraState.phi + dy * 0.006, -0.1, 1.18);
      cameraState.x = event.clientX;
      cameraState.y = event.clientY;
      placeCamera();
    });
    canvas.addEventListener("pointerup", () => {
      cameraState.dragging = false;
    });
    canvas.addEventListener("wheel", (event) => {
      event.preventDefault();
      cameraState.radius = clamp(cameraState.radius + event.deltaY * 0.006, 4.4, 13.5);
      placeCamera();
    }, { passive: false });

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvas.parentElement);
    resize();
    placeCamera();

    function grid(width, depth, y) {
      for (let i = -4; i <= 4; i += 1) {
        scene.add(makeLine([new THREE.Vector3(-width, y, i * depth / 4), new THREE.Vector3(width, y, i * depth / 4)], COLORS.ink, 0.055));
        scene.add(makeLine([new THREE.Vector3(i * width / 4, y, -depth), new THREE.Vector3(i * width / 4, y, depth)], COLORS.ink, 0.045));
      }
    }

    return { renderer, scene, camera, cameraState, grid };
  }

  function createH06SheafDiffusionConcreteLab() {
    const root = document.querySelector('[data-lab-id="h06"]');
    const canvas = document.getElementById("canvas");
    if (!root || !canvas) return;
    const { renderer, scene, camera, cameraState, grid } = setupScene(canvas, 8.9);
    const selected = root.querySelector('[data-role="selected"] strong');
    const insight = root.querySelector('[data-role="insight"]');
    const stateText = document.getElementById("state");
    const formulaText = document.getElementById("formulaText");
    const state = { status: "Ready", revision: 0, lastControl: "initial", lastAction: "Ready", heatStep: 0, controls: {} };
    const nodePositions = [
      new THREE.Vector3(-2.05, 0.0, -0.72),
      new THREE.Vector3(-0.72, 0.0, 0.92),
      new THREE.Vector3(0.95, 0.0, 0.72),
      new THREE.Vector3(2.05, 0.0, -0.78)
    ];
    const edges = [[0, 1], [1, 2], [2, 3], [0, 3]];
    const nodeDots = nodePositions.map((position, index) => {
      const dot = makeSphere(0.16, [COLORS.blue, COLORS.cyan, COLORS.amber, COLORS.violet][index], 0.94);
      dot.position.copy(position);
      scene.add(dot);
      return dot;
    });
    const signalBars = nodePositions.map((position, index) => {
      const bar = makeBox([0.12, 0.48, 0.12], [COLORS.blue, COLORS.cyan, COLORS.amber, COLORS.violet][index], 0.42);
      bar.position.copy(position).add(new THREE.Vector3(0, 0.42, 0));
      scene.add(bar);
      return bar;
    });
    const edgeLines = edges.map(([a, b]) => {
      const line = makeLine([nodePositions[a], nodePositions[b]], COLORS.ink, 0.18);
      scene.add(line);
      return line;
    });
    const edgeStalks = edges.map(([a, b]) => {
      const plate = makeBox([0.52, 0.04, 0.22], COLORS.green, 0.3);
      plate.position.copy(nodePositions[a]).lerp(nodePositions[b], 0.5).add(new THREE.Vector3(0, 0.1, 0));
      scene.add(plate);
      return plate;
    });
    const restrictionLines = Array.from({ length: 8 }, () => {
      const line = makeLine([], COLORS.cyan, 0.24);
      scene.add(line);
      return line;
    });
    const residualRods = edges.map(() => {
      const rod = makeBox([0.08, 0.36, 0.08], COLORS.rose, 0.42);
      scene.add(rod);
      return rod;
    });
    const spectralBars = Array.from({ length: 7 }, (_, index) => {
      const bar = makeBox([0.14, 0.34, 0.14], index === 0 ? COLORS.green : COLORS.amber, 0.4);
      scene.add(bar);
      return bar;
    });
    const heatTrace = makeLine([], COLORS.blue, 0.56);
    scene.add(heatTrace);
    const harmonicSurface = makeSphere(0.58, COLORS.green, 0.18);
    harmonicSurface.scale.set(1.8, 0.08, 0.74);
    scene.add(harmonicSurface);
    const matrixBlocks = Array.from({ length: 16 }, (_, index) => {
      const block = makeBox([0.1, 0.1, 0.1], index % 5 === 0 ? COLORS.green : COLORS.cyan, 0.2);
      scene.add(block);
      return block;
    });
    const laplacianFlowLines = edges.map(() => {
      const line = makeLine([], COLORS.amber, 0.24);
      scene.add(line);
      return line;
    });
    const messagePullbackLines = edges.map(() => {
      const line = makeLine([], COLORS.violet, 0.22);
      scene.add(line);
      return line;
    });
    const dampingEnvelopeBars = Array.from({ length: 7 }, (_, index) => {
      const bar = makeBox([0.06, 0.24, 0.06], index === 0 ? COLORS.green : COLORS.blue, 0.24);
      scene.add(bar);
      return bar;
    });
    const globalSectionLimitBeads = nodePositions.map(() => {
      const bead = makeSphere(0.08, COLORS.green, 0.58);
      scene.add(bead);
      return bead;
    });
    const signedEquilibriumBars = nodePositions.map(() => {
      const bar = makeBox([0.09, 0.26, 0.09], COLORS.green, 0.3);
      scene.add(bar);
      return bar;
    });
    const ordinaryDiffusionComparisonBars = nodePositions.map(() => {
      const bar = makeBox([0.08, 0.22, 0.08], COLORS.rose, 0.22);
      scene.add(bar);
      return bar;
    });
    const stabilityStepBlocks = Array.from({ length: 3 }, (_, index) => {
      const block = makeBox([0.16, 0.1, 0.16], index === 1 ? COLORS.green : COLORS.amber, 0.28);
      scene.add(block);
      return block;
    });
    const normalizationBlocks = Array.from({ length: 3 }, (_, index) => {
      const block = makeBox([0.18, 0.06, 0.18], index === 0 ? COLORS.blue : COLORS.cyan, 0.24);
      scene.add(block);
      return block;
    });
    grid(3.05, 1.55, -1.12);

    function markControl(id, value) {
      state.revision += 1;
      state.lastControl = id;
      state.controls[id] = value == null ? "clicked" : String(value);
    }

    function sheafSigns(preset) {
      if (preset === "signed") return [[1, -1], [1, -1], [1, 1], [1, -1]];
      if (preset === "projection") return [[1, 0.48], [0.48, 1], [1, 0.48], [0.48, 0.48]];
      if (preset === "rotation") return [[1, -0.64], [0.8, -1], [1, 0.56], [0.72, -0.72]];
      return [[1, 1], [1, 1], [1, 1], [1, 1]];
    }

    function stats() {
      const preset = selectValue("sheafPreset", "constant");
      const view = selectValue("viewSelect", "heat");
      const diffusionTime = rangeValue("diffusionTime", 4);
      const spectralGap = rangeValue("spectralGap", 0.9);
      const noiseLevel = rangeValue("noiseLevel", 0.22);
      const visibleModes = rangeValue("visibleModes", 4);
      const harmonicWeight = rangeValue("harmonicWeight", 0.58);
      const signs = sheafSigns(preset);
      const raw = [
        1 + noiseLevel * 0.55,
        preset === "signed" ? -0.84 + noiseLevel * 0.18 : 0.46 + noiseLevel * 0.32,
        preset === "rotation" ? -0.36 + noiseLevel * 0.2 : 0.18 - noiseLevel * 0.24,
        preset === "signed" ? 0.9 - noiseLevel * 0.22 : -0.28 + noiseLevel * 0.2
      ];
      const damping = state.status === "Heat step" ? Math.exp(-0.18 * diffusionTime * spectralGap) : 1;
      const projectionFactor = state.status === "Projected" ? 0.08 : 1;
      const residuals = edges.map(([a, b], index) => {
        const mismatch = signs[index][0] * raw[a] - signs[index][1] * raw[b];
        return mismatch * damping * projectionFactor * (1 - harmonicWeight * 0.22);
      });
      const energy = residuals.reduce((sum, value) => sum + value * value, 0);
      const maxResidual = residuals.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
      const spectralDamping = clamp(1 - Math.exp(-0.16 * diffusionTime * spectralGap), 0, 1);
      const harmonicMass = clamp(harmonicWeight + (state.status === "Projected" ? 0.22 : 0) - noiseLevel * 0.1, 0, 1.15);
      const stableMargin = clamp(1.4 - spectralGap * 0.38 - noiseLevel * 0.28, -0.4, 1.4);
      return {
        preset,
        view,
        diffusionTime,
        spectralGap,
        noiseLevel,
        visibleModes,
        harmonicWeight,
        raw,
        residuals,
        energy,
        maxResidual,
        spectralDamping,
        harmonicMass,
        stableMargin
      };
    }

    function updateScene() {
      const s = stats();
      nodeDots.forEach((dot, index) => {
        const height = s.raw[index] * (state.status === "Heat step" ? 0.78 : 1);
        dot.position.copy(nodePositions[index]).add(new THREE.Vector3(0, height * 0.14, 0));
        dot.scale.setScalar(1.02 + Math.abs(height) * 0.22);
        dot.material.color.setHex(height >= 0 ? COLORS.blue : COLORS.amber);
      });
      signalBars.forEach((bar, index) => {
        const value = s.raw[index] * (state.status === "Projected" ? 0.62 : 1);
        bar.position.copy(nodePositions[index]).add(new THREE.Vector3(0, 0.26 + Math.abs(value) * 0.22, 0));
        bar.scale.y = 0.36 + Math.abs(value) * 0.92;
        bar.material.color.setHex(value >= 0 ? COLORS.cyan : COLORS.amber);
        bar.material.opacity = 0.34 + Math.min(0.32, Math.abs(value) * 0.14);
      });
      edgeLines.forEach((line, index) => {
        setTrackedLine(line, [nodePositions[edges[index][0]], nodePositions[edges[index][1]]]);
        line.material.color.setHex(Math.abs(s.residuals[index]) < 0.18 ? COLORS.green : COLORS.rose);
        line.material.opacity = 0.18 + Math.min(0.36, Math.abs(s.residuals[index]) * 0.12);
      });
      edgeStalks.forEach((plate, index) => {
        const [a, b] = edges[index];
        plate.position.copy(nodePositions[a]).lerp(nodePositions[b], 0.5).add(new THREE.Vector3(0, 0.11, 0));
        plate.scale.x = 0.86 + Math.abs(s.residuals[index]) * 0.18;
        plate.material.color.setHex(Math.abs(s.residuals[index]) < 0.18 ? COLORS.green : COLORS.rose);
      });
      restrictionLines.forEach((line, index) => {
        const edgeIndex = Math.floor(index / 2);
        const endpoint = edges[edgeIndex][index % 2];
        const a = nodePositions[endpoint].clone().add(new THREE.Vector3(0, 0.44, 0));
        const b = edgeStalks[edgeIndex].position.clone().add(new THREE.Vector3(0, 0.12, 0));
        const bend = s.preset === "rotation" ? 0.36 : 0.24;
        setTrackedLine(line, [a, a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, bend, 0)), b]);
        line.material.opacity = s.view === "residuals" ? 0.46 : 0.24;
        line.material.color.setHex(s.preset === "rotation" ? COLORS.violet : COLORS.cyan);
      });
      residualRods.forEach((rod, index) => {
        const value = Math.abs(s.residuals[index]);
        rod.position.copy(edgeStalks[index].position).add(new THREE.Vector3(0, 0.32 + value * 0.08, 0));
        rod.scale.y = 0.18 + value * 0.5;
        rod.material.color.setHex(value < 0.18 ? COLORS.green : COLORS.rose);
        rod.material.opacity = s.view === "heat" ? 0.34 : 0.52;
      });
      spectralBars.forEach((bar, index) => {
        const active = index < s.visibleModes;
        const lambda = index === 0 ? 0 : 0.24 + index * 0.18 * s.spectralGap;
        const amplitude = index === 0 ? s.harmonicMass : Math.exp(-s.diffusionTime * lambda * 0.34) * (1 + s.noiseLevel);
        bar.position.set(-0.98 + index * 0.28, -0.96 + amplitude * 0.18, 1.82);
        bar.scale.y = active ? 0.18 + amplitude * 0.85 : 0.08;
        bar.material.opacity = active ? (s.view === "spectrum" ? 0.58 : 0.3) : 0.08;
        bar.material.color.setHex(index === 0 ? COLORS.green : index > 4 ? COLORS.rose : COLORS.amber);
      });
      const tracePoints = [];
      for (let i = 0; i < 16; i += 1) {
        const t = i / 15;
        const y = -0.48 + Math.exp(-t * s.diffusionTime * s.spectralGap * 0.52) * 0.86 + s.harmonicMass * 0.16;
        tracePoints.push(new THREE.Vector3(0.86 + t * 1.62, y, 1.84 - t * 0.34));
      }
      setTrackedLine(heatTrace, tracePoints);
      heatTrace.material.opacity = s.view === "heat" || state.status === "Heat step" ? 0.72 : 0.34;
      harmonicSurface.position.set(1.52, -0.62 + s.harmonicMass * 0.18, -1.36);
      harmonicSurface.scale.set(1.45 + s.harmonicMass * 0.55, 0.08, 0.72);
      harmonicSurface.material.opacity = s.view === "kernel" || state.status === "Projected" ? 0.28 : 0.16;
      matrixBlocks.forEach((block, index) => {
        const row = Math.floor(index / 4);
        const col = index % 4;
        block.position.set(-2.2 + col * 0.16, -0.96 + row * 0.16, 1.72);
        block.material.opacity = s.view === "matrix" ? 0.42 : 0.16;
        block.material.color.setHex(row === col ? COLORS.green : Math.abs(row - col) === 1 ? COLORS.cyan : COLORS.muted);
      });
      laplacianFlowLines.forEach((line, index) => {
        const from = nodePositions[index].clone().add(new THREE.Vector3(0, 0.72 + Math.abs(s.raw[index]) * 0.12, 0));
        const to = nodePositions[index].clone().add(new THREE.Vector3(0, 0.28 + s.harmonicMass * 0.18, 0));
        const mid = from.clone().lerp(to, 0.5).add(new THREE.Vector3(0.18 * (index % 2 ? -1 : 1), 0.18, 0));
        setTrackedLine(line, [from, mid, to]);
        line.material.opacity = state.status === "Heat step" || s.view === "heat" ? 0.52 : 0.2;
        line.material.color.setHex(COLORS.amber);
      });
      messagePullbackLines.forEach((line, index) => {
        const [a, b] = edges[index];
        const from = edgeStalks[index].position.clone().add(new THREE.Vector3(0, 0.48 + Math.abs(s.residuals[index]) * 0.08, 0));
        const to = nodePositions[Math.abs(s.raw[a]) > Math.abs(s.raw[b]) ? a : b].clone().add(new THREE.Vector3(0, 0.46, 0));
        const mid = from.clone().lerp(to, 0.5).add(new THREE.Vector3(0, 0.22, 0));
        setTrackedLine(line, [from, mid, to]);
        line.material.opacity = state.status === "Residuals" || state.status === "Heat step" ? 0.48 : 0.18;
        line.material.color.setHex(s.preset === "signed" ? COLORS.violet : COLORS.cyan);
      });
      dampingEnvelopeBars.forEach((bar, index) => {
        const lambda = index === 0 ? 0 : 0.2 + index * 0.16 * s.spectralGap;
        const envelope = index === 0 ? 1 : Math.exp(-s.diffusionTime * lambda * 0.34);
        bar.position.set(-0.98 + index * 0.28, -0.76 + envelope * 0.16, 2.08);
        bar.scale.y = 0.12 + envelope * 0.58;
        bar.material.opacity = s.view === "spectrum" ? 0.44 : 0.2;
        bar.material.color.setHex(index === 0 ? COLORS.green : COLORS.blue);
      });
      globalSectionLimitBeads.forEach((bead, index) => {
        const sign = s.preset === "signed" && index % 2 === 1 ? -1 : 1;
        bead.position.copy(nodePositions[index]).add(new THREE.Vector3(0, 0.5 + sign * s.harmonicMass * 0.12, -0.16));
        bead.scale.setScalar(0.82 + s.harmonicMass * 0.3);
        bead.material.opacity = state.status === "Projected" || s.view === "kernel" ? 0.7 : 0.32;
      });
      signedEquilibriumBars.forEach((bar, index) => {
        const signedValue = s.preset === "signed" && index % 2 === 1 ? -s.harmonicMass : s.harmonicMass;
        bar.position.copy(nodePositions[index]).add(new THREE.Vector3(-0.18, 0.24 + Math.abs(signedValue) * 0.18, -0.26));
        bar.scale.y = 0.24 + Math.abs(signedValue) * 0.72;
        bar.material.opacity = s.preset === "signed" ? 0.44 : 0.18;
        bar.material.color.setHex(signedValue >= 0 ? COLORS.green : COLORS.amber);
      });
      ordinaryDiffusionComparisonBars.forEach((bar, index) => {
        const average = s.raw.reduce((sum, value) => sum + value, 0) / s.raw.length;
        bar.position.copy(nodePositions[index]).add(new THREE.Vector3(0.18, 0.18 + Math.abs(average) * 0.12, -0.34));
        bar.scale.y = 0.2 + Math.abs(average) * 0.58;
        bar.material.opacity = s.preset === "signed" || s.view === "kernel" ? 0.32 : 0.16;
        bar.material.color.setHex(COLORS.rose);
      });
      stabilityStepBlocks.forEach((block, index) => {
        const value = [s.spectralGap, s.stableMargin, s.diffusionTime / 12][index];
        block.position.set(1.04 + index * 0.24, -1.04 + value * 0.08, 2.26);
        block.scale.y = 0.6 + Math.max(0, value) * 0.28;
        block.material.opacity = 0.2 + (index === 1 ? Math.max(0, s.stableMargin) * 0.14 : 0.1);
        block.material.color.setHex(index === 1 && s.stableMargin > 0.25 ? COLORS.green : COLORS.amber);
      });
      normalizationBlocks.forEach((block, index) => {
        const value = [s.energy, s.maxResidual, s.harmonicMass][index];
        block.position.set(1.82 + index * 0.2, -1.02 + value * 0.05, 2.26);
        block.scale.y = 0.65 + Math.min(1.2, value) * 0.24;
        block.material.opacity = state.status === "Projected" || s.view === "kernel" ? 0.42 : 0.2;
        block.material.color.setHex(index === 2 ? COLORS.green : COLORS.cyan);
      });
    }

    function updatePanel() {
      const s = stats();
      setMetric(root, "Energy decay", Math.max(0, 1.8 - s.energy), 2);
      setMetric(root, "Harmonic mass", s.harmonicMass, 2);
      setMetric(root, "Spectral damping", s.spectralDamping, 2);
      setMetric(root, "Step stability", s.stableMargin, 2);
      document.getElementById("energy").textContent = fmt(s.energy, 2);
      document.getElementById("kernelLabel").textContent = fmt(s.harmonicMass, 2);
      document.getElementById("modeLabel").textContent = state.status;
      document.getElementById("residualLabel").textContent = fmt(s.maxResidual, 2);
      if (formulaText) formulaText.textContent = "x(t)=exp(-t L_F)x0";
      if (selected) selected.textContent = `${s.preset} sheaf | ${s.view} | E ${fmt(s.energy, 2)}`;
      if (insight) insight.textContent = "The concrete object is the heat equation on stalk-valued signals: restrictions create edge residuals, L_F damps non-harmonic spectral modes, and the zero mode is the global section.";
      if (state.status === "Heat step") {
        stateText.textContent = `${state.lastAction}: one heat-equation update follows -L_F x and the curve x(t)=exp(-t L_F)x0 damps incompatible spectral modes while keeping the global section visible. Last control ${state.lastControl}.`;
      } else if (state.status === "Projected") {
        stateText.textContent = `${state.lastAction}: projection removes edge residual mismatch and leaves the harmonic global section in ker L_F instead of forcing raw node equality. Last control ${state.lastControl}.`;
      } else if (state.status === "Residuals") {
        stateText.textContent = `${state.lastAction}: every edge residual is rho_u x_u - rho_v x_v, pulled back by delta^T before diffusion changes the node stalk signal. Last control ${state.lastControl}.`;
      } else {
        stateText.textContent = `${state.lastAction}: ${s.preset} sheaf diffusion shows the heat equation, edge residual rods, spectral damping bars, heat trace, and global section limit. Last control ${state.lastControl}.`;
      }
      syncOutput("diffusionTime", s.diffusionTime, 0);
      syncOutput("spectralGap", s.spectralGap, 2);
      syncOutput("noiseLevel", s.noiseLevel, 2);
      syncOutput("visibleModes", s.visibleModes, 0);
      syncOutput("harmonicWeight", s.harmonicWeight, 2);
    }

    function refresh() {
      updateScene();
      updatePanel();
    }

    ["sheafPreset", "viewSelect"].forEach((id) => {
      document.getElementById(id).addEventListener("change", (event) => {
        markControl(id, event.target.value);
        state.status = "Ready";
        state.lastAction = "View change";
        refresh();
      });
    });
    ["diffusionTime", "spectralGap", "noiseLevel", "visibleModes", "harmonicWeight"].forEach((id) => {
      document.getElementById(id).addEventListener("input", (event) => {
        markControl(id, event.target.value);
        state.status = "Ready";
        state.lastAction = "Parameter change";
        refresh();
      });
    });
    document.getElementById("edgeResidual").addEventListener("click", () => {
      markControl("edgeResidual", "clicked");
      state.status = "Residuals";
      state.lastAction = "Inspect residuals";
      document.getElementById("viewSelect").value = "residuals";
      refresh();
    });
    document.getElementById("runHeat").addEventListener("click", () => {
      markControl("runHeat", "clicked");
      state.status = "Heat step";
      state.heatStep += 1;
      state.lastAction = "Heat step";
      document.getElementById("viewSelect").value = "heat";
      refresh();
    });
    document.getElementById("projectGlobal").addEventListener("click", () => {
      markControl("projectGlobal", "clicked");
      state.status = "Projected";
      state.lastAction = "Project global section";
      document.getElementById("viewSelect").value = "kernel";
      refresh();
    });
    document.getElementById("resetH06").addEventListener("click", () => {
      markControl("resetH06", "clicked");
      document.getElementById("sheafPreset").value = "constant";
      document.getElementById("viewSelect").value = "heat";
      setRange("diffusionTime", 4);
      setRange("spectralGap", 0.9);
      setRange("noiseLevel", 0.22);
      setRange("visibleModes", 4);
      setRange("harmonicWeight", 0.58);
      state.status = "Ready";
      state.heatStep = 0;
      state.lastAction = "Reset";
      refresh();
    });

    function animate() {
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }

    window.__h06LabSnapshot = function () {
      const s = stats();
      return {
        kind: "sheaf-heat-equation-diffusion",
        labId: "h06",
        sceneObject: "stalk-signal-edge-residual-spectrum-heat-trace-global-section",
        title: "H06 Sheaf Diffusion",
        status: state.status,
        preset: s.preset,
        view: s.view,
        nodeStalkCount: 4,
        edgeCount: 4,
        edgeResidualCount: 4,
        nodeStalkObjectCount: nodeDots.length,
        edgeResidualObjectCount: residualRods.length,
        restrictionTransportObjectCount: restrictionLines.length,
        laplacianFlowObjectCount: laplacianFlowLines.length,
        heatTraceObjectCount: 16,
        spectralModeObjectCount: spectralBars.length,
        dampingEnvelopeObjectCount: dampingEnvelopeBars.length,
        globalSectionLimitObjectCount: globalSectionLimitBeads.length,
        signedEquilibriumObjectCount: signedEquilibriumBars.length,
        ordinaryDiffusionComparisonObjectCount: ordinaryDiffusionComparisonBars.length,
        stabilityStepObjectCount: stabilityStepBlocks.length,
        messagePullbackObjectCount: messagePullbackLines.length,
        normalizationObjectCount: normalizationBlocks.length,
        restrictionMapCount: 8,
        spectralModeCount: 7,
        visibleModeCount: s.visibleModes,
        heatTracePointCount: 16,
        energy: s.energy,
        maxResidual: s.maxResidual,
        harmonicMass: s.harmonicMass,
        spectralDamping: s.spectralDamping,
        stableMargin: s.stableMargin,
        heatStep: state.heatStep,
        has3d: true,
        visualKind: "sheaf-diffusion-heat-spectrum",
        graphStyle: "reference",
        visualQuality: "h06-concrete-heat-equation-v2",
        clarityVersion: "h05-h06-canonical-clarity-v1",
        nodeStalkHash: `${objectHash(nodeDots)}-${objectHash(signalBars)}`,
        edgeResidualHash: objectHash(residualRods),
        restrictionTransportHash: lineHash(restrictionLines),
        laplacianFlowHash: lineHash(laplacianFlowLines),
        heatTraceHash: lineHash([heatTrace]),
        spectralModeHash: objectHash(spectralBars),
        dampingEnvelopeHash: objectHash(dampingEnvelopeBars),
        globalSectionLimitHash: `${objectHash(globalSectionLimitBeads)}-${objectHash([harmonicSurface])}`,
        signedEquilibriumHash: objectHash(signedEquilibriumBars),
        ordinaryDiffusionComparisonHash: objectHash(ordinaryDiffusionComparisonBars),
        stabilityStepHash: objectHash(stabilityStepBlocks),
        messagePullbackHash: lineHash(messagePullbackLines),
        normalizationHash: objectHash(normalizationBlocks),
        canonicalReferences: ["sheaf heat equation", "edge residual delta x", "pullback message delta^T", "spectral damping exp(-t lambda)", "harmonic global section", "Euler stability"],
        diffusionObjects: ["sheaf_heat_equation", "edge_residual", "restriction_transport", "pullback_message", "spectral_damping", "global_section_limit", "signed_equilibrium", "stability_condition"],
        diagnosticMetrics: ["energy", "max_residual", "spectral_damping", "visible_modes", "harmonic_mass", "stable_margin"],
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
    window.__h06LabReady = true;
    animate();
  }

  function createH07SheafNeuralNetworkConcreteLab() {
    const root = document.querySelector('[data-lab-id="h07"]');
    const canvas = document.getElementById("canvas");
    if (!root || !canvas) return;
    const { renderer, scene, camera, cameraState, grid } = setupScene(canvas, 9.2);
    const selected = root.querySelector('[data-role="selected"] strong');
    const insight = root.querySelector('[data-role="insight"]');
    const stateText = document.getElementById("stateBox");
    const formulaText = document.getElementById("formulaText");
    const state = { status: "Ready", revision: 0, lastControl: "initial", lastAction: "Ready", learned: false, messagePassed: false, layerStep: 0, controls: {} };
    const nodeCenters = [
      new THREE.Vector3(-2.72, 0, 0.86),
      new THREE.Vector3(-2.72, 0, -0.24),
      new THREE.Vector3(-2.72, 0, -1.28),
      new THREE.Vector3(1.72, 0, -0.22)
    ];
    const featureTowers = [];
    nodeCenters.forEach((center, nodeIndex) => {
      for (let channel = 0; channel < 3; channel += 1) {
        const bar = makeBox([0.11, 0.32, 0.11], [COLORS.blue, COLORS.cyan, COLORS.amber][channel], 0.44);
        bar.position.copy(center).add(new THREE.Vector3(channel * 0.16 - 0.16, 0.3, 0));
        scene.add(bar);
        featureTowers.push({ bar, nodeIndex, channel });
      }
    });
    const predictor = makeBox([0.74, 0.36, 0.42], COLORS.violet, 0.34);
    predictor.position.set(-0.86, 0.42, 1.28);
    scene.add(predictor);
    const targetUpdate = makeBox([0.82, 0.34, 0.5], COLORS.green, 0.32);
    targetUpdate.position.set(2.64, 0.42, -0.22);
    scene.add(targetUpdate);
    const edgeChambers = [
      new THREE.Vector3(-0.62, 0.08, 0.66),
      new THREE.Vector3(-0.62, 0.08, -0.22),
      new THREE.Vector3(-0.62, 0.08, -1.04)
    ].map((position) => {
      const chamber = makeBox([0.58, 0.08, 0.3], COLORS.green, 0.28);
      chamber.position.copy(position);
      scene.add(chamber);
      return chamber;
    });
    const restrictionLines = Array.from({ length: 8 }, () => {
      const line = makeLine([], COLORS.cyan, 0.25);
      scene.add(line);
      return line;
    });
    const messageLines = Array.from({ length: 8 }, () => {
      const line = makeLine([], COLORS.amber, 0.24);
      scene.add(line);
      return line;
    });
    const aggregateBars = Array.from({ length: 5 }, (_, index) => {
      const bar = makeBox([0.12, 0.3, 0.12], index < 3 ? COLORS.blue : COLORS.green, 0.42);
      scene.add(bar);
      return bar;
    });
    const lossBlocks = Array.from({ length: 6 }, (_, index) => {
      const block = makeBox([0.12, 0.16, 0.12], index < 3 ? COLORS.rose : COLORS.green, 0.36);
      scene.add(block);
      return block;
    });
    const mapFamilyDiagnostics = Array.from({ length: 5 }, (_, index) => {
      const marker = makeBox([0.08, 0.18, 0.08], [COLORS.blue, COLORS.cyan, COLORS.violet, COLORS.green, COLORS.rose][index], 0.26);
      scene.add(marker);
      return marker;
    });
    const identityBaselineBars = Array.from({ length: 3 }, () => {
      const bar = makeBox([0.08, 0.22, 0.08], COLORS.rose, 0.22);
      scene.add(bar);
      return bar;
    });
    const learnedMapConstraintBlocks = Array.from({ length: 5 }, (_, index) => {
      const block = makeBox([0.1, 0.08, 0.1], index === 2 ? COLORS.green : COLORS.violet, 0.24);
      scene.add(block);
      return block;
    });
    const comparisonLane = makeLine([], COLORS.rose, 0.32);
    const sheafComparisonLane = makeLine([], COLORS.green, 0.24);
    scene.add(comparisonLane);
    scene.add(sheafComparisonLane);
    grid(3.15, 1.7, -1.12);

    function markControl(id, value) {
      state.revision += 1;
      state.lastControl = id;
      state.controls[id] = value == null ? "clicked" : String(value);
    }

    function familyNorm(family) {
      if (family === "scalar") return 0.62;
      if (family === "diagonal") return 0.82;
      if (family === "orthogonal") return 1.0;
      if (family === "projection") return 0.48;
      return 1.22;
    }

    function stats() {
      const mode = selectValue("mode", "architecture");
      const mapFamily = selectValue("mapFamily", "diagonal");
      const comparison = selectValue("comparison", "sheaf");
      const layerDepth = rangeValue("layerDepth", 3);
      const relationSharpness = rangeValue("relationSharpness", 1);
      const relationNoise = rangeValue("relationNoise", 0.28);
      const neighborBudget = rangeValue("neighborBudget", 4);
      const selfWeight = rangeValue("selfWeight", 0.52);
      const activeNeighborCount = Math.min(6, Math.round(neighborBudget));
      const learnedBonus = state.learned ? 0.28 : 0;
      const mapAgreement = clamp(0.56 + relationSharpness * 0.12 - relationNoise * 0.28 + learnedBonus, 0.12, 0.98);
      const mapNorm = familyNorm(mapFamily);
      const baseEnergy = (1.18 - mapAgreement + relationNoise * 0.56) * (1.12 - selfWeight * 0.28);
      const sheafEnergy = Math.max(0.05, baseEnergy * (state.messagePassed ? 0.68 : 1) * (state.layerStep > 0 && comparison === "sheaf" ? 0.72 : 1));
      const graphEnergy = Math.max(0.08, 1.12 + relationNoise * 0.5 - selfWeight * 0.18);
      const messageQuality = clamp(mapAgreement * 0.66 + activeNeighborCount * 0.055 + selfWeight * 0.14 + (state.messagePassed ? 0.1 : 0), 0, 1.15);
      const compatibilityGain = clamp((graphEnergy - sheafEnergy) / graphEnergy + 0.16, 0, 1.2);
      const oversmoothing = comparison === "graph"
        ? clamp(0.3 + layerDepth * 0.075 + relationNoise * 0.1, 0, 1.25)
        : clamp(0.12 + layerDepth * 0.028 + (1 - selfWeight) * 0.08, 0, 0.7);
      const regularity = clamp(1.05 - Math.abs(mapNorm - 0.92) * 0.32 - relationNoise * 0.22, 0, 1.1);
      return {
        mode,
        mapFamily,
        comparison,
        layerDepth,
        relationSharpness,
        relationNoise,
        neighborBudget,
        selfWeight,
        activeNeighborCount,
        mapAgreement,
        mapNorm,
        sheafEnergy,
        graphEnergy,
        messageQuality,
        compatibilityGain,
        oversmoothing,
        regularity
      };
    }

    function updateScene() {
      const s = stats();
      featureTowers.forEach(({ bar, nodeIndex, channel }) => {
        const roleShift = nodeIndex === 3 ? 0.2 : nodeIndex * 0.12;
        const height = 0.36 + (channel + 1) * 0.12 + s.relationNoise * 0.22 + roleShift;
        bar.scale.y = height * (nodeIndex === 3 ? 1 + s.selfWeight * 0.4 : 1);
        bar.position.copy(nodeCenters[nodeIndex]).add(new THREE.Vector3(channel * 0.16 - 0.16, 0.16 + height * 0.18, 0));
        bar.material.opacity = nodeIndex < s.activeNeighborCount ? 0.5 : 0.16;
      });
      predictor.scale.set(1 + s.relationSharpness * 0.08, 1 + s.mapNorm * 0.1, 1);
      predictor.material.color.setHex(s.mapFamily === "orthogonal" ? COLORS.violet : s.mapFamily === "projection" ? COLORS.green : COLORS.cyan);
      targetUpdate.scale.set(1 + s.messageQuality * 0.14, 1 + s.selfWeight * 0.18, 1);
      targetUpdate.material.opacity = state.messagePassed ? 0.46 : 0.28;
      edgeChambers.forEach((chamber, index) => {
        const active = index < Math.min(3, s.activeNeighborCount);
        chamber.scale.x = 0.82 + s.mapAgreement * 0.34;
        chamber.scale.y = 0.85 + s.mapNorm * 0.18;
        chamber.material.opacity = active ? 0.38 + s.mapAgreement * 0.12 : 0.12;
        chamber.material.color.setHex(s.mapFamily === "projection" ? COLORS.green : COLORS.cyan);
      });
      restrictionLines.forEach((line, index) => {
        const pair = index % 2;
        const chamber = edgeChambers[Math.floor(index / 2) % edgeChambers.length];
        const source = pair === 0 ? nodeCenters[Math.floor(index / 2) % 3] : nodeCenters[3];
        const start = source.clone().add(new THREE.Vector3(0.18, 0.46, 0));
        const end = chamber.position.clone().add(new THREE.Vector3(pair === 0 ? -0.14 : 0.14, 0.18, 0));
        setTrackedLine(line, [start, start.clone().lerp(end, 0.5).add(new THREE.Vector3(0, 0.36 + s.relationSharpness * 0.05, 0)), end]);
        line.material.opacity = index < s.activeNeighborCount * 2 ? 0.22 + s.mapAgreement * 0.28 : 0.08;
        line.material.color.setHex(s.mapFamily === "orthogonal" ? COLORS.violet : COLORS.cyan);
      });
      messageLines.forEach((line, index) => {
        const chamber = edgeChambers[index % edgeChambers.length];
        const active = index < s.activeNeighborCount + 2;
        const start = chamber.position.clone().add(new THREE.Vector3(0.24, 0.24, 0));
        const end = targetUpdate.position.clone().add(new THREE.Vector3(-0.48, 0.12 + index * 0.012, (index % 3 - 1) * 0.1));
        setTrackedLine(line, [start, start.clone().lerp(end, 0.55).add(new THREE.Vector3(0, 0.28 + s.messageQuality * 0.08, 0)), end]);
        line.material.opacity = active ? 0.18 + s.messageQuality * 0.34 : 0.06;
        line.material.color.setHex(state.messagePassed ? COLORS.amber : COLORS.muted);
      });
      aggregateBars.forEach((bar, index) => {
        const value = index === 0 ? s.sheafEnergy : index === 1 ? s.graphEnergy : index === 2 ? s.messageQuality : index === 3 ? s.oversmoothing : s.regularity;
        bar.position.set(1.82 + index * 0.2, -0.92 + value * 0.12, 1.36);
        bar.scale.y = 0.18 + value * 0.42;
        bar.material.color.setHex(index === 3 && s.comparison === "graph" ? COLORS.rose : index < 2 ? COLORS.amber : COLORS.green);
      });
      lossBlocks.forEach((block, index) => {
        const row = Math.floor(index / 3);
        const col = index % 3;
        block.position.set(-0.2 + col * 0.18, -0.94 + row * 0.18, -1.58);
        block.scale.y = 0.8 + (index % 3) * 0.22 + s.relationNoise * 0.2;
        block.material.opacity = s.mode === "restrictions" || state.learned ? 0.4 : 0.2;
        block.material.color.setHex(index < 3 ? COLORS.rose : COLORS.green);
      });
      mapFamilyDiagnostics.forEach((marker, index) => {
        const familyIndex = ["scalar", "diagonal", "orthogonal", "projection", "dense"].indexOf(s.mapFamily);
        marker.position.set(-1.22 + index * 0.18, -0.94 + (index === familyIndex ? s.mapNorm * 0.18 : 0.02), -1.28);
        marker.scale.y = index === familyIndex ? 0.8 + s.mapNorm * 0.36 : 0.42;
        marker.material.opacity = index === familyIndex ? 0.5 : 0.16;
      });
      identityBaselineBars.forEach((bar, index) => {
        const value = s.graphEnergy * (0.8 + index * 0.12);
        bar.position.set(-2.24 + index * 0.16, -0.92 + value * 0.08, -1.54);
        bar.scale.y = 0.22 + value * 0.28;
        bar.material.opacity = s.comparison === "graph" || s.mode === "oversmoothing" ? 0.42 : 0.18;
        bar.material.color.setHex(COLORS.rose);
      });
      learnedMapConstraintBlocks.forEach((block, index) => {
        const value = [s.mapAgreement, s.mapNorm, s.regularity, 1 - s.relationNoise, s.relationSharpness / 1.8][index];
        block.position.set(0.46 + index * 0.16, -0.94 + value * 0.06, -1.28);
        block.scale.y = 0.58 + value * 0.34;
        block.material.opacity = state.learned || s.mode === "restrictions" ? 0.42 : 0.18;
        block.material.color.setHex(index === 2 ? COLORS.green : COLORS.violet);
      });
      const laneY = -0.54 + s.oversmoothing * 0.18;
      setTrackedLine(comparisonLane, [
        new THREE.Vector3(-2.35, laneY, -1.72),
        new THREE.Vector3(-0.6, laneY + (s.comparison === "graph" ? 0.32 : 0.12), -1.92),
        new THREE.Vector3(1.35, laneY + (s.comparison === "graph" ? 0.5 : 0.18), -1.68)
      ]);
      setTrackedLine(sheafComparisonLane, [
        new THREE.Vector3(-2.35, -0.72 + s.layerDepth * 0.006, -1.42),
        new THREE.Vector3(-0.6, -0.56 + s.compatibilityGain * 0.12, -1.48),
        new THREE.Vector3(1.35, -0.52 + s.compatibilityGain * 0.16, -1.38)
      ]);
      comparisonLane.material.color.setHex(s.comparison === "graph" ? COLORS.rose : COLORS.green);
      comparisonLane.material.opacity = s.mode === "oversmoothing" ? 0.58 : 0.24;
      sheafComparisonLane.material.opacity = s.mode === "oversmoothing" ? 0.44 : 0.18;
    }

    function updatePanel() {
      const s = stats();
      setMetric(root, "Compatibility gain", s.compatibilityGain, 2);
      setMetric(root, "Message quality", s.messageQuality, 2);
      setMetric(root, "Neighbor coverage", s.activeNeighborCount, 0);
      setMetric(root, "Map regularity", s.regularity, 2);
      document.getElementById("gainLabel").textContent = fmt(s.compatibilityGain, 2);
      document.getElementById("energyLabel").textContent = fmt(s.sheafEnergy, 2);
      document.getElementById("mapLabel").textContent = fmt(s.mapAgreement, 2);
      document.getElementById("smoothLabel").textContent = fmt(s.oversmoothing, 2);
      if (formulaText) formulaText.textContent = "m = B_v^T B_u h_u";
      if (selected) selected.textContent = `${s.mapFamily} maps | ${s.comparison} comparison | quality ${fmt(s.messageQuality, 2)}`;
      if (insight) insight.textContent = "This is a concrete SNN layer: node feature towers feed a shared restriction predictor, endpoint maps meet in edge-stalk chambers, transported messages aggregate into the target update, and the loss regularizes maps.";
      if (state.status === "Maps learned") {
        stateText.textContent = `${state.lastAction}: learned restriction maps align endpoint features inside edge-stalk chambers; ${s.mapFamily} maps raise agreement to ${fmt(s.mapAgreement, 2)} without collapsing the feature towers. Last control ${state.lastControl}.`;
      } else if (state.status === "Message passed") {
        stateText.textContent = `${state.lastAction}: transported message B_v^T B_u h_u leaves the edge-stalk chamber and enters aggregation before updating the target representation. Last control ${state.lastControl}.`;
      } else if (state.status === "Layer stepped") {
        stateText.textContent = `${state.lastAction}: ${s.comparison === "graph" ? "graph smoothing shows over-smoothing by pulling raw neighbors together" : "sheaf diffusion preserves compatible role structure"} across ${s.layerDepth} SNN layers. Last control ${state.lastControl}.`;
      } else if (s.mode === "restrictions") {
        stateText.textContent = `${state.lastAction}: ${s.mapFamily} restriction family controls the actual incidence maps before edge-stalk comparison; map norm ${fmt(s.mapNorm, 2)} and agreement ${fmt(s.mapAgreement, 2)} are visible. Last control ${state.lastControl}.`;
      } else {
        stateText.textContent = `${state.lastAction}: restriction predictor, edge-stalk comparison chamber, transported message arrows, aggregation, and readout/loss form a concrete sheaf neural network layer. Last control ${state.lastControl}.`;
      }
      syncOutput("layerDepth", s.layerDepth, 0);
      syncOutput("relationSharpness", s.relationSharpness, 2);
      syncOutput("relationNoise", s.relationNoise, 2);
      syncOutput("neighborBudget", s.neighborBudget, 0);
      syncOutput("selfWeight", s.selfWeight, 2);
    }

    function refresh() {
      updateScene();
      updatePanel();
    }

    ["mode", "mapFamily", "comparison"].forEach((id) => {
      document.getElementById(id).addEventListener("change", (event) => {
        markControl(id, event.target.value);
        state.status = "Ready";
        state.lastAction = "View change";
        refresh();
      });
    });
    ["layerDepth", "relationSharpness", "relationNoise", "neighborBudget", "selfWeight"].forEach((id) => {
      document.getElementById(id).addEventListener("input", (event) => {
        markControl(id, event.target.value);
        state.status = "Ready";
        state.lastAction = "Parameter change";
        refresh();
      });
    });
    document.getElementById("learnMaps").addEventListener("click", () => {
      markControl("learnMaps", "clicked");
      state.status = "Maps learned";
      state.learned = true;
      state.lastAction = "Learn restrictions";
      document.getElementById("mode").value = "restrictions";
      refresh();
    });
    document.getElementById("passMessage").addEventListener("click", () => {
      markControl("passMessage", "clicked");
      state.status = "Message passed";
      state.messagePassed = true;
      state.lastAction = "Pass transported message";
      document.getElementById("mode").value = "message";
      refresh();
    });
    document.getElementById("stepLayer").addEventListener("click", () => {
      markControl("stepLayer", "clicked");
      state.status = "Layer stepped";
      state.layerStep += 1;
      state.lastAction = "Step SNN layer";
      refresh();
    });
    document.getElementById("resetH07").addEventListener("click", () => {
      markControl("resetH07", "clicked");
      document.getElementById("mode").value = "architecture";
      document.getElementById("mapFamily").value = "diagonal";
      document.getElementById("comparison").value = "sheaf";
      setRange("layerDepth", 3);
      setRange("relationSharpness", 1);
      setRange("relationNoise", 0.28);
      setRange("neighborBudget", 4);
      setRange("selfWeight", 0.52);
      state.status = "Ready";
      state.learned = false;
      state.messagePassed = false;
      state.layerStep = 0;
      state.lastAction = "Reset";
      refresh();
    });

    function animate() {
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }

    window.__h07LabSnapshot = function () {
      const s = stats();
      return {
        kind: "sheaf-neural-network-architecture",
        labId: "h07",
        sceneObject: "node-feature-towers-restriction-predictor-edge-stalk-messages-aggregation-readout",
        title: "H07 Sheaf Neural Networks",
        status: state.status,
        mode: s.mode,
        mapFamily: s.mapFamily,
        comparison: s.comparison,
        layerDepth: s.layerDepth,
        activeNeighborCount: s.activeNeighborCount,
        nodeFeatureTowerCount: 4,
        nodeCount: 4,
        nodeFeatureTowerObjectCount: featureTowers.length,
        restrictionPredictorObjectCount: 1,
        restrictionMapObjectCount: restrictionLines.length,
        edgeStalkChamberObjectCount: edgeChambers.length,
        transportedMessageObjectCount: messageLines.length,
        aggregationObjectCount: aggregateBars.length,
        updateBlockObjectCount: 1,
        readoutLossObjectCount: lossBlocks.length,
        mapFamilyDiagnosticObjectCount: mapFamilyDiagnostics.length,
        identityBaselineObjectCount: identityBaselineBars.length,
        learnedMapConstraintObjectCount: learnedMapConstraintBlocks.length,
        oversmoothingComparisonObjectCount: 2,
        restrictionMapCount: 8,
        edgeStalkChamberCount: 3,
        messageArrowCount: 8,
        aggregatorCount: 1,
        readoutCount: 1,
        mapAgreement: s.mapAgreement,
        mapNorm: s.mapNorm,
        sheafEnergy: s.sheafEnergy,
        graphEnergy: s.graphEnergy,
        messageQuality: s.messageQuality,
        compatibilityGain: s.compatibilityGain,
        oversmoothing: s.oversmoothing,
        regularity: s.regularity,
        has3d: true,
        visualKind: "snn-layer-restriction-message-architecture",
        graphStyle: "hybrid",
        visualQuality: "h07-concrete-snn-architecture-v2",
        clarityVersion: "h07-h08-canonical-clarity-v1",
        nodeFeatureTowerHash: objectHash(featureTowers.map((item) => item.bar)),
        restrictionPredictorHash: objectHash([predictor]),
        restrictionMapHash: lineHash(restrictionLines),
        edgeStalkChamberHash: objectHash(edgeChambers),
        transportedMessageHash: lineHash(messageLines),
        aggregationHash: objectHash(aggregateBars),
        updateBlockHash: objectHash([targetUpdate]),
        readoutLossHash: objectHash(lossBlocks),
        mapFamilyDiagnosticHash: objectHash(mapFamilyDiagnostics),
        identityBaselineHash: objectHash(identityBaselineBars),
        learnedMapConstraintHash: objectHash(learnedMapConstraintBlocks),
        oversmoothingComparisonHash: lineHash([comparisonLane, sheafComparisonLane]),
        canonicalReferences: ["sheaf neural network layer", "learned restriction maps", "edge-stalk comparison", "transported message B_v^T B_u h_u", "aggregation/update/readout", "identity sheaf baseline"],
        snnObjects: ["node_feature_tower", "restriction_predictor", "edge_stalk_chamber", "learned_restriction_map", "transported_message", "aggregation", "update_block", "task_loss", "identity_baseline"],
        diagnosticMetrics: ["map_agreement", "sheaf_energy", "message_quality", "compatibility_gain", "oversmoothing"],
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
    window.__h07LabReady = true;
    animate();
  }

  function createH08NeuralSheafDiffusionConcreteLab() {
    const root = document.querySelector('[data-lab-id="h08"]');
    const canvas = document.getElementById("canvas");
    if (!root || !canvas) return;
    const { renderer, scene, camera, cameraState, grid } = setupScene(canvas, 9.3);
    const selected = root.querySelector('[data-role="selected"] strong');
    const insight = root.querySelector('[data-role="insight"]');
    const stateText = document.getElementById("stateBox");
    const formulaText = document.getElementById("formulaText");
    const state = { status: "Ready", revision: 0, lastControl: "initial", lastAction: "Ready", learned: false, odeTime: 0, projected: false, compared: false, controls: {} };
    const rawCenters = [
      new THREE.Vector3(-3.0, 0.0, 0.86),
      new THREE.Vector3(-3.0, 0.0, 0.12),
      new THREE.Vector3(-3.0, 0.0, -0.62),
      new THREE.Vector3(-3.0, 0.0, -1.36)
    ];
    const plainCenters = rawCenters.map((point) => point.clone().add(new THREE.Vector3(2.0, 0, 0)));
    const sheafCenters = rawCenters.map((point) => point.clone().add(new THREE.Vector3(4.3, 0, 0)));
    const rawBars = [];
    const plainBars = [];
    const sheafBars = [];
    rawCenters.forEach((center, nodeIndex) => {
      for (let channel = 0; channel < 2; channel += 1) {
        const raw = makeBox([0.1, 0.38, 0.1], channel === 0 ? COLORS.blue : COLORS.amber, 0.46);
        const plain = makeBox([0.1, 0.38, 0.1], channel === 0 ? COLORS.rose : COLORS.amber, 0.35);
        const sheaf = makeBox([0.1, 0.38, 0.1], channel === 0 ? COLORS.cyan : COLORS.green, 0.46);
        scene.add(raw, plain, sheaf);
        rawBars.push({ bar: raw, nodeIndex, channel });
        plainBars.push({ bar: plain, nodeIndex, channel });
        sheafBars.push({ bar: sheaf, nodeIndex, channel });
      }
    });
    const graphLane = makeLine([], COLORS.rose, 0.46);
    const sheafLane = makeLine([], COLORS.green, 0.56);
    scene.add(graphLane, sheafLane);
    const relationGates = Array.from({ length: 6 }, (_, index) => {
      const gate = makeBox([0.18, 0.32, 0.08], index % 2 === 0 ? COLORS.violet : COLORS.cyan, 0.36);
      scene.add(gate);
      return gate;
    });
    const edgeStalkPlates = Array.from({ length: 3 }, (_, index) => {
      const plate = makeBox([0.48, 0.055, 0.24], COLORS.green, 0.26);
      plate.position.set(-0.05 + index * 0.34, -0.2 - index * 0.18, 0.54);
      scene.add(plate);
      return plate;
    });
    const residualRods = Array.from({ length: 3 }, (_, index) => {
      const rod = makeBox([0.075, 0.28, 0.075], COLORS.rose, 0.42);
      rod.position.set(0.03 + index * 0.34, 0.04 - index * 0.18, 0.54);
      scene.add(rod);
      return rod;
    });
    const odeTrajectory = makeLine([], COLORS.blue, 0.62);
    scene.add(odeTrajectory);
    const kernelSurface = makeSphere(0.58, COLORS.green, 0.18);
    kernelSurface.scale.set(1.8, 0.08, 0.74);
    scene.add(kernelSurface);
    const energyBars = Array.from({ length: 6 }, (_, index) => {
      const bar = makeBox([0.12, 0.3, 0.12], index < 3 ? COLORS.rose : COLORS.green, 0.42);
      scene.add(bar);
      return bar;
    });
    const taskLossBlocks = Array.from({ length: 4 }, (_, index) => {
      const block = makeBox([0.1, 0.09, 0.1], index < 2 ? COLORS.rose : COLORS.green, 0.24);
      scene.add(block);
      return block;
    });
    const mapRegularizerBlocks = Array.from({ length: 4 }, (_, index) => {
      const block = makeBox([0.09, 0.08, 0.09], index % 2 ? COLORS.violet : COLORS.cyan, 0.24);
      scene.add(block);
      return block;
    });
    const stabilityGate = makeBox([0.7, 0.08, 0.42], COLORS.amber, 0.28);
    stabilityGate.position.set(2.6, -0.98, 1.56);
    scene.add(stabilityGate);
    grid(3.2, 1.7, -1.12);

    function markControl(id, value) {
      state.revision += 1;
      state.lastControl = id;
      state.controls[id] = value == null ? "clicked" : String(value);
    }

    function stats() {
      const scenario = selectValue("scenario", "alternating");
      const operator = selectValue("operator", "graph");
      const view = selectValue("view", "comparison");
      const odeSteps = rangeValue("odeSteps", 4);
      const kernelSharpness = rangeValue("kernelSharpness", 1);
      const featureNoise = rangeValue("featureNoise", 0.24);
      const relationChannels = rangeValue("relationChannels", 4);
      const skipConnection = rangeValue("skipConnection", 0.48);
      const hetero = scenario === "heterophily" ? 1 : scenario === "mixed" ? 0.55 : 0.25;
      const learnedLift = state.learned ? 0.32 : 0;
      const mapAgreement = clamp(0.52 + kernelSharpness * 0.13 + relationChannels * 0.025 - featureNoise * 0.26 + learnedLift, 0.12, 0.98);
      const baseSheafEnergy = (1.22 - mapAgreement + hetero * 0.22 + featureNoise * 0.42) * (1 - skipConnection * 0.18);
      const odeDamp = state.status === "ODE stepped" || state.odeTime > 0 ? Math.exp(-0.08 * odeSteps * kernelSharpness) : 1;
      const projectDamp = state.projected ? 0.24 : 1;
      const sheafEnergy = Math.max(0.04, baseSheafEnergy * odeDamp * projectDamp);
      const graphEnergy = Math.max(0.12, 0.9 + hetero * 0.72 + featureNoise * 0.28);
      const kernelDimension = state.projected || mapAgreement > 0.82 ? (scenario === "heterophily" ? 3 : 2) : 1;
      const labelAgreement = clamp(0.36 + mapAgreement * 0.42 + skipConnection * 0.18 - featureNoise * 0.12, 0, 1.12);
      const oversmoothing = operator === "graph"
        ? clamp(0.28 + odeSteps * 0.07 + hetero * 0.18 - skipConnection * 0.08, 0, 1.28)
        : clamp(0.12 + odeSteps * 0.024 + featureNoise * 0.06, 0, 0.54);
      const stabilityReserve = clamp(1.22 - kernelSharpness * 0.28 - featureNoise * 0.34 + skipConnection * 0.25, 0, 1.24);
      const relationCoverage = clamp(relationChannels / 6, 0, 1);
      return {
        scenario,
        operator,
        view,
        odeSteps,
        kernelSharpness,
        featureNoise,
        relationChannels,
        skipConnection,
        hetero,
        mapAgreement,
        sheafEnergy,
        graphEnergy,
        kernelDimension,
        labelAgreement,
        oversmoothing,
        stabilityReserve,
        relationCoverage,
        odeTime: state.odeTime
      };
    }

    function updateScene() {
      const s = stats();
      const odeProgress = clamp(state.odeTime / Math.max(1, s.odeSteps), 0, 1);
      const kernelPull = state.projected ? 1 : 0;
      rawBars.forEach(({ bar, nodeIndex, channel }) => {
        const sign = s.scenario === "heterophily" ? (nodeIndex % 2 === 0 ? 1 : -1) : 1 - nodeIndex * 0.18;
        const value = Math.abs(sign) * (0.44 + channel * 0.22 + s.featureNoise * 0.28);
        bar.position.copy(rawCenters[nodeIndex]).add(new THREE.Vector3(channel * 0.16 - 0.08, 0.18 + value * 0.18, 0));
        bar.scale.y = 0.6 + value;
        bar.material.color.setHex(sign >= 0 ? COLORS.blue : COLORS.amber);
      });
      plainBars.forEach(({ bar, nodeIndex, channel }) => {
        const collapse = clamp(0.28 + s.oversmoothing * 0.56, 0, 0.95);
        const value = 0.62 - collapse * 0.34 + channel * 0.08;
        bar.position.copy(plainCenters[nodeIndex]).add(new THREE.Vector3(channel * 0.16 - 0.08, 0.14 + value * 0.16, 0));
        bar.scale.y = 0.42 + value * (1 - collapse * 0.52);
        bar.material.opacity = 0.24 + collapse * 0.2;
      });
      sheafBars.forEach(({ bar, nodeIndex, channel }) => {
        const role = nodeIndex % 2 === 0 ? 1 : 0.72;
        const globalSectionLift = kernelPull * (nodeIndex % 2 === 0 ? 0.12 : 0.2);
        const value = role * (0.46 + s.mapAgreement * 0.28 + channel * 0.16) + globalSectionLift;
        bar.position.copy(sheafCenters[nodeIndex]).add(new THREE.Vector3(
          channel * 0.16 - 0.08,
          0.18 + value * 0.18 + kernelPull * 0.05,
          kernelPull * (nodeIndex % 2 === 0 ? 0.06 : -0.06)
        ));
        bar.scale.y = 0.42 + value + kernelPull * 0.08;
        bar.material.opacity = 0.34 + s.mapAgreement * 0.2;
      });
      setTrackedLine(graphLane, plainCenters.map((point, index) => point.clone().add(new THREE.Vector3(0, 0.5 + Math.max(0, 0.54 - index * 0.04), 0))));
      setTrackedLine(sheafLane, sheafCenters.map((point, index) => point.clone().add(new THREE.Vector3(
        0,
        0.46 + (index % 2) * 0.22 + kernelPull * (0.08 + index * 0.018),
        kernelPull * (index % 2 === 0 ? 0.08 : -0.08)
      ))));
      graphLane.material.opacity = s.operator === "graph" || s.view === "comparison" ? 0.58 : 0.24;
      sheafLane.material.opacity = s.operator === "sheaf" || s.view === "ode" ? 0.66 : 0.28;
      relationGates.forEach((gate, index) => {
        const active = index < s.relationChannels;
        const lane = index % 3;
        gate.position.set(-0.15 + lane * 0.32, -0.58 + Math.floor(index / 3) * 0.26, 0.88);
        gate.scale.y = active ? 0.8 + s.mapAgreement * 0.42 : 0.28;
        gate.material.opacity = active ? 0.34 + s.mapAgreement * 0.2 : 0.08;
        gate.material.color.setHex(index % 2 === 0 ? COLORS.violet : COLORS.cyan);
      });
      edgeStalkPlates.forEach((plate, index) => {
        const active = index < Math.min(3, s.relationChannels);
        plate.position.set(0.0 + index * 0.34, -0.2 - index * 0.18, 0.56);
        plate.scale.x = 0.82 + s.mapAgreement * 0.34;
        plate.material.opacity = active ? 0.26 + s.mapAgreement * 0.18 : 0.08;
        plate.material.color.setHex(s.operator === "sheaf" ? COLORS.green : COLORS.muted);
      });
      residualRods.forEach((rod, index) => {
        const value = Math.max(0.08, (1 - s.mapAgreement) * 0.9 + s.featureNoise * 0.34 + index * 0.035);
        const projectedValue = value * (kernelPull ? 0.38 : 1);
        rod.position.set(0.08 + index * 0.34, 0.04 - index * 0.18 + projectedValue * 0.08 - kernelPull * 0.05, 0.56 + kernelPull * 0.05);
        rod.scale.y = 0.22 + projectedValue * (state.learned ? 0.36 : 0.72);
        rod.material.opacity = s.view === "ode" || state.learned ? 0.48 : 0.24;
        rod.material.color.setHex(projectedValue < 0.18 || state.learned ? COLORS.green : COLORS.rose);
      });
      const trajectoryPoints = [];
      for (let i = 0; i < 16; i += 1) {
        const t = i / 15;
        const decay = Math.exp(-t * s.odeSteps * s.kernelSharpness * 0.24);
        const flowDrop = odeProgress * (0.22 + t * 0.3);
        const solverBend = Math.sin((t + odeProgress) * Math.PI) * odeProgress * 0.16;
        trajectoryPoints.push(new THREE.Vector3(
          -0.9 + t * 2.52,
          -0.8 + decay * 0.82 + s.skipConnection * 0.12 - flowDrop,
          1.62 - t * 0.18 + solverBend
        ));
      }
      setTrackedLine(odeTrajectory, trajectoryPoints);
      odeTrajectory.material.opacity = s.view === "ode" || state.odeTime > 0 ? 0.72 : 0.36;
      kernelSurface.position.set(2.45, -0.7 + s.kernelDimension * 0.08, -1.28);
      kernelSurface.scale.set(1.2 + s.kernelDimension * 0.28, 0.08, 0.56 + s.mapAgreement * 0.34);
      kernelSurface.material.opacity = s.view === "kernel" || state.projected ? 0.28 : 0.14;
      [s.graphEnergy, s.sheafEnergy, s.mapAgreement, s.labelAgreement, s.oversmoothing, s.stabilityReserve].forEach((value, index) => {
        const bar = energyBars[index];
        bar.position.set(-0.6 + index * 0.2, -0.98 + value * 0.1, -1.72);
        bar.scale.y = 0.18 + value * 0.48;
        bar.material.color.setHex(index === 0 || index === 4 ? COLORS.rose : index === 1 ? COLORS.green : COLORS.cyan);
      });
      taskLossBlocks.forEach((block, index) => {
        const value = [s.graphEnergy, s.sheafEnergy, s.labelAgreement, s.mapAgreement][index];
        block.position.set(0.74 + index * 0.18, -0.98 + value * 0.07, -1.72);
        block.scale.y = 0.5 + value * 0.28;
        block.material.opacity = state.learned || state.odeTime > 0 ? 0.4 : 0.18;
        block.material.color.setHex(index === 0 ? COLORS.rose : COLORS.green);
      });
      mapRegularizerBlocks.forEach((block, index) => {
        const value = [s.relationCoverage, s.stabilityReserve, 1 - s.featureNoise, s.kernelSharpness / 1.8][index];
        block.position.set(1.58 + index * 0.16, -0.98 + value * 0.06, -1.72);
        block.scale.y = 0.55 + value * 0.26;
        block.material.opacity = state.learned || s.view === "energy" ? 0.42 : 0.18;
        block.material.color.setHex(index === 1 ? COLORS.amber : COLORS.violet);
      });
      stabilityGate.position.y = -0.98 + odeProgress * 0.16;
      stabilityGate.rotation.z = -0.08 + odeProgress * 0.16;
      stabilityGate.scale.x = 0.7 + s.stabilityReserve * 0.5 + odeProgress * 0.18;
      stabilityGate.scale.y = 0.9 + odeProgress * 0.35;
      stabilityGate.material.color.setHex(s.stabilityReserve < 0.3 ? COLORS.rose : COLORS.amber);
    }

    function updatePanel() {
      const s = stats();
      setMetric(root, "Sheaf energy drop", Math.max(0, s.graphEnergy - s.sheafEnergy), 2);
      setMetric(root, "Label agreement", s.labelAgreement, 2);
      setMetric(root, "Relation coverage", s.relationCoverage, 2);
      setMetric(root, "Stability reserve", s.stabilityReserve, 2);
      document.getElementById("dropLabel").textContent = fmt(Math.max(0, s.graphEnergy - s.sheafEnergy), 2);
      document.getElementById("agreementLabel").textContent = fmt(s.mapAgreement, 2);
      document.getElementById("kernelLabel").textContent = String(s.kernelDimension);
      document.getElementById("smoothLabel").textContent = fmt(s.oversmoothing, 2);
      if (formulaText) formulaText.textContent = "dx/dt = -Delta_F(theta) x";
      if (selected) selected.textContent = `${s.scenario} | ${s.operator} | E_F ${fmt(s.sheafEnergy, 2)}`;
      if (insight) insight.textContent = "The lab follows the NSD paper picture: raw graph diffusion collapses a heterophilic signal, while learned restriction gates define a sheaf Laplacian whose ODE flow moves toward a learned global-section kernel.";
      if (state.status === "Restrictions learned") {
        stateText.textContent = `${state.lastAction}: learned restrictions use node and edge features to build edge-stalk comparison plates for the evolving sheaf F(theta); agreement is ${fmt(s.mapAgreement, 2)} on the ${s.scenario} graph. Last control ${state.lastControl}.`;
      } else if (state.status === "ODE stepped") {
        stateText.textContent = `${state.lastAction}: dx/dt = -Delta_F(theta) x advances the sheaf ODE, lowering transported disagreement while the skip connection keeps readable node features. Last control ${state.lastControl}.`;
      } else if (state.status === "Kernel projected") {
        stateText.textContent = `${state.lastAction}: the learned kernel is a global section space, so the limit preserves compatible roles instead of flattening every node to the same value. Last control ${state.lastControl}.`;
      } else if (state.status === "Compared") {
        stateText.textContent = `${state.lastAction}: graph diffusion shows over-smoothing on the top lane, while the learned sheaf lane keeps the heterophily pattern separable. Last control ${state.lastControl}.`;
      } else {
        stateText.textContent = `${state.lastAction}: graph diffusion, learned restrictions, sheaf ODE flow, energy bars, and learned kernel are shown side by side for the ${s.scenario} case. Last control ${state.lastControl}.`;
      }
      syncOutput("odeSteps", s.odeSteps, 0);
      syncOutput("kernelSharpness", s.kernelSharpness, 2);
      syncOutput("featureNoise", s.featureNoise, 2);
      syncOutput("relationChannels", s.relationChannels, 0);
      syncOutput("skipConnection", s.skipConnection, 2);
    }

    function refresh() {
      updateScene();
      updatePanel();
    }

    ["scenario", "operator", "view"].forEach((id) => {
      document.getElementById(id).addEventListener("change", (event) => {
        markControl(id, event.target.value);
        state.status = "Ready";
        state.lastAction = "View change";
        refresh();
      });
    });
    ["odeSteps", "kernelSharpness", "featureNoise", "relationChannels", "skipConnection"].forEach((id) => {
      document.getElementById(id).addEventListener("input", (event) => {
        markControl(id, event.target.value);
        state.status = "Ready";
        state.lastAction = "Parameter change";
        refresh();
      });
    });
    document.getElementById("learnRestrictions").addEventListener("click", () => {
      markControl("learnRestrictions", "clicked");
      state.status = "Restrictions learned";
      state.learned = true;
      state.lastAction = "Learn restrictions";
      document.getElementById("operator").value = "sheaf";
      document.getElementById("view").value = "ode";
      refresh();
    });
    document.getElementById("stepOde").addEventListener("click", () => {
      markControl("stepOde", "clicked");
      state.status = "ODE stepped";
      state.odeTime += 1;
      state.lastAction = "Step sheaf ODE";
      document.getElementById("operator").value = "sheaf";
      document.getElementById("view").value = "ode";
      refresh();
    });
    document.getElementById("projectKernel").addEventListener("click", () => {
      markControl("projectKernel", "clicked");
      state.status = "Kernel projected";
      state.projected = true;
      state.lastAction = "Project learned kernel";
      document.getElementById("view").value = "kernel";
      refresh();
    });
    document.getElementById("compareGraph").addEventListener("click", () => {
      markControl("compareGraph", "clicked");
      state.status = "Compared";
      state.compared = true;
      state.lastAction = "Compare graph diffusion";
      document.getElementById("operator").value = "graph";
      document.getElementById("view").value = "comparison";
      refresh();
    });
    document.getElementById("resetH08").addEventListener("click", () => {
      markControl("resetH08", "clicked");
      document.getElementById("scenario").value = "alternating";
      document.getElementById("operator").value = "graph";
      document.getElementById("view").value = "comparison";
      setRange("odeSteps", 4);
      setRange("kernelSharpness", 1);
      setRange("featureNoise", 0.24);
      setRange("relationChannels", 4);
      setRange("skipConnection", 0.48);
      state.status = "Ready";
      state.learned = false;
      state.odeTime = 0;
      state.projected = false;
      state.compared = false;
      state.lastAction = "Reset";
      refresh();
    });

    function animate() {
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }

    window.__h08LabSnapshot = function () {
      const s = stats();
      return {
        kind: "neural-sheaf-diffusion-ode",
        labId: "h08",
        sceneObject: "plain-laplacian-lane-learned-restriction-gates-sheaf-ode-kernel",
        title: "H08 Neural Sheaf Diffusion",
        status: state.status,
        scenario: s.scenario,
        operator: s.operator,
        view: s.view,
        odeSteps: s.odeSteps,
        odeTime: s.odeTime,
        rawFeatureObjectCount: rawBars.length,
        graphDiffusionObjectCount: plainBars.length + 1,
        sheafDiffusionObjectCount: sheafBars.length + 1,
        learnedRestrictionGateObjectCount: relationGates.length,
        edgeStalkObjectCount: edgeStalkPlates.length,
        residualObjectCount: residualRods.length,
        odeTrajectoryObjectCount: 16,
        kernelSurfaceObjectCount: 1,
        energyBarObjectCount: energyBars.length,
        stabilityObjectCount: 1,
        taskLossObjectCount: taskLossBlocks.length,
        mapRegularizerObjectCount: mapRegularizerBlocks.length,
        oversmoothingLaneObjectCount: 2,
        graphDiffusionLaneCount: 1,
        sheafDiffusionLaneCount: 1,
        learnedRestrictionGateCount: 6,
        edgeStalkPlateCount: 3,
        residualRodCount: 3,
        relationChannelCount: s.relationChannels,
        odeTrajectoryPointCount: 16,
        kernelSurfaceCount: 1,
        mapAgreement: s.mapAgreement,
        sheafEnergy: s.sheafEnergy,
        graphEnergy: s.graphEnergy,
        kernelDimension: s.kernelDimension,
        labelAgreement: s.labelAgreement,
        oversmoothing: s.oversmoothing,
        stabilityReserve: s.stabilityReserve,
        has3d: true,
        visualKind: "neural-sheaf-diffusion-ode-kernel",
        graphStyle: "hybrid",
        visualQuality: "h08-concrete-nsd-ode-v2",
        clarityVersion: "h07-h08-canonical-clarity-v1",
        rawFeatureHash: objectHash(rawBars.map((item) => item.bar)),
        graphDiffusionHash: `${objectHash(plainBars.map((item) => item.bar))}-${lineHash([graphLane])}`,
        sheafDiffusionHash: `${objectHash(sheafBars.map((item) => item.bar))}-${lineHash([sheafLane])}`,
        learnedRestrictionGateHash: objectHash(relationGates),
        edgeStalkHash: objectHash(edgeStalkPlates),
        residualHash: objectHash(residualRods),
        odeTrajectoryHash: lineHash([odeTrajectory]),
        kernelSurfaceHash: objectHash([kernelSurface]),
        energyBarHash: objectHash(energyBars),
        stabilityHash: objectHash([stabilityGate]),
        taskLossHash: objectHash(taskLossBlocks),
        mapRegularizerHash: objectHash(mapRegularizerBlocks),
        oversmoothingLaneHash: lineHash([graphLane, sheafLane]),
        canonicalReferences: ["Neural Sheaf Diffusion", "learned restriction network", "sheaf Laplacian ODE", "plain graph diffusion baseline", "learned kernel global section", "heterophily oversmoothing"],
        nsdObjects: ["plain_graph_diffusion", "learned_sheaf_diffusion", "restriction_network", "edge_stalk_residual", "sheaf_laplacian_ode", "learned_kernel", "global_section_projection", "oversmoothing_comparison"],
        diagnosticMetrics: ["map_agreement", "sheaf_energy", "graph_energy", "kernel_dimension", "label_agreement", "stability_reserve"],
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
    window.__h08LabReady = true;
    animate();
  }

  function createH09ConnectionLaplacianConcreteLab() {
    const root = document.querySelector('[data-lab-id="h09"]');
    const canvas = document.getElementById("canvas");
    if (!root || !canvas) return;
    const { renderer, scene, camera, cameraState, grid } = setupScene(canvas, 9.2);
    const selected = root.querySelector('[data-role="selected"] strong');
    const insight = root.querySelector('[data-role="insight"]');
    const stateText = document.getElementById("stateBox");
    const formulaText = document.getElementById("formulaText");
    const state = { status: "Ready", revision: 0, lastControl: "initial", lastAction: "Ready", transportCursor: 0, diffusionStep: 0, gaugeShifted: false, controls: {} };
    const frames = [
      new THREE.Vector3(-1.85, 0.0, 1.05),
      new THREE.Vector3(1.85, 0.0, 1.05),
      new THREE.Vector3(1.85, 0.0, -1.05),
      new THREE.Vector3(-1.85, 0.0, -1.05)
    ];
    const framePlates = frames.map((position) => {
      const plate = makeBox([0.56, 0.035, 0.56], COLORS.blue, 0.18);
      plate.position.copy(position);
      scene.add(plate);
      return plate;
    });
    const axisLines = Array.from({ length: 8 }, () => {
      const line = makeLine([], COLORS.cyan, 0.42);
      scene.add(line);
      return line;
    });
    const vectorLines = Array.from({ length: 6 }, () => {
      const line = makeLine([], COLORS.amber, 0.5);
      scene.add(line);
      return line;
    });
    const transportLines = Array.from({ length: 4 }, () => {
      const line = makeLine([], COLORS.green, 0.34);
      scene.add(line);
      return line;
    });
    const matrixBlocks = Array.from({ length: 16 }, (_, index) => {
      const block = makeBox([0.1, 0.1, 0.1], index % 5 === 0 ? COLORS.green : COLORS.violet, 0.26);
      scene.add(block);
      return block;
    });
    const holonomyDisc = makeSphere(0.38, COLORS.rose, 0.22);
    holonomyDisc.scale.set(1.45, 0.06, 1.45);
    holonomyDisc.position.set(0, 0.72, 0);
    scene.add(holonomyDisc);
    const gaugeRing = makeLine([], COLORS.violet, 0.3);
    scene.add(gaugeRing);
    grid(3.1, 1.8, -1.12);

    function markControl(id, value) {
      state.revision += 1;
      state.lastControl = id;
      state.controls[id] = value == null ? "clicked" : String(value);
    }

    function angleSet(preset, scale, noise) {
      if (preset === "flat") return [20, -15, 25, -30].map((value) => value * 0.0);
      if (preset === "noisy") return [20, -15, 55, -30].map((value, index) => value * scale + (index - 1.5) * noise * 18);
      if (preset === "reflection") return [35, 35, -20, 70].map((value) => value * scale);
      return [20, -15, 55, -30].map((value) => value * scale);
    }

    function stats() {
      const preset = selectValue("preset", "curved");
      const view = selectValue("view", "transport");
      const loopTraversals = rangeValue("loopTraversals", 3);
      const rotationScale = rangeValue("rotationScale", 1);
      const frameNoise = rangeValue("frameNoise", 0.14);
      const visibleTransports = rangeValue("visibleTransports", 4);
      const normLock = rangeValue("normLock", 0.72);
      const angles = angleSet(preset, rotationScale, frameNoise);
      const holonomyAngle = angles.reduce((sum, value) => sum + value, 0);
      const transportedAngle = state.status === "Loop holonomy" ? holonomyAngle : angles.slice(0, state.transportCursor).reduce((sum, value) => sum + value, 0);
      const vectorNorm = 1 + (1 - normLock) * 0.02;
      const orthogonalityError = Math.max(0, (1 - normLock) * 0.018 + frameNoise * 0.006);
      const baseEnergy = Math.abs(holonomyAngle) / 90 + frameNoise * 0.52 + (1 - normLock) * 0.14;
      const energy = Math.max(0.03, baseEnergy * (state.diffusionStep > 0 ? 0.58 : 1));
      const curvatureDefect = Math.abs(holonomyAngle) / 90;
      const transportNorm = clamp(normLock + 0.18, 0, 1.04);
      return {
        preset,
        view,
        loopTraversals,
        rotationScale,
        frameNoise,
        visibleTransports,
        normLock,
        angles,
        holonomyAngle,
        transportedAngle,
        vectorNorm,
        energy,
        curvatureDefect,
        transportNorm,
        orthogonalityError,
        diffusionStep: state.diffusionStep,
        transportCursor: state.transportCursor
      };
    }

    function vectorAt(origin, degrees, length) {
      const radians = degrees * Math.PI / 180;
      return origin.clone().add(new THREE.Vector3(Math.cos(radians) * length, 0.42, Math.sin(radians) * length));
    }

    function updateScene() {
      const s = stats();
      framePlates.forEach((plate, index) => {
        plate.position.copy(frames[index]);
        plate.material.color.setHex(index === s.transportCursor ? COLORS.amber : COLORS.blue);
        plate.material.opacity = index === s.transportCursor ? 0.28 : 0.16;
      });
      axisLines.forEach((line, index) => {
        const frameIndex = Math.floor(index / 2);
        const baseAngle = s.angles.slice(0, frameIndex).reduce((sum, value) => sum + value, 0) + (state.gaugeShifted && frameIndex === 1 ? 38 : 0);
        const axisAngle = baseAngle + (index % 2 === 0 ? 0 : 90);
        const origin = frames[frameIndex].clone().add(new THREE.Vector3(0, 0.04, 0));
        const a = vectorAt(origin, axisAngle, 0.34);
        const b = vectorAt(origin, axisAngle + 180, 0.34);
        setTrackedLine(line, [b, a]);
        line.material.color.setHex(index % 2 === 0 ? COLORS.cyan : COLORS.violet);
        line.material.opacity = s.view === "gauge" || state.gaugeShifted ? 0.5 : 0.38;
      });
      vectorLines.forEach((line, index) => {
        const frameIndex = index % 4;
        const active = index <= s.transportCursor || state.status === "Loop holonomy";
        const angle = s.angles.slice(0, frameIndex).reduce((sum, value) => sum + value, 0);
        const origin = frames[frameIndex].clone().add(new THREE.Vector3(0, 0.22, 0));
        setTrackedLine(line, [origin, vectorAt(origin, angle, 0.62 + state.diffusionStep * 0.025)]);
        line.material.opacity = active ? 0.58 : 0.12;
        line.material.color.setHex(active ? COLORS.amber : COLORS.muted);
      });
      transportLines.forEach((line, index) => {
        const a = frames[index].clone().add(new THREE.Vector3(0, 0.5, 0));
        const b = frames[(index + 1) % 4].clone().add(new THREE.Vector3(0, 0.5, 0));
        const angleBend = Math.abs(s.angles[index]) / 120;
        const gaugeBend = state.gaugeShifted && (index === 0 || index === 1) ? 0.18 : 0;
        setTrackedLine(line, [a, a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, 0.28 + angleBend * 0.14 + gaugeBend, gaugeBend * 0.4)), b]);
        line.material.opacity = index < s.visibleTransports ? 0.34 + s.transportNorm * 0.16 : 0.08;
        line.material.color.setHex(index === (s.transportCursor + 3) % 4 ? COLORS.amber : COLORS.green);
      });
      matrixBlocks.forEach((block, index) => {
        const row = Math.floor(index / 4);
        const col = index % 4;
        const offBlock = row !== col && (Math.abs(row - col) === 1 || Math.abs(row - col) === 3);
        block.position.set(-0.32 + col * 0.16, -0.98 + row * 0.16 + state.diffusionStep * 0.012, -1.72);
        block.scale.y = 0.78 + (row === col ? 0.18 : offBlock ? Math.abs(s.angles[row % s.angles.length]) / 140 : 0) + state.diffusionStep * 0.035;
        block.material.opacity = s.view === "matrix" || state.diffusionStep > 0 ? 0.4 : 0.18;
        block.material.color.setHex(row === col ? COLORS.green : Math.abs(row - col) === 1 || Math.abs(row - col) === 3 ? COLORS.violet : COLORS.muted);
      });
      holonomyDisc.scale.set(1.1 + Math.abs(s.holonomyAngle) / 90, 0.06, 1.1 + Math.abs(s.holonomyAngle) / 90);
      holonomyDisc.material.color.setHex(Math.abs(s.holonomyAngle) < 1 ? COLORS.green : COLORS.rose);
      holonomyDisc.material.opacity = s.view === "holonomy" || state.status === "Loop holonomy" ? 0.32 : 0.18;
      const ringPoints = [];
      for (let i = 0; i <= 32; i += 1) {
        const t = i / 32 * Math.PI * 2;
        const gaugeWarp = state.gaugeShifted ? 0.08 * Math.sin(t * 2) : 0;
        ringPoints.push(new THREE.Vector3(Math.cos(t) * (0.82 + gaugeWarp), 0.86 + Math.sin(t) * 0.02, Math.sin(t) * (0.82 - gaugeWarp)));
      }
      setTrackedLine(gaugeRing, ringPoints);
      gaugeRing.material.opacity = s.view === "gauge" || state.gaugeShifted ? 0.54 : 0.18;
    }

    function updatePanel() {
      const s = stats();
      setMetric(root, "Holonomy angle", s.holonomyAngle, 1);
      setMetric(root, "Transport norm", s.vectorNorm, 2);
      setMetric(root, "Loop coverage", s.visibleTransports, 0);
      setMetric(root, "Curvature defect", s.curvatureDefect, 2);
      document.getElementById("twistLabel").textContent = fmt(s.holonomyAngle, 1);
      document.getElementById("normLabel").textContent = fmt(s.vectorNorm, 2);
      document.getElementById("energyLabel").textContent = fmt(s.energy, 2);
      document.getElementById("cursorLabel").textContent = `${s.transportCursor}/4`;
      if (formulaText) formulaText.textContent = "x_u - O_uv x_v";
      if (selected) selected.textContent = `${s.preset} connection | holonomy ${fmt(s.holonomyAngle, 1)} deg`;
      if (insight) insight.textContent = "The canonical picture is local tangent frames on a four-cycle: orthogonal SO(2) transports preserve vector norm edge by edge, while the loop product reveals holonomy and feeds the connection-Laplacian energy.";
      if (state.status === "Transported") {
        stateText.textContent = `${state.lastAction}: the vector is parallel transported through an orthogonal matrix, so it changes frame but has preserved vector norm ${fmt(s.vectorNorm, 2)}. Last control ${state.lastControl}.`;
      } else if (state.status === "Loop holonomy") {
        stateText.textContent = `${state.lastAction}: holonomy is the product of transports around the loop; the returned vector angle is ${fmt(s.transportedAngle, 1)} degrees. Last control ${state.lastControl}.`;
      } else if (state.status === "Diffused") {
        stateText.textContent = `${state.lastAction}: connection-Laplacian diffusion uses x_u - O_uv x_v, lowering transported energy without comparing unaligned coordinates. Last control ${state.lastControl}.`;
      } else if (state.status === "Gauge shifted") {
        stateText.textContent = `${state.lastAction}: a gauge change rotates a local frame and conjugates transports, but connection energy stays invariant. Last control ${state.lastControl}.`;
      } else {
        stateText.textContent = `${state.lastAction}: ${s.preset} local frames show parallel transport, holonomy, orthogonal matrices, and the connection-Laplacian block operator. Last control ${state.lastControl}.`;
      }
      syncOutput("loopTraversals", s.loopTraversals, 0);
      syncOutput("rotationScale", s.rotationScale, 2);
      syncOutput("frameNoise", s.frameNoise, 2);
      syncOutput("visibleTransports", s.visibleTransports, 0);
      syncOutput("normLock", s.normLock, 2);
    }

    function refresh() {
      updateScene();
      updatePanel();
    }

    ["preset", "view"].forEach((id) => {
      document.getElementById(id).addEventListener("change", (event) => {
        markControl(id, event.target.value);
        state.status = "Ready";
        state.lastAction = "View change";
        if (id === "preset") state.transportCursor = 0;
        refresh();
      });
    });
    ["loopTraversals", "rotationScale", "frameNoise", "visibleTransports", "normLock"].forEach((id) => {
      document.getElementById(id).addEventListener("input", (event) => {
        markControl(id, event.target.value);
        state.status = "Ready";
        state.lastAction = "Parameter change";
        refresh();
      });
    });
    document.getElementById("transportVector").addEventListener("click", () => {
      markControl("transportVector", "clicked");
      state.status = "Transported";
      state.transportCursor = (state.transportCursor + 1) % 4;
      state.lastAction = "Parallel transport";
      document.getElementById("view").value = "transport";
      refresh();
    });
    document.getElementById("runLoop").addEventListener("click", () => {
      markControl("runLoop", "clicked");
      state.status = "Loop holonomy";
      state.transportCursor = 0;
      state.lastAction = "Run loop";
      document.getElementById("view").value = "holonomy";
      refresh();
    });
    document.getElementById("diffuse").addEventListener("click", () => {
      markControl("diffuse", "clicked");
      state.status = "Diffused";
      state.diffusionStep += 1;
      state.lastAction = "Diffuse";
      document.getElementById("view").value = "matrix";
      refresh();
    });
    document.getElementById("gaugeShift").addEventListener("click", () => {
      markControl("gaugeShift", "clicked");
      state.status = "Gauge shifted";
      state.gaugeShifted = !state.gaugeShifted;
      state.lastAction = "Gauge shift";
      document.getElementById("view").value = "gauge";
      refresh();
    });
    document.getElementById("resetH09").addEventListener("click", () => {
      markControl("resetH09", "clicked");
      document.getElementById("preset").value = "curved";
      document.getElementById("view").value = "transport";
      setRange("loopTraversals", 3);
      setRange("rotationScale", 1);
      setRange("frameNoise", 0.14);
      setRange("visibleTransports", 4);
      setRange("normLock", 0.72);
      state.status = "Ready";
      state.transportCursor = 0;
      state.diffusionStep = 0;
      state.gaugeShifted = false;
      state.lastAction = "Reset";
      refresh();
    });

    function animate() {
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }

    window.__h09LabSnapshot = function () {
      const s = stats();
      return {
        kind: "connection-laplacian-transport",
        labId: "h09",
        sceneObject: "local-frames-so2-transport-holonomy-connection-laplacian-blocks",
        title: "H09 Connection Laplacian Transport",
        status: state.status,
        preset: s.preset,
        view: s.view,
        localFrameCount: 4,
        transportMatrixCount: 4,
        vectorArrowCount: 6,
        blockMatrixCount: 16,
        visibleTransportCount: s.visibleTransports,
        transportCursor: s.transportCursor,
        loopTraversals: s.loopTraversals,
        rotationScale: s.rotationScale,
        holonomyAngle: s.holonomyAngle,
        transportedAngle: s.transportedAngle,
        vectorNorm: s.vectorNorm,
        orthogonalityError: s.orthogonalityError,
        energy: s.energy,
        curvatureDefect: s.curvatureDefect,
        diffusionStep: s.diffusionStep,
        has3d: true,
        visualKind: "connection-laplacian-holonomy-loop",
        graphStyle: "anchors",
        visualQuality: "h09-concrete-connection-laplacian-v2",
        clarityVersion: "h09-h10-canonical-clarity-v1",
        localFrameObjectCount: framePlates.length,
        frameAxisObjectCount: axisLines.length,
        vectorArrowObjectCount: vectorLines.length,
        transportPathObjectCount: transportLines.length,
        connectionMatrixObjectCount: matrixBlocks.length,
        holonomyObjectCount: 1,
        gaugeRingObjectCount: 1,
        localFrameHash: objectHash(framePlates),
        frameAxisHash: lineHash(axisLines),
        vectorTransportHash: lineHash(vectorLines),
        transportPathHash: lineHash(transportLines),
        connectionMatrixHash: objectHash(matrixBlocks),
        holonomyDiscHash: objectHash([holonomyDisc]),
        gaugeRingHash: lineHash([gaugeRing]),
        canonicalReferences: ["SO(2) transport", "connection Laplacian block operator", "loop holonomy", "orthogonal norm preservation", "gauge invariance", "vector diffusion maps"],
        connectionObjects: ["local_frame", "so2_transport", "parallel_vector", "loop_holonomy", "connection_laplacian_block", "gauge_action"],
        diagnosticMetrics: ["holonomy_angle", "transport_norm", "orthogonality_error", "connection_energy", "curvature_defect"],
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
    window.__h09LabReady = true;
    animate();
  }

  function createH10HeterophilyConcreteLab() {
    const root = document.querySelector('[data-lab-id="h10"]');
    const canvas = document.getElementById("canvas");
    if (!root || !canvas) return;
    const { renderer, scene, camera, cameraState, grid } = setupScene(canvas, 9.3);
    const selected = root.querySelector('[data-role="selected"] strong');
    const insight = root.querySelector('[data-role="insight"]');
    const stateText = document.getElementById("stateBox");
    const formulaText = document.getElementById("formulaText");
    const state = { status: "Ready", revision: 0, lastControl: "initial", lastAction: "Ready", learned: false, sheafStep: 0, graphStep: 0, controls: {} };
    const roles = [
      { name: "buyer", pos: new THREE.Vector3(-2.8, 0, 0.85), label: 0 },
      { name: "seller", pos: new THREE.Vector3(-1.55, 0, -0.2), label: 1 },
      { name: "buyer", pos: new THREE.Vector3(-0.35, 0, 0.85), label: 0 },
      { name: "seller", pos: new THREE.Vector3(0.9, 0, -0.2), label: 1 },
      { name: "product", pos: new THREE.Vector3(2.15, 0, 0.78), label: 2 },
      { name: "reviewer", pos: new THREE.Vector3(2.85, 0, -0.72), label: 2 }
    ];
    const edgePairs = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 2], [4, 5], [1, 5]];
    const nodeDots = roles.map((role, index) => {
      const dot = makeSphere(0.15, [COLORS.blue, COLORS.amber, COLORS.violet][role.label], 0.94);
      dot.position.copy(role.pos);
      scene.add(dot);
      return dot;
    });
    const roleTowers = [];
    roles.forEach((role, nodeIndex) => {
      for (let channel = 0; channel < 2; channel += 1) {
        const tower = makeBox([0.09, 0.34, 0.09], channel === 0 ? COLORS.blue : COLORS.cyan, 0.4);
        tower.position.copy(role.pos).add(new THREE.Vector3(channel * 0.13 - 0.065, 0.34, 0));
        scene.add(tower);
        roleTowers.push({ tower, nodeIndex, channel });
      }
    });
    const edgeLines = edgePairs.map(([a, b]) => {
      const line = makeLine([roles[a].pos, roles[b].pos], COLORS.ink, 0.18);
      scene.add(line);
      return line;
    });
    const edgeStalks = edgePairs.slice(0, 5).map(([a, b]) => {
      const plate = makeBox([0.42, 0.045, 0.2], COLORS.green, 0.26);
      plate.position.copy(roles[a].pos).lerp(roles[b].pos, 0.5).add(new THREE.Vector3(0, 0.12, 0));
      scene.add(plate);
      return plate;
    });
    const restrictionLines = Array.from({ length: 10 }, () => {
      const line = makeLine([], COLORS.cyan, 0.24);
      scene.add(line);
      return line;
    });
    const matrixCells = Array.from({ length: 9 }, (_, index) => {
      const cell = makeBox([0.16, 0.06, 0.16], index % 4 === 0 ? COLORS.blue : COLORS.amber, 0.28);
      scene.add(cell);
      return cell;
    });
    const rawLane = makeLine([], COLORS.rose, 0.42);
    const sheafLane = makeLine([], COLORS.green, 0.56);
    scene.add(rawLane, sheafLane);
    const residualRods = edgeStalks.map(() => {
      const rod = makeBox([0.07, 0.28, 0.07], COLORS.rose, 0.42);
      scene.add(rod);
      return rod;
    });
    const energyBars = Array.from({ length: 5 }, (_, index) => {
      const bar = makeBox([0.12, 0.3, 0.12], index < 2 ? COLORS.rose : COLORS.green, 0.38);
      scene.add(bar);
      return bar;
    });
    grid(3.2, 1.75, -1.12);

    function markControl(id, value) {
      state.revision += 1;
      state.lastControl = id;
      state.controls[id] = value == null ? "clicked" : String(value);
    }

    function stats() {
      const scenario = selectValue("scenario", "bipartite");
      const relationFamily = selectValue("relationFamily", "signed");
      const view = selectValue("view", "matrix");
      const propagationRounds = rangeValue("propagationRounds", 4);
      const compatibilitySharpness = rangeValue("compatibilitySharpness", 1);
      const relationNoise = rangeValue("relationNoise", 0.2);
      const relationTypes = rangeValue("relationTypes", 4);
      const roleIdentity = rangeValue("roleIdentity", 0.58);
      const homophilyRatio = scenario === "homophily" ? 0.72 : scenario === "mixed" ? 0.42 : 0.18;
      const structuredHeterophily = scenario === "bipartite" ? 0.9 : scenario === "mixed" ? 0.55 : scenario === "homophily" ? 0.18 : 0.72;
      const mapAgreement = clamp(0.46 + compatibilitySharpness * 0.14 + relationTypes * 0.035 + (state.learned ? 0.28 : 0) - relationNoise * 0.3, 0.1, 0.98);
      const rawEnergy = Math.max(0.12, 0.72 + structuredHeterophily * 0.92 + relationNoise * 0.3);
      const sheafEnergy = Math.max(0.04, (1.15 - mapAgreement + relationNoise * 0.45) * (state.sheafStep ? 0.58 : 1));
      const roleAccuracy = clamp(0.48 + mapAgreement * 0.38 + roleIdentity * 0.18 - relationNoise * 0.12, 0, 1.1);
      const oversmoothing = state.graphStep > 0 || view === "graph" ? clamp(0.28 + propagationRounds * 0.08 + structuredHeterophily * 0.18, 0, 1.3) : clamp(0.12 + propagationRounds * 0.025, 0, 0.45);
      const neighborHelp = clamp(roleAccuracy - homophilyRatio * 0.12, 0, 1.15);
      const mapCollapseWarning = mapAgreement > 0.2 ? 0 : 1;
      return {
        scenario,
        relationFamily,
        view,
        propagationRounds,
        compatibilitySharpness,
        relationNoise,
        relationTypes,
        roleIdentity,
        homophilyRatio,
        structuredHeterophily,
        mapAgreement,
        rawEnergy,
        sheafEnergy,
        roleAccuracy,
        oversmoothing,
        neighborHelp,
        mapCollapseWarning
      };
    }

    function updateScene() {
      const s = stats();
      roles.forEach((role, index) => {
        nodeDots[index].position.copy(role.pos).add(new THREE.Vector3(0, (index % 2 === 0 ? 0.08 : -0.02) + s.roleIdentity * 0.05, 0));
        nodeDots[index].scale.setScalar(1 + (s.scenario === "homophily" ? 0.08 : 0.18));
      });
      roleTowers.forEach(({ tower, nodeIndex, channel }) => {
        const sign = roles[nodeIndex].label === 1 && s.scenario !== "homophily" ? -1 : 1;
        const graphCollapse = state.graphStep > 0 ? 0.18 : 0;
        const sheafLift = state.sheafStep > 0 ? 0.08 : 0;
        const value = 0.4 + channel * 0.18 + Math.abs(sign) * 0.12 + s.relationNoise * 0.14 - graphCollapse + sheafLift;
        tower.position.copy(roles[nodeIndex].pos).add(new THREE.Vector3(channel * 0.13 - 0.065, 0.2 + value * 0.18, state.graphStep > 0 ? -0.05 : 0));
        tower.scale.y = 0.52 + value;
        tower.material.color.setHex(sign > 0 ? COLORS.blue : COLORS.amber);
      });
      edgeLines.forEach((line, index) => {
        const [a, b] = edgePairs[index];
        const midpointLift = state.graphStep > 0 ? -0.08 : state.sheafStep > 0 ? 0.08 : 0;
        setTrackedLine(line, [
          roles[a].pos,
          roles[a].pos.clone().lerp(roles[b].pos, 0.5).add(new THREE.Vector3(0, 0.16 + midpointLift, 0)),
          roles[b].pos
        ]);
        const same = roles[a].label === roles[b].label;
        line.material.color.setHex(same ? COLORS.blue : COLORS.amber);
        line.material.opacity = 0.14 + (same ? s.homophilyRatio : s.structuredHeterophily) * 0.22;
      });
      edgeStalks.forEach((plate, index) => {
        const [a, b] = edgePairs[index];
        plate.position.copy(roles[a].pos).lerp(roles[b].pos, 0.5).add(new THREE.Vector3(0, 0.13, 0));
        plate.scale.x = 0.78 + s.mapAgreement * 0.4;
        plate.material.color.setHex(s.relationFamily === "signed" ? COLORS.green : COLORS.cyan);
        plate.material.opacity = 0.18 + s.mapAgreement * 0.2;
      });
      restrictionLines.forEach((line, index) => {
        const edgeIndex = Math.floor(index / 2);
        const endpoint = edgePairs[edgeIndex][index % 2];
        const a = roles[endpoint].pos.clone().add(new THREE.Vector3(0, 0.42, 0));
        const b = edgeStalks[edgeIndex].position.clone().add(new THREE.Vector3(0, 0.1, 0));
        const familyBend = s.relationFamily === "projection" ? 0.12 : s.relationFamily === "diagonal" ? 0.06 : 0;
        setTrackedLine(line, [a, a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, 0.18 + familyBend + (state.learned ? 0.05 : 0), familyBend * (index % 2 ? -1 : 1))), b]);
        line.material.opacity = 0.16 + s.mapAgreement * 0.32;
        line.material.color.setHex(s.relationFamily === "projection" ? COLORS.violet : COLORS.cyan);
      });
      matrixCells.forEach((cell, index) => {
        const row = Math.floor(index / 3);
        const col = index % 3;
        const offDiagonal = row !== col;
        const strength = s.scenario === "homophily" ? (offDiagonal ? 0.18 : 0.86) : (offDiagonal ? 0.78 : 0.24);
        cell.position.set(-0.38 + col * 0.22, -0.86 + row * 0.18, 1.62);
        cell.position.z = 1.62 + (state.learned && offDiagonal ? 0.06 : 0);
        cell.scale.y = 0.58 + strength * 0.62 + (state.learned ? 0.08 : 0);
        cell.material.opacity = s.view === "matrix" ? 0.42 : 0.22;
        cell.material.color.setHex(offDiagonal ? COLORS.amber : COLORS.blue);
      });
      setTrackedLine(rawLane, roles.map((role, index) => role.pos.clone().add(new THREE.Vector3(0, 0.74 - s.oversmoothing * 0.2 + index * 0.01 - state.graphStep * 0.008, -0.18))));
      setTrackedLine(sheafLane, roles.map((role, index) => role.pos.clone().add(new THREE.Vector3(0, 0.52 + (index % 2) * 0.16 + state.sheafStep * 0.025, 0.22 + state.sheafStep * 0.01))));
      rawLane.material.opacity = s.view === "graph" || state.graphStep ? 0.56 : 0.28;
      sheafLane.material.opacity = s.view === "sheaf" || state.sheafStep ? 0.66 : 0.34;
      residualRods.forEach((rod, index) => {
        const value = Math.max(0.05, (1 - s.mapAgreement) * 0.62 + s.relationNoise * 0.3 + index * 0.02);
        rod.position.copy(edgeStalks[index].position).add(new THREE.Vector3(0, 0.3 + value * 0.06, 0));
        rod.scale.y = 0.22 + value * (state.sheafStep ? 0.34 : 0.7);
        rod.material.color.setHex(state.sheafStep || value < 0.2 ? COLORS.green : COLORS.rose);
      });
      [s.rawEnergy, s.sheafEnergy, s.roleAccuracy, s.oversmoothing, s.mapAgreement].forEach((value, index) => {
        const bar = energyBars[index];
        bar.position.set(1.45 + index * 0.2, -0.96 + value * 0.1, 1.58);
        bar.scale.y = 0.2 + value * 0.46;
        bar.material.color.setHex(index === 0 || index === 3 ? COLORS.rose : COLORS.green);
      });
    }

    function updatePanel() {
      const s = stats();
      setMetric(root, "Neighbor help", s.neighborHelp, 2);
      setMetric(root, "Role agreement", s.roleAccuracy, 2);
      setMetric(root, "Relation coverage", s.relationTypes, 0);
      setMetric(root, "Raw smoothing loss", s.oversmoothing, 2);
      document.getElementById("helpLabel").textContent = fmt(s.neighborHelp, 2);
      document.getElementById("mapLabel").textContent = `${Math.round(s.mapAgreement * 100)}%`;
      document.getElementById("homophilyLabel").textContent = fmt(s.homophilyRatio, 2);
      document.getElementById("smoothLabel").textContent = fmt(s.oversmoothing, 2);
      if (formulaText) formulaText.textContent = "B_u x_u = B_v x_v";
      if (selected) selected.textContent = `${s.scenario} | ${s.relationFamily} | h ${fmt(s.homophilyRatio, 2)}`;
      if (insight) insight.textContent = "The canonical object is a heterophilic role graph plus a compatibility matrix: raw graph smoothing averages unlike roles, while sheaf restrictions compare them in edge-stalk relation spaces.";
      if (state.status === "Relations learned") {
        stateText.textContent = `${state.lastAction}: the compatibility matrix highlights buyer-seller and role-pair structure, while restriction maps learn how each endpoint enters the edge-stalk comparison. Last control ${state.lastControl}.`;
      } else if (state.status === "Sheaf stepped") {
        stateText.textContent = `${state.lastAction}: sheaf diffusion compares B_u x_u and B_v x_v inside each edge-stalk, reducing transported disagreement while preserving heterophilic role contrast. Last control ${state.lastControl}.`;
      } else if (state.status === "Graph smoothed") {
        stateText.textContent = `${state.lastAction}: raw Laplacian smoothing ignores the role compatibility matrix, so buyer-seller contrast collapses and over-smoothing rises. Last control ${state.lastControl}.`;
      } else if (s.scenario === "homophily") {
        stateText.textContent = `${state.lastAction}: homophily preset makes same-label edges dominate, so ordinary smoothing is less destructive than in structured heterophily. Last control ${state.lastControl}.`;
      } else {
        const scenarioName = s.scenario === "bipartite" ? "buyer-seller bipartite" : s.scenario;
        stateText.textContent = `${state.lastAction}: ${scenarioName} heterophily uses ${s.relationFamily} restriction maps, a compatibility matrix, and edge-stalk comparisons so unlike roles become interpretable instead of random bad edges. Last control ${state.lastControl}.`;
      }
      syncOutput("propagationRounds", s.propagationRounds, 0);
      syncOutput("compatibilitySharpness", s.compatibilitySharpness, 2);
      syncOutput("relationNoise", s.relationNoise, 2);
      syncOutput("relationTypes", s.relationTypes, 0);
      syncOutput("roleIdentity", s.roleIdentity, 2);
    }

    function refresh() {
      updateScene();
      updatePanel();
    }

    ["scenario", "relationFamily", "view"].forEach((id) => {
      document.getElementById(id).addEventListener("change", (event) => {
        markControl(id, event.target.value);
        state.status = "Ready";
        state.lastAction = "View change";
        refresh();
      });
    });
    ["propagationRounds", "compatibilitySharpness", "relationNoise", "relationTypes", "roleIdentity"].forEach((id) => {
      document.getElementById(id).addEventListener("input", (event) => {
        markControl(id, event.target.value);
        state.status = "Ready";
        state.lastAction = "Parameter change";
        refresh();
      });
    });
    document.getElementById("learnRelations").addEventListener("click", () => {
      markControl("learnRelations", "clicked");
      state.status = "Relations learned";
      state.learned = true;
      state.lastAction = "Learn relations";
      document.getElementById("view").value = "matrix";
      refresh();
    });
    document.getElementById("stepSheaf").addEventListener("click", () => {
      markControl("stepSheaf", "clicked");
      state.status = "Sheaf stepped";
      state.sheafStep += 1;
      state.lastAction = "Step sheaf";
      document.getElementById("view").value = "sheaf";
      refresh();
    });
    document.getElementById("runGraph").addEventListener("click", () => {
      markControl("runGraph", "clicked");
      state.status = "Graph smoothed";
      state.graphStep += 5;
      state.lastAction = "Run graph";
      document.getElementById("view").value = "graph";
      refresh();
    });
    document.getElementById("resetH10").addEventListener("click", () => {
      markControl("resetH10", "clicked");
      document.getElementById("scenario").value = "bipartite";
      document.getElementById("relationFamily").value = "signed";
      document.getElementById("view").value = "matrix";
      setRange("propagationRounds", 4);
      setRange("compatibilitySharpness", 1);
      setRange("relationNoise", 0.2);
      setRange("relationTypes", 4);
      setRange("roleIdentity", 0.58);
      state.status = "Ready";
      state.learned = false;
      state.sheafStep = 0;
      state.graphStep = 0;
      state.lastAction = "Reset";
      refresh();
    });

    function animate() {
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }

    window.__h10LabSnapshot = function () {
      const s = stats();
      return {
        kind: "sheaf-heterophily-compatibility",
        labId: "h10",
        sceneObject: "heterophilic-role-graph-compatibility-matrix-edge-stalk-restrictions",
        title: "H10 Sheaves And Heterophily",
        status: state.status,
        scenario: s.scenario,
        relationFamily: s.relationFamily,
        view: s.view,
        roleNodeCount: roles.length,
        edgeCount: edgePairs.length,
        compatibilityMatrixCellCount: 9,
        edgeStalkPlateCount: edgeStalks.length,
        restrictionMapCount: restrictionLines.length,
        rawSmoothingLaneCount: 1,
        sheafCompatibilityLaneCount: 1,
        activeRelationTypeCount: s.relationTypes,
        homophilyRatio: s.homophilyRatio,
        mapAgreement: s.mapAgreement,
        rawEnergy: s.rawEnergy,
        sheafEnergy: s.sheafEnergy,
        roleAccuracy: s.roleAccuracy,
        oversmoothing: s.oversmoothing,
        graphStepCount: state.graphStep,
        sheafStepCount: state.sheafStep,
        has3d: true,
        visualKind: "heterophily-role-compatibility-matrix",
        graphStyle: "hybrid",
        visualQuality: "h10-concrete-heterophily-v2",
        clarityVersion: "h09-h10-canonical-clarity-v1",
        roleNodeObjectCount: nodeDots.length,
        roleFeatureTowerObjectCount: roleTowers.length,
        edgeRelationObjectCount: edgeLines.length,
        edgeStalkPlateObjectCount: edgeStalks.length,
        restrictionMapObjectCount: restrictionLines.length,
        compatibilityMatrixObjectCount: matrixCells.length,
        residualObjectCount: residualRods.length,
        energyBarObjectCount: energyBars.length,
        roleNodeHash: objectHash(nodeDots),
        roleFeatureTowerHash: objectHash(roleTowers.map((item) => item.tower)),
        edgeRelationHash: lineHash(edgeLines),
        edgeStalkHash: objectHash(edgeStalks),
        restrictionMapHash: lineHash(restrictionLines),
        compatibilityMatrixHash: objectHash(matrixCells),
        rawSmoothingLaneHash: lineHash([rawLane]),
        sheafCompatibilityLaneHash: lineHash([sheafLane]),
        residualHash: objectHash(residualRods),
        energyBarHash: objectHash(energyBars),
        canonicalReferences: ["heterophily role graph", "label homophily ratio", "signed restriction maps", "edge-stalk compatibility", "raw Laplacian smoothing baseline", "sheaf energy"],
        heterophilyObjects: ["role_graph", "compatibility_matrix", "signed_restriction_map", "edge_stalk_relation", "raw_laplacian_smoothing", "sheaf_energy"],
        diagnosticMetrics: ["homophily_ratio", "map_agreement", "raw_energy", "sheaf_energy", "role_accuracy", "oversmoothing"],
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
    window.__h10LabReady = true;
    animate();
  }

  function createH11GaugeTheoryConcreteLab() {
    const root = document.querySelector('[data-lab-id="h11"]');
    const canvas = document.getElementById("canvas");
    if (!root || !canvas) return;
    const { renderer, scene, camera, cameraState, grid } = setupScene(canvas, 9.1);
    const selected = root.querySelector('[data-role="selected"] strong');
    const insight = root.querySelector('[data-role="insight"]');
    const stateText = document.getElementById("stateBox");
    const formulaText = document.getElementById("formulaText");
    const state = { status: "Ready", mode: "covariant", revision: 0, lastControl: "initial", lastAction: "Ready", gaugeApplications: 0, holonomyShown: false, controls: {} };
    const frames = [
      new THREE.Vector3(-2.05, 0, 0.92),
      new THREE.Vector3(0.05, 0, -0.02),
      new THREE.Vector3(2.05, 0, 0.92)
    ];
    const framePlates = frames.map((position) => {
      const plate = makeBox([0.58, 0.035, 0.58], COLORS.blue, 0.18);
      plate.position.copy(position);
      scene.add(plate);
      return plate;
    });
    const axisLines = Array.from({ length: 6 }, () => {
      const line = makeLine([], COLORS.cyan, 0.42);
      scene.add(line);
      return line;
    });
    const fiberVectors = Array.from({ length: 3 }, () => {
      const line = makeLine([], COLORS.amber, 0.5);
      scene.add(line);
      return line;
    });
    const restrictionLines = Array.from({ length: 4 }, () => {
      const line = makeLine([], COLORS.green, 0.28);
      scene.add(line);
      return line;
    });
    const gaugeMatrices = Array.from({ length: 3 }, (_, index) => {
      const box = makeBox([0.24, 0.16, 0.08], COLORS.violet, 0.36);
      box.position.copy(frames[index]).add(new THREE.Vector3(0, 0.68, 0));
      scene.add(box);
      return box;
    });
    const invariantOrbit = makeLine([], COLORS.green, 0.42);
    const holonomyLoop = makeLine([], COLORS.rose, 0.28);
    scene.add(invariantOrbit, holonomyLoop);
    const brokenArtifacts = Array.from({ length: 4 }, () => {
      const line = makeLine([], COLORS.rose, 0.1);
      scene.add(line);
      return line;
    });
    const energyBars = Array.from({ length: 4 }, (_, index) => {
      const bar = makeBox([0.12, 0.3, 0.12], index < 2 ? COLORS.green : COLORS.rose, 0.38);
      scene.add(bar);
      return bar;
    });
    grid(3.1, 1.7, -1.12);

    function markControl(id, value) {
      state.revision += 1;
      state.lastControl = id;
      state.controls[id] = value == null ? "clicked" : String(value);
    }

    function stats() {
      const scenario = selectValue("scenario", "edge");
      const view = selectValue("mode", "covariant");
      const gaugeSteps = rangeValue("gaugeSteps", 4);
      const frameRotation = rangeValue("frameRotation", 1);
      const gaugeMismatch = rangeValue("gaugeMismatch", 0.14);
      const visibleFrames = rangeValue("visibleFrames", 3);
      const invariantAnchor = rangeValue("invariantAnchor", 0.62);
      const covariant = state.mode === "covariant";
      const baseEnergy = 0.42 + gaugeMismatch * 0.28;
      const energy = covariant ? baseEnergy * (1 - invariantAnchor * 0.12) : baseEnergy * (1.28 + gaugeMismatch + frameRotation * 0.18);
      const energyRatio = energy / Math.max(0.001, baseEnergy * (1 - invariantAnchor * 0.12));
      const gaugeError = covariant ? gaugeMismatch * 0.08 : gaugeMismatch + frameRotation * 0.18;
      const holonomyAngle = scenario === "triangle" || state.holonomyShown ? 24 + frameRotation * 12 + gaugeMismatch * 18 : 0;
      const curvatureSignal = Math.abs(holonomyAngle) / 60;
      return {
        scenario,
        view,
        gaugeSteps,
        frameRotation,
        gaugeMismatch,
        visibleFrames,
        invariantAnchor,
        covariant,
        baseEnergy,
        energy,
        energyRatio,
        gaugeError,
        holonomyAngle,
        curvatureSignal
      };
    }

    function vectorAt(origin, degrees, length) {
      const radians = degrees * Math.PI / 180;
      return origin.clone().add(new THREE.Vector3(Math.cos(radians) * length, 0.38, Math.sin(radians) * length));
    }

    function updateScene() {
      const s = stats();
      framePlates.forEach((plate, index) => {
        plate.material.color.setHex(index < s.visibleFrames ? COLORS.blue : COLORS.muted);
        plate.material.opacity = index < s.visibleFrames ? 0.18 + s.invariantAnchor * 0.08 : 0.06;
      });
      axisLines.forEach((line, index) => {
        const frameIndex = Math.floor(index / 2);
        const baseAngle = frameIndex * 18 + (state.gaugeApplications > 0 ? s.frameRotation * 24 * (frameIndex + 1) : 0);
        const axisAngle = baseAngle + (index % 2 === 0 ? 0 : 90);
        const origin = frames[frameIndex].clone().add(new THREE.Vector3(0, 0.04, 0));
        setTrackedLine(line, [vectorAt(origin, axisAngle + 180, 0.34), vectorAt(origin, axisAngle, 0.34)]);
        line.material.color.setHex(index % 2 === 0 ? COLORS.cyan : COLORS.violet);
        line.material.opacity = 0.34 + s.frameRotation * 0.05;
      });
      fiberVectors.forEach((line, index) => {
        const origin = frames[index].clone().add(new THREE.Vector3(0, 0.18, 0));
        const angle = 20 + index * 25 + (state.gaugeApplications > 0 ? s.frameRotation * 18 : 0);
        setTrackedLine(line, [origin, vectorAt(origin, angle, 0.58)]);
        line.material.color.setHex(COLORS.amber);
        line.material.opacity = 0.46;
      });
      restrictionLines.forEach((line, index) => {
        const a = frames[index < 2 ? index : index - 1].clone().add(new THREE.Vector3(0, 0.46, 0));
        const b = frames[index < 2 ? 1 : 2].clone().add(new THREE.Vector3(0, 0.46, 0));
        const covarianceLift = s.covariant ? -s.gaugeMismatch * 0.06 : s.gaugeError * (0.24 + index * 0.04);
        const curvatureLift = s.holonomyAngle ? 0.12 + s.curvatureSignal * 0.22 : 0;
        setTrackedLine(line, [a, a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, 0.28 + curvatureLift + covarianceLift, (index - 1.5) * s.gaugeError * 0.18)), b]);
        line.material.color.setHex(s.covariant ? COLORS.green : COLORS.rose);
        line.material.opacity = 0.26 + (s.covariant ? 0.16 : 0.28);
      });
      gaugeMatrices.forEach((box, index) => {
        box.position.copy(frames[index]).add(new THREE.Vector3(0, 0.68 + state.gaugeApplications * 0.02, 0));
        box.material.color.setHex(s.covariant ? COLORS.violet : COLORS.rose);
        box.scale.y = 0.9 + s.frameRotation * 0.16;
      });
      const orbitPoints = [];
      const orbitPhase = state.gaugeApplications * 0.22 + (s.covariant ? s.frameRotation * 0.08 : s.gaugeError * 0.34);
      for (let i = 0; i <= 28; i += 1) {
        const t = i / 28 * Math.PI * 2 + orbitPhase;
        orbitPoints.push(new THREE.Vector3(Math.cos(t) * (0.9 + s.invariantAnchor * 0.08), -0.72 + Math.sin(t) * 0.06, 1.42 + Math.sin(t) * (0.26 + s.gaugeError * 0.08)));
      }
      setTrackedLine(invariantOrbit, orbitPoints);
      invariantOrbit.material.opacity = s.covariant ? 0.5 : 0.18;
      setTrackedLine(holonomyLoop, [frames[0], frames[1], frames[2], frames[0]].map((point, index) => point.clone().add(new THREE.Vector3(0, 0.82 + Math.sin(index) * s.curvatureSignal * 0.22, -0.12 + s.curvatureSignal * 0.18))));
      holonomyLoop.material.opacity = s.scenario === "triangle" || state.holonomyShown ? 0.58 : 0.12;
      brokenArtifacts.forEach((line, index) => {
        const anchor = frames[index < 2 ? index : index - 1].clone().lerp(frames[index < 2 ? 1 : 2], 0.5).add(new THREE.Vector3(0, 0.28 + index * 0.04, -0.32 + index * 0.18));
        const residual = anchor.clone().add(new THREE.Vector3(0, s.gaugeError * 0.72 + 0.08, s.gaugeError * (index % 2 ? 0.32 : -0.32)));
        setTrackedLine(line, [anchor, residual]);
        line.material.opacity = s.covariant ? 0.08 : 0.28 + s.gaugeError * 0.34;
        line.material.color.setHex(s.covariant ? COLORS.muted : COLORS.rose);
      });
      [s.energy, s.gaugeError, s.energyRatio, s.curvatureSignal].forEach((value, index) => {
        const bar = energyBars[index];
        bar.position.set(-0.3 + index * 0.2, -0.96 + value * 0.1, -1.56);
        bar.scale.y = 0.16 + value * 0.42;
        bar.material.color.setHex(index === 0 ? COLORS.green : index === 3 ? COLORS.rose : COLORS.amber);
      });
    }

    function updatePanel() {
      const s = stats();
      setMetric(root, "Gauge error", s.gaugeError, 2);
      setMetric(root, "Invariant energy", s.energy, 2);
      setMetric(root, "Frame coverage", s.visibleFrames, 0);
      setMetric(root, "Curvature signal", s.curvatureSignal, 2);
      document.getElementById("errorLabel").textContent = fmt(s.gaugeError, 2);
      document.getElementById("energyLabel").textContent = fmt(s.energy, 2);
      document.getElementById("ratioLabel").textContent = fmt(s.energyRatio, 2);
      document.getElementById("holonomyLabel").textContent = fmt(s.holonomyAngle, 1);
      if (formulaText) formulaText.textContent = "B'_ve = B_ve g_v^-1";
      if (selected) selected.textContent = `${state.mode} | ${s.scenario} | E ${fmt(s.energy, 2)}`;
      if (insight) insight.textContent = "The canonical object is a local-frame gauge diagram: feature coordinates rotate by g_v, restriction maps compensate by g_v^-1, and only broken covariance creates fake residual energy.";
      if (state.status === "Gauge applied" && state.mode === "covariant") {
        stateText.textContent = `${state.lastAction}: covariant gauge uses inverse restriction update B'_ve = B_ve g_v^-1, so the same physical section keeps invariant energy. Last control ${state.lastControl}.`;
      } else if (state.status === "Gauge applied") {
        stateText.textContent = `${state.lastAction}: broken gauge rotates feature coordinates without inverse restriction update, creating fake residual energy from a coordinate artifact. Last control ${state.lastControl}.`;
      } else if (state.status === "Holonomy shown") {
        stateText.textContent = `${state.lastAction}: holonomy around the triangle is curvature; the matrix form changes with gauge, but the geometric loop signal remains. Last control ${state.lastControl}.`;
      } else {
        stateText.textContent = `${state.lastAction}: local frame choices, gauge matrices, covariant restriction maps, invariant energy orbit, and B'_ve = B_ve g_v^-1 are visible. Last control ${state.lastControl}.`;
      }
      syncOutput("gaugeSteps", s.gaugeSteps, 0);
      syncOutput("frameRotation", s.frameRotation, 2);
      syncOutput("gaugeMismatch", s.gaugeMismatch, 2);
      syncOutput("visibleFrames", s.visibleFrames, 0);
      syncOutput("invariantAnchor", s.invariantAnchor, 2);
    }

    function refresh() {
      updateScene();
      updatePanel();
    }

    ["scenario", "mode"].forEach((id) => {
      document.getElementById(id).addEventListener("change", (event) => {
        markControl(id, event.target.value);
        if (id === "mode") state.mode = event.target.value;
        state.status = "Ready";
        state.lastAction = "View change";
        refresh();
      });
    });
    ["gaugeSteps", "frameRotation", "gaugeMismatch", "visibleFrames", "invariantAnchor"].forEach((id) => {
      document.getElementById(id).addEventListener("input", (event) => {
        markControl(id, event.target.value);
        state.status = "Ready";
        state.lastAction = "Parameter change";
        refresh();
      });
    });
    document.getElementById("applyGauge").addEventListener("click", () => {
      markControl("applyGauge", "clicked");
      state.status = "Gauge applied";
      state.gaugeApplications += 1;
      state.lastAction = "Apply gauge";
      refresh();
    });
    document.getElementById("breakGauge").addEventListener("click", () => {
      markControl("breakGauge", "clicked");
      state.mode = "broken";
      document.getElementById("mode").value = "broken";
      state.status = "Ready";
      state.lastAction = "Break covariance";
      refresh();
    });
    document.getElementById("cycleHolonomy").addEventListener("click", () => {
      markControl("cycleHolonomy", "clicked");
      state.status = "Holonomy shown";
      state.holonomyShown = true;
      document.getElementById("scenario").value = "triangle";
      state.lastAction = "Show holonomy";
      refresh();
    });
    document.getElementById("resetH11").addEventListener("click", () => {
      markControl("resetH11", "clicked");
      document.getElementById("scenario").value = "edge";
      document.getElementById("mode").value = "covariant";
      setRange("gaugeSteps", 4);
      setRange("frameRotation", 1);
      setRange("gaugeMismatch", 0.14);
      setRange("visibleFrames", 3);
      setRange("invariantAnchor", 0.62);
      state.status = "Ready";
      state.mode = "covariant";
      state.gaugeApplications = 0;
      state.holonomyShown = false;
      state.lastAction = "Reset";
      refresh();
    });

    function animate() {
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }

    window.__h11LabSnapshot = function () {
      const s = stats();
      return {
        kind: "sheaf-gauge-covariance",
        labId: "h11",
        sceneObject: "local-frames-gauge-matrices-covariant-restrictions-invariant-energy-holonomy",
        title: "H11 Sheaf Theory And Gauge Theory",
        status: state.status,
        mode: state.mode,
        scenario: s.scenario,
        localFrameCount: frames.length,
        fiberVectorCount: fiberVectors.length,
        restrictionMapCount: restrictionLines.length,
        gaugeMatrixCount: gaugeMatrices.length,
        invariantOrbitCount: 1,
        localFrameObjectCount: framePlates.length,
        frameAxisObjectCount: axisLines.length,
        fiberVectorObjectCount: fiberVectors.length,
        restrictionMapObjectCount: restrictionLines.length,
        gaugeMatrixObjectCount: gaugeMatrices.length,
        energyInvariantObjectCount: invariantOrbit ? 1 : 0,
        brokenGaugeObjectCount: brokenArtifacts.length,
        holonomyLoopObjectCount: holonomyLoop ? 1 : 0,
        gaugeOrbitObjectCount: invariantOrbit ? 1 : 0,
        gaugeApplications: state.gaugeApplications,
        energyBefore: s.baseEnergy,
        energyAfter: s.energy,
        energy: s.energy,
        energyRatio: s.energyRatio,
        gaugeError: s.gaugeError,
        invarianceError: s.gaugeError,
        holonomyAngle: s.holonomyAngle,
        curvatureSignal: s.curvatureSignal,
        has3d: true,
        visualKind: "gauge-frame-covariant-restriction",
        graphStyle: "anchors",
        visualQuality: "h11-concrete-gauge-covariance-v1",
        clarityVersion: "h11-h12-canonical-clarity-v1",
        localFrameHash: objectHash(framePlates),
        frameAxisHash: lineHash(axisLines),
        fiberVectorHash: lineHash(fiberVectors),
        restrictionMapHash: lineHash(restrictionLines),
        gaugeMatrixHash: objectHash(gaugeMatrices),
        energyInvariantHash: objectHash(energyBars),
        brokenGaugeHash: lineHash(brokenArtifacts),
        holonomyLoopHash: lineHash([holonomyLoop]),
        gaugeOrbitHash: lineHash([invariantOrbit]),
        canonicalReferences: ["local gauge choice", "B_ve g_v inverse", "covariant restriction update", "gauge invariant energy", "broken gauge artifact", "holonomy curvature"],
        gaugeObjects: ["local_frame", "gauge_transform_matrix", "covariant_restriction_update", "same_section_orbit", "gauge_invariant_energy", "broken_gauge_artifact", "holonomy_loop"],
        diagnosticMetrics: ["energy_before", "energy_after", "invariance_error", "holonomy_angle", "broken_energy_gap"],
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
    window.__h11LabReady = true;
    animate();
  }

  function createH12ApplicationsConcreteLab() {
    const root = document.querySelector('[data-lab-id="h12"]');
    const canvas = document.getElementById("canvas");
    if (!root || !canvas) return;
    const { renderer, scene, camera, cameraState, grid } = setupScene(canvas, 10.7);
    const selected = root.querySelector('[data-role="selected"] strong');
    const insight = root.querySelector('[data-role="insight"]');
    const stateText = document.getElementById("stateBox");
    const formulaText = document.getElementById("formulaText");
    const state = { status: "Ready", mode: "inspect", revision: 0, diffusionStep: 0, domainIndex: 0, lastControl: "initial", controls: {} };
    const domains = [
      {
        key: "fraud",
        label: "fraud / abuse",
        objects: ["account", "device", "card", "merchant", "IP"],
        relations: ["account-device", "card-merchant", "account-IP"],
        text: "fraud station: account, device, card, merchant, and IP endpoints are not similar, but relation-specific transport maps them into a fraud relation space."
      },
      {
        key: "weather",
        label: "weather / traffic",
        objects: ["mesh cell", "wind vector", "road sensor", "upstream car", "downstream car"],
        relations: ["local frames", "upstream flow", "road class"],
        text: "weather station: wind arrows live in local frames, and traffic sensors need upstream/downstream transport before comparison."
      },
      {
        key: "molecule",
        label: "molecule",
        objects: ["C atom", "O atom", "N atom", "bond", "torsion"],
        relations: ["single bond", "double bond", "aromatic bond"],
        text: "molecule station: atom features become comparable through bond, angle, and torsion relation spaces instead of raw averaging."
      },
      {
        key: "recommender",
        label: "recommendation",
        objects: ["user", "item", "cart", "rating", "refund"],
        relations: ["view", "purchase", "skip", "refund"],
        text: "recommendation station: a user and an item are different object types, so clicks, purchases, skips, and refunds need separate adapters."
      },
      {
        key: "medicine",
        label: "medicine",
        objects: ["patient", "drug", "disease", "gene", "lab"],
        relations: ["drug-target", "gene-disease", "treatment-disease"],
        text: "medicine station: patient, drug, disease, gene, and lab spaces meet through audited biomedical relation maps."
      },
      {
        key: "kg",
        label: "knowledge graph",
        objects: ["subject", "relation", "object", "evidence", "time"],
        relations: ["treats", "cites", "born-in", "located-in"],
        text: "knowledge graph station: typed triples use relation-specific transforms so subject and object embeddings meet in the predicate space."
      }
    ];
    const stationPositions = [
      new THREE.Vector3(-3.2, 0, 1.55),
      new THREE.Vector3(-1.15, 0, 2.15),
      new THREE.Vector3(1.15, 0, 2.15),
      new THREE.Vector3(3.2, 0, 1.55),
      new THREE.Vector3(-1.8, 0, -1.85),
      new THREE.Vector3(1.8, 0, -1.85)
    ];
    const center = new THREE.Vector3(0, 0.25, 0);
    const stations = domains.map((domain, index) => {
      const base = makeBox([1.18, 0.08, 0.82], [COLORS.blue, COLORS.cyan, COLORS.amber, COLORS.green, COLORS.violet, COLORS.rose][index], 0.2);
      base.position.copy(stationPositions[index]).add(new THREE.Vector3(0, -0.08, 0));
      scene.add(base);
      const objects = domain.objects.map((_, itemIndex) => {
        const angle = -0.95 + itemIndex * 0.48;
        const item = itemIndex % 2 === 0
          ? makeSphere(0.12, [COLORS.blue, COLORS.cyan, COLORS.amber, COLORS.green, COLORS.violet][itemIndex], 0.88)
          : makeBox([0.18, 0.18, 0.18], [COLORS.blue, COLORS.cyan, COLORS.amber, COLORS.green, COLORS.violet][itemIndex], 0.82);
        item.position.copy(stationPositions[index]).add(new THREE.Vector3(Math.cos(angle) * 0.42, 0.18 + itemIndex * 0.025, Math.sin(angle) * 0.26));
        scene.add(item);
        return item;
      });
      const adapter = makeBox([0.58, 0.09, 0.32], COLORS.green, 0.34);
      adapter.position.copy(stationPositions[index]).lerp(center, 0.46).add(new THREE.Vector3(0, 0.22, 0));
      scene.add(adapter);
      const line = makeLine([stationPositions[index].clone().add(new THREE.Vector3(0, 0.2, 0)), adapter.position, center], COLORS.cyan, 0.2);
      scene.add(line);
      return { base, objects, adapter, line };
    });
    const rawLane = makeBox([3.0, 0.12, 0.2], COLORS.rose, 0.3);
    rawLane.position.set(-1.8, -0.62, -0.15);
    scene.add(rawLane);
    const sheafLane = makeBox([3.0, 0.12, 0.2], COLORS.green, 0.34);
    sheafLane.position.set(1.8, -0.62, -0.15);
    scene.add(sheafLane);
    const centralAdapter = makeSphere(0.42, COLORS.green, 0.22);
    centralAdapter.scale.set(1.6, 0.28, 1.0);
    centralAdapter.position.copy(center);
    scene.add(centralAdapter);
    const packetA = makeSphere(0.12, COLORS.rose, 0.9);
    const packetB = makeSphere(0.12, COLORS.green, 0.9);
    scene.add(packetA, packetB);
    const vectorLines = Array.from({ length: 4 }, (_, index) => {
      const line = makeLine([], index % 2 ? COLORS.cyan : COLORS.blue, 0.5);
      scene.add(line);
      return line;
    });
    const bondConstraints = Array.from({ length: 6 }, (_, index) => {
      const bar = makeBox([0.08, 0.08, 0.34], index % 2 ? COLORS.amber : COLORS.green, 0.36);
      scene.add(bar);
      return bar;
    });
    const evaluationPanels = Array.from({ length: 3 }, (_, index) => {
      const panel = makeBox([0.36, 0.12, 0.16], [COLORS.blue, COLORS.green, COLORS.amber][index], 0.28);
      scene.add(panel);
      return panel;
    });
    grid(3.7, 2.4, -0.9);

    function markControl(id, value) {
      state.revision += 1;
      state.lastControl = id;
      state.controls[id] = value == null ? "clicked" : String(value);
      if (value != null && id === "domain") {
        const nextIndex = domains.findIndex((item) => item.key === value);
        state.domainIndex = Math.max(0, nextIndex);
      }
    }

    function stats() {
      const domain = selectValue("domain", "fraud");
      const mapFamily = selectValue("mapFamily", "diagonal");
      const view = selectValue("view", "domain");
      const mapStrength = rangeValue("mapStrength", 0.64);
      const relationNoise = rangeValue("relationNoise", 0.22);
      const edgeMetadata = rangeValue("edgeMetadata", 0.58);
      const baselineDepth = rangeValue("baselineDepth", 4);
      const domainShift = rangeValue("domainShift", 0.18);
      const rawEnergy = 0.88 + relationNoise * 1.05 + baselineDepth * 0.055 + domainShift * 0.72;
      const familyGain = mapFamily === "edge-type" ? 0.12 : mapFamily === "orthogonal" ? 0.08 : mapFamily === "low-rank" ? 0.06 : 0.04;
      const sheafFactor = clamp(0.82 - mapStrength * 0.42 - edgeMetadata * 0.18 - familyGain + relationNoise * 0.22 + domainShift * 0.16, 0.18, 0.94);
      const sheafEnergy = rawEnergy * sheafFactor;
      const robustness = clamp(0.36 + mapStrength * 0.38 + edgeMetadata * 0.3 - relationNoise * 0.16 - domainShift * 0.24 + state.diffusionStep * 0.09, 0.05, 1);
      const baselineCollapse = clamp(0.38 + baselineDepth * 0.055 + relationNoise * 0.34 + domainShift * 0.18, 0, 1);
      const explained = clamp((rawEnergy - sheafEnergy) / Math.max(0.2, rawEnergy), 0, 1);
      return { domain, mapFamily, view, mapStrength, relationNoise, edgeMetadata, baselineDepth, domainShift, rawEnergy, sheafEnergy, robustness, baselineCollapse, explained };
    }

    function updateScene() {
      const s = stats();
      const activeIndex = domains.findIndex((item) => item.key === s.domain);
      state.domainIndex = activeIndex >= 0 ? activeIndex : 0;
      stations.forEach((station, index) => {
        const active = index === state.domainIndex || s.view === "all";
        const pulse = active ? 1 + s.mapStrength * 0.42 : 0.78;
        station.base.scale.set(active ? 1.08 : 0.86, 1, active ? 1.08 : 0.86);
        station.base.material.opacity = active ? 0.32 : 0.12;
        station.adapter.scale.set(1 + s.mapStrength * 0.65, 1 + (active ? 0.5 : 0), 1 + s.edgeMetadata * 0.36);
        station.adapter.rotation.y = (index - 2) * 0.14 + s.mapStrength * 0.38;
        station.adapter.material.opacity = active ? (state.mode === "sheaf" ? 0.66 : 0.55) : 0.18;
        const lineStart = stationPositions[index].clone().add(new THREE.Vector3(0, 0.2, 0));
        const lineMid = station.adapter.position.clone().add(new THREE.Vector3(0, active ? s.mapStrength * 0.22 : 0.04, active ? s.edgeMetadata * 0.18 : 0));
        const lineEnd = center.clone().add(new THREE.Vector3(0, state.mode === "sheaf" ? 0.08 : 0, active ? -s.relationNoise * 0.12 : 0));
        setTrackedLine(station.line, [lineStart, lineMid, lineEnd]);
        station.line.material.opacity = active ? (state.mode === "sheaf" ? 0.72 : 0.56) : 0.11;
        station.objects.forEach((object, itemIndex) => {
          object.scale.setScalar(pulse + itemIndex * 0.03);
          object.position.y = 0.18 + itemIndex * 0.025 + (active ? 0.05 * Math.sin(state.revision * 0.4 + itemIndex) : 0);
          object.material.opacity = active ? 0.94 : 0.28;
        });
      });
      rawLane.scale.x = 0.78 + s.baselineCollapse * 0.72;
      rawLane.material.opacity = state.mode === "failure" ? 0.7 : 0.32;
      sheafLane.scale.x = 0.75 + s.explained * 0.82;
      sheafLane.material.opacity = state.mode === "sheaf" || state.mode === "diffusion" ? 0.7 : 0.34;
      centralAdapter.scale.set(1.55 + s.mapStrength * 0.8, 0.24 + s.edgeMetadata * 0.18, 0.9 + s.explained * 0.48);
      centralAdapter.material.opacity = state.mode === "sheaf" ? 0.36 : 0.22;
      centralAdapter.rotation.z = state.mode === "sheaf" ? s.mapStrength * 0.16 : state.mode === "failure" ? -s.baselineCollapse * 0.12 : 0;
      packetA.position.set(-2.7 + s.baselineCollapse * 1.4, -0.42 + s.relationNoise * 0.18, -0.15);
      packetB.position.set(0.8 + s.explained * 1.8, -0.42 + s.mapStrength * 0.12, -0.15);
      const weatherBase = stationPositions[1];
      vectorLines.forEach((line, index) => {
        const start = weatherBase.clone().add(new THREE.Vector3(-0.36 + index * 0.22, 0.58, -0.34 + index * 0.2));
        const end = start.clone().add(new THREE.Vector3(0.25 * Math.cos(s.mapStrength + index), 0.06, 0.34 * Math.sin(s.edgeMetadata + index * 0.8)));
        setTrackedLine(line, [start, end]);
        line.material.opacity = s.domain === "weather" ? 0.72 : 0.16;
      });
      const moleculeBase = stationPositions[2];
      bondConstraints.forEach((bar, index) => {
        bar.position.copy(moleculeBase).add(new THREE.Vector3(-0.42 + index * 0.16, 0.48 + (index % 2) * 0.08, -0.36 + (index % 3) * 0.24));
        bar.rotation.y = index * 0.52 + s.edgeMetadata * 0.44;
        bar.scale.z = 0.7 + s.edgeMetadata * 0.9;
        bar.material.opacity = s.domain === "molecule" ? 0.62 : 0.14;
      });
      evaluationPanels.forEach((panel, index) => {
        panel.position.set(-0.42 + index * 0.42, -0.38, 1.06);
        panel.scale.y = 0.7 + [s.rawEnergy, s.sheafEnergy, s.robustness][index] * 0.42;
        panel.material.opacity = state.mode === "diffusion" ? 0.66 : 0.24;
      });
    }

    function updatePanel() {
      const s = stats();
      const domain = domains[state.domainIndex] || domains[0];
      setMetric(root, "Domain fit", 0.52 + s.explained * 0.42, 2);
      setMetric(root, "Disagreement explained", s.explained, 2);
      setMetric(root, "Application coverage", domains.length, 0);
      setMetric(root, "Baseline failure gap", s.rawEnergy - s.sheafEnergy, 2);
      const domainLabel = document.getElementById("domainLabel");
      const mapLabel = document.getElementById("mapLabel");
      const gapLabel = document.getElementById("gapLabel");
      const splitLabel = document.getElementById("splitLabel");
      if (domainLabel) domainLabel.textContent = domain.label;
      if (mapLabel) mapLabel.textContent = `${s.mapFamily} transport ${fmt(s.mapStrength, 2)}`;
      if (gapLabel) gapLabel.textContent = fmt(s.rawEnergy - s.sheafEnergy, 2);
      if (splitLabel) splitLabel.textContent = fmt(s.robustness, 2);
      syncOutput("mapStrength", s.mapStrength, 2);
      syncOutput("relationNoise", s.relationNoise, 2);
      syncOutput("edgeMetadata", s.edgeMetadata, 2);
      syncOutput("baselineDepth", s.baselineDepth, 0);
      syncOutput("domainShift", s.domainShift, 2);
      if (selected) selected.textContent = `${domain.label} relation-space adapter`;
      if (formulaText) formulaText.textContent = "R_{v,e} x_v -> relation space -> task loss";
      if (insight) insight.textContent = "Each station keeps its real object: fraud entities, wind frames, bonds, user-item events, biomedical nodes, or typed KG triples.";
      if (!stateText) return;
      if (state.mode === "sheaf") {
        stateText.textContent = `${state.status}: ${domain.label} maps endpoints into the relation space before aggregation; transported disagreement falls from ${fmt(s.rawEnergy, 2)} to ${fmt(s.sheafEnergy, 2)}. Last control ${state.lastControl}.`;
      } else if (state.mode === "diffusion") {
        stateText.textContent = `${state.status}: the model is checked on a domain split, so the adapter must survive drift instead of memorizing relation metadata. Robustness ${fmt(s.robustness, 2)}.`;
      } else if (state.mode === "failure") {
        stateText.textContent = `${state.status}: plain smoothing mixes unlike endpoints and hides ${domain.label} mismatch; the raw baseline keeps higher energy than the sheaf transport lane.`;
      } else if (s.domain === "weather") {
        stateText.textContent = `${state.status}: weather and traffic use local frames, vector arrows, and upstream/downstream road sensors before the sheaf compares signals.`;
      } else if (s.domain === "molecule") {
        stateText.textContent = `${state.status}: molecule bonds, bond type metadata, angles, and torsion constraints choose which atom channels meet in the bond relation space.`;
      } else {
        stateText.textContent = `${state.status}: ${domain.text} Relation-specific transport prevents a plain GNN from treating all neighbors as raw averages.`;
      }
    }

    function setDomain(value) {
      const select = document.getElementById("domain");
      if (select) select.value = value;
      markControl("domain", value);
      state.status = "Domain selected";
      state.mode = "inspect";
      updateScene();
      updatePanel();
    }

    root.querySelectorAll("input[type='range'], select").forEach((control) => {
      control.addEventListener("input", () => {
        markControl(control.id || control.name || "control", control.value);
        if (control.id === "domain") state.domainIndex = domains.findIndex((item) => item.key === control.value);
        state.status = "Control changed";
        state.mode = control.id === "view" && control.value === "baseline" ? "failure" : "inspect";
        updateScene();
        updatePanel();
      });
      control.addEventListener("change", () => {
        markControl(control.id || control.name || "control", control.value);
        if (control.id === "domain") state.domainIndex = domains.findIndex((item) => item.key === control.value);
        updateScene();
        updatePanel();
      });
    });
    const switchDomain = document.getElementById("switchDomain");
    if (switchDomain) switchDomain.addEventListener("click", () => {
      const current = domains.findIndex((item) => item.key === selectValue("domain", "fraud"));
      setDomain(domains[(current + 1 + domains.length) % domains.length].key);
    });
    const applySheaf = document.getElementById("applySheaf");
    if (applySheaf) applySheaf.addEventListener("click", () => {
      state.status = "Sheaf transport applied";
      state.mode = "sheaf";
      markControl("applySheaf");
      updateScene();
      updatePanel();
    });
    const runDiffusion = document.getElementById("runDiffusion");
    if (runDiffusion) runDiffusion.addEventListener("click", () => {
      state.status = "Domain split evaluated";
      state.mode = "diffusion";
      state.diffusionStep += 1;
      markControl("runDiffusion");
      updateScene();
      updatePanel();
    });
    const showFailure = document.getElementById("showFailure");
    if (showFailure) showFailure.addEventListener("click", () => {
      state.status = "Plain smoothing failure";
      state.mode = "failure";
      markControl("showFailure");
      updateScene();
      updatePanel();
    });
    const reset = document.getElementById("resetH12");
    if (reset) reset.addEventListener("click", () => {
      setRange("mapStrength", 0.64);
      setRange("relationNoise", 0.22);
      setRange("edgeMetadata", 0.58);
      setRange("baselineDepth", 4);
      setRange("domainShift", 0.18);
      state.status = "Ready";
      state.mode = "inspect";
      state.diffusionStep = 0;
      setDomain("fraud");
    });

    window.__h12LabSnapshot = () => {
      const s = stats();
      return {
        kind: "sheaf-application-translation-workbench",
        labId: "h12",
        visualKind: "domain-relation-space-adapter",
        sceneObject: "domain-stations-local-spaces-relation-adapters-baseline-vs-sheaf-transport",
        domain: s.domain,
        mapFamily: s.mapFamily,
        view: s.view,
        mode: state.mode,
        status: state.status,
        domainStationCount: domains.length,
        relationAdapterCount: stations.length,
        domainObjectCount: stations.reduce((sum, station) => sum + station.objects.length, 0),
        rawSmoothingLaneCount: 1,
        sheafTransportLaneCount: 1,
        vectorFieldArrowCount: vectorLines.length,
        bondConstraintCount: bondConstraints.length,
        evaluationPanelCount: evaluationPanels.length,
        domainCardObjectCount: stations.length,
        localSpaceObjectCount: stations.reduce((sum, station) => sum + station.objects.length, 0),
        relationSpaceObjectCount: stations.length + 1,
        restrictionMapObjectCount: stations.length,
        plainSmoothingFailureObjectCount: 2,
        sheafTransportObjectCount: 2,
        domainMetricObjectCount: evaluationPanels.length,
        baselineComparisonObjectCount: 4,
        rawEnergy: s.rawEnergy,
        sheafEnergy: s.sheafEnergy,
        robustness: s.robustness,
        baselineCollapse: s.baselineCollapse,
        edgeMetadata: s.edgeMetadata,
        relationFit: 0.52 + s.explained * 0.42,
        edgeDisagreement: s.rawEnergy - s.sheafEnergy,
        plainBaselineLoss: s.rawEnergy,
        domainTransferGain: s.robustness,
        mapCost: 0.18 + s.mapStrength * 0.42 + (s.mapFamily === "low-rank" ? -0.06 : s.mapFamily === "edge-type" ? 0.08 : s.mapFamily === "orthogonal" ? 0.12 : 0),
        diffusionStep: state.diffusionStep,
        has3d: true,
        clarityVersion: "h11-h12-canonical-clarity-v1",
        domainCardHash: objectHash(stations.map((station) => station.base)),
        localSpaceHash: objectHash(stations.flatMap((station) => station.objects)),
        relationSpaceHash: objectHash(stations.map((station) => station.adapter).concat([centralAdapter])),
        restrictionMapHash: lineHash(stations.map((station) => station.line).concat(vectorLines)),
        plainSmoothingFailureHash: objectHash([rawLane, packetA]),
        sheafTransportHash: objectHash([sheafLane, centralAdapter, packetB]),
        domainMetricHash: objectHash(evaluationPanels),
        baselineComparisonHash: objectHash([rawLane, sheafLane, packetA, packetB].concat(evaluationPanels)),
        canonicalReferences: ["typed application graph", "local endpoint spaces", "relation-specific restriction map", "edge relation space", "plain smoothing baseline", "domain split evaluation"],
        applicationObjects: ["fraud_transaction_graph", "weather_vector_field", "molecular_bond_relation", "recommendation_bipartite_relation", "traffic_directed_flow", "edge_relation_space", "plain_smoothing_baseline"],
        diagnosticMetrics: ["relation_fit", "edge_disagreement", "plain_baseline_loss", "domain_transfer_gain", "map_cost"],
        stateText: stateText ? stateText.textContent.trim() : "",
        cameraTheta: cameraState.theta,
        cameraPhi: cameraState.phi,
        cameraRadius: cameraState.radius,
        revision: state.revision,
        lastControl: state.lastControl,
        controls: Object.assign({}, state.controls)
      };
    };
    window.__h12LabReady = true;
    updateScene();
    updatePanel();
    function animate() {
      requestAnimationFrame(animate);
      const t = performance.now() * 0.001;
      centralAdapter.rotation.y = t * 0.18;
      renderer.render(scene, camera);
    }
    animate();
  }

  function createH13DirectedHypergraphConcreteLab() {
    const root = document.querySelector('[data-lab-id="h13"]');
    const canvas = document.getElementById("canvas");
    if (!root || !canvas) return;
    const { renderer, scene, camera, cameraState, grid } = setupScene(canvas, 10.2);
    const selected = root.querySelector('[data-role="selected"] strong');
    const insight = root.querySelector('[data-role="insight"]');
    const stateText = document.getElementById("stateBox");
    const formulaText = document.getElementById("formulaText");
    const state = { status: "Ready", mode: "directed", revision: 0, stepCount: 0, flipped: false, projectionCount: 0, lastControl: "initial", controls: {} };
    const nodePositions = [
      new THREE.Vector3(-3.2, 0, 0.9),
      new THREE.Vector3(-2.05, 0, -0.85),
      new THREE.Vector3(1.75, 0, 1.05),
      new THREE.Vector3(3.05, 0, 0.1),
      new THREE.Vector3(1.95, 0, -1.18),
      new THREE.Vector3(0.05, 0, -1.95)
    ];
    const edgeStalkPositions = [new THREE.Vector3(-2.58, 0.38, 0.0), new THREE.Vector3(-0.78, 0.28, 0.42)];
    const hyperedgeCenter = new THREE.Vector3(1.78, 0.42, 0.0);
    const nodeStalks = nodePositions.map((position, index) => {
      const stalk = makeSphere(0.17, [COLORS.blue, COLORS.cyan, COLORS.amber, COLORS.green, COLORS.violet, COLORS.rose][index], 0.92);
      stalk.position.copy(position);
      scene.add(stalk);
      const bar = makeBox([0.12, 0.42, 0.12], [COLORS.blue, COLORS.cyan, COLORS.amber, COLORS.green, COLORS.violet, COLORS.rose][index], 0.38);
      bar.position.copy(position).add(new THREE.Vector3(0, 0.45, 0));
      scene.add(bar);
      return { stalk, bar };
    });
    const directedEdgeStalks = edgeStalkPositions.map((position, index) => {
      const plate = makeBox([0.72, 0.08, 0.34], index ? COLORS.amber : COLORS.green, 0.42);
      plate.position.copy(position);
      scene.add(plate);
      return plate;
    });
    const hyperedgeStalk = makeSphere(0.52, COLORS.green, 0.22);
    hyperedgeStalk.scale.set(1.4, 0.18, 1.0);
    hyperedgeStalk.position.copy(hyperedgeCenter);
    scene.add(hyperedgeStalk);
    const tailAggregate = makeBox([0.24, 0.18, 0.24], COLORS.blue, 0.54);
    const headAggregate = makeBox([0.24, 0.18, 0.24], COLORS.amber, 0.54);
    scene.add(tailAggregate, headAggregate);
    const incidencePairs = [
      [0, edgeStalkPositions[0]], [1, edgeStalkPositions[0]],
      [1, edgeStalkPositions[1]], [2, edgeStalkPositions[1]],
      [2, hyperedgeCenter], [3, hyperedgeCenter], [4, hyperedgeCenter], [5, hyperedgeCenter],
      [0, hyperedgeCenter], [1, hyperedgeCenter]
    ];
    const incidenceMaps = incidencePairs.map((pair, index) => {
      const line = makeLine([], index < 4 ? COLORS.cyan : COLORS.green, 0.3);
      scene.add(line);
      return line;
    });
    const gatherDots = incidencePairs.map((pair, index) => {
      const dot = makeSphere(0.07, index < 4 ? COLORS.cyan : COLORS.green, 0.82);
      scene.add(dot);
      return dot;
    });
    const residualRods = Array.from({ length: 5 }, (_, index) => {
      const rod = makeBox([0.08, 0.36, 0.08], index % 2 ? COLORS.rose : COLORS.amber, 0.44);
      scene.add(rod);
      return rod;
    });
    const cliqueLines = [];
    for (let i = 2; i <= 5; i += 1) {
      for (let j = i + 1; j <= 5; j += 1) {
        const line = makeLine([nodePositions[i], nodePositions[j]], COLORS.rose, 0.08);
        scene.add(line);
        cliqueLines.push(line);
      }
    }
    while (cliqueLines.length < 10) {
      const line = makeLine([nodePositions[0], nodePositions[cliqueLines.length % nodePositions.length]], COLORS.rose, 0.08);
      scene.add(line);
      cliqueLines.push(line);
    }
    const correctionLines = Array.from({ length: 6 }, () => {
      const line = makeLine([], COLORS.amber, 0.18);
      scene.add(line);
      return line;
    });
    grid(3.8, 2.2, -0.96);

    function markControl(id, value) {
      state.revision += 1;
      state.lastControl = id;
      state.controls[id] = value == null ? "clicked" : String(value);
      if (id === "mode" && value) state.mode = value;
    }

    function stats() {
      const mode = selectValue("mode", state.mode || "directed");
      const mapFamily = selectValue("mapFamily", "role");
      const residualView = selectValue("residualView", "projected");
      const stepSize = rangeValue("stepSize", 0.46);
      const roleAsymmetry = rangeValue("roleAsymmetry", 0.58);
      const hyperedgeSize = rangeValue("hyperedgeSize", 4);
      const tolerance = rangeValue("tolerance", 0.18);
      const normalization = rangeValue("normalization", 0.62);
      const mapBoost = mapFamily === "projection" ? 0.13 : mapFamily === "diagonal" ? 0.09 : mapFamily === "rotation" ? 0.07 : 0.04;
      const asymmetry = clamp(0.12 + roleAsymmetry * 0.75 + (state.flipped ? 0.22 : 0), 0, 1.2);
      const baseEnergy = 1.05 + asymmetry * 0.42 + hyperedgeSize * 0.05 - normalization * 0.18;
      const correction = state.stepCount > 0 ? stepSize * (0.44 + mapBoost) : 0;
      const projectionRelief = state.projectionCount > 0 ? 0.28 + tolerance * 0.12 : 0;
      const energy = Math.max(0.18, baseEnergy * (1 - correction) - projectionRelief);
      const projectionDefect = clamp(0.5 + asymmetry * 0.26 - projectionRelief - tolerance * 0.22, 0.05, 1.25);
      const compatibleCount = Math.min(6, Math.max(1, Math.round(1 + tolerance * 6 + state.stepCount * 1.5 + state.projectionCount)));
      return { mode, mapFamily, residualView, stepSize, roleAsymmetry, hyperedgeSize, tolerance, normalization, asymmetry, energy, projectionDefect, compatibleCount };
    }

    function setMode(value) {
      const select = document.getElementById("mode");
      if (select) select.value = value;
      state.mode = value;
      markControl("mode", value);
    }

    function updateScene() {
      const s = stats();
      if (s.mode !== state.mode && s.mode !== "clique") state.mode = s.mode;
      const hyperVisible = state.mode === "hypergraph" || state.mode === "directed-hyperedge";
      const cliqueVisible = state.mode === "clique";
      nodeStalks.forEach((node, index) => {
        const lift = 0.28 + (index % 3) * 0.11 + s.asymmetry * 0.1;
        node.bar.scale.y = 0.65 + lift + (state.stepCount > 0 ? -s.stepSize * 0.12 : 0);
        node.bar.position.y = 0.35 + node.bar.scale.y * 0.22;
        node.stalk.material.opacity = cliqueVisible && index < 2 ? 0.38 : 0.9;
      });
      directedEdgeStalks.forEach((plate, index) => {
        plate.material.opacity = state.mode === "directed" ? 0.58 : 0.18;
        plate.rotation.y = (state.flipped ? -1 : 1) * (0.22 + s.roleAsymmetry * 0.4 + index * 0.3);
        plate.scale.set(1 + s.asymmetry * 0.2, 1, 1 + s.tolerance * 0.3);
      });
      hyperedgeStalk.material.opacity = hyperVisible ? 0.62 : cliqueVisible ? 0.04 : 0.2;
      hyperedgeStalk.scale.set(1.35 + s.hyperedgeSize * 0.08, 0.16 + s.normalization * 0.1, 0.88 + s.tolerance * 0.2);
      tailAggregate.position.copy(hyperedgeCenter).add(new THREE.Vector3(-0.34, 0.28, 0.06));
      headAggregate.position.copy(hyperedgeCenter).add(new THREE.Vector3(0.34, 0.28 + s.projectionDefect * 0.1, -0.06));
      tailAggregate.material.opacity = hyperVisible ? 0.7 : 0.18;
      headAggregate.material.opacity = hyperVisible ? 0.7 : 0.18;
      incidencePairs.forEach(([nodeIndex, target], index) => {
        const start = nodePositions[nodeIndex].clone().add(new THREE.Vector3(0, 0.18, 0));
        const targetPoint = target.clone().add(new THREE.Vector3(0, index < 4 ? 0.08 : 0.18, 0));
        const roleBend = state.flipped && index < 4 ? -0.22 : index < 4 ? 0.12 : 0;
        const projectionBend = state.projectionCount > 0 ? -s.tolerance * 0.16 : s.projectionDefect * 0.08;
        const mid = start.clone().lerp(targetPoint, 0.5).add(new THREE.Vector3(0, roleBend + projectionBend, (index % 2 ? -1 : 1) * s.asymmetry * 0.05));
        setTrackedLine(incidenceMaps[index], [start, mid, targetPoint]);
        incidenceMaps[index].material.opacity = index < 4 ? (state.mode === "directed" ? 0.58 : 0.16) : (hyperVisible ? 0.58 : 0.12);
        gatherDots[index].position.copy(start).lerp(targetPoint, state.stepCount > 0 ? 0.72 : 0.46).add(new THREE.Vector3(0, state.projectionCount > 0 ? -s.projectionDefect * 0.08 : 0, 0));
        gatherDots[index].material.opacity = incidenceMaps[index].material.opacity + 0.08;
      });
      residualRods.forEach((rod, index) => {
        const anchor = index < 2 ? edgeStalkPositions[index] : hyperedgeCenter;
        rod.position.copy(anchor).add(new THREE.Vector3(-0.22 + index * 0.15, 0.42 + s.projectionDefect * 0.15 - state.stepCount * s.stepSize * 0.035, 0.22 - index * 0.08));
        rod.scale.y = 0.55 + s.projectionDefect * 0.85 + s.energy * 0.06;
        rod.material.opacity = state.mode === "clique" ? 0.1 : 0.58;
      });
      cliqueLines.forEach((line, index) => {
        line.material.opacity = cliqueVisible ? 0.52 : 0.06;
        line.material.color.setHex(cliqueVisible ? COLORS.rose : COLORS.muted);
      });
      correctionLines.forEach((line, index) => {
        const start = hyperedgeCenter.clone().add(new THREE.Vector3(0, 0.22, 0));
        const end = nodePositions[index].clone().add(new THREE.Vector3(0, 0.34, 0));
        const mid = start.clone().lerp(end, 0.5).add(new THREE.Vector3(0, state.projectionCount > 0 ? -0.12 : 0.1, (index - 2.5) * 0.03));
        setTrackedLine(line, [start, mid, end]);
        line.material.opacity = state.stepCount > 0 && hyperVisible ? 0.38 : state.projectionCount > 0 ? 0.28 : 0.08;
      });
    }

    function updatePanel() {
      const s = stats();
      setMetric(root, "Asymmetry signal", s.asymmetry, 2);
      setMetric(root, "Hyperedge coherence", 1 / (1 + s.energy), 2);
      setMetric(root, "Incidence coverage", Math.min(10, s.hyperedgeSize + 5), 0);
      setMetric(root, "Projection defect", s.projectionDefect, 2);
      const modeLabel = document.getElementById("modeLabel");
      const energyLabel = document.getElementById("energyLabel");
      const defectLabel = document.getElementById("defectLabel");
      const cliqueLabel = document.getElementById("cliqueLabel");
      if (modeLabel) modeLabel.textContent = state.mode === "directed-hyperedge" ? "directed hyperedge" : state.mode;
      if (energyLabel) energyLabel.textContent = fmt(s.energy, 2);
      if (defectLabel) defectLabel.textContent = fmt(s.projectionDefect, 2);
      if (cliqueLabel) cliqueLabel.textContent = state.mode === "clique" ? "1 group -> 10 pairs" : "1 group stalk";
      syncOutput("stepSize", s.stepSize, 2);
      syncOutput("roleAsymmetry", s.roleAsymmetry, 2);
      syncOutput("hyperedgeSize", s.hyperedgeSize, 0);
      syncOutput("tolerance", s.tolerance, 2);
      syncOutput("normalization", s.normalization, 2);
      if (selected) selected.textContent = state.mode === "clique" ? "clique expansion shadow" : state.mode === "hypergraph" ? "hyperedge group stalk" : "directed edge stalk";
      if (formulaText) formulaText.textContent = state.mode === "hypergraph" ? "z_v = B_ve x_v, h_e = mean(z_v)" : "r_e = B_tgt x_v - B_src x_u";
      if (insight) insight.textContent = "The same participants are shown as node stalks, relation stalks, incidence maps, residuals, and broadcast corrections.";
      if (!stateText) return;
      if (state.mode === "hypergraph") {
        stateText.textContent = `${state.status}: hypergraph mode gathers projected participants into one group stalk, corrects disagreement there, then broadcast returns B^T residuals to node stalks.`;
      } else if (state.mode === "clique") {
        stateText.textContent = `${state.status}: clique expansion replaces one shared group stalk with many pair stalks, so the single group event is no longer visible.`;
      } else if (state.projectionCount > 0) {
        stateText.textContent = `${state.status}: projection shows edge-stalk agreement after source and target values enter the relation space.`;
      } else if (state.flipped) {
        stateText.textContent = `${state.status}: reversing the arrow changes source/target maps and asymmetric residuals; this is observed direction, not a sign convention.`;
      } else {
        stateText.textContent = `${state.status}: directed edge stalk compares source role and target role with asymmetric maps, so compatibility is measured after projection.`;
      }
    }

    root.querySelectorAll("input[type='range'], select").forEach((control) => {
      control.addEventListener("input", () => {
        markControl(control.id || "control", control.value);
        state.status = "Control changed";
        updateScene();
        updatePanel();
      });
      control.addEventListener("change", () => {
        markControl(control.id || "control", control.value);
        updateScene();
        updatePanel();
      });
    });
    const toggleMode = document.getElementById("toggleMode");
    if (toggleMode) toggleMode.addEventListener("click", () => {
      const next = state.mode === "hypergraph" ? "directed" : "hypergraph";
      setMode(next);
      state.status = next === "hypergraph" ? "Hypergraph group stalk" : "Directed role edge";
      updateScene();
      updatePanel();
    });
    const flowStep = document.getElementById("flowStep");
    if (flowStep) flowStep.addEventListener("click", () => {
      state.stepCount += 1;
      state.status = "Gather-correct-broadcast step";
      markControl("flowStep");
      updateScene();
      updatePanel();
    });
    const flipDirection = document.getElementById("flipDirection");
    if (flipDirection) flipDirection.addEventListener("click", () => {
      setMode("directed");
      state.flipped = !state.flipped;
      state.status = "Direction reversed";
      markControl("flipDirection");
      updateScene();
      updatePanel();
    });
    const balance = document.getElementById("balance");
    if (balance) balance.addEventListener("click", () => {
      state.projectionCount += 1;
      state.status = "Projection balanced";
      markControl("balance");
      updateScene();
      updatePanel();
    });
    const showClique = document.getElementById("showClique");
    if (showClique) showClique.addEventListener("click", () => {
      setMode("clique");
      state.status = "Clique expansion shown";
      updateScene();
      updatePanel();
    });
    const reset = document.getElementById("resetH13");
    if (reset) reset.addEventListener("click", () => {
      setRange("stepSize", 0.46);
      setRange("roleAsymmetry", 0.58);
      setRange("hyperedgeSize", 4);
      setRange("tolerance", 0.18);
      setRange("normalization", 0.62);
      state.status = "Ready";
      state.mode = "directed";
      state.stepCount = 0;
      state.flipped = false;
      state.projectionCount = 0;
      setMode("directed");
      updateScene();
      updatePanel();
    });

    window.__h13LabSnapshot = () => {
      const s = stats();
      return {
        kind: "directed-hypergraph-sheaf-incidence",
        labId: "h13",
        visualKind: "incidence-gather-correct-broadcast",
        sceneObject: "directed-source-target-edge-stalk-hyperedge-group-stalk-clique-shadow",
        mode: state.mode,
        status: state.status,
        nodeStalkCount: nodeStalks.length,
        directedEdgeStalkCount: directedEdgeStalks.length,
        hyperedgeStalkCount: 1,
        incidenceMapCount: incidenceMaps.length,
        groupIncidenceCount: incidenceMaps.length,
        cliqueExpansionEdgeCount: state.mode === "clique" ? cliqueLines.length : 6,
        gatherProjectionCount: state.mode === "hypergraph" ? gatherDots.length : 3,
        groupStalkVisible: state.mode !== "clique",
        nodeStalkObjectCount: nodeStalks.length,
        nodeValueBarObjectCount: nodeStalks.length,
        directedEdgeStalkObjectCount: directedEdgeStalks.length,
        hyperedgeGroupStalkObjectCount: 1,
        incidenceMapObjectCount: incidenceMaps.length,
        projectedParticipantObjectCount: gatherDots.length,
        residualRodObjectCount: residualRods.length,
        cliqueShadowObjectCount: cliqueLines.length,
        broadcastCorrectionObjectCount: correctionLines.length,
        tailHeadAggregateObjectCount: 2,
        compatibleCount: s.compatibleCount,
        energy: s.energy,
        asymmetry: s.asymmetry,
        projectionDefect: s.projectionDefect,
        projectionCount: state.projectionCount,
        stepCount: state.stepCount,
        flipped: state.flipped,
        hyperedgeCoherence: 1 / (1 + s.energy),
        cliqueInformationLoss: state.mode === "clique" ? cliqueLines.length / Math.max(1, incidenceMaps.length) : 0,
        has3d: true,
        clarityVersion: "h13-h14-canonical-clarity-v1",
        nodeStalkHash: objectHash(nodeStalks.map((node) => node.stalk)),
        nodeValueBarHash: objectHash(nodeStalks.map((node) => node.bar)),
        directedEdgeStalkHash: objectHash(directedEdgeStalks),
        hyperedgeGroupStalkHash: objectHash([hyperedgeStalk]),
        incidenceMapHash: lineHash(incidenceMaps),
        projectionDotHash: objectHash(gatherDots),
        residualRodHash: objectHash(residualRods),
        cliqueShadowHash: lineHash(cliqueLines),
        correctionHash: lineHash(correctionLines),
        tailHeadHash: objectHash([tailAggregate, headAggregate]),
        canonicalReferences: ["directed source role map", "directed target role map", "edge stalk residual", "hyperedge group stalk", "gather correct broadcast", "tail-head hyperedge", "clique expansion shadow"],
        directedHypergraphObjects: ["source_role_map", "target_role_map", "directed_edge_stalk", "hyperedge_group_stalk", "gather_project_broadcast", "tail_head_hyperedge", "clique_expansion_failure"],
        diagnosticMetrics: ["role_asymmetry", "projected_residual_energy", "projection_defect", "compatible_count", "hyperedge_coherence", "clique_information_loss"],
        stateText: stateText ? stateText.textContent.trim() : "",
        cameraTheta: cameraState.theta,
        cameraPhi: cameraState.phi,
        cameraRadius: cameraState.radius,
        revision: state.revision,
        lastControl: state.lastControl,
        controls: Object.assign({}, state.controls)
      };
    };
    window.__h13LabReady = true;
    updateScene();
    updatePanel();
    function animate() {
      requestAnimationFrame(animate);
      const t = performance.now() * 0.001;
      hyperedgeStalk.rotation.y = t * 0.14;
      renderer.render(scene, camera);
    }
    animate();
  }

  function createH14PersistentSheafConcreteLab() {
    const root = document.querySelector('[data-lab-id="h14"]');
    const canvas = document.getElementById("canvas");
    if (!root || !canvas) return;
    const { renderer, scene, camera, cameraState, grid } = setupScene(canvas, 10.4);
    const selected = root.querySelector('[data-role="selected"] strong');
    const insight = root.querySelector('[data-role="insight"]');
    const stateText = document.getElementById("stateBox");
    const formulaText = document.getElementById("formulaText");
    const state = { status: "Ready", view: "filtration", projectionCount: 0, holonomyPulse: false, revision: 0, lastControl: "initial", controls: {} };
    const points = [
      new THREE.Vector3(-1.95, 0, 1.25),
      new THREE.Vector3(-0.55, 0, 1.85),
      new THREE.Vector3(0.95, 0, 1.55),
      new THREE.Vector3(1.95, 0, 0.34),
      new THREE.Vector3(1.35, 0, -1.22),
      new THREE.Vector3(-0.15, 0, -1.7),
      new THREE.Vector3(-1.68, 0, -0.95),
      new THREE.Vector3(-2.22, 0, 0.25)
    ];
    const edges = [
      [0, 1, 0.34], [1, 2, 0.46], [2, 3, 0.58], [3, 4, 0.66],
      [4, 5, 0.74], [5, 6, 0.82], [6, 7, 0.9], [7, 0, 0.98],
      [0, 2, 1.08], [2, 4, 1.18], [4, 6, 1.28], [6, 0, 1.38]
    ];
    const faces = [
      [0, 1, 2, 1.1],
      [2, 3, 4, 1.22],
      [4, 5, 6, 1.34],
      [6, 7, 0, 1.46]
    ];
    const pointDots = points.map((position, index) => {
      const dot = makeSphere(0.13, COLORS.blue, 0.92);
      dot.position.copy(position);
      scene.add(dot);
      const ball = makeSphere(0.18, COLORS.cyan, 0.08);
      ball.position.copy(position);
      scene.add(ball);
      const stalk = makeBox([0.1, 0.42, 0.1], index % 2 ? COLORS.green : COLORS.amber, 0.42);
      stalk.position.copy(position).add(new THREE.Vector3(0, 0.46, 0));
      scene.add(stalk);
      return { dot, ball, stalk };
    });
    const edgeLines = edges.map(() => {
      const line = makeLine([], COLORS.cyan, 0.32);
      scene.add(line);
      return line;
    });
    const restrictionLines = edges.map(() => {
      const line = makeLine([], COLORS.green, 0.2);
      scene.add(line);
      return line;
    });
    const defectHeat = edges.map(() => {
      const rod = makeBox([0.08, 0.22, 0.08], COLORS.rose, 0.38);
      scene.add(rod);
      return rod;
    });
    const faceMeshes = faces.map(([a, b, c]) => {
      const geom = new THREE.BufferGeometry().setFromPoints([points[a], points[b], points[c]]);
      geom.setIndex([0, 1, 2]);
      geom.computeVertexNormals();
      const mesh = new THREE.Mesh(geom, material(COLORS.cyan, 0.16));
      scene.add(mesh);
      return mesh;
    });
    const ordinaryBars = Array.from({ length: 4 }, (_, index) => {
      const bar = makeBox([0.52, 0.08, 0.08], index === 2 ? COLORS.amber : COLORS.blue, 0.42);
      bar.position.set(-1.8 + index * 0.54, -0.78, 2.12);
      scene.add(bar);
      return bar;
    });
    const sheafBars = Array.from({ length: 4 }, (_, index) => {
      const bar = makeBox([0.52, 0.08, 0.08], index === 2 ? COLORS.rose : COLORS.green, 0.42);
      bar.position.set(0.6 + index * 0.54, -0.78, 2.12);
      scene.add(bar);
      return bar;
    });
    const radiusCursor = makeBox([0.08, 0.46, 0.08], COLORS.ink, 0.6);
    radiusCursor.position.set(-2.15, -0.76, 2.12);
    scene.add(radiusCursor);
    const holonomyRing = makeSphere(0.68, COLORS.green, 0.12);
    holonomyRing.scale.set(1.4, 0.08, 1.4);
    holonomyRing.position.set(0, 0.16, 0.08);
    scene.add(holonomyRing);
    grid(3.1, 2.4, -0.95);

    function markControl(id, value) {
      state.revision += 1;
      state.lastControl = id;
      state.controls[id] = value == null ? "clicked" : String(value);
      if (id === "view" && value) state.view = value;
    }

    function stats() {
      const scenario = selectValue("scenario", "sensor-loop");
      const restriction = selectValue("restriction", "identity");
      const view = selectValue("view", state.view || "filtration");
      const radius = rangeValue("radius", 0.72);
      const defectBias = rangeValue("defectBias", 0.18);
      const signalNoise = rangeValue("signalNoise", 0.16);
      const barThreshold = rangeValue("barThreshold", 0.52);
      const faceFill = rangeValue("faceFill", 0.56);
      const activeEdgeCount = edges.filter((edge) => edge[2] <= radius).length;
      const activeFaceCount = faces.filter((face) => face[3] <= radius + faceFill * 0.45).length;
      const beta0 = Math.max(1, points.length - Math.min(activeEdgeCount, points.length - 1));
      const beta1 = activeEdgeCount >= 8 && activeFaceCount < 2 ? 1 : activeEdgeCount >= 10 && activeFaceCount < 4 ? 1 : 0;
      const restrictionPenalty = restriction === "holonomy" ? 0.42 : restriction === "sign" ? 0.24 : restriction === "scale" ? 0.16 : restriction === "bias" ? 0.2 : 0.04;
      const scenarioPenalty = scenario === "biased" ? 0.2 : scenario === "flip" ? 0.28 : scenario === "annulus" ? 0.14 : 0;
      const projectionRelief = state.projectionCount > 0 ? 0.34 : 0;
      const holonomyPulse = state.holonomyPulse ? 0.28 : 0;
      const totalDefect = clamp(activeEdgeCount * 0.04 + defectBias + signalNoise * 0.5 + restrictionPenalty + scenarioPenalty + holonomyPulse - projectionRelief, 0.02, 2.2);
      const holonomyDefect = clamp((beta1 ? 0.24 : 0.05) + restrictionPenalty + holonomyPulse + signalNoise * 0.12 - projectionRelief * 0.3, 0, 1.3);
      const sheafH0Dimension = Math.max(0, beta0 - (totalDefect > barThreshold ? 1 : 0));
      return { scenario, restriction, view, radius, defectBias, signalNoise, barThreshold, faceFill, activeEdgeCount, activeFaceCount, beta0, beta1, totalDefect, holonomyDefect, sheafH0Dimension };
    }

    function updateScene() {
      const s = stats();
      state.view = s.view;
      pointDots.forEach((item, index) => {
        item.ball.scale.setScalar(0.65 + s.radius * 1.35);
        item.ball.material.opacity = s.view === "filtration" ? 0.11 : 0.04;
        item.stalk.scale.y = 0.55 + Math.abs(Math.sin(index * 1.7 + s.signalNoise * 3)) * 0.9;
        item.stalk.material.opacity = s.view === "barcode" ? 0.16 : 0.58;
      });
      edges.forEach(([a, b, birth], index) => {
        const active = birth <= s.radius;
        const edgeMid = points[a].clone().lerp(points[b], 0.5).add(new THREE.Vector3(0, active ? 0.02 + s.radius * 0.04 : 0, 0));
        setTrackedLine(edgeLines[index], [points[a], edgeMid, points[b]]);
        edgeLines[index].material.opacity = active ? 0.62 : 0.12;
        edgeLines[index].material.color.setHex(active ? COLORS.cyan : COLORS.amber);
        const mid = points[a].clone().lerp(points[b], 0.5).add(new THREE.Vector3(0, 0.22, 0));
        const restrictionWarp = (s.restriction === "identity" ? 0 : s.holonomyDefect * 0.14) - state.projectionCount * 0.035;
        setTrackedLine(restrictionLines[index], [points[a].clone().add(new THREE.Vector3(0, 0.38, 0)), mid.clone().add(new THREE.Vector3(0, restrictionWarp, (index % 2 ? -1 : 1) * restrictionWarp)), points[b].clone().add(new THREE.Vector3(0, 0.38, 0))]);
        restrictionLines[index].material.opacity = active && s.view !== "barcode" ? 0.34 : 0.06;
        defectHeat[index].position.copy(mid).add(new THREE.Vector3(0, 0.1 + s.totalDefect * 0.04, 0));
        defectHeat[index].scale.y = active ? 0.45 + s.totalDefect * 0.48 : 0.08;
        defectHeat[index].material.opacity = active && s.view === "defect" ? 0.68 : active ? 0.22 : 0.04;
      });
      faces.forEach((face, index) => {
        const active = face[3] <= s.radius + s.faceFill * 0.45;
        faceMeshes[index].material.opacity = active ? 0.22 : 0.03;
      });
      ordinaryBars.forEach((bar, index) => {
        bar.scale.x = 0.6 + (index === 2 ? Math.max(0.25, 1.4 - s.activeFaceCount * 0.28) : 1);
        bar.position.x = -1.8 + index * 0.54 + (s.view === "barcode" ? 0.04 * s.beta1 : 0);
        bar.material.opacity = s.view === "barcode" ? 0.72 : 0.28;
      });
      sheafBars.forEach((bar, index) => {
        bar.scale.x = 0.58 + (index === 2 ? 0.5 + s.holonomyDefect : 0.8 - Math.min(0.4, s.totalDefect * 0.1));
        bar.position.y = -0.78 + (state.projectionCount > 0 ? -0.04 : 0) + (state.holonomyPulse ? 0.04 * (index % 2) : 0);
        bar.material.opacity = s.view === "barcode" ? 0.72 : 0.3;
      });
      radiusCursor.position.x = -2.15 + s.radius * 2.35;
      holonomyRing.material.opacity = s.holonomyDefect > 0.32 || state.holonomyPulse ? 0.32 : 0.11;
      holonomyRing.material.color.setHex(s.holonomyDefect > 0.32 ? COLORS.rose : COLORS.green);
      holonomyRing.scale.set(1.3 + s.holonomyDefect * 0.45, 0.08, 1.3 + s.holonomyDefect * 0.45);
    }

    function updatePanel() {
      const s = stats();
      const cellsLabel = document.getElementById("cellsLabel");
      const bettiLabel = document.getElementById("bettiLabel");
      const defectLabel = document.getElementById("defectLabel");
      const sheafLabel = document.getElementById("sheafLabel");
      setMetric(root, "Persistent defect", s.totalDefect, 2);
      setMetric(root, "Cycle strength", s.beta1 + s.holonomyDefect, 2);
      setMetric(root, "Cell coverage", s.activeEdgeCount + s.activeFaceCount, 0);
      setMetric(root, "Sheaf barcode gap", s.holonomyDefect, 2);
      if (cellsLabel) cellsLabel.textContent = `${s.activeEdgeCount} edges / ${s.activeFaceCount} faces`;
      if (bettiLabel) bettiLabel.textContent = `b0=${s.beta0} b1=${s.beta1}`;
      if (defectLabel) defectLabel.textContent = fmt(s.totalDefect, 2);
      if (sheafLabel) sheafLabel.textContent = `dim H0(F)=${s.sheafH0Dimension}`;
      syncOutput("radius", s.radius, 2);
      syncOutput("defectBias", s.defectBias, 2);
      syncOutput("signalNoise", s.signalNoise, 2);
      syncOutput("barThreshold", s.barThreshold, 2);
      syncOutput("faceFill", s.faceFill, 2);
      if (selected) selected.textContent = s.view === "barcode" ? "ordinary barcode and sheaf barcode" : s.view === "defect" ? "edge defect heat" : "point cloud filtration";
      if (formulaText) formulaText.textContent = s.view === "barcode" ? "H^k(K_r; F|K_r)" : "delta0 x = F_v<=e x_v - F_u<=e x_u";
      if (insight) insight.textContent = "Ordinary persistence tracks when shape appears; the sheaf layer tracks whether local data glues across that shape.";
      if (!stateText) return;
      if (state.status === "Holonomy obstruction") {
        stateText.textContent = `${state.status}: the loop transports stalk values around the cycle and returns with an obstruction, so ordinary b1 and sheaf compatibility disagree.`;
      } else if (state.view === "barcode") {
        stateText.textContent = `${state.status}: the ordinary barcode and sheaf barcode share the radius cursor, but the sheaf barcode records compatible sections and persistent obstruction.`;
      } else if (state.projectionCount > 0) {
        stateText.textContent = `${state.status}: projecting toward a global section lowers ||delta0 x||2 and makes local compatibility visible on the active edges.`;
      } else {
        stateText.textContent = `${state.status}: a point cloud filtration grows radius balls, edges, faces, stalk bars, restriction maps, ordinary barcode events, and sheaf defect heat.`;
      }
    }

    root.querySelectorAll("input[type='range'], select").forEach((control) => {
      control.addEventListener("input", () => {
        markControl(control.id || "control", control.value);
        state.status = "Control changed";
        updateScene();
        updatePanel();
      });
      control.addEventListener("change", () => {
        markControl(control.id || "control", control.value);
        updateScene();
        updatePanel();
      });
    });
    const grow = document.getElementById("growFiltration");
    if (grow) grow.addEventListener("click", () => {
      setRange("radius", Math.min(1.55, rangeValue("radius", 0.72) + 0.42));
      state.status = "Filtration radius advanced";
      state.view = "filtration";
      const view = document.getElementById("view");
      if (view) view.value = "filtration";
      markControl("growFiltration");
      updateScene();
      updatePanel();
    });
    const project = document.getElementById("projectSection");
    if (project) project.addEventListener("click", () => {
      state.projectionCount += 1;
      state.status = "Projected global section";
      markControl("projectSection");
      updateScene();
      updatePanel();
    });
    const barcode = document.getElementById("toggleBarcode");
    if (barcode) barcode.addEventListener("click", () => {
      state.view = "barcode";
      const view = document.getElementById("view");
      if (view) view.value = "barcode";
      state.status = "Barcode view";
      markControl("toggleBarcode");
      updateScene();
      updatePanel();
    });
    const holonomy = document.getElementById("showHolonomy");
    if (holonomy) holonomy.addEventListener("click", () => {
      state.holonomyPulse = true;
      state.status = "Holonomy obstruction";
      markControl("showHolonomy");
      updateScene();
      updatePanel();
    });
    const reset = document.getElementById("resetH14");
    if (reset) reset.addEventListener("click", () => {
      setRange("radius", 0.72);
      setRange("defectBias", 0.18);
      setRange("signalNoise", 0.16);
      setRange("barThreshold", 0.52);
      setRange("faceFill", 0.56);
      const scenario = document.getElementById("scenario");
      const restriction = document.getElementById("restriction");
      const view = document.getElementById("view");
      if (scenario) scenario.value = "sensor-loop";
      if (restriction) restriction.value = "identity";
      if (view) view.value = "filtration";
      state.status = "Ready";
      state.view = "filtration";
      state.projectionCount = 0;
      state.holonomyPulse = false;
      updateScene();
      updatePanel();
    });

    window.__h14LabSnapshot = () => {
      const s = stats();
      return {
        kind: "persistent-sheaf-filtration",
        labId: "h14",
        visualKind: "vietoris-rips-sheaf-barcode",
        sceneObject: "vietoris-rips-radius-balls-stalk-restrictions-ordinary-vs-sheaf-barcode-holonomy-defect",
        scenario: s.scenario,
        restriction: s.restriction,
        view: state.view,
        status: state.status,
        pointCount: points.length,
        stalkColumnCount: pointDots.length,
        restrictionMapCount: restrictionLines.length,
        ordinaryBarcodeCount: ordinaryBars.length,
        sheafBarcodeCount: sheafBars.length,
        defectHeatCount: defectHeat.length,
        pointCloudObjectCount: pointDots.length,
        radiusBallObjectCount: pointDots.length,
        vertexStalkObjectCount: pointDots.length,
        filtrationEdgeObjectCount: edgeLines.length,
        restrictionMapObjectCount: restrictionLines.length,
        faceSimplexObjectCount: faceMeshes.length,
        defectHeatObjectCount: defectHeat.length,
        ordinaryBarcodeObjectCount: ordinaryBars.length,
        sheafBarcodeObjectCount: sheafBars.length,
        radiusCursorObjectCount: 1,
        holonomyObstructionObjectCount: 1,
        activeEdgeCount: s.activeEdgeCount,
        activeFaceCount: s.activeFaceCount,
        beta0: s.beta0,
        beta1: s.beta1,
        totalDefect: s.totalDefect,
        holonomyDefect: s.holonomyDefect,
        sheafH0Dimension: s.sheafH0Dimension,
        projectionCount: state.projectionCount,
        has3d: true,
        clarityVersion: "h13-h14-canonical-clarity-v1",
        pointCloudHash: objectHash(pointDots.map((item) => item.dot)),
        radiusBallHash: objectHash(pointDots.map((item) => item.ball)),
        vertexStalkHash: objectHash(pointDots.map((item) => item.stalk)),
        filtrationEdgeHash: lineHash(edgeLines),
        restrictionMapHash: lineHash(restrictionLines),
        faceSimplexHash: objectHash(faceMeshes),
        defectHeatHash: objectHash(defectHeat),
        ordinaryBarcodeHash: objectHash(ordinaryBars),
        sheafBarcodeHash: objectHash(sheafBars),
        radiusCursorHash: objectHash([radiusCursor]),
        holonomyObstructionHash: objectHash([holonomyRing]),
        canonicalReferences: ["Vietoris-Rips filtration", "radius ball cover", "cell birth edge", "filled triangle death", "vertex stalk signal", "sheaf coboundary defect", "ordinary barcode", "sheaf barcode", "holonomy obstruction"],
        persistentSheafObjects: ["vietoris_rips_filtration", "radius_balls", "active_edges", "filled_triangles", "vertex_stalk_signal", "restriction_map", "ordinary_barcode", "sheaf_barcode", "holonomy_obstruction"],
        diagnosticMetrics: ["beta0", "beta1", "sheaf_h0_dimension", "total_defect", "holonomy_defect", "active_edge_count"],
        stateText: stateText ? stateText.textContent.trim() : "",
        cameraTheta: cameraState.theta,
        cameraPhi: cameraState.phi,
        cameraRadius: cameraState.radius,
        revision: state.revision,
        lastControl: state.lastControl,
        controls: Object.assign({}, state.controls)
      };
    };
    window.__h14LabReady = true;
    updateScene();
    updatePanel();
    function animate() {
      requestAnimationFrame(animate);
      holonomyRing.rotation.y += 0.004;
      renderer.render(scene, camera);
    }
    animate();
  }

  function createH15ResearchFrontierConcreteLab() {
    const root = document.querySelector('[data-lab-id="h15"]');
    const canvas = document.getElementById("canvas");
    if (!root || !canvas) return;
    const { renderer, scene, camera, cameraState, grid } = setupScene(canvas, 11.1);
    const selected = root.querySelector('[data-role="selected"] strong');
    const insight = root.querySelector('[data-role="insight"]');
    const stateText = document.getElementById("stateBox");
    const formulaText = document.getElementById("formulaText");
    const frontiers = ["dynamic", "structure", "constraints", "hypergraph", "scale", "quantum", "evaluation"];
    const state = { status: "Ready", frontierIndex: 0, stressCount: 0, constraintApplications: 0, ablated: false, revision: 0, lastControl: "initial", controls: {} };
    const stationX = [-3.3, -2.18, -1.05, 0.12, 1.25, 2.35, 3.32];
    const stations = frontiers.map((frontier, index) => {
      const block = makeBox([0.62, 0.38, 0.5], [COLORS.blue, COLORS.cyan, COLORS.green, COLORS.amber, COLORS.violet, COLORS.rose, COLORS.ink][index], 0.28);
      block.position.set(stationX[index], 0, 0.1 + (index % 2) * 0.18);
      scene.add(block);
      const pipe = index < frontiers.length - 1 ? makeLine([new THREE.Vector3(stationX[index] + 0.33, 0.08, 0.1), new THREE.Vector3(stationX[index + 1] - 0.33, 0.08, 0.1)], COLORS.cyan, 0.22) : null;
      if (pipe) scene.add(pipe);
      return { block, pipe, frontier };
    });
    const eventStreamLines = Array.from({ length: 7 }, (_, index) => {
      const line = makeLine([], COLORS.blue, 0.16);
      scene.add(line);
      return line;
    });
    const mapRack = Array.from({ length: 6 }, (_, index) => {
      const tool = makeBox([0.18, 0.54, 0.16], [COLORS.blue, COLORS.green, COLORS.amber, COLORS.cyan, COLORS.rose, COLORS.violet][index], 0.42);
      tool.position.set(-1.1 + index * 0.18, 0.62, -1.35);
      scene.add(tool);
      return tool;
    });
    const benchmarkPanels = Array.from({ length: 3 }, (_, index) => {
      const panel = makeBox([0.52, 0.22, 0.12], [COLORS.green, COLORS.amber, COLORS.rose][index], 0.3);
      panel.position.set(2.55 + index * 0.28, 0.66, -1.15);
      scene.add(panel);
      return panel;
    });
    const ablationLanes = Array.from({ length: 2 }, (_, index) => {
      const lane = makeBox([2.2, 0.08, 0.12], index ? COLORS.green : COLORS.rose, 0.32);
      lane.position.set(0.8, -0.58 - index * 0.18, 1.5);
      scene.add(lane);
      return lane;
    });
    const costMeters = Array.from({ length: 3 }, (_, index) => {
      const meter = makeBox([0.16, 0.5, 0.16], [COLORS.blue, COLORS.amber, COLORS.rose][index], 0.42);
      meter.position.set(2.25 + index * 0.28, 0.18, 1.4);
      scene.add(meter);
      return meter;
    });
    const topologyRails = Array.from({ length: 7 }, (_, index) => {
      const rail = makeLine([new THREE.Vector3(-2.55 + index * 0.2, 0.36, 0.75), new THREE.Vector3(-1.9 + index * 0.18, 0.36, 1.12)], COLORS.amber, 0.2);
      scene.add(rail);
      return rail;
    });
    const gaugeRing = makeSphere(0.34, COLORS.green, 0.16);
    gaugeRing.scale.set(1.3, 0.08, 1.3);
    gaugeRing.position.set(0.12, 0.7, -0.9);
    scene.add(gaugeRing);
    const unitaryPrism = makeBox([0.42, 0.42, 0.42], COLORS.violet, 0.24);
    unitaryPrism.position.set(2.95, 0.65, 0.8);
    scene.add(unitaryPrism);
    grid(3.8, 2.2, -0.95);

    function markControl(id, value) {
      state.revision += 1;
      state.lastControl = id;
      state.controls[id] = value == null ? "clicked" : String(value);
      if (id === "frontier" && value) state.frontierIndex = Math.max(0, frontiers.indexOf(value));
    }

    function stats() {
      const frontier = selectValue("frontier", frontiers[state.frontierIndex] || "dynamic");
      const mapFamily = selectValue("mapFamily", "diagonal");
      const benchmark = selectValue("benchmark", "signed");
      const timeDrift = rangeValue("timeDrift", 0.26);
      const topologyFreedom = rangeValue("topologyFreedom", 0.42);
      const constraintStrength = rangeValue("constraintStrength", 0.58);
      const scale = rangeValue("scale", 42);
      const supervision = rangeValue("supervision", 0.62);
      const noise = rangeValue("noise", 0.18);
      const familyCost = mapFamily === "dense" ? 1.0 : mapFamily === "low-rank" ? 0.55 : mapFamily === "orthogonal" ? 0.42 : mapFamily === "unitary" ? 0.62 : 0.24;
      const cost = clamp(0.18 + scale / 100 * (0.75 + familyCost) + (state.stressCount > 0 ? 0.22 : 0), 0, 2.2);
      let expressivity = clamp(0.42 + familyCost * 0.38 + topologyFreedom * 0.24 + supervision * 0.16 - noise * 0.12, 0.05, 1.35);
      const stability = clamp(0.32 + constraintStrength * 0.45 + supervision * 0.18 - topologyFreedom * 0.16 - timeDrift * 0.18 - (mapFamily === "dense" ? 0.2 : 0) + state.constraintApplications * 0.08, 0.03, 1.25);
      if (state.ablated) expressivity *= 0.62;
      const topologyEntropy = clamp(0.18 + topologyFreedom * 0.75 + noise * 0.24, 0, 1.3);
      const gaugeDrift = clamp(0.38 + timeDrift * 0.3 - constraintStrength * 0.28 + (mapFamily === "orthogonal" || mapFamily === "unitary" ? -0.16 : 0.12), 0, 1.1);
      return { frontier, mapFamily, benchmark, timeDrift, topologyFreedom, constraintStrength, scale, supervision, noise, cost, expressivity, stability, topologyEntropy, gaugeDrift };
    }

    function setFrontier(value) {
      const select = document.getElementById("frontier");
      if (select) select.value = value;
      state.frontierIndex = Math.max(0, frontiers.indexOf(value));
      markControl("frontier", value);
    }

    function updateScene() {
      const s = stats();
      state.frontierIndex = Math.max(0, frontiers.indexOf(s.frontier));
      stations.forEach((station, index) => {
        const active = index === state.frontierIndex;
        station.block.scale.set(active ? 1.25 : 0.86, active ? 1.25 : 0.86, active ? 1.25 : 0.86);
        station.block.material.opacity = active ? 0.62 : 0.2;
        if (station.pipe) station.pipe.material.opacity = index <= state.frontierIndex ? 0.5 : 0.12;
      });
      eventStreamLines.forEach((line, index) => {
        const x = -3.62 + index * 0.11;
        const drift = s.timeDrift * (0.18 + index * 0.018);
        const start = new THREE.Vector3(x, 0.42 + Math.sin(index) * 0.05, -1.28);
        const mid = new THREE.Vector3(x + 0.28 + drift, 0.48 + s.timeDrift * 0.18, -0.82 + index * 0.05);
        const end = new THREE.Vector3(-3.3 + s.timeDrift * 0.18, 0.26 + index * 0.018, 0.1);
        setTrackedLine(line, [start, mid, end]);
        line.material.opacity = s.frontier === "dynamic" ? 0.24 + s.timeDrift * 0.44 : 0.08;
        line.material.color.setHex(index / eventStreamLines.length < s.supervision ? COLORS.blue : COLORS.muted);
      });
      mapRack.forEach((tool, index) => {
        const active = ["signed", "diagonal", "low-rank", "orthogonal", "dense", "unitary"][index] === s.mapFamily;
        tool.scale.y = active ? 1.35 + s.constraintStrength * 0.3 + state.constraintApplications * 0.08 : 0.8;
        tool.material.opacity = active ? 0.72 : 0.22;
        tool.rotation.y = active ? s.constraintStrength * 0.8 : 0.1 * index;
      });
      topologyRails.forEach((rail, index) => {
        const a = new THREE.Vector3(-2.55 + index * 0.2, 0.36 + s.topologyFreedom * 0.08, 0.75);
        const b = new THREE.Vector3(-1.9 + index * 0.18 + s.noise * 0.08, 0.36, 1.12 + s.topologyFreedom * 0.12);
        setTrackedLine(rail, [a, a.clone().lerp(b, 0.5).add(new THREE.Vector3(0, s.noise * 0.18, 0)), b]);
        rail.material.opacity = s.frontier === "structure" ? 0.22 + s.topologyFreedom * 0.42 : 0.08;
        rail.material.color.setHex(index / topologyRails.length < s.topologyFreedom ? COLORS.amber : COLORS.muted);
      });
      benchmarkPanels.forEach((panel, index) => {
        panel.scale.y = [s.expressivity, s.stability, Math.max(0.1, s.expressivity - (state.ablated ? 0.2 : 0))][index] * 1.2;
        panel.material.opacity = s.frontier === "evaluation" || state.ablated ? 0.68 : 0.28;
      });
      ablationLanes[0].scale.x = state.ablated ? 0.75 : 1.15;
      ablationLanes[1].scale.x = 0.78 + s.expressivity * 0.45;
      ablationLanes[0].material.opacity = state.ablated ? 0.72 : 0.28;
      ablationLanes[1].material.opacity = state.ablated ? 0.72 : 0.32;
      costMeters[0].scale.y = 0.45 + s.cost * 0.6;
      costMeters[1].scale.y = 0.45 + s.topologyEntropy * 0.6;
      costMeters[2].scale.y = 0.45 + s.gaugeDrift * 0.6;
      costMeters.forEach((meter) => { meter.material.opacity = state.stressCount > 0 || s.frontier === "scale" ? 0.72 : 0.34; });
      gaugeRing.material.opacity = s.mapFamily === "orthogonal" || s.frontier === "quantum" ? 0.42 : 0.14;
      gaugeRing.scale.set(1.3 + state.constraintApplications * 0.08 + s.gaugeDrift * 0.12, 0.08, 1.3 + state.constraintApplications * 0.08 + s.gaugeDrift * 0.12);
      gaugeRing.rotation.y += 0.02 + s.constraintStrength * 0.01;
      unitaryPrism.material.opacity = s.frontier === "quantum" || s.mapFamily === "unitary" ? 0.62 : 0.16;
      unitaryPrism.scale.setScalar(s.frontier === "quantum" || s.mapFamily === "unitary" ? 1.08 + s.constraintStrength * 0.18 : 0.88);
      unitaryPrism.rotation.y = s.timeDrift + s.constraintStrength;
    }

    function frontierCopy(frontier) {
      if (frontier === "dynamic") return "dynamic frontier: event stream maps R(t) drift through time, so causality and temporal validation matter before restriction generator updates.";
      if (frontier === "structure") return "topology discovery frontier: candidate topology rails appear while restriction maps can hide or expose bad edges.";
      if (frontier === "constraints") return "constraint frontier: signed, diagonal, low-rank, orthogonal, dense, and unitary tools trade expressivity, gauge stability, and cost.";
      if (frontier === "hypergraph") return "higher-order frontier: a group chamber replaces pairwise expansion so multimodal and hypergraph stalks stay modular.";
      if (frontier === "scale") return "systems frontier: memory crates and throughput meters show why dense per-edge maps become expensive.";
      if (frontier === "quantum") return "physical/quantum frontier: orthogonal and unitary maps preserve length, but quantum claims must report shot cost and classical baselines.";
      return "evaluation frontier: matched baseline and ablation lanes test whether sheaf geometry survives parameter matching and topology perturbations.";
    }

    function updatePanel() {
      const s = stats();
      const frontierLabel = document.getElementById("frontierLabel");
      const expressLabel = document.getElementById("expressLabel");
      const costLabel = document.getElementById("costLabel");
      const stabilityLabel = document.getElementById("stabilityLabel");
      setMetric(root, "Open-problem pressure", s.topologyEntropy + s.gaugeDrift, 2);
      setMetric(root, "Theory anchor", s.stability, 2);
      setMetric(root, "Direction coverage", state.frontierIndex + 1, 0);
      setMetric(root, "Systems risk", s.cost, 2);
      if (frontierLabel) frontierLabel.textContent = s.frontier === "structure" ? "topology discovery" : s.frontier;
      if (expressLabel) expressLabel.textContent = fmt(s.expressivity, 2);
      if (costLabel) costLabel.textContent = fmt(s.cost, 2);
      if (stabilityLabel) stabilityLabel.textContent = fmt(s.stability, 2);
      syncOutput("timeDrift", s.timeDrift, 2);
      syncOutput("topologyFreedom", s.topologyFreedom, 2);
      syncOutput("constraintStrength", s.constraintStrength, 2);
      syncOutput("scale", s.scale, 0);
      syncOutput("supervision", s.supervision, 2);
      syncOutput("noise", s.noise, 2);
      if (selected) selected.textContent = `${s.frontier} experiment station`;
      if (formulaText) formulaText.textContent = s.frontier === "scale" ? "cost: dense O(|E|d^2), low-rank O(|E|dr)" : "learn F, test geometry, ablate baseline";
      if (insight) insight.textContent = "The bench turns each research question into a visible module: data stream, topology forge, map rack, diffusion chamber, stress rig, and evaluation wall.";
      if (!stateText) return;
      if (s.frontier === "quantum") {
        stateText.textContent = `${state.status}: physical/quantum frontier uses orthogonal or unitary restrictions that preserve vector length, but a quantum claim must expose shot cost and classical baselines.`;
      } else if (state.ablated) {
        stateText.textContent = `${state.status}: matched baseline ablation disables sheaf maps, so expressivity drops and any claimed gain must survive parameter matching.`;
      } else if (state.status === "Constraint applied") {
        stateText.textContent = `${state.status}: ${s.mapFamily} constraints expose gauge stability and decide which transformations the restriction maps are allowed to perform.`;
      } else if (state.status === "Scale stress") {
        stateText.textContent = `${state.status}: increasing |E| and stalk dimension inflates map cost, memory bars, and throughput pressure.`;
      } else {
        stateText.textContent = `${state.status}: ${frontierCopy(s.frontier)} The baseline lane stays visible so frontier claims are not just accuracy without controls.`;
      }
    }

    root.querySelectorAll("input[type='range'], select").forEach((control) => {
      control.addEventListener("input", () => {
        markControl(control.id || "control", control.value);
        state.status = "Control changed";
        updateScene();
        updatePanel();
      });
      control.addEventListener("change", () => {
        markControl(control.id || "control", control.value);
        updateScene();
        updatePanel();
      });
    });
    const advance = document.getElementById("advanceFrontier");
    if (advance) advance.addEventListener("click", () => {
      setFrontier(frontiers[(state.frontierIndex + 1) % frontiers.length]);
      state.status = "Frontier advanced";
      updateScene();
      updatePanel();
    });
    const constrain = document.getElementById("applyConstraint");
    if (constrain) constrain.addEventListener("click", () => {
      state.constraintApplications += 1;
      state.status = "Constraint applied";
      markControl("applyConstraint");
      updateScene();
      updatePanel();
    });
    const stress = document.getElementById("stressScale");
    if (stress) stress.addEventListener("click", () => {
      state.stressCount += 1;
      setFrontier("scale");
      state.status = "Scale stress";
      updateScene();
      updatePanel();
    });
    const ablate = document.getElementById("runAblation");
    if (ablate) ablate.addEventListener("click", () => {
      state.ablated = true;
      setFrontier("evaluation");
      state.status = "Baseline ablation";
      updateScene();
      updatePanel();
    });
    const reset = document.getElementById("resetH15");
    if (reset) reset.addEventListener("click", () => {
      setRange("timeDrift", 0.26);
      setRange("topologyFreedom", 0.42);
      setRange("constraintStrength", 0.58);
      setRange("scale", 42);
      setRange("supervision", 0.62);
      setRange("noise", 0.18);
      const frontier = document.getElementById("frontier");
      const mapFamily = document.getElementById("mapFamily");
      const benchmark = document.getElementById("benchmark");
      if (frontier) frontier.value = "dynamic";
      if (mapFamily) mapFamily.value = "diagonal";
      if (benchmark) benchmark.value = "signed";
      state.status = "Ready";
      state.frontierIndex = 0;
      state.stressCount = 0;
      state.constraintApplications = 0;
      state.ablated = false;
      updateScene();
      updatePanel();
    });

    window.__h15LabSnapshot = () => {
      const s = stats();
      return {
        kind: "sheaf-research-frontier-bench",
        labId: "h15",
        visualKind: "experiment-pipeline-benchmark",
        sceneObject: "research-frontier-bench-event-stream-topology-forge-map-rack-scale-stress-ablation-quantum-station",
        frontier: s.frontier,
        mapFamily: s.mapFamily,
        benchmark: s.benchmark,
        status: state.status,
        moduleCount: stations.length,
        pipelineStageCount: stations.length,
        constraintFamilyCount: mapRack.length,
        benchmarkPanelCount: benchmarkPanels.length,
        ablationLaneCount: ablationLanes.length,
        costMeterCount: costMeters.length,
        frontierStationObjectCount: stations.length,
        pipelinePipeObjectCount: stations.filter((station) => station.pipe).length,
        dynamicEventStreamObjectCount: eventStreamLines.length,
        topologyForgeObjectCount: topologyRails.length,
        constraintRackObjectCount: mapRack.length,
        evaluationWallObjectCount: benchmarkPanels.length,
        baselineAblationLaneObjectCount: ablationLanes.length,
        scaleStressMeterObjectCount: costMeters.length,
        quantumUnitaryObjectCount: 2,
        memoryBarHeight: costMeters[0].scale.y,
        stressCount: state.stressCount,
        constraintApplications: state.constraintApplications,
        ablated: state.ablated,
        metric: {
          expressivity: s.expressivity,
          stability: s.stability,
          cost: s.cost,
          topologyEntropy: s.topologyEntropy,
          gaugeDrift: s.gaugeDrift
        },
        baselineDrop: state.ablated ? s.expressivity * 0.38 : 0,
        shotCost: s.frontier === "quantum" || s.mapFamily === "unitary" ? 0.35 + s.scale / 120 + s.noise * 0.24 : 0,
        has3d: true,
        clarityVersion: "h15-i01-canonical-clarity-v1",
        frontierStationHash: objectHash(stations.map((station) => station.block)),
        pipelinePipeHash: lineHash(stations.map((station) => station.pipe).filter(Boolean)),
        dynamicEventStreamHash: lineHash(eventStreamLines),
        topologyForgeHash: lineHash(topologyRails),
        constraintRackHash: objectHash(mapRack),
        evaluationWallHash: objectHash(benchmarkPanels),
        baselineAblationHash: objectHash(ablationLanes),
        scaleStressHash: objectHash(costMeters),
        quantumGaugeHash: objectHash([gaugeRing, unitaryPrism]),
        canonicalReferences: ["dynamic temporal sheaf", "learned topology", "constrained restriction family", "higher-order multimodal sheaf", "dense versus low-rank edge cost", "matched baseline ablation", "unitary quantum restriction"],
        researchFrontierObjects: ["dynamic_event_stream", "topology_forge", "restriction_map_rack", "constraint_family_selector", "scale_cost_meter", "baseline_ablation_lane", "quantum_unitary_station", "evaluation_wall"],
        diagnosticMetrics: ["expressivity", "stability", "map_cost", "topology_entropy", "gauge_drift", "baseline_drop", "shot_cost"],
        stateText: stateText ? stateText.textContent.trim() : "",
        cameraTheta: cameraState.theta,
        cameraPhi: cameraState.phi,
        cameraRadius: cameraState.radius,
        revision: state.revision,
        lastControl: state.lastControl,
        controls: Object.assign({}, state.controls)
      };
    };
    window.__h15LabReady = true;
    updateScene();
    updatePanel();
    function animate() {
      requestAnimationFrame(animate);
      gaugeRing.rotation.y += 0.006;
      renderer.render(scene, camera);
    }
    animate();
  }

  window.createH06SheafDiffusionConcreteLab = createH06SheafDiffusionConcreteLab;
  window.createH07SheafNeuralNetworkConcreteLab = createH07SheafNeuralNetworkConcreteLab;
  window.createH08NeuralSheafDiffusionConcreteLab = createH08NeuralSheafDiffusionConcreteLab;
  window.createH09ConnectionLaplacianConcreteLab = createH09ConnectionLaplacianConcreteLab;
  window.createH10HeterophilyConcreteLab = createH10HeterophilyConcreteLab;
  window.createH11GaugeTheoryConcreteLab = createH11GaugeTheoryConcreteLab;
  window.createH12ApplicationsConcreteLab = createH12ApplicationsConcreteLab;
  window.createH13DirectedHypergraphConcreteLab = createH13DirectedHypergraphConcreteLab;
  window.createH14PersistentSheafConcreteLab = createH14PersistentSheafConcreteLab;
  window.createH15ResearchFrontierConcreteLab = createH15ResearchFrontierConcreteLab;
})();
