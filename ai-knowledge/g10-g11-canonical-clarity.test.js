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
      // Try the next known runtime path.
    }
  }

  throw new Error(`Unable to load Playwright from: ${candidates.join(", ")}`);
}

const { chromium } = loadPlaywright();
const CLARITY_VERSION = "g10-g11-canonical-clarity-v1";

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

async function testG10(page) {
  const result = await loadLab(page, "g10-equivariance-transform-lab.html", "__g10LabReady", "__g10LabSnapshot");
  requireFit(result, "G10 desktop");
  await requireOrbit(page, "__g10LabSnapshot");
  const initial = result.snapshot;
  if (result.bytes < 13000 || initial.clarityVersion !== CLARITY_VERSION || initial.labId !== "g10" || initial.has3d !== true) {
    throw new Error(`G10 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    originalMoleculeObjectCount: 6,
    transformedMoleculeObjectCount: 6,
    groupActionObjectCount: 3,
    invariantScalarObjectCount: 4,
    equivariantVectorObjectCount: 6,
    relativeDistanceObjectCount: 5,
    egnnMessageObjectCount: 4,
    tensorTypeObjectCount: 3,
    chiralityProbeObjectCount: 1,
    symmetryErrorObjectCount: 4
  }, "G10");
  requireFields(initial, [
    "originalGeometryHash",
    "transformedGeometryHash",
    "groupActionHash",
    "invariantScalarHash",
    "equivariantVectorHash",
    "relativeDistanceHash",
    "egnnMessageHash",
    "tensorTypeHash",
    "chiralityProbeHash",
    "symmetryErrorHash",
    "predictionTargetTypes",
    "outputRule",
    "architectureMode"
  ], "G10");
  if (!initial.predictionTargetTypes.includes("energy") || !initial.predictionTargetTypes.includes("force")) {
    throw new Error(`G10 must expose scalar energy and vector force targets: ${JSON.stringify(initial)}`);
  }

  await page.locator("#transformType").selectOption("rotation");
  await page.locator("#architectureMode").selectOption("egnn");
  await setRange(page, "#transformAngle", "84");
  await setRange(page, "#frameSamples", "11");
  await setRange(page, "#invariantMix", "0.88");
  await page.click("#applyTransform");
  await page.click("#testInvariant");
  await page.click("#testEquivariant");
  await page.waitForTimeout(160);
  const after = await page.evaluate(() => window.__g10LabSnapshot());
  requireChanged(initial, after, [
    "transformedGeometryHash",
    "groupActionHash",
    "invariantScalarHash",
    "equivariantVectorHash",
    "relativeDistanceHash",
    "egnnMessageHash",
    "tensorTypeHash",
    "symmetryErrorHash"
  ], "G10");
  if (after.phase !== "equivariant" || after.equivarianceError >= 0.12 || after.distanceDrift > 0.03) {
    throw new Error(`G10 EGNN rigid-motion controls should preserve distances and rotate forces: ${JSON.stringify(after)}`);
  }
  if (!/EGNN|relative vector|SE\(3\)|E\(3\)|force|energy|equivariant|invariant/i.test(after.stateText)) {
    throw new Error(`G10 explanation lost canonical symmetry terms: ${after.stateText}`);
  }

  await page.locator("#transformType").selectOption("reflection");
  await page.locator("#architectureMode").selectOption("distances");
  await page.click("#testInvariant");
  await page.waitForTimeout(120);
  const reflected = await page.evaluate(() => window.__g10LabSnapshot());
  if (reflected.chiralitySignal <= 0 || reflected.chiralityProbeHash === after.chiralityProbeHash || !/chirality|reflection|distance/i.test(reflected.stateText)) {
    throw new Error(`G10 reflection must make the chirality caveat visible: ${JSON.stringify(reflected)}`);
  }
}

async function testG11(page) {
  const result = await loadLab(page, "g11-geometric-domain-symmetry-lab.html", "__g11LabReady", "__g11LabSnapshot");
  requireFit(result, "G11 desktop");
  await requireOrbit(page, "__g11LabSnapshot");
  const initial = result.snapshot;
  if (result.bytes < 13000 || initial.clarityVersion !== CLARITY_VERSION || initial.labId !== "g11" || initial.has3d !== true) {
    throw new Error(`G11 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    domainAtlasObjectCount: 5,
    gridOperatorObjectCount: 4,
    setPoolingObjectCount: 4,
    graphMessageObjectCount: 6,
    manifoldPatchObjectCount: 3,
    gaugeFrameObjectCount: 3,
    geodesicDiffusionObjectCount: 4,
    symmetryTestObjectCount: 3,
    readoutObjectCount: 3,
    operatorTableObjectCount: 5
  }, "G11");
  requireFields(initial, [
    "domainAtlasHash",
    "gridOperatorHash",
    "setPoolingHash",
    "graphMessageHash",
    "manifoldPatchHash",
    "gaugeFrameHash",
    "geodesicDiffusionHash",
    "symmetryTestHash",
    "readoutHash",
    "operatorTableHash",
    "blueprintDomains",
    "symmetryName",
    "operatorMode",
    "outputType"
  ], "G11");
  for (const domain of ["grids", "groups", "graphs", "geodesics", "gauges"]) {
    if (!initial.blueprintDomains.includes(domain)) {
      throw new Error(`G11 must expose the 5G blueprint domain ${domain}: ${JSON.stringify(initial)}`);
    }
  }

  await page.locator("#domainSelect").selectOption("graph");
  await page.locator("#operatorSelect").selectOption("message");
  await page.locator("#outputType").selectOption("equivariant");
  await setRange(page, "#operatorDepth", "6");
  await setRange(page, "#localityRadius", "2.2");
  await page.click("#applySymmetry");
  await page.click("#runOperator");
  await page.waitForTimeout(160);
  const graph = await page.evaluate(() => window.__g11LabSnapshot());
  requireChanged(initial, graph, [
    "domainAtlasHash",
    "gridOperatorHash",
    "setPoolingHash",
    "graphMessageHash",
    "manifoldPatchHash",
    "geodesicDiffusionHash",
    "symmetryTestHash",
    "readoutHash",
    "operatorTableHash"
  ], "G11");
  if (graph.domainMode !== "graph" || graph.operatorMode !== "message" || graph.operatorLocality <= initial.operatorLocality) {
    throw new Error(`G11 graph/message controls should widen the visible operator footprint: ${JSON.stringify(graph)}`);
  }
  if (!/grid|set|graph|manifold|gauge|geodesic|operator|readout|symmetry/i.test(graph.stateText)) {
    throw new Error(`G11 explanation lost the geometric blueprint terms: ${graph.stateText}`);
  }

  await page.locator("#domainSelect").selectOption("manifold");
  await page.locator("#operatorSelect").selectOption("gauge");
  await page.click("#showGauge");
  await page.click("#testReadout");
  await page.waitForTimeout(160);
  const gauge = await page.evaluate(() => window.__g11LabSnapshot());
  if (gauge.localFrameCount < 3 || gauge.transportConsistency <= 0 || gauge.gaugeFrameHash === graph.gaugeFrameHash || !/gauge|frame|transport|manifold|geodesic/i.test(gauge.stateText)) {
    throw new Error(`G11 manifold/gauge mode must expose frame transport and geodesic geometry: ${JSON.stringify(gauge)}`);
  }
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 980, height: 720 } });
  try {
    await testG10(page);
    await page.setViewportSize({ width: 900, height: 700 });
    await testG11(page);
  } finally {
    await browser.close();
  }
  console.log("g10-g11 canonical clarity passed: equivariance and geometric deep learning labs expose canonical objects, hashes, controls, orbit, and fit.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
