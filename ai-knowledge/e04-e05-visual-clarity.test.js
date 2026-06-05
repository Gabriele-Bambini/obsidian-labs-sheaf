const path = require("path");

const PAIR_QUALITY = "e04-e05-canonical-clarity-v2";
const LEGACY_QUALITY = "e04-e05-canonical-clarity-v1";

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
  await page.goto(`file:///${labPath}?visual-clarity=e04-e05`);
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

function requireHash(snapshotValue, label) {
  assert(typeof snapshotValue === "string" && snapshotValue.length >= 4, `${label} must be a stable visual hash, got ${snapshotValue}`);
}

async function verifyE04(page) {
  let s = await loadLab(page, "e04-rnn-hidden-state-lab.html", "__e04LabReady", "__e04LabSnapshot");
  assert(s.clarityVersion === PAIR_QUALITY, `E04 missing clarity marker: ${s.clarityVersion}`);
  assert(s.legacyClarityVersion === LEGACY_QUALITY, `E04 should preserve old marker for compatibility: ${JSON.stringify(s)}`);
  assert(s.tokenPlateCount === s.sequenceLength, `E04 token plates should match sequence length: ${JSON.stringify(s)}`);
  assert(s.recurrentCellCount === s.sequenceLength, `E04 recurrent cells should match sequence length: ${JSON.stringify(s)}`);
  assert(s.hiddenStateCount === s.sequenceLength, `E04 hidden states should match sequence length: ${JSON.stringify(s)}`);
  assert(s.transitionEdgeCount === s.sequenceLength - 1, `E04 should expose temporal transition edges: ${JSON.stringify(s)}`);
  assert(s.outputHeadCount === s.sequenceLength, `E04 should expose per-step output heads: ${JSON.stringify(s)}`);
  assert(s.jacobianProductCount >= 5, `E04 should expose BPTT Jacobian product tiles, got ${s.jacobianProductCount}`);
  assert(s.inputPatternCount >= 3, `E04 should expose sequence task/input-pattern objects, got ${s.inputPatternCount}`);
  [
    "unrolledChainHash",
    "hiddenMemoryHash",
    "sharedTransitionHash",
    "gateMechanismHash",
    "bpttGradientHash",
    "truncationWallHash",
    "clipRingHash",
    "outputHeadHash",
    "jacobianProductHash",
    "teacherForcingHash"
  ].forEach((key) => requireHash(s[key], `E04 ${key}`));

  const initial = s;
  await page.click("#step");
  s = await snapshot(page, "__e04LabSnapshot");
  assert(s.timeStep === 1, `E04 step should advance active token: ${JSON.stringify(s)}`);
  assert(s.hiddenMemoryHash !== initial.hiddenMemoryHash, "E04 step must move the active hidden-state memory visualization");

  await page.locator("#cellType").selectOption("lstm");
  await setRange(page, "#sequenceLength", "12");
  await setRange(page, "#gateStrength", "0.92");
  const gated = await snapshot(page, "__e04LabSnapshot");
  assert(gated.cellType === "lstm" && gated.sequenceLength === 12, `E04 LSTM controls did not apply: ${JSON.stringify(gated)}`);
  assert(gated.lstmGateCount >= 3 && gated.cellHighwayVisible === true, `E04 LSTM should expose gate/highway objects: ${JSON.stringify(gated)}`);
  assert(gated.gateMechanismHash !== initial.gateMechanismHash, "E04 gate control must visibly reshape gates");

  await setRange(page, "#recurrentScale", "1.2");
  await setRange(page, "#clipNorm", "0.45");
  await setRange(page, "#truncationWindow", "4");
  await page.click("#backpropStep");
  const bptt = await snapshot(page, "__e04LabSnapshot");
  assert(bptt.mode === "bptt" && bptt.bpttSpan === 4, `E04 BPTT button/control should show truncated BPTT: ${JSON.stringify(bptt)}`);
  assert(bptt.bpttGradientHash !== gated.bpttGradientHash, "E04 BPTT/gain controls must reshape gradient trail");
  assert(bptt.clipRingHash !== gated.clipRingHash, "E04 clip norm must resize clip ring");
  assert(bptt.explodingRisk > 0, "E04 high recurrent gain should expose exploding-gradient risk");

  await page.click("#resetRnn");
  const reset = await snapshot(page, "__e04LabSnapshot");
  assert(reset.cellType === "vanilla" && reset.sequenceLength === 7 && reset.recurrentScale === 0.82, `E04 reset should restore defaults: ${JSON.stringify(reset)}`);
  assert(reset.gateStrength === 0.55 && reset.truncationWindow === 5 && reset.clipNorm === 1 && reset.distractorRate === 0.18, `E04 reset should restore all sliders: ${JSON.stringify(reset)}`);
}

