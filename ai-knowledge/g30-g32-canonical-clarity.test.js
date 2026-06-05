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
const CLARITY_VERSION = "g30-g32-canonical-clarity-v1";

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

async function testG30(page) {
  const result = await loadLab(page, "g30-heterophilic-gnn-lab.html", "__g30LabReady", "__g30LabSnapshot");
  requireFit(result, "G30 desktop");
  await requireOrbit(page, "__g30LabSnapshot");
  const initial = result.snapshot;
  if (result.bytes < 13000 || initial.clarityVersion !== CLARITY_VERSION || initial.labId !== "g30" || initial.has3d !== true) {
    throw new Error(`G30 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    roleGraphObjectCount: 14,
    heterophilyEdgeObjectCount: 18,
    rawMeanCollapseObjectCount: 4,
    compatibilityMapObjectCount: 9,
    signedMessageObjectCount: 8,
    twoHopParityObjectCount: 6,
    highPassFilterObjectCount: 6,
    residualAnchorObjectCount: 4,
    mixHopChannelObjectCount: 4,
    homophilyMeterObjectCount: 5,
    relationNoiseObjectCount: 5,
    baselineComparisonObjectCount: 3,
    sheafCompatibilityObjectCount: 4
  }, "G30");
  requireFields(initial, [
    "roleGraphHash",
    "heterophilyEdgeHash",
    "rawMeanCollapseHash",
    "compatibilityMapHash",
    "signedMessageHash",
    "twoHopParityHash",
    "highPassFilterHash",
    "residualAnchorHash",
    "mixHopChannelHash",
    "homophilyMeterHash",
    "relationNoiseHash",
    "baselineComparisonHash",
    "sheafCompatibilityHash",
    "canonicalReferences",
    "heterophilyDesigns",
    "diagnosticMetrics"
  ], "G30");
  for (const design of ["GCN_low_pass", "signed_compatibility", "MixHop_even_hops", "FAGCN_high_pass", "H2GCN_feature_separation", "sheaf_maps"]) {
    if (!initial.heterophilyDesigns.includes(design)) throw new Error(`G30 missing heterophily design ${design}: ${JSON.stringify(initial)}`);
  }
  for (const metric of ["edge_homophily", "neighbor_help", "class_separation", "compatibility_accuracy"]) {
    if (!initial.diagnosticMetrics.includes(metric)) throw new Error(`G30 missing diagnostic ${metric}: ${JSON.stringify(initial)}`);
  }

  await page.locator("#graphRegime").selectOption("bipartite");
  await page.locator("#messageRule").selectOption("gcn");
  await setRange(page, "#homophilyRatio", "0.04");
  await page.click("#smoothOnce");
  await page.waitForTimeout(120);
  const smoothed = await page.evaluate(() => window.__g30LabSnapshot());
  if (smoothed.rawGcnSignal > 0.45 || !/low-pass|erase|opposite-role|GCN/i.test(smoothed.stateText)) {
    throw new Error(`G30 raw GCN smoothing must visibly collapse alternating-role evidence: ${JSON.stringify(smoothed)}`);
  }

  await page.locator("#messageRule").selectOption("signed");
  await setRange(page, "#compatibilityStrength", "0.94");
  await page.click("#applyCompatibility");
  await page.waitForTimeout(140);
  const signed = await page.evaluate(() => window.__g30LabSnapshot());
  requireChanged(smoothed, signed, [
    "rawMeanCollapseHash",
    "compatibilityMapHash",
    "signedMessageHash",
    "residualAnchorHash",
    "homophilyMeterHash",
    "baselineComparisonHash",
    "sheafCompatibilityHash"
  ], "G30 signed compatibility");
  if (!(signed.signedSignal > smoothed.rawGcnSignal) || !(signed.compatScore > smoothed.gcnScore) || !/signed|compatibility|flip|transport|H2GCN/i.test(signed.stateText)) {
    throw new Error(`G30 compatibility map should translate opposite neighbors into useful evidence: ${JSON.stringify({ smoothed, signed })}`);
  }

  await page.locator("#messageRule").selectOption("twohop");
  await page.click("#showTwoHop");
  await page.waitForTimeout(120);
  const twoHop = await page.evaluate(() => window.__g30LabSnapshot());
  if (twoHop.mixHopChannelHash === signed.mixHopChannelHash || twoHop.twoHopSupport <= 0.25 || !/MixHop|two-hop|same-role|parity/i.test(twoHop.stateText)) {
    throw new Error(`G30 two-hop view must expose even-hop same-role support: ${JSON.stringify(twoHop)}`);
  }

  await page.locator("#messageRule").selectOption("highpass");
  await setRange(page, "#highPassGain", "1.25");
  await page.click("#applyCompatibility");
  await page.waitForTimeout(140);
  const highpass = await page.evaluate(() => window.__g30LabSnapshot());
  if (highpass.highPassFilterHash === twoHop.highPassFilterHash || !(highpass.highFrequencyEnergy > twoHop.highFrequencyEnergy) || !/FAGCN|high-pass|frequency|edge difference/i.test(highpass.stateText)) {
    throw new Error(`G30 high-pass mode must preserve alternating edge differences: ${JSON.stringify(highpass)}`);
  }

  await setRange(page, "#relationNoise", "0.88");
  await page.click("#shuffleSigns");
  await page.waitForTimeout(140);
  const shuffled = await page.evaluate(() => window.__g30LabSnapshot());
  if (shuffled.relationNoiseHash === highpass.relationNoiseHash || !(shuffled.compatibilityAccuracy < highpass.compatibilityAccuracy) || !/shuffle|edge type|sign|relation noise/i.test(shuffled.stateText)) {
    throw new Error(`G30 relation noise must damage compatibility maps: ${JSON.stringify({ highpass, shuffled })}`);
  }
}

async function testG32(page) {
  const result = await loadLab(page, "g32-ai-foundations-lab.html", "__g32LabReady", "__g32LabSnapshot");
  requireFit(result, "G32 desktop");
  await requireOrbit(page, "__g32LabSnapshot");
  const initial = result.snapshot;
  if (result.bytes < 13000 || initial.clarityVersion !== CLARITY_VERSION || initial.labId !== "g32" || initial.has3d !== true) {
    throw new Error(`G32 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    taskContractObjectCount: 8,
    dataSampleObjectCount: 18,
    representationEncoderObjectCount: 4,
    inductiveBiasObjectCount: 5,
    objectiveLossObjectCount: 4,
    optimizerTrajectoryObjectCount: 5,
    trainValSplitObjectCount: 3,
    generalizationGapObjectCount: 4,
    calibrationReliabilityObjectCount: 5,
    deploymentRiskObjectCount: 8,
    agentLoopObjectCount: 5,
    monitoringObjectCount: 4
  }, "G32");
  requireFields(initial, [
    "taskContractHash",
    "dataSampleHash",
    "representationEncoderHash",
    "inductiveBiasHash",
    "objectiveLossHash",
    "optimizerTrajectoryHash",
    "trainValSplitHash",
    "generalizationGapHash",
    "calibrationReliabilityHash",
    "deploymentRiskHash",
    "agentLoopHash",
    "monitoringHash",
    "taskFamilies",
    "representationFamilies",
    "objectiveFamilies",
    "canonicalReferences"
  ], "G32");
  for (const task of ["classification", "generative", "agentic"]) {
    if (!initial.taskFamilies.includes(task)) throw new Error(`G32 missing task family ${task}: ${JSON.stringify(initial)}`);
  }
  for (const representation of ["tabular", "tokens", "graph", "state"]) {
    if (!initial.representationFamilies.includes(representation)) throw new Error(`G32 missing representation ${representation}: ${JSON.stringify(initial)}`);
  }

  await page.locator("#taskFamily").selectOption("classification");
  await page.locator("#representationMode").selectOption("tokens");
  await page.locator("#objectiveType").selectOption("cross_entropy");
  await setRange(page, "#dataSize", "4");
  await setRange(page, "#modelCapacity", "2.45");
  await setRange(page, "#dataNoise", "0.86");
  await page.click("#trainModel");
  await page.waitForTimeout(140);
  const overfit = await page.evaluate(() => window.__g32LabSnapshot());
  requireChanged(initial, overfit, [
    "dataSampleHash",
    "representationEncoderHash",
    "objectiveLossHash",
    "optimizerTrajectoryHash",
    "trainValSplitHash",
    "generalizationGapHash",
    "calibrationReliabilityHash"
  ], "G32 train overfit");
  if (overfit.generalizationGap < 0.25 || overfit.trainingLoss >= overfit.validationLoss || !/training|generalization gap|overfit|empirical risk/i.test(overfit.stateText)) {
    throw new Error(`G32 training must expose empirical-vs-expected risk and overfit gap: ${JSON.stringify(overfit)}`);
  }

  await setRange(page, "#dataSize", "15");
  await setRange(page, "#biasMatch", "0.92");
  await page.click("#buildBaseline");
  await page.waitForTimeout(140);
  const baseline = await page.evaluate(() => window.__g32LabSnapshot());
  if (baseline.inductiveBiasHash === overfit.inductiveBiasHash || !(baseline.generalizationGap < overfit.generalizationGap) || !/baseline|inductive bias|representation|ablation/i.test(baseline.stateText)) {
    throw new Error(`G32 baseline view must make matched representation/bias concrete: ${JSON.stringify({ overfit, baseline })}`);
  }

  await setRange(page, "#shiftLevel", "0.88");
  await page.click("#stressTest");
  await page.waitForTimeout(140);
  const stress = await page.evaluate(() => window.__g32LabSnapshot());
  if (stress.deploymentRiskHash === baseline.deploymentRiskHash || stress.calibrationReliabilityHash === baseline.calibrationReliabilityHash || !(stress.deploymentRisk > baseline.deploymentRisk) || !/distribution shift|calibration|deployment|stress/i.test(stress.stateText)) {
    throw new Error(`G32 stress test must show reliability and deployment-risk objects: ${JSON.stringify({ baseline, stress })}`);
  }

  await page.click("#runAgentLoop");
  await page.waitForTimeout(160);
  const agent = await page.evaluate(() => window.__g32LabSnapshot());
  if (agent.agentLoopHash === stress.agentLoopHash || agent.monitoringHash === stress.monitoringHash || agent.agentLoopDepth < 2 || !/agent|tool|reward|feedback|verification|monitoring/i.test(agent.stateText)) {
    throw new Error(`G32 agent loop must expose tools, reward, feedback, verification, and monitoring: ${JSON.stringify(agent)}`);
  }
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 980, height: 720 } });
  try {
    await testG30(page);
    await page.setViewportSize({ width: 900, height: 700 });
    await testG32(page);
  } finally {
    await browser.close();
  }
  console.log("g30-g32 canonical clarity passed: heterophily and AI-foundations labs expose canonical objects, hashes, controls, orbit, and fit.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
