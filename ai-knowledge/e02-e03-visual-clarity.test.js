const path = require("path");

const PAIR_QUALITY = "e02-e03-canonical-clarity-v2";

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

async function snapshot(page, snapshotName) {
  return page.evaluate((name) => window[name](), snapshotName);
}

async function loadLab(page, fileName, readyName, snapshotName) {
  const labPath = path.join(__dirname, fileName).replace(/\\/g, "/");
  await page.goto(`file:///${labPath}?visual-clarity=e02-e03`);
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
      stateText: document.querySelector(".state-box").textContent.trim(),
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

async function verifyE02(page) {
  let s = await loadLab(page, "e02-backprop-computational-graph.html", "__e02LabReady", "__e02LabSnapshot");
  assert(s.clarityVersion === PAIR_QUALITY, `E02 missing clarity marker: ${s.clarityVersion}`);
  assert(s.legacyClarityVersion === "e02-e03-canonical-clarity-v1", `E02 should preserve legacy clarity marker: ${s.legacyClarityVersion}`);
  assert(s.valueNodeCount >= 6, `E02 should expose value/loss nodes, got ${s.valueNodeCount}`);
  assert(s.forwardEdgeCount >= 5, `E02 should expose forward dependency edges, got ${s.forwardEdgeCount}`);
  assert(s.reverseAdjointArrowCount >= 5, `E02 should expose reverse adjoint arrows, got ${s.reverseAdjointArrowCount}`);
  assert(s.gradientContributionCount >= 2, `E02 should expose y gradient contribution paths, got ${s.gradientContributionCount}`);
  assert(s.tapeCellCount >= 6, `E02 should expose tape cells, got ${s.tapeCellCount}`);
  assert(s.localJacobianTileCount >= 4, `E02 should expose local derivative tiles, got ${s.localJacobianTileCount}`);
  assert(s.denseBackpropPlateCount >= 4, `E02 should expose dense-layer backprop plates, got ${s.denseBackpropPlateCount}`);
  assert(s.checkpointBridgeCount >= 3, `E02 should expose checkpoint/recompute bridge cells, got ${s.checkpointBridgeCount}`);
  [
    "computationalGraphHash",
    "forwardValueHash",
    "reverseAdjointHash",
    "accumulationJunctionHash",
    "tapeMemoryHash",
    "checkpointTradeoffHash",
    "denseLayerBackpropHash",
    "gradientUpdateHash"
  ].forEach((key) => requireHash(s[key], `E02 ${key}`));

  const initial = s;
  await setRange(page, "#xValue", "-1.25");
  await setRange(page, "#yValue", "1.75");
  await setRange(page, "#upstream", "1.6");
  s = await snapshot(page, "__e02LabSnapshot");
  assert(s.forwardValueHash !== initial.forwardValueHash, "E02 x/y/upstream controls must reshape forward values");
  assert(s.reverseAdjointHash !== initial.reverseAdjointHash, "E02 x/y/upstream controls must reshape reverse adjoints");
  assert(Math.abs(s.gradY - (s.gradYFromM + s.gradYFromPlus)) < 1e-9, `E02 y gradient must be the sum of both paths: ${JSON.stringify(s)}`);

  await page.locator("#graphMode").selectOption("accumulate");
  const accumulate = await snapshot(page, "__e02LabSnapshot");
  assert(accumulate.graphMode === "accumulate", `E02 accumulate mode did not apply: ${accumulate.graphMode}`);
  assert(accumulate.accumulationJunctionHash !== initial.accumulationJunctionHash, "E02 accumulate mode must visibly change the y junction");

  await page.click("#backwardPass");
  const backward = await snapshot(page, "__e02LabSnapshot");
  assert(backward.graphMode === "reverse", `E02 Backward button should switch to reverse mode: ${backward.graphMode}`);
  assert(backward.activePrimitive !== initial.activePrimitive, "E02 Backward button must advance the reverse primitive");

  await setRange(page, "#tapeDepth", "10");
  await setRange(page, "#checkpointRate", "0.8");
  const tape = await snapshot(page, "__e02LabSnapshot");
  assert(tape.tapeMemoryHash !== initial.tapeMemoryHash, "E02 tape depth/checkpoint controls must reshape tape memory");
  assert(tape.checkpointTradeoffHash !== initial.checkpointTradeoffHash, "E02 checkpoint control must reshape recompute bridge");
  assert(tape.tapeMemory < 10 && tape.recomputeCost > initial.recomputeCost, `E02 checkpoint tradeoff is not visible in metrics: ${JSON.stringify(tape)}`);

  await setRange(page, "#learningRate2", "0.32");
  const lr = await snapshot(page, "__e02LabSnapshot");
  assert(lr.gradientUpdateHash !== tape.gradientUpdateHash, "E02 LR control must resize the update vector");
  assert(lr.updateMagnitude > tape.updateMagnitude, "E02 LR control must increase update magnitude");

  await page.click("#resetGraph");
  const reset = await snapshot(page, "__e02LabSnapshot");
  assert(reset.graphMode === "forward" && reset.x === 2 && reset.y === 3 && reset.upstream === 1, `E02 reset should restore forward inputs: ${JSON.stringify(reset)}`);
  assert(reset.tapeDepth === 6 && reset.checkpointRate === 0.2 && reset.learningRate === 0.1, `E02 reset should restore tape/LR controls: ${JSON.stringify(reset)}`);
}

async function verifyE03(page) {
  let s = await loadLab(page, "e03-convolution-kernel-lab.html", "__e03LabReady", "__e03LabSnapshot");
  assert(s.clarityVersion === PAIR_QUALITY, `E03 missing clarity marker: ${s.clarityVersion}`);
  assert(s.legacyClarityVersion === "e02-e03-canonical-clarity-v1", `E03 should preserve legacy clarity marker: ${s.legacyClarityVersion}`);
  assert(s.inputPixelCount === 64, `E03 should expose an 8x8 input image, got ${s.inputPixelCount}`);
  assert(s.kernelCellCount === s.kernelSize * s.kernelSize, `E03 kernel cells must match kernel size: ${JSON.stringify(s)}`);
  assert(s.featureMapCellCount === s.outputCells, `E03 feature-map cells must match output cells: ${JSON.stringify(s)}`);
  assert(s.channelSliceCount >= 3, `E03 should expose RGB/channel depth slices, got ${s.channelSliceCount}`);
  assert(s.filterBankCount >= 4, `E03 should expose multiple filter-bank plates, got ${s.filterBankCount}`);
  assert(s.toeplitzCellCount >= s.outputCells, `E03 should expose im2col/Toeplitz cells, got ${s.toeplitzCellCount}`);
  assert(s.gradientReuseArrowCount >= 8, `E03 should expose shared-kernel backprop reuse arrows, got ${s.gradientReuseArrowCount}`);
  assert(s.residualSkipCount >= 1, `E03 should expose at least one later CNN block/skip object, got ${s.residualSkipCount}`);
  [
    "inputImageHash",
    "kernelPatchHash",
    "slidingWindowHash",
    "featureMapHash",
    "poolingMapHash",
    "channelStackHash",
    "toeplitzMatrixHash",
    "backpropWeightSharingHash",
    "receptiveFieldTowerHash"
  ].forEach((key) => requireHash(s[key], `E03 ${key}`));

  const initial = s;
  await page.click("#scan");
  s = await snapshot(page, "__e03LabSnapshot");
  assert(s.activePatchIndex !== initial.activePatchIndex, "E03 Scan patch button must move the active receptive field");
  assert(s.slidingWindowHash !== initial.slidingWindowHash, "E03 Scan patch button must move visible kernel/window geometry");

  await page.locator("#inputPattern").selectOption("corner");
  await setRange(page, "#kernelSize", "5");
  await setRange(page, "#stride", "2");
  await setRange(page, "#padding", "2");
  const reshaped = await snapshot(page, "__e03LabSnapshot");
  assert(reshaped.outputSize === 4 && reshaped.kernelSize === 5 && reshaped.stride === 2 && reshaped.padding === 2, `E03 convolution controls did not reshape output: ${JSON.stringify(reshaped)}`);
  assert(reshaped.featureMapHash !== initial.featureMapHash, "E03 kernel/stride/padding controls must reshape feature-map geometry");
  assert(reshaped.kernelPatchHash !== initial.kernelPatchHash, "E03 kernel size control must reshape kernel plate");

  await page.locator("#pooling").selectOption("max");
  const pooled = await snapshot(page, "__e03LabSnapshot");
  assert(pooled.poolingMode === "max" && pooled.pooledOutputSize === 2, `E03 pooling control did not create pooled 2x2 output: ${JSON.stringify(pooled)}`);
  assert(pooled.poolingMapHash !== reshaped.poolingMapHash, "E03 pooling mode must visibly change pooling basins");

  await setRange(page, "#layers", "5");
  await setRange(page, "#dilation", "3");
  const receptive = await snapshot(page, "__e03LabSnapshot");
  assert(receptive.receptiveField > pooled.receptiveField, "E03 layers/dilation should increase the receptive field");
  assert(receptive.receptiveFieldTowerHash !== pooled.receptiveFieldTowerHash, "E03 layers/dilation must reshape the receptive-field tower");

  await page.click("#resetCnn");
  const reset = await snapshot(page, "__e03LabSnapshot");
  assert(reset.inputPattern === "edge" && reset.poolingMode === "none" && reset.kernelSize === 3 && reset.stride === 1 && reset.padding === 1, `E03 reset should restore convolution defaults: ${JSON.stringify(reset)}`);
  assert(reset.layers === 2 && reset.dilation === 1 && reset.contrast === 1, `E03 reset should restore depth controls: ${JSON.stringify(reset)}`);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  try {
    await verifyE02(page);
    await verifyE03(page);
  } finally {
    await browser.close();
  }
  console.log("e02-e03 visual clarity passed: backprop and CNN labs expose canonical, concrete, interactive teaching objects.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
