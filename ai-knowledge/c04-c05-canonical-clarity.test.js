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
const CLARITY_VERSION = "c04-c05-canonical-clarity-v2";
const LEGACY_VERSION = "c04-c05-canonical-clarity-v1";

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
    const c04 = await loadLab(page, "c04-stochastic-optimization-lab.html", "__c04LabReady", "__c04LabSnapshot");
    if (c04.bytes < 15000 || c04.overflowX > 18 || c04.overflowY > 18 || c04.commandBarHeight > 170) {
      throw new Error(`C04 render should be fitted and readable: ${JSON.stringify(c04)}.`);
    }
    requireVersion(c04.snapshot, "C04");
    if (
      c04.snapshot.finiteSumObjectCount < 3 ||
      c04.snapshot.minibatchEstimatorObjectCount < 5 ||
      c04.snapshot.varianceScheduleObjectCount < 3 ||
      c04.snapshot.momentumAdamObjectCount < 6 ||
      c04.snapshot.varianceReductionObjectCount < 4 ||
      c04.snapshot.stochasticDiagnosticObjectCount < 2
    ) {
      throw new Error(`C04 lacks a full canonical stochastic-optimization inventory: ${JSON.stringify(c04.snapshot)}.`);
    }
    requireIncludes(c04.snapshot.stochasticOptimizationObjects, [
      "noisy_quadratic_optimizer_loss_surface",
      "full_gradient_arrow_on_loss_surface",
      "per_example_stochastic_gradient_fan",
      "minibatch_mean_gradient_arrow",
      "noise_covariance_ellipse_shrinks_with_batch_size",
      "finite_sum_empirical_risk_dataset_tiles_l_theta_equals_1_over_n_sum_i_ell_i",
      "unbiased_estimator_expectation_balance_e_g_k_equals_grad_l",
      "variance_scales_as_sigma_squared_over_batch_gauge",
      "learning_rate_schedule_rail_alpha_k",
      "momentum_velocity_vector",
      "adam_first_moment_m_k_accumulator",
      "adam_second_moment_s_k_denominator_tank",
      "adam_bias_correction_board",
      "adamw_decoupled_weight_decay_shrink_rail",
      "svrg_snapshot_full_gradient_anchor",
      "svrg_control_variate_corrected_gradient_arrow",
      "polyak_ruppert_iterate_averaging_cloud",
      "gradient_clipping_gate"
    ], "C04 objects");
    requireIncludes(c04.snapshot.canonicalReferences, [
      "Robbins Monro stochastic approximation",
      "minibatch unbiased gradient estimator",
      "momentum exponential averaging",
      "Adam AdamW adaptive moments",
      "SVRG variance reduction"
    ], "C04 references");
    requireFiniteNumbers(c04.snapshot, [
      "gradientVariance", "updateNorm", "gradientAngleError", "batchCoverage", "unbiasednessError",
      "varianceReductionRatio", "learningRate", "momentumEnergy", "velocityNorm", "adamScaleX",
      "adamScaleZ", "adamFirstMomentNorm", "adamSecondMomentScale", "biasCorrection",
      "weightDecayShrink", "svrgVariance", "svrgCorrectionNorm", "averagingRadius", "clipFraction"
    ], "C04");
    requireIncludes(c04.snapshot.diagnosticMetrics, [
      "gradient_variance", "update_norm", "gradient_angle_error", "batch_coverage",
      "unbiasedness_error", "variance_reduction_ratio", "learning_rate",
      "momentum_energy", "adam_scale", "bias_correction", "svrg_variance", "clip_fraction"
    ], "C04 diagnostics");
    if (!c04.snapshot.learningRateScheduleHash || !c04.snapshot.momentumStateHash || !c04.snapshot.optimizerNoiseHash || !c04.snapshot.commandEffectHash) {
      throw new Error(`C04 should expose schedule/momentum/noise/command hashes: ${JSON.stringify(c04.snapshot)}.`);
    }
    requireStateText(c04.snapshot, /stochastic|SGD|minibatch|gradient|noise|Adam|momentum|variance/i, "C04 initial");
    const c04InitialHashes = [
      c04.snapshot.stochasticSceneHash,
      c04.snapshot.minibatchEstimatorHash,
      c04.snapshot.adamMechanismHash,
      c04.snapshot.varianceReductionHash,
      c04.snapshot.learningRateScheduleHash,
      c04.snapshot.momentumStateHash,
      c04.snapshot.optimizerNoiseHash,
      c04.snapshot.commandEffectHash
    ];
    await page.selectOption("[data-control='mode']", "minibatch");
    await setRange(page, "#c04-noise", "0.78");
    await setRange(page, "#c04-budget", "12");
    await setRange(page, "#c04-step", "0.74");
    await setRange(page, "#c04-regularization", "0.82");
    await page.waitForTimeout(160);
    const c04Minibatch = await page.evaluate(() => window.__c04LabSnapshot());
    requireStateText(c04Minibatch, /Minibatch|variance|batch|average|gradient/i, "C04 minibatch");
    const c04Changed = c04InitialHashes.filter((hash, index) => hash !== [
      c04Minibatch.stochasticSceneHash,
      c04Minibatch.minibatchEstimatorHash,
      c04Minibatch.adamMechanismHash,
      c04Minibatch.varianceReductionHash,
      c04Minibatch.learningRateScheduleHash,
      c04Minibatch.momentumStateHash,
      c04Minibatch.optimizerNoiseHash,
      c04Minibatch.commandEffectHash
    ][index]).length;
    if (c04Changed < 6 || c04Minibatch.updateNorm <= c04.snapshot.updateNorm || c04Minibatch.batchCoverage <= c04.snapshot.batchCoverage) {
      throw new Error(`C04 controls should visibly reshape stochastic diagnostics: ${JSON.stringify({ before: c04.snapshot, after: c04Minibatch })}.`);
    }
    await page.selectOption("[data-control='mode']", "sgd");
    await page.locator("[data-action='pulse']").click();
    await page.waitForTimeout(120);
    const c04Pulse = await page.evaluate(() => window.__c04LabSnapshot());
    requireStateText(c04Pulse, /Pulse.*(unbiased|stochastic|gradient|variance|scatter)/i, "C04 pulse");
    await page.selectOption("[data-control='mode']", "adam");
    await page.locator("[data-action='step']").click();
    await page.waitForTimeout(120);
    const c04Step = await page.evaluate(() => window.__c04LabSnapshot());
    requireStateText(c04Step, /Step.*(Adam|moment|bias|AdamW|rescale)/i, "C04 step");

    const c05 = await loadLab(page, "c05-euler-lagrange-action-lab.html", "__c05LabReady", "__c05LabSnapshot");
    if (c05.bytes < 15000 || c05.overflowX > 18 || c05.overflowY > 18 || c05.commandBarHeight > 170) {
      throw new Error(`C05 render should be fitted and readable: ${JSON.stringify(c05)}.`);
    }
    requireVersion(c05.snapshot, "C05");
    if (
      c05.snapshot.functionSpaceObjectCount < 4 ||
      c05.snapshot.variationObjectCount < 5 ||
      c05.snapshot.eulerLagrangeObjectCount < 5 ||
      c05.snapshot.boundaryConstraintObjectCount < 4 ||
      c05.snapshot.pdeMechanicsObjectCount < 5 ||
      c05.snapshot.variationalDiagnosticObjectCount < 2
    ) {
      throw new Error(`C05 lacks a full canonical calculus-of-variations inventory: ${JSON.stringify(c05.snapshot)}.`);
    }
    requireIncludes(c05.snapshot.calculusOfVariationsObjects, [
      "function_space_curve_runway",
      "candidate_admissible_curve_y_x",
      "stationary_euler_lagrange_target_curve",
      "admissible_variation_eta_zero_at_endpoints",
      "perturbed_curve_y_plus_epsilon_eta",
      "functional_action_integral_quadrature_columns",
      "local_lagrangian_density_l_x_y_yprime_sheet",
      "integration_by_parts_boundary_bracket",
      "euler_lagrange_residual_coefficient_bracket",
      "fundamental_lemma_test_function_weight_sheet",
      "shortest_path_straight_line_extremal_panel",
      "dirichlet_energy_membrane_with_laplace_residual_grid",
      "natural_boundary_free_endpoint_gate",
      "isoperimetric_multiplier_constraint_ring",
      "brachistochrone_cycloid_bead_time_track",
      "beltrami_conserved_quantity_gauge",
      "pinn_collocation_residual_sample_points"
    ], "C05 objects");
    requireIncludes(c05.snapshot.canonicalReferences, [
      "Euler Lagrange equation",
      "integration by parts boundary term",
      "Dirichlet energy Laplace equation",
      "brachistochrone cycloid Beltrami identity",
      "PINN collocation residual"
    ], "C05 references");
    requireFiniteNumbers(c05.snapshot, [
      "actionValue", "eulerResidual", "boundaryDefect", "firstVariation", "epsilon",
      "quadratureSamples", "densityIntegral", "quadratureError", "endpointError",
      "naturalBoundaryResidual", "dirichletEnergy", "laplaceResidual", "beltramiDrift",
      "constraintResidual", "pinnSamplingGap", "cycloidTime", "straightPathTime"
    ], "C05");
    requireIncludes(c05.snapshot.diagnosticMetrics, [
      "action_value", "euler_residual", "boundary_defect", "first_variation",
      "epsilon", "quadrature_samples", "density_integral", "natural_boundary_residual",
      "dirichlet_energy", "laplace_residual", "beltrami_drift", "constraint_residual"
    ], "C05 diagnostics");
    if (!c05.snapshot.functionalActionHash || !c05.snapshot.variationPerturbationHash || !c05.snapshot.pdeMechanicsHash || !c05.snapshot.commandEffectHash) {
      throw new Error(`C05 should expose functional/variation/PDE/command hashes: ${JSON.stringify(c05.snapshot)}.`);
    }
    requireStateText(c05.snapshot, /functional|variation|Euler|boundary|action|curve|Laplace|brachistochrone/i, "C05 initial");
    const c05InitialHashes = [
      c05.snapshot.variationalSceneHash,
      c05.snapshot.eulerLagrangeHash,
      c05.snapshot.boundaryTermHash,
      c05.snapshot.dirichletBrachistochroneHash,
      c05.snapshot.functionalActionHash,
      c05.snapshot.variationPerturbationHash,
      c05.snapshot.pdeMechanicsHash,
      c05.snapshot.commandEffectHash
    ];
    await page.selectOption("[data-control='mode']", "variation");
    await setRange(page, "#c05-noise", "0.76");
    await setRange(page, "#c05-budget", "13");
    await setRange(page, "#c05-step", "0.7");
    await setRange(page, "#c05-regularization", "0.82");
    await page.waitForTimeout(160);
    const c05Variation = await page.evaluate(() => window.__c05LabSnapshot());
    requireStateText(c05Variation, /Variation|epsilon|perturb|curve|eta/i, "C05 variation");
    const c05Changed = c05InitialHashes.filter((hash, index) => hash !== [
      c05Variation.variationalSceneHash,
      c05Variation.eulerLagrangeHash,
      c05Variation.boundaryTermHash,
      c05Variation.dirichletBrachistochroneHash,
      c05Variation.functionalActionHash,
      c05Variation.variationPerturbationHash,
      c05Variation.pdeMechanicsHash,
      c05Variation.commandEffectHash
    ][index]).length;
    if (c05Changed < 6 || c05Variation.quadratureSamples <= c05.snapshot.quadratureSamples || c05Variation.epsilon <= c05.snapshot.epsilon) {
      throw new Error(`C05 controls should visibly reshape variational diagnostics: ${JSON.stringify({ before: c05.snapshot, after: c05Variation })}.`);
    }
    await page.locator("[data-action='pulse']").click();
    await page.waitForTimeout(120);
    const c05Pulse = await page.evaluate(() => window.__c05LabSnapshot());
    requireStateText(c05Pulse, /Pulse.*(perturb|variation|action|deformation)/i, "C05 pulse");
    await page.selectOption("[data-control='mode']", "dirichlet");
    await page.locator("[data-action='step']").click();
    await page.waitForTimeout(120);
    const c05Step = await page.evaluate(() => window.__c05LabSnapshot());
    requireStateText(c05Step, /Step.*(Dirichlet|Laplace|residual|membrane)/i, "C05 step");
  } finally {
    await browser.close();
  }

  console.log("c04-c05 canonical clarity passed: stochastic optimization and calculus of variations textbook objects, commands, and diagnostics are exposed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
