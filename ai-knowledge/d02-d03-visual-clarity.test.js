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
}

async function setSelect(page, selector, value) {
  await page.locator(selector).selectOption(value);
  await page.waitForTimeout(80);
}

async function openLab(page, file, readyName, snapshotName) {
  const labPath = path.join(__dirname, file).replace(/\\/g, "/");
  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
  await page.waitForFunction(
    ([ready, snapshot]) => window[ready] === true && typeof window[snapshot] === "function",
    [readyName, snapshotName]
  );
  await page.waitForTimeout(180);
}

async function snapshot(page, snapshotName) {
  return page.evaluate((name) => window[name](), snapshotName);
}

async function testD02(page) {
  await openLab(page, "d02-svm-margin-kernel-lab.html", "__d02LabReady", "__d02LabSnapshot");
  const initial = await snapshot(page, "__d02LabSnapshot");
  assert(initial.clarityVersion === "d02-d03-canonical-clarity-v2" && initial.legacyClarityVersion === "d02-d03-canonical-clarity-v1", `D02 lacks canonical clarity telemetry: ${JSON.stringify(initial)}`);
  assert(initial.marginPlaneCount === 3, `D02 should expose f(x)=0 and f(x)=+/-1 as three margin planes: ${JSON.stringify(initial)}`);
  assert(initial.supportRingVisibleCount === initial.supportCount, `D02 support-vector rings should match support count: ${JSON.stringify(initial)}`);
  assert(initial.activeHingeRodCount >= 1, `D02 should expose active hinge/slack rods: ${JSON.stringify(initial)}`);
  assert(initial.alphaActiveCount >= 2 && initial.alphaMax <= initial.cPenalty + 1e-6, `D02 dual alpha bars should respect 0<=alpha_i<=C: ${JSON.stringify(initial)}`);
  assert(initial.kernelGramCellCount >= 16, `D02 should render a kernel Gram matrix, not only a surface: ${JSON.stringify(initial)}`);

  await setSelect(page, "#viewMode", "hinge");
  await setRange(page, "#svmOverlap", "0.05");
  const lowOverlap = await snapshot(page, "__d02LabSnapshot");
  await setRange(page, "#svmOverlap", "0.95");
  const highOverlap = await snapshot(page, "__d02LabSnapshot");
  assert(highOverlap.activeHingeRodCount >= lowOverlap.activeHingeRodCount, `Increasing overlap should not reduce visible hinge violations: ${JSON.stringify({ lowOverlap, highOverlap })}`);
  assert(highOverlap.hingeGeometryHash !== lowOverlap.hingeGeometryHash, `D02 overlap should change hinge geometry hash: ${JSON.stringify({ lowOverlap, highOverlap })}`);

  await setSelect(page, "#viewMode", "dual");
  const dualBefore = await snapshot(page, "__d02LabSnapshot");
  await page.locator("#stepSmo").click();
  await page.waitForTimeout(120);
  const dualAfter = await snapshot(page, "__d02LabSnapshot");
  assert(dualAfter.alphaMass !== dualBefore.alphaMass || dualAfter.alphaGeometryHash !== dualBefore.alphaGeometryHash, `D02 SMO step should visibly move alpha bars: ${JSON.stringify({ dualBefore, dualAfter })}`);

  await setSelect(page, "#kernel", "rbf");
  await setRange(page, "#gamma", "0.25");
  const lowGamma = await snapshot(page, "__d02LabSnapshot");
  await setRange(page, "#gamma", "2.20");
  const highGamma = await snapshot(page, "__d02LabSnapshot");
  assert(lowGamma.rbfBumpCount === 16, `D02 RBF view should show one bump per training point: ${JSON.stringify(lowGamma)}`);
  assert(highGamma.kernelContourPointCount >= 90, `D02 RBF contour should be sampled densely enough to read: ${JSON.stringify(highGamma)}`);
  assert(highGamma.kernelContourHash !== lowGamma.kernelContourHash, `Changing gamma should reshape the nonlinear decision contour: ${JSON.stringify({ lowGamma, highGamma })}`);

  await setRange(page, "#supportBias", "0.80");
  await setRange(page, "#softness", "0.70");
  await page.locator("#resetSvm").click();
  await page.waitForTimeout(120);
  const reset = await snapshot(page, "__d02LabSnapshot");
  assert(reset.supportBias === 0.42 && reset.softness === 0.3 && reset.overlap === 0.18, `D02 reset should restore every visual control: ${JSON.stringify(reset)}`);
}

