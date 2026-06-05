const path = require("path");

function loadPlaywright() {
  const candidates = [
    "playwright",
    "C:/Users/02gab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
    "C:/Users/02gab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright",
    "C:/Users/Gabriele/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"
  ];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (error) {
      // Try the next known bundled runtime path.
    }
  }
  throw new Error("Playwright is not available from the known runtime paths.");
}

const { chromium } = loadPlaywright();
const CLARITY_VERSION = "d10-e01-canonical-clarity-v2";
const LEGACY_VERSION = "d10-e01-canonical-clarity-v1";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function requireIncludes(values, expected, context) {
  const missing = expected.filter((value) => !values.includes(value));
  assert(missing.length === 0, `${context} missing canonical objects: ${missing.join(", ")}`);
}

function requireFiniteNumbers(snapshot, keys, context) {
  const missing = keys.filter((key) => !Number.isFinite(snapshot[key]));
  assert(missing.length === 0, `${context} missing finite numeric telemetry: ${missing.join(", ")} in ${JSON.stringify(snapshot)}`);
}

function requireHashes(snapshot, keys, context) {
  const missing = keys.filter((key) => typeof snapshot[key] !== "string" || snapshot[key].length < 2);
  assert(missing.length === 0, `${context} missing geometry hashes: ${missing.join(", ")} in ${JSON.stringify(snapshot)}`);
}

function requireVersion(snapshot, context) {
  assert(snapshot.clarityVersion === CLARITY_VERSION, `${context} expected ${CLARITY_VERSION}: ${JSON.stringify(snapshot)}`);
  assert(snapshot.legacyClarityVersion === LEGACY_VERSION, `${context} should preserve legacy telemetry marker: ${JSON.stringify(snapshot)}`);
  assert(snapshot.has3d === true, `${context} should explicitly expose a 3D scene: ${JSON.stringify(snapshot)}`);
}

function requireStateText(snapshot, pattern, context) {
  assert(typeof snapshot.stateText === "string" && pattern.test(snapshot.stateText), `${context} state text is not explanatory enough: ${JSON.stringify(snapshot)}`);
}

async function setRange(page, selector, value) {
  await page.locator(selector).evaluate((input, nextValue) => {
    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
  await page.waitForTimeout(120);
}

async function setSelect(page, selector, value) {
  await page.locator(selector).selectOption(value);
  await page.waitForTimeout(130);
}

async function loadLab(page, file, readyName, snapshotName) {
  const labPath = path.join(__dirname, file).replace(/\\/g, "/");
  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
  await page.waitForFunction(
    ([ready, snapshot]) => window[ready] === true && typeof window[snapshot] === "function",
    [readyName, snapshotName]
  );
  await page.waitForTimeout(260);
}

async function snapshot(page, snapshotName) {
  return page.evaluate((name) => window[name](), snapshotName);
}

async function requireRenderFit(page, context) {
  const shot = await page.screenshot({ type: "png" });
  assert(shot.length > 15000, `${context} render is too sparse: ${shot.length} bytes`);
  const fit = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const bar = document.querySelector(".command-bar");
    return {
      overflowX: Math.max(0, root.scrollWidth - root.clientWidth, body.scrollWidth - body.clientWidth),
      overflowY: Math.max(0, root.scrollHeight - root.clientHeight, body.scrollHeight - body.clientHeight),
      commandBarHeight: bar ? bar.getBoundingClientRect().height : 999
    };
  });
  assert(fit.overflowX <= 18 && fit.overflowY <= 18, `${context} should fit without dedicated page scrollbars: ${JSON.stringify(fit)}`);
  assert(fit.commandBarHeight <= 170, `${context} command bar should remain horizontal and compact: ${JSON.stringify(fit)}`);
}

