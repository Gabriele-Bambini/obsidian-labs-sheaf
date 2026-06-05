const path = require("path");

const PAIR_QUALITY = "e06-e07-canonical-clarity-v2";
const LEGACY_QUALITY = "e06-e07-canonical-clarity-v1";

function loadPlaywright() {
  const candidates = [
    "playwright",
    "C:/Users/02gab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright",
    "C:/Users/02gab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
    "C:/Users/Gabriele/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright",
    "C:/Users/Gabriele/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"
  ];
  let lastError = null;
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

const { chromium } = loadPlaywright();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function setRange(page, selector, value) {
  await page.locator(selector).evaluate((input, nextValue) => {
    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function snapshot(page, name) {
  return page.evaluate((snapshotName) => window[snapshotName](), name);
}

async function loadLab(page, fileName, readyName, snapshotName) {
  const labPath = path.join(__dirname, fileName).replace(/\\/g, "/");
  await page.goto(`file:///${labPath}?visual-clarity=e06-e07`);
  await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
  await page.waitForFunction(
    ([ready, snap]) => window[ready] === true && typeof window[snap] === "function" && window[snap](),
    [readyName, snapshotName]
  );
  await page.waitForTimeout(180);
  const loaded = await page.evaluate((snap) => {
    const canvas = document.querySelector(".lab-viewport canvas");
    return {
      bytes: canvas.toDataURL("image/png").length,
      snapshot: window[snap](),
      overflowX: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
      overflowY: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight
    };
  }, snapshotName);
  assert(loaded.bytes > 11000, `${fileName} canvas payload is too weak: ${loaded.bytes}`);
  assert(loaded.overflowX <= 2 && loaded.overflowY <= 2, `${fileName} creates iframe overflow ${loaded.overflowX}x${loaded.overflowY}`);
  return loaded.snapshot;
}

function requireHash(value, label) {
  assert(typeof value === "string" && value.length >= 4, `${label} must be a stable visual hash, got ${value}`);
}

async function verifyE06(page) {
  let s = await loadLab(page, "e06-llm-token-prediction.html", "__e06LabReady", "__e06LabSnapshot");
  assert(s.clarityVersion === PAIR_QUALITY, `E06 missing clarity marker: ${s.clarityVersion}`);
  assert(s.legacyClarityVersion === LEGACY_QUALITY, `E06 should preserve legacy clarity marker: ${JSON.stringify(s)}`);
  assert(s.contextTokenCount === s.contextLength, `E06 context token objects should match context length: ${JSON.stringify(s)}`);
  assert(s.tokenizerPlateCount === s.contextLength, `E06 tokenizer plates should match context length: ${JSON.stringify(s)}`);
  assert(s.embeddingVectorCount === s.contextLength, `E06 embeddings should match context length: ${JSON.stringify(s)}`);
  assert(s.decoderBlockCount >= 6, `E06 should expose decoder transformer stack blocks, got ${s.decoderBlockCount}`);
  assert(s.causalMaskCellCount === s.contextLength * s.contextLength, `E06 causal mask must be T x T: ${JSON.stringify(s)}`);
  assert(s.logitBarCount >= s.rawCandidateCount, `E06 should expose vocabulary logit bars: ${JSON.stringify(s)}`);
  assert(s.softmaxProbCount >= s.rawCandidateCount, `E06 should expose softmax probabilities: ${JSON.stringify(s)}`);
  assert(s.decodingGateCount >= 1, `E06 should expose decoding filter gate, got ${s.decodingGateCount}`);
  assert(s.feedbackLoopCount >= 1, `E06 should expose autoregressive feedback loop, got ${s.feedbackLoopCount}`);
  assert(s.kvCacheSlotCount === s.contextLength, `E06 KV cache slots should match context length: ${JSON.stringify(s)}`);
  assert(s.autoregressiveFactorCount >= s.contextLength - 1, `E06 should expose factorization beads, got ${s.autoregressiveFactorCount}`);
  assert(s.crossEntropyTargetCount >= 1, `E06 should expose next-token loss target object, got ${s.crossEntropyTargetCount}`);
  assert(s.retrievalEvidenceCount >= 3, `E06 should expose retrieval/grounding evidence objects, got ${s.retrievalEvidenceCount}`);
  [
    "contextConveyorHash",
    "tokenizerSegmentationHash",
    "embeddingRackHash",
    "decoderStackHash",
    "causalMaskHash",
    "logitsSkylineHash",
    "probabilityFanHash",
    "decodingFilterHash",
    "feedbackLoopHash",
    "kvCacheHash",
    "autoregressiveFactorHash",
    "crossEntropyLossHash",
    "groundingEvidenceHash"
  ].forEach((key) => requireHash(s[key], `E06 ${key}`));

  const initial = s;
  await page.locator("#decodingMode").selectOption("topk");
  await setRange(page, "#temperature", "1.45");
  await setRange(page, "#topK", "2");
  await setRange(page, "#contextWindow", "7");
  await page.click("#generateToken");
  s = await snapshot(page, "__e06LabSnapshot");
  assert(s.decodingMode === "topk" && s.topK === 2 && s.generatedLength === 1, `E06 generate/top-k controls did not apply: ${JSON.stringify(s)}`);
  assert(s.contextLength <= 7 && s.candidateCount <= 2, `E06 context/filter controls did not affect process: ${JSON.stringify(s)}`);
  assert(s.contextConveyorHash !== initial.contextConveyorHash, "E06 Generate should move context conveyor");
  assert(s.feedbackLoopHash !== initial.feedbackLoopHash, "E06 Generate should activate feedback loop");
  assert(s.decodingFilterHash !== initial.decodingFilterHash, "E06 decoding controls should reshape filter gate");

  await setRange(page, "#retrievalStrength", "0.95");
  await setRange(page, "#modelScale", "1.65");
  const grounded = await snapshot(page, "__e06LabSnapshot");
  assert(grounded.groundingEvidenceHash !== s.groundingEvidenceHash, "E06 retrieval strength must reshape grounding evidence");
  assert(grounded.logitsSkylineHash !== s.logitsSkylineHash, "E06 model scale/retrieval must reshape logits");
  assert(grounded.hallucinationRisk < s.hallucinationRisk, "E06 stronger grounding should lower hallucination risk");

  await page.click("#resetGeneration");
  const reset = await snapshot(page, "__e06LabSnapshot");
  assert(reset.promptScenario === "causal" && reset.decodingMode === "greedy" && reset.generatedLength === 0, `E06 reset should restore selects/context: ${JSON.stringify(reset)}`);
  assert(reset.temperature === 1 && reset.topK === 3 && reset.topP === 0.9 && reset.contextWindow === 9 && reset.modelScale === 1 && reset.retrievalStrength === 0.35, `E06 reset should restore sliders: ${JSON.stringify(reset)}`);
}

async function verifyE07(page) {
  let s = await loadLab(page, "e07-vae-latent-space-lab.html", "__e07LabReady", "__e07LabSnapshot");
  assert(s.clarityVersion === PAIR_QUALITY, `E07 missing clarity marker: ${s.clarityVersion}`);
  assert(s.legacyClarityVersion === LEGACY_QUALITY, `E07 should preserve legacy clarity marker: ${JSON.stringify(s)}`);
  assert(s.encoderPlateCount >= 4, `E07 should expose encoder architecture plates, got ${s.encoderPlateCount}`);
  assert(s.muGaugeCount >= 2 && s.sigmaGaugeCount >= 2, `E07 should expose mu/sigma gauges: ${JSON.stringify(s)}`);
  assert(s.posteriorEllipseCount >= 4, `E07 should expose posterior Gaussian ellipses, got ${s.posteriorEllipseCount}`);
  assert(s.priorRingCount >= 4, `E07 should expose standard normal prior rings, got ${s.priorRingCount}`);
  assert(s.epsilonNoiseCount >= 5, `E07 should expose epsilon noise objects, got ${s.epsilonNoiseCount}`);
  assert(s.reparameterizationBridgeCount >= 1, `E07 should expose z=mu+sigma eps bridge, got ${s.reparameterizationBridgeCount}`);
  assert(s.latentSampleCount >= 30, `E07 should expose latent samples, got ${s.latentSampleCount}`);
  assert(s.decoderPlateCount >= 4, `E07 should expose decoder architecture plates, got ${s.decoderPlateCount}`);
  assert(s.reconstructionTileCount >= 16, `E07 should expose reconstruction tiles, got ${s.reconstructionTileCount}`);
  assert(s.elboBalanceCount >= 3, `E07 should expose recon/KL/ELBO balance objects, got ${s.elboBalanceCount}`);
  assert(s.traversalPointCount >= 5, `E07 should expose latent traversal points, got ${s.traversalPointCount}`);
  assert(s.posteriorCollapseObjectCount >= 1 && s.priorHoleDetectorCount >= 3, `E07 should expose collapse and latent-hole diagnostics: ${JSON.stringify(s)}`);
  [
    "encoderPosteriorHash",
    "muSigmaGaugeHash",
    "priorBowlHash",
    "epsilonNoiseHash",
    "reparameterizationHash",
    "latentSampleHash",
    "decoderManifoldHash",
    "reconstructionTileHash",
    "elboSeesawHash",
    "traversalRailHash",
    "collapseFunnelHash",
    "priorHoleHash"
  ].forEach((key) => requireHash(s[key], `E07 ${key}`));

  const initial = s;
  await page.locator("#sampleMode").selectOption("prior");
  await page.locator("#inputClass").selectOption("loop");
  await setRange(page, "#beta", "2.8");
  await setRange(page, "#latentSpread", "1.65");
  await setRange(page, "#reconstructionWeight", "0.45");
  await setRange(page, "#epsilon", "1.25");
  await page.click("#sampleLatent");
  s = await snapshot(page, "__e07LabSnapshot");
  assert(s.sampleMode === "prior" && s.inputClass === "loop" && Math.abs(s.beta - 2.8) < 0.01, `E07 sample/prior controls did not apply: ${JSON.stringify(s)}`);
  assert(s.klLoss > 0 && s.elboLoss > 0 && s.priorOverlap > 0, `E07 loss metrics should be active: ${JSON.stringify(s)}`);
  assert(s.priorBowlHash !== initial.priorBowlHash, "E07 spread/beta should reshape prior bowl");
  assert(s.reparameterizationHash !== initial.reparameterizationHash, "E07 epsilon/sample should move reparameterization bridge");
  assert(s.elboSeesawHash !== initial.elboSeesawHash, "E07 beta/recon controls should move ELBO seesaw");

  await setRange(page, "#traversalAxis", "0.9");
  await setRange(page, "#decoderSharpness", "1.1");
  await page.click("#traverseLatent");
  const traversed = await snapshot(page, "__e07LabSnapshot");
  assert(traversed.traversalRailHash !== s.traversalRailHash, "E07 traversal controls should move traversal rail/beads");
  assert(traversed.decoderManifoldHash !== s.decoderManifoldHash, "E07 decoder sharpness should reshape decoded manifold");

  await page.click("#resetVae");
  const reset = await snapshot(page, "__e07LabSnapshot");
  assert(reset.sampleMode === "encode" && reset.inputClass === "digit" && reset.beta === 1 && reset.latentSpread === 1, `E07 reset should restore primary controls: ${JSON.stringify(reset)}`);
  assert(reset.reconstructionWeight === 0.85 && reset.epsilon === 0.4 && reset.decoderSharpness === 0.72 && reset.traversalAxis === 0.45 && reset.klAnneal === 1, `E07 reset should restore all sliders: ${JSON.stringify(reset)}`);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  try {
    await verifyE06(page);
    await verifyE07(page);
  } finally {
    await browser.close();
  }
  console.log("e06-e07 visual clarity passed: LLM generation and VAE latent labs expose canonical, concrete, interactive teaching objects.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
