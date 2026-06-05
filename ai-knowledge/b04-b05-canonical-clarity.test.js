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
const CLARITY_VERSION = "b04-b05-canonical-clarity-v2";
const LEGACY_VERSION = "b04-b05-canonical-clarity-v1";

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

async function testB04(page) {
  const result = await loadLab(page, "b04-hypothesis-testing-lab.html", "__b04LabReady", "__b04LabSnapshot");
  requireFit(result, "B04 desktop");
  const initial = result.snapshot;
  if (result.bytes < 12000 || initial.clarityVersion !== CLARITY_VERSION || initial.legacyClarityVersion !== LEGACY_VERSION || initial.labId !== "b04" || initial.has3d !== true) {
    throw new Error(`B04 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    nullModelObjectCount: 3,
    pValueDecisionObjectCount: 6,
    errorPowerObjectCount: 6,
    intervalEffectObjectCount: 4,
    resamplingObjectCount: 3,
    multipleTestingObjectCount: 4
  }, "B04");
  requireFields(initial, [
    "hypothesisSceneHash",
    "pValueTailHash",
    "powerDecisionHash",
    "multipleTestingHash",
    "ciDecisionHash",
    "resamplingHash",
    "commandEffectHash",
    "canonicalReferences",
    "hypothesisTestingObjects",
    "diagnosticMetrics"
  ], "B04");
  requireIncludes(initial, "hypothesisTestingObjects", [
    "null_distribution_h0_bell_curve",
    "alternative_distribution_h1_shifted_bell_curve",
    "observed_test_statistic_t_obs_marker",
    "critical_value_threshold_wall",
    "alpha_rejection_region_tail_under_h0",
    "p_value_observed_tail_under_h0",
    "type_i_error_alpha_gauge",
    "type_ii_error_beta_area_under_h1",
    "power_area_one_minus_beta",
    "effect_size_shift_arrow",
    "sample_size_standard_error_shrinker",
    "confidence_interval_test_bridge",
    "decision_table_type_i_type_ii_board",
    "one_sided_two_sided_tail_splitter",
    "coin_bias_binomial_count_plate",
    "paired_differences_di_strip",
    "permutation_null_shuffle_board",
    "multiple_testing_family_grid",
    "bonferroni_alpha_ladder",
    "fdr_ordered_p_value_staircase",
    "practical_significance_effect_ruler"
  ], "B04");
  requireIncludes(initial, "diagnosticMetrics", [
    "p_value",
    "power",
    "type_i_risk",
    "effect_size",
    "alpha_level",
    "critical_value",
    "observed_statistic",
    "standard_error",
    "beta_risk",
    "rejection_width",
    "p_tail_mass",
    "sample_size",
    "false_discovery_risk",
    "bonferroni_alpha",
    "fdr_threshold",
    "confidence_interval_low",
    "confidence_interval_high",
    "practical_significance_gap",
    "permutation_p_value",
    "paired_gain"
  ], "B04");
  if (!/null|test statistic|p-value|rejection|Type I|power/i.test(initial.stateText)) {
    throw new Error(`B04 state text is not hypothesis-testing-specific: ${JSON.stringify(initial.stateText)}`);
  }

  await page.locator("[data-control='mode']").selectOption("pvalue");
  await setRange(page, "#b04-focus", "0.82");
  await setRange(page, "#b04-spread", "0.3");
  await setRange(page, "#b04-noise", "0.1");
  await setRange(page, "#b04-samples", "13");
  await setRange(page, "#b04-strength", "0.9");
  const configured = await page.evaluate(() => window.__b04LabSnapshot());
  if (configured.power <= initial.power || configured.pValue >= initial.pValue || !/p-value|tail|observed|critical|reject/i.test(configured.stateText)) {
    throw new Error(`B04 p-value controls are not concrete: ${JSON.stringify(configured)}`);
  }
  requireChanged(initial, configured, ["hypothesisSceneHash", "pValueTailHash", "powerDecisionHash", "multipleTestingHash", "ciDecisionHash", "resamplingHash"], "B04 controls", 5);

  await page.locator("[data-action='pulse']").click();
  await page.waitForFunction(() => window.__b04LabSnapshot().visualMode === "pulse");
  const pulsed = await page.evaluate(() => window.__b04LabSnapshot());
  if (!/pulse/i.test(pulsed.commandEffectHash) || !/Pulse.*p-value|Pulse.*null|Pulse.*rejection/i.test(pulsed.stateText)) {
    throw new Error(`B04 pulse action is not explicit: ${JSON.stringify(pulsed)}`);
  }
  requireChanged(configured, pulsed, ["commandEffectHash", "pValueTailHash", "hypothesisSceneHash"], "B04 pulse", 1);

  await page.locator("[data-control='mode']").selectOption("power");
  await page.locator("[data-action='step']").click();
  await page.waitForFunction(() => window.__b04LabSnapshot().visualMode === "step");
  const stepped = await page.evaluate(() => window.__b04LabSnapshot());
  if (!/step/i.test(stepped.commandEffectHash) || !/Step.*power|Step.*Type II|Step.*alternative|Step.*sample/i.test(stepped.stateText)) {
    throw new Error(`B04 step action is not explicit: ${JSON.stringify(stepped)}`);
  }
  requireChanged(pulsed, stepped, ["commandEffectHash", "powerDecisionHash", "ciDecisionHash"], "B04 step", 2);
}

async function testB05(page) {
  const result = await loadLab(page, "b05-bayesian-updating.html", "__b05LabReady", "__b05LabSnapshot");
  requireFit(result, "B05 desktop");
  const initial = result.snapshot;
  if (result.bytes < 12000 || initial.clarityVersion !== CLARITY_VERSION || initial.legacyClarityVersion !== LEGACY_VERSION || initial.labId !== "b05" || initial.has3d !== true) {
    throw new Error(`B05 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    priorLikelihoodObjectCount: 5,
    posteriorUpdateObjectCount: 8,
    predictiveObjectCount: 2,
    baseRateDiagnosticObjectCount: 3,
    approximationObjectCount: 5,
    posteriorCheckObjectCount: 1
  }, "B05");
  requireFields(initial, [
    "bayesianSceneHash",
    "conjugateUpdateHash",
    "predictiveHash",
    "approximationHash",
    "evidenceHash",
    "bayesRuleHash",
    "commandEffectHash",
    "canonicalReferences",
    "bayesianInferenceObjects",
    "diagnosticMetrics"
  ], "B05");
  requireIncludes(initial, "bayesianInferenceObjects", [
    "beta_prior_density_p_theta_curve",
    "bernoulli_likelihood_p_d_given_theta_curve",
    "posterior_density_p_theta_given_d_curve",
    "evidence_normalizer_integral_tray",
    "prior_likelihood_multiplication_board",
    "beta_alpha_beta_pseudocount_tanks",
    "observed_heads_tails_data_beads",
    "conjugate_update_alpha_plus_h_beta_plus_t_arrows",
    "posterior_mean_marker",
    "map_posterior_mode_marker",
    "mle_likelihood_peak_marker",
    "credible_interval_posterior_band",
    "posterior_predictive_next_observation_coin",
    "rare_disease_base_rate_tree",
    "sensitivity_false_positive_likelihood_bars",
    "posterior_odds_bayes_factor_scale",
    "mcmc_posterior_sample_trace",
    "variational_q_phi_approximation_curve",
    "elbo_reconstruction_kl_balance",
    "laplace_gaussian_around_map",
    "posterior_predictive_check_replica_beads"
  ], "B05");
  requireIncludes(initial, "diagnosticMetrics", [
    "posterior_mean",
    "posterior_precision",
    "bayes_factor",
    "credible_width",
    "prior_alpha",
    "prior_beta",
    "heads",
    "tails",
    "posterior_alpha",
    "posterior_beta",
    "evidence_normalizer",
    "posterior_mode",
    "mle_theta",
    "credible_low",
    "credible_high",
    "predictive_probability",
    "prior_influence",
    "likelihood_influence",
    "mcmc_effective_samples",
    "variational_gap",
    "laplace_curvature",
    "posterior_check_discrepancy",
    "base_rate_posterior"
  ], "B05");
  if (!/prior|likelihood|posterior|Bayes|credible|predictive/i.test(initial.stateText)) {
    throw new Error(`B05 state text is not Bayesian-specific: ${JSON.stringify(initial.stateText)}`);
  }

  await page.locator("[data-control='mode']").selectOption("posterior");
  await setRange(page, "#b05-focus", "0.76");
  await setRange(page, "#b05-spread", "0.3");
  await setRange(page, "#b05-noise", "0.1");
  await setRange(page, "#b05-samples", "13");
  await setRange(page, "#b05-strength", "0.88");
  const configured = await page.evaluate(() => window.__b05LabSnapshot());
  if (configured.posteriorPrecision <= initial.posteriorPrecision || configured.credibleWidth >= initial.credibleWidth || !/posterior|prior|likelihood|evidence|Beta/i.test(configured.stateText)) {
    throw new Error(`B05 posterior controls are not concrete: ${JSON.stringify(configured)}`);
  }
  requireChanged(initial, configured, ["bayesianSceneHash", "conjugateUpdateHash", "predictiveHash", "approximationHash", "evidenceHash", "bayesRuleHash"], "B05 controls", 5);

  await page.locator("[data-action='pulse']").click();
  await page.waitForFunction(() => window.__b05LabSnapshot().visualMode === "pulse");
  const pulsed = await page.evaluate(() => window.__b05LabSnapshot());
  if (!/pulse/i.test(pulsed.commandEffectHash) || !/Pulse.*prior|Pulse.*likelihood|Pulse.*posterior|Pulse.*Bayes/i.test(pulsed.stateText)) {
    throw new Error(`B05 pulse action is not explicit: ${JSON.stringify(pulsed)}`);
  }
  requireChanged(configured, pulsed, ["commandEffectHash", "bayesRuleHash", "conjugateUpdateHash"], "B05 pulse", 1);

  await page.locator("[data-control='mode']").selectOption("predictive");
  await page.locator("[data-action='step']").click();
  await page.waitForFunction(() => window.__b05LabSnapshot().visualMode === "step");
  const stepped = await page.evaluate(() => window.__b05LabSnapshot());
  if (!/step/i.test(stepped.commandEffectHash) || !/Step.*predictive|Step.*posterior|Step.*credible|Step.*replica/i.test(stepped.stateText)) {
    throw new Error(`B05 step action is not explicit: ${JSON.stringify(stepped)}`);
  }
  requireChanged(pulsed, stepped, ["commandEffectHash", "predictiveHash", "approximationHash"], "B05 step", 2);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 700 } });
  try {
    await testB04(page);
    await testB05(page);
    console.log("B04/B05 canonical clarity checks passed");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
