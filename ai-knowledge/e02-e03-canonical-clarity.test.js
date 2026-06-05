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
      // Try the next bundled runtime path.
    }
  }
  throw new Error("Playwright is not available from the known runtime paths.");
}

const { chromium } = loadPlaywright();
const CLARITY_VERSION = "e02-e03-canonical-clarity-v2";
const LEGACY_VERSION = "e02-e03-canonical-clarity-v1";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function requireIncludes(values, expected, context) {
  const missing = expected.filter((value) => !values.includes(value));
  assert(missing.length === 0, `${context} missing canonical entries: ${missing.join(", ")}`);
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
  assert(snapshot.legacyClarityVersion === LEGACY_VERSION, `${context} should preserve legacy clarity marker: ${JSON.stringify(snapshot)}`);
  assert(snapshot.has3d === true, `${context} should explicitly expose 3D scene telemetry: ${JSON.stringify(snapshot)}`);
}

function requireStateText(snapshot, pattern, context) {
  assert(typeof snapshot.stateText === "string" && pattern.test(snapshot.stateText), `${context} state text does not explain the active phenomenon: ${JSON.stringify(snapshot)}`);
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

async function clickButton(page, selector) {
  await page.locator(selector).click();
  await page.waitForTimeout(150);
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
  assert(fit.commandBarHeight <= 170, `${context} command bar should stay compact and horizontal: ${JSON.stringify(fit)}`);
}

async function testE02(page) {
  await loadLab(page, "e02-backprop-computational-graph.html", "__e02LabReady", "__e02LabSnapshot");
  await requireRenderFit(page, "E02");
  const initial = await snapshot(page, "__e02LabSnapshot");
  requireVersion(initial, "E02");
  assert(initial.labId === "e02", `E02 should identify its lab id: ${JSON.stringify(initial)}`);
  assert(initial.computationalGraphObjectCount >= 6 && initial.reverseModeObjectCount >= 5 && initial.accumulationObjectCount >= 3 && initial.tapeCheckpointObjectCount >= 5 && initial.autodiffDiagnosticObjectCount >= 5, `E02 should expose concrete autodiff object inventories: ${JSON.stringify(initial)}`);
  requireIncludes(initial.autodiffObjects, [
    "primitive_operation_nodes_x_y_multiply_add_square",
    "forward_value_beads_on_computational_graph",
    "forward_data_dependency_edges",
    "scalar_loss_seed_adjoint_bar_z",
    "reverse_mode_adjoint_arrows",
    "vector_jacobian_product_rail",
    "local_derivative_jacobian_tiles",
    "shared_y_gradient_accumulation_junction",
    "two_path_gradient_contribution_arrows",
    "autodiff_tape_saved_tensor_stack",
    "checkpoint_recompute_tradeoff_bridge",
    "dense_layer_backprop_shape_plates",
    "gradient_descent_update_vector",
    "finite_difference_error_probe",
    "broadcast_reduction_warning_comb"
  ], "E02");
  requireIncludes(initial.canonicalReferences, [
    "reverse-mode automatic differentiation",
    "computational graph primitive operations",
    "adjoint accumulation over multiple paths",
    "vector-Jacobian product",
    "checkpointing memory recomputation tradeoff"
  ], "E02 references");
  requireIncludes(initial.diagnosticMetrics, [
    "z",
    "grad_x",
    "grad_y",
    "bar_z",
    "bar_u",
    "y_direct_contribution",
    "y_via_multiply_contribution",
    "tape_memory",
    "recompute_cost",
    "update_magnitude"
  ], "E02 metrics");
  requireFiniteNumbers(initial, [
    "z",
    "gradX",
    "gradY",
    "yDirectContribution",
    "yViaAContribution",
    "accumulationPaths",
    "tapeMemory",
    "recomputeCost",
    "updateMagnitude",
    "finiteDifferenceError",
    "x",
    "y",
    "upstream",
    "tapeDepth",
    "checkpointRate",
    "learningRate",
    "valueNodeCount",
    "reverseAdjointArrowCount",
    "gradientContributionCount",
    "tapeCellCount",
    "localJacobianTileCount",
    "checkpointBridgeCount",
    "vjpEfficiencyScore",
    "memorySavingRatio",
    "recomputePenalty",
    "accumulationBalance"
  ], "E02");
  requireHashes(initial, [
    "forwardGraphHash",
    "reverseSweepHash",
    "accumulationHash",
    "localJacobianHash",
    "tapeCheckpointHash",
    "gradientUpdateHash",
    "commandEffectHash"
  ], "E02");
  requireStateText(initial, /Forward pass|values|tape|reverse/i, "E02 initial");

  await setRange(page, "#xValue", "1.75");
  await setRange(page, "#yValue", "-1.1");
  const changedValues = await snapshot(page, "__e02LabSnapshot");
  assert(changedValues.z !== initial.z && changedValues.gradX !== initial.gradX && changedValues.gradY !== initial.gradY, `E02 x/y controls should alter values and gradients: ${JSON.stringify({ initial, changedValues })}`);
  assert(changedValues.forwardGraphHash !== initial.forwardGraphHash && changedValues.commandEffectHash !== initial.commandEffectHash, `E02 x/y controls should change forward graph telemetry: ${JSON.stringify({ initial, changedValues })}`);

  await setSelect(page, "#graphMode", "reverse");
  const beforeReverse = await snapshot(page, "__e02LabSnapshot");
  await clickButton(page, "#backwardPass");
  const afterReverse = await snapshot(page, "__e02LabSnapshot");
  assert(afterReverse.step === beforeReverse.step + 1 && afterReverse.reverseSweepHash !== beforeReverse.reverseSweepHash, `E02 backward button should advance reverse sweep telemetry: ${JSON.stringify({ beforeReverse, afterReverse })}`);
  requireStateText(afterReverse, /Reverse|adjoint|VJP|grad/i, "E02 reverse");

  await setSelect(page, "#graphMode", "accumulate");
  const accumulate = await snapshot(page, "__e02LabSnapshot");
  assert(Math.abs(accumulate.gradY - (accumulate.yDirectContribution + accumulate.yViaAContribution)) < 0.001 && accumulate.accumulationPaths >= 2, `E02 should show y gradient accumulation from two paths: ${JSON.stringify(accumulate)}`);
  requireHashes(accumulate, ["accumulationHash"], "E02 accumulation");
  requireStateText(accumulate, /accumulation|contributes|accumulate|overwrite/i, "E02 accumulation");

  await setSelect(page, "#graphMode", "tape");
  await setRange(page, "#tapeDepth", "10");
  await setRange(page, "#checkpointRate", "0.0");
  const fullTape = await snapshot(page, "__e02LabSnapshot");
  await setRange(page, "#checkpointRate", "0.85");
  const checkpointed = await snapshot(page, "__e02LabSnapshot");
  assert(checkpointed.tapeMemory < fullTape.tapeMemory && checkpointed.recomputeCost > fullTape.recomputeCost, `E02 checkpointing should lower tape memory and raise recomputation: ${JSON.stringify({ fullTape, checkpointed })}`);
  assert(checkpointed.tapeCheckpointHash !== fullTape.tapeCheckpointHash && checkpointed.commandEffectHash !== fullTape.commandEffectHash, `E02 checkpoint slider should change tape/checkpoint geometry: ${JSON.stringify({ fullTape, checkpointed })}`);
  requireStateText(checkpointed, /tape|checkpoint|memory|recompute/i, "E02 tape");

  await setRange(page, "#learningRate2", "0.05");
  const slowUpdate = await snapshot(page, "__e02LabSnapshot");
  await setRange(page, "#learningRate2", "0.35");
  const fastUpdate = await snapshot(page, "__e02LabSnapshot");
  assert(fastUpdate.updateMagnitude > slowUpdate.updateMagnitude && fastUpdate.gradientUpdateHash !== slowUpdate.gradientUpdateHash, `E02 learning rate should lengthen the gradient update vector: ${JSON.stringify({ slowUpdate, fastUpdate })}`);
}

async function testE03(page) {
  await loadLab(page, "e03-convolution-kernel-lab.html", "__e03LabReady", "__e03LabSnapshot");
  await requireRenderFit(page, "E03");
  const initial = await snapshot(page, "__e03LabSnapshot");
  requireVersion(initial, "E03");
  assert(initial.labId === "e03", `E03 should identify its lab id: ${JSON.stringify(initial)}`);
  assert(initial.inputImageObjectCount >= 5 && initial.kernelScanObjectCount >= 5 && initial.featureMapObjectCount >= 5 && initial.poolingObjectCount >= 3 && initial.cnnDiagnosticObjectCount >= 6, `E03 should expose concrete CNN object inventories: ${JSON.stringify(initial)}`);
  requireIncludes(initial.cnnObjects, [
    "input_image_pixel_grid",
    "shared_convolution_kernel_window",
    "kernel_weight_plate_kh_kw_channels",
    "local_patch_dot_product_beams",
    "feature_map_activation_grid",
    "padding_ghost_border_tiles",
    "stride_scan_footprint_path",
    "max_average_pooling_basins",
    "receptive_field_growth_tower",
    "channel_stack_rgb_tensor",
    "filter_bank_output_channels",
    "toeplitz_sparse_matrix_view",
    "weight_sharing_gradient_reuse_arrows",
    "residual_skip_connection_path",
    "translation_equivariant_shifted_response",
    "local_receptive_field_patch"
  ], "E03");
  requireIncludes(initial.canonicalReferences, [
    "cross-correlation sliding local dot product",
    "weight sharing over image positions",
    "output size stride padding formula",
    "pooling creates local invariance",
    "receptive field grows with depth"
  ], "E03 references");
  requireIncludes(initial.diagnosticMetrics, [
    "output_size",
    "kernel_size",
    "stride",
    "padding",
    "pooled_output_size",
    "receptive_field",
    "parameter_count",
    "feature_map_peak",
    "edge_participation",
    "active_patch_index"
  ], "E03 metrics");
  requireFiniteNumbers(initial, [
    "kernelSize",
    "stride",
    "padding",
    "outputSize",
    "pooledOutputSize",
    "receptiveField",
    "parameterCount",
    "edgeParticipation",
    "layers",
    "dilation",
    "contrast",
    "featureMapPeak",
    "inputPixelCount",
    "kernelCellCount",
    "featureMapCellCount",
    "poolCellCount",
    "channelSliceCount",
    "filterBankCount",
    "toeplitzCellCount",
    "gradientReuseArrowCount",
    "localDotProductScore",
    "weightSharingReuseCount",
    "outputAreaRatio"
  ], "E03");
  requireHashes(initial, [
    "cnnArchitectureHash",
    "weightSharingHash",
    "outputGeometryHash",
    "commandEffectHash",
    "localDotProductHash",
    "paddingStrideHash",
    "channelFilterBankHash"
  ], "E03");
  requireStateText(initial, /Scan|local dot product|shared kernel|feature map|stride|padding/i, "E03 initial");

  await setRange(page, "#kernelSize", "1");
  const pointKernel = await snapshot(page, "__e03LabSnapshot");
  await setRange(page, "#kernelSize", "7");
  const wideKernel = await snapshot(page, "__e03LabSnapshot");
  assert(wideKernel.parameterCount > pointKernel.parameterCount && wideKernel.kernelCellCount > pointKernel.kernelCellCount && wideKernel.receptiveField > pointKernel.receptiveField, `E03 kernel size should add weights and receptive field: ${JSON.stringify({ pointKernel, wideKernel })}`);
  assert(wideKernel.kernelPatchHash !== pointKernel.kernelPatchHash && wideKernel.localDotProductHash !== pointKernel.localDotProductHash, `E03 kernel size should reshape kernel/dot-product geometry: ${JSON.stringify({ pointKernel, wideKernel })}`);

  await setRange(page, "#kernelSize", "3");
  await setRange(page, "#stride", "1");
  await setRange(page, "#padding", "0");
  const tightScan = await snapshot(page, "__e03LabSnapshot");
  await setRange(page, "#stride", "2");
  await setRange(page, "#padding", "2");
  const paddedStride = await snapshot(page, "__e03LabSnapshot");
  assert(paddedStride.outputSize !== tightScan.outputSize && paddedStride.paddingStrideHash !== tightScan.paddingStrideHash, `E03 stride/padding should alter scan density and output geometry: ${JSON.stringify({ tightScan, paddedStride })}`);

  await setSelect(page, "#pooling", "none");
  const noPool = await snapshot(page, "__e03LabSnapshot");
  await setSelect(page, "#pooling", "max");
  const maxPool = await snapshot(page, "__e03LabSnapshot");
  assert(maxPool.pooledOutputSize < noPool.pooledOutputSize && maxPool.poolingMapHash !== noPool.poolingMapHash, `E03 max pooling should compress the feature map: ${JSON.stringify({ noPool, maxPool })}`);
  requireStateText(maxPool, /pooling|basins|strongest|position/i, "E03 pooling");

  const beforeScan = await snapshot(page, "__e03LabSnapshot");
  await clickButton(page, "#scan");
  const afterScan = await snapshot(page, "__e03LabSnapshot");
  assert(afterScan.activePatchIndex !== beforeScan.activePatchIndex && afterScan.slidingWindowHash !== beforeScan.slidingWindowHash, `E03 Move patch should advance the active sliding window: ${JSON.stringify({ beforeScan, afterScan })}`);

  await setRange(page, "#layers", "1");
  await setRange(page, "#dilation", "1");
  const shallow = await snapshot(page, "__e03LabSnapshot");
  await setRange(page, "#layers", "5");
  await setRange(page, "#dilation", "3");
  const deepDilated = await snapshot(page, "__e03LabSnapshot");
  assert(deepDilated.receptiveField > shallow.receptiveField && deepDilated.receptiveFieldTowerHash !== shallow.receptiveFieldTowerHash, `E03 layers/dilation should grow the receptive-field tower: ${JSON.stringify({ shallow, deepDilated })}`);

  await setSelect(page, "#inputPattern", "edge");
  await setRange(page, "#contrast", "0.55");
  const lowContrast = await snapshot(page, "__e03LabSnapshot");
  await setSelect(page, "#inputPattern", "small-object");
  await setRange(page, "#contrast", "1.55");
  const highContrast = await snapshot(page, "__e03LabSnapshot");
  assert(highContrast.featureMapPeak !== lowContrast.featureMapPeak && highContrast.inputImageHash !== lowContrast.inputImageHash && highContrast.channelFilterBankHash !== lowContrast.channelFilterBankHash, `E03 pattern/contrast should alter image, channels, and feature activations: ${JSON.stringify({ lowContrast, highContrast })}`);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1360, height: 820 } });
  try {
    await testE02(page);
    await testE03(page);
  } finally {
    await browser.close();
  }
  console.log("e02/e03 canonical clarity v2 passed: autodiff and CNN labs expose concrete textbook objects, controllable geometry, hashes, metrics, and fitted 3D scenes.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
