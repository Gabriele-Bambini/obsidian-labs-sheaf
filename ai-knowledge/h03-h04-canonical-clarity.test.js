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
      // Try known bundled runtime paths.
    }
  }
  throw new Error(`Unable to load Playwright from: ${candidates.join(", ")}`);
}

const { chromium } = loadPlaywright();
const CLARITY_VERSION = "h03-h04-canonical-clarity-v1";

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
    const stateNode = document.querySelector("#state") || document.querySelector("#stateBox") || document.querySelector(".state-box");
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

async function testH03(page) {
  const result = await loadLab(page, "h03-cellular-sheaf-cohomology.html", "__h03LabReady", "__h03LabSnapshot");
  requireFit(result, "H03 desktop");
  const initial = result.snapshot;
  if (result.bytes < 12000 || initial.clarityVersion !== CLARITY_VERSION || initial.labId !== "h03" || initial.has3d !== true) {
    throw new Error(`H03 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    cellComplexObjectCount: 7,
    vertexStalkObjectCount: 3,
    edgeStalkObjectCount: 3,
    faceStalkObjectCount: 1,
    restrictionMapObjectCount: 6,
    zeroCochainObjectCount: 3,
    oneCochainObjectCount: 3,
    twoCochainObjectCount: 1,
    delta0MatrixObjectCount: 9,
    delta1BoundaryObjectCount: 3,
    kernelH0ObjectCount: 3,
    imageDelta0ObjectCount: 3,
    h1CycleObjectCount: 3,
    harmonicRepresentativeObjectCount: 3,
    quotientWitnessObjectCount: 3
  }, "H03");
  requireFields(initial, [
    "cellComplexHash",
    "vertexStalkHash",
    "edgeStalkHash",
    "faceStalkHash",
    "restrictionMapHash",
    "zeroCochainHash",
    "oneCochainHash",
    "twoCochainHash",
    "delta0MatrixHash",
    "delta1BoundaryHash",
    "kernelH0Hash",
    "imageDelta0Hash",
    "h1CycleHash",
    "harmonicRepresentativeHash",
    "quotientWitnessHash",
    "canonicalReferences",
    "cochainObjects",
    "diagnosticMetrics"
  ], "H03");
  requireIncludes(initial, "cochainObjects", ["cell_complex", "stalk", "restriction_map", "cochain", "coboundary_delta0", "coboundary_delta1", "kernel_h0", "quotient_h1"], "H03");
  requireIncludes(initial, "diagnosticMetrics", ["coboundary_norm", "face_circulation", "h0_dimension", "h1_dimension", "harmonic_gap"], "H03");

  await page.locator("#ruleMode").selectOption("rotated");
  await page.locator("#complexMode").selectOption("filled");
  await setRange(page, "#twist", "0.82");
  await setRange(page, "#faceWeight", "1.25");
  await page.click("#computeDelta0");
  await page.waitForFunction(() => window.__h03LabSnapshot().status === "Coboundary");
  const delta0 = await page.evaluate(() => window.__h03LabSnapshot());
  if (!/delta0|edge stalk residuals|coboundary matrix/i.test(delta0.stateText)) {
    throw new Error(`H03 delta0 state is not didactic enough: ${JSON.stringify(delta0)}`);
  }
  requireChanged(initial, delta0, ["restrictionMapHash", "oneCochainHash", "delta0MatrixHash", "imageDelta0Hash"], "H03 delta0", 2);

  await page.click("#harmonize");
  await page.waitForFunction((previous) => window.__h03LabSnapshot().status === "Projected" && window.__h03LabSnapshot().coboundaryNorm < previous, delta0.coboundaryNorm);
  const projected = await page.evaluate(() => window.__h03LabSnapshot());
  if (!/ker delta0|global sections|Harmonization/i.test(projected.stateText)) {
    throw new Error(`H03 harmonization does not expose H0/kernel: ${JSON.stringify(projected)}`);
  }
  requireChanged(delta0, projected, ["kernelH0Hash", "harmonicRepresentativeHash", "imageDelta0Hash"], "H03 H0 projection", 2);

  await page.locator("#complexMode").selectOption("hole");
  await setRange(page, "#circulationDefect", "0.72");
  await page.click("#showCocycle");
  await page.waitForFunction(() => window.__h03LabSnapshot().status === "Cocycle");
  const cocycle = await page.evaluate(() => window.__h03LabSnapshot());
  if (cocycle.h1Dimension !== 1 || !/1-cochain|H1|face circulation|hole/i.test(cocycle.stateText)) {
    throw new Error(`H03 hole cocycle does not expose H1: ${JSON.stringify(cocycle)}`);
  }
  requireChanged(projected, cocycle, ["delta1BoundaryHash", "h1CycleHash", "quotientWitnessHash", "twoCochainHash"], "H03 H1 cocycle", 2);
}

async function testH04(page) {
  const result = await loadLab(page, "h04-cellular-sheaf-on-graph-lab.html", "__h04LabReady", "__h04LabSnapshot");
  requireFit(result, "H04 desktop");
  const initial = result.snapshot;
  if (result.bytes < 12000 || initial.clarityVersion !== CLARITY_VERSION || initial.labId !== "h04" || initial.has3d !== true) {
    throw new Error(`H04 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    graphCellComplexObjectCount: 9,
    nodeStalkColumnObjectCount: 4,
    nodeStalkComponentObjectCount: 8,
    edgeStalkObjectCount: 5,
    incidenceMapObjectCount: 10,
    restrictionMatrixObjectCount: 10,
    coboundaryRowObjectCount: 5,
    incidenceMatrixBlockObjectCount: 20,
    energySurfaceObjectCount: 5,
    globalSectionObjectCount: 4,
    projectionCoordinateObjectCount: 4,
    connectionFrameObjectCount: 4,
    signedCompatibilityObjectCount: 5
  }, "H04");
  requireFields(initial, [
    "graphCellComplexHash",
    "nodeStalkHash",
    "edgeStalkHash",
    "incidenceMapHash",
    "restrictionMatrixHash",
    "coboundaryRowHash",
    "incidenceMatrixBlockHash",
    "energySurfaceHash",
    "globalSectionHash",
    "projectionCoordinateHash",
    "connectionFrameHash",
    "signedCompatibilityHash",
    "canonicalReferences",
    "graphSheafObjects",
    "diagnosticMetrics"
  ], "H04");
  requireIncludes(initial, "graphSheafObjects", ["node_stalk", "edge_stalk", "restriction_matrix", "coboundary_row", "global_section", "projection_sheaf", "connection_sheaf"], "H04");
  requireIncludes(initial, "diagnosticMetrics", ["sheaf_energy", "compatible_edges", "incidence_rank", "restriction_map_count"], "H04");

  await page.locator("#sheafType").selectOption("signed");
  await page.locator("#viewSelect").selectOption("matrix");
  await setRange(page, "#twist", "0.82");
  await setRange(page, "#inconsistency", "0.74");
  await page.click("#computeCoboundary");
  await page.waitForFunction(() => window.__h04LabSnapshot().status === "Coboundary");
  const coboundary = await page.evaluate(() => window.__h04LabSnapshot());
  if (!/delta x|coboundary matrix|edge-stalk residuals/i.test(coboundary.stateText)) {
    throw new Error(`H04 coboundary state is not didactic enough: ${JSON.stringify(coboundary)}`);
  }
  requireChanged(initial, coboundary, ["incidenceMapHash", "restrictionMatrixHash", "coboundaryRowHash", "incidenceMatrixBlockHash", "signedCompatibilityHash"], "H04 coboundary", 3);

  await page.click("#harmonize");
  await page.waitForFunction((previous) => window.__h04LabSnapshot().status === "Projected" && window.__h04LabSnapshot().energy < previous, coboundary.energy);
  const projected = await page.evaluate(() => window.__h04LabSnapshot());
  if (!/global section|edge-stalk residuals|restriction maps/i.test(projected.stateText)) {
    throw new Error(`H04 harmonization does not explain graph-sheaf compatibility: ${JSON.stringify(projected)}`);
  }
  requireChanged(coboundary, projected, ["energySurfaceHash", "globalSectionHash", "coboundaryRowHash"], "H04 harmonization", 2);

  await page.click("#globalSection");
  await page.waitForFunction(() => window.__h04LabSnapshot().status === "Section");
  const section = await page.evaluate(() => window.__h04LabSnapshot());
  if (section.compatibleEdges < 5 || !/kernel of delta|global section/i.test(section.stateText)) {
    throw new Error(`H04 global-section command failed: ${JSON.stringify(section)}`);
  }

  await page.locator("#sheafType").selectOption("projection");
  await setRange(page, "#projection", "0.35");
  await page.click("#computeCoboundary");
  await page.waitForFunction(() => window.__h04LabSnapshot().sheafType === "projection" && window.__h04LabSnapshot().status === "Coboundary");
  const projection = await page.evaluate(() => window.__h04LabSnapshot());
  if (!/projection|visible coordinate|edge stalk/i.test(projection.stateText) || projection.projectionCoordinateHash === section.projectionCoordinateHash) {
    throw new Error(`H04 projection sheaf did not expose coordinate selection: ${JSON.stringify(projection)}`);
  }

  await page.locator("#sheafType").selectOption("connection");
  await setRange(page, "#twist", "0.9");
  await page.click("#computeCoboundary");
  await page.waitForFunction(() => window.__h04LabSnapshot().sheafType === "connection" && window.__h04LabSnapshot().status === "Coboundary");
  const connection = await page.evaluate(() => window.__h04LabSnapshot());
  if (connection.connectionFrameHash === projection.connectionFrameHash || !/connection|frame|restriction/i.test(connection.stateText)) {
    throw new Error(`H04 connection sheaf did not expose local-frame transport: ${JSON.stringify(connection)}`);
  }
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 700 } });
  try {
    await testH03(page);
    await testH04(page);
  } finally {
    await browser.close();
  }
  console.log("h03/h04 canonical clarity passed: cochain-complex and graph-sheaf objects, interactions, hashes, metrics, and fit are present.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
