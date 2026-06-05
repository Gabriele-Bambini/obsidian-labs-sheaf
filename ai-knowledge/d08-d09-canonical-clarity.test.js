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
const CLARITY_VERSION = "d08-d09-canonical-clarity-v2";
const LEGACY_VERSION = "d08-d09-canonical-clarity-v1";

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

function requireRenderFit(result, lab) {
  if (result.bytes < 15000 || result.overflowX > 18 || result.overflowY > 18 || result.commandBarHeight > 170) {
    throw new Error(`${lab} render should be fitted and readable: ${JSON.stringify(result)}.`);
  }
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1360, height: 820 } });

  try {
    const d08 = await loadLab(page, "d08-learning-theory-lab.html", "__d08LabReady", "__d08LabSnapshot");
    requireRenderFit(d08, "D08");
    requireVersion(d08.snapshot, "D08");
    if (
      d08.snapshot.riskObjectCount < 6 ||
      d08.snapshot.vcObjectCount < 5 ||
      d08.snapshot.rademacherObjectCount < 4 ||
      d08.snapshot.stabilityObjectCount < 5 ||
      d08.snapshot.learningTheoryDiagnosticObjectCount < 5
    ) {
      throw new Error(`D08 lacks a full canonical learning-theory inventory: ${JSON.stringify(d08.snapshot)}.`);
    }
    requireIncludes(d08.snapshot.learningTheoryObjects, [
      "empirical_sample_cloud_z_i",
      "empirical_risk_bar_r_hat_s_h",
      "population_risk_bar_r_h",
      "generalization_gap_bridge_r_minus_rhat",
      "hoeffding_pac_bound_confidence_funnel",
      "finite_hypothesis_union_bound_panel",
      "vc_shattering_point_set",
      "all_labeling_flags_growth_function",
      "separator_family_capacity_ribbons",
      "uniform_convergence_gap_slab",
      "rademacher_random_sign_field",
      "random_label_alignment_ribbon",
      "sample_adaptive_complexity_meter",
      "leave_one_out_removed_example",
      "stable_boundary_vs_loo_boundary",
      "stability_shift_beam",
      "regularization_margin_slab",
      "inductive_bias_capacity_dial",
      "double_descent_capacity_warning_curve",
      "approximation_estimation_optimization_error_stack"
    ], "D08 objects");
    requireIncludes(d08.snapshot.canonicalReferences, [
      "empirical risk versus population risk",
      "Hoeffding PAC confidence bound",
      "VC dimension shattering growth function",
      "Rademacher random sign complexity",
      "algorithmic stability leave one out"
    ], "D08 references");
    requireFiniteNumbers(d08.snapshot, [
      "sampleSize", "capacity", "regularization", "labelNoise", "confidence",
      "empiricalRisk", "populationRisk", "generalizationGap", "bound", "vcDimension",
      "growthFunction", "rademacherComplexity", "stabilityShift", "margin",
      "sampleCloudCount", "empiricalRiskBarHeight", "populationRiskBarHeight",
      "vcSeparatorCount", "shatteringPatternCount", "rademacherSignCount",
      "pacBoundWidth", "uniformConvergenceGap", "capacityPenalty",
      "sampleComplexityProxy", "stabilityImprovement"
    ], "D08");
    requireIncludes(d08.snapshot.diagnosticMetrics, [
      "empirical_risk", "population_risk", "generalization_gap", "pac_bound",
      "sample_size", "capacity", "vc_dimension", "rademacher_complexity",
      "stability_shift", "margin"
    ], "D08 diagnostics");
    if (!d08.snapshot.riskGapHash || !d08.snapshot.pacBoundHash || !d08.snapshot.vcShatteringHash || !d08.snapshot.rademacherComplexityHash || !d08.snapshot.stabilityShiftHash || !d08.snapshot.commandEffectHash) {
      throw new Error(`D08 should expose risk/PAC/VC/Rademacher/stability/command hashes: ${JSON.stringify(d08.snapshot)}.`);
    }
    requireStateText(d08.snapshot, /empirical risk|population risk|generalization|PAC|bound|sample/i, "D08 initial");

    await setRange(page, "#sampleSize", "45");
    await page.waitForTimeout(160);
    const d08SmallN = await page.evaluate(() => window.__d08LabSnapshot());
    await setRange(page, "#sampleSize", "200");
    await page.waitForTimeout(160);
    const d08LargeN = await page.evaluate(() => window.__d08LabSnapshot());
    if (d08LargeN.bound >= d08SmallN.bound || d08LargeN.pacBoundHash === d08SmallN.pacBoundHash || d08LargeN.commandEffectHash === d08SmallN.commandEffectHash) {
      throw new Error(`D08 larger sample size should shrink PAC bound and command telemetry: ${JSON.stringify({ small: d08SmallN, large: d08LargeN })}.`);
    }

    await page.selectOption("#viewMode", "vc");
    await setRange(page, "#capacity", "2");
    await page.waitForTimeout(160);
    const d08LowCapacity = await page.evaluate(() => window.__d08LabSnapshot());
    await setRange(page, "#capacity", "9");
    await page.waitForTimeout(160);
    const d08HighCapacity = await page.evaluate(() => window.__d08LabSnapshot());
    requireStateText(d08HighCapacity, /VC|shattering|growth function|uniform convergence|capacity/i, "D08 VC");
    if (d08HighCapacity.vcDimension <= d08LowCapacity.vcDimension || d08HighCapacity.vcShatteringHash === d08LowCapacity.vcShatteringHash) {
      throw new Error(`D08 capacity should change VC/shattering geometry: ${JSON.stringify({ low: d08LowCapacity, high: d08HighCapacity })}.`);
    }

    await page.selectOption("#viewMode", "rademacher");
    await page.waitForTimeout(120);
    const d08Rad0 = await page.evaluate(() => window.__d08LabSnapshot());
    await page.locator("#stepTheory").click();
    await page.waitForTimeout(160);
    const d08Rad1 = await page.evaluate(() => window.__d08LabSnapshot());
    requireStateText(d08Rad1, /Rademacher|random signs|align|noise/i, "D08 Rademacher");
    if (d08Rad1.randomSignHash === d08Rad0.randomSignHash || d08Rad1.rademacherComplexityHash === d08Rad0.rademacherComplexityHash) {
      throw new Error(`D08 step should redraw random-sign field and complexity ribbon: ${JSON.stringify({ before: d08Rad0, after: d08Rad1 })}.`);
    }

    await page.selectOption("#viewMode", "stability");
    await setRange(page, "#regularization", "0.05");
    await page.waitForTimeout(160);
    const d08Unstable = await page.evaluate(() => window.__d08LabSnapshot());
    await setRange(page, "#regularization", "0.88");
    await page.waitForTimeout(160);
    const d08Stable = await page.evaluate(() => window.__d08LabSnapshot());
    requireStateText(d08Stable, /stability|leave-one-out|regularization|margin/i, "D08 stability");
    if (d08Stable.stabilityShift >= d08Unstable.stabilityShift || d08Stable.stabilityShiftHash === d08Unstable.stabilityShiftHash) {
      throw new Error(`D08 regularization should reduce leave-one-out movement: ${JSON.stringify({ unstable: d08Unstable, stable: d08Stable })}.`);
    }

    const d09 = await loadLab(page, "d09-regularization-lab.html", "__d09LabReady", "__d09LabSnapshot");
    requireRenderFit(d09, "D09");
    requireVersion(d09.snapshot, "D09");
    if (
      d09.snapshot.ridgeObjectCount < 5 ||
      d09.snapshot.lassoObjectCount < 5 ||
      d09.snapshot.elasticNetObjectCount < 4 ||
      d09.snapshot.validationObjectCount < 5 ||
      d09.snapshot.regularizationDiagnosticObjectCount < 5
    ) {
      throw new Error(`D09 lacks a full canonical regularization inventory: ${JSON.stringify(d09.snapshot)}.`);
    }
    requireIncludes(d09.snapshot.regularizationObjects, [
      "noisy_training_sample_points",
      "polynomial_fit_curve_f_lambda",
      "true_function_reference_curve",
      "train_test_error_rods",
      "ridge_l2_constraint_bowl",
      "ridge_svd_shrinkage_bars_sigma2_over_sigma2_plus_lambda",
      "lasso_l1_constraint_diamond",
      "soft_thresholding_zero_gates",
      "elastic_net_l1_l2_corridor",
      "coefficient_magnitude_skyline",
      "active_zeroed_coefficient_markers",
      "bias_variance_validation_u_curve",
      "lambda_best_validation_marker",
      "early_stopping_epoch_path",
      "weight_decay_shrinkage_arrow",
      "correlated_feature_stability_bridge",
      "regularization_strength_lambda_dial",
      "validation_leakage_guardrail",
      "bayesian_prior_pressure_reference",
      "effective_degrees_of_freedom_meter"
    ], "D09 objects");
    requireIncludes(d09.snapshot.canonicalReferences, [
      "Tikhonov ridge L2 shrinkage",
      "LASSO soft thresholding sparsity",
      "elastic net correlated feature grouping",
      "bias variance validation U curve",
      "early stopping implicit regularization"
    ], "D09 references");
    requireFiniteNumbers(d09.snapshot, [
      "degree", "lambda", "noise", "l1Mix", "patience", "trainError", "testError",
      "validationMinimum", "norm", "coefficientCount", "bias", "variance", "shrink",
      "earlyStopEpoch", "sampleSize", "zeroedCoefficientCount", "validationGap",
      "effectiveDegreesOfFreedom", "coefficientNorm", "regularizationStrength",
      "overfitRiskScore"
    ], "D09");
    requireIncludes(d09.snapshot.diagnosticMetrics, [
      "train_error", "test_error", "validation_minimum", "coefficient_norm",
      "active_coefficients", "zeroed_coefficients", "lambda", "degree",
      "bias", "variance"
    ], "D09 diagnostics");
    if (!d09.snapshot.fitCurveHash || !d09.snapshot.coefficientSkylineHash || !d09.snapshot.validationCurveHash || !d09.snapshot.biasVarianceCurveHash || !d09.snapshot.ridgeShrinkageHash || !d09.snapshot.lassoSparsityHash || !d09.snapshot.elasticNetHash || !d09.snapshot.earlyStoppingHash || !d09.snapshot.commandEffectHash) {
      throw new Error(`D09 should expose curve/coefficient/ridge/lasso/elastic/early/command hashes: ${JSON.stringify(d09.snapshot)}.`);
    }
    requireStateText(d09.snapshot, /Regularization|shrink|coefficients|validation|bias|variance/i, "D09 initial");

    await setRange(page, "#lambda", "0.02");
    await page.waitForTimeout(160);
    const d09Weak = await page.evaluate(() => window.__d09LabSnapshot());
    await setRange(page, "#lambda", "1.55");
    await page.waitForTimeout(160);
    const d09Strong = await page.evaluate(() => window.__d09LabSnapshot());
    if (d09Strong.norm >= d09Weak.norm || d09Strong.ridgeShrinkageHash === d09Weak.ridgeShrinkageHash || d09Strong.commandEffectHash === d09Weak.commandEffectHash) {
      throw new Error(`D09 lambda should shrink ridge geometry and command telemetry: ${JSON.stringify({ weak: d09Weak, strong: d09Strong })}.`);
    }

    await page.selectOption("#regularizer", "lasso");
    await setRange(page, "#lambda", "1.20");
    await page.waitForTimeout(160);
    const d09Lasso = await page.evaluate(() => window.__d09LabSnapshot());
    requireStateText(d09Lasso, /lasso|L1|zero|soft-threshold|coefficients/i, "D09 lasso");
    if (d09Lasso.zeroedCoefficientCount <= 0 || !d09Lasso.lassoSparsityHash) {
      throw new Error(`D09 lasso should show exact zeros and sparsity hash: ${JSON.stringify(d09Lasso)}.`);
    }

    await page.selectOption("#regularizer", "elastic");
    await setRange(page, "#l1Mix", "0.15");
    await page.waitForTimeout(160);
    const d09ElasticLow = await page.evaluate(() => window.__d09LabSnapshot());
    await setRange(page, "#l1Mix", "0.90");
    await page.waitForTimeout(160);
    const d09ElasticHigh = await page.evaluate(() => window.__d09LabSnapshot());
    requireStateText(d09ElasticHigh, /elastic|L1|L2|sparsity|stability/i, "D09 elastic");
    if (d09ElasticLow.elasticNetHash === d09ElasticHigh.elasticNetHash || d09ElasticHigh.zeroedCoefficientCount < d09ElasticLow.zeroedCoefficientCount) {
      throw new Error(`D09 elastic-net mix should trade ridge corridor for lasso sparsity: ${JSON.stringify({ low: d09ElasticLow, high: d09ElasticHigh })}.`);
    }

    await setRange(page, "#degree", "12");
    await setRange(page, "#noise", "0.34");
    await page.waitForTimeout(120);
    const d09BeforeBest = await page.evaluate(() => window.__d09LabSnapshot());
    await page.locator("#best").click();
    await page.waitForTimeout(160);
    const d09AfterBest = await page.evaluate(() => window.__d09LabSnapshot());
    if (Math.abs(d09AfterBest.lambda - d09AfterBest.validationMinimum) > 0.02 || d09AfterBest.validationCurveHash === d09BeforeBest.validationCurveHash) {
      throw new Error(`D09 Best should jump lambda to validation minimum marker: ${JSON.stringify({ before: d09BeforeBest, after: d09AfterBest })}.`);
    }
    await page.locator("#stepReg").click();
    await page.waitForTimeout(160);
    const d09Epoch = await page.evaluate(() => window.__d09LabSnapshot());
    if (d09Epoch.step !== d09AfterBest.step + 1 || d09Epoch.earlyStoppingHash === d09AfterBest.earlyStoppingHash) {
      throw new Error(`D09 epoch step should advance early-stopping path: ${JSON.stringify({ before: d09AfterBest, after: d09Epoch })}.`);
    }
  } finally {
    await browser.close();
  }

  console.log("d08-d09 canonical clarity passed: learning theory and regularization expose textbook objects, controls, and diagnostics.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