async function testD10(page) {
  await loadLab(page, "d10-model-selection-evaluation-lab.html", "__d10LabReady", "__d10LabSnapshot");
  await requireRenderFit(page, "D10");
  const initial = await snapshot(page, "__d10LabSnapshot");
  requireVersion(initial, "D10");
  assert(initial.labId === "d10", `D10 should identify its lab id: ${JSON.stringify(initial)}`);
  assert(initial.holdoutObjectCount >= 6 && initial.crossValidationObjectCount >= 5 && initial.nestedCvObjectCount >= 4 && initial.thresholdCalibrationObjectCount >= 5 && initial.leakageDiagnosticObjectCount >= 5, `D10 should expose concrete model-selection object inventories: ${JSON.stringify(initial)}`);
  requireIncludes(initial.modelSelectionObjects, [
    "train_validation_test_split_regions",
    "split_firewall_boundaries",
    "training_examples_fit_only",
    "validation_candidate_selection_surface",
    "test_set_final_report_marker",
    "hyperparameter_search_candidate_beads",
    "validation_test_optimism_gap_rods",
    "k_fold_cross_validation_carousel",
    "fold_variance_stability_spokes",
    "nested_cv_inner_selection_loop",
    "nested_cv_outer_estimation_ring",
    "probability_threshold_operating_marker",
    "precision_recall_curve_path",
    "confusion_matrix_cost_cells",
    "calibration_reliability_surface",
    "expected_cost_wall",
    "leakage_forbidden_evidence_bridge",
    "test_contamination_warning_gate",
    "honest_test_firewall",
    "deployment_metric_dashboard"
  ], "D10");
  requireIncludes(initial.canonicalReferences, [
    "train validation test split protocol",
    "K-fold cross-validation",
    "nested cross-validation separates selection and estimation",
    "threshold calibration precision recall cost",
    "data leakage pipeline audit"
  ], "D10 references");
  requireIncludes(initial.diagnosticMetrics, [
    "validation_score",
    "test_score",
    "selection_optimism",
    "fold_variance",
    "nested_bias",
    "precision",
    "recall",
    "expected_cost",
    "calibration_error",
    "leak_inflation"
  ], "D10 metrics");
  requireFiniteNumbers(initial, [
    "validationScore",
    "testScore",
    "optimism",
    "foldVariance",
    "foldStability",
    "nestedBias",
    "recall",
    "precision",
    "expectedCost",
    "calibrationError",
    "leakInflation",
    "searchBreadth",
    "folds",
    "threshold",
    "costRatio",
    "leakage",
    "classImbalance",
    "splitRegionCount",
    "candidateBeadCount",
    "activeFoldCount",
    "selectionOptimismGap",
    "cvVarianceScore",
    "thresholdUtilityScore",
    "leakageInflationScore",
    "calibrationReliabilityError"
  ], "D10");
  requireHashes(initial, [
    "splitProtocolHash",
    "candidateSelectionHash",
    "crossValidationHash",
    "nestedCvHash",
    "thresholdCalibrationHash",
    "leakageAuditHash",
    "commandEffectHash"
  ], "D10");
  requireStateText(initial, /Holdout|train|validation|test|selection|optimism/i, "D10");

  await setRange(page, "#searchBreadth", "4");
  const narrow = await snapshot(page, "__d10LabSnapshot");
  await setRange(page, "#searchBreadth", "22");
  const broad = await snapshot(page, "__d10LabSnapshot");
  assert(broad.optimism > narrow.optimism && broad.candidateBeadCount > narrow.candidateBeadCount, `D10 broad search should add candidates and selection optimism: ${JSON.stringify({ narrow, broad })}`);
  assert(broad.candidateSelectionHash !== narrow.candidateSelectionHash && broad.commandEffectHash !== narrow.commandEffectHash, `D10 search breadth should visibly alter selection geometry and telemetry: ${JSON.stringify({ narrow, broad })}`);

  await setSelect(page, "#mode", "crossValidation");
  await setRange(page, "#folds", "3");
  const fewFolds = await snapshot(page, "__d10LabSnapshot");
  await setRange(page, "#folds", "9");
  const manyFolds = await snapshot(page, "__d10LabSnapshot");
  assert(manyFolds.activeFoldCount > fewFolds.activeFoldCount && manyFolds.foldVariance < fewFolds.foldVariance, `D10 folds should rotate more folds and reduce variance: ${JSON.stringify({ fewFolds, manyFolds })}`);
  assert(manyFolds.crossValidationHash !== fewFolds.crossValidationHash, `D10 fold count should alter cross-validation geometry: ${JSON.stringify({ fewFolds, manyFolds })}`);
  requireStateText(manyFolds, /cross-validation|fold|variance|stability/i, "D10 cross-validation");

  await setSelect(page, "#mode", "nested");
  const nested = await snapshot(page, "__d10LabSnapshot");
  assert(nested.nestedBias < nested.optimism, `D10 nested CV should reduce selected-score bias: ${JSON.stringify(nested)}`);
  requireHashes(nested, ["nestedCvHash"], "D10 nested CV");
  requireStateText(nested, /Nested CV|inner|outer|bias|estimation/i, "D10 nested CV");

  await setSelect(page, "#mode", "threshold");
  await setRange(page, "#threshold", "0.24");
  await setRange(page, "#costRatio", "1.5");
  const lowThreshold = await snapshot(page, "__d10LabSnapshot");
  await setRange(page, "#threshold", "0.78");
  await setRange(page, "#costRatio", "7.0");
  const highThreshold = await snapshot(page, "__d10LabSnapshot");
  assert(highThreshold.precision > lowThreshold.precision && highThreshold.recall < lowThreshold.recall && highThreshold.expectedCost !== lowThreshold.expectedCost, `D10 threshold should trade precision, recall, and cost: ${JSON.stringify({ lowThreshold, highThreshold })}`);
  assert(highThreshold.thresholdCalibrationHash !== lowThreshold.thresholdCalibrationHash, `D10 threshold controls should move calibration/cost geometry: ${JSON.stringify({ lowThreshold, highThreshold })}`);
  requireStateText(highThreshold, /threshold|calibration|cost|precision|recall/i, "D10 threshold");

  await setSelect(page, "#mode", "leakage");
  await setRange(page, "#leakage", "0.00");
  const clean = await snapshot(page, "__d10LabSnapshot");
  await setRange(page, "#leakage", "0.88");
  const leaky = await snapshot(page, "__d10LabSnapshot");
  assert(leaky.leakInflation > clean.leakInflation && leaky.leakageAuditHash !== clean.leakageAuditHash, `D10 leakage should intensify forbidden evidence and audit telemetry: ${JSON.stringify({ clean, leaky })}`);
  requireStateText(leaky, /leakage|forbidden|firewall|test/i, "D10 leakage");
}

