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
const CLARITY_VERSION = "b06-b07-canonical-clarity-v2";
const LEGACY_VERSION = "b06-b07-canonical-clarity-v1";

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

async function testB06(page) {
  const result = await loadLab(page, "b06-markov-chain-lab.html", "__b06LabReady", "__b06LabSnapshot");
  requireFit(result, "B06 desktop");
  const initial = result.snapshot;
  if (result.bytes < 12000 || initial.clarityVersion !== CLARITY_VERSION || initial.legacyClarityVersion !== LEGACY_VERSION || initial.labId !== "b06" || initial.has3d !== true) {
    throw new Error(`B06 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    processTimelineObjectCount: 4,
    transitionKernelObjectCount: 8,
    stationaryMixingObjectCount: 4,
    hittingAbsorbingObjectCount: 3,
    poissonGeneratorObjectCount: 3,
    martingaleVisitObjectCount: 3
  }, "B06");
  requireFields(initial, [
    "processSceneHash",
    "transitionMatrixHash",
    "mixingHash",
    "hittingPoissonHash",
    "distributionUpdateHash",
    "samplePathHash",
    "commandEffectHash",
    "canonicalReferences",
    "stochasticProcessObjects",
    "diagnosticMetrics"
  ], "B06");
  requireIncludes(initial, "stochasticProcessObjects", [
    "time_indexed_random_variables_xt_timeline",
    "finite_markov_state_space_node",
    "transition_matrix_p_row_stochastic_board",
    "row_probability_simplex_fan",
    "current_distribution_vector_pi_t_bars",
    "next_distribution_pi_t_p_bars",
    "transition_kernel_weighted_arrows_pij",
    "sample_path_beads_x0_to_xt",
    "stationary_distribution_pi_star_bars",
    "stationary_eigenvector_pi_equals_pi_p_plate",
    "mixing_total_variation_distance_gauge",
    "spectral_gap_convergence_dial",
    "hitting_target_set_a_gate",
    "absorbing_state_trap",
    "hitting_time_equation_hi_board",
    "graph_random_walk_degree_weighted_nodes",
    "poisson_arrival_counting_timeline",
    "exponential_waiting_time_clocks",
    "continuous_time_generator_q_board",
    "martingale_fair_game_path",
    "filtration_information_shelves_ft",
    "empirical_visit_frequency_bars"
  ], "B06");
  requireIncludes(initial, "diagnosticMetrics", [
    "stationary_mass",
    "mixing_gap",
    "path_entropy",
    "hitting_chance",
    "row_stochastic_error",
    "stationary_residual",
    "total_variation_distance",
    "spectral_gap",
    "expected_hitting_time",
    "absorbing_probability",
    "poisson_rate",
    "expected_arrivals",
    "waiting_mean",
    "martingale_drift",
    "empirical_stationary_error",
    "random_walk_degree_bias"
  ], "B06");
  if (!/stochastic|Markov|transition|sample path|stationary|hitting/i.test(initial.stateText)) {
    throw new Error(`B06 state text is not stochastic-process-specific: ${JSON.stringify(initial.stateText)}`);
  }

  await page.locator("[data-control='mode']").selectOption("mixing");
  await setRange(page, "#b06-focus", "0.78");
  await setRange(page, "#b06-spread", "0.25");
  await setRange(page, "#b06-noise", "0.1");
  await setRange(page, "#b06-samples", "13");
  await setRange(page, "#b06-strength", "0.86");
  const configured = await page.evaluate(() => window.__b06LabSnapshot());
  if (configured.expectedArrivals <= initial.expectedArrivals || configured.hittingChance <= initial.hittingChance || !/mixing|stationary|transition|distribution|TV/i.test(configured.stateText)) {
    throw new Error(`B06 mixing controls are not concrete: ${JSON.stringify(configured)}`);
  }
  requireChanged(initial, configured, ["processSceneHash", "transitionMatrixHash", "mixingHash", "hittingPoissonHash", "distributionUpdateHash", "samplePathHash"], "B06 controls", 5);

  await page.locator("[data-action='pulse']").click();
  await page.waitForFunction(() => window.__b06LabSnapshot().visualMode === "pulse");
  const pulsed = await page.evaluate(() => window.__b06LabSnapshot());
  if (!/pulse/i.test(pulsed.commandEffectHash) || !/Pulse.*transition|Pulse.*kernel|Pulse.*Markov/i.test(pulsed.stateText)) {
    throw new Error(`B06 pulse action is not explicit: ${JSON.stringify(pulsed)}`);
  }
  requireChanged(configured, pulsed, ["commandEffectHash", "transitionMatrixHash", "distributionUpdateHash"], "B06 pulse", 1);

  await page.locator("[data-control='mode']").selectOption("hitting");
  await page.locator("[data-action='step']").click();
  await page.waitForFunction(() => window.__b06LabSnapshot().visualMode === "step");
  const stepped = await page.evaluate(() => window.__b06LabSnapshot());
  if (!/step/i.test(stepped.commandEffectHash) || !/Step.*hit|Step.*target|Step.*tau|Step.*path/i.test(stepped.stateText)) {
    throw new Error(`B06 step action is not explicit: ${JSON.stringify(stepped)}`);
  }
  requireChanged(pulsed, stepped, ["commandEffectHash", "hittingPoissonHash", "samplePathHash"], "B06 step", 2);
}

async function testB07(page) {
  const result = await loadLab(page, "b07-advanced-stochastic-calculus-lab.html", "__b07LabReady", "__b07LabSnapshot");
  requireFit(result, "B07 desktop");
  const initial = result.snapshot;
  if (result.bytes < 12000 || initial.clarityVersion !== CLARITY_VERSION || initial.legacyClarityVersion !== LEGACY_VERSION || initial.labId !== "b07" || initial.has3d !== true) {
    throw new Error(`B07 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    brownianScalingObjectCount: 4,
    quadraticVariationObjectCount: 3,
    itoIntegralObjectCount: 6,
    sdeObjectCount: 5,
    generatorDensityObjectCount: 3,
    reverseDiffusionObjectCount: 3
  }, "B07");
  requireFields(initial, [
    "stochasticCalculusSceneHash",
    "brownianScalingHash",
    "itoIntegralHash",
    "sdeFlowHash",
    "reverseDiffusionHash",
    "itoFormulaHash",
    "generatorDensityHash",
    "commandEffectHash",
    "canonicalReferences",
    "stochasticCalculusObjects",
    "diagnosticMetrics"
  ], "B07");
  requireIncludes(initial, "stochasticCalculusObjects", [
    "brownian_motion_wt_rough_continuous_path",
    "smooth_ode_finite_variation_comparison_path",
    "sqrt_dt_brownian_increment_ruler",
    "dt_deterministic_increment_ruler",
    "quadratic_variation_sum_squared_increments_bars",
    "ito_multiplication_table_dw_squared_equals_dt_plate",
    "filtration_adapted_information_shelves_ft",
    "adapted_integrand_ht_step_process",
    "ito_integral_left_endpoint_rectangles",
    "ito_isometry_variance_energy_board",
    "stratonovich_midpoint_contrast_rail",
    "sde_drift_mu_dt_arrows",
    "sde_diffusion_sigma_dw_cones",
    "euler_maruyama_step_ladder",
    "ito_lemma_formula_board",
    "fx_dx_linear_term_strip",
    "one_half_sigma_squared_fxx_correction_plate",
    "infinitesimal_generator_l_operator_board",
    "fokker_planck_density_flow_surface",
    "ornstein_uhlenbeck_mean_reversion_spring",
    "geometric_brownian_log_correction_track",
    "langevin_potential_u_landscape",
    "reverse_diffusion_score_field_arrows",
    "noising_denoising_trajectory_beads"
  ], "B07");
  requireIncludes(initial, "diagnosticMetrics", [
    "quadratic_variation",
    "ito_drift",
    "diffusion_scale",
    "sde_stability",
    "brownian_roughness",
    "sqrt_dt_scale",
    "dt_scale",
    "quadratic_variation_error",
    "ito_correction",
    "ito_integral_variance",
    "drift_magnitude",
    "diffusion_variance",
    "euler_step_size",
    "generator_strength",
    "fokker_planck_mass_error",
    "ou_mean_reversion",
    "gbm_log_correction",
    "langevin_energy_drop",
    "reverse_score_norm",
    "denoising_progress",
    "martingale_mean_error"
  ], "B07");
  if (!/Brownian|sqrt|quadratic variation|Ito|SDE|diffusion/i.test(initial.stateText)) {
    throw new Error(`B07 state text is not stochastic-calculus-specific: ${JSON.stringify(initial.stateText)}`);
  }

  await page.locator("[data-control='mode']").selectOption("ito");
  await setRange(page, "#b07-focus", "0.72");
  await setRange(page, "#b07-spread", "0.88");
  await setRange(page, "#b07-noise", "0.62");
  await setRange(page, "#b07-samples", "13");
  await setRange(page, "#b07-strength", "0.84");
  const configured = await page.evaluate(() => window.__b07LabSnapshot());
  if (configured.quadraticVariation <= initial.quadraticVariation || configured.diffusionScale <= initial.diffusionScale || !/Ito|quadratic variation|dW|isometry|correction/i.test(configured.stateText)) {
    throw new Error(`B07 Ito controls are not concrete: ${JSON.stringify(configured)}`);
  }
  requireChanged(initial, configured, ["stochasticCalculusSceneHash", "brownianScalingHash", "itoIntegralHash", "sdeFlowHash", "reverseDiffusionHash", "itoFormulaHash", "generatorDensityHash"], "B07 controls", 6);

  await page.locator("[data-action='pulse']").click();
  await page.waitForFunction(() => window.__b07LabSnapshot().visualMode === "pulse");
  const pulsed = await page.evaluate(() => window.__b07LabSnapshot());
  if (!/pulse/i.test(pulsed.commandEffectHash) || !/Pulse.*Ito|Pulse.*dW|Pulse.*quadratic variation/i.test(pulsed.stateText)) {
    throw new Error(`B07 pulse action is not explicit: ${JSON.stringify(pulsed)}`);
  }
  requireChanged(configured, pulsed, ["commandEffectHash", "itoIntegralHash", "itoFormulaHash"], "B07 pulse", 1);

  await page.locator("[data-control='mode']").selectOption("reverse");
  await page.locator("[data-action='step']").click();
  await page.waitForFunction(() => window.__b07LabSnapshot().visualMode === "step");
  const stepped = await page.evaluate(() => window.__b07LabSnapshot());
  if (!/step/i.test(stepped.commandEffectHash) || !/Step.*reverse|Step.*score|Step.*denois|Step.*SDE/i.test(stepped.stateText)) {
    throw new Error(`B07 step action is not explicit: ${JSON.stringify(stepped)}`);
  }
  requireChanged(pulsed, stepped, ["commandEffectHash", "reverseDiffusionHash", "generatorDensityHash"], "B07 step", 2);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 700 } });
  try {
    await testB06(page);
    await testB07(page);
    console.log("B06/B07 canonical clarity checks passed");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
