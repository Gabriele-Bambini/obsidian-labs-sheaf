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
      // Try the next known runtime location.
    }
  }

  throw new Error(`Unable to load Playwright from: ${candidates.join(", ")}`);
}

const { chromium } = loadPlaywright();
const CLARITY_VERSION = "e18-g01-canonical-clarity-v2";
const LEGACY_CLARITY_VERSION = "e18-g01-canonical-clarity-v1";

async function setRange(page, selector, value) {
  await page.locator(selector).evaluate((input, nextValue) => {
    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function loadLab(page, fileName, readyName, snapshotName) {
  const labPath = path.join(__dirname, fileName).replace(/\\/g, "/");
  await page.goto(`file:///${labPath}`, { waitUntil: "domcontentloaded" });
  await page.locator(".lab-viewport canvas#canvas").waitFor({ state: "visible" });
  await page.waitForFunction(
    ([ready, snapshot]) => window[ready] === true && typeof window[snapshot] === "function" && window[snapshot](),
    [readyName, snapshotName]
  );
  await page.waitForTimeout(220);
  return page.evaluate((snapshot) => {
    const canvas = document.querySelector(".lab-viewport canvas#canvas");
    const command = document.querySelector(".command-bar");
    const stateNode = document.querySelector("#state") || document.querySelector("#stateBox") || document.querySelector(".state-box");
    return {
      bytes: canvas.toDataURL("image/png").length,
      snapshot: window[snapshot](),
      stateText: stateNode.textContent.trim(),
      overflowX: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
      overflowY: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight,
      commandOverflowX: command ? command.scrollWidth - command.clientWidth : 0,
      commandOverflowY: command ? command.scrollHeight - command.clientHeight : 0
    };
  }, snapshotName);
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

function requireArrayIncludes(snapshot, field, fragments, label) {
  if (!Array.isArray(snapshot[field])) {
    throw new Error(`${label} expected ${field} to be an array`);
  }
  for (const fragment of fragments) {
    if (!snapshot[field].some((item) => String(item).toLowerCase().includes(fragment.toLowerCase()))) {
      throw new Error(`${label} ${field} missing canonical fragment: ${fragment}`);
    }
  }
}

function requireNumber(snapshot, field, label) {
  if (typeof snapshot[field] !== "number" || !Number.isFinite(snapshot[field])) {
    throw new Error(`${label} expected finite numeric ${field}, got ${snapshot[field]}`);
  }
}

function requireChanged(before, after, fields, label) {
  const changed = fields.filter((field) => before[field] !== after[field]);
  if (changed.length < Math.max(4, Math.ceil(fields.length * 0.45))) {
    throw new Error(`${label} did not visibly react to controls. Changed ${changed.length}/${fields.length}: ${changed.join(", ")}`);
  }
}

async function dragOrbit(page, snapshotName) {
  const before = await page.evaluate((snapshot) => window[snapshot](), snapshotName);
  await page.mouse.move(390, 280);
  await page.mouse.down();
  await page.mouse.move(560, 355);
  await page.mouse.up();
  await page.waitForTimeout(100);
  const after = await page.evaluate((snapshot) => window[snapshot](), snapshotName);
  if (Math.abs(after.cameraTheta - before.cameraTheta) < 0.04) {
    throw new Error(`${snapshotName} camera did not orbit after drag`);
  }
}

async function testE18(page) {
  let result = await loadLab(page, "e18-pinn-residual-lab.html", "__e18LabReady", "__e18LabSnapshot");
  requireFit(result, "E18 desktop");
  await dragOrbit(page, "__e18LabSnapshot");
  const initial = result.snapshot;
  if (result.bytes < 12000 || initial.clarityVersion !== CLARITY_VERSION || initial.legacyClarityVersion !== LEGACY_CLARITY_VERSION || initial.has3d !== true || initial.labId !== "e18") {
    throw new Error(`E18 initial canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireArrayIncludes(initial, "pinnObjects", [
    "neural field",
    "collocation",
    "PDE residual",
    "autodiff",
    "boundary",
    "loss balance",
    "inverse alpha"
  ], "E18");
  requireArrayIncludes(initial, "canonicalReferences", [
    "PINN",
    "Raissi",
    "collocation",
    "automatic differentiation"
  ], "E18");
  requireArrayIncludes(initial, "diagnosticMetrics", [
    "data loss",
    "physics loss",
    "boundary loss",
    "alpha"
  ], "E18");
  requireFields(initial, [
    "neuralFieldHash",
    "measurementHash",
    "collocationResidualHash",
    "derivativeStencilHash",
    "boundaryConditionHash",
    "hardConstraintHash",
    "lossBalanceHash",
    "adaptiveHotspotHash",
    "alphaGaugeHash",
    "validationHeatmapHash",
    "spectralBiasHash",
    "classicalMeshHash",
    "autodiffLadderHash",
    "pdeOperatorHash",
    "gradientConflictHash",
    "physicsResidualHash",
    "boundaryEnforcementHash",
    "lossTermHash",
    "collocationSamplingHash",
    "commandEffectHash"
  ], "E18");
  const minimums = {
    neuralFieldSurfaceCount: 1,
    measurementPointCount: 8,
    collocationPointCount: 9,
    residualHaloCount: 9,
    derivativeStencilCount: 5,
    boundaryRailCount: 2,
    lossScaleCount: 3,
    adaptiveHotspotCount: 1,
    alphaGaugeCount: 1,
    validationHeatmapCount: 1,
    autodiffLadderCount: 4,
    pdeTermBoardCount: 4,
    gradientConflictVectorCount: 3
  };
  for (const [field, min] of Object.entries(minimums)) {
    if (!(initial[field] >= min)) throw new Error(`E18 ${field} too weak: ${initial[field]} < ${min}`);
  }
  [
    "dataLoss",
    "physicsLoss",
    "boundaryLoss",
    "alphaError",
    "residualCoverage",
    "spectralBias",
    "pdeResidualMean",
    "boundaryViolation",
    "collocationCoverage",
    "lossConflictScore"
  ].forEach((field) => requireNumber(initial, field, "E18"));
  await page.locator("#pdePreset").selectOption("burgers");
  await page.locator("#boundaryMode").selectOption("hard");
  await setRange(page, "#physicsWeight", "0.84");
  await setRange(page, "#dataWeight", "0.42");
  await setRange(page, "#boundaryWeight", "0.79");
  await setRange(page, "#collocationDensity", "15");
  await setRange(page, "#alphaEstimate", "0.62");
  await setRange(page, "#noiseLevel", "0.2");
  await page.click("#trainPinn");
  await page.click("#resampleCollocation");
  await page.click("#toggleHardConstraint");
  await page.waitForTimeout(120);
  const after = await page.evaluate(() => window.__e18LabSnapshot());
  requireChanged(initial, after, [
    "neuralFieldHash",
    "measurementHash",
    "collocationResidualHash",
    "derivativeStencilHash",
    "boundaryConditionHash",
    "hardConstraintHash",
    "lossBalanceHash",
    "adaptiveHotspotHash",
    "alphaGaugeHash",
    "validationHeatmapHash",
    "spectralBiasHash",
    "autodiffLadderHash",
    "pdeOperatorHash",
    "gradientConflictHash"
  ], "E18");
  if (after.pdePreset !== "burgers" || after.boundaryMode !== "hard" || after.trainStep < 1 || after.sampleStep < 1 || after.hardStep < 1) {
    throw new Error(`E18 controls did not drive the PINN scene: ${JSON.stringify(after)}`);
  }
  if (!/Burgers|hard|residual|collocation|derivative|boundary/i.test(after.stateText)) {
    throw new Error(`E18 state text lost canonical explanation: ${after.stateText}`);
  }
}

async function testG01(page) {
  let result = await loadLab(page, "g01-message-passing-playground.html", "__g01LabReady", "__g01LabSnapshot");
  requireFit(result, "G01 desktop");
  await dragOrbit(page, "__g01LabSnapshot");
  const initial = result.snapshot;
  if (result.bytes < 12000 || initial.clarityVersion !== CLARITY_VERSION || initial.legacyClarityVersion !== LEGACY_CLARITY_VERSION || initial.labId !== "g01" || initial.has3d !== true) {
    throw new Error(`G01 initial canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireArrayIncludes(initial, "gnnObjects", [
    "message arrows",
    "multiset",
    "aggregation",
    "k-hop frontier",
    "permutation",
    "readout"
  ], "G01");
  requireArrayIncludes(initial, "canonicalReferences", [
    "message passing",
    "permutation equivariance",
    "aggregation",
    "readout"
  ], "G01");
  requireArrayIncludes(initial, "diagnosticMetrics", [
    "message norm",
    "degree bias",
    "equivariance",
    "max dropped"
  ], "G01");
  requireFields(initial, [
    "selectedNeighborhoodHash",
    "messageFlowHash",
    "multisetShelfHash",
    "aggregationComparisonHash",
    "frontierExpansionHash",
    "degreeBiasHash",
    "permutationEquivarianceHash",
    "residualStateHash",
    "readoutHash",
    "formulaPipelineHash",
    "graphTopologyHash",
    "nodeFeatureHash",
    "messagePassingHash",
    "aggregationInvariantHash",
    "frontierDiagnosticHash",
    "readoutDiagnosticHash",
    "commandEffectHash"
  ], "G01");
  const minimums = {
    graphNodeObjectCount: 10,
    graphEdgeObjectCount: 12,
    messageEdgeCount: 4,
    multisetBarCount: 4,
    aggregationBarCount: 3,
    frontierObjectCount: 4,
    permutationOrderObjectCount: 4,
    degreeBiasObjectCount: 1,
    equivarianceDiagnosticCount: 1,
    readoutObjectCount: 1,
    residualPillarCount: 10,
    messageFormulaObjectCount: 3
  };
  for (const [field, min] of Object.entries(minimums)) {
    if (!(initial[field] >= min)) throw new Error(`G01 ${field} too weak: ${initial[field]} < ${min}`);
  }
  [
    "messageNorm",
    "degreeBias",
    "equivarianceGap",
    "maxDropped",
    "updateEnergy",
    "selectedAggregate",
    "readout",
    "frontierSize"
  ].forEach((field) => requireNumber(initial, field, "G01"));
  await page.locator("#aggregator").selectOption("max");
  await page.locator("#graphShape").selectOption("twoClass");
  await page.locator("#viewSelect").selectOption("frontier");
  await setRange(page, "#layers", "5");
  await setRange(page, "#mixing", "1.05");
  await setRange(page, "#featureNoise", "0.55");
  await setRange(page, "#neighborhoodRadius", "3");
  await setRange(page, "#residual", "0.58");
  await page.click("#sendMessages");
  await page.click("#stepFrontier");
  await page.click("#permuteOrder");
  await page.waitForTimeout(120);
  const after = await page.evaluate(() => window.__g01LabSnapshot());
  requireChanged(initial, after, [
    "selectedNeighborhoodHash",
    "messageFlowHash",
    "multisetShelfHash",
    "aggregationComparisonHash",
    "frontierExpansionHash",
    "degreeBiasHash",
    "permutationEquivarianceHash",
    "residualStateHash",
    "readoutHash",
    "formulaPipelineHash",
    "graphTopologyHash",
    "nodeFeatureHash"
  ], "G01");
  if (after.aggregator !== "max" || after.graphShape !== "twoClass" || after.phase !== "permuted" || after.permutationSeed < 1 || after.maxDropped <= 0) {
    throw new Error(`G01 controls did not drive the message passing scene: ${JSON.stringify(after)}`);
  }
  if (!/message|aggregate|frontier|permutation|equivariant|max/i.test(after.stateText)) {
    throw new Error(`G01 state text lost canonical explanation: ${after.stateText}`);
  }
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 980, height: 720 } });
  try {
    await testE18(page);
    await page.setViewportSize({ width: 900, height: 700 });
    await testG01(page);
  } finally {
    await browser.close();
  }
  console.log("e18-g01 canonical clarity passed: PINN residual and GNN message passing expose canonical objects, hashes, controls, orbit, and fit.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
