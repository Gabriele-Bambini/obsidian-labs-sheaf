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
const CLARITY_VERSION = "e06-e07-canonical-clarity-v2";
const LEGACY_VERSION = "e06-e07-canonical-clarity-v1";

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
  await page.goto(`file:///${labPath}?canonical-clarity=e06-e07-v2`);
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

async function testE06(page) {
  await loadLab(page, "e06-llm-token-prediction.html", "__e06LabReady", "__e06LabSnapshot");
  await requireRenderFit(page, "E06");
  const initial = await snapshot(page, "__e06LabSnapshot");
  requireVersion(initial, "E06");
  assert(initial.labId === "e06", `E06 should identify its lab id: ${JSON.stringify(initial)}`);
  assert(
    initial.autoregressiveObjectCount >= 6 &&
      initial.decoderTransformerObjectCount >= 6 &&
      initial.decodingPolicyObjectCount >= 5 &&
      initial.groundingReliabilityObjectCount >= 5 &&
      initial.efficiencyObjectCount >= 4,
    `E06 should expose concrete LLM object inventories: ${JSON.stringify(initial)}`
  );
  requireIncludes(initial.llmObjects, [
    "context_token_conveyor",
    "subword_tokenizer_segmentation_plates",
    "embedding_vector_lift_rack",
    "positional_signal_marks",
    "decoder_transformer_stack_blocks",
    "causal_attention_mask_triangle",
    "autoregressive_factorization_beads",
    "vocabulary_logits_skyline",
    "softmax_probability_distribution_fan",
    "cross_entropy_target_marker",
    "temperature_distribution_sharpness",
    "top_k_filter_gate",
    "top_p_nucleus_mass_gate",
    "generated_token_feedback_loop",
    "kv_cache_key_value_shelves",
    "context_window_crop_boundary",
    "retrieval_grounding_evidence_plates",
    "hallucination_risk_gauge",
    "scaling_law_compute_balance_board",
    "instruction_preference_tuning_ladder"
  ], "E06");
  requireIncludes(initial.canonicalReferences, [
    "autoregressive next-token factorization",
    "decoder-only causal Transformer",
    "cross-entropy over vocabulary logits",
    "temperature top-k top-p decoding",
    "KV cache for autoregressive inference",
    "retrieval grounding and hallucination diagnostics",
    "scaling-law compute/data/model balance"
  ], "E06 references");
  requireIncludes(initial.diagnosticMetrics, [
    "top_probability",
    "candidate_count",
    "context_length",
    "kv_cache_slots",
    "cross_entropy_loss",
    "hallucination_risk",
    "retrieval_strength",
    "generated_length"
  ], "E06 metrics");
  requireFiniteNumbers(initial, [
    "contextLength",
    "generatedLength",
    "candidateCount",
    "kvCacheSlots",
    "topProbability",
    "hallucinationRisk",
    "nextTokenCrossEntropy",
    "contextUtilizationRatio",
    "kvCacheReuseRatio",
    "decodingEntropy",
    "groundingConfidence",
    "scalingBalanceScore"
  ], "E06");
  requireHashes(initial, [
    "llmArchitectureHash",
    "nextTokenDistributionHash",
    "decodingPolicyHash",
    "autoregressiveLoopHash",
    "kvCacheEfficiencyHash",
    "groundingReliabilityHash",
    "commandEffectHash"
  ], "E06");
  requireStateText(initial, /token|logit|softmax|context|KV|cache/i, "E06 initial");

  await setSelect(page, "#decodingMode", "topk");
  await setRange(page, "#temperature", "1.45");
  await setRange(page, "#topK", "2");
  await setRange(page, "#contextWindow", "7");
  await clickButton(page, "#generateToken");
  const generated = await snapshot(page, "__e06LabSnapshot");
  assert(generated.generatedLength === initial.generatedLength + 1, `E06 appending one token should advance generated length: ${JSON.stringify({ initial, generated })}`);
  assert(generated.candidateCount <= 2 && generated.contextLength <= 7, `E06 top-k and context window should constrain the visible process: ${JSON.stringify(generated)}`);
  assert(generated.nextTokenDistributionHash !== initial.nextTokenDistributionHash, `E06 decoding controls should reshape next-token probabilities: ${JSON.stringify({ initial, generated })}`);
  assert(generated.autoregressiveLoopHash !== initial.autoregressiveLoopHash, `E06 generated token should visibly feed back into context: ${JSON.stringify({ initial, generated })}`);
  assert(generated.commandEffectHash !== initial.commandEffectHash, `E06 command telemetry should change after generation: ${JSON.stringify({ initial, generated })}`);

  await setRange(page, "#retrievalStrength", "0.95");
  await setRange(page, "#modelScale", "1.65");
  const grounded = await snapshot(page, "__e06LabSnapshot");
  assert(grounded.hallucinationRisk < generated.hallucinationRisk, `E06 retrieval grounding should reduce hallucination risk: ${JSON.stringify({ generated, grounded })}`);
  assert(grounded.groundingReliabilityHash !== generated.groundingReliabilityHash, `E06 grounding evidence should move with retrieval controls: ${JSON.stringify({ generated, grounded })}`);
}