async function testE01(page) {
  await loadLab(page, "e01-mlp-decision-regions.html", "__e01LabReady", "__e01LabSnapshot");
  await requireRenderFit(page, "E01");
  const initial = await snapshot(page, "__e01LabSnapshot");
  requireVersion(initial, "E01");
  assert(initial.labId === "e01", `E01 should identify its lab id: ${JSON.stringify(initial)}`);
  assert(initial.mlpArchitectureObjectCount >= 6 && initial.neuronActivationObjectCount >= 5 && initial.decisionRegionObjectCount >= 5 && initial.trainingSignalObjectCount >= 5 && initial.neuralDiagnosticObjectCount >= 5, `E01 should expose concrete MLP object inventories: ${JSON.stringify(initial)}`);
  requireIncludes(initial.mlpObjects, [
    "input_plane_x1_x2_training_points",
    "single_neuron_affine_boundary_wx_plus_b",
    "hidden_layer_half_space_gate_planes",
    "xor_two_hidden_unit_feature_lift",
    "decision_region_probability_surface",
    "layered_mlp_node_architecture",
    "weight_matrix_cells_w_l",
    "bias_and_activation_vector_bars",
    "relu_piecewise_linear_activation_fold",
    "sigmoid_tanh_saturation_reference",
    "linear_activation_affine_collapse_warning",
    "forward_signal_flow_edges",
    "loss_bead_cross_entropy_surface",
    "gradient_update_arrows",
    "tensor_shape_tiles_batch_weight_bias",
    "parameter_count_capacity_tower",
    "universal_approximation_width_fan",
    "depth_composition_signal_columns",
    "dead_relu_warning_markers",
    "softmax_sigmoid_output_reference"
  ], "E01");
  requireIncludes(initial.canonicalReferences, [
    "perceptron affine hyperplane",
    "MLP hidden nonlinear feature map",
    "XOR needs hidden units",
    "nonlinear activation prevents affine collapse",
    "universal approximation width caveat"
  ], "E01 references");
  requireIncludes(initial.diagnosticMetrics, [
    "train_accuracy",
    "loss",
    "decision_regions",
    "parameter_count",
    "hidden_width",
    "depth",
    "active_layers",
    "active_gates",
    "dead_relu_count",
    "signal_stability"
  ], "E01 metrics");
  requireFiniteNumbers(initial, [
    "trainAccuracy",
    "loss",
    "decisionRegions",
    "parameterCount",
    "signalStability",
    "step",
    "hiddenWidth",
    "depth",
    "signalGain",
    "dataNoise",
    "learningRate",
    "activeLayerCount",
    "visibleNeuronCount",
    "weightMatrixCellCount",
    "activationBarCount",
    "hiddenGateCount",
    "nonlinearityStrength",
    "xorSolvabilityScore",
    "activationSaturationScore",
    "shapeParameterCount",
    "signalFlowStabilityScore"
  ], "E01");
  requireHashes(initial, [
    "mlpArchitectureHash",
    "decisionRegionHash",
    "activationNonlinearityHash",
    "weightTensorHash",
    "trainingUpdateHash",
    "universalApproximationHash",
    "commandEffectHash"
  ], "E01");
  requireStateText(initial, /single neuron|hidden units|activation|decision regions|MLP|XOR/i, "E01");

  await setSelect(page, "#modelMode", "single");
  const single = await snapshot(page, "__e01LabSnapshot");
  await setSelect(page, "#modelMode", "xor");
  await setRange(page, "#hiddenWidth", "6");
  const xor = await snapshot(page, "__e01LabSnapshot");
  assert(xor.hiddenGateCount > single.hiddenGateCount && xor.decisionRegions > single.decisionRegions, `E01 XOR should need hidden half-space gates: ${JSON.stringify({ single, xor })}`);
  assert(xor.decisionRegionHash !== single.decisionRegionHash && xor.hiddenGateHash !== single.hiddenGateHash, `E01 XOR should visibly change gates and decision regions: ${JSON.stringify({ single, xor })}`);

  await setSelect(page, "#activation", "linear");
  const linear = await snapshot(page, "__e01LabSnapshot");
  await setSelect(page, "#activation", "relu");
  const relu = await snapshot(page, "__e01LabSnapshot");
  assert(linear.decisionRegions === 1 && relu.decisionRegions > linear.decisionRegions, `E01 nonlinearity should prevent affine collapse: ${JSON.stringify({ linear, relu })}`);
  assert(relu.activationNonlinearityHash !== linear.activationNonlinearityHash, `E01 activation selector should alter activation/fold geometry: ${JSON.stringify({ linear, relu })}`);

  await setRange(page, "#hiddenWidth", "2");
  const thin = await snapshot(page, "__e01LabSnapshot");
  await setRange(page, "#hiddenWidth", "9");
  const wide = await snapshot(page, "__e01LabSnapshot");
  assert(wide.parameterCount > thin.parameterCount && wide.weightTensorHash !== thin.weightTensorHash && wide.universalApproximationHash !== thin.universalApproximationHash, `E01 width should add parameters and approximation geometry: ${JSON.stringify({ thin, wide })}`);

  await setRange(page, "#depth", "1");
  const shallow = await snapshot(page, "__e01LabSnapshot");
  await setRange(page, "#depth", "5");
  const deep = await snapshot(page, "__e01LabSnapshot");
  assert(deep.activeLayerCount > shallow.activeLayerCount && deep.mlpArchitectureHash !== shallow.mlpArchitectureHash && deep.layerSignalHash !== shallow.layerSignalHash, `E01 depth should add layers and composed signal columns: ${JSON.stringify({ shallow, deep })}`);

  const beforeTrain = await snapshot(page, "__e01LabSnapshot");
  await page.locator("#trainStep").click();
  await page.waitForTimeout(140);
  const afterTrain = await snapshot(page, "__e01LabSnapshot");
  assert(afterTrain.step === beforeTrain.step + 1 && afterTrain.trainAccuracy > beforeTrain.trainAccuracy && afterTrain.loss < beforeTrain.loss, `E01 training should improve accuracy and lower loss: ${JSON.stringify({ beforeTrain, afterTrain })}`);
  assert(afterTrain.trainingUpdateHash !== beforeTrain.trainingUpdateHash && afterTrain.commandEffectHash !== beforeTrain.commandEffectHash, `E01 training should move update telemetry: ${JSON.stringify({ beforeTrain, afterTrain })}`);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1360, height: 820 } });
  try {
    await testD10(page);
    await testE01(page);
  } finally {
    await browser.close();
  }
  console.log("d10/e01 canonical clarity v2 passed: model-selection and MLP labs expose concrete canonical objects, controls, metrics, hashes, and fitted 3D scenes.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
