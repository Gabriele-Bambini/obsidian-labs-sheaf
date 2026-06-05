const path = require("path");

function loadPlaywright() {
  const candidates = [
    "playwright",
    "C:/Users/02gab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright",
    "C:/Users/02gab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
    "C:/Users/Gabriele/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright",
    "C:/Users/Gabriele/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"
  ];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (error) {
      // Try the next bundled/runtime location.
    }
  }
  throw new Error(`Unable to load Playwright from: ${candidates.join(", ")}`);
}

const { chromium } = loadPlaywright();
const CLARITY_VERSION = "i04-i05-canonical-clarity-v1";

async function loadLab(page, fileName, readyName, snapshotName) {
  const labPath = path.join(__dirname, fileName).replace(/\\/g, "/");
  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas#canvas").waitFor({ state: "visible" });
  await page.waitForFunction(
    ([ready, snapshot]) => window[ready] === true && typeof window[snapshot] === "function" && window[snapshot](),
    [readyName, snapshotName]
  );
  await page.waitForTimeout(180);
  return page.evaluate((snapshotName) => {
    const canvas = document.querySelector(".lab-viewport canvas#canvas");
    const command = document.querySelector(".command-bar");
    const stateNode = document.querySelector("#stateBox") || document.querySelector("#state") || document.querySelector(".state-box");
    return {
      bytes: canvas.toDataURL("image/png").length,
      snapshot: window[snapshotName](),
      stateText: stateNode.textContent.trim(),
      overflowX: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
      overflowY: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight,
      commandOverflowX: command ? command.scrollWidth - command.clientWidth : 0,
      commandOverflowY: command ? command.scrollHeight - command.clientHeight : 0
    };
  }, snapshotName);
}

