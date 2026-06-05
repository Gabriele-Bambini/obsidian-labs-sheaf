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
const CLARITY_VERSION = "a15-b01-canonical-clarity-v2";
const LEGACY_VERSION = "a15-b01-canonical-clarity-v1";

async function loadLab(page, fileName, readyName, snapshotName) {
  const labPath = path.join(__dirname, fileName).replace(/\\/g, "/");
  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas#canvas").waitFor({ state: "visible" });
  await page.waitForFunction(
    ([ready, snapshot]) => window[ready] === true && typeof window[snapshot] === "function" && window[snapshot](),
    [readyName, snapshotName]
  );
  await page.waitForTimeout(220);
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
  if (result.overflowX > 18 || result.overflowY > 18 || result.commandOverflowX > 8 || result.commandOverflowY > 8) {
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

async function testA15(page) {
  const result = await loadLab(page, "a15-numerical-methods-stability-lab.html", "__a15LabReady", "__a15LabSnapshot");
  requireFit(result, "A15 desktop");
  const initial = result.snapshot;
  if (result.bytes < 12000 || initial.clarityVersion !== CLARITY_VERSION || initial.legacyClarityVersion !== LEGACY_VERSION || initial.labId !== "a15" || initial.has3d !== true) {
    throw new Error(`A15 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    floatingPointObjectCount: 12,
    conditioningObjectCount: 6,
    residualErrorObjectCount: 6,
    rootStencilObjectCount: 8,
    linearSolveObjectCount: 30,
    timeStabilityObjectCount: 10
  }, "A15");
  requireFields(initial, [
    "numericalSceneHash",
    "conditioningHash",
    "solverReliabilityHash",
    "stabilityRegionHash",
    "floatingPointHash",
    "finiteDifferenceHash",
    "linearSolveHash",
    "commandEffectHash",
    "canonicalReferences",
    "numericalMethodObjects",
    "diagnosticMetrics"
  ], "A15");
  requireIncludes(initial, "numericalMethodObjects", [
    "floating_point_mantissa_exponent_rack",
    "unit_roundoff_error_cloud",
    "condition_number_singular_value_ladder",
    "input_perturbation_ball",
    "output_amplification_cone",
    "residual_convergence_curve",
    "backward_error_nearby_problem_plate",
    "trusted_digits_register",
    "catastrophic_cancellation_gap",
    "scaling_preconditioner_board",
    "root_bracket_interval",
    "newton_tangent_step",
    "bisection_midpoint_ticks",
    "finite_difference_stencil",
    "truncation_roundoff_error_curves",
    "optimal_h_marker",
    "linear_system_matrix_board",
    "pivoting_lu_rail",
    "qr_orthogonality_panel",
    "least_squares_residual",
    "stability_region_disk",
    "euler_time_step_arrow",
    "implicit_step_stabilizer",
    "krylov_subspace_ladder"
  ], "A15");
  requireIncludes(initial, "diagnosticMetrics", [
    "condition_number",
    "residual_norm",
    "trusted_digits",
    "stability_margin",
    "unit_roundoff_stress",
    "amplification_factor",
    "backward_error",
    "forward_error_bound",
    "cancellation_loss",
    "finite_difference_error",
    "optimal_step_size",
    "least_squares_residual",
    "orthogonality_loss",
    "krylov_residual_drop"
  ], "A15");

  await page.locator("[data-control='mode']").selectOption("conditioning");
  await setRange(page, "#a15-condition", "7.4");
  await setRange(page, "#a15-step", "0.58");
  await setRange(page, "#a15-roundoff", "0.74");
  await setRange(page, "#a15-regularization", "0.12");
  await setRange(page, "#a15-iterations", "9");
  const configured = await page.evaluate(() => window.__a15LabSnapshot());
  if (configured.conditionNumber <= initial.conditionNumber || configured.trustedDigits >= initial.trustedDigits || !/conditioning|roundoff|trusted digits|amplif/i.test(configured.stateText)) {
    throw new Error(`A15 conditioning controls are not concrete: ${JSON.stringify(configured)}`);
  }
  requireChanged(initial, configured, ["numericalSceneHash", "conditioningHash", "floatingPointHash", "finiteDifferenceHash", "linearSolveHash", "stabilityRegionHash"], "A15 controls", 5);

  await page.locator("[data-action='pulse']").click();
  await page.waitForFunction(() => window.__a15LabSnapshot().visualMode === "pulse");
  const pulsed = await page.evaluate(() => window.__a15LabSnapshot());
  if (!/pulse/i.test(pulsed.commandEffectHash) || !/Pulse.*conditioning|Pulse.*roundoff|Pulse.*trusted digits/i.test(pulsed.stateText)) {
    throw new Error(`A15 pulse action is not explicit: ${JSON.stringify(pulsed)}`);
  }
  requireChanged(configured, pulsed, ["commandEffectHash", "conditioningHash", "floatingPointHash"], "A15 pulse", 1);

  await page.locator("[data-control='mode']").selectOption("root");
  await page.locator("[data-action='step']").click();
  await page.waitForFunction(() => window.__a15LabSnapshot().visualMode === "step");
  const stepped = await page.evaluate(() => window.__a15LabSnapshot());
  if (!/step/i.test(stepped.commandEffectHash) || !/Step.*root|Step.*Newton|Step.*bisection|Step.*residual/i.test(stepped.stateText)) {
    throw new Error(`A15 step action is not explicit: ${JSON.stringify(stepped)}`);
  }
  requireChanged(pulsed, stepped, ["commandEffectHash", "solverReliabilityHash", "finiteDifferenceHash"], "A15 step", 2);
}

async function testB01(page) {
  const result = await loadLab(page, "b01-probability-foundations-lab.html", "__b01LabReady", "__b01LabSnapshot");
  requireFit(result, "B01 desktop");
  const initial = result.snapshot;
  if (result.bytes < 12000 || initial.clarityVersion !== CLARITY_VERSION || initial.legacyClarityVersion !== LEGACY_VERSION || initial.labId !== "b01" || initial.has3d !== true) {
    throw new Error(`B01 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    sampleSpaceObjectCount: 32,
    eventSetObjectCount: 5,
    conditioningBayesObjectCount: 10,
    randomVariableObjectCount: 12,
    distributionFunctionObjectCount: 9,
    expectationMonteCarloObjectCount: 18
  }, "B01");
  requireFields(initial, [
    "probabilitySceneHash",
    "eventAlgebraHash",
    "conditioningHash",
    "randomVariableHash",
    "sampleSpaceHash",
    "distributionFunctionHash",
    "monteCarloHash",
    "commandEffectHash",
    "canonicalReferences",
    "probabilityObjects",
    "diagnosticMetrics"
  ], "B01");
  requireIncludes(initial, "probabilityObjects", [
    "sample_space_omega_outcome_tiles",
    "probability_mass_bar_chart",
    "kolmogorov_total_mass_gauge",
    "event_a_set_region",
    "event_b_evidence_region",
    "union_intersection_complement_regions",
    "conditional_probability_lane",
    "bayes_partition_hypothesis_tiles",
    "likelihood_evidence_arrows",
    "posterior_normalized_bars",
    "random_variable_bridge_x_omega_to_r",
    "pmf_value_towers",
    "cdf_cumulative_staircase",
    "pdf_density_ribbon",
    "expectation_balance_beam",
    "variance_spread_arms",
    "independence_product_board",
    "monte_carlo_sample_beads",
    "empirical_mean_convergence_trace"
  ], "B01");
  requireIncludes(initial, "diagnosticMetrics", [
    "event_probability",
    "entropy",
    "conditional_mass",
    "expectation",
    "total_mass",
    "event_a_mass",
    "event_b_mass",
    "intersection_mass",
    "union_mass",
    "complement_mass",
    "posterior_mass",
    "random_variable_mean",
    "variance",
    "cdf_at_focus",
    "monte_carlo_mean",
    "empirical_error",
    "independence_gap"
  ], "B01");

  await page.locator("[data-control='mode']").selectOption("conditioning");
  await setRange(page, "#b01-focus", "0.74");
  await setRange(page, "#b01-spread", "0.32");
  await setRange(page, "#b01-noise", "0.16");
  await setRange(page, "#b01-samples", "12");
  await setRange(page, "#b01-strength", "0.88");
  const configured = await page.evaluate(() => window.__b01LabSnapshot());
  if (configured.eventProbability <= initial.eventProbability || configured.posteriorMass <= 0 || !/conditioning|event A|evidence B|P\(A\|B\)|Bayes/i.test(configured.stateText)) {
    throw new Error(`B01 conditioning controls are not concrete: ${JSON.stringify(configured)}`);
  }
  requireChanged(initial, configured, ["probabilitySceneHash", "eventAlgebraHash", "conditioningHash", "sampleSpaceHash", "distributionFunctionHash", "monteCarloHash"], "B01 controls", 5);

  await page.locator("[data-action='pulse']").click();
  await page.waitForFunction(() => window.__b01LabSnapshot().visualMode === "pulse");
  const pulsed = await page.evaluate(() => window.__b01LabSnapshot());
  if (!/pulse/i.test(pulsed.commandEffectHash) || !/Pulse.*event A|Pulse.*evidence B|Pulse.*conditional/i.test(pulsed.stateText)) {
    throw new Error(`B01 pulse action is not explicit: ${JSON.stringify(pulsed)}`);
  }
  requireChanged(configured, pulsed, ["commandEffectHash", "eventAlgebraHash", "conditioningHash"], "B01 pulse", 1);

  await page.locator("[data-control='mode']").selectOption("montecarlo");
  await page.locator("[data-action='step']").click();
  await page.waitForFunction(() => window.__b01LabSnapshot().visualMode === "step");
  const stepped = await page.evaluate(() => window.__b01LabSnapshot());
  if (!/step/i.test(stepped.commandEffectHash) || !/Step.*Monte Carlo|Step.*sample|Step.*empirical|Step.*expectation/i.test(stepped.stateText)) {
    throw new Error(`B01 step action is not explicit: ${JSON.stringify(stepped)}`);
  }
  requireChanged(pulsed, stepped, ["commandEffectHash", "randomVariableHash", "monteCarloHash"], "B01 step", 2);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 700 } });
  try {
    await testA15(page);
    await testB01(page);
    console.log("A15/B01 canonical clarity checks passed");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
