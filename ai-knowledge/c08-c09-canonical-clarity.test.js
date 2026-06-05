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
const CLARITY_VERSION = "c08-c09-canonical-clarity-v2";
const LEGACY_VERSION = "c08-c09-canonical-clarity-v1";

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
    const c08 = await loadLab(page, "c08-proximal-methods-lab.html", "__c08LabReady", "__c08LabSnapshot");
    if (c08.bytes < 15000 || c08.overflowX > 18 || c08.overflowY > 18 || c08.commandBarHeight > 170) {
      throw new Error(`C08 render should be fitted and readable: ${JSON.stringify(c08)}.`);
    }
    requireVersion(c08.snapshot, "C08");
    if (
      c08.snapshot.compositeObjectiveObjectCount < 4 ||
      c08.snapshot.proxSubproblemObjectCount < 5 ||
      c08.snapshot.moreauSoftObjectCount < 7 ||
      c08.snapshot.istaFistaObjectCount < 4 ||
      c08.snapshot.projectionAdmmObjectCount < 9 ||
      c08.snapshot.proximalDiagnosticObjectCount < 4
    ) {
      throw new Error(`C08 lacks a full canonical proximal-method inventory: ${JSON.stringify(c08.snapshot)}.`);
    }
    requireIncludes(c08.snapshot.proximalMethodObjects, [
      "smooth_least_squares_bowl_g_x_equals_half_norm_ax_minus_b_squared",
      "l1_absolute_value_cusp_lambda_norm_x_1",
      "forward_gradient_proposal_v_equals_x_minus_alpha_grad_g",
      "proximal_subproblem_bowl_plus_nonsmooth_corner",
      "quadratic_pull_tether_from_v_to_prox",
      "proximal_optimality_inclusion_board",
      "subgradient_arrow_v_minus_x_plus_over_alpha_in_partial_h_x_plus",
      "moreau_envelope_smooth_surface",
      "moreau_gradient_vector_grad_m_equals_v_minus_prox_over_alpha",
      "moreau_decomposition_primal_dual_split",
      "soft_threshold_deadzone_slab",
      "coefficient_vector_before_after_shrinkage_bars",
      "support_mask_active_zero_coordinates",
      "ista_proximal_gradient_trajectory_bead",
      "fista_extrapolation_momentum_arc",
      "stepsize_safety_wall_alpha_less_equal_one_over_l",
      "prox_gradient_mapping_residual_ring",
      "box_projection_clipping_rails",
      "simplex_projection_probability_tray",
      "group_lasso_block_shrink_disks",
      "nuclear_norm_singular_value_threshold_rack",
      "tv_denoising_edge_preserving_stair_strip",
      "admm_x_update_ridge_solve_board",
      "admm_z_update_soft_threshold_board",
      "admm_dual_u_accumulator",
      "admm_primal_and_dual_residual_meters",
      "rho_residual_balance_scale",
      "consensus_constraint_x_equals_z_bridge"
    ], "C08 objects");
    requireIncludes(c08.snapshot.canonicalReferences, [
      "Moreau proximal operator",
      "soft thresholding Lasso prox",
      "ISTA FISTA forward backward splitting",
      "projection prox for indicator functions",
      "ADMM augmented Lagrangian residuals"
    ], "C08 references");
    requireFiniteNumbers(c08.snapshot, [
      "proxDistance", "moreauSmoothness", "sparsity", "admmResidual", "threshold",
      "vCoordinate", "proxCoordinate", "quadraticPull", "proxGradientMapping", "supportSize",
      "compositeObjective", "monotoneDecrease", "istaResidual", "fistaMomentum", "restartFlag",
      "projectionViolation", "boxClipCount", "simplexMassError", "groupShrinkFactor",
      "singularValuesKept", "tvEdgePreservation", "admmPrimalResidual", "admmDualResidual",
      "rhoBalance", "consensusGap", "moreauGradientNorm", "moreauEnvelopeValue", "decompositionGap"
    ], "C08");
    requireIncludes(c08.snapshot.diagnosticMetrics, [
      "prox_distance", "moreau_smoothness", "sparsity", "admm_residual",
      "prox_gradient_mapping", "support_size", "composite_objective",
      "fista_momentum", "projection_violation", "admm_primal_residual",
      "admm_dual_residual", "rho_balance"
    ], "C08 diagnostics");
    if (!c08.snapshot.compositeProxHash || !c08.snapshot.moreauEnvelopeHash || !c08.snapshot.thresholdSupportHash || !c08.snapshot.admmResidualHash || !c08.snapshot.commandEffectHash) {
      throw new Error(`C08 should expose composite/Moreau/threshold/ADMM/command hashes: ${JSON.stringify(c08.snapshot)}.`);
    }
    requireStateText(c08.snapshot, /prox|quadratic|Moreau|soft|ADMM|nonsmooth|splitting/i, "C08 initial");
    const c08InitialHashes = [
      c08.snapshot.proxSceneHash,
      c08.snapshot.moreauSoftHash,
      c08.snapshot.splittingAdmmHash,
      c08.snapshot.projectionCatalogHash,
      c08.snapshot.compositeProxHash,
      c08.snapshot.moreauEnvelopeHash,
      c08.snapshot.thresholdSupportHash,
      c08.snapshot.admmResidualHash,
      c08.snapshot.commandEffectHash
    ];
    await page.selectOption("[data-control='mode']", "fista");
    await setRange(page, "#c08-step", "0.78");
    await setRange(page, "#c08-budget", "12");
    await setRange(page, "#c08-regularization", "0.86");
    await page.waitForTimeout(160);
    const c08Fista = await page.evaluate(() => window.__c08LabSnapshot());
    requireStateText(c08Fista, /FISTA|ISTA|extrapolated|momentum|restart|support/i, "C08 FISTA");
    const c08Changed = c08InitialHashes.filter((hash, index) => hash !== [
      c08Fista.proxSceneHash,
      c08Fista.moreauSoftHash,
      c08Fista.splittingAdmmHash,
      c08Fista.projectionCatalogHash,
      c08Fista.compositeProxHash,
      c08Fista.moreauEnvelopeHash,
      c08Fista.thresholdSupportHash,
      c08Fista.admmResidualHash,
      c08Fista.commandEffectHash
    ][index]).length;
    if (c08Changed < 7 || c08Fista.supportSize >= c08.snapshot.supportSize || c08Fista.fistaMomentum <= c08.snapshot.fistaMomentum) {
      throw new Error(`C08 controls should visibly reshape proximal diagnostics: ${JSON.stringify({ before: c08.snapshot, after: c08Fista })}.`);
    }
    await page.selectOption("[data-control='mode']", "soft");
    await page.locator("[data-action='pulse']").click();
    await page.waitForTimeout(120);
    const c08Pulse = await page.evaluate(() => window.__c08LabSnapshot());
    requireStateText(c08Pulse, /Pulse.*(soft|threshold|coefficients|sparsity|zero)/i, "C08 pulse");
    await page.selectOption("[data-control='mode']", "admm");
    await page.locator("[data-action='step']").click();
    await page.waitForTimeout(120);
    const c08Step = await page.evaluate(() => window.__c08LabSnapshot());
    requireStateText(c08Step, /Step.*(ADMM|split|dual|residual|x, z)/i, "C08 step");

    const c09 = await loadLab(page, "c09-nonconvex-optimization-lab.html", "__c09LabReady", "__c09LabSnapshot");
    if (c09.bytes < 15000 || c09.overflowX > 18 || c09.overflowY > 18 || c09.commandBarHeight > 170) {
      throw new Error(`C09 render should be fitted and readable: ${JSON.stringify(c09)}.`);
    }
    requireVersion(c09.snapshot, "C09");
    if (
      c09.snapshot.workedLandscapeObjectCount < 8 ||
      c09.snapshot.saddleEscapeObjectCount < 6 ||
      c09.snapshot.basinOptimizerObjectCount < 7 ||
      c09.snapshot.flatSharpObjectCount < 6 ||
      c09.snapshot.curvatureProbeObjectCount < 3 ||
      c09.snapshot.nonconvexDiagnosticObjectCount < 4
    ) {
      throw new Error(`C09 lacks a full canonical non-convex inventory: ${JSON.stringify(c09.snapshot)}.`);
    }
    requireIncludes(c09.snapshot.nonconvexOptimizationObjects, [
      "worked_landscape_f_x_y_equals_x_cubed_minus_3x_plus_y_squared",
      "gradient_vector_field_grad_f",
      "critical_point_marker_local_minimum_1_0",
      "critical_point_marker_saddle_minus_1_0",
      "hessian_eigenvalue_sign_frame",
      "lambda_min_negative_curvature_gauge",
      "epsilon_first_order_stationarity_ball",
      "epsilon_second_order_stationarity_band",
      "degenerate_zero_hessian_x2y2_panel",
      "degenerate_higher_order_saddle_x4_minus_y4_panel",
      "nonconvex_multi_basin_loss_surface",
      "gradient_descent_trajectory_trapped_near_saddle",
      "perturbed_trajectory_escaping_saddle",
      "strict_saddle_stable_manifold_sheet",
      "negative_curvature_escape_direction",
      "sgd_noise_cloud_around_saddle",
      "momentum_overshoot_arc",
      "trust_region_radius_ball_and_quadratic_model",
      "cubic_regularization_lift",
      "initialization_seed_cloud",
      "basin_boundary_ridge",
      "sharp_minimum_narrow_basin",
      "flat_minimum_wide_basin",
      "validation_robustness_halo_around_flat_minimum",
      "reparameterization_symmetry_flat_valley_rail",
      "training_validation_gap_meter",
      "learning_rate_schedule_rail",
      "curvature_probe_lanczos_bars"
    ], "C09 objects");
    requireIncludes(c09.snapshot.canonicalReferences, [
      "critical point Hessian classification",
      "strict saddle negative curvature escape",
      "perturbed gradient descent",
      "trust region and cubic regularization",
      "flat sharp minima generalization caveat"
    ], "C09 references");
    requireFiniteNumbers(c09.snapshot, [
      "saddleEscape", "sharpness", "basinEnergy", "perturbationGain", "lossAtCurrent",
      "gradientNorm", "lambdaMin", "negativeCurvatureStrength", "stationaryFirstOrder",
      "secondOrderViolation", "basinCount", "seedCount", "trappedTrajectoryLength",
      "perturbationRadius", "escapeTime", "momentumEnergy", "sgdNoiseScale",
      "trustRegionRadius", "trustRegionAgreement", "flatnessScore", "sharpnessScore",
      "validationGap", "trainingLoss", "reparamSymmetryDrift", "lrStability",
      "curvatureProbe", "hessianCondition", "saddleBandWidth"
    ], "C09");
    requireIncludes(c09.snapshot.diagnosticMetrics, [
      "saddle_escape", "sharpness", "basin_energy", "perturbation_gain",
      "gradient_norm", "lambda_min", "negative_curvature_strength",
      "seed_count", "perturbation_radius", "escape_time", "validation_gap",
      "curvature_probe"
    ], "C09 diagnostics");
    if (!c09.snapshot.criticalPointHash || !c09.snapshot.curvatureStationarityHash || !c09.snapshot.basinSeedHash || !c09.snapshot.generalizationGeometryHash || !c09.snapshot.commandEffectHash) {
      throw new Error(`C09 should expose critical/curvature/basin/generalization/command hashes: ${JSON.stringify(c09.snapshot)}.`);
    }
    requireStateText(c09.snapshot, /non-convex|saddle|basin|sharp|flat|gradient|curvature|landscape/i, "C09 initial");
    const c09InitialHashes = [
      c09.snapshot.nonconvexSceneHash,
      c09.snapshot.saddleEscapeHash,
      c09.snapshot.optimizerDynamicsHash,
      c09.snapshot.flatSharpHash,
      c09.snapshot.criticalPointHash,
      c09.snapshot.curvatureStationarityHash,
      c09.snapshot.basinSeedHash,
      c09.snapshot.generalizationGeometryHash,
      c09.snapshot.commandEffectHash
    ];
    await page.selectOption("[data-control='mode']", "saddle");
    await setRange(page, "#c09-noise", "0.84");
    await setRange(page, "#c09-budget", "12");
    await setRange(page, "#c09-regularization", "0.84");
    await page.waitForTimeout(160);
    const c09Saddle = await page.evaluate(() => window.__c09LabSnapshot());
    requireStateText(c09Saddle, /Saddle|negative curvature|escape|gradient/i, "C09 saddle");
    const c09Changed = c09InitialHashes.filter((hash, index) => hash !== [
      c09Saddle.nonconvexSceneHash,
      c09Saddle.saddleEscapeHash,
      c09Saddle.optimizerDynamicsHash,
      c09Saddle.flatSharpHash,
      c09Saddle.criticalPointHash,
      c09Saddle.curvatureStationarityHash,
      c09Saddle.basinSeedHash,
      c09Saddle.generalizationGeometryHash,
      c09Saddle.commandEffectHash
    ][index]).length;
    if (c09Changed < 7 || c09Saddle.seedCount <= c09.snapshot.seedCount || c09Saddle.perturbationRadius <= c09.snapshot.perturbationRadius) {
      throw new Error(`C09 controls should visibly reshape non-convex diagnostics: ${JSON.stringify({ before: c09.snapshot, after: c09Saddle })}.`);
    }
    await page.locator("[data-action='pulse']").click();
    await page.waitForTimeout(120);
    const c09Pulse = await page.evaluate(() => window.__c09LabSnapshot());
    requireStateText(c09Pulse, /Pulse.*(saddle|negative curvature|escape direction)/i, "C09 pulse");
    await page.selectOption("[data-control='mode']", "curvature");
    await page.locator("[data-action='step']").click();
    await page.waitForTimeout(120);
    const c09Step = await page.evaluate(() => window.__c09LabSnapshot());
    requireStateText(c09Step, /Step.*(Hessian|lambda_min|FOSP|SOSP|critical)/i, "C09 step");
  } finally {
    await browser.close();
  }

  console.log("c08-c09 canonical clarity passed: proximal methods and non-convex optimization textbook objects, commands, and diagnostics are exposed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
