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
const CLARITY_VERSION = "h11-h12-canonical-clarity-v1";

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

async function testH11(page) {
  const result = await loadLab(page, "h11-sheaf-gauge-transformation-lab.html", "__h11LabReady", "__h11LabSnapshot");
  requireFit(result, "H11 desktop");
  const initial = result.snapshot;
  if (result.bytes < 12000 || initial.clarityVersion !== CLARITY_VERSION || initial.labId !== "h11" || initial.has3d !== true) {
    throw new Error(`H11 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    localFrameObjectCount: 3,
    frameAxisObjectCount: 6,
    fiberVectorObjectCount: 3,
    restrictionMapObjectCount: 4,
    gaugeMatrixObjectCount: 3,
    energyInvariantObjectCount: 1,
    brokenGaugeObjectCount: 4,
    holonomyLoopObjectCount: 1,
    gaugeOrbitObjectCount: 1
  }, "H11");
  requireFields(initial, [
    "localFrameHash",
    "frameAxisHash",
    "fiberVectorHash",
    "restrictionMapHash",
    "gaugeMatrixHash",
    "energyInvariantHash",
    "brokenGaugeHash",
    "holonomyLoopHash",
    "gaugeOrbitHash",
    "canonicalReferences",
    "gaugeObjects",
    "diagnosticMetrics"
  ], "H11");
  requireIncludes(initial, "gaugeObjects", ["local_frame", "gauge_transform_matrix", "covariant_restriction_update", "same_section_orbit", "gauge_invariant_energy", "broken_gauge_artifact", "holonomy_loop"], "H11");
  requireIncludes(initial, "diagnosticMetrics", ["energy_before", "energy_after", "invariance_error", "holonomy_angle", "broken_energy_gap"], "H11");

  await page.locator("#scenario").selectOption("edge");
  await page.locator("#mode").selectOption("covariant");
  await setRange(page, "#gaugeSteps", "7");
  await setRange(page, "#frameRotation", "1.55");
  await setRange(page, "#gaugeMismatch", "0.22");
  await setRange(page, "#visibleFrames", "3");
  await setRange(page, "#invariantAnchor", "0.84");
  const configured = await page.evaluate(() => window.__h11LabSnapshot());
  requireChanged(initial, configured, ["frameAxisHash", "fiberVectorHash", "restrictionMapHash", "gaugeMatrixHash", "energyInvariantHash"], "H11 parameters", 4);

  const beforeEnergy = configured.energy;
  await page.locator("#applyGauge").click();
  await page.waitForFunction(() => window.__h11LabSnapshot().status === "Gauge applied" && window.__h11LabSnapshot().gaugeApplications === 1);
  const covariant = await page.evaluate(() => window.__h11LabSnapshot());
  if (Math.abs(covariant.energy - beforeEnergy) > 0.08 || !/inverse restriction update|invariant energy/i.test(covariant.stateText)) {
    throw new Error(`H11 covariant gauge is not concrete/invariant: ${JSON.stringify(covariant)}`);
  }
  requireChanged(configured, covariant, ["frameAxisHash", "fiberVectorHash", "restrictionMapHash", "gaugeMatrixHash", "gaugeOrbitHash"], "H11 gauge transform", 3);

  await page.locator("#breakGauge").click();
  await page.waitForFunction(() => window.__h11LabSnapshot().mode === "broken");
  await page.locator("#applyGauge").click();
  await page.waitForFunction(() => window.__h11LabSnapshot().status === "Gauge applied" && window.__h11LabSnapshot().mode === "broken" && window.__h11LabSnapshot().energyRatio > 1.12);
  const broken = await page.evaluate(() => window.__h11LabSnapshot());
  if (!/broken gauge|fake residual/i.test(broken.stateText)) {
    throw new Error(`H11 broken gauge artifact is not explicit: ${JSON.stringify(broken)}`);
  }
  requireChanged(covariant, broken, ["restrictionMapHash", "gaugeMatrixHash", "energyInvariantHash", "brokenGaugeHash"], "H11 broken covariance", 3);

  await page.locator("#scenario").selectOption("triangle");
  await page.locator("#cycleHolonomy").click();
  await page.waitForFunction(() => window.__h11LabSnapshot().status === "Holonomy shown" && Math.abs(window.__h11LabSnapshot().holonomyAngle) > 15);
  const holonomy = await page.evaluate(() => window.__h11LabSnapshot());
  if (!/holonomy|curvature/i.test(holonomy.stateText)) {
    throw new Error(`H11 holonomy curvature is not explicit: ${JSON.stringify(holonomy)}`);
  }
  requireChanged(broken, holonomy, ["restrictionMapHash", "holonomyLoopHash", "brokenGaugeHash"], "H11 holonomy", 2);
}

async function testH12(page) {
  const result = await loadLab(page, "h12-sheaf-applications-domain-lab.html", "__h12LabReady", "__h12LabSnapshot");
  requireFit(result, "H12 desktop");
  const initial = result.snapshot;
  if (result.bytes < 12000 || initial.clarityVersion !== CLARITY_VERSION || initial.labId !== "h12" || initial.has3d !== true) {
    throw new Error(`H12 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    domainCardObjectCount: 6,
    localSpaceObjectCount: 24,
    relationSpaceObjectCount: 6,
    restrictionMapObjectCount: 6,
    plainSmoothingFailureObjectCount: 2,
    sheafTransportObjectCount: 2,
    domainMetricObjectCount: 3,
    baselineComparisonObjectCount: 2
  }, "H12");
  requireFields(initial, [
    "domainCardHash",
    "localSpaceHash",
    "relationSpaceHash",
    "restrictionMapHash",
    "plainSmoothingFailureHash",
    "sheafTransportHash",
    "domainMetricHash",
    "baselineComparisonHash",
    "canonicalReferences",
    "applicationObjects",
    "diagnosticMetrics"
  ], "H12");
  requireIncludes(initial, "applicationObjects", ["fraud_transaction_graph", "weather_vector_field", "molecular_bond_relation", "recommendation_bipartite_relation", "traffic_directed_flow", "edge_relation_space", "plain_smoothing_baseline"], "H12");
  requireIncludes(initial, "diagnosticMetrics", ["relation_fit", "edge_disagreement", "plain_baseline_loss", "domain_transfer_gain", "map_cost"], "H12");

  await page.locator("#domain").selectOption("weather");
  await page.locator("#mapFamily").selectOption("orthogonal");
  await page.locator("#view").selectOption("all");
  await setRange(page, "#mapStrength", "0.86");
  await setRange(page, "#relationNoise", "0.34");
  await setRange(page, "#edgeMetadata", "0.82");
  await setRange(page, "#baselineDepth", "7");
  await setRange(page, "#domainShift", "0.42");
  const configured = await page.evaluate(() => window.__h12LabSnapshot());
  if (configured.domain !== "weather" || configured.mapFamily !== "orthogonal" || !/local frames|vector arrows|upstream\/downstream/i.test(configured.stateText)) {
    throw new Error(`H12 controls did not expose weather/traffic semantics: ${JSON.stringify(configured)}`);
  }
  requireChanged(initial, configured, ["domainCardHash", "localSpaceHash", "relationSpaceHash", "restrictionMapHash", "plainSmoothingFailureHash", "domainMetricHash"], "H12 controls", 4);

  await page.locator("#domain").selectOption("molecule");
  await page.locator("#mapFamily").selectOption("edge-type");
  await setRange(page, "#edgeMetadata", "0.88");
  await page.waitForFunction(() => window.__h12LabSnapshot().domain === "molecule");
  const molecule = await page.evaluate(() => window.__h12LabSnapshot());
  if (!/bond|torsion|relation space/i.test(molecule.stateText)) {
    throw new Error(`H12 molecule station is not concrete: ${JSON.stringify(molecule)}`);
  }
  requireChanged(configured, molecule, ["domainCardHash", "localSpaceHash", "relationSpaceHash", "restrictionMapHash"], "H12 molecule station", 3);

  const beforeGap = molecule.rawEnergy - molecule.sheafEnergy;
  await page.locator("#applySheaf").click();
  await page.waitForFunction(() => window.__h12LabSnapshot().mode === "sheaf" && window.__h12LabSnapshot().sheafEnergy < window.__h12LabSnapshot().rawEnergy);
  const sheaf = await page.evaluate(() => window.__h12LabSnapshot());
  if ((sheaf.rawEnergy - sheaf.sheafEnergy) < beforeGap * 0.85 || !/maps endpoints into the relation space/i.test(sheaf.stateText)) {
    throw new Error(`H12 sheaf transport action is weak: ${JSON.stringify(sheaf)}`);
  }
  requireChanged(molecule, sheaf, ["relationSpaceHash", "restrictionMapHash", "sheafTransportHash", "domainMetricHash"], "H12 sheaf transport", 3);

  await page.locator("#runDiffusion").click();
  await page.waitForFunction(() => window.__h12LabSnapshot().diffusionStep >= 1);
  const split = await page.evaluate(() => window.__h12LabSnapshot());
  if (!/domain split|drift/i.test(split.stateText)) {
    throw new Error(`H12 split evaluation is not explicit: ${JSON.stringify(split)}`);
  }
  requireChanged(sheaf, split, ["domainMetricHash", "baselineComparisonHash"], "H12 split evaluation", 2);

  await page.locator("#showFailure").click();
  await page.waitForFunction(() => window.__h12LabSnapshot().mode === "failure");
  const failure = await page.evaluate(() => window.__h12LabSnapshot());
  if (!/plain smoothing|raw baseline/i.test(failure.stateText) || failure.rawEnergy <= failure.sheafEnergy) {
    throw new Error(`H12 baseline failure is not explicit: ${JSON.stringify(failure)}`);
  }
  requireChanged(split, failure, ["plainSmoothingFailureHash", "baselineComparisonHash", "domainMetricHash"], "H12 baseline failure", 2);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 700 } });
  try {
    await testH11(page);
    await testH12(page);
    console.log("H11/H12 canonical clarity checks passed");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
