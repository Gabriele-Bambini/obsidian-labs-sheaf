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
const CLARITY_VERSION = "b10-c01-canonical-clarity-v2";
const LEGACY_VERSION = "b10-c01-canonical-clarity-v1";

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
    const b10 = await loadLab(page, "b10-causal-inference-lab.html", "__b10LabReady", "__b10LabSnapshot");
    if (b10.bytes < 15000 || b10.overflowX > 18 || b10.overflowY > 18 || b10.commandBarHeight > 170) {
      throw new Error(`B10 render should be fitted and readable: ${JSON.stringify(b10)}.`);
    }
    requireVersion(b10.snapshot, "B10");
    if (
      b10.snapshot.dagObjectCount < 8 ||
      b10.snapshot.adjustmentObjectCount < 4 ||
      b10.snapshot.interventionObjectCount < 4 ||
      b10.snapshot.potentialOutcomeObjectCount < 4 ||
      b10.snapshot.estimatorObjectCount < 5 ||
      b10.snapshot.designObjectCount < 4
    ) {
      throw new Error(`B10 lacks a full canonical causal object inventory: ${JSON.stringify(b10.snapshot)}.`);
    }
    requireIncludes(b10.snapshot.causalInferenceObjects, [
      "structural_causal_model_exogenous_noise_boxes",
      "causal_dag_node_severity_confounder_z",
      "causal_dag_node_treatment_t",
      "causal_dag_node_mediator_m",
      "causal_dag_node_outcome_y",
      "causal_dag_directed_edge_z_to_t",
      "causal_dag_directed_edge_z_to_y",
      "causal_dag_directed_edge_t_to_y",
      "open_backdoor_path_z_creates_association",
      "adjustment_stratum_panes_compare_treated_untreated_within_z",
      "do_operator_scissors_cut_incoming_arrows_into_t",
      "interventional_distribution_bar_p_y_given_do_t",
      "observational_association_bar_p_y_given_t",
      "collider_conditioning_opens_false_path",
      "mediator_block_changes_total_effect",
      "potential_outcomes_twin_columns_y1_y0",
      "fundamental_missing_counterfactual_slot",
      "ate_population_average_treatment_effect_beam",
      "att_treated_target_population_beam",
      "propensity_score_e_z_balance_scale",
      "ipw_pseudo_population_weight_towers",
      "overlap_positivity_support_strip",
      "doubly_robust_outcome_propensity_score_board",
      "front_door_mediator_identification_bridge",
      "instrumental_variable_encouragement_lever",
      "difference_in_differences_parallel_trends_panel",
      "regression_discontinuity_cutoff_window"
    ], "B10 objects");
    requireIncludes(b10.snapshot.canonicalReferences, [
      "Pearl DAG do-calculus",
      "back-door adjustment",
      "Rubin potential outcomes",
      "propensity score IPW",
      "front-door IV DiD RD designs"
    ], "B10 references");
    requireFiniteNumbers(b10.snapshot, [
      "causalEffect", "backdoorBias", "adjustmentScore", "ateStability", "observedAssociation",
      "adjustedEstimate", "doEffect", "associationCausalGap", "confoundingStrength",
      "propensityOverlap", "ipwWeightSpread", "balanceAfterWeighting", "colliderBiasRisk",
      "mediatorBlockedEffect", "counterfactualMissingRate", "ate", "att", "frontdoorScore",
      "instrumentStrength", "parallelTrendGap", "rdLocalWindow"
    ], "B10");
    requireIncludes(b10.snapshot.diagnosticMetrics, [
      "causal_effect", "backdoor_bias", "adjustment_score", "association_causal_gap",
      "propensity_overlap", "ipw_weight_spread", "balance_after_weighting",
      "collider_bias_risk", "counterfactual_missing_rate", "frontdoor_score"
    ], "B10 diagnostics");
    if (!b10.snapshot.adjustmentHash || !b10.snapshot.propensityHash || !b10.snapshot.designDiagnosticsHash || !b10.snapshot.commandEffectHash) {
      throw new Error(`B10 should expose adjustment/propensity/design/command hashes: ${JSON.stringify(b10.snapshot)}.`);
    }
    requireStateText(b10.snapshot, /causal|DAG|association|intervention|confounder|counterfactual|treatment/i, "B10 initial");
    const b10InitialHashes = [
      b10.snapshot.causalSceneHash,
      b10.snapshot.dagPathHash,
      b10.snapshot.interventionHash,
      b10.snapshot.potentialOutcomeHash,
      b10.snapshot.estimatorHash,
      b10.snapshot.designHash,
      b10.snapshot.adjustmentHash,
      b10.snapshot.propensityHash,
      b10.snapshot.designDiagnosticsHash,
      b10.snapshot.commandEffectHash
    ];
    await page.selectOption("[data-control='mode']", "backdoor");
    await setRange(page, "#b10-strength", "0.88");
    await setRange(page, "#b10-spread", "0.28");
    await setRange(page, "#b10-noise", "0.12");
    await page.waitForTimeout(160);
    const b10Backdoor = await page.evaluate(() => window.__b10LabSnapshot());
    requireStateText(b10Backdoor, /Backdoor|confounder|block|association|treatment|outcome/i, "B10 backdoor");
    const b10Changed = b10InitialHashes.filter((hash, index) => hash !== [
      b10Backdoor.causalSceneHash,
      b10Backdoor.dagPathHash,
      b10Backdoor.interventionHash,
      b10Backdoor.potentialOutcomeHash,
      b10Backdoor.estimatorHash,
      b10Backdoor.designHash,
      b10Backdoor.adjustmentHash,
      b10Backdoor.propensityHash,
      b10Backdoor.designDiagnosticsHash,
      b10Backdoor.commandEffectHash
    ][index]).length;
    if (b10Changed < 6 || b10Backdoor.adjustmentScore <= b10.snapshot.adjustmentScore || b10Backdoor.backdoorBias >= b10.snapshot.backdoorBias) {
      throw new Error(`B10 controls should visibly reshape causal diagnostics: ${JSON.stringify({ before: b10.snapshot, after: b10Backdoor })}.`);
    }
    await page.locator("[data-action='pulse']").click();
    await page.waitForTimeout(120);
    const b10Pulse = await page.evaluate(() => window.__b10LabSnapshot());
    requireStateText(b10Pulse, /Pulse.*(backdoor|confounder|bias|adjustment)/i, "B10 pulse");
    await page.selectOption("[data-control='mode']", "intervention");
    await page.locator("[data-action='step']").click();
    await page.waitForTimeout(120);
    const b10Step = await page.evaluate(() => window.__b10LabSnapshot());
    requireStateText(b10Step, /Step.*(do-operator|intervention|clamp|ATE|treatment)/i, "B10 step");

    const c01 = await loadLab(page, "c01-convex-analysis-lab.html", "__c01LabReady", "__c01LabSnapshot");
    if (c01.bytes < 15000 || c01.overflowX > 18 || c01.overflowY > 18 || c01.commandBarHeight > 170) {
      throw new Error(`C01 render should be fitted and readable: ${JSON.stringify(c01)}.`);
    }
    requireVersion(c01.snapshot, "C01");
    if (
      c01.snapshot.convexSetObjectCount < 7 ||
      c01.snapshot.epigraphJensenObjectCount < 8 ||
      c01.snapshot.subgradientCertificateObjectCount < 7 ||
      c01.snapshot.fenchelDualObjectCount < 5 ||
      c01.snapshot.optimalityCertificateObjectCount < 8
    ) {
      throw new Error(`C01 lacks a full canonical convex-analysis object inventory: ${JSON.stringify(c01.snapshot)}.`);
    }
    requireIncludes(c01.snapshot.convexAnalysisObjects, [
      "convex_set_filled_body_c_contains_whole_line_segment",
      "line_segment_stays_inside_convex_set",
      "convex_hull_of_points_simplex_object",
      "nonconvex_crescent_counterexample_split_body",
      "separating_hyperplane_separates_outside_point_from_convex_set",
      "epigraph_vertical_slice_chamber",
      "convex_function_graph_below_every_chord",
      "jensen_chord_through_two_surface_points",
      "jensen_expectation_bead_f_e_x",
      "supporting_tangent_plane_on_3d_convex_bowl",
      "subgradient_lower_bound_plane_certificate",
      "absolute_value_corner_with_subdifferential_interval",
      "normal_cone_to_feasible_set_at_boundary",
      "hessian_psd_eigenvalue_bars",
      "extended_value_indicator_wall_outside_domain",
      "fenchel_affine_plane_tangent_to_convex_bowl",
      "fenchel_young_gap_bar",
      "conjugate_slope_handle_y_in_dual_space",
      "entropy_log_sum_exp_conjugate_pair",
      "l1_sparsity_zero_subgradient_interval",
      "fixed_convex_reticulated_certificate_surface"
    ], "C01 objects");
    requireIncludes(c01.snapshot.canonicalReferences, [
      "Rockafellar convex analysis",
      "Boyd Vandenberghe convex optimization",
      "Jensen inequality",
      "subgradient optimality",
      "Fenchel-Young inequality"
    ], "C01 references");
    requireFiniteNumbers(c01.snapshot, [
      "jensenGap", "supportViolation", "subgradientNorm", "fenchelGap", "convexity",
      "theta", "epigraphLift", "supportSlope", "supportSlopeZ", "hessianMinEigen",
      "hessianMaxEigen", "separationMargin", "supportSlackMax", "normalConeAngle",
      "subdifferentialWidth", "indicatorWallHeight", "fenchelSlope", "fenchelYoungGap",
      "entropyConjugateGap", "convexHullArea", "nonconvexViolation"
    ], "C01");
    requireIncludes(c01.snapshot.diagnosticMetrics, [
      "jensen_gap", "support_violation", "subgradient_norm", "fenchel_gap",
      "hessian_min_eigen", "normal_cone_angle", "subdifferential_width",
      "fenchel_young_gap", "convex_hull_area", "nonconvex_violation"
    ], "C01 diagnostics");
    if (!c01.snapshot.epigraphHash || !c01.snapshot.subgradientCertificateHash || !c01.snapshot.fenchelYoungHash || !c01.snapshot.commandEffectHash) {
      throw new Error(`C01 should expose epigraph/subgradient/Fenchel/command hashes: ${JSON.stringify(c01.snapshot)}.`);
    }
    requireStateText(c01.snapshot, /convex|epigraph|Jensen|support|subgradient|Fenchel|certificate/i, "C01 initial");
    const c01InitialHashes = [
      c01.snapshot.convexSceneHash,
      c01.snapshot.jensenCertificateHash,
      c01.snapshot.supportCertificateHash,
      c01.snapshot.fenchelCertificateHash,
      c01.snapshot.convexSetHash,
      c01.snapshot.epigraphHash,
      c01.snapshot.subgradientCertificateHash,
      c01.snapshot.fenchelYoungHash,
      c01.snapshot.commandEffectHash
    ];
    await page.selectOption("[data-control='mode']", "jensen");
    await setRange(page, "#c01-curvature", "1.45");
    await setRange(page, "#c01-step", "0.62");
    await setRange(page, "#c01-regularization", "0.72");
    await page.waitForTimeout(160);
    const c01Jensen = await page.evaluate(() => window.__c01LabSnapshot());
    requireStateText(c01Jensen, /Jensen|chord|convex|average|function value/i, "C01 Jensen");
    const c01Changed = c01InitialHashes.filter((hash, index) => hash !== [
      c01Jensen.convexSceneHash,
      c01Jensen.jensenCertificateHash,
      c01Jensen.supportCertificateHash,
      c01Jensen.fenchelCertificateHash,
      c01Jensen.convexSetHash,
      c01Jensen.epigraphHash,
      c01Jensen.subgradientCertificateHash,
      c01Jensen.fenchelYoungHash,
      c01Jensen.commandEffectHash
    ][index]).length;
    if (c01Changed < 6 || c01Jensen.jensenGap <= c01.snapshot.jensenGap || c01Jensen.hessianMinEigen <= c01.snapshot.hessianMinEigen) {
      throw new Error(`C01 controls should visibly reshape convex diagnostics: ${JSON.stringify({ before: c01.snapshot, after: c01Jensen })}.`);
    }
    await page.locator("[data-action='pulse']").click();
    await page.waitForTimeout(120);
    const c01Pulse = await page.evaluate(() => window.__c01LabSnapshot());
    requireStateText(c01Pulse, /Pulse.*(Jensen|chord|convex)/i, "C01 pulse");
    await page.selectOption("[data-control='mode']", "fenchel");
    await page.locator("[data-action='step']").click();
    await page.waitForTimeout(120);
    const c01Step = await page.evaluate(() => window.__c01LabSnapshot());
    requireStateText(c01Step, /Step.*(Fenchel|dual|slope|conjugate|gap)/i, "C01 step");
  } finally {
    await browser.close();
  }

  console.log("b10-c01 canonical clarity passed: causal and convex textbook objects, commands, and diagnostics are exposed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
