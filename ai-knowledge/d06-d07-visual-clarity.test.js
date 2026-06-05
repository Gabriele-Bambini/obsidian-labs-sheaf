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
  await page.waitForTimeout(80);
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
  await page.waitForTimeout(220);
}

async function snapshot(page, snapshotName) {
  return page.evaluate((name) => window[name](), snapshotName);
}

async function testD06(page) {
  await openLab(page, "d06-ensemble-methods-lab.html", "__d06LabReady", "__d06LabSnapshot");
  const initial = await snapshot(page, "__d06LabSnapshot");
  assert(initial.clarityVersion === "d06-d07-canonical-clarity-v2" && initial.legacyClarityVersion === "d06-d07-canonical-clarity-v1", `D06 lacks canonical ensemble telemetry: ${JSON.stringify(initial)}`);
  assert(initial.bootstrapSampleCount >= initial.modelCount && initial.bootstrapMatrixCellCount >= 48, `D06 bagging should show bootstrap row samples: ${JSON.stringify(initial)}`);
  assert(initial.bootstrapDuplicateRowCount > 0 && initial.inBagUniqueRate > 0.55 && initial.inBagUniqueRate < 0.70, `D06 bootstrap samples should show replacement duplicates and the 63.2% unique-row intuition: ${JSON.stringify(initial)}`);
  assert(initial.oobRowCount > 0 && initial.oobRibbonPointCount >= 36, `D06 bagging should expose out-of-bag validation rows/ribbon: ${JSON.stringify(initial)}`);
  assert(Array.isArray(initial.oobRowMarkersByTree) && initial.oobRowMarkersByTree.every((count) => count > 0), `D06 should mark OOB rows per bootstrap learner: ${JSON.stringify(initial)}`);
  assert(initial.predictionFanLineCount >= initial.modelCount && initial.averageSurfaceHash, `D06 bagging should expose base learners and averaged prediction surface: ${JSON.stringify(initial)}`);
  assert(initial.varianceFormulaVisible === true && initial.predictionVariance > 0 && initial.averageSurfaceRoughness > 0, `D06 should expose the variance/correlation formula as measurable geometry: ${JSON.stringify(initial)}`);

  await setRange(page, "#modelCount", "6");
  const smallBag = await snapshot(page, "__d06LabSnapshot");
  await setRange(page, "#modelCount", "20");
  const largeBag = await snapshot(page, "__d06LabSnapshot");
  assert(largeBag.varianceReduction > smallBag.varianceReduction, `D06 more bootstrap learners should visibly reduce variance: ${JSON.stringify({ smallBag, largeBag })}`);
  assert(largeBag.predictionVariance < smallBag.predictionVariance && largeBag.averageSurfaceRoughness < smallBag.averageSurfaceRoughness, `D06 averaging more learners should smooth prediction variance/roughness: ${JSON.stringify({ smallBag, largeBag })}`);
  assert(largeBag.predictionFanHash !== smallBag.predictionFanHash && largeBag.bootstrapSampleHash !== smallBag.bootstrapSampleHash, `D06 model count should change the bootstrap fan/sample geometry: ${JSON.stringify({ smallBag, largeBag })}`);

  await setSelect(page, "#mode", "forest");
  await setRange(page, "#featureSubsample", "0.30");
  const sparseForest = await snapshot(page, "__d06LabSnapshot");
  await setRange(page, "#featureSubsample", "0.90");
  const denseForest = await snapshot(page, "__d06LabSnapshot");
  assert(sparseForest.activeFeatureGateCount < denseForest.activeFeatureGateCount, `D06 feature subsampling should open/close feature gates: ${JSON.stringify({ sparseForest, denseForest })}`);
  assert(sparseForest.correlation < denseForest.correlation && sparseForest.featureMaskHash !== denseForest.featureMaskHash && sparseForest.perSplitFeatureMaskHash !== denseForest.perSplitFeatureMaskHash && sparseForest.boundaryDiversityHash !== denseForest.boundaryDiversityHash, `D06 lower max_features should decorrelate tree errors visibly: ${JSON.stringify({ sparseForest, denseForest })}`);

  await setSelect(page, "#mode", "boosting");
  await setRange(page, "#learningRate", "0.16");
  const boost0 = await snapshot(page, "__d06LabSnapshot");
  await page.locator("#stepEnsemble").click();
  await page.waitForTimeout(120);
  const boost1 = await snapshot(page, "__d06LabSnapshot");
  assert(boost1.trainingLoss < boost0.trainingLoss && boost1.residualStageHash !== boost0.residualStageHash, `D06 boosting stage should lower loss and change residual-correction geometry: ${JSON.stringify({ boost0, boost1 })}`);
  assert(boost1.residualVectorHash !== boost0.residualVectorHash && boost1.additivePredictionHash !== boost0.additivePredictionHash, `D06 boosting should expose residual-vector and additive-prediction updates: ${JSON.stringify({ boost0, boost1 })}`);
  assert(boost1.residualBarCount >= 8 && boost1.lossCurvePointCount >= 48, `D06 boosting should expose residual bars and loss curve: ${JSON.stringify(boost1)}`);

  await setSelect(page, "#mode", "stacking");
  await setRange(page, "#diversity", "0.20");
  const stackLow = await snapshot(page, "__d06LabSnapshot");
  await setRange(page, "#diversity", "0.86");
  const stackHigh = await snapshot(page, "__d06LabSnapshot");
  assert(stackHigh.metaWeightHash !== stackLow.metaWeightHash && stackHigh.oofPredictionColumnCount >= 8, `D06 stacking should expose out-of-fold meta-model columns and weights: ${JSON.stringify({ stackLow, stackHigh })}`);
  assert(stackHigh.oofFoldCount >= 3 && stackHigh.oofPredictionMatrixCellCount >= stackHigh.oofFoldCount * stackHigh.oofPredictionColumnCount, `D06 stacking should expose K-fold OOF prediction matrix dimensions: ${JSON.stringify(stackHigh)}`);
  assert(stackHigh.leakageBarrierOpacity < stackLow.leakageBarrierOpacity, `D06 diversity/validation discipline should visibly reduce leakage risk: ${JSON.stringify({ stackLow, stackHigh })}`);

  await setRange(page, "#learningRate", "0.31");
  await setRange(page, "#baseDepth", "6");
  await page.locator("#resetEnsemble").click();
  await page.waitForTimeout(120);
  const reset = await snapshot(page, "__d06LabSnapshot");
  assert(reset.mode === "bagging" && reset.modelCount === 8 && reset.featureSubsample === 0.68 && reset.learningRate === 0.12 && reset.diversity === 0.46 && reset.baseDepth === 3 && reset.stage === 0, `D06 reset should restore every visual control: ${JSON.stringify(reset)}`);
}

