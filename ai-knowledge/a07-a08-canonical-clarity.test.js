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
const CLARITY_VERSION = "a07-a08-canonical-clarity-v1";

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

async function testA07(page) {
  const result = await loadLab(page, "a07-measure-integration.html", "__a07LabReady", "__a07LabSnapshot");
  requireFit(result, "A07 desktop");
  const initial = result.snapshot;
  if (result.bytes < 12000 || initial.clarityVersion !== CLARITY_VERSION || initial.labId !== "a07" || initial.has3d !== true) {
    throw new Error(`A07 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    manifoldPatchObjectCount: 2,
    chartAtlasObjectCount: 3,
    tangentSpaceObjectCount: 4,
    metricVolumeObjectCount: 3,
    geodesicRetractionObjectCount: 3,
    curvatureFormObjectCount: 4
  }, "A07");
  requireFields(initial, [
    "manifoldChartHash",
    "tangentSpaceHash",
    "metricVolumeHash",
    "geodesicRetractionHash",
    "curvatureFieldHash",
    "formVolumeHash",
    "commandEffectHash",
    "canonicalReferences",
    "differentialObjects",
    "diagnosticMetrics"
  ], "A07");
  requireIncludes(initial, "differentialObjects", [
    "embedded_manifold_surface_patch",
    "coordinate_chart_grid",
    "atlas_seam",
    "point_p_on_manifold",
    "tangent_plane_TpM",
    "tangent_basis_u_v",
    "normal_orthogonality_witness",
    "jacobian_tangent_map",
    "riemannian_metric_tensor",
    "metric_volume_element",
    "projected_manifold_gradient",
    "exponential_retraction_bead",
    "geodesic_path",
    "ambient_chord_warning",
    "curvature_normal_section",
    "differential_form_orientation",
    "manifold_volume_cells"
  ], "A07");
  requireIncludes(initial, "diagnosticMetrics", [
    "chart_coordinates",
    "metric_tensor",
    "normal_orthogonality",
    "geodesic_gap",
    "curvature_sign",
    "volume_element",
    "tangent_error",
    "holonomy"
  ], "A07");

  await page.locator("[data-control='mode']").selectOption("geodesic");
  await setRange(page, "#a07-theta", "-0.75");
  await setRange(page, "#a07-phi", "0.85");
  await setRange(page, "#a07-metric", "1.8");
  await setRange(page, "#a07-curvature", "-1.25");
  await setRange(page, "#a07-step", "1.05");
  const configured = await page.evaluate(() => window.__a07LabSnapshot());
  if (configured.mode !== "geodesic" || configured.curvatureSign >= 0 || configured.geodesicGap <= 0.3 || !/Geodesic path|Pulse links|manifold|ambient chord/i.test(configured.stateText)) {
    throw new Error(`A07 geodesic controls are not concrete: ${JSON.stringify(configured)}`);
  }
  requireChanged(initial, configured, ["manifoldChartHash", "tangentSpaceHash", "metricVolumeHash", "geodesicRetractionHash", "curvatureFieldHash", "formVolumeHash"], "A07 controls", 5);

  await page.locator("[data-action='pulse']").click();
  await page.waitForFunction(() => window.__a07LabSnapshot().visualMode === "pulse");
  const pulsed = await page.evaluate(() => window.__a07LabSnapshot());
  if (!/pulse/i.test(pulsed.commandEffectHash) || !/Pulse links/i.test(pulsed.stateText)) {
    throw new Error(`A07 pulse action is not explicit: ${JSON.stringify(pulsed)}`);
  }
  requireChanged(configured, pulsed, ["commandEffectHash", "tangentSpaceHash", "metricVolumeHash"], "A07 pulse", 1);

  await page.locator("[data-action='step']").click();
  await page.waitForFunction(() => window.__a07LabSnapshot().visualMode === "step");
  const stepped = await page.evaluate(() => window.__a07LabSnapshot());
  if (!/step/i.test(stepped.commandEffectHash) || !/Step compares/i.test(stepped.stateText)) {
    throw new Error(`A07 step action is not explicit: ${JSON.stringify(stepped)}`);
  }
  requireChanged(pulsed, stepped, ["commandEffectHash", "geodesicRetractionHash", "curvatureFieldHash"], "A07 step", 1);
}

async function testA08(page) {
  const result = await loadLab(page, "a08-algebra-structure-lab.html", "__a08LabReady", "__a08LabSnapshot");
  requireFit(result, "A08 desktop");
  const initial = result.snapshot;
  if (result.bytes < 12000 || initial.clarityVersion !== CLARITY_VERSION || initial.labId !== "a08" || initial.has3d !== true) {
    throw new Error(`A08 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    cayleyTableObjectCount: 16,
    axiomWitnessObjectCount: 5,
    ringFieldObjectCount: 4,
    homomorphismObjectCount: 3,
    kernelQuotientObjectCount: 3,
    actionOrbitObjectCount: 3
  }, "A08");
  requireFields(initial, [
    "cayleyTableHash",
    "lawAxiomHash",
    "ringFieldHash",
    "homomorphismKernelHash",
    "quotientIsoHash",
    "actionOrbitHash",
    "commandEffectHash",
    "canonicalReferences",
    "algebraObjects",
    "diagnosticMetrics"
  ], "A08");
  requireIncludes(initial, "algebraObjects", [
    "cayley_operation_table",
    "closure_cells",
    "identity_row_column",
    "inverse_pair_arcs",
    "associativity_witness",
    "commutativity_mirror",
    "modular_clock_Zn",
    "ring_multiplication_overlay",
    "unit_group_elements",
    "zero_divisor_gate",
    "field_prime_composite_panel",
    "generator_orbit_cycle",
    "stabilizer_anchor",
    "homomorphism_conveyor",
    "kernel_preimage_identity",
    "quotient_coset_stack",
    "first_isomorphism_bridge",
    "group_action_square"
  ], "A08");
  requireIncludes(initial, "diagnosticMetrics", [
    "closure_score",
    "identity_element",
    "unit_fraction",
    "kernel_size",
    "orbit_length",
    "homomorphism_law_residual",
    "field_indicator"
  ], "A08");

  await page.locator("[data-control='mode']").selectOption("homomorphism");
  await setRange(page, "#a08-modulus", "8");
  await setRange(page, "#a08-generator", "2");
  await setRange(page, "#a08-map", "3");
  await setRange(page, "#a08-operation", "0");
  await setRange(page, "#a08-quotient", "4");
  const configured = await page.evaluate(() => window.__a08LabSnapshot());
  if (configured.mode !== "homomorphism" || configured.kernelSize < 2 || configured.quotientCosetCount < 2 || !/Homomorphism|kernel|quotient|Pulse follows/i.test(configured.stateText)) {
    throw new Error(`A08 homomorphism controls are not concrete: ${JSON.stringify(configured)}`);
  }
  requireChanged(initial, configured, ["cayleyTableHash", "lawAxiomHash", "ringFieldHash", "homomorphismKernelHash", "quotientIsoHash", "actionOrbitHash"], "A08 controls", 5);

  await page.locator("[data-action='pulse']").click();
  await page.waitForFunction(() => window.__a08LabSnapshot().visualMode === "pulse");
  const pulsed = await page.evaluate(() => window.__a08LabSnapshot());
  if (!/pulse/i.test(pulsed.commandEffectHash) || !/Pulse follows/i.test(pulsed.stateText)) {
    throw new Error(`A08 pulse action is not explicit: ${JSON.stringify(pulsed)}`);
  }
  requireChanged(configured, pulsed, ["commandEffectHash", "actionOrbitHash", "lawAxiomHash"], "A08 pulse", 1);

  await page.locator("[data-action='step']").click();
  await page.waitForFunction(() => window.__a08LabSnapshot().visualMode === "step");
  const stepped = await page.evaluate(() => window.__a08LabSnapshot());
  if (!/step/i.test(stepped.commandEffectHash) || !/Step reads the homomorphism/i.test(stepped.stateText)) {
    throw new Error(`A08 step action is not explicit: ${JSON.stringify(stepped)}`);
  }
  requireChanged(pulsed, stepped, ["commandEffectHash", "homomorphismKernelHash", "quotientIsoHash"], "A08 step", 1);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 700 } });
  try {
    await testA07(page);
    await testA08(page);
    console.log("A07/A08 canonical clarity checks passed");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
