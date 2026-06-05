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
const CLARITY_VERSION = "g04-g05-canonical-clarity-v1";

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

async function testG04(page) {
  let result = await loadLab(page, "g04-graphsage-sampling-lab.html", "__g04LabReady", "__g04LabSnapshot");
  requireFit(result, "G04 desktop");
  await requireOrbit(page, "__g04LabSnapshot");
  const initial = result.snapshot;
  if (result.bytes < 13000 || initial.clarityVersion !== CLARITY_VERSION || initial.labId !== "g04" || initial.has3d !== true) {
    throw new Error(`G04 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    graphNodeObjectCount: 18,
    graphEdgeObjectCount: 28,
    sampledEdgeObjectCount: 8,
    fanoutConeObjectCount: 4,
    receptiveFieldLayerObjectCount: 3,
    aggregatorPipelineObjectCount: 4,
    varianceEstimatorObjectCount: 8,
    inductiveFeatureObjectCount: 3,
    contrastiveObjectCount: 5,
    coverageCostObjectCount: 2,
    embeddingOutputObjectCount: 1
  }, "G04");
  requireFields(initial, [
    "sampledNeighborhoodHash",
    "fanoutConeHash",
    "receptiveFieldHash",
    "aggregatorPipelineHash",
    "targetCombineHash",
    "varianceEstimatorHash",
    "coverageCostHash",
    "inductiveNodeHash",
    "contrastiveSplitHash",
    "embeddingOutputHash",
    "featureProjectionHash",
    "sampleBudgetHash"
  ], "G04");

  await page.locator("#aggregator").selectOption("pool");
  await page.locator("#graphDomain").selectOption("fraud");
  await page.locator("#viewSelect").selectOption("contrastive");
  await setRange(page, "#depth", "3");
  await setRange(page, "#fanout", "8");
  await setRange(page, "#sampleNoise", "0.32");
  await setRange(page, "#aggregatorGain", "1.45");
  await setRange(page, "#targetCarry", "0.68");
  await page.click("#sampleNeighbors");
  await page.click("#aggregate");
  await page.click("#newNode");
  await page.click("#contrastiveSplit");
  await page.waitForTimeout(130);
  const after = await page.evaluate(() => window.__g04LabSnapshot());
  requireChanged(initial, after, [
    "sampledNeighborhoodHash",
    "fanoutConeHash",
    "receptiveFieldHash",
    "aggregatorPipelineHash",
    "targetCombineHash",
    "varianceEstimatorHash",
    "coverageCostHash",
    "inductiveNodeHash",
    "contrastiveSplitHash",
    "embeddingOutputHash",
    "featureProjectionHash",
    "sampleBudgetHash"
  ], "G04");
  if (after.phase !== "contrastive" || after.inductiveNode !== true || after.negativeCount <= 0 || after.coverage <= initial.coverage) {
    throw new Error(`G04 controls did not drive GraphSAGE sampling: ${JSON.stringify(after)}`);
  }
  if (!/GraphSAGE|fanout|sample|aggregator|inductive|contrastive/i.test(after.stateText)) {
    throw new Error(`G04 explanation lost canonical terms: ${after.stateText}`);
  }
}

async function testG05(page) {
  let result = await loadLab(page, "g05-wl-color-refinement-lab.html", "__g05LabReady", "__g05LabSnapshot");
  requireFit(result, "G05 desktop");
  await requireOrbit(page, "__g05LabSnapshot");
  const initial = result.snapshot;
  if (result.bytes < 13000 || initial.clarityVersion !== CLARITY_VERSION || initial.labId !== "g05" || initial.has3d !== true) {
    throw new Error(`G05 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    graphPairObjectCount: 2,
    wlNodeObjectCount: 12,
    wlEdgeObjectCount: 12,
    colorTokenObjectCount: 12,
    histogramObjectCount: 12,
    multisetSignatureObjectCount: 6,
    hashBucketObjectCount: 5,
    aggregatorCollisionObjectCount: 4,
    seedObjectCount: 1,
    stableRoundObjectCount: 1
  }, "G05");
  requireFields(initial, [
    "graphPairHash",
    "wlColorHash",
    "multisetTokenHash",
    "signatureHash",
    "histogramHash",
    "seedSymmetryHash",
    "aggregatorCollisionHash",
    "ginUpdateHash",
    "stableRoundHash",
    "hashCapacityHash",
    "selfRetentionHash",
    "graphReadoutHash"
  ], "G05");

  await page.locator("#graphPair").selectOption("seeded");
  await page.locator("#initialLabels").selectOption("oneSeed");
  await page.locator("#aggregator").selectOption("gin");
  await setRange(page, "#roundBudget", "5");
  await setRange(page, "#hashSharpness", "2.2");
  await setRange(page, "#seedStrength", "1");
  await setRange(page, "#colorCapacity", "9");
  await setRange(page, "#selfWeight", "0.9");
  await page.click("#refineColors");
  await page.click("#seedFeature");
  await page.click("#compareAggregators");
  await page.click("#runToStable");
  await page.waitForTimeout(130);
  const after = await page.evaluate(() => window.__g05LabSnapshot());
  requireChanged(initial, after, [
    "graphPairHash",
    "wlColorHash",
    "multisetTokenHash",
    "signatureHash",
    "histogramHash",
    "seedSymmetryHash",
    "aggregatorCollisionHash",
    "ginUpdateHash",
    "stableRoundHash",
    "hashCapacityHash",
    "selfRetentionHash",
    "graphReadoutHash"
  ], "G05");
  if (after.phase !== "stable" || after.seeded !== true || after.histogramStable !== true || after.colorClasses <= initial.colorClasses) {
    throw new Error(`G05 controls did not drive WL refinement: ${JSON.stringify(after)}`);
  }
  if (!/WL|Weisfeiler|color|multiset|hash|histogram|GIN/i.test(after.stateText)) {
    throw new Error(`G05 explanation lost canonical terms: ${after.stateText}`);
  }
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 980, height: 720 } });
  try {
    await testG04(page);
    await page.setViewportSize({ width: 900, height: 700 });
    await testG05(page);
  } finally {
    await browser.close();
  }
  console.log("g04-g05 canonical clarity passed: GraphSAGE and WL expose canonical objects, hashes, controls, orbit, and fit.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
