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
const CLARITY_VERSION = "e04-e05-canonical-clarity-v2";
const LEGACY_VERSION = "e04-e05-canonical-clarity-v1";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function requireIncludes(values, expected, context) {
  const missing = expected.filter((value) => !values.includes(value));
  assert(missing.length === 0, `${context} missing canonical entries: ${missing.join(", ")} in ${JSON.stringify(values)}`);
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
  await page.waitForTimeout(140);
}

async function clickButton(page, selector) {
  await page.locator(selector).click();
  await page.waitForTimeout(160);
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

async function testE04(page) {
  await loadLab(page, "e04-rnn-hidden-state-lab.html", "__e04LabReady", "__e04LabSnapshot");
  await requireRenderFit(page, "E04");
  const initial = await snapshot(page, "__e04LabSnapshot");
  requireVersion(initial, "E04");
  assert(initial.labId === "e04", `E04 should identify its lab id: ${JSON.stringify(initial)}`);
  assert(
    initial.recurrentSequenceObjectCount >= 6 &&
      initial.bpttObjectCount >= 6 &&
      initial.gatedMemoryObjectCount >= 5 &&
      initial.trainingDiagnosticObjectCount >= 6,
    `E04 should expose concrete RNN/BPTT object inventories: ${JSON.stringify(initial)}`
  );
  requireIncludes(initial.rnnObjects, [
    "token_embedding_input_plates",
    "shared_recurrent_cell_unroll",
    "hidden_state_memory_ribbon",
    "output_head_logits_per_step",
    "many_to_one_readout_head",
    "sequence_task_pattern_plates",
    "bptt_reverse_gradient_arrows",
    "jacobian_product_tiles",
    "vanishing_gradient_fade_curve",
    "exploding_gradient_flare_markers",
    "truncated_bptt_boundary_wall",
    "gradient_clipping_norm_ring",
    "lstm_forget_input_output_gates",
    "lstm_additive_cell_state_highway",
    "gru_update_reset_gate_mixer",
    "teacher_forcing_prediction_bridge",
    "padding_masked_sequence_slots",
    "bidirectional_forward_backward_lanes"
  ], "E04");
  requireIncludes(initial.canonicalReferences, [
    "unrolled recurrent computation graph",
    "BPTT Jacobian product through time",
    "vanishing and exploding gradient diagnostics",
    "LSTM additive cell-state highway and gates",
    "GRU update/reset interpolation",
    "truncated BPTT and gradient clipping"
  ], "E04 references");
  requireIncludes(initial.diagnosticMetrics, [
    "memory_strength",
    "gradient_norm",
    "bptt_span",
    "clipping_norm",
    "exploding_risk",
    "vanishing_index",
    "active_token",
    "sequence_length"
  ], "E04 metrics");
  requireFiniteNumbers(initial, [
    "sequenceLength",
    "recurrentScale",
    "gateStrength",
    "truncationWindow",
    "clipNorm",
    "distractorRate",
    "timeStep",
    "activeToken",
    "memoryStrength",
    "gradientAtFirst",
    "gradientNorm",
    "hiddenEnergy",
    "bpttSpan",
    "vanishingIndex",
    "explodingRisk",
    "memoryRetentionRatio",
    "gradientStabilityScore",
    "gatePreservationScore",
    "truncationCoverage",
    "sequenceCompressionRatio"
  ], "E04");
  requireHashes(initial, [
    "recurrentArchitectureHash",
    "memoryFlowHash",
    "bpttCreditAssignmentHash",
    "gateHighwayHash",
    "trainingStabilityHash",
    "commandEffectHash"
  ], "E04");
  requireStateText(initial, /RNN|hidden state|sequence|memory/i, "E04 initial");

  await clickButton(page, "#step");
  const stepped = await snapshot(page, "__e04LabSnapshot");
  assert(stepped.timeStep === initial.timeStep + 1, `E04 read-token step should advance active token: ${JSON.stringify({ initial, stepped })}`);
  assert(stepped.memoryFlowHash !== initial.memoryFlowHash && stepped.commandEffectHash !== initial.commandEffectHash, `E04 step should move hidden memory telemetry: ${JSON.stringify({ initial, stepped })}`);

  await setSelect(page, "#cellType", "lstm");
  await setRange(page, "#sequenceLength", "12");
  await setRange(page, "#gateStrength", "0.92");
  const lstm = await snapshot(page, "__e04LabSnapshot");
  assert(lstm.cellType === "lstm" && lstm.sequenceLength === 12 && lstm.cellHighwayVisible === true, `E04 LSTM controls should reveal additive memory highway: ${JSON.stringify(lstm)}`);
  assert(lstm.gatePreservationScore > initial.gatePreservationScore && lstm.gateHighwayHash !== initial.gateHighwayHash, `E04 gate slider should preserve memory and reshape gates: ${JSON.stringify({ initial, lstm })}`);

  await setRange(page, "#recurrentScale", "1.2");
  await setRange(page, "#clipNorm", "0.45");
  await setRange(page, "#truncationWindow", "4");
  await clickButton(page, "#backpropStep");
  const bptt = await snapshot(page, "__e04LabSnapshot");
  assert(bptt.mode === "bptt" && bptt.bpttSpan === 4 && bptt.explodingRisk > 0, `E04 BPTT should expose truncated exploding-gradient risk: ${JSON.stringify(bptt)}`);
  assert(bptt.bpttCreditAssignmentHash !== lstm.bpttCreditAssignmentHash && bptt.trainingStabilityHash !== lstm.trainingStabilityHash, `E04 BPTT/gain/clip controls should reshape credit-assignment geometry: ${JSON.stringify({ lstm, bptt })}`);
  requireStateText(bptt, /BPTT|gradient|clip|truncated|explode|vanish/i, "E04 BPTT");
}

async function testE05(page) {
  await loadLab(page, "e05-attention-flow.html", "__e05LabReady", "__e05LabSnapshot");
  await requireRenderFit(page, "E05");
  const initial = await snapshot(page, "__e05LabSnapshot");
  requireVersion(initial, "E05");
  assert(initial.labId === "e05", `E05 should identify its lab id: ${JSON.stringify(initial)}`);
  assert(
    initial.attentionRetrievalObjectCount >= 6 &&
      initial.qkvProjectionObjectCount >= 5 &&
      initial.maskingSoftmaxObjectCount >= 5 &&
      initial.transformerBlockObjectCount >= 5 &&
      initial.efficiencyDiagnosticObjectCount >= 3,
    `E05 should expose concrete attention/Transformer object inventories: ${JSON.stringify(initial)}`
  );
  requireIncludes(initial.attentionObjects, [
    "token_embedding_sequence_rails",
    "query_key_value_vector_triplets",
    "selected_query_score_row",
    "dot_product_score_matrix_cells",
    "scale_by_sqrt_dk_control",
    "masked_logits_shutter_wall",
    "softmax_probability_bars",
    "value_weighted_sum_output_basin",
    "multi_head_parallel_relation_lanes",
    "head_concatenation_projection_matrix",
    "sinusoidal_positional_wave_ruler",
    "causal_mask_lower_triangle",
    "padding_mask_blocked_key_slots",
    "local_window_attention_band",
    "transformer_layernorm_residual_bridge",
    "positionwise_ffn_tower",
    "attention_entropy_diagnostic",
    "quadratic_T_by_T_cost_lattice"
  ], "E05");
  requireIncludes(initial.canonicalReferences, [
    "scaled dot-product attention Q K V",
    "softmax over allowed key positions",
    "causal and padding masks before softmax",
    "multi-head attention specialization",
    "positional encoding restores order",
    "Transformer residual LayerNorm FFN block",
    "quadratic sequence-pair attention cost"
  ], "E05 references");
  requireIncludes(initial.diagnosticMetrics, [
    "attention_entropy",
    "max_weight",
    "allowed_keys",
    "masked_count",
    "head_count",
    "output_mix_magnitude",
    "sequence_length",
    "temperature"
  ], "E05 metrics");
  requireFiniteNumbers(initial, [
    "queryIndex",
    "temperature",
    "headCount",
    "positionBias",
    "sequenceLength",
    "valueMix",
    "scoreScale",
    "localWindow",
    "attentionEntropy",
    "maxWeight",
    "maskedCount",
    "allowedKeyCount",
    "outputMixMagnitude",
    "attentionCostCells",
    "softmaxTemperatureSharpness",
    "maskSparsityRatio",
    "headDiversityScore",
    "valueAggregationStrength"
  ], "E05");
  requireHashes(initial, [
    "attentionArchitectureHash",
    "qkvProjectionHash",
    "scoreSoftmaxHash",
    "maskingHash",
    "multiHeadSpecializationHash",
    "positionOrderHash",
    "valueAggregationHash",
    "transformerBlockHash",
    "commandEffectHash"
  ], "E05");
  requireStateText(initial, /query|key|value|softmax|head|position/i, "E05 initial");

  await setSelect(page, "#maskType", "causal");
  await setRange(page, "#temperature", "0.4");
  await clickButton(page, "#applyMask");
  const causal = await snapshot(page, "__e05LabSnapshot");
  assert(causal.maskType === "causal" && causal.allowedKeyCount === 3 && causal.maskedCount > 0, `E05 causal mask should block future keys: ${JSON.stringify(causal)}`);
  assert(causal.maxWeight > initial.maxWeight && causal.maskingHash !== initial.maskingHash && causal.scoreSoftmaxHash !== initial.scoreSoftmaxHash, `E05 mask/temp controls should reshape masked softmax: ${JSON.stringify({ initial, causal })}`);
  requireStateText(causal, /causal|mask|softmax|allowed|value/i, "E05 causal");

  await setRange(page, "#headCount", "7");
  await setSelect(page, "#headType", "copy");
  const heads = await snapshot(page, "__e05LabSnapshot");
  assert(heads.headCount === 7 && heads.headLaneCount === 7, `E05 head count should create visible lanes: ${JSON.stringify(heads)}`);
  assert(heads.multiHeadSpecializationHash !== causal.multiHeadSpecializationHash && heads.qkvProjectionHash !== initial.qkvProjectionHash, `E05 head controls should reshape multi-head QKV geometry: ${JSON.stringify({ causal, heads })}`);

  await setRange(page, "#positionBias", "-0.75");
  await setRange(page, "#valueMix", "1.25");
  await clickButton(page, "#mixValues");
  const mixed = await snapshot(page, "__e05LabSnapshot");
  assert(mixed.positionOrderHash !== heads.positionOrderHash && mixed.valueAggregationHash !== heads.valueAggregationHash, `E05 position and value controls should move position wave and value basin: ${JSON.stringify({ heads, mixed })}`);
  assert(mixed.frame > heads.frame && mixed.valueAggregationStrength > heads.valueAggregationStrength, `E05 Mix values should advance value aggregation telemetry: ${JSON.stringify({ heads, mixed })}`);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 920, height: 700 } });
  try {
    await testE04(page);
    await testE05(page);
  } finally {
    await browser.close();
  }
  console.log("e04-e05 canonical clarity passed: RNN/BPTT and attention/Transformer labs expose concrete textbook objects, control consequences, orbit/zoom, and fitted iframes.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
