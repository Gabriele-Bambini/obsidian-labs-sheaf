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
const CLARITY_VERSION = "b02-b03-canonical-clarity-v2";
const LEGACY_VERSION = "b02-b03-canonical-clarity-v1";

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

async function testB02(page) {
  const result = await loadLab(page, "b02-multivariate-probability-lab.html", "__b02LabReady", "__b02LabSnapshot");
  requireFit(result, "B02 desktop");
  const initial = result.snapshot;
  if (result.bytes < 12000 || initial.clarityVersion !== CLARITY_VERSION || initial.legacyClarityVersion !== LEGACY_VERSION || initial.labId !== "b02" || initial.has3d !== true) {
    throw new Error(`B02 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    jointDensityObjectCount: 45,
    marginalizationObjectCount: 14,
    conditionalSliceObjectCount: 4,
    covarianceGeometryObjectCount: 10,
    gaussianEllipsoidObjectCount: 4,
    dependenceTestObjectCount: 3
  }, "B02");
  requireFields(initial, [
    "jointSceneHash",
    "marginalizationHash",
    "conditionalGaussianHash",
    "covarianceGeometryHash",
    "independenceHash",
    "linearTransformHash",
    "commandEffectHash",
    "canonicalReferences",
    "multivariateProbabilityObjects",
    "diagnosticMetrics"
  ], "B02");
  requireIncludes(initial, "multivariateProbabilityObjects", [
    "joint_density_surface_grid",
    "joint_probability_mass_table",
    "x_marginal_projection_histogram",
    "y_marginal_projection_histogram",
    "marginalization_integrate_out_arrows",
    "conditional_slice_plane_x0",
    "conditional_density_y_given_x",
    "conditional_mean_shift_marker",
    "conditional_variance_shrink_band",
    "covariance_matrix_sigma_board",
    "covariance_ellipse_gaussian_law",
    "principal_eigenvector_axis",
    "minor_eigenvector_axis",
    "mahalanobis_distance_contour",
    "mean_vector_mu_marker",
    "correlation_tilt_hinge",
    "independence_product_grid",
    "chain_rule_factorization_beam",
    "gaussian_ellipsoid_volume_determinant",
    "linear_transform_covariance_pushforward",
    "integration_region_probability_patch"
  ], "B02");
  requireIncludes(initial, "diagnosticMetrics", [
    "correlation",
    "marginal_spread",
    "conditional_shift",
    "tail_mass",
    "determinant_sigma",
    "sigma_xx",
    "sigma_yy",
    "sigma_xy",
    "eigenvalue_major",
    "eigenvalue_minor",
    "conditional_mean",
    "conditional_variance",
    "mahalanobis_radius",
    "independence_gap",
    "marginal_mass_error",
    "gaussian_volume"
  ], "B02");
  if (!/joint|marginal|conditional|covariance|Gaussian/i.test(initial.stateText)) {
    throw new Error(`B02 state text is not textbook-specific: ${JSON.stringify(initial.stateText)}`);
  }

  await page.locator("[data-control='mode']").selectOption("conditional");
  await setRange(page, "#b02-focus", "0.78");
  await setRange(page, "#b02-spread", "0.33");
  await setRange(page, "#b02-noise", "0.12");
  await setRange(page, "#b02-strength", "0.88");
  const configured = await page.evaluate(() => window.__b02LabSnapshot());
  if (Math.abs(configured.correlation) <= Math.abs(initial.correlation) || !/conditional|slice|p\(Y\|X|E\[Y\|X\]|variance/i.test(configured.stateText)) {
    throw new Error(`B02 conditional controls are not concrete: ${JSON.stringify(configured)}`);
  }
  requireChanged(initial, configured, ["jointSceneHash", "marginalizationHash", "conditionalGaussianHash", "covarianceGeometryHash", "independenceHash", "linearTransformHash"], "B02 controls", 5);

  await page.locator("[data-action='pulse']").click();
  await page.waitForFunction(() => window.__b02LabSnapshot().visualMode === "pulse");
  const pulsed = await page.evaluate(() => window.__b02LabSnapshot());
  if (!/pulse/i.test(pulsed.commandEffectHash) || !/Pulse.*joint|Pulse.*marginal|Pulse.*conditional/i.test(pulsed.stateText)) {
    throw new Error(`B02 pulse action is not explicit: ${JSON.stringify(pulsed)}`);
  }
  requireChanged(configured, pulsed, ["commandEffectHash", "jointSceneHash", "marginalizationHash", "conditionalGaussianHash"], "B02 pulse", 1);

  await page.locator("[data-control='mode']").selectOption("gaussian");
  await page.locator("[data-action='step']").click();
  await page.waitForFunction(() => window.__b02LabSnapshot().visualMode === "step");
  const stepped = await page.evaluate(() => window.__b02LabSnapshot());
  if (!/step/i.test(stepped.commandEffectHash) || !/Step.*covariance|Step.*Gaussian|Step.*ellipse|Step.*marginal/i.test(stepped.stateText)) {
    throw new Error(`B02 step action is not explicit: ${JSON.stringify(stepped)}`);
  }
  requireChanged(pulsed, stepped, ["commandEffectHash", "covarianceGeometryHash", "linearTransformHash"], "B02 step", 2);
}

async function testB03(page) {
  const result = await loadLab(page, "b03-estimator-likelihood-lab.html", "__b03LabReady", "__b03LabSnapshot");
  requireFit(result, "B03 desktop");
  const initial = result.snapshot;
  if (result.bytes < 12000 || initial.clarityVersion !== CLARITY_VERSION || initial.legacyClarityVersion !== LEGACY_VERSION || initial.labId !== "b03" || initial.has3d !== true) {
    throw new Error(`B03 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    dataSampleObjectCount: 2,
    likelihoodObjectCount: 4,
    mleMapObjectCount: 4,
    samplingDistributionObjectCount: 3,
    biasVarianceObjectCount: 4,
    uncertaintyDiagnosticObjectCount: 6
  }, "B03");
  requireFields(initial, [
    "estimationSceneHash",
    "likelihoodHash",
    "samplingDistributionHash",
    "uncertaintyHash",
    "mleMapHash",
    "biasVarianceHash",
    "commandEffectHash",
    "canonicalReferences",
    "estimationObjects",
    "diagnosticMetrics"
  ], "B03");
  requireIncludes(initial, "estimationObjects", [
    "observed_sample_rug",
    "bernoulli_sufficient_statistic",
    "parameter_axis_theta",
    "likelihood_curve_l_theta",
    "log_likelihood_term_stack",
    "mle_theta_hat_marker",
    "score_derivative_zero_crossing",
    "map_prior_penalty_curve",
    "beta_prior_pseudocount_tanks",
    "posterior_mode_marker",
    "estimator_function_t_board",
    "sampling_distribution_cloud",
    "true_parameter_theta0_marker",
    "bias_vector",
    "variance_spread_ring",
    "mse_decomposition_board",
    "standard_error_ruler",
    "confidence_interval_band",
    "fisher_information_curvature_bowl",
    "identifiability_flat_ridge",
    "misspecification_warning_plate",
    "bootstrap_resample_beads",
    "outlier_influence_lever"
  ], "B03");
  requireIncludes(initial, "diagnosticMetrics", [
    "likelihood_peak",
    "estimator_bias",
    "variance",
    "ci_width",
    "mle_theta",
    "map_theta",
    "true_theta",
    "score_at_mle",
    "fisher_information",
    "standard_error",
    "mse",
    "bias_squared",
    "bootstrap_spread",
    "identifiability_score",
    "misspecification_risk",
    "outlier_influence"
  ], "B03");
  if (!/sample|likelihood|MLE|MAP|bias|variance|confidence/i.test(initial.stateText)) {
    throw new Error(`B03 state text is not estimation-specific: ${JSON.stringify(initial.stateText)}`);
  }

  await page.locator("[data-control='mode']").selectOption("mle");
  await setRange(page, "#b03-focus", "0.72");
  await setRange(page, "#b03-spread", "0.28");
  await setRange(page, "#b03-noise", "0.12");
  await setRange(page, "#b03-samples", "12");
  await setRange(page, "#b03-strength", "0.82");
  const configured = await page.evaluate(() => window.__b03LabSnapshot());
  if (configured.standardError >= initial.standardError || !/likelihood|MLE|MAP|score|theta/i.test(configured.stateText)) {
    throw new Error(`B03 MLE controls are not concrete: ${JSON.stringify(configured)}`);
  }
  requireChanged(initial, configured, ["estimationSceneHash", "likelihoodHash", "samplingDistributionHash", "uncertaintyHash", "mleMapHash", "biasVarianceHash"], "B03 controls", 5);

  await page.locator("[data-action='pulse']").click();
  await page.waitForFunction(() => window.__b03LabSnapshot().visualMode === "pulse");
  const pulsed = await page.evaluate(() => window.__b03LabSnapshot());
  if (!/pulse/i.test(pulsed.commandEffectHash) || !/Pulse.*likelihood|Pulse.*MLE|Pulse.*MAP|Pulse.*score/i.test(pulsed.stateText)) {
    throw new Error(`B03 pulse action is not explicit: ${JSON.stringify(pulsed)}`);
  }
  requireChanged(configured, pulsed, ["commandEffectHash", "likelihoodHash", "mleMapHash"], "B03 pulse", 1);

  await page.locator("[data-control='mode']").selectOption("bias");
  await page.locator("[data-action='step']").click();
  await page.waitForFunction(() => window.__b03LabSnapshot().visualMode === "step");
  const stepped = await page.evaluate(() => window.__b03LabSnapshot());
  if (!/step/i.test(stepped.commandEffectHash) || !/Step.*bias|Step.*variance|Step.*MSE|Step.*sampling/i.test(stepped.stateText)) {
    throw new Error(`B03 step action is not explicit: ${JSON.stringify(stepped)}`);
  }
  requireChanged(pulsed, stepped, ["commandEffectHash", "samplingDistributionHash", "biasVarianceHash"], "B03 step", 2);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 700 } });
  try {
    await testB02(page);
    await testB03(page);
    console.log("B02/B03 canonical clarity checks passed");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
