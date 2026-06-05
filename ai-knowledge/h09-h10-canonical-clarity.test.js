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
const CLARITY_VERSION = "h09-h10-canonical-clarity-v1";

async function loadLab(page, fileName, readyName, snapshotName) {
  const labPath = path.join(__dirname, fileName).replace(/\\/g, "/");
  await page.goto(`file:///${labPath}`, { waitUntil: "domcontentloaded" });
  await page.locator(".lab-viewport canvas#canvas").waitFor({ state: "visible" });
  await page.waitForFunction(
    ([ready, snapshot]) => window[ready] === true && typeof window[snapshot] === "function" && window[snapshot](),
    [readyName, snapshotName]
  );
  await page.waitForTimeout(180);
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

async function testH09(page) {
  const result = await loadLab(page, "h09-connection-laplacian-transport-lab.html", "__h09LabReady", "__h09LabSnapshot");
  requireFit(result, "H09 desktop");
  const initial = result.snapshot;
  if (result.bytes < 12000 || initial.clarityVersion !== CLARITY_VERSION || initial.labId !== "h09" || initial.has3d !== true) {
    throw new Error(`H09 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    localFrameObjectCount: 4,
    frameAxisObjectCount: 8,
    vectorArrowObjectCount: 6,
    transportPathObjectCount: 4,
    connectionMatrixObjectCount: 16,
    holonomyObjectCount: 1,
    gaugeRingObjectCount: 1
  }, "H09");
  requireFields(initial, [
    "localFrameHash",
    "frameAxisHash",
    "vectorTransportHash",
    "transportPathHash",
    "connectionMatrixHash",
    "holonomyDiscHash",
    "gaugeRingHash",
    "canonicalReferences",
    "connectionObjects",
    "diagnosticMetrics"
  ], "H09");
  requireIncludes(initial, "connectionObjects", ["local_frame", "so2_transport", "parallel_vector", "loop_holonomy", "connection_laplacian_block", "gauge_action"], "H09");
  requireIncludes(initial, "diagnosticMetrics", ["holonomy_angle", "transport_norm", "orthogonality_error", "connection_energy", "curvature_defect"], "H09");

  await page.locator("#preset").selectOption("noisy");
  await page.locator("#view").selectOption("matrix");
  await setRange(page, "#loopTraversals", "6");
  await setRange(page, "#rotationScale", "1.35");
  await setRange(page, "#frameNoise", "0.42");
  await setRange(page, "#visibleTransports", "3");
  await setRange(page, "#normLock", "0.92");
  const configured = await page.evaluate(() => window.__h09LabSnapshot());
  if (configured.preset !== "noisy" || configured.visibleTransportCount !== 3 || !/local frames|orthogonal matrices|connection-Laplacian/i.test(configured.stateText)) {
    throw new Error(`H09 controls did not expose connection telemetry: ${JSON.stringify(configured)}`);
  }
  requireChanged(initial, configured, ["frameAxisHash", "transportPathHash", "connectionMatrixHash", "holonomyDiscHash"], "H09 controls", 3);

  await page.locator("#transportVector").click();
  await page.waitForFunction(() => window.__h09LabSnapshot().status === "Transported" && window.__h09LabSnapshot().transportCursor === 1);
  const transported = await page.evaluate(() => window.__h09LabSnapshot());
  if (!/orthogonal matrix|preserved vector norm/i.test(transported.stateText)) {
    throw new Error(`H09 transport action is not explicit: ${JSON.stringify(transported)}`);
  }
  requireChanged(configured, transported, ["localFrameHash", "vectorTransportHash", "transportPathHash"], "H09 vector transport", 2);

  await page.locator("#runLoop").click();
  await page.waitForFunction(() => window.__h09LabSnapshot().status === "Loop holonomy" && Math.abs(window.__h09LabSnapshot().holonomyAngle) > 10);
  const holonomy = await page.evaluate(() => window.__h09LabSnapshot());
  if (!/product of transports|holonomy/i.test(holonomy.stateText)) {
    throw new Error(`H09 loop holonomy is not explicit: ${JSON.stringify(holonomy)}`);
  }
  requireChanged(transported, holonomy, ["vectorTransportHash", "holonomyDiscHash", "gaugeRingHash"], "H09 loop holonomy", 2);

  const beforeEnergy = holonomy.energy;
  await page.locator("#diffuse").click();
  await page.waitForFunction((previous) => window.__h09LabSnapshot().status === "Diffused" && window.__h09LabSnapshot().energy < previous, beforeEnergy);
  const diffused = await page.evaluate(() => window.__h09LabSnapshot());
  requireChanged(holonomy, diffused, ["connectionMatrixHash", "transportPathHash", "holonomyDiscHash"], "H09 diffusion", 2);

  await page.locator("#gaugeShift").click();
  await page.waitForFunction(() => window.__h09LabSnapshot().status === "Gauge shifted");
  const gauge = await page.evaluate(() => window.__h09LabSnapshot());
  if (!/gauge change|conjugates transports|energy stays invariant/i.test(gauge.stateText)) {
    throw new Error(`H09 gauge action is not explicit: ${JSON.stringify(gauge)}`);
  }
  requireChanged(diffused, gauge, ["frameAxisHash", "transportPathHash", "gaugeRingHash"], "H09 gauge action", 2);
}

async function testH10(page) {
  const result = await loadLab(page, "h10-heterophily-restriction-lab.html", "__h10LabReady", "__h10LabSnapshot");
  requireFit(result, "H10 desktop");
  const initial = result.snapshot;
  if (result.bytes < 12000 || initial.clarityVersion !== CLARITY_VERSION || initial.labId !== "h10" || initial.has3d !== true) {
    throw new Error(`H10 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    roleNodeObjectCount: 6,
    roleFeatureTowerObjectCount: 12,
    edgeRelationObjectCount: 7,
    edgeStalkPlateObjectCount: 5,
    restrictionMapObjectCount: 10,
    compatibilityMatrixObjectCount: 9,
    residualObjectCount: 5,
    energyBarObjectCount: 5
  }, "H10");
  requireFields(initial, [
    "roleNodeHash",
    "roleFeatureTowerHash",
    "edgeRelationHash",
    "edgeStalkHash",
    "restrictionMapHash",
    "compatibilityMatrixHash",
    "rawSmoothingLaneHash",
    "sheafCompatibilityLaneHash",
    "residualHash",
    "energyBarHash",
    "canonicalReferences",
    "heterophilyObjects",
    "diagnosticMetrics"
  ], "H10");
  requireIncludes(initial, "heterophilyObjects", ["role_graph", "compatibility_matrix", "signed_restriction_map", "edge_stalk_relation", "raw_laplacian_smoothing", "sheaf_energy"], "H10");
  requireIncludes(initial, "diagnosticMetrics", ["homophily_ratio", "map_agreement", "raw_energy", "sheaf_energy", "role_accuracy", "oversmoothing"], "H10");

  await page.locator("#scenario").selectOption("mixed");
  await page.locator("#relationFamily").selectOption("projection");
  await page.locator("#view").selectOption("sheaf");
  await setRange(page, "#propagationRounds", "8");
  await setRange(page, "#compatibilitySharpness", "1.5");
  await setRange(page, "#relationNoise", "0.3");
  await setRange(page, "#relationTypes", "6");
  await setRange(page, "#roleIdentity", "0.74");
  const configured = await page.evaluate(() => window.__h10LabSnapshot());
  if (configured.scenario !== "mixed" || configured.relationFamily !== "projection" || configured.activeRelationTypeCount !== 6) {
    throw new Error(`H10 controls did not expose heterophily configuration: ${JSON.stringify(configured)}`);
  }
  requireChanged(initial, configured, ["roleFeatureTowerHash", "edgeStalkHash", "restrictionMapHash", "compatibilityMatrixHash", "rawSmoothingLaneHash", "energyBarHash"], "H10 controls", 4);

  const beforeLearn = configured.sheafEnergy;
  await page.locator("#learnRelations").click();
  await page.waitForFunction(() => window.__h10LabSnapshot().status === "Relations learned" && window.__h10LabSnapshot().mapAgreement > 0.82);
  const learned = await page.evaluate(() => window.__h10LabSnapshot());
  if (learned.sheafEnergy >= beforeLearn || !/compatibility matrix|edge-stalk comparison/i.test(learned.stateText)) {
    throw new Error(`H10 relation learning is not concrete: ${JSON.stringify(learned)}`);
  }
  requireChanged(configured, learned, ["compatibilityMatrixHash", "restrictionMapHash", "edgeStalkHash", "energyBarHash"], "H10 learned relations", 3);

  const beforeSheaf = learned.sheafEnergy;
  await page.locator("#stepSheaf").click();
  await page.waitForFunction((previous) => window.__h10LabSnapshot().status === "Sheaf stepped" && window.__h10LabSnapshot().sheafEnergy < previous, beforeSheaf);
  const sheaf = await page.evaluate(() => window.__h10LabSnapshot());
  if (!/B_u x_u and B_v x_v|edge-stalk/i.test(sheaf.stateText)) {
    throw new Error(`H10 sheaf step is not explicit: ${JSON.stringify(sheaf)}`);
  }
  requireChanged(learned, sheaf, ["sheafCompatibilityLaneHash", "residualHash", "energyBarHash"], "H10 sheaf step", 2);

  await page.locator("#runGraph").click();
  await page.waitForFunction(() => window.__h10LabSnapshot().status === "Graph smoothed" && window.__h10LabSnapshot().graphStepCount > 0);
  const graph = await page.evaluate(() => window.__h10LabSnapshot());
  if (graph.oversmoothing <= sheaf.oversmoothing || !/raw Laplacian smoothing|over-smoothing/i.test(graph.stateText)) {
    throw new Error(`H10 graph baseline did not expose heterophily collapse: ${JSON.stringify(graph)}`);
  }
  requireChanged(sheaf, graph, ["rawSmoothingLaneHash", "roleFeatureTowerHash", "energyBarHash"], "H10 raw graph smoothing", 2);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 700 } });
  try {
    await testH09(page);
    await testH10(page);
    console.log("H09/H10 canonical clarity checks passed");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
