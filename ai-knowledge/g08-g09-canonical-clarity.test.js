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
const CLARITY_VERSION = "g08-g09-canonical-clarity-v1";

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

async function testG08(page) {
  const result = await loadLab(page, "g08-scalable-gnn-sampling-lab.html", "__g08LabReady", "__g08LabSnapshot");
  requireFit(result, "G08 desktop");
  await requireOrbit(page, "__g08LabSnapshot");
  const initial = result.snapshot;
  if (result.bytes < 13000 || initial.clarityVersion !== CLARITY_VERSION || initial.labId !== "g08" || initial.has3d !== true) {
    throw new Error(`G08 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    fullGraphObjectCount: 36,
    targetBatchObjectCount: 2,
    fanoutLayerObjectCount: 5,
    sampledBlockObjectCount: 3,
    clusterPartitionObjectCount: 4,
    boundaryCutObjectCount: 6,
    graphSaintWalkObjectCount: 8,
    normalizationWeightObjectCount: 3,
    estimatorBoardObjectCount: 10,
    inferenceCacheObjectCount: 4
  }, "G08");
  requireFields(initial, [
    "fullGraphHash",
    "targetBatchHash",
    "fanoutTreeHash",
    "sampledBlockHash",
    "clusterPartitionHash",
    "boundaryCutHash",
    "graphSaintWalkHash",
    "normalizationWeightHash",
    "estimatorBoardHash",
    "inferenceCacheHash"
  ], "G08");
  if (initial.neighborExplosionBound <= initial.targetBatch || initial.samplingFormula !== "1+S+S^2+...") {
    throw new Error(`G08 must expose fanout explosion formula and bounded minibatch: ${JSON.stringify(initial)}`);
  }

  await page.locator("#samplingStrategy").selectOption("walk");
  await page.locator("#graphRegime").selectOption("hub");
  await page.locator("#viewSelect").selectOption("budget");
  await setRange(page, "#depth", "4");
  await setRange(page, "#fanout", "5");
  await setRange(page, "#gradientNoise", "1.25");
  await setRange(page, "#batchBudget", "24");
  await setRange(page, "#cacheReuse", "0.82");
  await page.click("#sampleNeighbors");
  await page.click("#walkSubgraph");
  await page.click("#compareBudget");
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => window.__g08LabSnapshot());
  requireChanged(initial, after, [
    "targetBatchHash",
    "fanoutTreeHash",
    "sampledBlockHash",
    "clusterPartitionHash",
    "boundaryCutHash",
    "graphSaintWalkHash",
    "normalizationWeightHash",
    "estimatorBoardHash",
    "inferenceCacheHash"
  ], "G08");
  if (after.phase !== "budget" || after.depth !== 4 || after.fanout !== 5 || after.neighborExplosionBound <= initial.neighborExplosionBound) {
    throw new Error(`G08 controls did not drive scalable sampling: ${JSON.stringify(after)}`);
  }
  if (!/GraphSAINT|Cluster-GCN|fanout|minibatch|estimator|cache|inference/i.test(after.stateText)) {
    throw new Error(`G08 explanation lost canonical terms: ${after.stateText}`);
  }
}

async function testG09(page) {
  const result = await loadLab(page, "g09-temporal-gnn-memory-lab.html", "__g09LabReady", "__g09LabSnapshot");
  requireFit(result, "G09 desktop");
  await requireOrbit(page, "__g09LabSnapshot");
  const initial = result.snapshot;
  if (result.bytes < 13000 || initial.clarityVersion !== CLARITY_VERSION || initial.labId !== "g09" || initial.has3d !== true) {
    throw new Error(`G09 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    eventTimelineObjectCount: 18,
    memoryCellObjectCount: 9,
    messageFunctionObjectCount: 4,
    timeEncodingObjectCount: 6,
    causalBoundaryObjectCount: 1,
    leakageGhostObjectCount: 3,
    temporalAttentionObjectCount: 8,
    memoryUpdateGateObjectCount: 3,
    snapshotWindowObjectCount: 4,
    negativeSamplerObjectCount: 4
  }, "G09");
  requireFields(initial, [
    "eventTimelineHash",
    "memoryCellHash",
    "messageFunctionHash",
    "timeEncodingHash",
    "causalBoundaryHash",
    "leakageGhostHash",
    "temporalAttentionHash",
    "memoryUpdateGateHash",
    "snapshotWindowHash",
    "negativeSamplerHash"
  ], "G09");
  if (initial.queryPairIds.join("-") !== "2-7" || initial.predictionOrder !== "predict-before-update") {
    throw new Error(`G09 must expose the query pair and causal prediction order: ${JSON.stringify(initial)}`);
  }

  await page.locator("#scenarioMode").selectOption("payments");
  await page.locator("#aggregatorMode").selectOption("attention");
  await page.locator("#splitMode").selectOption("leaky");
  await setRange(page, "#eventCursor", "12");
  await setRange(page, "#memoryGate", "0.9");
  await setRange(page, "#decayRate", "0.78");
  await setRange(page, "#historyWindow", "8");
  await setRange(page, "#attentionSharpness", "1.35");
  await page.click("#processEvent");
  await page.click("#predictBefore");
  await page.click("#showLeakage");
  await page.click("#attentionReplay");
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => window.__g09LabSnapshot());
  requireChanged(initial, after, [
    "eventTimelineHash",
    "memoryCellHash",
    "messageFunctionHash",
    "timeEncodingHash",
    "causalBoundaryHash",
    "leakageGhostHash",
    "temporalAttentionHash",
    "memoryUpdateGateHash",
    "snapshotWindowHash",
    "negativeSamplerHash"
  ], "G09");
  if (after.phase !== "attention" || after.aggregatorMode !== "attention" || after.currentTime <= initial.currentTime || after.futureLeakage !== false) {
    throw new Error(`G09 controls did not drive temporal memory safely: ${JSON.stringify(after)}`);
  }
  if (after.leakageGap <= 0 || after.timeEncodingDimension < 6 || after.attentionPeak <= initial.attentionPeak) {
    throw new Error(`G09 temporal metrics are too weak: ${JSON.stringify(after)}`);
  }
  if (!/TGN|TGAT|memory|delta t|causal|future|attention|predict before/i.test(after.stateText)) {
    throw new Error(`G09 explanation lost canonical terms: ${after.stateText}`);
  }
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 980, height: 720 } });
  try {
    await testG08(page);
    await page.setViewportSize({ width: 900, height: 700 });
    await testG09(page);
  } finally {
    await browser.close();
  }
  console.log("g08-g09 canonical clarity passed: scalable and temporal GNN labs expose canonical objects, hashes, controls, orbit, and fit.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
