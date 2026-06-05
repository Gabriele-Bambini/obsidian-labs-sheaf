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
const CLARITY_VERSION = "a05-a06-canonical-clarity-v1";

async function loadLab(page, fileName, readyName, snapshotName) {
  const labPath = path.join(__dirname, fileName).replace(/\\/g, "/");
  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas#canvas").waitFor({ state: "visible" });
  await page.waitForFunction(
    ([ready, snapshot]) => window[ready] === true && typeof window[snapshot] === "function" && window[snapshot](),
    [readyName, snapshotName]
  );
  await page.waitForTimeout(180);
  return page.evaluate((snapshotName) => {
    const canvas = document.querySelector(".lab-viewport canvas#canvas");
    const command = document.querySelector(".command-bar");
    return {
      bytes: canvas.toDataURL("image/png").length,
      snapshot: window[snapshotName](),
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

async function testA05(page) {
  const result = await loadLab(page, "a05-functional-analysis-operator-lab.html", "__a05LabReady", "__a05LabSnapshot");
  requireFit(result, "A05 desktop");
  const initial = result.snapshot;
  if (result.bytes < 12000 || initial.clarityVersion !== CLARITY_VERSION || initial.labId !== "a05" || initial.has3d !== true) {
    throw new Error(`A05 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    waveformObjectCount: 3,
    normObjectCount: 3,
    basisCoefficientObjectCount: 12,
    operatorObjectCount: 3,
    projectionResidualObjectCount: 2,
    dualRkhsObjectCount: 3,
    weakCompactObjectCount: 3
  }, "A05");
  requireFields(initial, [
    "functionWaveformHash",
    "normLedgerHash",
    "basisCoordinateHash",
    "operatorActionHash",
    "projectionResidualHash",
    "compactDerivativeHash",
    "dualRkhsHash",
    "weakConvergenceHash",
    "commandEffectHash",
    "canonicalReferences",
    "functionalObjects",
    "diagnosticMetrics"
  ], "A05");
  requireIncludes(initial, "functionalObjects", [
    "function_waveform_f",
    "l1_l2_linf_norm_meters",
    "hilbert_inner_product_plane",
    "banach_norm_comparison",
    "orthonormal_basis_rack",
    "basis_coefficient_towers",
    "bounded_operator_T",
    "projection_subspace",
    "orthogonal_residual",
    "compact_smoothing_damper",
    "derivative_amplifier",
    "dual_riesz_representer",
    "rkhs_finite_span",
    "weak_functional_probes"
  ], "A05");
  requireIncludes(initial, "diagnosticMetrics", [
    "l1_norm",
    "l2_norm",
    "linf_norm",
    "operator_gain",
    "projection_residual_norm",
    "dual_scalar",
    "derivative_amplification",
    "rkhs_span_count"
  ], "A05");

  await page.locator("[data-control='mode']").selectOption("derivative");
  await setRange(page, "#a05-truncation", "4");
  await setRange(page, "#a05-frequency", "11");
  await setRange(page, "#a05-strength", "1.85");
  await setRange(page, "#a05-smoothness", "0.1");
  await setRange(page, "#a05-probe", "0.82");
  const configured = await page.evaluate(() => window.__a05LabSnapshot());
  if (configured.mode !== "derivative" || configured.derivativeAmplification < 2 || !/Derivative stress|high-frequency|operator gain/i.test(configured.stateText)) {
    throw new Error(`A05 derivative controls are not concrete: ${JSON.stringify(configured)}`);
  }
  requireChanged(initial, configured, ["functionWaveformHash", "normLedgerHash", "basisCoordinateHash", "operatorActionHash", "compactDerivativeHash", "dualRkhsHash"], "A05 controls", 5);

  await page.locator("[data-action='pulse']").click();
  await page.waitForFunction(() => window.__a05LabSnapshot().visualMode === "pulse");
  const pulsed = await page.evaluate(() => window.__a05LabSnapshot());
  if (!/pulse/i.test(pulsed.commandEffectHash) || !/Derivative stress|Pulse sends/i.test(pulsed.stateText)) {
    throw new Error(`A05 pulse action is not explicit: ${JSON.stringify(pulsed)}`);
  }
  requireChanged(configured, pulsed, ["commandEffectHash", "operatorActionHash", "compactDerivativeHash"], "A05 pulse", 1);

  await page.locator("[data-action='step']").click();
  await page.waitForFunction(() => window.__a05LabSnapshot().visualMode === "step");
  const stepped = await page.evaluate(() => window.__a05LabSnapshot());
  if (!/step/i.test(stepped.commandEffectHash) || !/Step reads/i.test(stepped.stateText)) {
    throw new Error(`A05 step action is not explicit: ${JSON.stringify(stepped)}`);
  }
  requireChanged(pulsed, stepped, ["commandEffectHash", "projectionResidualHash", "weakConvergenceHash"], "A05 step", 1);
}

async function testA06(page) {
  const result = await loadLab(page, "a06-topology-neighborhood-lab.html", "__a06LabReady", "__a06LabSnapshot");
  requireFit(result, "A06 desktop");
  const initial = result.snapshot;
  if (result.bytes < 12000 || initial.clarityVersion !== CLARITY_VERSION || initial.labId !== "a06" || initial.has3d !== true) {
    throw new Error(`A06 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    topologicalSpaceObjectCount: 2,
    openSetObjectCount: 5,
    neighborhoodBoundaryObjectCount: 3,
    continuityPreimageObjectCount: 3,
    compactSubcoverObjectCount: 2,
    connectedQuotientObjectCount: 3,
    invariantObjectCount: 1
  }, "A06");
  requireFields(initial, [
    "topologySpaceHash",
    "openNeighborhoodHash",
    "boundaryHash",
    "continuityPreimageHash",
    "compactnessHash",
    "connectednessHash",
    "quotientInvariantHash",
    "commandEffectHash",
    "canonicalReferences",
    "topologyObjects",
    "diagnosticMetrics"
  ], "A06");
  requireIncludes(initial, "topologyObjects", [
    "topological_space_X",
    "topology_tau_open_set_rack",
    "basis_open_interval_generator",
    "neighborhood_ball_Nx",
    "boundary_contact_markers",
    "target_open_set_V",
    "preimage_f_inverse_V",
    "open_cover_family",
    "finite_subcover",
    "connected_split_test",
    "quotient_endpoint_glue",
    "quotient_circle_image",
    "topological_invariant_board"
  ], "A06");
  requireIncludes(initial, "diagnosticMetrics", [
    "open_coverage",
    "boundary_count",
    "subcover_size",
    "continuity_score",
    "connected_component_count",
    "quotient_identification",
    "invariant_hash"
  ], "A06");

  await page.locator("[data-control='mode']").selectOption("quotient");
  await setRange(page, "#a06-radius", "0.74");
  await setRange(page, "#a06-cover", "8");
  await setRange(page, "#a06-map", "1.55");
  await setRange(page, "#a06-glue", "0.9");
  await setRange(page, "#a06-separation", "0.7");
  const configured = await page.evaluate(() => window.__a06LabSnapshot());
  if (configured.mode !== "quotient" || configured.topologyState.quotientGlueActive !== true || !/Quotient|glue|endpoint|circle/i.test(configured.stateText)) {
    throw new Error(`A06 quotient controls are not concrete: ${JSON.stringify(configured)}`);
  }
  requireChanged(initial, configured, ["topologySpaceHash", "openNeighborhoodHash", "boundaryHash", "continuityPreimageHash", "compactnessHash", "quotientInvariantHash"], "A06 controls", 5);

  await page.locator("[data-action='pulse']").click();
  await page.waitForFunction(() => window.__a06LabSnapshot().visualMode === "pulse");
  const pulsed = await page.evaluate(() => window.__a06LabSnapshot());
  if (!/pulse/i.test(pulsed.commandEffectHash) || !/Quotient|Pulse|glue/i.test(pulsed.stateText)) {
    throw new Error(`A06 pulse action is not explicit: ${JSON.stringify(pulsed)}`);
  }
  requireChanged(configured, pulsed, ["commandEffectHash", "continuityPreimageHash", "quotientInvariantHash"], "A06 pulse", 1);

  await page.locator("[data-action='step']").click();
  await page.waitForFunction(() => window.__a06LabSnapshot().visualMode === "step");
  const stepped = await page.evaluate(() => window.__a06LabSnapshot());
  if (!/step/i.test(stepped.commandEffectHash) || !/Step builds|quotient projection/i.test(stepped.stateText)) {
    throw new Error(`A06 step action is not explicit: ${JSON.stringify(stepped)}`);
  }
  requireChanged(pulsed, stepped, ["commandEffectHash", "compactnessHash", "quotientInvariantHash"], "A06 step", 1);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 700 } });
  try {
    await testA05(page);
    await testA06(page);
    console.log("A05/A06 canonical clarity checks passed");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
