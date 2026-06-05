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
const CLARITY_VERSION = "g06-g07-canonical-clarity-v1";

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

async function testG06(page) {
  const result = await loadLab(page, "g06-higher-order-gnn-lab.html", "__g06LabReady", "__g06LabSnapshot");
  requireFit(result, "G06 desktop");
  await requireOrbit(page, "__g06LabSnapshot");
  const initial = result.snapshot;
  if (result.bytes < 13000 || initial.clarityVersion !== CLARITY_VERSION || initial.labId !== "g06" || initial.has3d !== true) {
    throw new Error(`G06 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    wlBaselineObjectCount: 12,
    pairTensorObjectCount: 72,
    coordinateReplacementObjectCount: 8,
    ringTraceWalkObjectCount: 12,
    adjacencyPowerObjectCount: 18,
    triangleMotifObjectCount: 2,
    subgraphSamplerObjectCount: 12,
    subgraphCoverageObjectCount: 2,
    tupleCostObjectCount: 4,
    liftPipelineObjectCount: 4
  }, "G06");
  requireFields(initial, [
    "wlFailureHash",
    "pairTensorHash",
    "coordinateReplacementHash",
    "ringTraceHash",
    "adjacencyPowerHash",
    "triangleMotifHash",
    "subgraphSamplerHash",
    "subgraphCoverageHash",
    "tupleCostHash",
    "liftPipelineHash"
  ], "G06");
  if (initial.graphAName !== "C6" || initial.graphBName !== "K3+K3" || initial.cycleTriangleCount !== 0 || initial.twoTriangleCount !== 2) {
    throw new Error(`G06 must expose the canonical C6 vs two-triangles example: ${JSON.stringify(initial)}`);
  }

  await page.locator("#liftMode").selectOption("triangles");
  await setRange(page, "#tupleOrder", "3");
  await setRange(page, "#updateRounds", "5");
  await setRange(page, "#sparsification", "0.08");
  await setRange(page, "#motifBudget", "10");
  await page.click("#showTriangles");
  await page.click("#sampleSubgraphs");
  await page.click("#compareCost");
  await page.waitForTimeout(140);
  const after = await page.evaluate(() => window.__g06LabSnapshot());
  requireChanged(initial, after, [
    "wlFailureHash",
    "pairTensorHash",
    "coordinateReplacementHash",
    "ringTraceHash",
    "adjacencyPowerHash",
    "triangleMotifHash",
    "subgraphSamplerHash",
    "subgraphCoverageHash",
    "tupleCostHash",
    "liftPipelineHash"
  ], "G06");
  if (after.phase !== "cost" || after.tupleOrder !== 3 || after.triangleGraphTrace !== 12 || after.subgraphCoverage <= initial.subgraphCoverage) {
    throw new Error(`G06 controls did not drive higher-order evidence: ${JSON.stringify(after)}`);
  }
  if (!/k-WL|2-WL|Ring-GNN|A\^3|subgraph|O\(n\^k\)|triangle/i.test(after.stateText)) {
    throw new Error(`G06 explanation lost canonical terms: ${after.stateText}`);
  }
}

async function testG07(page) {
  const result = await loadLab(page, "g07-link-graph-readout-lab.html", "__g07LabReady", "__g07LabSnapshot");
  requireFit(result, "G07 desktop");
  await requireOrbit(page, "__g07LabSnapshot");
  const initial = result.snapshot;
  if (result.bytes < 13000 || initial.clarityVersion !== CLARITY_VERSION || initial.labId !== "g07" || initial.has3d !== true) {
    throw new Error(`G07 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    sharedEncoderObjectCount: 3,
    candidatePairObjectCount: 1,
    pairFeatureObjectCount: 4,
    heuristicFeatureObjectCount: 3,
    negativeSamplerObjectCount: 8,
    splitBarrierObjectCount: 1,
    readoutPoolingObjectCount: 8,
    sealSubgraphObjectCount: 5,
    diffPoolAssignmentObjectCount: 12,
    diffPoolMatrixObjectCount: 9
  }, "G07");
  requireFields(initial, [
    "sharedEncoderHash",
    "candidateDecoderHash",
    "pairFeatureHash",
    "heuristicFeatureHash",
    "negativeSamplerHash",
    "splitBarrierHash",
    "readoutPoolingHash",
    "sealSubgraphHash",
    "diffPoolAssignmentHash",
    "diffPoolMatrixHash"
  ], "G07");
  if (!Array.isArray(initial.candidatePairIds) || initial.candidatePairIds.join("-") !== "3-9" || initial.commonNeighborCount < 1) {
    throw new Error(`G07 must expose the target pair and its structural evidence: ${JSON.stringify(initial)}`);
  }

  await page.locator("#decoderMode").selectOption("seal");
  await page.locator("#readoutMode").selectOption("attention");
  await page.locator("#splitMode").selectOption("temporal");
  await setRange(page, "#messageDepth", "4");
  await setRange(page, "#decoderGain", "1.85");
  await setRange(page, "#negativeHardness", "1.2");
  await setRange(page, "#candidateBudget", "10");
  await setRange(page, "#readoutSharpness", "1.1");
  await page.click("#scoreLink");
  await page.click("#sampleNegatives");
  await page.click("#poolGraph");
  await page.click("#diffPoolStep");
  await page.waitForTimeout(140);
  const after = await page.evaluate(() => window.__g07LabSnapshot());
  requireChanged(initial, after, [
    "sharedEncoderHash",
    "candidateDecoderHash",
    "pairFeatureHash",
    "heuristicFeatureHash",
    "negativeSamplerHash",
    "splitBarrierHash",
    "readoutPoolingHash",
    "sealSubgraphHash",
    "diffPoolAssignmentHash",
    "diffPoolMatrixHash"
  ], "G07");
  if (after.phase !== "hierarchy" || after.decoderMode !== "seal" || after.readoutMode !== "attention" || after.splitMode !== "temporal") {
    throw new Error(`G07 controls did not activate the requested heads: ${JSON.stringify(after)}`);
  }
  if (after.hardNegativeCount < 1 || after.assignmentEntropy <= 0 || after.jaccardScore <= 0 || after.adamicAdarScore <= 0) {
    throw new Error(`G07 metrics do not expose link/readout evidence: ${JSON.stringify(after)}`);
  }
  if (!/SEAL|enclosing subgraph|negative|readout|DiffPool|S\^T A S|temporal/i.test(after.stateText)) {
    throw new Error(`G07 explanation lost canonical terms: ${after.stateText}`);
  }
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 980, height: 720 } });
  try {
    await testG06(page);
    await page.setViewportSize({ width: 900, height: 700 });
    await testG07(page);
  } finally {
    await browser.close();
  }
  console.log("g06-g07 canonical clarity passed: higher-order GNN and link/readout labs expose canonical objects, hashes, controls, orbit, and fit.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
