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

async function setNumber(page, selector, value) {
  await setRange(page, selector, value);
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

async function testD08(page) {
  await openLab(page, "d08-learning-theory-lab.html", "__d08LabReady", "__d08LabSnapshot");
  const initial = await snapshot(page, "__d08LabSnapshot");
  assert(initial.clarityVersion === "d08-d09-canonical-clarity-v2" && initial.legacyClarityVersion === "d08-d09-canonical-clarity-v1", `D08 lacks canonical learning-theory telemetry: ${JSON.stringify(initial)}`);
  assert(initial.sampleCloudCount >= 80 && initial.empiricalRiskBarHeight > 0 && initial.populationRiskBarHeight > 0, `D08 risk view should show sample cloud plus empirical/population risk bars: ${JSON.stringify(initial)}`);
  assert(initial.riskGapBridgeHash && initial.pacFunnelHash && initial.populationSurfaceHash, `D08 should expose risk-gap bridge, PAC funnel, and population surface hashes: ${JSON.stringify(initial)}`);

  await setRange(page, "#sampleSize", "45");
  const smallN = await snapshot(page, "__d08LabSnapshot");
  await setRange(page, "#sampleSize", "200");
  const largeN = await snapshot(page, "__d08LabSnapshot");
  assert(largeN.bound < smallN.bound && largeN.pacFunnelHash !== smallN.pacFunnelHash, `D08 larger sample size should shrink the PAC/Hoeffding funnel: ${JSON.stringify({ smallN, largeN })}`);
  assert(largeN.sampleCloudHash !== smallN.sampleCloudHash, `D08 sample-size control should visibly change active sample cloud geometry: ${JSON.stringify({ smallN, largeN })}`);

  await setSelect(page, "#viewMode", "vc");
  await setRange(page, "#capacity", "2");
  const lowCapacity = await snapshot(page, "__d08LabSnapshot");
  await setRange(page, "#capacity", "9");
  const highCapacity = await snapshot(page, "__d08LabSnapshot");
  assert(highCapacity.vcDimension > lowCapacity.vcDimension && highCapacity.vcSeparatorCount > lowCapacity.vcSeparatorCount, `D08 VC view should add separator capacity: ${JSON.stringify({ lowCapacity, highCapacity })}`);
  assert(highCapacity.shatteringPatternCount > lowCapacity.shatteringPatternCount && highCapacity.vcLabelingHash !== lowCapacity.vcLabelingHash, `D08 capacity should change shattering labelings/growth geometry: ${JSON.stringify({ lowCapacity, highCapacity })}`);

  await setSelect(page, "#viewMode", "rademacher");
  const random0 = await snapshot(page, "__d08LabSnapshot");
  await page.locator("#stepTheory").click();
  await page.waitForTimeout(120);
  const random1 = await snapshot(page, "__d08LabSnapshot");
  assert(random1.rademacherSignCount >= 36 && random1.randomSignHash !== random0.randomSignHash, `D08 step should redraw random signs for Rademacher complexity: ${JSON.stringify({ random0, random1 })}`);
  assert(random1.rademacherRibbonHash !== random0.rademacherRibbonHash, `D08 random signs should alter the alignment ribbon: ${JSON.stringify({ random0, random1 })}`);

  await setSelect(page, "#viewMode", "stability");
  await setRange(page, "#regularization", "0.05");
  const unstable = await snapshot(page, "__d08LabSnapshot");
  await setRange(page, "#regularization", "0.88");
  const stable = await snapshot(page, "__d08LabSnapshot");
  assert(stable.stabilityShift < unstable.stabilityShift && stable.stabilityBoundaryHash !== unstable.stabilityBoundaryHash, `D08 regularization should reduce leave-one-out boundary movement: ${JSON.stringify({ unstable, stable })}`);
  assert(stable.marginSlabHash !== unstable.marginSlabHash && stable.margin > unstable.margin, `D08 regularization should visibly widen the margin slab: ${JSON.stringify({ unstable, stable })}`);

  await setRange(page, "#confidence", "0.99");
  await page.locator("#resetTheory").click();
  await page.waitForTimeout(120);
  const reset = await snapshot(page, "__d08LabSnapshot");
  assert(reset.view === "risk" && reset.sampleSize === 80 && reset.capacity === 4 && reset.regularization === 0.35 && reset.labelNoise === 0.12 && reset.confidence === 0.95 && reset.frame === 0, `D08 reset should restore every visual control: ${JSON.stringify(reset)}`);
}

async function testD09(page) {
  await openLab(page, "d09-regularization-lab.html", "__d09LabReady", "__d09LabSnapshot");
  const initial = await snapshot(page, "__d09LabSnapshot");
  assert(initial.clarityVersion === "d08-d09-canonical-clarity-v2" && initial.legacyClarityVersion === "d08-d09-canonical-clarity-v1", `D09 lacks canonical regularization telemetry: ${JSON.stringify(initial)}`);
  assert(initial.samplePointCount >= 40 && initial.fitCurvePointCount >= 70 && initial.validationCurvePointCount >= 60, `D09 should show samples, fitted curve, and validation U-curve: ${JSON.stringify(initial)}`);
  assert(initial.coefficientBarCount >= 14 && initial.singularShrinkageBarCount >= 8 && initial.softThresholdGateCount >= 8, `D09 should expose coefficient bars, ridge singular shrinkage, and lasso soft-threshold gates: ${JSON.stringify(initial)}`);
  assert(initial.fitCurveHash && initial.coefficientSkylineHash && initial.validationCurveHash && initial.biasVarianceCurveHash, `D09 should expose curve/coefficient/validation geometry hashes: ${JSON.stringify(initial)}`);

  await setRange(page, "#lambda", "0.02");
  const weak = await snapshot(page, "__d09LabSnapshot");
  await setRange(page, "#lambda", "1.55");
  const strong = await snapshot(page, "__d09LabSnapshot");
  assert(strong.norm < weak.norm && strong.coefficientSkylineHash !== weak.coefficientSkylineHash, `D09 lambda should shrink coefficient norm and skyline: ${JSON.stringify({ weak, strong })}`);
  assert(strong.fitCurveHash !== weak.fitCurveHash && strong.ridgeBowlHash !== weak.ridgeBowlHash, `D09 lambda should reshape fit curve and L2 constraint bowl: ${JSON.stringify({ weak, strong })}`);

  await setSelect(page, "#regularizer", "lasso");
  await setRange(page, "#lambda", "1.20");
  const lasso = await snapshot(page, "__d09LabSnapshot");
  assert(lasso.zeroedCoefficientCount > 0 && lasso.lassoDiamondHash && lasso.softThresholdHash, `D09 lasso should show exact zeros, L1 diamond, and soft-threshold geometry: ${JSON.stringify(lasso)}`);

  await setSelect(page, "#regularizer", "elastic");
  await setRange(page, "#l1Mix", "0.15");
  const elasticLow = await snapshot(page, "__d09LabSnapshot");
  await setRange(page, "#l1Mix", "0.90");
  const elasticHigh = await snapshot(page, "__d09LabSnapshot");
  assert(elasticLow.elasticCorridorHash !== elasticHigh.elasticCorridorHash && elasticHigh.zeroedCoefficientCount >= elasticLow.zeroedCoefficientCount, `D09 elastic-net mix should trade ridge corridor width for lasso sparsity: ${JSON.stringify({ elasticLow, elasticHigh })}`);

  await setNumber(page, "#degree", "12");
  await setRange(page, "#noise", "0.34");
  const beforeBest = await snapshot(page, "__d09LabSnapshot");
  await page.locator("#best").click();
  await page.waitForTimeout(120);
  const afterBest = await snapshot(page, "__d09LabSnapshot");
  assert(Math.abs(afterBest.lambda - afterBest.validationMinimum) < 0.02 && afterBest.bestMarkerHash !== beforeBest.bestMarkerHash, `D09 Best should jump lambda to the validation minimum marker: ${JSON.stringify({ beforeBest, afterBest })}`);

  const beforeEpoch = await snapshot(page, "__d09LabSnapshot");
  await page.locator("#stepReg").click();
  await page.waitForTimeout(120);
  const afterEpoch = await snapshot(page, "__d09LabSnapshot");
  assert(afterEpoch.step === beforeEpoch.step + 1 && afterEpoch.earlyPathHash !== beforeEpoch.earlyPathHash, `D09 epoch step should advance early-stopping path: ${JSON.stringify({ beforeEpoch, afterEpoch })}`);

  await setRange(page, "#sampleSize", "140");
  await setRange(page, "#patience", "11");
  await page.locator("#resetReg").click();
  await page.waitForTimeout(120);
  const reset = await snapshot(page, "__d09LabSnapshot");
  assert(reset.regularizer === "ridge" && reset.scenario === "smooth" && reset.lambda === 0.42 && reset.degree === 9 && reset.noise === 0.18 && reset.sampleSize === 80 && reset.l1Mix === 0.5 && reset.patience === 6 && reset.step === 0, `D09 reset should restore every visual control: ${JSON.stringify(reset)}`);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1360, height: 820 } });
  try {
    await testD08(page);
    await testD09(page);
  } finally {
    await browser.close();
  }
  console.log("d08/d09 visual clarity passed: learning theory and regularization expose canonical, controllable geometry and telemetry.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
