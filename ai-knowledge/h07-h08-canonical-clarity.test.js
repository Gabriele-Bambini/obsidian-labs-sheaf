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
const CLARITY_VERSION = "h07-h08-canonical-clarity-v1";

async function loadLab(page, fileName, readyName, snapshotName) {
  const labPath = path.join(__dirname, fileName).replace(/\\/g, "/");
  await page.goto(`file:///${labPath}`, { waitUntil: "domcontentloaded" });
  await page.locator(".lab-viewport canvas#canvas").waitFor({ state: "visible" });
  await page.waitForFunction(
    ([ready, snapshot]) => window[ready] === true && typeof window[snapshot] === "function" && window[snapshot](),
    [readyName, snapshotName]
  );
  await page.waitForTimeout(220);
  return page.evaluate((snapshotName) => {
    const canvas = document.querySelector(".lab-viewport canvas#canvas");
    const command = document.querySelector(".command-bar");
    const stateNode = document.querySelector("#stateBox") || document.querySelector(".state-box");
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

function requireMinimums(snapshot, minimums, label) {
  for (const [field, min] of Object.entries(minimums)) {
    if (!(snapshot[field] >= min)) throw new Error(`${label} ${field} too weak: ${snapshot[field]} < ${min}`);
  }
}

function requireIncludes(snapshot, field, values, label) {
  if (!Array.isArray(snapshot[field])) throw new Error(`${label} ${field} is not an array: ${JSON.stringify(snapshot[field])}`);
  for (const value of values) {
    if (!snapshot[field].includes(value)) throw new Error(`${label} ${field} missing ${value}: ${JSON.stringify(snapshot[field])}`);
  }
}

function requireChanged(before, after, fields, label, minChanges = 2) {
  const changed = fields.filter((field) => before[field] !== after[field]);
  if (changed.length < minChanges) {
    throw new Error(`${label} controls changed too little. Changed ${changed.length}/${fields.length}: ${changed.join(", ")}`);
  }
}

async function testH07(page) {
  const result = await loadLab(page, "h07-sheaf-neural-networks-lab.html", "__h07LabReady", "__h07LabSnapshot");
  requireFit(result, "H07 desktop");
  const initial = result.snapshot;
  if (result.bytes < 12000 || initial.clarityVersion !== CLARITY_VERSION || initial.labId !== "h07" || initial.has3d !== true) {
    throw new Error(`H07 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    nodeFeatureTowerObjectCount: 12,
    restrictionPredictorObjectCount: 1,
    restrictionMapObjectCount: 8,
    edgeStalkChamberObjectCount: 3,
    transportedMessageObjectCount: 8,
    aggregationObjectCount: 5,
    updateBlockObjectCount: 1,
    readoutLossObjectCount: 6,
    mapFamilyDiagnosticObjectCount: 5,
    identityBaselineObjectCount: 3,
    learnedMapConstraintObjectCount: 5,
    oversmoothingComparisonObjectCount: 2
  }, "H07");
  requireFields(initial, [
    "nodeFeatureTowerHash",
    "restrictionPredictorHash",
    "restrictionMapHash",
    "edgeStalkChamberHash",
    "transportedMessageHash",
    "aggregationHash",
    "updateBlockHash",
    "readoutLossHash",
    "mapFamilyDiagnosticHash",
    "identityBaselineHash",
    "learnedMapConstraintHash",
    "oversmoothingComparisonHash",
    "canonicalReferences",
    "snnObjects",
    "diagnosticMetrics"
  ], "H07");
  requireIncludes(initial, "snnObjects", ["node_feature_tower", "restriction_predictor", "edge_stalk_chamber", "learned_restriction_map", "transported_message", "aggregation", "update_block", "task_loss", "identity_baseline"], "H07");
  requireIncludes(initial, "diagnosticMetrics", ["map_agreement", "sheaf_energy", "message_quality", "compatibility_gain", "oversmoothing"], "H07");

  await page.locator("#mode").selectOption("restrictions");
  await page.locator("#mapFamily").selectOption("orthogonal");
  await setRange(page, "#layerDepth", "6");
  await setRange(page, "#relationSharpness", "1.5");
  await setRange(page, "#relationNoise", "0.22");
  await setRange(page, "#neighborBudget", "5");
  await setRange(page, "#selfWeight", "0.64");
  const configured = await page.evaluate(() => window.__h07LabSnapshot());
  if (configured.mapFamily !== "orthogonal" || !/orthogonal|restriction/i.test(configured.stateText)) {
    throw new Error(`H07 configuration did not expose the map family: ${JSON.stringify(configured)}`);
  }
  requireChanged(initial, configured, ["restrictionPredictorHash", "restrictionMapHash", "edgeStalkChamberHash", "mapFamilyDiagnosticHash", "learnedMapConstraintHash"], "H07 restriction controls", 3);

  const beforeLearn = configured.sheafEnergy;
  await page.locator("#learnMaps").click();
  await page.waitForFunction(
    (previous) => window.__h07LabSnapshot().status === "Maps learned" && window.__h07LabSnapshot().mapAgreement > 0.82 && window.__h07LabSnapshot().sheafEnergy < previous,
    beforeLearn
  );
  const learned = await page.evaluate(() => window.__h07LabSnapshot());
  if (!/learned restriction maps|edge-stalk chambers/i.test(learned.stateText)) {
    throw new Error(`H07 learn action is not didactic enough: ${JSON.stringify(learned)}`);
  }
  requireChanged(configured, learned, ["restrictionPredictorHash", "restrictionMapHash", "edgeStalkChamberHash", "readoutLossHash"], "H07 learned maps", 2);

  await page.locator("#passMessage").click();
  await page.waitForFunction(() => window.__h07LabSnapshot().status === "Message passed" && window.__h07LabSnapshot().messageQuality > 0.72);
  const passed = await page.evaluate(() => window.__h07LabSnapshot());
  if (!/B_v\^T B_u h_u|aggregation/i.test(passed.stateText)) {
    throw new Error(`H07 transported message is not explicit: ${JSON.stringify(passed)}`);
  }
  requireChanged(learned, passed, ["transportedMessageHash", "aggregationHash", "updateBlockHash"], "H07 message pass", 2);

  await page.locator("#mode").selectOption("oversmoothing");
  await page.locator("#comparison").selectOption("graph");
  await page.locator("#stepLayer").click();
  await page.waitForFunction(() => window.__h07LabSnapshot().status === "Layer stepped" && window.__h07LabSnapshot().comparison === "graph");
  const graphStep = await page.evaluate(() => window.__h07LabSnapshot());
  if (graphStep.oversmoothing <= passed.oversmoothing || !/over-smoothing|raw neighbors/i.test(graphStep.stateText)) {
    throw new Error(`H07 graph baseline did not expose oversmoothing: ${JSON.stringify(graphStep)}`);
  }
  requireChanged(passed, graphStep, ["identityBaselineHash", "oversmoothingComparisonHash", "aggregationHash"], "H07 graph baseline", 2);
}

async function testH08(page) {
  const result = await loadLab(page, "h08-neural-sheaf-diffusion-lab.html", "__h08LabReady", "__h08LabSnapshot");
  requireFit(result, "H08 desktop");
  const initial = result.snapshot;
  if (result.bytes < 12000 || initial.clarityVersion !== CLARITY_VERSION || initial.labId !== "h08" || initial.has3d !== true) {
    throw new Error(`H08 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    rawFeatureObjectCount: 8,
    graphDiffusionObjectCount: 9,
    sheafDiffusionObjectCount: 9,
    learnedRestrictionGateObjectCount: 6,
    edgeStalkObjectCount: 3,
    residualObjectCount: 3,
    odeTrajectoryObjectCount: 16,
    kernelSurfaceObjectCount: 1,
    energyBarObjectCount: 6,
    stabilityObjectCount: 1,
    taskLossObjectCount: 4,
    mapRegularizerObjectCount: 4,
    oversmoothingLaneObjectCount: 2
  }, "H08");
  requireFields(initial, [
    "rawFeatureHash",
    "graphDiffusionHash",
    "sheafDiffusionHash",
    "learnedRestrictionGateHash",
    "edgeStalkHash",
    "residualHash",
    "odeTrajectoryHash",
    "kernelSurfaceHash",
    "energyBarHash",
    "stabilityHash",
    "taskLossHash",
    "mapRegularizerHash",
    "oversmoothingLaneHash",
    "canonicalReferences",
    "nsdObjects",
    "diagnosticMetrics"
  ], "H08");
  requireIncludes(initial, "nsdObjects", ["plain_graph_diffusion", "learned_sheaf_diffusion", "restriction_network", "edge_stalk_residual", "sheaf_laplacian_ode", "learned_kernel", "global_section_projection", "oversmoothing_comparison"], "H08");
  requireIncludes(initial, "diagnosticMetrics", ["map_agreement", "sheaf_energy", "graph_energy", "kernel_dimension", "label_agreement", "stability_reserve"], "H08");

  await page.locator("#scenario").selectOption("heterophily");
  await page.locator("#operator").selectOption("sheaf");
  await page.locator("#view").selectOption("ode");
  await setRange(page, "#odeSteps", "7");
  await setRange(page, "#kernelSharpness", "1.45");
  await setRange(page, "#featureNoise", "0.32");
  await setRange(page, "#relationChannels", "6");
  await setRange(page, "#skipConnection", "0.62");
  const configured = await page.evaluate(() => window.__h08LabSnapshot());
  if (configured.operator !== "sheaf" || configured.relationChannelCount !== 6 || !/heterophily|sheaf ODE/i.test(configured.stateText)) {
    throw new Error(`H08 controls did not configure NSD: ${JSON.stringify(configured)}`);
  }
  requireChanged(initial, configured, ["rawFeatureHash", "graphDiffusionHash", "sheafDiffusionHash", "learnedRestrictionGateHash", "odeTrajectoryHash", "mapRegularizerHash"], "H08 NSD controls", 4);

  const beforeLearn = configured.sheafEnergy;
  await page.locator("#learnRestrictions").click();
  await page.waitForFunction(
    (previous) => window.__h08LabSnapshot().status === "Restrictions learned" && window.__h08LabSnapshot().mapAgreement > 0.82 && window.__h08LabSnapshot().sheafEnergy < previous,
    beforeLearn
  );
  const learned = await page.evaluate(() => window.__h08LabSnapshot());
  if (!/learned restrictions|edge-stalk/i.test(learned.stateText)) {
    throw new Error(`H08 learned restrictions are not concrete: ${JSON.stringify(learned)}`);
  }
  requireChanged(configured, learned, ["learnedRestrictionGateHash", "edgeStalkHash", "residualHash", "taskLossHash"], "H08 learned restrictions", 2);

  const beforeStep = learned.sheafEnergy;
  await page.locator("#stepOde").click();
  await page.waitForFunction((previous) => window.__h08LabSnapshot().status === "ODE stepped" && window.__h08LabSnapshot().sheafEnergy < previous, beforeStep);
  const odeStep = await page.evaluate(() => window.__h08LabSnapshot());
  if (!/dx\/dt = -Delta_F\(theta\) x|ODE/i.test(odeStep.stateText)) {
    throw new Error(`H08 ODE step did not expose the sheaf vector field: ${JSON.stringify(odeStep)}`);
  }
  requireChanged(learned, odeStep, ["odeTrajectoryHash", "energyBarHash", "stabilityHash"], "H08 ODE step", 2);

  await page.locator("#projectKernel").click();
  await page.waitForFunction(() => window.__h08LabSnapshot().status === "Kernel projected" && window.__h08LabSnapshot().kernelDimension >= 2);
  const kernel = await page.evaluate(() => window.__h08LabSnapshot());
  if (!/learned kernel|global section/i.test(kernel.stateText)) {
    throw new Error(`H08 kernel projection is not explicit: ${JSON.stringify(kernel)}`);
  }
  requireChanged(odeStep, kernel, ["kernelSurfaceHash", "sheafDiffusionHash", "residualHash"], "H08 learned kernel", 2);

  await page.locator("#operator").selectOption("graph");
  await page.locator("#view").selectOption("comparison");
  await page.locator("#compareGraph").click();
  await page.waitForFunction(() => window.__h08LabSnapshot().status === "Compared" && window.__h08LabSnapshot().operator === "graph");
  const graphFlow = await page.evaluate(() => window.__h08LabSnapshot());
  if (graphFlow.oversmoothing <= odeStep.oversmoothing || !/over-smoothing|learned sheaf lane/i.test(graphFlow.stateText)) {
    throw new Error(`H08 graph comparison did not expose collapse vs learned sheaf flow: ${JSON.stringify(graphFlow)}`);
  }
  requireChanged(kernel, graphFlow, ["graphDiffusionHash", "oversmoothingLaneHash", "energyBarHash"], "H08 graph comparison", 2);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 700 } });
  try {
    await testH07(page);
    await testH08(page);
    console.log("H07/H08 canonical clarity checks passed");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
