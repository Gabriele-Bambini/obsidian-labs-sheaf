const path = require("path");

function loadPlaywright() {
  const candidates = [
    "playwright",
    "C:/Users/02gab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright",
    "C:/Users/02gab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
    "C:/Users/Gabriele/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright",
    "C:/Users/Gabriele/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"
  ];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (error) {
      // Try the next known runtime location.
    }
  }
  throw new Error(`Unable to load Playwright from: ${candidates.join(", ")}`);
}

const { chromium } = loadPlaywright();
const CLARITY_VERSION = "d04-d05-canonical-clarity-v2";
const LEGACY_VERSION = "d04-d05-canonical-clarity-v1";

async function loadLab(page, fileName, readyName, snapshotName) {
  const labPath = path.join(__dirname, fileName).replace(/\\/g, "/");
  await page.goto(`file:///${labPath}?canonical-clarity=1`);
  await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
  await page.waitForFunction(
    ([ready, snapshot]) => window[ready] === true && typeof window[snapshot] === "function" && window[snapshot](),
    [readyName, snapshotName]
  );
  await page.waitForTimeout(260);
  return page.evaluate((snapshotName) => {
    const canvas = document.querySelector(".lab-viewport canvas");
    return {
      bytes: canvas.toDataURL("image/png").length,
      snapshot: window[snapshotName](),
      commandBarHeight: document.querySelector(".command-bar")?.getBoundingClientRect().height || 0,
      overflowX: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
      overflowY: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight
    };
  }, snapshotName);
}

