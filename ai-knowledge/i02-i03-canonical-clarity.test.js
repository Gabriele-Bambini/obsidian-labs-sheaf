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
const CLARITY_VERSION = "i02-i03-canonical-clarity-v1";

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

async function testI02(page) {
  const result = await loadLab(page, "i02-qubit-bloch-sphere.html", "__i02LabReady", "__i02LabSnapshot");
  requireFit(result, "I02 desktop");
  const initial = result.snapshot;
  if (result.bytes < 12000 || initial.clarityVersion !== CLARITY_VERSION || initial.labId !== "i02" || initial.has3d !== true) {
    throw new Error(`I02 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    blochScaffoldObjectCount: 6,
    stateVectorObjectCount: 1,
    gateArcObjectCount: 2,
    unitaryGateObjectCount: 2,
    circuitWireObjectCount: 2,
    circuitGateObjectCount: 7,
    cnotObjectCount: 3,
    bellAmplitudeObjectCount: 4,
    measurementHistogramObjectCount: 2,
    tensorBasisObjectCount: 4
  }, "I02");
  requireFields(initial, [
    "blochScaffoldHash",
    "stateVectorHash",
    "gateArcHash",
    "unitaryGateHash",
    "circuitWireHash",
    "circuitGateHash",
    "cnotHash",
    "bellAmplitudeHash",
    "measurementHistogramHash",
    "tensorBasisHash",
    "canonicalReferences",
    "qubitCircuitObjects",
    "diagnosticMetrics"
  ], "I02");
  requireIncludes(initial, "qubitCircuitObjects", [
    "bloch_sphere_surface",
    "normalized_state_vector",
    "unitary_gate_rotation",
    "gate_sequence_circuit",
    "cnot_entangler",
    "bell_pair_amplitudes",
    "measurement_histogram",
    "tensor_product_basis"
  ], "I02");
  requireIncludes(initial, "diagnosticMetrics", [
    "p0",
    "p1",
    "selected_gate",
    "rotation_angle",
    "shot_count",
    "entanglement_strength",
    "bell_correlation"
  ], "I02");

  await page.locator("#preset").selectOption("+");
  await page.locator("#gateSelect").selectOption("Rz");
  await setRange(page, "#rotationAngle", "1.5708");
  await setRange(page, "#shotCount", "160");
  await setRange(page, "#entangleStrength", "0.82");
  const configured = await page.evaluate(() => window.__i02LabSnapshot());
  if (Math.abs(configured.p0 - 0.5) > 0.03 || configured.selectedGate !== "Rz" || !/selected gate Rz|Rz gate/i.test(configured.stateText)) {
    throw new Error(`I02 Bloch/gate controls are not concrete: ${JSON.stringify(configured)}`);
  }
  requireChanged(initial, configured, ["stateVectorHash", "gateArcHash", "unitaryGateHash", "measurementHistogramHash"], "I02 controls", 2);

  await page.locator("#stepGate").click();
  await page.waitForFunction(() => window.__i02LabSnapshot().gateCount >= 1 && window.__i02LabSnapshot().lastControl === "stepGate");
  const stepped = await page.evaluate(() => window.__i02LabSnapshot());
  if (stepped.gateCount < 1 || !/Applied Rz|unitary gate/i.test(stepped.stateText)) {
    throw new Error(`I02 step gate is not explicit: ${JSON.stringify(stepped)}`);
  }
  requireChanged(configured, stepped, ["stateVectorHash", "circuitGateHash", "unitaryGateHash"], "I02 unitary step", 2);

  await page.locator("#bell").click();
  await page.waitForFunction(() => window.__i02LabSnapshot().mode === "circuit" && window.__i02LabSnapshot().selectedGate === "CNOT");
  const bell = await page.evaluate(() => window.__i02LabSnapshot());
  if (!bell.entangled || !/Bell builder|CNOT|Bell pair amplitudes/i.test(bell.stateText)) {
    throw new Error(`I02 Bell/CNOT circuit is not explicit: ${JSON.stringify(bell)}`);
  }
  requireChanged(stepped, bell, ["stateVectorHash", "cnotHash", "bellAmplitudeHash", "circuitGateHash", "tensorBasisHash"], "I02 Bell circuit", 3);

  await page.locator("#measureCircuit").click();
  await page.waitForFunction(() => window.__i02LabSnapshot().zeroCount + window.__i02LabSnapshot().oneCount >= 160);
  const measured = await page.evaluate(() => window.__i02LabSnapshot());
  if (!/Measured Z|measurement histogram/i.test(measured.stateText) || measured.zeroCount + measured.oneCount < 160) {
    throw new Error(`I02 measurement histogram is not explicit: ${JSON.stringify(measured)}`);
  }
  requireChanged(bell, measured, ["measurementHistogramHash", "bellAmplitudeHash"], "I02 measurement", 1);
}

async function testI03(page) {
  const result = await loadLab(page, "i03-quantum-algorithm-interference-lab.html", "__i03LabReady", "__i03LabSnapshot");
  requireFit(result, "I03 desktop");
  const initial = result.snapshot;
  if (result.bytes < 12000 || initial.clarityVersion !== CLARITY_VERSION || initial.labId !== "i03" || initial.has3d !== true) {
    throw new Error(`I03 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    signedAmplitudeBarObjectCount: 16,
    oracleMarkerObjectCount: 2,
    diffuserMeanObjectCount: 1,
    groverPlaneObjectCount: 4,
    qftCombObjectCount: 16,
    frequencyPeakObjectCount: 16,
    phaseDialObjectCount: 4,
    shorGcdPanelObjectCount: 3
  }, "I03");
  requireFields(initial, [
    "amplitudeBarHash",
    "oraclePhaseHash",
    "diffuserMeanHash",
    "groverPlaneHash",
    "qftCombHash",
    "frequencyPeakHash",
    "phaseDialHash",
    "shorGcdHash",
    "readoutPanelHash",
    "canonicalReferences",
    "quantumAlgorithmObjects",
    "diagnosticMetrics"
  ], "I03");
  requireIncludes(initial, "quantumAlgorithmObjects", [
    "signed_amplitude_register",
    "oracle_phase_flip",
    "diffuser_reflection_mean",
    "grover_rotation_plane",
    "qft_periodic_comb",
    "frequency_peak_readout",
    "phase_estimation_dials",
    "shor_gcd_postprocessing"
  ], "I03");
  requireIncludes(initial, "diagnosticMetrics", [
    "target_probability",
    "mean_amplitude",
    "iteration",
    "period",
    "phase",
    "readout_frequency",
    "oracle_calls"
  ], "I03");

  await page.locator("#oracleStep").click();
  await page.waitForFunction(() => window.__i03LabSnapshot().oracleFlipped === true);
  const oracle = await page.evaluate(() => window.__i03LabSnapshot());
  if (!/Oracle phase flip|negative/i.test(oracle.stateText)) {
    throw new Error(`I03 oracle phase flip is not explicit: ${JSON.stringify(oracle)}`);
  }
  requireChanged(initial, oracle, ["amplitudeBarHash", "oraclePhaseHash", "readoutPanelHash"], "I03 oracle", 2);

  const beforeProb = oracle.targetProbability;
  await page.locator("#diffuseStep").click();
  await page.waitForFunction((previous) => window.__i03LabSnapshot().targetProbability > previous, beforeProb);
  const diffuser = await page.evaluate(() => window.__i03LabSnapshot());
  if (!/Diffuser reflection about mean/i.test(diffuser.stateText)) {
    throw new Error(`I03 diffuser reflection is not explicit: ${JSON.stringify(diffuser)}`);
  }
  requireChanged(oracle, diffuser, ["amplitudeBarHash", "diffuserMeanHash", "groverPlaneHash", "readoutPanelHash"], "I03 diffuser", 3);

  await page.locator("#algorithm").selectOption("QFT");
  await setRange(page, "#period", "5");
  await setRange(page, "#phase", "0.38");
  const qft = await page.evaluate(() => window.__i03LabSnapshot());
  if (qft.algorithm !== "QFT" || !/QFT maps a periodic comb|frequency peaks/i.test(qft.stateText)) {
    throw new Error(`I03 QFT comb is not explicit: ${JSON.stringify(qft)}`);
  }
  requireChanged(diffuser, qft, ["qftCombHash", "frequencyPeakHash", "readoutPanelHash"], "I03 QFT", 2);

  await page.locator("#algorithm").selectOption("Phase Estimation");
  await setRange(page, "#phase", "0.63");
  const phase = await page.evaluate(() => window.__i03LabSnapshot());
  if (phase.algorithm !== "Phase Estimation" || !/Controlled U powers|phase to bits/i.test(phase.stateText)) {
    throw new Error(`I03 phase estimation dials are not explicit: ${JSON.stringify(phase)}`);
  }
  requireChanged(qft, phase, ["phaseDialHash", "readoutPanelHash", "frequencyPeakHash"], "I03 phase estimation", 2);

  await page.locator("#algorithm").selectOption("Shor N=15");
  await page.locator("#oracleStep").click();
  const shor = await page.evaluate(() => window.__i03LabSnapshot());
  if (shor.algorithm !== "Shor N=15" || !/Shor N=15|gcd gives 3 and 5/i.test(shor.stateText)) {
    throw new Error(`I03 Shor period/gcd panel is not explicit: ${JSON.stringify(shor)}`);
  }
  requireChanged(phase, shor, ["shorGcdHash", "frequencyPeakHash", "readoutPanelHash"], "I03 Shor", 2);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 700 } });
  try {
    await testI02(page);
    await testI03(page);
    console.log("I02/I03 canonical clarity checks passed");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
