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
      // Try the next known runtime location.
    }
  }
  throw new Error(`Unable to load Playwright from: ${candidates.join(", ")}`);
}

const { chromium } = loadPlaywright();
const CLARITY_VERSION = "b08-b09-canonical-clarity-v2";
const LEGACY_VERSION = "b08-b09-canonical-clarity-v1";

async function loadLab(page, fileName, readyName, snapshotName) {
  const labPath = path.join(__dirname, fileName).replace(/\\/g, "/");
  await page.goto(`file:///${labPath}?canonical-clarity=1`);
  await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
  await page.waitForFunction(
    ([ready, snapshot]) => window[ready] === true && typeof window[snapshot] === "function" && window[snapshot](),
    [readyName, snapshotName]
  );
  await page.waitForTimeout(260);
  return page.evaluate((snapshotName) => {
    const canvas = document.querySelector(".lab-viewport canvas");
    return {
      bytes: canvas.toDataURL("image/png").length,
      snapshot: window[snapshotName](),
      buttons: [...document.querySelectorAll("button")].map((node) => node.textContent.trim()),
      rail: [...document.querySelectorAll(".concept-rail span:not(.rail-alias)")].map((node) => node.textContent.trim()),
      railAliases: [...document.querySelectorAll(".concept-rail span.rail-alias")].map((node) => node.textContent.trim()),
      commandBarHeight: document.querySelector(".command-bar")?.getBoundingClientRect().height || 0,
      overflowX: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
      overflowY: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight
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

function requireIncludes(list, expected, lab) {
  for (const item of expected) {
    if (!Array.isArray(list) || !list.includes(item)) {
      throw new Error(`${lab} missing "${item}". Found: ${(list || []).join(" | ")}`);
    }
  }
}

function requireFiniteNumbers(object, keys, lab) {
  for (const key of keys) {
    if (!Number.isFinite(object[key])) {
      throw new Error(`${lab} missing finite telemetry "${key}": ${JSON.stringify(object)}.`);
    }
  }
}

function requireVersion(snapshot, lab) {
  if (snapshot.clarityVersion !== CLARITY_VERSION || snapshot.legacyClarityVersion !== LEGACY_VERSION) {
    throw new Error(`${lab} should expose v2 clarity with v1 compatibility: ${JSON.stringify(snapshot)}.`);
  }
  if (snapshot.has3d !== true || !snapshot.labId) {
    throw new Error(`${lab} should identify the 3D lab shell: ${JSON.stringify(snapshot)}.`);
  }
}

function requireStateText(snapshot, regex, lab) {
  if (!regex.test(snapshot.stateText || "")) {
    throw new Error(`${lab} state text did not explain the visible phenomenon: ${snapshot.stateText}`);
  }
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1180, height: 700 } });

  try {
    const b08 = await loadLab(page, "b08-information-geometry-lab.html", "__b08LabReady", "__b08LabSnapshot");
    if (b08.bytes < 15000 || b08.overflowX > 18 || b08.overflowY > 18 || b08.commandBarHeight > 170) {
      throw new Error(`B08 render should be fitted and readable: ${JSON.stringify(b08)}.`);
    }
    requireVersion(b08.snapshot, "B08");
    if (
      b08.snapshot.statisticalManifoldObjectCount < 4 ||
      b08.snapshot.fisherMetricObjectCount < 5 ||
      b08.snapshot.klGeometryObjectCount < 5 ||
      b08.snapshot.reparameterizationObjectCount < 4 ||
      b08.snapshot.naturalGradientObjectCount < 4 ||
      b08.snapshot.projectionPriorObjectCount < 6
    ) {
      throw new Error(`B08 lacks a full canonical information-geometry object inventory: ${JSON.stringify(b08.snapshot)}.`);
    }
    requireIncludes(b08.snapshot.informationGeometryObjects, [
      "statistical_manifold_surface_distributions_p_theta",
      "coordinate_chart_theta_grid",
      "distribution_point_p_theta_bead",
      "probability_simplex_distribution_towers",
      "score_function_centered_bars_si",
      "fisher_information_matrix_iij_board",
      "fisher_metric_local_ellipse_unit_ball",
      "kl_quadratic_neighborhood_contours",
      "line_element_ds_squared_ruler",
      "reparameterization_chart_p_to_eta_bridge",
      "jacobian_transform_j_transpose_i_j_plate",
      "bernoulli_boundary_fisher_stretch_rail",
      "jeffreys_prior_sqrt_det_i_density",
      "euclidean_gradient_arrow",
      "natural_gradient_i_inverse_grad_arrow",
      "kl_trust_region_ball",
      "geodesic_on_statistical_manifold",
      "coordinate_chord_comparison",
      "exponential_family_natural_coordinate_theta_rail",
      "mean_parameter_mu_dual_rail",
      "legendre_dual_potential_bridge",
      "forward_kl_projection_panel",
      "reverse_kl_mode_seeking_panel",
      "fisher_spectrum_eigenvalue_bars",
      "sloppy_null_direction_sheet",
      "normal_family_scale_sigma_wall"
    ], "B08 objects");
    requireIncludes(b08.snapshot.canonicalReferences, [
      "Amari information geometry",
      "Fisher-Rao metric",
      "KL local quadratic",
      "Jeffreys prior",
      "natural gradient"
    ], "B08 references");
    requireFiniteNumbers(b08.snapshot, [
      "fisherLength", "klProjection", "geodesicGap", "curvature", "mu", "sigma",
      "fisherMuMu", "fisherSigmaSigma", "detFisher", "fisherMatrixCondition",
      "localKlQuadratic", "jeffreysDensity", "jeffreysPriorMass", "naturalGradientGain",
      "euclideanGradientNorm", "naturalStepNorm", "trustRegionRadius", "geodesicLength",
      "chordLength", "forwardReverseKlGap", "fisherSpectrumMin", "fisherSpectrumMax",
      "sloppyDirectionStrength", "bernoulliBoundaryStretch", "normalScaleVolume"
    ], "B08");
    requireIncludes(b08.snapshot.diagnosticMetrics, [
      "fisher_length", "kl_projection", "geodesic_gap", "curvature", "fisher_mu_mu",
      "fisher_sigma_sigma", "det_fisher", "local_kl_quadratic", "jeffreys_density",
      "natural_step_norm", "forward_reverse_kl_gap"
    ], "B08 diagnostics");
    if (!b08.snapshot.jeffreysPriorHash || !b08.snapshot.geodesicProjectionHash || !b08.snapshot.commandEffectHash) {
      throw new Error(`B08 should expose Jeffreys/geodesic/command hashes: ${JSON.stringify(b08.snapshot)}.`);
    }
    requireStateText(b08.snapshot, /statistical|manifold|Fisher|KL|natural|Jeffreys|geodesic/i, "B08 initial");
    const b08InitialHashes = [
      b08.snapshot.informationGeometryHash,
      b08.snapshot.fisherMetricHash,
      b08.snapshot.naturalGradientHash,
      b08.snapshot.klProjectionHash,
      b08.snapshot.reparameterizationHash,
      b08.snapshot.jeffreysPriorHash,
      b08.snapshot.geodesicProjectionHash,
      b08.snapshot.commandEffectHash
    ];
    await page.selectOption("[data-control='mode']", "fisher");
    await setRange(page, "#b08-focus", "0.78");
    await setRange(page, "#b08-strength", "0.86");
    await setRange(page, "#b08-spread", "0.34");
    await page.waitForTimeout(160);
    const b08Fisher = await page.evaluate(() => window.__b08LabSnapshot());
    requireStateText(b08Fisher, /Fisher|metric|KL|ellipse/i, "B08 Fisher");
    const b08Changed = b08InitialHashes.filter((hash, index) => hash !== [
      b08Fisher.informationGeometryHash,
      b08Fisher.fisherMetricHash,
      b08Fisher.naturalGradientHash,
      b08Fisher.klProjectionHash,
      b08Fisher.reparameterizationHash,
      b08Fisher.jeffreysPriorHash,
      b08Fisher.geodesicProjectionHash,
      b08Fisher.commandEffectHash
    ][index]).length;
    if (b08Changed < 5 || b08Fisher.naturalGradientGain <= b08.snapshot.naturalGradientGain) {
      throw new Error(`B08 controls should visibly reshape the information geometry: ${JSON.stringify({ before: b08.snapshot, after: b08Fisher })}.`);
    }
    await page.locator("[data-action='pulse']").click();
    await page.waitForTimeout(120);
    const b08Pulse = await page.evaluate(() => window.__b08LabSnapshot());
    requireStateText(b08Pulse, /Pulse.*(Fisher|metric|KL)/i, "B08 pulse");
    await page.selectOption("[data-control='mode']", "natural");
    await page.locator("[data-action='step']").click();
    await page.waitForTimeout(120);
    const b08Step = await page.evaluate(() => window.__b08LabSnapshot());
    requireStateText(b08Step, /Step.*(natural|gradient|geodesic|KL)/i, "B08 step");

    const b09 = await loadLab(page, "b09-nonparametric-statistics-lab.html", "__b09LabReady", "__b09LabSnapshot");
    if (b09.bytes < 15000 || b09.overflowX > 18 || b09.overflowY > 18 || b09.commandBarHeight > 170) {
      throw new Error(`B09 render should be fitted and readable: ${JSON.stringify(b09)}.`);
    }
    requireVersion(b09.snapshot, "B09");
    if (
      b09.snapshot.dataAnchorObjectCount < 8 ||
      b09.snapshot.densitySmoothingObjectCount < 9 ||
      b09.snapshot.kernelRegressionObjectCount < 5 ||
      b09.snapshot.splineGpObjectCount < 7 ||
      b09.snapshot.adaptiveNonparametricObjectCount < 6 ||
      b09.snapshot.diagnosticObjectCount < 2
    ) {
      throw new Error(`B09 lacks a full canonical nonparametric object inventory: ${JSON.stringify(b09.snapshot)}.`);
    }
    requireIncludes(b09.snapshot.nonparametricObjects, [
      "data_sample_rug_observations_xi",
      "histogram_bins_width_h",
      "bin_origin_shift_ghost_bins",
      "kernel_bump_centered_on_each_sample",
      "kde_summed_density_curve_f_hat_h",
      "bandwidth_ruler_h",
      "undersmoothing_spike_lane",
      "oversmoothing_merged_mode_lane",
      "bimodal_valley_preservation_marker",
      "local_window_count_n_h_to_d_meter",
      "curse_of_dimensionality_sparse_cube",
      "nadaraya_watson_query_point_x_star",
      "kernel_weight_spokes_k_distance_over_h",
      "local_weighted_average_prediction_m_hat",
      "local_polynomial_boundary_line",
      "smoothing_spline_roughness_penalty_beam",
      "spline_knot_basis_functions",
      "gaussian_process_prior_function_samples",
      "gp_covariance_matrix_k_board",
      "gp_posterior_mean_curve",
      "gp_uncertainty_band_shrinks_near_data",
      "kernel_lengthscale_ell_ruler",
      "k_nearest_neighbor_adaptive_radius_dense",
      "k_nearest_neighbor_adaptive_radius_sparse",
      "dirichlet_process_restaurant_tables",
      "new_cluster_probability_alpha_over_n_alpha",
      "occupied_cluster_growth_bars",
      "infinite_mixture_atom_sticks",
      "cross_validation_smoothing_curve",
      "bias_variance_tradeoff_balance"
    ], "B09 objects");
    requireIncludes(b09.snapshot.canonicalReferences, [
      "kernel density estimation",
      "Nadaraya-Watson regression",
      "smoothing splines",
      "Gaussian process regression",
      "Dirichlet process"
    ], "B09 references");
    requireFiniteNumbers(b09.snapshot, [
      "bandwidth", "bootstrapSpread", "edfGap", "smoothRisk", "kdeBandwidth", "sampleCount",
      "kernelCount", "histogramBinCount", "effectiveDegreesFreedom", "modeCountEstimate",
      "valleyDepth", "localSampleCount", "curseDimensionalityPressure", "kernelWeightEntropy",
      "queryX", "nadarayaWatsonPrediction", "splineRoughness", "gpPosteriorVariance",
      "gpLengthscale", "knnDenseRadius", "knnSparseRadius", "dpNewClusterProbability",
      "occupiedClusterEstimate", "crossValidationRisk", "biasVarianceBalance"
    ], "B09");
    requireIncludes(b09.snapshot.diagnosticMetrics, [
      "bandwidth", "bootstrap_spread", "effective_degrees_freedom", "mode_count_estimate",
      "local_sample_count", "curse_dimensionality_pressure", "nadaraya_watson_prediction",
      "gp_posterior_variance", "dp_new_cluster_probability", "cross_validation_risk"
    ], "B09 diagnostics");
    if (!b09.snapshot.smoothingDiagnosticHash || !b09.snapshot.adaptiveComplexityHash || !b09.snapshot.commandEffectHash) {
      throw new Error(`B09 should expose smoothing/adaptive/command hashes: ${JSON.stringify(b09.snapshot)}.`);
    }
    requireStateText(b09.snapshot, /non-parametric|sample|kernel|KDE|bandwidth|GP|Dirichlet|smoothing/i, "B09 initial");
    const b09InitialHashes = [
      b09.snapshot.nonparametricSceneHash,
      b09.snapshot.kdeHash,
      b09.snapshot.regressionHash,
      b09.snapshot.gpDpHash,
      b09.snapshot.bootstrapBandHash,
      b09.snapshot.smoothingDiagnosticHash,
      b09.snapshot.adaptiveComplexityHash,
      b09.snapshot.commandEffectHash
    ];
    await page.selectOption("[data-control='mode']", "kde");
    await setRange(page, "#b09-spread", "0.88");
    await setRange(page, "#b09-samples", "13");
    await setRange(page, "#b09-strength", "0.74");
    await page.waitForTimeout(160);
    const b09Kde = await page.evaluate(() => window.__b09LabSnapshot());
    requireStateText(b09Kde, /KDE|bandwidth|kernel|smoothing/i, "B09 KDE");
    const b09Changed = b09InitialHashes.filter((hash, index) => hash !== [
      b09Kde.nonparametricSceneHash,
      b09Kde.kdeHash,
      b09Kde.regressionHash,
      b09Kde.gpDpHash,
      b09Kde.bootstrapBandHash,
      b09Kde.smoothingDiagnosticHash,
      b09Kde.adaptiveComplexityHash,
      b09Kde.commandEffectHash
    ][index]).length;
    if (b09Changed < 5 || b09Kde.kdeBandwidth <= b09.snapshot.kdeBandwidth || b09Kde.localSampleCount <= b09.snapshot.localSampleCount) {
      throw new Error(`B09 controls should visibly reshape nonparametric smoothing: ${JSON.stringify({ before: b09.snapshot, after: b09Kde })}.`);
    }
    await page.locator("[data-action='pulse']").click();
    await page.waitForTimeout(120);
    const b09Pulse = await page.evaluate(() => window.__b09LabSnapshot());
    requireStateText(b09Pulse, /Pulse.*kernel/i, "B09 pulse");
    await page.selectOption("[data-control='mode']", "bootstrap");
    await page.locator("[data-action='step']").click();
    await page.waitForTimeout(120);
    const b09Step = await page.evaluate(() => window.__b09LabSnapshot());
    requireStateText(b09Step, /Step.*(bootstrap|resample|uncertainty|empirical)/i, "B09 step");
  } finally {
    await browser.close();
  }

  console.log("b08-b09 canonical clarity passed: textbook objects, fitted shell, real commands, and diagnostic telemetry are exposed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