async function setRange(page, selector, value) {
  await page.locator(selector).evaluate((input, nextValue) => {
    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

function requireIncludes(list, expected, lab) {
  for (const item of expected) {
    if (!Array.isArray(list) || !list.includes(item)) {
      throw new Error(`${lab} missing "${item}". Found: ${(list || []).join(" | ")}`);
    }
  }
}

function requireFiniteNumbers(object, keys, lab) {
  for (const key of keys) {
    if (!Number.isFinite(object[key])) {
      throw new Error(`${lab} missing finite telemetry "${key}": ${JSON.stringify(object)}.`);
    }
  }
}

function requireVersion(snapshot, lab) {
  if (snapshot.clarityVersion !== CLARITY_VERSION || snapshot.legacyClarityVersion !== LEGACY_VERSION) {
    throw new Error(`${lab} should expose v2 clarity with v1 compatibility: ${JSON.stringify(snapshot)}.`);
  }
  if (snapshot.has3d !== true || !snapshot.labId) {
    throw new Error(`${lab} should identify the 3D lab shell: ${JSON.stringify(snapshot)}.`);
  }
}

function requireStateText(snapshot, regex, lab) {
  if (!regex.test(snapshot.stateText || "")) {
    throw new Error(`${lab} state text did not explain the visible phenomenon: ${snapshot.stateText}`);
  }
}

function requireRenderFit(result, lab) {
  if (result.bytes < 15000 || result.overflowX > 18 || result.overflowY > 18 || result.commandBarHeight > 170) {
    throw new Error(`${lab} render should be fitted and readable: ${JSON.stringify(result)}.`);
  }
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1180, height: 700 } });

  try {
    const d04 = await loadLab(page, "d04-dimensionality-reduction-lab.html", "__d04LabReady", "__d04LabSnapshot");
    requireRenderFit(d04, "D04");
    requireVersion(d04.snapshot, "D04");
    if (
      d04.snapshot.pcaSubspaceObjectCount < 6 ||
      d04.snapshot.reconstructionObjectCount < 5 ||
      d04.snapshot.randomProjectionObjectCount < 5 ||
      d04.snapshot.manifoldEmbeddingObjectCount < 5 ||
      d04.snapshot.dimensionalReductionDiagnosticObjectCount < 5
    ) {
      throw new Error(`D04 lacks a full canonical dimensionality-reduction inventory: ${JSON.stringify(d04.snapshot)}.`);
    }
    requireIncludes(d04.snapshot.dimensionalReductionObjects, [
      "centered_data_cloud_x_rows",
      "covariance_ellipsoid_and_principal_axes",
      "pca_component_axes_u1_u2_u3",
      "eigenvalue_scree_bars_lambda_j",
      "component_loading_matrix_v_cells",
      "projection_plane_z_equals_x_wk",
      "projected_point_cloud_z",
      "rank_k_reconstruction_points_x_hat",
      "reconstruction_residual_rods_x_minus_xhat",
      "explained_variance_retained_meter",
      "truncated_svd_low_rank_factor_boards",
      "random_projection_matrix_r_cells",
      "johnson_lindenstrauss_distance_pair_gauges",
      "random_projection_shadow_points",
      "swiss_roll_manifold_ribbon",
      "neighborhood_graph_edges_k_neighbors",
      "geodesic_shortcut_warning_edges",
      "manifold_embedding_unfolded_sheet",
      "trustworthiness_distance_distortion_meters",
      "pipeline_leakage_train_test_split_gate"
    ], "D04 objects");
    requireIncludes(d04.snapshot.canonicalReferences, [
      "PCA covariance eigenvectors",
      "Eckart Young low rank approximation",
      "Johnson Lindenstrauss random projection",
      "Swiss roll manifold neighborhood graph",
      "t-SNE UMAP local neighborhood caveat"
    ], "D04 references");
    requireFiniteNumbers(d04.snapshot, [
      "targetDim", "neighborScale", "noise", "randomSeed", "spread", "retainedVariance",
      "reconstructionRmse", "distanceDistortion", "trustworthiness", "pcaAxisCount",
      "componentLoadingCellCount", "projectedPointCount", "residualRodCount",
      "randomProjectionMatrixCellCount", "swissRollRibbonPointCount", "manifoldEdgeCount",
      "pcaExplainedVariance", "residualEnergy", "jlDistortionMean", "manifoldTrustworthiness",
      "leakageRiskScore"
    ], "D04");
    requireIncludes(d04.snapshot.diagnosticMetrics, [
      "retained_variance", "reconstruction_rmse", "distance_distortion", "trustworthiness",
      "target_dim", "neighbor_scale", "pca_eigenvalues", "residual_rods",
      "jl_distance_pairs", "manifold_edges"
    ], "D04 diagnostics");
    if (!d04.snapshot.pcaSubspaceHash || !d04.snapshot.reconstructionResidualHash || !d04.snapshot.randomProjectionHash || !d04.snapshot.manifoldGraphHash || !d04.snapshot.commandEffectHash) {
      throw new Error(`D04 should expose PCA/residual/random/manifold/command hashes: ${JSON.stringify(d04.snapshot)}.`);
    }
    requireStateText(d04.snapshot, /PCA|principal|projection|variance|reconstruction|random|manifold/i, "D04 initial");

    await page.selectOption("#viewMode", "residuals");
    await setRange(page, "#targetDim", "1");
    await page.waitForTimeout(160);
    const d04Rank1 = await page.evaluate(() => window.__d04LabSnapshot());
    await setRange(page, "#targetDim", "3");
    await page.waitForTimeout(160);
    const d04Rank3 = await page.evaluate(() => window.__d04LabSnapshot());
    requireStateText(d04Rank1, /Rank-1|residual|x - x_hat|discarded/i, "D04 residual rank 1");
    if (d04Rank1.reconstructionRmse <= d04Rank3.reconstructionRmse || d04Rank1.reconstructionResidualHash === d04Rank3.reconstructionResidualHash) {
      throw new Error(`D04 target k should visibly lower residual loss and reshape rods: ${JSON.stringify({ rank1: d04Rank1, rank3: d04Rank3 })}.`);
    }

    await page.selectOption("#viewMode", "random");
    await setRange(page, "#randomSeed", "1");
    await page.waitForTimeout(160);
    const d04Seed1 = await page.evaluate(() => window.__d04LabSnapshot());
    await setRange(page, "#randomSeed", "9");
    await page.waitForTimeout(160);
    const d04Seed9 = await page.evaluate(() => window.__d04LabSnapshot());
    requireStateText(d04Seed1, /random projection|Johnson|distance/i, "D04 random");
    if (d04Seed1.randomProjectionHash === d04Seed9.randomProjectionHash || d04Seed1.commandEffectHash === d04Seed9.commandEffectHash) {
      throw new Error(`D04 randomSeed should reshape random projection matrix and distance gauges: ${JSON.stringify({ seed1: d04Seed1, seed9: d04Seed9 })}.`);
    }

    await page.selectOption("#dataset", "swiss");
    await page.selectOption("#viewMode", "manifold");
    await setRange(page, "#neighborScale", "4");
    await page.waitForTimeout(160);
    const d04Local = await page.evaluate(() => window.__d04LabSnapshot());
    await setRange(page, "#neighborScale", "22");
    await page.waitForTimeout(160);
    const d04Broad = await page.evaluate(() => window.__d04LabSnapshot());
    requireStateText(d04Local, /Swiss|manifold|neighbor|geodesic/i, "D04 manifold");
    if (d04Local.manifoldGraphHash === d04Broad.manifoldGraphHash || d04Local.commandEffectHash === d04Broad.commandEffectHash) {
      throw new Error(`D04 neighbor scale should rewire manifold graph and command telemetry: ${JSON.stringify({ local: d04Local, broad: d04Broad })}.`);
    }

    const d05 = await loadLab(page, "d05-clustering-algorithms-lab.html", "__d05LabReady", "__d05LabSnapshot");
    requireRenderFit(d05, "D05");
    requireVersion(d05.snapshot, "D05");
    if (
      d05.snapshot.kmeansObjectCount < 6 ||
      d05.snapshot.dbscanObjectCount < 5 ||
      d05.snapshot.gmmObjectCount < 4 ||
      d05.snapshot.spectralObjectCount < 5 ||
      d05.snapshot.clusteringDiagnosticObjectCount < 5
    ) {
      throw new Error(`D05 lacks a full canonical clustering inventory: ${JSON.stringify(d05.snapshot)}.`);
    }
    requireIncludes(d05.snapshot.clusteringObjects, [
      "unlabeled_point_cloud",
      "kmeans_centroid_markers_mu_k",
      "nearest_centroid_assignment_tethers",
      "voronoi_cluster_cells",
      "lloyd_assignment_update_arrows",
      "inertia_objective_meter_sum_squared_distances",
      "gmm_gaussian_ellipse_covariance_components",
      "soft_responsibility_rows_gamma_ik",
      "em_update_weighted_mean_covariance_board",
      "dbscan_epsilon_neighborhood_rings",
      "dbscan_core_border_noise_point_states",
      "density_reachability_edges",
      "k_distance_elbow_reference_curve",
      "hierarchical_dendrogram_merge_tree",
      "spectral_affinity_graph_edges",
      "laplacian_fiedler_vector_cut_ribbon",
      "spectral_embedding_scatter_before_kmeans",
      "silhouette_score_compactness_separation_meter",
      "cluster_size_distribution_bars",
      "parameter_sensitivity_warning_band"
    ], "D05 objects");
    requireIncludes(d05.snapshot.canonicalReferences, [
      "Lloyd k-means centroid update",
      "Gaussian mixture EM responsibilities",
      "DBSCAN density reachability",
      "Agglomerative dendrogram linkage",
      "Spectral clustering Laplacian eigenvectors"
    ], "D05 references");
    requireFiniteNumbers(d05.snapshot, [
      "k", "inertia", "silhouette", "epsilon", "neighborCount", "spread", "initSpread",
      "assignmentLineCount", "voronoiCellCount", "corePoints", "epsilonRingCount",
      "gmmEllipseCount", "affinityEdgeCount", "laplacianCutRibbonPointCount",
      "clusterSizeImbalance", "noisePointCount", "responsibilityEntropy", "spectralCutStrength"
    ], "D05");
    requireIncludes(d05.snapshot.diagnosticMetrics, [
      "inertia", "silhouette", "cluster_count", "assignment_lines", "voronoi_cells",
      "core_points", "noise_points", "responsibility_entropy", "affinity_edges",
      "spectral_cut_strength"
    ], "D05 diagnostics");
    if (!d05.snapshot.kmeansObjectiveHash || !d05.snapshot.dbscanReachabilityHash || !d05.snapshot.gmmResponsibilityHash || !d05.snapshot.spectralGraphHash || !d05.snapshot.clusterAssumptionHash || !d05.snapshot.commandEffectHash) {
      throw new Error(`D05 should expose kmeans/dbscan/gmm/spectral/assumption/command hashes: ${JSON.stringify(d05.snapshot)}.`);
    }
    requireStateText(d05.snapshot, /K-means|centroid|cluster|DBSCAN|GMM|Spectral/i, "D05 initial");

    await page.locator("#stepAlgo").click();
    await page.waitForTimeout(160);
    const d05Stepped = await page.evaluate(() => window.__d05LabSnapshot());
    requireStateText(d05Stepped, /Lloyd|K-means|centroid|inertia/i, "D05 Lloyd step");
    if (d05Stepped.inertia >= d05.snapshot.inertia || d05Stepped.kmeansObjectiveHash === d05.snapshot.kmeansObjectiveHash) {
      throw new Error(`D05 Lloyd step should lower inertia and move the K-means geometry: ${JSON.stringify({ before: d05.snapshot, after: d05Stepped })}.`);
    }

    await page.selectOption("#dataset", "moons");
    await page.selectOption("#viewMode", "dbscan");
    await setRange(page, "#epsilon", "0.20");
    await page.waitForTimeout(160);
    const d05SmallEps = await page.evaluate(() => window.__d05LabSnapshot());
    await setRange(page, "#epsilon", "0.62");
    await page.waitForTimeout(160);
    const d05LargeEps = await page.evaluate(() => window.__d05LabSnapshot());
    requireStateText(d05SmallEps, /DBSCAN|epsilon|core|border|noise|density/i, "D05 DBSCAN");
    if (d05LargeEps.corePoints <= d05SmallEps.corePoints || d05LargeEps.dbscanReachabilityHash === d05SmallEps.dbscanReachabilityHash) {
      throw new Error(`D05 epsilon should visibly change DBSCAN reachability: ${JSON.stringify({ small: d05SmallEps, large: d05LargeEps })}.`);
    }

    await page.selectOption("#viewMode", "gmm");
    await page.waitForTimeout(160);
    const d05Gmm = await page.evaluate(() => window.__d05LabSnapshot());
    requireStateText(d05Gmm, /GMM|Gaussian mixture|responsibility|soft/i, "D05 GMM");
    if (!d05Gmm.responsibilityRows.every((row) => Math.abs(row.responsibilities.reduce((sum, value) => sum + value, 0) - 1) < 1e-6)) {
      throw new Error(`D05 GMM responsibilities should sum to one: ${JSON.stringify(d05Gmm.responsibilityRows)}.`);
    }

    await page.selectOption("#viewMode", "spectral");
    await setRange(page, "#neighborCount", "4");
    await page.waitForTimeout(160);
    const d05Sparse = await page.evaluate(() => window.__d05LabSnapshot());
    await setRange(page, "#neighborCount", "16");
    await page.waitForTimeout(160);
    const d05Dense = await page.evaluate(() => window.__d05LabSnapshot());
    requireStateText(d05Sparse, /Spectral|Laplacian|affinity|Fiedler|graph cut/i, "D05 spectral");
    if (d05Sparse.spectralGraphHash === d05Dense.spectralGraphHash || d05Sparse.commandEffectHash === d05Dense.commandEffectHash) {
      throw new Error(`D05 neighbor count should rewire spectral affinity graph and command telemetry: ${JSON.stringify({ sparse: d05Sparse, dense: d05Dense })}.`);
    }
  } finally {
    await browser.close();
  }

  console.log("d04-d05 canonical clarity passed: dimensionality reduction and clustering expose textbook objects, controls, and diagnostics.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
