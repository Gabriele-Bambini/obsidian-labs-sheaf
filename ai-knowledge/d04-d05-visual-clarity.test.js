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

async function testD04(page) {
  await openLab(page, "d04-dimensionality-reduction-lab.html", "__d04LabReady", "__d04LabSnapshot");
  const initial = await snapshot(page, "__d04LabSnapshot");
  assert(initial.clarityVersion === "d04-d05-canonical-clarity-v2" && initial.legacyClarityVersion === "d04-d05-canonical-clarity-v1", `D04 lacks canonical dimensionality-reduction telemetry: ${JSON.stringify(initial)}`);
  assert(Array.isArray(initial.pcaEigenvalues) && initial.pcaEigenvalues.length >= 3, `D04 PCA should expose covariance eigenvalues/scree bars: ${JSON.stringify(initial)}`);
  assert(initial.pcaAxisCount === 3 && initial.componentLoadingCellCount >= 9, `D04 PCA should expose component axes and a loading matrix board: ${JSON.stringify(initial)}`);
  assert(initial.projectedPointCount >= 40 && initial.residualRodCount >= 40, `D04 should show projected points and reconstruction residual rods: ${JSON.stringify(initial)}`);
  assert(initial.reconstructionHash && initial.residualGeometryHash, `D04 should expose reconstruction/residual geometry hashes: ${JSON.stringify(initial)}`);

  await setSelect(page, "#viewMode", "residuals");
  await setRange(page, "#targetDim", "1");
  const rank1 = await snapshot(page, "__d04LabSnapshot");
  await setRange(page, "#targetDim", "3");
  const rank3 = await snapshot(page, "__d04LabSnapshot");
  assert(rank1.reconstructionRmse > rank3.reconstructionRmse, `D04 higher rank should reduce reconstruction RMSE: ${JSON.stringify({ rank1, rank3 })}`);
  assert(rank1.residualGeometryHash !== rank3.residualGeometryHash, `D04 target k should visibly change residual rods: ${JSON.stringify({ rank1, rank3 })}`);

  await setSelect(page, "#viewMode", "random");
  await setRange(page, "#randomSeed", "1");
  const seed1 = await snapshot(page, "__d04LabSnapshot");
  await setRange(page, "#randomSeed", "9");
  const seed9 = await snapshot(page, "__d04LabSnapshot");
  assert(seed1.randomProjectionMatrixCellCount >= 6, `D04 random projection should expose a projection matrix: ${JSON.stringify(seed1)}`);
  assert(Array.isArray(seed1.distancePairs) && seed1.distancePairs.length >= 6, `D04 random projection should compare original and projected distances: ${JSON.stringify(seed1)}`);
  assert(seed1.randomProjectionHash !== seed9.randomProjectionHash, `D04 randomSeed should reshape the random projection geometry: ${JSON.stringify({ seed1, seed9 })}`);

  await setSelect(page, "#dataset", "swiss");
  await setSelect(page, "#viewMode", "manifold");
  await setRange(page, "#neighborScale", "4");
  const local = await snapshot(page, "__d04LabSnapshot");
  await setRange(page, "#neighborScale", "22");
  const broad = await snapshot(page, "__d04LabSnapshot");
  assert(local.swissRollRibbonPointCount >= 20 && local.manifoldEdgeCount >= 40, `D04 manifold view should expose Swiss-roll ribbon and neighborhood graph: ${JSON.stringify(local)}`);
  assert(broad.manifoldGraphHash !== local.manifoldGraphHash, `D04 neighbor scale should rewire the manifold graph: ${JSON.stringify({ local, broad })}`);

  await setRange(page, "#drNoise", "0.80");
  await setRange(page, "#spread", "0.90");
  await page.locator("#resetReducer").click();
  await page.waitForTimeout(100);
  const reset = await snapshot(page, "__d04LabSnapshot");
  assert(reset.targetDim === 2 && reset.neighborScale === 10 && reset.noise === 0.12 && reset.randomSeed === 3 && reset.spread === 0.5, `D04 reset should restore every visual control: ${JSON.stringify(reset)}`);
}