async function verifyE05(page) {
  let s = await loadLab(page, "e05-attention-flow.html", "__e05LabReady", "__e05LabSnapshot");
  assert(s.clarityVersion === PAIR_QUALITY, `E05 missing clarity marker: ${s.clarityVersion}`);
  assert(s.legacyClarityVersion === LEGACY_QUALITY, `E05 should preserve old marker for compatibility: ${JSON.stringify(s)}`);
  assert(s.tokenRailCount === s.sequenceLength, `E05 token rails should match sequence length: ${JSON.stringify(s)}`);
  assert(s.queryVectorCount === s.sequenceLength && s.keyVectorCount === s.sequenceLength && s.valueVectorCount === s.sequenceLength, `E05 should expose Q/K/V for each visible token: ${JSON.stringify(s)}`);
  assert(s.scoreMatrixCellCount === s.sequenceLength * s.sequenceLength, `E05 score matrix should be T x T: ${JSON.stringify(s)}`);
  assert(s.probabilityBarCount === s.sequenceLength, `E05 softmax bars should match tokens: ${JSON.stringify(s)}`);
  assert(s.maskShutterCount >= s.sequenceLength, `E05 should expose mask shutter slots, got ${s.maskShutterCount}`);
  assert(s.headLaneCount === s.headCount, `E05 head lanes should match head slider: ${JSON.stringify(s)}`);
  assert(s.transformerBlockCount >= 4, `E05 should expose residual/LN/FFN/projection block objects, got ${s.transformerBlockCount}`);
  assert(s.qkvProjectionCellCount >= 9, `E05 should expose QKV projection matrix cells, got ${s.qkvProjectionCellCount}`);
  [
    "qkvRailHash",
    "scoreMatrixHash",
    "maskShutterHash",
    "softmaxBarHash",
    "multiHeadLaneHash",
    "positionEncodingHash",
    "valueMixingHash",
    "transformerBlockHash",
    "qkvProjectionHash"
  ].forEach((key) => requireHash(s[key], `E05 ${key}`));

  const initial = s;
  await page.locator("#maskType").selectOption("causal");
  await setRange(page, "#temperature", "0.4");
  await page.click("#applyMask");
  s = await snapshot(page, "__e05LabSnapshot");
  assert(s.maskType === "causal" && s.allowedKeyCount === 3 && s.maskedCount > 0, `E05 causal mask should block future keys for sat: ${JSON.stringify(s)}`);
  assert(s.maskShutterHash !== initial.maskShutterHash, "E05 mask control must visibly move shutters");
  assert(s.softmaxBarHash !== initial.softmaxBarHash, "E05 temperature/mask controls must reshape softmax bars");
  assert(s.maxWeight > initial.maxWeight, "E05 lower temperature should sharpen the attention distribution");

  await setRange(page, "#headCount", "7");
  await page.locator("#headType").selectOption("copy");
  const heads = await snapshot(page, "__e05LabSnapshot");
  assert(heads.headCount === 7 && heads.headLaneCount === 7, `E05 head count must create visible lanes: ${JSON.stringify(heads)}`);
  assert(heads.multiHeadLaneHash !== s.multiHeadLaneHash, "E05 head controls must reshape multi-head lanes");
  assert(heads.qkvProjectionHash !== initial.qkvProjectionHash, "E05 head/type controls must reshape projection cells");

  await setRange(page, "#positionBias", "-0.75");
  await setRange(page, "#valueMix", "1.25");
  await page.click("#mixValues");
  const mixed = await snapshot(page, "__e05LabSnapshot");
  assert(mixed.positionEncodingHash !== heads.positionEncodingHash, "E05 position bias must reshape position wave");
  assert(mixed.valueMixingHash !== heads.valueMixingHash, "E05 Mix values button/value slider must reshape output basin");
  assert(mixed.frame > heads.frame, "E05 Mix values button should advance the phenomenon frame");

  await page.click("#resetAttention");
  const reset = await snapshot(page, "__e05LabSnapshot");
  assert(reset.queryToken === "sat" && reset.maskType === "none" && reset.headType === "syntax", `E05 reset should restore selects: ${JSON.stringify(reset)}`);
  assert(reset.temperature === 1 && reset.headCount === 3 && reset.positionBias === 0.25 && reset.sequenceLength === 6 && reset.valueMix === 0.7, `E05 reset should restore sliders: ${JSON.stringify(reset)}`);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  try {
    await verifyE04(page);
    await verifyE05(page);
  } finally {
    await browser.close();
  }
  console.log("e04-e05 visual clarity passed: RNN/BPTT and attention/Transformer labs expose canonical, concrete, interactive teaching objects.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