async function testD03(page) {
  await openLab(page, "d03-tree-models-lab.html", "__d03LabReady", "__d03LabSnapshot");
  const initial = await snapshot(page, "__d03LabSnapshot");
  assert(initial.clarityVersion === "d02-d03-canonical-clarity-v2" && initial.legacyClarityVersion === "d02-d03-canonical-clarity-v1", `D03 lacks canonical clarity telemetry: ${JSON.stringify(initial)}`);
  assert(Array.isArray(initial.partitionCells) && initial.partitionCells.length === initial.leaves, `D03 tree mode should expose one recursive feature-space cell per leaf: ${JSON.stringify(initial)}`);
  assert(initial.partitionCells.every((cell) => Number.isFinite(cell.x0) && Number.isFinite(cell.x1) && Number.isFinite(cell.z0) && Number.isFinite(cell.z1)), `D03 partition cells need physical bounds: ${JSON.stringify(initial.partitionCells)}`);
  assert(Array.isArray(initial.splitWallsDetailed) && initial.splitWallsDetailed.some((wall) => wall.parentCellId !== "root"), `D03 split walls should include child-node recursive splits: ${JSON.stringify(initial.splitWallsDetailed)}`);
  assert(initial.splitWallsDetailed.every((wall) => wall.orientation === "x" || wall.orientation === "z"), `D03 CART walls must be axis-aligned: ${JSON.stringify(initial.splitWallsDetailed)}`);
  assert(initial.partitionCells.every((cell) => Array.isArray(cell.probabilities) ? Math.abs(cell.probabilities.reduce((sum, value) => sum + value, 0) - 1) < 1e-6 : Number.isFinite(cell.meanY)), `D03 leaves should visibly carry probabilities or regression means: ${JSON.stringify(initial.partitionCells)}`);

  await setSelect(page, "#viewMode", "impurity");
  const impurity = await snapshot(page, "__d03LabSnapshot");
  assert(Array.isArray(impurity.impurityCandidates) && impurity.impurityCandidates.length >= 6, `D03 impurity scan should expose real threshold candidates: ${JSON.stringify(impurity)}`);
  const selected = impurity.impurityCandidates.find((candidate) => candidate.selected);
  const bestGain = Math.max(...impurity.impurityCandidates.map((candidate) => candidate.gain));
  assert(selected && Math.abs(selected.gain - bestGain) < 1e-6, `D03 selected split should be the max-gain candidate: ${JSON.stringify(impurity.impurityCandidates)}`);
  assert(impurity.blockedCandidateCount >= 0, `D03 min-leaf blocks should be explicit in snapshot: ${JSON.stringify(impurity)}`);
  await setRange(page, "#minLeaf", "12");
  const highMinLeaf = await snapshot(page, "__d03LabSnapshot");
  assert(highMinLeaf.blockedCandidateCount > impurity.blockedCandidateCount, `Raising min leaf should visibly block threshold candidates: ${JSON.stringify({ impurity, highMinLeaf })}`);

  await setSelect(page, "#viewMode", "pruning");
  await setRange(page, "#minLeaf", "3");
  await setRange(page, "#pruneAlpha", "0.00");
  const noPrune = await snapshot(page, "__d03LabSnapshot");
  await setRange(page, "#pruneAlpha", "1.50");
  const pruned = await snapshot(page, "__d03LabSnapshot");
  assert(Array.isArray(pruned.pruningPath) && pruned.pruningPath.length >= 3, `D03 pruning should expose a cost-complexity path: ${JSON.stringify(pruned)}`);
  assert(pruned.leaves < noPrune.leaves && pruned.mergedCellCount >= 1, `Increasing alpha should collapse branches and merge cells: ${JSON.stringify({ noPrune, pruned })}`);

  await setSelect(page, "#viewMode", "forest");
  await setRange(page, "#bootstrap", "0.00");
  const stableForest = await snapshot(page, "__d03LabSnapshot");
  await setRange(page, "#bootstrap", "1.00");
  const bootForest = await snapshot(page, "__d03LabSnapshot");
  assert(Array.isArray(bootForest.forestVotes) && bootForest.forestVotes.some((vote) => vote.votesForClass0 > 0 && vote.votesForClass1 > 0), `D03 forest view should show non-unanimous vote regions: ${JSON.stringify(bootForest)}`);
  assert(bootForest.forestVoteHash !== stableForest.forestVoteHash, `Changing bootstrap should change forest votes/disagreement geometry: ${JSON.stringify({ stableForest, bootForest })}`);

  await setSelect(page, "#task", "regression");
  await setSelect(page, "#dataset", "regression");
  const regression = await snapshot(page, "__d03LabSnapshot");
  assert(regression.criterion === "squared" && regression.partitionCells.every((cell) => Number.isFinite(cell.meanY)), `D03 regression tree should switch leaves to mean target plateaus: ${JSON.stringify(regression)}`);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 700 } });
  try {
    await testD02(page);
    await testD03(page);
  } finally {
    await browser.close();
  }
  console.log("d02/d03 visual clarity passed: SVM and CART labs expose canonical, controllable visual objects and telemetry.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