async function testD05(page) {
  await openLab(page, "d05-clustering-algorithms-lab.html", "__d05LabReady", "__d05LabSnapshot");
  const initial = await snapshot(page, "__d05LabSnapshot");
  assert(initial.clarityVersion === "d04-d05-canonical-clarity-v2" && initial.legacyClarityVersion === "d04-d05-canonical-clarity-v1", `D05 lacks canonical clustering telemetry: ${JSON.stringify(initial)}`);
  assert(Array.isArray(initial.centroidPositions) && initial.centroidPositions.length === initial.k, `D05 K-means should expose active centroids: ${JSON.stringify(initial)}`);
  assert(Array.isArray(initial.pointAssignments) && initial.pointAssignments.length === 54, `D05 K-means should expose nearest-centroid assignments: ${JSON.stringify(initial)}`);
  assert(initial.assignmentLineCount === 54 && initial.voronoiCellCount === initial.k, `D05 K-means should show assignment tethers and Voronoi cells: ${JSON.stringify(initial)}`);
  assert(initial.kmeansObjectiveHash, `D05 K-means needs a geometry/objective hash: ${JSON.stringify(initial)}`);

  await page.locator("#stepAlgo").click();
  await page.waitForTimeout(120);
  const stepped = await snapshot(page, "__d05LabSnapshot");
  assert(stepped.inertia < initial.inertia && stepped.kmeansObjectiveHash !== initial.kmeansObjectiveHash, `D05 Lloyd step should lower inertia and move assignments/centroids: ${JSON.stringify({ initial, stepped })}`);

  await setSelect(page, "#dataset", "moons");
  await setSelect(page, "#viewMode", "dbscan");
  await setRange(page, "#epsilon", "0.20");
  const smallEps = await snapshot(page, "__d05LabSnapshot");
  await setRange(page, "#epsilon", "0.62");
  const largeEps = await snapshot(page, "__d05LabSnapshot");
  assert(smallEps.epsilonRingCount >= 18 && Array.isArray(smallEps.dbscanPointStates), `D05 DBSCAN should expose epsilon rings and core/border/noise point states: ${JSON.stringify(smallEps)}`);
  assert(largeEps.corePoints > smallEps.corePoints && largeEps.dbscanReachabilityHash !== smallEps.dbscanReachabilityHash, `D05 epsilon should visibly change DBSCAN reachability: ${JSON.stringify({ smallEps, largeEps })}`);

  await setSelect(page, "#viewMode", "gmm");
  const gmm = await snapshot(page, "__d05LabSnapshot");
  assert(gmm.gmmEllipseCount === gmm.k && Array.isArray(gmm.responsibilityRows) && gmm.responsibilityRows.length >= 8, `D05 GMM should expose ellipses and soft responsibilities: ${JSON.stringify(gmm)}`);
  assert(gmm.responsibilityRows.every((row) => Math.abs(row.responsibilities.reduce((sum, value) => sum + value, 0) - 1) < 1e-6), `D05 GMM responsibilities should sum to one: ${JSON.stringify(gmm.responsibilityRows)}`);

  await setSelect(page, "#viewMode", "spectral");
  await setRange(page, "#neighborCount", "4");
  const sparse = await snapshot(page, "__d05LabSnapshot");
  await setRange(page, "#neighborCount", "16");
  const dense = await snapshot(page, "__d05LabSnapshot");
  assert(sparse.affinityEdgeCount >= 40 && sparse.laplacianCutRibbonPointCount >= 40, `D05 spectral view should expose affinity graph and cut ribbon: ${JSON.stringify(sparse)}`);
  assert(dense.spectralGraphHash !== sparse.spectralGraphHash, `D05 neighbor count should rewire spectral affinity graph: ${JSON.stringify({ sparse, dense })}`);

  await setRange(page, "#clusterSpread", "0.90");
  await setRange(page, "#initSpread", "0.90");
  await page.locator("#resetClustering").click();
  await page.waitForTimeout(100);
  const reset = await snapshot(page, "__d05LabSnapshot");
  assert(reset.k === 3 && reset.epsilon === 0.38 && reset.neighborCount === 8 && reset.spread === 0.28 && reset.initSpread === 0.55, `D05 reset should restore every visual control: ${JSON.stringify(reset)}`);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 700 } });
  try {
    await testD04(page);
    await testD05(page);
  } finally {
    await browser.close();
  }
  console.log("d04/d05 visual clarity passed: dimensionality reduction and clustering expose canonical, controllable geometry and telemetry.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
