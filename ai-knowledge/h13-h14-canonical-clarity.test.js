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
const CLARITY_VERSION = "h13-h14-canonical-clarity-v1";

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

async function testH13(page) {
  const result = await loadLab(page, "h13-directed-hypergraph-sheaf-lab.html", "__h13LabReady", "__h13LabSnapshot");
  requireFit(result, "H13 desktop");
  const initial = result.snapshot;
  if (result.bytes < 12000 || initial.clarityVersion !== CLARITY_VERSION || initial.labId !== "h13" || initial.has3d !== true) {
    throw new Error(`H13 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    nodeStalkObjectCount: 6,
    nodeValueBarObjectCount: 6,
    directedEdgeStalkObjectCount: 2,
    hyperedgeGroupStalkObjectCount: 1,
    incidenceMapObjectCount: 10,
    projectedParticipantObjectCount: 10,
    residualRodObjectCount: 5,
    cliqueShadowObjectCount: 10,
    broadcastCorrectionObjectCount: 6,
    tailHeadAggregateObjectCount: 2
  }, "H13");
  requireFields(initial, [
    "nodeStalkHash",
    "nodeValueBarHash",
    "directedEdgeStalkHash",
    "hyperedgeGroupStalkHash",
    "incidenceMapHash",
    "projectionDotHash",
    "residualRodHash",
    "cliqueShadowHash",
    "correctionHash",
    "tailHeadHash",
    "canonicalReferences",
    "directedHypergraphObjects",
    "diagnosticMetrics"
  ], "H13");
  requireIncludes(initial, "directedHypergraphObjects", ["source_role_map", "target_role_map", "directed_edge_stalk", "hyperedge_group_stalk", "gather_project_broadcast", "tail_head_hyperedge", "clique_expansion_failure"], "H13");
  requireIncludes(initial, "diagnosticMetrics", ["role_asymmetry", "projected_residual_energy", "projection_defect", "compatible_count", "hyperedge_coherence", "clique_information_loss"], "H13");

  await page.locator("#mode").selectOption("hypergraph");
  await page.locator("#mapFamily").selectOption("projection");
  await page.locator("#residualView").selectOption("broadcast");
  await setRange(page, "#stepSize", "0.72");
  await setRange(page, "#roleAsymmetry", "0.82");
  await setRange(page, "#hyperedgeSize", "6");
  await setRange(page, "#tolerance", "0.38");
  await setRange(page, "#normalization", "0.84");
  const hypergraph = await page.evaluate(() => window.__h13LabSnapshot());
  if (hypergraph.mode !== "hypergraph" || !/group stalk|broadcast/i.test(hypergraph.stateText)) {
    throw new Error(`H13 hypergraph controls are not concrete: ${JSON.stringify(hypergraph)}`);
  }
  requireChanged(initial, hypergraph, ["nodeValueBarHash", "hyperedgeGroupStalkHash", "incidenceMapHash", "projectionDotHash", "residualRodHash"], "H13 hypergraph controls", 4);

  const beforeEnergy = hypergraph.energy;
  await page.locator("#flowStep").click();
  await page.waitForFunction((previous) => window.__h13LabSnapshot().stepCount > 0 && window.__h13LabSnapshot().energy < previous, beforeEnergy);
  const stepped = await page.evaluate(() => window.__h13LabSnapshot());
  if (!/gather|broadcast/i.test(stepped.stateText)) {
    throw new Error(`H13 gather-correct-broadcast action is not explicit: ${JSON.stringify(stepped)}`);
  }
  requireChanged(hypergraph, stepped, ["projectionDotHash", "correctionHash", "residualRodHash"], "H13 gather-correct", 2);

  await page.locator("#flipDirection").click();
  await page.waitForFunction(() => window.__h13LabSnapshot().flipped === true && window.__h13LabSnapshot().mode === "directed");
  const flipped = await page.evaluate(() => window.__h13LabSnapshot());
  if (!/reversing the arrow|source\/target/i.test(flipped.stateText)) {
    throw new Error(`H13 reversed direction is not semantic: ${JSON.stringify(flipped)}`);
  }
  requireChanged(stepped, flipped, ["directedEdgeStalkHash", "incidenceMapHash", "residualRodHash"], "H13 reverse direction", 2);

  await page.locator("#balance").click();
  await page.waitForFunction(() => window.__h13LabSnapshot().projectionCount > 0);
  const projected = await page.evaluate(() => window.__h13LabSnapshot());
  if (!/edge-stalk agreement|relation space/i.test(projected.stateText)) {
    throw new Error(`H13 projection balance is not explicit: ${JSON.stringify(projected)}`);
  }
  requireChanged(flipped, projected, ["projectionDotHash", "residualRodHash", "correctionHash"], "H13 projection balance", 2);

  await page.locator("#showClique").click();
  await page.waitForFunction(() => window.__h13LabSnapshot().mode === "clique");
  const clique = await page.evaluate(() => window.__h13LabSnapshot());
  if (!/clique expansion|group event/i.test(clique.stateText)) {
    throw new Error(`H13 clique failure is not explicit: ${JSON.stringify(clique)}`);
  }
  requireChanged(projected, clique, ["hyperedgeGroupStalkHash", "cliqueShadowHash", "incidenceMapHash"], "H13 clique shadow", 2);
}

async function testH14(page) {
  const result = await loadLab(page, "h14-persistent-sheaf-topology-lab.html", "__h14LabReady", "__h14LabSnapshot");
  requireFit(result, "H14 desktop");
  const initial = result.snapshot;
  if (result.bytes < 12000 || initial.clarityVersion !== CLARITY_VERSION || initial.labId !== "h14" || initial.has3d !== true) {
    throw new Error(`H14 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    pointCloudObjectCount: 8,
    radiusBallObjectCount: 8,
    vertexStalkObjectCount: 8,
    filtrationEdgeObjectCount: 12,
    restrictionMapObjectCount: 12,
    faceSimplexObjectCount: 4,
    defectHeatObjectCount: 12,
    ordinaryBarcodeObjectCount: 4,
    sheafBarcodeObjectCount: 4,
    radiusCursorObjectCount: 1,
    holonomyObstructionObjectCount: 1
  }, "H14");
  requireFields(initial, [
    "pointCloudHash",
    "radiusBallHash",
    "vertexStalkHash",
    "filtrationEdgeHash",
    "restrictionMapHash",
    "faceSimplexHash",
    "defectHeatHash",
    "ordinaryBarcodeHash",
    "sheafBarcodeHash",
    "radiusCursorHash",
    "holonomyObstructionHash",
    "canonicalReferences",
    "persistentSheafObjects",
    "diagnosticMetrics"
  ], "H14");
  requireIncludes(initial, "persistentSheafObjects", ["vietoris_rips_filtration", "radius_balls", "active_edges", "filled_triangles", "vertex_stalk_signal", "restriction_map", "ordinary_barcode", "sheaf_barcode", "holonomy_obstruction"], "H14");
  requireIncludes(initial, "diagnosticMetrics", ["beta0", "beta1", "sheaf_h0_dimension", "total_defect", "holonomy_defect", "active_edge_count"], "H14");

  await page.locator("#scenario").selectOption("biased");
  await page.locator("#restriction").selectOption("holonomy");
  await page.locator("#view").selectOption("defect");
  await setRange(page, "#radius", "1.02");
  await setRange(page, "#defectBias", "0.48");
  await setRange(page, "#signalNoise", "0.42");
  await setRange(page, "#barThreshold", "0.62");
  await setRange(page, "#faceFill", "0.34");
  const defect = await page.evaluate(() => window.__h14LabSnapshot());
  if (defect.view !== "defect" || defect.restriction !== "holonomy" || !/stalk bars|restriction maps|defect heat/i.test(defect.stateText)) {
    throw new Error(`H14 defect controls are not concrete: ${JSON.stringify(defect)}`);
  }
  requireChanged(initial, defect, ["radiusBallHash", "filtrationEdgeHash", "restrictionMapHash", "defectHeatHash", "holonomyObstructionHash"], "H14 defect controls", 4);

  await page.locator("#growFiltration").click();
  await page.waitForFunction((before) => window.__h14LabSnapshot().activeEdgeCount > before.activeEdgeCount, defect);
  const grown = await page.evaluate(() => window.__h14LabSnapshot());
  if (!/filtration radius/i.test(grown.stateText)) {
    throw new Error(`H14 grow filtration action is not explicit: ${JSON.stringify(grown)}`);
  }
  requireChanged(defect, grown, ["radiusBallHash", "filtrationEdgeHash", "faceSimplexHash", "radiusCursorHash"], "H14 grow filtration", 3);

  const beforeProject = grown.totalDefect;
  await page.locator("#projectSection").click();
  await page.waitForFunction((previous) => window.__h14LabSnapshot().projectionCount > 0 && window.__h14LabSnapshot().totalDefect < previous, beforeProject);
  const projected = await page.evaluate(() => window.__h14LabSnapshot());
  if (!/global section|delta0/i.test(projected.stateText)) {
    throw new Error(`H14 project section action is not explicit: ${JSON.stringify(projected)}`);
  }
  requireChanged(grown, projected, ["vertexStalkHash", "defectHeatHash", "sheafBarcodeHash"], "H14 project section", 2);

  await page.locator("#toggleBarcode").click();
  await page.waitForFunction(() => window.__h14LabSnapshot().view === "barcode");
  const barcode = await page.evaluate(() => window.__h14LabSnapshot());
  if (!/ordinary barcode|sheaf barcode|persistent obstruction/i.test(barcode.stateText)) {
    throw new Error(`H14 barcode comparison is not explicit: ${JSON.stringify(barcode)}`);
  }
  requireChanged(projected, barcode, ["ordinaryBarcodeHash", "sheafBarcodeHash", "vertexStalkHash"], "H14 barcode view", 2);

  await page.locator("#showHolonomy").click();
  await page.waitForFunction(() => window.__h14LabSnapshot().status === "Holonomy obstruction");
  const holonomy = await page.evaluate(() => window.__h14LabSnapshot());
  if (!/loop transports stalk values|obstruction/i.test(holonomy.stateText)) {
    throw new Error(`H14 holonomy obstruction is not explicit: ${JSON.stringify(holonomy)}`);
  }
  requireChanged(barcode, holonomy, ["defectHeatHash", "sheafBarcodeHash", "holonomyObstructionHash"], "H14 holonomy pulse", 2);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 700 } });
  try {
    await testH13(page);
    await testH14(page);
    console.log("H13/H14 canonical clarity checks passed");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