async function setRange(page, selector, value) {
  await page.locator(selector).evaluate((input, nextValue) => {
    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

function requireFit(result, label) {
  if (result.overflowX > 18 || result.overflowY > 18 || result.commandOverflowX > 6 || result.commandOverflowY > 6) {
    throw new Error(`${label} is not fitted: ${JSON.stringify({
      overflowX: result.overflowX,
      overflowY: result.overflowY,
      commandOverflowX: result.commandOverflowX,
      commandOverflowY: result.commandOverflowY
    })}`);
  }
}

function requireFields(snapshot, fields, label) {
  for (const field of fields) {
    if (!(field in snapshot)) throw new Error(`${label} missing snapshot field ${field}`);
    if (snapshot[field] == null || snapshot[field] === "") throw new Error(`${label} field ${field} is empty`);
  }
}

function requireIncludes(snapshot, field, values, label) {
  if (!Array.isArray(snapshot[field])) throw new Error(`${label} ${field} is not an array: ${JSON.stringify(snapshot[field])}`);
  for (const value of values) {
    if (!snapshot[field].includes(value)) throw new Error(`${label} ${field} missing ${value}: ${JSON.stringify(snapshot[field])}`);
  }
}

function requireMinimums(snapshot, minimums, label) {
  for (const [field, min] of Object.entries(minimums)) {
    if (!(snapshot[field] >= min)) throw new Error(`${label} ${field} too weak: ${snapshot[field]} < ${min}`);
  }
}

function requireChanged(before, after, fields, label, minChanges = 2) {
  const changed = fields.filter((field) => before[field] !== after[field]);
  if (changed.length < minChanges) {
    throw new Error(`${label} controls changed too little. Changed ${changed.length}/${fields.length}: ${changed.join(", ")}`);
  }
}

async function testI04(page) {
  const result = await loadLab(page, "i04-variational-quantum-circuit-lab.html", "__i04LabReady", "__i04LabSnapshot");
  requireFit(result, "I04 desktop");
  const initial = result.snapshot;
  if (result.bytes < 12000 || initial.clarityVersion !== CLARITY_VERSION || initial.labId !== "i04" || initial.has3d !== true) {
    throw new Error(`I04 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    datasetPointObjectCount: 30,
    hybridPipelineObjectCount: 8,
    ansatzCircuitObjectCount: 20,
    measurementShotObjectCount: 2,
    lossCurveObjectCount: 14,
    parameterShiftObjectCount: 4,
    kernelMatrixObjectCount: 25,
    landscapeObjectCount: 49,
    optimizerObjectCount: 2
  }, "I04");
  requireFields(initial, [
    "datasetHash",
    "hybridPipelineHash",
    "ansatzCircuitHash",
    "measurementHash",
    "lossCurveHash",
    "parameterShiftHash",
    "kernelMatrixHash",
    "landscapeHash",
    "optimizerHash",
    "canonicalReferences",
    "qmlObjects",
    "diagnosticMetrics"
  ], "I04");
  requireIncludes(initial, "qmlObjects", [
    "classical_data_plane",
    "data_encoding_gates",
    "parameterized_ansatz_circuit",
    "measurement_shot_histogram",
    "classical_optimizer_loop",
    "parameter_shift_probes",
    "quantum_kernel_matrix",
    "svm_margin_baseline",
    "barren_plateau_landscape"
  ], "I04");
  requireIncludes(initial, "diagnosticMetrics", [
    "loss",
    "accuracy",
    "gradient_norm",
    "shot_stderr",
    "layers",
    "noise",
    "theta",
    "phi"
  ], "I04");

  await page.locator("#dataset").selectOption("circles");
  await page.locator("#ansatz").selectOption("hardware");
  await setRange(page, "#layers", "4");
  await setRange(page, "#shots", "64");
  await setRange(page, "#noise", "0.18");
  const configured = await page.evaluate(() => window.__i04LabSnapshot());
  if (configured.dataset !== "circles" || configured.ansatz !== "hardware" || configured.layers !== 4 || !/Changed noise|circles|hardware/i.test(configured.stateText)) {
    throw new Error(`I04 controls are not concrete: ${JSON.stringify(configured)}`);
  }
  requireChanged(initial, configured, ["datasetHash", "ansatzCircuitHash", "measurementHash", "landscapeHash", "parameterShiftHash"], "I04 controls", 4);

  const beforeLoss = configured.loss;
  await page.locator("#trainStep").click();
  await page.waitForFunction((previous) => window.__i04LabSnapshot().step >= 1 && window.__i04LabSnapshot().loss !== previous, beforeLoss);
  const trained = await page.evaluate(() => window.__i04LabSnapshot());
  if (trained.step < 1 || !/Optimizer step|parameter-shift/i.test(trained.stateText)) {
    throw new Error(`I04 train step is not explicit: ${JSON.stringify(trained)}`);
  }
  requireChanged(configured, trained, ["hybridPipelineHash", "ansatzCircuitHash", "lossCurveHash", "parameterShiftHash", "landscapeHash", "optimizerHash"], "I04 train step", 4);

  await page.locator("#toggleNoise").click();
  await page.waitForFunction(() => window.__i04LabSnapshot().noisy === true);
  const noisy = await page.evaluate(() => window.__i04LabSnapshot());
  if (!/Noise enabled|gradients degrade|Bloch vectors shrink/i.test(noisy.stateText)) {
    throw new Error(`I04 noise toggle is not explicit: ${JSON.stringify(noisy)}`);
  }
  requireChanged(trained, noisy, ["ansatzCircuitHash", "measurementHash", "parameterShiftHash", "landscapeHash"], "I04 noise", 3);

  await page.locator("#showKernel").click();
  await page.waitForFunction(() => window.__i04LabSnapshot().kernelMode === true);
  const kernel = await page.evaluate(() => window.__i04LabSnapshot());
  if (!/Quantum kernel matrix|SVM baseline|precomputed similarities/i.test(kernel.stateText)) {
    throw new Error(`I04 kernel view is not explicit: ${JSON.stringify(kernel)}`);
  }
  requireChanged(noisy, kernel, ["kernelMatrixHash", "parameterShiftHash", "datasetHash"], "I04 kernel view", 2);
}

async function testI05(page) {
  const result = await loadLab(page, "i05-quantum-graph-circuit-lab.html", "__i05LabReady", "__i05LabSnapshot");
  requireFit(result, "I05 desktop");
  const initial = result.snapshot;
  if (result.bytes < 12000 || initial.clarityVersion !== CLARITY_VERSION || initial.labId !== "i05" || initial.has3d !== true) {
    throw new Error(`I05 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    graphQubitObjectCount: 7,
    graphEdgeObjectCount: 10,
    circuitWireObjectCount: 7,
    nodeEncodingGateObjectCount: 7,
    qgnnLayerGateObjectCount: 30,
    hamiltonianTermObjectCount: 7,
    nodeReadoutObjectCount: 7,
    pairReadoutObjectCount: 10
  }, "I05");
  requireFields(initial, [
    "graphTopologyHash",
    "nodeEncodingHash",
    "edgeEntanglerHash",
    "qgnnCircuitHash",
    "hamiltonianHash",
    "nodeReadoutHash",
    "pairReadoutHash",
    "canonicalReferences",
    "qgnnObjects",
    "diagnosticMetrics"
  ], "I05");
  requireIncludes(initial, "qgnnObjects", [
    "graph_qubit_register",
    "node_feature_encoding_gates",
    "graph_edge_entanglers",
    "qaoa_cost_mixer_layers",
    "hamiltonian_graph_terms",
    "node_observable_readout",
    "pair_observable_readout",
    "edge_shuffle_ablation",
    "shot_sampling_cost"
  ], "I05");
  requireIncludes(initial, "diagnosticMetrics", [
    "node_count",
    "edge_count",
    "applied_layers",
    "entanglement",
    "energy",
    "depth_cost",
    "shot_stderr",
    "noise"
  ], "I05");

  await page.locator("#graphPreset").selectOption("molecule");
  await page.locator("#encoding").selectOption("amplitude");
  await page.locator("#entangler").selectOption("xx");
  await setRange(page, "#depth", "4");
  await setRange(page, "#shots", "128");
  await setRange(page, "#noise", "0.16");
  const configured = await page.evaluate(() => window.__i05LabSnapshot());
  if (configured.graphPreset !== "molecule" || configured.nodeCount !== 6 || configured.entangler !== "xx" || !/Changed noise|Quantum graph circuit/i.test(configured.stateText)) {
    throw new Error(`I05 graph controls are not concrete: ${JSON.stringify(configured)}`);
  }
  requireChanged(initial, configured, ["graphTopologyHash", "nodeEncodingHash", "edgeEntanglerHash", "qgnnCircuitHash", "hamiltonianHash"], "I05 controls", 4);

  await page.locator("#applyLayer").click();
  await page.waitForFunction(() => window.__i05LabSnapshot().appliedLayers >= 1);
  const layered = await page.evaluate(() => window.__i05LabSnapshot());
  if (!/Applied QGNN layer|graph ZZ cost layer|RX mixer/i.test(layered.stateText)) {
    throw new Error(`I05 layer action is not explicit: ${JSON.stringify(layered)}`);
  }
  requireChanged(configured, layered, ["graphTopologyHash", "edgeEntanglerHash", "qgnnCircuitHash", "hamiltonianHash", "nodeReadoutHash", "pairReadoutHash"], "I05 layer", 4);

  await page.locator("#measure").click();
  await page.waitForFunction(() => window.__i05LabSnapshot().measured === true);
  const measured = await page.evaluate(() => window.__i05LabSnapshot());
  if (!/Measured graph observables|shot sampling/i.test(measured.stateText)) {
    throw new Error(`I05 measurement is not explicit: ${JSON.stringify(measured)}`);
  }
  requireChanged(layered, measured, ["nodeReadoutHash", "pairReadoutHash", "measurementHash"], "I05 measurement", 2);

  await page.locator("#toggleEdges").click();
  await page.waitForFunction(() => window.__i05LabSnapshot().shuffled === true);
  const shuffled = await page.evaluate(() => window.__i05LabSnapshot());
  if (!/Edge shuffle ablation|different graph entanglers/i.test(shuffled.stateText)) {
    throw new Error(`I05 edge shuffle is not explicit: ${JSON.stringify(shuffled)}`);
  }
  requireChanged(measured, shuffled, ["graphTopologyHash", "edgeEntanglerHash", "hamiltonianHash", "pairReadoutHash"], "I05 edge shuffle", 3);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 700 } });
  try {
    await testI04(page);
    await testI05(page);
    console.log("I04/I05 canonical clarity checks passed");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
