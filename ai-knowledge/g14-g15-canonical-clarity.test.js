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
      // Continue through known runtime locations.
    }
  }

  throw new Error(`Unable to load Playwright from: ${candidates.join(", ")}`);
}

const { chromium } = loadPlaywright();
const CLARITY_VERSION = "g14-g15-canonical-clarity-v1";

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

function requireMinimums(snapshot, minimums, label) {
  for (const [field, min] of Object.entries(minimums)) {
    if (!(snapshot[field] >= min)) throw new Error(`${label} ${field} too weak: ${snapshot[field]} < ${min}`);
  }
}

function requireChanged(before, after, fields, label) {
  const changed = fields.filter((field) => before[field] !== after[field]);
  if (changed.length < Math.max(4, Math.ceil(fields.length * 0.45))) {
    throw new Error(`${label} controls changed too little. Changed ${changed.length}/${fields.length}: ${changed.join(", ")}`);
  }
}

async function requireOrbit(page, snapshotName) {
  const before = await page.evaluate((snapshot) => window[snapshot](), snapshotName);
  await page.mouse.move(420, 300);
  await page.mouse.down();
  await page.mouse.move(575, 365);
  await page.mouse.up();
  await page.waitForTimeout(90);
  const after = await page.evaluate((snapshot) => window[snapshot](), snapshotName);
  if (Math.abs(after.cameraTheta - before.cameraTheta) < 0.04) {
    throw new Error(`${snapshotName} camera did not rotate manually`);
  }
}

