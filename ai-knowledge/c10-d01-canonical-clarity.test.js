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
const CLARITY_VERSION = "c10-d01-canonical-clarity-v2";
const LEGACY_VERSION = "c10-d01-canonical-clarity-v1";

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
    const c10 = await loadLab(page, "c10-optimal-transport-lab.html", "__c10LabReady", "__c10LabSnapshot");
    if (c10.bytes < 15000 || c10.overflowX > 18 || c10.overflowY > 18 || c10.commandBarHeight > 170) {
      throw new Error(`C10 render should be fitted and readable: ${JSON.stringify(c10)}.`);
    }
    requireVersion(c10.snapshot, "C10");
    if (
      c10.snapshot.massDistributionObjectCount < 8 ||
      c10.snapshot.transportPlanObjectCount < 8 ||
      c10.snapshot.costGeometryObjectCount < 6 ||
      c10.snapshot.sinkhornObjectCount < 7 ||
      c10.snapshot.dualGeodesicObjectCount < 7 ||
      c10.snapshot.optimalTransportDiagnosticObjectCount < 5
    ) {
      throw new Error(`C10 lacks a full canonical optimal-transport inventory: ${JSON.stringify(c10.snapshot)}.`);
    }
    requireIncludes(c10.snapshot.optimalTransportObjects, [
      "source_distribution_mass_columns_a_i",
      "target_distribution_mass_columns_b_j",
      "ground_cost_matrix_cells_c_ij",
      "coupling_matrix_heatmap_cells_p_ij",
      "row_marginal_constraint_meter_p_one_equals_a",
      "column_marginal_constraint_meter_p_transpose_one_equals_b",
      "sinkhorn_kernel_board_k_equals_exp_minus_c_over_epsilon",
      "sinkhorn_row_scale_meters_u",
      "sinkhorn_column_scale_meters_v",
      "entropic_blur_epsilon_control_ring",
      "dual_potential_phi_i_posts",
      "dual_potential_psi_j_posts",
      "dual_slack_phi_plus_psi_less_equal_c_tiles",
      "tight_constraint_pair_markers",
      "displacement_interpolation_mass_particles",
      "monge_map_candidate_arrows",
      "wasserstein_geodesic_t_slider_path",
      "transport_plan_marginal_error_gauge"
    ], "C10 objects");
    requireIncludes(c10.snapshot.canonicalReferences, [
      "Kantorovich coupling linear program",
      "Wasserstein ground cost geometry",
      "Sinkhorn entropic regularization",
      "Kantorovich dual potentials",
      "displacement interpolation geodesic"
    ], "C10 references");
    requireFiniteNumbers(c10.snapshot, [
      "transportPlanCellCount", "costMatrixCellCount", "rowScaleMeterCount", "columnScaleMeterCount",
      "displacementParticleCount", "sinkhornIterations", "sinkhornEpsilon", "sinkhornMarginalError",
      "sinkhornBlurRadius", "maxPlanCellOpacity", "activePlanCellCount", "couplingSparsity",
      "transportObjective", "costPower", "dualSlackMin", "tightPairCount"
    ], "C10");
    requireIncludes(c10.snapshot.diagnosticMetrics, [
      "transport_plan_cells", "cost_matrix_cells", "sinkhorn_iterations", "sinkhorn_epsilon",
      "sinkhorn_marginal_error", "active_plan_cells", "coupling_sparsity",
      "transport_objective", "dual_slack_min", "tight_pair_count"
    ], "C10 diagnostics");
    if (!c10.snapshot.transportPlanHash || !c10.snapshot.costGeometryHash || !c10.snapshot.sinkhornScalingHash || !c10.snapshot.dualPotentialHash || !c10.snapshot.geodesicDisplacementHash || !c10.snapshot.commandEffectHash) {
      throw new Error(`C10 should expose plan/cost/Sinkhorn/dual/geodesic/command hashes: ${JSON.stringify(c10.snapshot)}.`);
    }
    requireStateText(c10.snapshot, /transport|coupling|mass|Sinkhorn|dual|geodesic|Wasserstein/i, "C10 initial");
    const c10InitialHashes = [
      c10.snapshot.optimalTransportHash,
      c10.snapshot.transportPlanHash,
      c10.snapshot.costGeometryHash,
      c10.snapshot.sinkhornScalingHash,
      c10.snapshot.dualPotentialHash,
      c10.snapshot.geodesicDisplacementHash,
      c10.snapshot.commandEffectHash
    ];
    await page.selectOption("[data-control='mode']", "sinkhorn");
    await setRange(page, "#c10-regularization", "0.9");
    await setRange(page, "#c10-budget", "12");
    await setRange(page, "#c10-step", "0.78");
    await page.waitForTimeout(160);
    const c10Sinkhorn = await page.evaluate(() => window.__c10LabSnapshot());
    requireStateText(c10Sinkhorn, /Sinkhorn|entropy|marginal|regular/i, "C10 Sinkhorn");
    const c10Changed = c10InitialHashes.filter((hash, index) => hash !== [
      c10Sinkhorn.optimalTransportHash,
      c10Sinkhorn.transportPlanHash,
      c10Sinkhorn.costGeometryHash,
      c10Sinkhorn.sinkhornScalingHash,
      c10Sinkhorn.dualPotentialHash,
      c10Sinkhorn.geodesicDisplacementHash,
      c10Sinkhorn.commandEffectHash
    ][index]).length;
    if (c10Changed < 5 || c10Sinkhorn.sinkhornBlurRadius <= c10.snapshot.sinkhornBlurRadius || c10Sinkhorn.sinkhornIterations <= c10.snapshot.sinkhornIterations) {
      throw new Error(`C10 controls should visibly reshape optimal-transport diagnostics: ${JSON.stringify({ before: c10.snapshot, after: c10Sinkhorn })}.`);
    }
    await page.selectOption("[data-control='mode']", "plan");
    await page.locator("[data-action='pulse']").click();
    await page.waitForTimeout(120);
    const c10Pulse = await page.evaluate(() => window.__c10LabSnapshot());
    requireStateText(c10Pulse, /Pulse.*(transport plan|coupling|mass)/i, "C10 pulse");
    await page.selectOption("[data-control='mode']", "sinkhorn");
    await page.locator("[data-action='step']").click();
    await page.waitForTimeout(120);
    const c10Step = await page.evaluate(() => window.__c10LabSnapshot());
    requireStateText(c10Step, /Step.*(Sinkhorn|scaling|entropy|marginal)/i, "C10 step");

    const d01 = await loadLab(page, "d01-linear-models-lab.html", "__d01LabReady", "__d01LabSnapshot");
    if (d01.bytes < 15000 || d01.overflowX > 18 || d01.overflowY > 18 || d01.commandBarHeight > 170) {
      throw new Error(`D01 render should be fitted and readable: ${JSON.stringify(d01)}.`);
    }
    requireVersion(d01.snapshot, "D01");
    if (
      d01.snapshot.designMatrixObjectCount < 6 ||
      d01.snapshot.leastSquaresProjectionObjectCount < 5 ||
      d01.snapshot.normalEquationObjectCount < 3 ||
      d01.snapshot.ridgeRegularizationObjectCount < 4 ||
      d01.snapshot.logisticClassificationObjectCount < 4 ||
      d01.snapshot.linearModelDiagnosticObjectCount < 5
    ) {
      throw new Error(`D01 lacks a full canonical linear-model inventory: ${JSON.stringify(d01.snapshot)}.`);
    }
    requireIncludes(d01.snapshot.linearModelObjects, [
      "design_matrix_row_glyphs",
      "intercept_feature_column_blocks",
      "feature_columns_x1_x2_basis_vectors",
      "target_vector_y_board",
      "prediction_vector_xw_projection_board",
      "column_space_projection_target_board",
      "residual_rods_y_minus_yhat",
      "normal_equation_orthogonality_gauge_x_transpose_r_equals_zero",
      "least_squares_loss_bowl",
      "gradient_vector_arrow_x_transpose_xw_minus_y",
      "closed_form_solution_board_xtx_inverse_xt_y",
      "ridge_shrinkage_path_to_smaller_norm",
      "ridge_penalty_lambda_norm_w_squared_wall",
      "lasso_l1_diamond_reference",
      "logistic_sigmoid_probability_sheet",
      "linear_decision_boundary_plane_wtx_plus_b_equals_zero",
      "class_overlap_point_cloud",
      "log_loss_cross_entropy_meter",
      "feature_scaling_condition_number_bars",
      "outlier_residual_leverage_marker"
    ], "D01 objects");
    requireIncludes(d01.snapshot.canonicalReferences, [
      "least squares projection theorem",
      "normal equations residual orthogonality",
      "ridge regression Tikhonov regularization",
      "logistic regression sigmoid cross entropy",
      "design matrix conditioning and feature scaling"
    ], "D01 references");
    requireFiniteNumbers(d01.snapshot, [
      "designRows", "featureColumns", "designMatrixCellCount", "residualRodCount",
      "loss", "residualRms", "r2", "gradientNorm", "projectionOrthogonality",
      "shrinkage", "olsNorm", "ridgeNorm", "accuracy", "decisionMargin", "logLoss",
      "conditionNumber", "stability"
    ], "D01");
    requireIncludes(d01.snapshot.diagnosticMetrics, [
      "loss", "residual_rms", "r_squared", "stability", "projection_orthogonality",
      "ridge_norm", "ols_norm", "log_loss", "condition_number", "design_rows"
    ], "D01 diagnostics");
    if (!d01.snapshot.linearModelSceneHash || !d01.snapshot.designMatrixHash || !d01.snapshot.leastSquaresProjectionHash || !d01.snapshot.ridgeRegularizationHash || !d01.snapshot.logisticBoundaryHash || !d01.snapshot.commandEffectHash) {
      throw new Error(`D01 should expose design/projection/ridge/logistic/command hashes: ${JSON.stringify(d01.snapshot)}.`);
    }
    requireStateText(d01.snapshot, /linear|design matrix|least squares|projection|residual|ridge|logistic/i, "D01 initial");
    const d01InitialHashes = [
      d01.snapshot.linearModelSceneHash,
      d01.snapshot.designMatrixHash,
      d01.snapshot.leastSquaresProjectionHash,
      d01.snapshot.ridgeRegularizationHash,
      d01.snapshot.logisticBoundaryHash,
      d01.snapshot.commandEffectHash
    ];
    await page.locator("#model").selectOption("ridge");
    await page.locator("#viewMode").selectOption("regularization");
    await setRange(page, "#lambda", "1.8");
    await page.locator("#fitClosedForm").click();
    await page.waitForFunction(() => window.__d01LabSnapshot().model === "ridge" && window.__d01LabSnapshot().lambda > 1.7);
    const d01Ridge = await page.evaluate(() => window.__d01LabSnapshot());
    requireStateText(d01Ridge, /ridge|lambda|shrink|coefficient/i, "D01 ridge");
    const d01Changed = d01InitialHashes.filter((hash, index) => hash !== [
      d01Ridge.linearModelSceneHash,
      d01Ridge.designMatrixHash,
      d01Ridge.leastSquaresProjectionHash,
      d01Ridge.ridgeRegularizationHash,
      d01Ridge.logisticBoundaryHash,
      d01Ridge.commandEffectHash
    ][index]).length;
    if (d01Changed < 4 || d01Ridge.ridgeNorm >= d01Ridge.olsNorm) {
      throw new Error(`D01 ridge controls should visibly shrink coefficient geometry: ${JSON.stringify({ before: d01.snapshot, after: d01Ridge })}.`);
    }
    await page.locator("#model").selectOption("logistic");
    await page.locator("#viewMode").selectOption("classification");
    await setRange(page, "#overlap", "0.05");
    await page.locator("#fitClosedForm").click();
    const separated = await page.evaluate(() => window.__d01LabSnapshot());
    await setRange(page, "#overlap", "0.9");
    await page.locator("#fitClosedForm").click();
    const overlapped = await page.evaluate(() => window.__d01LabSnapshot());
    requireStateText(overlapped, /logistic|sigmoid|decision|probability|class/i, "D01 logistic");
    if (separated.logisticBoundaryHash === overlapped.logisticBoundaryHash || Math.abs(separated.logLoss - overlapped.logLoss) < 0.02) {
      throw new Error(`D01 logistic overlap should move the boundary and log-loss: ${JSON.stringify({ separated, overlapped })}.`);
    }
  } finally {
    await browser.close();
  }

  console.log("c10-d01 canonical clarity passed: optimal transport and linear models expose textbook objects, commands, and diagnostics.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
