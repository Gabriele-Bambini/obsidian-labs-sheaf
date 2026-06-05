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
const CLARITY_VERSION = "d06-d07-canonical-clarity-v2";
const LEGACY_VERSION = "d06-d07-canonical-clarity-v1";

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
    const d06 = await loadLab(page, "d06-ensemble-methods-lab.html", "__d06LabReady", "__d06LabSnapshot");
    requireRenderFit(d06, "D06");
    requireVersion(d06.snapshot, "D06");
    if (
      d06.snapshot.baggingObjectCount < 6 ||
      d06.snapshot.forestObjectCount < 5 ||
      d06.snapshot.boostingObjectCount < 5 ||
      d06.snapshot.stackingObjectCount < 5 ||
      d06.snapshot.ensembleDiagnosticObjectCount < 5
    ) {
      throw new Error(`D06 lacks a full canonical ensemble inventory: ${JSON.stringify(d06.snapshot)}.`);
    }
    requireIncludes(d06.snapshot.ensembleObjects, [
      "bootstrap_resampled_training_row_matrix",
      "duplicate_row_markers_and_oob_row_gaps",
      "bagged_tree_prediction_fan",
      "variance_reduction_average_surface",
      "error_correlation_rho_meter",
      "out_of_bag_validation_ribbon",
      "random_forest_feature_subsample_gates",
      "per_split_max_features_masks",
      "decorrelated_tree_boundary_fan",
      "feature_importance_permutation_warning_panel",
      "boosting_residual_vector_bars",
      "negative_gradient_correction_arrows",
      "additive_model_stage_path_f_m",
      "learning_rate_shrinkage_dial",
      "training_loss_and_margin_curve",
      "stacking_oof_prediction_matrix",
      "base_model_prediction_columns",
      "meta_learner_weight_mixer",
      "validation_holdout_leakage_barrier",
      "ensemble_mode_comparison_workbench"
    ], "D06 objects");
    requireIncludes(d06.snapshot.canonicalReferences, [
      "Breiman bagging bootstrap aggregation",
      "random forest decorrelation by feature subsampling",
      "AdaBoost sequential reweighting",
      "gradient boosting negative residuals",
      "stacking out-of-fold meta learner"
    ], "D06 references");
    requireFiniteNumbers(d06.snapshot, [
      "correlation", "varianceReduction", "oobError", "trainingLoss", "margin",
      "metaWeightSpread", "leakageRisk", "stage", "modelCount", "featureSubsample",
      "learningRate", "diversity", "baseDepth", "bootstrapSampleCount",
      "bootstrapDuplicateRowCount", "inBagUniqueRate", "oobRowCount",
      "activeFeatureGateCount", "residualBarCount", "oofPredictionColumnCount",
      "ensembleVarianceTerm", "correlationPenalty", "oobValidationScore",
      "boostingStageLoss", "stackingLeakageRisk"
    ], "D06");
    requireIncludes(d06.snapshot.diagnosticMetrics, [
      "variance_reduction", "error_correlation", "oob_error", "training_loss",
      "margin", "model_count", "feature_subsample", "bootstrap_duplicates",
      "active_feature_gates", "oof_prediction_columns"
    ], "D06 diagnostics");
    if (!d06.snapshot.baggingVarianceHash || !d06.snapshot.forestDecorrelationHash || !d06.snapshot.boostingResidualHash || !d06.snapshot.stackingOofHash || !d06.snapshot.commandEffectHash) {
      throw new Error(`D06 should expose bagging/forest/boosting/stacking/command hashes: ${JSON.stringify(d06.snapshot)}.`);
    }
    requireStateText(d06.snapshot, /bagging|bootstrap|variance|forest|boosting|stacking/i, "D06 initial");

    await setRange(page, "#modelCount", "6");
    await page.waitForTimeout(160);
    const d06SmallBag = await page.evaluate(() => window.__d06LabSnapshot());
    await setRange(page, "#modelCount", "20");
    await page.waitForTimeout(160);
    const d06LargeBag = await page.evaluate(() => window.__d06LabSnapshot());
    if (d06LargeBag.varianceReduction <= d06SmallBag.varianceReduction || d06LargeBag.baggingVarianceHash === d06SmallBag.baggingVarianceHash) {
      throw new Error(`D06 more bagged learners should smooth variance geometry: ${JSON.stringify({ small: d06SmallBag, large: d06LargeBag })}.`);
    }

    await page.selectOption("#mode", "forest");
    await setRange(page, "#featureSubsample", "0.30");
    await page.waitForTimeout(160);
    const d06SparseForest = await page.evaluate(() => window.__d06LabSnapshot());
    await setRange(page, "#featureSubsample", "0.90");
    await page.waitForTimeout(160);
    const d06DenseForest = await page.evaluate(() => window.__d06LabSnapshot());
    requireStateText(d06SparseForest, /Random forest|feature subsampling|decorrelates|out-of-bag/i, "D06 forest");
    if (d06SparseForest.activeFeatureGateCount >= d06DenseForest.activeFeatureGateCount || d06SparseForest.forestDecorrelationHash === d06DenseForest.forestDecorrelationHash) {
      throw new Error(`D06 feature subsampling should open gates and change forest decorrelation telemetry: ${JSON.stringify({ sparse: d06SparseForest, dense: d06DenseForest })}.`);
    }

    await page.selectOption("#mode", "boosting");
    await setRange(page, "#learningRate", "0.16");
    await page.waitForTimeout(160);
    const d06Boost0 = await page.evaluate(() => window.__d06LabSnapshot());
    await page.locator("#stepEnsemble").click();
    await page.waitForTimeout(160);
    const d06Boost1 = await page.evaluate(() => window.__d06LabSnapshot());
    requireStateText(d06Boost1, /Boosting|weak learners|residual|training loss|margin/i, "D06 boosting");
    if (d06Boost1.trainingLoss >= d06Boost0.trainingLoss || d06Boost1.boostingResidualHash === d06Boost0.boostingResidualHash) {
      throw new Error(`D06 boosting step should lower loss and redraw residual corrections: ${JSON.stringify({ before: d06Boost0, after: d06Boost1 })}.`);
    }

    await page.selectOption("#mode", "stacking");
    await setRange(page, "#diversity", "0.20");
    await page.waitForTimeout(160);
    const d06StackLow = await page.evaluate(() => window.__d06LabSnapshot());
    await setRange(page, "#diversity", "0.86");
    await page.waitForTimeout(160);
    const d06StackHigh = await page.evaluate(() => window.__d06LabSnapshot());
    requireStateText(d06StackHigh, /Stacking|out-of-fold|meta-weight|leakage/i, "D06 stacking");
    if (d06StackHigh.stackingOofHash === d06StackLow.stackingOofHash || d06StackHigh.leakageBarrierOpacity >= d06StackLow.leakageBarrierOpacity) {
      throw new Error(`D06 diversity should reshape stacking weights and lower visible leakage risk: ${JSON.stringify({ low: d06StackLow, high: d06StackHigh })}.`);
    }

    const d07 = await loadLab(page, "d07-metric-learning-lab.html", "__d07LabReady", "__d07LabSnapshot");
    requireRenderFit(d07, "D07");
    requireVersion(d07.snapshot, "D07");
    if (
      d07.snapshot.embeddingObjectCount < 6 ||
      d07.snapshot.metricTensorObjectCount < 5 ||
      d07.snapshot.contrastiveTripletObjectCount < 6 ||
      d07.snapshot.proxyRetrievalObjectCount < 5 ||
      d07.snapshot.metricLearningDiagnosticObjectCount < 5
    ) {
      throw new Error(`D07 lacks a full canonical metric-learning inventory: ${JSON.stringify(d07.snapshot)}.`);
    }
    requireIncludes(d07.snapshot.metricLearningObjects, [
      "raw_input_points_colored_by_identity",
      "learned_embedding_point_cloud_z",
      "mahalanobis_matrix_l_transpose_l_cells",
      "metric_ellipse_distance_shell",
      "euclidean_distance_sphere_reference",
      "cosine_unit_sphere_and_angular_arcs",
      "siamese_shared_encoder_pair_towers",
      "positive_pair_pull_tether",
      "negative_pair_margin_hinge_shell",
      "triplet_anchor_positive_negative_markers",
      "triplet_loss_margin_inequality_ruler",
      "hard_negative_mining_spotlight",
      "proxy_class_centers_on_unit_sphere",
      "proxy_attraction_rays",
      "top_k_retrieval_ranking_strip",
      "pairwise_distance_matrix_cells",
      "embedding_collapse_warning_basin",
      "knn_retrieval_accuracy_meter",
      "margin_violation_loss_meter",
      "normalization_temperature_reference"
    ], "D07 objects");
    requireIncludes(d07.snapshot.canonicalReferences, [
      "Mahalanobis metric factorization",
      "Siamese contrastive loss margin",
      "FaceNet triplet loss hard negative mining",
      "Proxy based metric learning",
      "retrieval precision at k and verification ROC"
    ], "D07 references");
    requireFiniteNumbers(d07.snapshot, [
      "loss", "knnAccuracy", "positiveDistance", "negativeDistance", "tripletViolation",
      "collapseScore", "margin", "classSeparation", "embeddingSpread", "metricStretch",
      "miningPressure", "step", "embeddingPointCount", "tripletCableCount",
      "retrievalRankTileCount", "metricMatrixCellCount", "distanceMatrixCellCount",
      "marginShellRadius", "proxyCount", "angularMarginArcCount", "activeMarginViolation",
      "retrievalTopKCorrectRate", "collapseRiskScore", "metricStretchCondition",
      "positiveNegativeGap"
    ], "D07");
    requireIncludes(d07.snapshot.diagnosticMetrics, [
      "loss", "knn_accuracy", "positive_distance", "negative_distance",
      "triplet_violation", "margin", "active_negative", "retrieval_top_k",
      "collapse_score", "metric_stretch"
    ], "D07 diagnostics");
    if (!d07.snapshot.embeddingGeometryHash || !d07.snapshot.tripletGeometryHash || !d07.snapshot.contrastiveTripletHash || !d07.snapshot.metricTensorHash || !d07.snapshot.retrievalHash || !d07.snapshot.proxyGeometryHash || !d07.snapshot.commandEffectHash) {
      throw new Error(`D07 should expose embedding/triplet/metric/retrieval/proxy/command hashes: ${JSON.stringify(d07.snapshot)}.`);
    }
    requireStateText(d07.snapshot, /Triplet|anchor|positive|negative|margin|retrieval|metric/i, "D07 initial");

    await page.selectOption("#metricType", "mahalanobis");
    await setRange(page, "#metricStretch", "0.78");
    await page.waitForTimeout(160);
    const d07LowStretch = await page.evaluate(() => window.__d07LabSnapshot());
    await setRange(page, "#metricStretch", "2.20");
    await page.waitForTimeout(160);
    const d07HighStretch = await page.evaluate(() => window.__d07LabSnapshot());
    if (d07LowStretch.metricTensorHash === d07HighStretch.metricTensorHash || d07LowStretch.commandEffectHash === d07HighStretch.commandEffectHash) {
      throw new Error(`D07 Mahalanobis stretch should reshape tensor and command telemetry: ${JSON.stringify({ low: d07LowStretch, high: d07HighStretch })}.`);
    }

    await page.selectOption("#miningMode", "hard");
    await page.waitForTimeout(120);
    const d07Mined0 = await page.evaluate(() => window.__d07LabSnapshot());
    await page.locator("#mineTriplet").click();
    await page.waitForTimeout(160);
    const d07Mined1 = await page.evaluate(() => window.__d07LabSnapshot());
    requireStateText(d07Mined1, /hard negative|anchor|positive|negative|margin/i, "D07 mining");
    if (d07Mined0.activeNegative === d07Mined1.activeNegative || d07Mined0.contrastiveTripletHash === d07Mined1.contrastiveTripletHash) {
      throw new Error(`D07 mining should select a different negative and redraw triplet geometry: ${JSON.stringify({ before: d07Mined0, after: d07Mined1 })}.`);
    }
    const d07BeforeTrain = await page.evaluate(() => window.__d07LabSnapshot());
    await page.locator("#trainStep").click();
    await page.waitForTimeout(160);
    const d07AfterTrain = await page.evaluate(() => window.__d07LabSnapshot());
    if (d07AfterTrain.loss > d07BeforeTrain.loss || d07AfterTrain.embeddingGeometryHash === d07BeforeTrain.embeddingGeometryHash) {
      throw new Error(`D07 training should not increase loss and should reshape embedding neighborhoods: ${JSON.stringify({ before: d07BeforeTrain, after: d07AfterTrain })}.`);
    }

    await page.selectOption("#lossType", "contrastive");
    await setRange(page, "#margin", "0.30");
    await page.waitForTimeout(160);
    const d07SmallMargin = await page.evaluate(() => window.__d07LabSnapshot());
    await setRange(page, "#margin", "0.95");
    await page.waitForTimeout(160);
    const d07LargeMargin = await page.evaluate(() => window.__d07LabSnapshot());
    requireStateText(d07LargeMargin, /Contrastive|positive pair|negative hinge|margin|retrieval/i, "D07 contrastive");
    if (d07SmallMargin.contrastiveTripletHash === d07LargeMargin.contrastiveTripletHash || d07LargeMargin.marginShellRadius <= d07SmallMargin.marginShellRadius) {
      throw new Error(`D07 contrastive margin should resize hinge shell and telemetry: ${JSON.stringify({ small: d07SmallMargin, large: d07LargeMargin })}.`);
    }

    await page.selectOption("#lossType", "proxy");
    await page.waitForTimeout(160);
    const d07Proxy0 = await page.evaluate(() => window.__d07LabSnapshot());
    await page.locator("#runFive").click();
    await page.waitForTimeout(160);
    const d07Proxy5 = await page.evaluate(() => window.__d07LabSnapshot());
    requireStateText(d07Proxy5, /Proxy|class proxies|unit sphere|retrieval|angular/i, "D07 proxy");
    if (d07Proxy5.knnAccuracy < d07Proxy0.knnAccuracy || d07Proxy5.proxyGeometryHash === d07Proxy0.proxyGeometryHash) {
      throw new Error(`D07 proxy training should improve retrieval and move angular proxy geometry: ${JSON.stringify({ before: d07Proxy0, after: d07Proxy5 })}.`);
    }
  } finally {
    await browser.close();
  }

  console.log("d06-d07 canonical clarity passed: ensemble methods and metric learning expose textbook objects, controls, and diagnostics.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
