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
const CLARITY_VERSION = "c06-c07-canonical-clarity-v2";
const LEGACY_VERSION = "c06-c07-canonical-clarity-v1";

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
    const c06 = await loadLab(page, "c06-optimal-control-lab.html", "__c06LabReady", "__c06LabSnapshot");
    if (c06.bytes < 15000 || c06.overflowX > 18 || c06.overflowY > 18 || c06.commandBarHeight > 170) {
      throw new Error(`C06 render should be fitted and readable: ${JSON.stringify(c06)}.`);
    }
    requireVersion(c06.snapshot, "C06");
    if (
      c06.snapshot.dynamicsObjectCount < 5 ||
      c06.snapshot.controlCostObjectCount < 5 ||
      c06.snapshot.pontryaginObjectCount < 6 ||
      c06.snapshot.hjbRiccatiObjectCount < 7 ||
      c06.snapshot.numericalControlObjectCount < 5 ||
      c06.snapshot.optimalControlDiagnosticObjectCount < 3
    ) {
      throw new Error(`C06 lacks a full canonical optimal-control inventory: ${JSON.stringify(c06.snapshot)}.`);
    }
    requireIncludes(c06.snapshot.optimalControlObjects, [
      "state_time_trajectory_generated_by_controls",
      "open_loop_versus_feedback_trajectory",
      "control_signal_columns_along_time",
      "running_cost_integral_columns_xtqx_plus_utru",
      "terminal_cost_phi_target_bowl_and_gate",
      "dynamics_equation_board_xdot_equals_f_x_u_t",
      "initial_condition_x0_marker",
      "hamiltonian_minimization_chamber",
      "costate_trajectory_backward_in_time",
      "costate_terminal_condition_lambda_t_equals_grad_phi",
      "stationarity_board_partial_h_partial_u_equals_zero",
      "shooting_two_point_boundary_connector",
      "hjb_value_function_surface",
      "bellman_one_step_backup_tile",
      "value_gradient_equals_costate_bridge_nabla_v_equals_lambda",
      "policy_feedback_arrows_pi_star_x_t",
      "riccati_p_t_matrix_flow",
      "lqr_gain_board_u_equals_minus_kx",
      "bang_bang_saturated_control_switch",
      "direct_transcription_collocation_constraint_nodes",
      "mpc_receding_horizon_window",
      "disturbance_impulse_and_feedback_correction"
    ], "C06 objects");
    requireIncludes(c06.snapshot.canonicalReferences, [
      "Pontryagin maximum principle",
      "Hamilton Jacobi Bellman value function",
      "Linear quadratic regulator Riccati equation",
      "bang bang saturated control",
      "model predictive control direct transcription"
    ], "C06 references");
    requireFiniteNumbers(c06.snapshot, [
      "controlCost", "hjbResidual", "riccatiGain", "terminalError", "runningCostIntegral",
      "terminalCost", "controlEnergy", "stateDeviation", "costateNorm", "hamiltonianStationarity",
      "shootingMismatch", "bellmanResidual", "valueGradientNorm", "riccatiResidual", "feedbackGain",
      "saturationFraction", "transcriptionDefect", "mpcHorizonLength", "disturbanceRecovery"
    ], "C06");
    requireIncludes(c06.snapshot.diagnosticMetrics, [
      "control_cost", "hjb_residual", "riccati_gain", "terminal_error",
      "running_cost_integral", "costate_norm", "hamiltonian_stationarity",
      "bellman_residual", "riccati_residual", "saturation_fraction",
      "transcription_defect", "disturbance_recovery"
    ], "C06 diagnostics");
    if (!c06.snapshot.dynamicsCostHash || !c06.snapshot.pmpStationarityHash || !c06.snapshot.feedbackPolicyHash || !c06.snapshot.transcriptionMpcHash || !c06.snapshot.commandEffectHash) {
      throw new Error(`C06 should expose dynamics/PMP/feedback/MPC/command hashes: ${JSON.stringify(c06.snapshot)}.`);
    }
    requireStateText(c06.snapshot, /optimal control|state|control|costate|Hamiltonian|HJB|Riccati|dynamics/i, "C06 initial");
    const c06InitialHashes = [
      c06.snapshot.optimalControlSceneHash,
      c06.snapshot.pontryaginHash,
      c06.snapshot.hjbRiccatiHash,
      c06.snapshot.numericalControlHash,
      c06.snapshot.dynamicsCostHash,
      c06.snapshot.pmpStationarityHash,
      c06.snapshot.feedbackPolicyHash,
      c06.snapshot.transcriptionMpcHash,
      c06.snapshot.commandEffectHash
    ];
    await page.selectOption("[data-control='mode']", "lqr");
    await setRange(page, "#c06-curvature", "1.6");
    await setRange(page, "#c06-step", "0.78");
    await setRange(page, "#c06-noise", "0.7");
    await setRange(page, "#c06-budget", "12");
    await setRange(page, "#c06-regularization", "0.82");
    await page.waitForTimeout(160);
    const c06Lqr = await page.evaluate(() => window.__c06LabSnapshot());
    requireStateText(c06Lqr, /LQR|Riccati|feedback|gain|terminal/i, "C06 LQR");
    const c06Changed = c06InitialHashes.filter((hash, index) => hash !== [
      c06Lqr.optimalControlSceneHash,
      c06Lqr.pontryaginHash,
      c06Lqr.hjbRiccatiHash,
      c06Lqr.numericalControlHash,
      c06Lqr.dynamicsCostHash,
      c06Lqr.pmpStationarityHash,
      c06Lqr.feedbackPolicyHash,
      c06Lqr.transcriptionMpcHash,
      c06Lqr.commandEffectHash
    ][index]).length;
    if (c06Changed < 7 || c06Lqr.feedbackGain <= c06.snapshot.feedbackGain || c06Lqr.mpcHorizonLength <= c06.snapshot.mpcHorizonLength) {
      throw new Error(`C06 controls should visibly reshape optimal-control diagnostics: ${JSON.stringify({ before: c06.snapshot, after: c06Lqr })}.`);
    }
    await page.selectOption("[data-control='mode']", "pontryagin");
    await page.locator("[data-action='pulse']").click();
    await page.waitForTimeout(120);
    const c06Pulse = await page.evaluate(() => window.__c06LabSnapshot());
    requireStateText(c06Pulse, /Pulse.*(Pontryagin|Hamiltonian|state|control|costate|stationarity)/i, "C06 pulse");
    await page.selectOption("[data-control='mode']", "mpc");
    await page.locator("[data-action='step']").click();
    await page.waitForTimeout(120);
    const c06Step = await page.evaluate(() => window.__c06LabSnapshot());
    requireStateText(c06Step, /Step.*(MPC|horizon|collocation|replan)/i, "C06 step");

    const c07 = await loadLab(page, "c07-duality-theory-lab.html", "__c07LabReady", "__c07LabSnapshot");
    if (c07.bytes < 15000 || c07.overflowX > 18 || c07.overflowY > 18 || c07.commandBarHeight > 170) {
      throw new Error(`C07 render should be fitted and readable: ${JSON.stringify(c07)}.`);
    }
    requireVersion(c07.snapshot, "C07");
    if (
      c07.snapshot.primalDualObjectCount < 5 ||
      c07.snapshot.lagrangianKktObjectCount < 7 ||
      c07.snapshot.fenchelObjectCount < 5 ||
      c07.snapshot.lpSvmObjectCount < 6 ||
      c07.snapshot.minimaxObjectCount < 2 ||
      c07.snapshot.dualityDiagnosticObjectCount < 4
    ) {
      throw new Error(`C07 lacks a full canonical duality inventory: ${JSON.stringify(c07.snapshot)}.`);
    }
    requireIncludes(c07.snapshot.dualityTheoryObjects, [
      "primal_objective_surface_with_feasible_candidate",
      "dual_lower_bound_plane_certificate",
      "vertical_primal_dual_gap_certificate",
      "lagrangian_surface_l_x_lambda_equals_f0_plus_lambda_g",
      "dual_function_curve_g_lambda_equals_inf_x_l",
      "weak_duality_lower_bound_ladder",
      "slater_strictly_feasible_interior_witness",
      "kkt_checklist_primal_dual_stationarity_complementarity",
      "complementary_slackness_lambda_i_f_i_equals_zero_bar",
      "lp_primal_dual_resource_price_table",
      "reduced_cost_inequality_rack_a_transpose_nu_less_equal_c",
      "fenchel_conjugate_graph_f_star_y",
      "fenchel_young_equality_bridge_f_plus_fstar_equals_yx",
      "supporting_hyperplane_slope_y",
      "l1_conjugate_linfinity_ball",
      "indicator_conjugate_support_function_panel",
      "svm_alpha_box_constraints",
      "support_vector_margin_points_selected_by_alpha",
      "kernel_gram_matrix_dual_board",
      "minimax_saddle_exchange_axes",
      "primal_dual_update_arrows"
    ], "C07 objects");
    requireIncludes(c07.snapshot.canonicalReferences, [
      "Lagrangian weak and strong duality",
      "Slater KKT complementary slackness",
      "Fenchel conjugate Fenchel Young inequality",
      "linear programming resource price dual",
      "support vector machine kernel dual"
    ], "C07 references");
    requireFiniteNumbers(c07.snapshot, [
      "dualityGap", "primalResidual", "complementarity", "certificateSlack", "primalValue",
      "dualValue", "lagrangianTilt", "dualFunctionPeak", "slaterMargin", "kktStationarity",
      "fenchelYoungGap", "conjugateSlope", "reducedCostMax", "lpResourcePrice",
      "svmSupportCount", "kernelRank", "minimaxOscillation", "primalDualStepNorm"
    ], "C07");
    requireIncludes(c07.snapshot.diagnosticMetrics, [
      "duality_gap", "primal_residual", "complementarity", "certificate_slack",
      "primal_value", "dual_value", "slater_margin", "kkt_stationarity",
      "fenchel_young_gap", "reduced_cost_max", "svm_support_count", "minimax_oscillation"
    ], "C07 diagnostics");
    if (!c07.snapshot.primalDualGapHash || !c07.snapshot.kktCertificateHash || !c07.snapshot.fenchelSupportHash || !c07.snapshot.applicationDualHash || !c07.snapshot.commandEffectHash) {
      throw new Error(`C07 should expose gap/KKT/Fenchel/application/command hashes: ${JSON.stringify(c07.snapshot)}.`);
    }
    requireStateText(c07.snapshot, /duality|Lagrangian|primal|dual|certificate|KKT|Fenchel|gap/i, "C07 initial");
    const c07InitialHashes = [
      c07.snapshot.dualitySceneHash,
      c07.snapshot.lagrangianDualHash,
      c07.snapshot.fenchelCertificateHash,
      c07.snapshot.lpSvmMinimaxHash,
      c07.snapshot.primalDualGapHash,
      c07.snapshot.kktCertificateHash,
      c07.snapshot.fenchelSupportHash,
      c07.snapshot.applicationDualHash,
      c07.snapshot.commandEffectHash
    ];
    await page.selectOption("[data-control='mode']", "svm");
    await setRange(page, "#c07-curvature", "1.45");
    await setRange(page, "#c07-step", "0.74");
    await setRange(page, "#c07-noise", "0.66");
    await setRange(page, "#c07-budget", "13");
    await setRange(page, "#c07-regularization", "0.84");
    await page.waitForTimeout(160);
    const c07Svm = await page.evaluate(() => window.__c07LabSnapshot());
    requireStateText(c07Svm, /SVM|support vectors|alpha|kernel|dual/i, "C07 SVM");
    const c07Changed = c07InitialHashes.filter((hash, index) => hash !== [
      c07Svm.dualitySceneHash,
      c07Svm.lagrangianDualHash,
      c07Svm.fenchelCertificateHash,
      c07Svm.lpSvmMinimaxHash,
      c07Svm.primalDualGapHash,
      c07Svm.kktCertificateHash,
      c07Svm.fenchelSupportHash,
      c07Svm.applicationDualHash,
      c07Svm.commandEffectHash
    ][index]).length;
    if (c07Changed < 7 || c07Svm.dualValue <= c07.snapshot.dualValue || c07Svm.svmSupportCount <= c07.snapshot.svmSupportCount) {
      throw new Error(`C07 controls should visibly reshape duality diagnostics: ${JSON.stringify({ before: c07.snapshot, after: c07Svm })}.`);
    }
    await page.selectOption("[data-control='mode']", "lagrangian");
    await page.locator("[data-action='pulse']").click();
    await page.waitForTimeout(120);
    const c07Pulse = await page.evaluate(() => window.__c07LabSnapshot());
    requireStateText(c07Pulse, /Pulse.*(KKT|lambda|feasibility|stationarity|complementarity|certificate)/i, "C07 pulse");
    await page.selectOption("[data-control='mode']", "lp");
    await page.locator("[data-action='step']").click();
    await page.waitForTimeout(120);
    const c07Step = await page.evaluate(() => window.__c07LabSnapshot());
    requireStateText(c07Step, /Step.*(LP|resource|reduced-cost|dual certificate|price)/i, "C07 step");
  } finally {
    await browser.close();
  }

  console.log("c06-c07 canonical clarity passed: optimal control and duality theory textbook objects, commands, and diagnostics are exposed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