async function testE07(page) {
  await loadLab(page, "e07-vae-latent-space-lab.html", "__e07LabReady", "__e07LabSnapshot");
  await requireRenderFit(page, "E07");
  const initial = await snapshot(page, "__e07LabSnapshot");
  requireVersion(initial, "E07");
  assert(initial.labId === "e07", `E07 should identify its lab id: ${JSON.stringify(initial)}`);
  assert(
    initial.encoderPosteriorObjectCount >= 6 &&
      initial.latentGaussianObjectCount >= 7 &&
      initial.reparameterizationObjectCount >= 4 &&
      initial.decoderReconstructionObjectCount >= 5 &&
      initial.elboDiagnosticObjectCount >= 5,
    `E07 should expose concrete VAE object inventories: ${JSON.stringify(initial)}`
  );
  requireIncludes(initial.vaeObjects, [
    "input_image_observation_tiles",
    "encoder_mu_logvar_network_plates",
    "mu_sigma_latent_gauges",
    "posterior_gaussian_ellipses_q_z_given_x",
    "standard_normal_prior_rings",
    "epsilon_noise_source_beads",
    "reparameterization_bridge_z_equals_mu_plus_sigma_epsilon",
    "latent_sample_cloud",
    "decoder_likelihood_manifold",
    "reconstruction_output_tiles",
    "reconstruction_loss_rods",
    "kl_to_prior_pressure_arrows",
    "beta_vae_elbo_seesaw",
    "kl_annealing_schedule_strip",
    "posterior_collapse_funnel",
    "latent_hole_detector_marks",
    "prior_sampling_path",
    "latent_traversal_axis_beads",
    "generative_story_prior_to_x_path",
    "diagonal_gaussian_kl_formula_panel"
  ], "E07");
  requireIncludes(initial.canonicalReferences, [
    "encoder approximate posterior q_phi(z|x)",
    "standard normal latent prior p(z)",
    "reparameterization trick",
    "ELBO reconstruction minus KL",
    "beta-VAE reconstruction regularization tradeoff",
    "posterior collapse and latent holes",
    "latent traversal and prior sampling"
  ], "E07 references");
  requireIncludes(initial.diagnosticMetrics, [
    "reconstruction_loss",
    "kl_loss",
    "elbo_loss",
    "prior_overlap",
    "beta",
    "epsilon",
    "latent_spread",
    "posterior_collapse"
  ], "E07 metrics");
  requireFiniteNumbers(initial, [
    "latentSigma",
    "latentLogvar",
    "reconstructionLoss",
    "klLoss",
    "elboLoss",
    "priorOverlap",
    "posteriorCollapseRisk",
    "priorHoleRisk",
    "klPressure",
    "reconstructionPressure",
    "latentHoleRisk",
    "elboTradeoffScore",
    "priorSamplingReliability"
  ], "E07");
  requireHashes(initial, [
    "vaeArchitectureHash",
    "posteriorGeometryHash",
    "priorRegularizationHash",
    "reparameterizationFlowHash",
    "decoderReconstructionHash",
    "elboTradeoffHash",
    "latentTraversalHash",
    "commandEffectHash"
  ], "E07");
  requireStateText(initial, /encoder|decoder|latent|KL|ELBO|reparameterization/i, "E07 initial");

  await setSelect(page, "#sampleMode", "prior");
  await setSelect(page, "#inputClass", "loop");
  await setRange(page, "#beta", "2.8");
  await setRange(page, "#latentSpread", "1.65");
  await setRange(page, "#reconstructionWeight", "0.45");
  await setRange(page, "#epsilon", "1.25");
  await clickButton(page, "#sampleLatent");
  const sampled = await snapshot(page, "__e07LabSnapshot");
  assert(sampled.sampleMode === "prior" && sampled.inputClass === "loop", `E07 prior sampling controls should apply: ${JSON.stringify(sampled)}`);
  assert(sampled.klPressure > initial.klPressure && sampled.latentHoleRisk >= initial.latentHoleRisk, `E07 beta/prior controls should expose KL pressure and latent holes: ${JSON.stringify({ initial, sampled })}`);
  assert(sampled.priorRegularizationHash !== initial.priorRegularizationHash, `E07 prior geometry should move with beta/spread: ${JSON.stringify({ initial, sampled })}`);
  assert(sampled.reparameterizationFlowHash !== initial.reparameterizationFlowHash, `E07 epsilon/sample should move z = mu + sigma epsilon bridge: ${JSON.stringify({ initial, sampled })}`);
  assert(sampled.elboTradeoffHash !== initial.elboTradeoffHash, `E07 ELBO tradeoff should respond to beta/reconstruction controls: ${JSON.stringify({ initial, sampled })}`);

  await setRange(page, "#traversalAxis", "0.9");
  await setRange(page, "#decoderSharpness", "1.1");
  await clickButton(page, "#traverseLatent");
  const traversed = await snapshot(page, "__e07LabSnapshot");
  assert(traversed.latentTraversalHash !== sampled.latentTraversalHash, `E07 traversal controls should move latent interpolation: ${JSON.stringify({ sampled, traversed })}`);
  assert(traversed.decoderReconstructionHash !== sampled.decoderReconstructionHash, `E07 decoder sharpness should change reconstructed tiles/manifold: ${JSON.stringify({ sampled, traversed })}`);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 920, height: 700 } });
  try {
    await testE06(page);
    await testE07(page);
  } finally {
    await browser.close();
  }
  console.log("e06-e07 canonical clarity passed: LLM and VAE labs expose concrete textbook objects, control consequences, orbit/zoom, and fitted iframes.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
