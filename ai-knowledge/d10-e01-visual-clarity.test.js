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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function setRange(page, selector, value) {
  await page.locator(selector).evaluate((input, nextValue) => {
    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
  await page.waitForTimeout(90);
}

async function setSelect(page, selector, value) {
  await page.locator(selector).selectOption(value);
  await page.waitForTimeout(100);
}

async function openLab(page, file, readyName, snapshotName) {
  const labPath = path.join(__dirname, file).replace(/\\/g, "/");
  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
  await page.waitForFunction(
    ([ready, snapshot]) => window[ready] === true && typeof window[snapshot] === "function",
    [readyName, snapshotName]
  );
  await page.waitForTimeout(240);
}

async function snapshot(page, name) {
  return page.evaluate((snapshotName) => window[snapshotName](), name);
}

async function testD10(page) {
  await openLab(page, "d10-model-selection-evaluation-lab.html", "__d10LabReady", "__d10LabSnapshot");
  const initial = await snapshot(page, "__d10LabSnapshot");
  assert(initial.clarityVersion === "d10-e01-canonical-clarity-v2" && initial.legacyClarityVersion === "d10-e01-canonical-clarity-v1", `D10 lacks canonical model-selection telemetry: ${JSON.stringify(initial)}`);
  assert(initial.splitRegionCount === 3 && initial.splitExampleCount >= 45 && initial.candidateBeadCount >= 6, `D10 should expose train/validation/test regions, examples, and candidate search beads: ${JSON.stringify(initial)}`);
  assert(initial.selectionSurfaceHash && initial.splitFirewallHash && initial.validationTestGapHash && initial.candidateCloudHash, `D10 should hash split, candidate, and optimism geometry: ${JSON.stringify(initial)}`);

  await setRange(page, "#searchBreadth", "4");
  const narrow = await snapshot(page, "__d10LabSnapshot");
  await setRange(page, "#searchBreadth", "22");
  const broad = await snapshot(page, "__d10LabSnapshot");
  assert(broad.optimism > narrow.optimism && broad.candidateBeadCount > narrow.candidateBeadCount, `D10 broad hyperparameter search should add candidates and increase optimism: ${JSON.stringify({ narrow, broad })}`);
  assert(broad.selectionSurfaceHash !== narrow.selectionSurfaceHash && broad.candidateCloudHash !== narrow.candidateCloudHash && broad.validationTestGapHash !== narrow.validationTestGapHash, `D10 search breadth should visibly reshape selection/score-gap geometry: ${JSON.stringify({ narrow, broad })}`);

  await setSelect(page, "#mode", "crossValidation");
  await setRange(page, "#folds", "3");
  const fewFolds = await snapshot(page, "__d10LabSnapshot");
  await setRange(page, "#folds", "9");
  const manyFolds = await snapshot(page, "__d10LabSnapshot");
  assert(manyFolds.activeFoldCount > fewFolds.activeFoldCount && manyFolds.foldVariance < fewFolds.foldVariance, `D10 folds should rotate more validation folds and reduce split variance: ${JSON.stringify({ fewFolds, manyFolds })}`);
  assert(manyFolds.foldCarouselHash !== fewFolds.foldCarouselHash && manyFolds.foldVarianceSpokeHash !== fewFolds.foldVarianceSpokeHash, `D10 CV geometry should change when folds change: ${JSON.stringify({ fewFolds, manyFolds })}`);

  await setSelect(page, "#mode", "nested");
  const nested = await snapshot(page, "__d10LabSnapshot");
  assert(nested.nestedBias < nested.optimism && nested.nestedOuterLoopHash && nested.nestedInnerLoopHash, `D10 nested CV should expose separate inner/outer loops and reduced bias: ${JSON.stringify(nested)}`);

  await setSelect(page, "#mode", "threshold");
  await setRange(page, "#threshold", "0.24");
  await setRange(page, "#costRatio", "1.5");
  const lowThreshold = await snapshot(page, "__d10LabSnapshot");
  await setRange(page, "#threshold", "0.78");
  await setRange(page, "#costRatio", "7.0");
  const highThreshold = await snapshot(page, "__d10LabSnapshot");
  assert(highThreshold.precision > lowThreshold.precision && highThreshold.recall < lowThreshold.recall && highThreshold.expectedCost !== lowThreshold.expectedCost, `D10 threshold should trade precision/recall and cost: ${JSON.stringify({ lowThreshold, highThreshold })}`);
  assert(highThreshold.thresholdMarkerHash !== lowThreshold.thresholdMarkerHash && highThreshold.confusionMatrixHash !== lowThreshold.confusionMatrixHash && highThreshold.calibrationCurveHash !== lowThreshold.calibrationCurveHash, `D10 threshold controls should move operating/calibration geometry: ${JSON.stringify({ lowThreshold, highThreshold })}`);

  await setSelect(page, "#mode", "leakage");
  await setRange(page, "#leakage", "0.00");
  const clean = await snapshot(page, "__d10LabSnapshot");
  await setRange(page, "#leakage", "0.88");
  const leaky = await snapshot(page, "__d10LabSnapshot");
  assert(leaky.leakInflation > clean.leakInflation && leaky.leakageBridgeHash !== clean.leakageBridgeHash && leaky.leakGateHash !== clean.leakGateHash, `D10 leakage should draw stronger forbidden evidence across split firewalls: ${JSON.stringify({ clean, leaky })}`);
  assert(leaky.honestWallHash !== clean.honestWallHash, `D10 leakage should visibly weaken the honest test firewall: ${JSON.stringify({ clean, leaky })}`);

  await page.locator("#resetProtocol").click();
  await page.waitForTimeout(120);
  const reset = await snapshot(page, "__d10LabSnapshot");
  assert(reset.mode === "holdout" && reset.searchBreadth === 6 && reset.folds === 5 && reset.threshold === 0.5 && reset.costRatio === 2 && reset.leakage === 0.1 && reset.classImbalance === 0.25 && reset.step === 0, `D10 reset should restore every protocol control: ${JSON.stringify(reset)}`);
}

async function testE01(page) {
  await openLab(page, "e01-mlp-decision-regions.html", "__e01LabReady", "__e01LabSnapshot");
  const initial = await snapshot(page, "__e01LabSnapshot");
  assert(initial.clarityVersion === "d10-e01-canonical-clarity-v2" && initial.legacyClarityVersion === "d10-e01-canonical-clarity-v1", `E01 lacks canonical MLP telemetry: ${JSON.stringify(initial)}`);
  assert(initial.activeLayerCount >= 2 && initial.visibleNeuronCount >= 7 && initial.weightMatrixCellCount >= 24 && initial.activationBarCount >= 10, `E01 should expose actual MLP layers, neurons, weights, and activations: ${JSON.stringify(initial)}`);
  assert(initial.decisionSurfaceHash && initial.architectureGraphHash && initial.tensorShapeHash && initial.activationVectorHash && initial.lossLandscapeHash && initial.gradientUpdateHash, `E01 should hash decision, architecture, tensor, activation, loss, and update geometry: ${JSON.stringify(initial)}`);

  await setSelect(page, "#modelMode", "single");
  const single = await snapshot(page, "__e01LabSnapshot");
  await setSelect(page, "#modelMode", "xor");
  await setRange(page, "#hiddenWidth", "6");
  const xor = await snapshot(page, "__e01LabSnapshot");
  assert(xor.hiddenGateCount > single.hiddenGateCount && xor.decisionRegions > single.decisionRegions, `E01 XOR should require multiple hidden half-space gates, unlike one neuron: ${JSON.stringify({ single, xor })}`);
  assert(xor.hiddenGateHash !== single.hiddenGateHash && xor.decisionSurfaceHash !== single.decisionSurfaceHash, `E01 XOR should visibly change gates and decision surface: ${JSON.stringify({ single, xor })}`);

  await setSelect(page, "#activation", "linear");
  const linear = await snapshot(page, "__e01LabSnapshot");
  await setSelect(page, "#activation", "relu");
  const relu = await snapshot(page, "__e01LabSnapshot");
  assert(linear.decisionRegions === 1 && relu.decisionRegions > linear.decisionRegions && relu.activationFoldHash !== linear.activationFoldHash, `E01 nonlinearity should prevent affine collapse and create folded regions: ${JSON.stringify({ linear, relu })}`);

  await setRange(page, "#hiddenWidth", "2");
  const thin = await snapshot(page, "__e01LabSnapshot");
  await setRange(page, "#hiddenWidth", "9");
  const wide = await snapshot(page, "__e01LabSnapshot");
  assert(wide.parameterCount > thin.parameterCount && wide.weightMatrixHash !== thin.weightMatrixHash && wide.universalApproxFanHash !== thin.universalApproxFanHash, `E01 width should add parameters, learned features, and approximation fan geometry: ${JSON.stringify({ thin, wide })}`);

  await setRange(page, "#depth", "1");
  const shallow = await snapshot(page, "__e01LabSnapshot");
  await setRange(page, "#depth", "5");
  const deep = await snapshot(page, "__e01LabSnapshot");
  assert(deep.activeLayerCount > shallow.activeLayerCount && deep.architectureGraphHash !== shallow.architectureGraphHash && deep.layerSignalHash !== shallow.layerSignalHash, `E01 depth should add composed layer geometry and signal columns: ${JSON.stringify({ shallow, deep })}`);

  const beforeTrain = await snapshot(page, "__e01LabSnapshot");
  await page.locator("#trainStep").click();
  await page.waitForTimeout(120);
  const afterTrain = await snapshot(page, "__e01LabSnapshot");
  assert(afterTrain.step === beforeTrain.step + 1 && afterTrain.trainAccuracy > beforeTrain.trainAccuracy && afterTrain.loss < beforeTrain.loss, `E01 training step should improve accuracy and reduce loss: ${JSON.stringify({ beforeTrain, afterTrain })}`);
  assert(afterTrain.lossBeadHash !== beforeTrain.lossBeadHash && afterTrain.gradientUpdateHash !== beforeTrain.gradientUpdateHash, `E01 training should move loss bead and gradient/update vectors: ${JSON.stringify({ beforeTrain, afterTrain })}`);

  await setRange(page, "#signalGain", "1.88");
  await setRange(page, "#dataNoise", "0.41");
  await setRange(page, "#learningRate", "0.28");
  await page.locator("#resetNetwork").click();
  await page.waitForTimeout(120);
  const reset = await snapshot(page, "__e01LabSnapshot");
  assert(reset.modelMode === "single" && reset.activation === "relu" && reset.hiddenWidth === 4 && reset.depth === 2 && reset.signalGain === 1 && reset.dataNoise === 0.12 && reset.learningRate === 0.12 && reset.step === 0, `E01 reset should restore every MLP control: ${JSON.stringify(reset)}`);
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
  console.log("d10/e01 visual clarity passed: evaluation protocol and MLP foundations expose canonical, controllable geometry and telemetry.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