async function testD07(page) {
  await openLab(page, "d07-metric-learning-lab.html", "__d07LabReady", "__d07LabSnapshot");
  const initial = await snapshot(page, "__d07LabSnapshot");
  assert(initial.clarityVersion === "d06-d07-canonical-clarity-v2" && initial.legacyClarityVersion === "d06-d07-canonical-clarity-v1", `D07 lacks canonical metric-learning telemetry: ${JSON.stringify(initial)}`);
  assert(initial.embeddingPointCount >= 30 && initial.tripletCableCount >= 3 && initial.retrievalRankTileCount >= 9, `D07 should expose embedding points, triplet cables, and retrieval ranking strip: ${JSON.stringify(initial)}`);
  assert(initial.metricMatrixCellCount >= 4 && initial.distanceMatrixCellCount >= 9, `D07 should expose metric tensor and distance/ranking matrix: ${JSON.stringify(initial)}`);
  assert(initial.embeddingGeometryHash && initial.tripletGeometryHash && initial.retrievalHash, `D07 should expose geometry hashes for embedding/triplet/retrieval: ${JSON.stringify(initial)}`);

  await setSelect(page, "#metricType", "mahalanobis");
  await setRange(page, "#metricStretch", "0.78");
  const lowStretch = await snapshot(page, "__d07LabSnapshot");
  await setRange(page, "#metricStretch", "2.20");
  const highStretch = await snapshot(page, "__d07LabSnapshot");
  assert(lowStretch.metricTensorHash !== highStretch.metricTensorHash && lowStretch.metricEllipseHash !== highStretch.metricEllipseHash, `D07 Mahalanobis stretch should reshape the metric tensor and ellipse: ${JSON.stringify({ lowStretch, highStretch })}`);

  await setSelect(page, "#miningMode", "hard");
  const mined0 = await snapshot(page, "__d07LabSnapshot");
  await page.locator("#mineTriplet").click();
  await page.waitForTimeout(120);
  const mined1 = await snapshot(page, "__d07LabSnapshot");
  assert(mined0.activeNegative !== mined1.activeNegative && mined0.tripletGeometryHash !== mined1.tripletGeometryHash, `D07 mining should choose a different negative and redraw triplet geometry: ${JSON.stringify({ mined0, mined1 })}`);
  const beforeTrain = await snapshot(page, "__d07LabSnapshot");
  await page.locator("#trainStep").click();
  await page.waitForTimeout(120);
  const afterTrain = await snapshot(page, "__d07LabSnapshot");
  assert(afterTrain.loss <= beforeTrain.loss && afterTrain.embeddingGeometryHash !== beforeTrain.embeddingGeometryHash, `D07 train step should improve loss and reshape embedding neighborhoods: ${JSON.stringify({ beforeTrain, afterTrain })}`);

  await setSelect(page, "#lossType", "contrastive");
  await setRange(page, "#margin", "0.30");
  const marginSmall = await snapshot(page, "__d07LabSnapshot");
  await setRange(page, "#margin", "0.95");
  const marginLarge = await snapshot(page, "__d07LabSnapshot");
  assert(marginSmall.contrastiveHingeHash !== marginLarge.contrastiveHingeHash && marginLarge.marginShellRadius > marginSmall.marginShellRadius, `D07 contrastive margin should resize the hinge shell and margin telemetry: ${JSON.stringify({ marginSmall, marginLarge })}`);

  await setSelect(page, "#lossType", "proxy");
  const proxy0 = await snapshot(page, "__d07LabSnapshot");
  await page.locator("#runFive").click();
  await page.waitForTimeout(120);
  const proxy5 = await snapshot(page, "__d07LabSnapshot");
  assert(proxy5.proxyCount === 3 && proxy5.angularMarginArcCount >= 3 && proxy5.unitSphereVisible === true, `D07 proxy mode should expose class proxies on the unit sphere: ${JSON.stringify(proxy5)}`);
  assert(proxy5.knnAccuracy >= proxy0.knnAccuracy && proxy5.proxyGeometryHash !== proxy0.proxyGeometryHash, `D07 proxy training should improve retrieval and move angular proxy geometry: ${JSON.stringify({ proxy0, proxy5 })}`);

  await setRange(page, "#metricStretch", "2.30");
  await setRange(page, "#miningPressure", "0.96");
  await page.locator("#resetMetric").click();
  await page.waitForTimeout(120);
  const reset = await snapshot(page, "__d07LabSnapshot");
  assert(reset.lossType === "triplet" && reset.metricType === "euclidean" && reset.miningMode === "semi" && reset.margin === 0.55 && reset.classSeparation === 1.05 && reset.embeddingSpread === 0.72 && reset.metricStretch === 1.55 && reset.miningPressure === 0.62 && reset.step === 0, `D07 reset should restore every visual control: ${JSON.stringify(reset)}`);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1360, height: 820 } });
  try {
    await testD06(page);
    await testD07(page);
  } finally {
    await browser.close();
  }
  console.log("d06/d07 visual clarity passed: ensemble methods and metric learning expose canonical, controllable geometry and telemetry.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
