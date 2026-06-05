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
const CLARITY_VERSION = "c02-c03-canonical-clarity-v2";
const LEGACY_VERSION = "c02-c03-canonical-clarity-v1";

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
    const c02 = await loadLab(page, "c02-optimization-landscape.html", "__c02LabReady", "__c02LabSnapshot");
    if (c02.bytes < 15000 || c02.overflowX > 18 || c02.overflowY > 18 || c02.commandBarHeight > 170) {
      throw new Error(`C02 render should be fitted and readable: ${JSON.stringify(c02)}.`);
    }
    requireVersion(c02.snapshot, "C02");
    if (
      c02.snapshot.objectiveLandscapeObjectCount < 4 ||
      c02.snapshot.gradientDescentObjectCount < 5 ||
      c02.snapshot.lineSearchObjectCount < 4 ||
      c02.snapshot.newtonCurvatureObjectCount < 5 ||
      c02.snapshot.bfgsMomentumObjectCount < 5 ||
      c02.snapshot.optimizerDiagnosticObjectCount < 2
    ) {
      throw new Error(`C02 lacks a full canonical unconstrained optimization inventory: ${JSON.stringify(c02.snapshot)}.`);
    }
    requireIncludes(c02.snapshot.unconstrainedOptimizationObjects, [
      "objective_ravine_surface_with_condition_number_ellipses",
      "current_iterate_theta_k_on_objective_landscape",
      "uphill_gradient_vector_nabla_f",
      "negative_gradient_descent_direction_minus_nabla_f",
      "gradient_descent_zigzag_trajectory_across_ravine",
      "local_tangent_plane_first_order_model",
      "local_quadratic_taylor_model_m_k_p",
      "armijo_sufficient_decrease_ladder",
      "wolfe_slope_flattening_gate",
      "accepted_alpha_step_marker",
      "rejected_oversized_alpha_marker",
      "newton_hessian_solve_board_h_p_equals_minus_g",
      "newton_curvature_ellipse_eigenvalue_frame",
      "condition_number_lambda_max_over_lambda_min_tower",
      "bfgs_secant_equation_y_k_equals_b_k_s_k",
      "bfgs_inverse_hessian_approximation_memory_board",
      "positive_curvature_test_s_k_dot_y_k_greater_than_zero",
      "momentum_velocity_recurrence_board",
      "indefinite_hessian_negative_curvature_escape_warning",
      "optimizer_diagnostics_ledger"
    ], "C02 objects");
    requireIncludes(c02.snapshot.canonicalReferences, [
      "Nocedal Wright numerical optimization",
      "gradient descent descent direction",
      "Armijo Wolfe line search",
      "Newton Hessian model",
      "BFGS secant equation",
      "momentum preconditioning"
    ], "C02 references");
    requireFiniteNumbers(c02.snapshot, [
      "objectiveValue", "gradientNorm", "stepDecrease", "newtonGain", "conditionNumber",
      "lambdaMin", "lambdaMax", "hessianEigenMin", "hessianEigenMax", "acceptedAlpha",
      "armijoMargin", "wolfeSlopeRatio", "newtonStepNorm", "bfgsSecantResidual",
      "bfgsCurvature", "momentumVelocity", "zigzagAmplitude", "gdDistanceToMinimum",
      "trustRegionRadius"
    ], "C02");
    requireIncludes(c02.snapshot.diagnosticMetrics, [
      "objective_value", "gradient_norm", "step_decrease", "newton_gain",
      "condition_number", "accepted_alpha", "armijo_margin", "wolfe_slope_ratio",
      "newton_step_norm", "bfgs_secant_residual", "momentum_velocity"
    ], "C02 diagnostics");
    if (!c02.snapshot.gradientFlowHash || !c02.snapshot.curvatureDiagnosticHash || !c02.snapshot.momentumDiagnosticHash || !c02.snapshot.commandEffectHash) {
      throw new Error(`C02 should expose gradient/curvature/momentum/command hashes: ${JSON.stringify(c02.snapshot)}.`);
    }
    requireStateText(c02.snapshot, /unconstrained|objective|gradient|line search|Newton|BFGS|momentum|descent/i, "C02 initial");
    const c02InitialHashes = [
      c02.snapshot.optimizationSceneHash,
      c02.snapshot.lineSearchHash,
      c02.snapshot.newtonModelHash,
      c02.snapshot.bfgsMemoryHash,
      c02.snapshot.gradientFlowHash,
      c02.snapshot.curvatureDiagnosticHash,
      c02.snapshot.momentumDiagnosticHash,
      c02.snapshot.commandEffectHash
    ];
    await page.selectOption("[data-control='mode']", "line");
    await setRange(page, "#c02-curvature", "1.65");
    await setRange(page, "#c02-step", "0.74");
    await setRange(page, "#c02-regularization", "0.82");
    await page.waitForTimeout(160);
    const c02Line = await page.evaluate(() => window.__c02LabSnapshot());
    requireStateText(c02Line, /Line search|Armijo|Wolfe|alpha|step/i, "C02 line search");
    const c02Changed = c02InitialHashes.filter((hash, index) => hash !== [
      c02Line.optimizationSceneHash,
      c02Line.lineSearchHash,
      c02Line.newtonModelHash,
      c02Line.bfgsMemoryHash,
      c02Line.gradientFlowHash,
      c02Line.curvatureDiagnosticHash,
      c02Line.momentumDiagnosticHash,
      c02Line.commandEffectHash
    ][index]).length;
    if (c02Changed < 6 || c02Line.conditionNumber <= c02.snapshot.conditionNumber || c02Line.acceptedAlpha === c02.snapshot.acceptedAlpha) {
      throw new Error(`C02 controls should visibly reshape optimizer diagnostics: ${JSON.stringify({ before: c02.snapshot, after: c02Line })}.`);
    }
    await page.locator("[data-action='pulse']").click();
    await page.waitForTimeout(120);
    const c02Pulse = await page.evaluate(() => window.__c02LabSnapshot());
    requireStateText(c02Pulse, /Pulse.*(gradient|descent|objective|decrease)/i, "C02 pulse");
    await page.selectOption("[data-control='mode']", "bfgs");
    await page.locator("[data-action='step']").click();
    await page.waitForTimeout(120);
    const c02Step = await page.evaluate(() => window.__c02LabSnapshot());
    requireStateText(c02Step, /Step.*(BFGS|secant|memory|curvature)/i, "C02 step");

    const c03 = await loadLab(page, "c03-constrained-optimization.html", "__c03LabReady", "__c03LabSnapshot");
    if (c03.bytes < 15000 || c03.overflowX > 18 || c03.overflowY > 18 || c03.commandBarHeight > 170) {
      throw new Error(`C03 render should be fitted and readable: ${JSON.stringify(c03)}.`);
    }
    requireVersion(c03.snapshot, "C03");
    if (
      c03.snapshot.feasibleSetObjectCount < 6 ||
      c03.snapshot.projectionObjectCount < 4 ||
      c03.snapshot.kktObjectCount < 8 ||
      c03.snapshot.penaltyBarrierObjectCount < 4 ||
      c03.snapshot.primalDualObjectCount < 4
    ) {
      throw new Error(`C03 lacks a full canonical constrained optimization inventory: ${JSON.stringify(c03.snapshot)}.`);
    }
    requireIncludes(c03.snapshot.constrainedOptimizationObjects, [
      "kkt_force_balance_objective_surface",
      "projected_feasible_region_under_objective",
      "active_inequality_boundary_wall",
      "inactive_inequality_slack_boundary",
      "equality_constraint_tangent_rail_h_x_equals_zero",
      "unconstrained_optimum_illegal_witness",
      "projected_feasible_iterate_pi_c_step",
      "projection_arrow_from_illegal_step_to_feasible_set",
      "constrained_optimum_on_active_boundary",
      "objective_negative_gradient_vector_points_outside_feasible_set",
      "constraint_outward_normal_vector",
      "lambda_normal_force_closes_stationarity",
      "normal_cone_fan_blocks_illegal_descent",
      "kkt_table_primal_feasibility_tile",
      "kkt_table_dual_feasibility_tile",
      "kkt_table_complementary_slackness_tile",
      "kkt_table_stationarity_residual_tile",
      "penalty_spring_wall_punishes_violation",
      "interior_log_barrier_wall",
      "interior_barrier_central_path",
      "active_set_switchboard_active_inactive_constraints",
      "slater_strictly_feasible_witness",
      "primal_dual_certificate_gap_bar",
      "svm_margin_support_vector_mini_panel"
    ], "C03 objects");
    requireIncludes(c03.snapshot.canonicalReferences, [
      "KKT conditions",
      "Lagrange multipliers",
      "projected gradient",
      "penalty and barrier methods",
      "primal dual certificates"
    ], "C03 references");
    requireFiniteNumbers(c03.snapshot, [
      "maxViolation", "kktResidual", "lagrangeLambda", "complementarity", "stationarityResidual",
      "projectedStepNorm", "normalConeBalance", "equalityResidual", "slaterMargin",
      "penaltyWeight", "penaltyViolation", "barrierMu", "centralPathDistance",
      "primalDualGap", "activeSetSize"
    ], "C03");
    requireIncludes(c03.snapshot.diagnosticMetrics, [
      "max_violation", "kkt_residual", "lagrange_lambda", "complementarity",
      "stationarity_residual", "projected_step_norm", "normal_cone_balance",
      "penalty_weight", "barrier_mu", "primal_dual_gap"
    ], "C03 diagnostics");
    if (!c03.snapshot.activeSetHash || !c03.snapshot.feasibilityDiagnosticHash || !c03.snapshot.primalDualCertificateHash || !c03.snapshot.commandEffectHash) {
      throw new Error(`C03 should expose active-set/feasibility/primal-dual/command hashes: ${JSON.stringify(c03.snapshot)}.`);
    }
    requireStateText(c03.snapshot, /constrained|feasible|boundary|KKT|normal|penalty|barrier|projection/i, "C03 initial");
    const c03InitialHashes = [
      c03.snapshot.constrainedSceneHash,
      c03.snapshot.kktTableHash,
      c03.snapshot.projectionHash,
      c03.snapshot.penaltyBarrierHash,
      c03.snapshot.activeSetHash,
      c03.snapshot.feasibilityDiagnosticHash,
      c03.snapshot.primalDualCertificateHash,
      c03.snapshot.commandEffectHash
    ];
    await page.selectOption("[data-control='mode']", "projection");
    await setRange(page, "#c03-curvature", "1.4");
    await setRange(page, "#c03-noise", "0.82");
    await setRange(page, "#c03-regularization", "0.74");
    await page.waitForTimeout(160);
    const c03Projection = await page.evaluate(() => window.__c03LabSnapshot());
    requireStateText(c03Projection, /Projection|feasible|legal|Pi_C|project/i, "C03 projection");
    const c03Changed = c03InitialHashes.filter((hash, index) => hash !== [
      c03Projection.constrainedSceneHash,
      c03Projection.kktTableHash,
      c03Projection.projectionHash,
      c03Projection.penaltyBarrierHash,
      c03Projection.activeSetHash,
      c03Projection.feasibilityDiagnosticHash,
      c03Projection.primalDualCertificateHash,
      c03Projection.commandEffectHash
    ][index]).length;
    if (c03Changed < 6 || c03Projection.lagrangeLambda <= c03.snapshot.lagrangeLambda || c03Projection.penaltyWeight <= c03.snapshot.penaltyWeight) {
      throw new Error(`C03 controls should visibly reshape constrained diagnostics: ${JSON.stringify({ before: c03.snapshot, after: c03Projection })}.`);
    }
    await page.locator("[data-action='pulse']").click();
    await page.waitForTimeout(120);
    const c03Pulse = await page.evaluate(() => window.__c03LabSnapshot());
    requireStateText(c03Pulse, /Pulse.*(Projection|project|feasible|KKT|active|normal|multiplier|stationarity)/i, "C03 pulse");
    await page.selectOption("[data-control='mode']", "penalty");
    await page.locator("[data-action='step']").click();
    await page.waitForTimeout(120);
    const c03Step = await page.evaluate(() => window.__c03LabSnapshot());
    requireStateText(c03Step, /Step.*(penalty|rho|violation|wall)/i, "C03 step");
  } finally {
    await browser.close();
  }

  console.log("c02-c03 canonical clarity passed: unconstrained and constrained optimization textbook objects, commands, and diagnostics are exposed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
