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
const CLARITY_VERSION = "h15-i01-canonical-clarity-v1";

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

async function testH15(page) {
  const result = await loadLab(page, "h15-sheaf-research-frontier-lab.html", "__h15LabReady", "__h15LabSnapshot");
  requireFit(result, "H15 desktop");
  const initial = result.snapshot;
  if (result.bytes < 12000 || initial.clarityVersion !== CLARITY_VERSION || initial.labId !== "h15" || initial.has3d !== true) {
    throw new Error(`H15 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    frontierStationObjectCount: 7,
    pipelinePipeObjectCount: 6,
    dynamicEventStreamObjectCount: 7,
    topologyForgeObjectCount: 7,
    constraintRackObjectCount: 6,
    evaluationWallObjectCount: 3,
    baselineAblationLaneObjectCount: 2,
    scaleStressMeterObjectCount: 3,
    quantumUnitaryObjectCount: 2
  }, "H15");
  requireFields(initial, [
    "frontierStationHash",
    "pipelinePipeHash",
    "dynamicEventStreamHash",
    "topologyForgeHash",
    "constraintRackHash",
    "evaluationWallHash",
    "baselineAblationHash",
    "scaleStressHash",
    "quantumGaugeHash",
    "canonicalReferences",
    "researchFrontierObjects",
    "diagnosticMetrics"
  ], "H15");
  requireIncludes(initial, "researchFrontierObjects", ["dynamic_event_stream", "topology_forge", "restriction_map_rack", "constraint_family_selector", "scale_cost_meter", "baseline_ablation_lane", "quantum_unitary_station", "evaluation_wall"], "H15");
  requireIncludes(initial, "diagnosticMetrics", ["expressivity", "stability", "map_cost", "topology_entropy", "gauge_drift", "baseline_drop", "shot_cost"], "H15");

  await page.locator("#frontier").selectOption("constraints");
  await page.locator("#mapFamily").selectOption("orthogonal");
  await page.locator("#benchmark").selectOption("temporal");
  await setRange(page, "#timeDrift", "0.48");
  await setRange(page, "#topologyFreedom", "0.72");
  await setRange(page, "#constraintStrength", "0.86");
  await setRange(page, "#scale", "74");
  await setRange(page, "#supervision", "0.7");
  await setRange(page, "#noise", "0.26");
  const configured = await page.evaluate(() => window.__h15LabSnapshot());
  if (configured.frontier !== "constraints" || configured.mapFamily !== "orthogonal" || !/constraint frontier|orthogonal|gauge stability/i.test(configured.stateText)) {
    throw new Error(`H15 frontier controls are not concrete: ${JSON.stringify(configured)}`);
  }
  requireChanged(initial, configured, ["frontierStationHash", "pipelinePipeHash", "constraintRackHash", "topologyForgeHash", "scaleStressHash", "quantumGaugeHash"], "H15 controls", 4);

  const beforeStability = configured.metric.stability;
  await page.locator("#applyConstraint").click();
  await page.waitForFunction((previous) => window.__h15LabSnapshot().constraintApplications > 0 && window.__h15LabSnapshot().metric.stability > previous, beforeStability);
  const constrained = await page.evaluate(() => window.__h15LabSnapshot());
  if (!/constraints expose gauge stability/i.test(constrained.stateText)) {
    throw new Error(`H15 constraint action is not explicit: ${JSON.stringify(constrained)}`);
  }
  requireChanged(configured, constrained, ["constraintRackHash", "quantumGaugeHash", "scaleStressHash"], "H15 constraint action", 2);

  await setRange(page, "#scale", "96");
  await page.locator("#stressScale").click();
  await page.waitForFunction(() => window.__h15LabSnapshot().frontier === "scale" && window.__h15LabSnapshot().stressCount > 0);
  const stressed = await page.evaluate(() => window.__h15LabSnapshot());
  if (stressed.metric.cost <= constrained.metric.stability || !/memory bars|throughput pressure/i.test(stressed.stateText)) {
    throw new Error(`H15 scale stress is not explicit: ${JSON.stringify(stressed)}`);
  }
  requireChanged(constrained, stressed, ["frontierStationHash", "pipelinePipeHash", "scaleStressHash"], "H15 scale stress", 2);

  await page.locator("#runAblation").click();
  await page.waitForFunction(() => window.__h15LabSnapshot().ablated === true);
  const ablated = await page.evaluate(() => window.__h15LabSnapshot());
  if (!/matched baseline ablation|parameter matching/i.test(ablated.stateText) || ablated.metric.expressivity >= stressed.metric.expressivity) {
    throw new Error(`H15 ablation lane is not explicit: ${JSON.stringify(ablated)}`);
  }
  requireChanged(stressed, ablated, ["frontierStationHash", "evaluationWallHash", "baselineAblationHash"], "H15 ablation", 2);

  await page.locator("#frontier").selectOption("quantum");
  await page.locator("#mapFamily").selectOption("unitary");
  await page.waitForFunction(() => window.__h15LabSnapshot().frontier === "quantum" && window.__h15LabSnapshot().mapFamily === "unitary");
  const quantum = await page.evaluate(() => window.__h15LabSnapshot());
  if (!/unitary|shot cost|classical baselines/i.test(quantum.stateText)) {
    throw new Error(`H15 quantum station is not explicit: ${JSON.stringify(quantum)}`);
  }
  requireChanged(ablated, quantum, ["frontierStationHash", "constraintRackHash", "quantumGaugeHash"], "H15 quantum station", 2);
}

async function testI01(page) {
  const result = await loadLab(page, "i01-quantum-state-measurement.html", "__i01LabReady", "__i01LabSnapshot");
  requireFit(result, "I01 desktop");
  const initial = result.snapshot;
  if (result.bytes < 12000 || initial.clarityVersion !== CLARITY_VERSION || initial.labId !== "i01" || initial.has3d !== true) {
    throw new Error(`I01 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    blochScaffoldObjectCount: 6,
    stateVectorObjectCount: 1,
    basisAxisObjectCount: 1,
    projectionGeometryObjectCount: 3,
    bornProbabilityBarObjectCount: 2,
    finiteShotSampleObjectCount: 64,
    densityMatrixObjectCount: 4,
    teachingLabelObjectCount: 4
  }, "I01");
  requireFields(initial, [
    "blochScaffoldHash",
    "stateVectorHash",
    "basisAxisHash",
    "projectionGeometryHash",
    "bornProbabilityHash",
    "finiteShotHash",
    "densityMatrixHash",
    "teachingLabelHash",
    "canonicalReferences",
    "quantumObjects",
    "diagnosticMetrics"
  ], "I01");
  requireIncludes(initial, "quantumObjects", ["complex_state_vector", "bloch_sphere_surface", "measurement_basis_axis", "born_rule_projection", "probability_histogram", "finite_shot_samples", "density_matrix_coherence"], "I01");
  requireIncludes(initial, "diagnosticMetrics", ["theta", "phi", "basis_probability", "expectation_value", "purity", "shot_count", "sample_error"], "I01");

  await setRange(page, "#theta", "0");
  await setRange(page, "#phi", "0");
  await page.locator("#basis").selectOption("Z");
  const zCertain = await page.evaluate(() => window.__i01LabSnapshot());
  if (zCertain.p0 < 0.98 || !/population bars stay fixed/i.test(zCertain.stateText)) {
    throw new Error(`I01 Z-basis certainty is not concrete: ${JSON.stringify(zCertain)}`);
  }
  requireChanged(initial, zCertain, ["stateVectorHash", "projectionGeometryHash", "bornProbabilityHash", "densityMatrixHash"], "I01 Z measurement", 3);

  await setRange(page, "#theta", "1.5708");
  await setRange(page, "#phi", "0");
  await page.locator("#basis").selectOption("X");
  const xCertain = await page.evaluate(() => window.__i01LabSnapshot());
  if (xCertain.p0 < 0.98 || !/different question|overlap with the measurement axis/i.test(xCertain.stateText)) {
    throw new Error(`I01 X-basis phase semantics are not concrete: ${JSON.stringify(xCertain)}`);
  }
  requireChanged(zCertain, xCertain, ["stateVectorHash", "basisAxisHash", "projectionGeometryHash", "bornProbabilityHash"], "I01 X measurement", 3);

  await setRange(page, "#phi", "1.5708");
  await page.locator("#basis").selectOption("Y");
  await setRange(page, "#coherence", "0.62");
  const yMixed = await page.evaluate(() => window.__i01LabSnapshot());
  if (yMixed.purity >= xCertain.purity || yMixed.p0 < 0.75 || !/coherence/i.test(yMixed.stateText)) {
    throw new Error(`I01 Y/coherence behavior is not concrete: ${JSON.stringify(yMixed)}`);
  }
  requireChanged(xCertain, yMixed, ["stateVectorHash", "basisAxisHash", "projectionGeometryHash", "bornProbabilityHash", "densityMatrixHash"], "I01 Y coherence", 4);

  await setRange(page, "#shots", "128");
  await page.locator("#runShots").click();
  await page.waitForFunction(() => window.__i01LabSnapshot().zeros + window.__i01LabSnapshot().ones >= 128);
  const sampled = await page.evaluate(() => window.__i01LabSnapshot());
  if (sampled.sampleError > 0.25 || !/Run shots|Born probability/i.test(sampled.stateText)) {
    throw new Error(`I01 finite-shot sampling is not explicit: ${JSON.stringify(sampled)}`);
  }
  requireChanged(yMixed, sampled, ["finiteShotHash", "bornProbabilityHash"], "I01 finite shots", 1);

  await page.locator("#hadamard").click();
  await page.waitForFunction(() => window.__i01LabSnapshot().basis === "X" && window.__i01LabSnapshot().p0 > 0.98);
  const hadamard = await page.evaluate(() => window.__i01LabSnapshot());
  if (!/basis axis X|Born probability/i.test(hadamard.stateText)) {
    throw new Error(`I01 |+> preset is not explicit: ${JSON.stringify(hadamard)}`);
  }
  requireChanged(sampled, hadamard, ["stateVectorHash", "basisAxisHash", "projectionGeometryHash", "bornProbabilityHash"], "I01 hadamard preset", 3);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 700 } });
  try {
    await testH15(page);
    await testI01(page);
    console.log("H15/I01 canonical clarity checks passed");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