async function testG14(page) {
  const result = await loadLab(page, "g14-gnn-adversarial-perturbation-lab.html", "__g14LabReady", "__g14LabSnapshot");
  requireFit(result, "G14 desktop");
  await requireOrbit(page, "__g14LabSnapshot");
  const initial = result.snapshot;
  if (result.bytes < 13000 || initial.clarityVersion !== CLARITY_VERSION || initial.labId !== "g14" || initial.has3d !== true) {
    throw new Error(`G14 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    cleanGraphObjectCount: 10,
    targetNeighborhoodObjectCount: 4,
    edgeFlipObjectCount: 4,
    featureAttackObjectCount: 5,
    poisoningTimelineObjectCount: 4,
    nodeInjectionObjectCount: 4,
    attackBudgetObjectCount: 5,
    candidateEditObjectCount: 5,
    logitMarginObjectCount: 4,
    defenseFilterObjectCount: 4,
    robustAggregationObjectCount: 4,
    spectralNoiseObjectCount: 5,
    evaluationStripObjectCount: 4,
    threatModelObjectCount: 5
  }, "G14");
  requireFields(initial, [
    "cleanGraphHash",
    "targetNeighborhoodHash",
    "edgeFlipHash",
    "featureAttackHash",
    "poisoningTimelineHash",
    "nodeInjectionHash",
    "attackBudgetHash",
    "candidateEditHash",
    "logitMarginHash",
    "defenseFilterHash",
    "robustAggregationHash",
    "spectralNoiseHash",
    "evaluationStripHash",
    "threatModelHash",
    "attackTypes",
    "defenseTypes",
    "threatModelAxes",
    "canonicalReferences"
  ], "G14");
  for (const attack of ["edge_flip", "feature_flip", "poisoning", "node_injection"]) {
    if (!initial.attackTypes.includes(attack)) throw new Error(`G14 missing attack type ${attack}: ${JSON.stringify(initial)}`);
  }
  for (const defense of ["similarity_filter", "robust_aggregation", "adversarial_training", "structure_learning"]) {
    if (!initial.defenseTypes.includes(defense)) throw new Error(`G14 missing defense type ${defense}: ${JSON.stringify(initial)}`);
  }
  for (const axis of ["knowledge", "timing", "target", "budget", "plausibility"]) {
    if (!initial.threatModelAxes.includes(axis)) throw new Error(`G14 missing threat model axis ${axis}: ${JSON.stringify(initial)}`);
  }

  await page.locator("#attackType").selectOption("injection");
  await setRange(page, "#attackBudget", "7");
  await setRange(page, "#featureShift", "0.86");
  await setRange(page, "#plausibility", "0.38");
  await page.click("#runThreatModel");
  await page.waitForTimeout(140);
  const injected = await page.evaluate(() => window.__g14LabSnapshot());
  requireChanged(initial, injected, [
    "edgeFlipHash",
    "featureAttackHash",
    "nodeInjectionHash",
    "attackBudgetHash",
    "candidateEditHash",
    "logitMarginHash",
    "spectralNoiseHash",
    "evaluationStripHash",
    "threatModelHash"
  ], "G14 injection threat model");
  if (injected.injectedNodeCount <= initial.injectedNodeCount || injected.attackSurface <= initial.attackSurface || !/Nettack|surrogate|candidate|node injection|feature|plausibility/i.test(injected.stateText)) {
    throw new Error(`G14 injection view should expose candidate edits, fake nodes, features, and threat plausibility: ${JSON.stringify(injected)}`);
  }

  await page.locator("#attackType").selectOption("poisoning");
  await page.click("#poisonTraining");
  await page.waitForTimeout(120);
  const poisoned = await page.evaluate(() => window.__g14LabSnapshot());
  if (poisoned.poisoningTimelineHash === injected.poisoningTimelineHash || poisoned.poisonedLabels <= 0 || !/poison|training graph|test graph|label/i.test(poisoned.stateText)) {
    throw new Error(`G14 poisoning must be a concrete train/test timeline with corrupted labels: ${JSON.stringify(poisoned)}`);
  }

  await page.locator("#defenseMode").selectOption("trimmed");
  await setRange(page, "#defenseStrength", "1.3");
  await page.click("#applyDefense");
  await page.waitForTimeout(140);
  const defended = await page.evaluate(() => window.__g14LabSnapshot());
  if (defended.defenseFilterHash === poisoned.defenseFilterHash || defended.robustAggregationHash === poisoned.robustAggregationHash || defended.rejectedEdgeCount <= 0 || !/ProGNN|sanitation|trimmed|robust aggregation|rejected/i.test(defended.stateText)) {
    throw new Error(`G14 defense should show sanitation gates and robust aggregation weights: ${JSON.stringify(defended)}`);
  }
}

async function testG15(page) {
  const result = await loadLab(page, "g15-over-smoothing-depth-lab.html", "__g15LabReady", "__g15LabSnapshot");
  requireFit(result, "G15 desktop");
  await requireOrbit(page, "__g15LabSnapshot");
  const initial = result.snapshot;
  if (result.bytes < 13000 || initial.clarityVersion !== CLARITY_VERSION || initial.labId !== "g15" || initial.has3d !== true) {
    throw new Error(`G15 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    diffusionLayerObjectCount: 6,
    embeddingCloudObjectCount: 12,
    spectralModeObjectCount: 6,
    dirichletEnergyObjectCount: 8,
    pairwiseSimilarityObjectCount: 9,
    classSeparationObjectCount: 4,
    bottleneckBridgeObjectCount: 3,
    oversquashingFlowObjectCount: 8,
    residualAnchorObjectCount: 4,
    jkReadoutObjectCount: 4,
    rewiringShortcutObjectCount: 4,
    virtualNodeObjectCount: 1
  }, "G15");
  requireFields(initial, [
    "diffusionLayerHash",
    "embeddingCloudHash",
    "spectralModeHash",
    "dirichletEnergyHash",
    "pairwiseSimilarityHash",
    "classSeparationHash",
    "bottleneckBridgeHash",
    "oversquashingFlowHash",
    "residualAnchorHash",
    "jkReadoutHash",
    "rewiringShortcutHash",
    "virtualNodeHash",
    "failureModes",
    "mitigationTypes",
    "diagnosticMetrics",
    "canonicalReferences"
  ], "G15");
  for (const mode of ["over_smoothing", "over_squashing"]) {
    if (!initial.failureModes.includes(mode)) throw new Error(`G15 missing failure mode ${mode}: ${JSON.stringify(initial)}`);
  }
  for (const mitigation of ["residual", "jumping_knowledge", "rewiring", "virtual_node"]) {
    if (!initial.mitigationTypes.includes(mitigation)) throw new Error(`G15 missing mitigation ${mitigation}: ${JSON.stringify(initial)}`);
  }
  for (const metric of ["pairwise_similarity", "dirichlet_energy", "class_separation", "bottleneck_load"]) {
    if (!initial.diagnosticMetrics.includes(metric)) throw new Error(`G15 missing diagnostic ${metric}: ${JSON.stringify(initial)}`);
  }

  await page.locator("#graphShape").selectOption("barbell");
  await page.locator("#propagationRule").selectOption("plain");
  await setRange(page, "#layerDepth", "2");
  await setRange(page, "#mixingStrength", "0.42");
  await setRange(page, "#residualWeight", "0");
  await setRange(page, "#rewireAmount", "0");
  await page.click("#addLayer");
  await page.waitForTimeout(120);
  const shallow = await page.evaluate(() => window.__g15LabSnapshot());
  await setRange(page, "#layerDepth", "12");
  await setRange(page, "#mixingStrength", "1.06");
  await page.click("#addLayer");
  await page.waitForTimeout(140);
  const deep = await page.evaluate(() => window.__g15LabSnapshot());
  requireChanged(shallow, deep, [
    "diffusionLayerHash",
    "embeddingCloudHash",
    "spectralModeHash",
    "dirichletEnergyHash",
    "pairwiseSimilarityHash",
    "classSeparationHash",
    "oversquashingFlowHash"
  ], "G15 deep diffusion");
  if (!(deep.meanSimilarity > shallow.meanSimilarity) || !(deep.dirichletEnergy < shallow.dirichletEnergy) || !(deep.classSeparation < shallow.classSeparation) || !/P\^L|spectral|Dirichlet|pairwise|high-frequency/i.test(deep.stateText)) {
    throw new Error(`G15 deep propagation must show spectral low-pass smoothing: ${JSON.stringify({ shallow, deep })}`);
  }

  await page.locator("#propagationRule").selectOption("residual");
  await setRange(page, "#residualWeight", "0.86");
  await page.click("#addLayer");
  await page.waitForTimeout(120);
  const residual = await page.evaluate(() => window.__g15LabSnapshot());
  if (residual.residualAnchorHash === deep.residualAnchorHash || !(residual.classSeparation > deep.classSeparation) || !/residual|initial feature|anchor|preserve/i.test(residual.stateText)) {
    throw new Error(`G15 residual anchors must visibly preserve initial features: ${JSON.stringify(residual)}`);
  }

  await setRange(page, "#bottleneckWidth", "1");
  await page.click("#runFive");
  await page.waitForTimeout(120);
  const narrow = await page.evaluate(() => window.__g15LabSnapshot());
  await setRange(page, "#bottleneckWidth", "6");
  await page.click("#rewireGraph");
  await page.click("#jumpReadout");
  await page.waitForTimeout(160);
  const rescued = await page.evaluate(() => window.__g15LabSnapshot());
  requireChanged(narrow, rescued, [
    "bottleneckBridgeHash",
    "oversquashingFlowHash",
    "rewiringShortcutHash",
    "jkReadoutHash",
    "virtualNodeHash"
  ], "G15 bottleneck rescue");
  if (!(rescued.bottleneckLoad < narrow.bottleneckLoad) || rescued.rewiredEdges <= 0 || rescued.jumpingReadout !== true || !/over-squashing|bottleneck|shortcut|Jumping Knowledge|virtual node/i.test(rescued.stateText)) {
    throw new Error(`G15 bottleneck rescue must show cut relief, rewiring, JK, and virtual node: ${JSON.stringify({ narrow, rescued })}`);
  }
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 980, height: 720 } });
  try {
    await testG14(page);
    await page.setViewportSize({ width: 900, height: 700 });
    await testG15(page);
  } finally {
    await browser.close();
  }
  console.log("g14-g15 canonical clarity passed: robustness and depth labs expose canonical objects, hashes, controls, orbit, and fit.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
