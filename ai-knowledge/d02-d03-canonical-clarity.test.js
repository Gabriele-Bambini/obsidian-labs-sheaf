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
const CLARITY_VERSION = "d02-d03-canonical-clarity-v2";
const LEGACY_VERSION = "d02-d03-canonical-clarity-v1";

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

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1180, height: 700 } });

  try {
    const d02 = await loadLab(page, "d02-svm-margin-kernel-lab.html", "__d02LabReady", "__d02LabSnapshot");
    if (d02.bytes < 15000 || d02.overflowX > 18 || d02.overflowY > 18 || d02.commandBarHeight > 170) {
      throw new Error(`D02 render should be fitted and readable: ${JSON.stringify(d02)}.`);
    }
    requireVersion(d02.snapshot, "D02");
    if (
      d02.snapshot.marginGeometryObjectCount < 5 ||
      d02.snapshot.supportVectorObjectCount < 3 ||
      d02.snapshot.hingeSlackObjectCount < 4 ||
      d02.snapshot.dualKernelObjectCount < 6 ||
      d02.snapshot.svmDiagnosticObjectCount < 5
    ) {
      throw new Error(`D02 lacks a full canonical SVM inventory: ${JSON.stringify(d02.snapshot)}.`);
    }
    requireIncludes(d02.snapshot.svmObjects, [
      "decision_boundary_plane_f_x_equals_zero",
      "positive_margin_plane_f_x_equals_plus_one",
      "negative_margin_plane_f_x_equals_minus_one",
      "geometric_margin_width_ruler_one_over_norm_w",
      "support_vector_rings_on_margin",
      "signed_training_point_cloud_y_i",
      "hinge_loss_violation_rods_max_zero_one_minus_yf",
      "slack_variable_columns_xi_i",
      "c_penalty_pressure_meter",
      "dual_alpha_support_vector_bars",
      "alpha_box_constraint_zero_to_c_rail",
      "kernel_gram_matrix_k_xi_xj_cells",
      "rbf_support_vector_influence_bumps",
      "nonlinear_kernel_decision_contour",
      "gamma_locality_field",
      "soft_margin_overlap_control_band"
    ], "D02 objects");
    requireIncludes(d02.snapshot.canonicalReferences, [
      "maximum margin hyperplane",
      "soft margin hinge loss with slack variables",
      "dual alpha support vector sparsity",
      "kernel trick Gram matrix",
      "RBF gamma locality"
    ], "D02 references");
    requireFiniteNumbers(d02.snapshot, [
      "marginWidth", "supportCount", "hingeMean", "accuracy", "alphaMass",
      "marginPlaneCount", "supportRingVisibleCount", "activeHingeRodCount",
      "slackBlockVisibleCount", "alphaActiveCount", "alphaMax", "rbfBumpCount",
      "kernelGramCellCount", "kernelContourPointCount", "cPenalty", "gamma",
      "overlap", "supportBias", "softness"
    ], "D02");
    requireIncludes(d02.snapshot.diagnosticMetrics, [
      "margin_width", "support_count", "hinge_mean", "accuracy",
      "alpha_mass", "active_hinge_rods", "alpha_active_count",
      "kernel_gram_cells", "rbf_bumps", "gamma"
    ], "D02 diagnostics");
    if (!d02.snapshot.marginSlabHash || !d02.snapshot.hingeSlackHash || !d02.snapshot.dualAlphaHash || !d02.snapshot.kernelSurfaceHash || !d02.snapshot.commandEffectHash) {
      throw new Error(`D02 should expose margin/hinge/dual/kernel/command hashes: ${JSON.stringify(d02.snapshot)}.`);
    }
    requireStateText(d02.snapshot, /support vector machine|maximum margin|support vectors|hinge|kernel/i, "D02 initial");
    const d02InitialHashes = [
      d02.snapshot.marginSlabHash,
      d02.snapshot.hingeSlackHash,
      d02.snapshot.dualAlphaHash,
      d02.snapshot.kernelSurfaceHash,
      d02.snapshot.commandEffectHash
    ];
    await page.selectOption("#viewMode", "hinge");
    await setRange(page, "#svmOverlap", "0.95");
    await setRange(page, "#cPenalty", "3.5");
    await page.waitForTimeout(160);
    const d02Hinge = await page.evaluate(() => window.__d02LabSnapshot());
    requireStateText(d02Hinge, /hinge|soft-margin|C|violation|slack/i, "D02 hinge");
    const d02Changed = d02InitialHashes.filter((hash, index) => hash !== [
      d02Hinge.marginSlabHash,
      d02Hinge.hingeSlackHash,
      d02Hinge.dualAlphaHash,
      d02Hinge.kernelSurfaceHash,
      d02Hinge.commandEffectHash
    ][index]).length;
    if (d02Changed < 3 || d02Hinge.activeHingeRodCount < d02.snapshot.activeHingeRodCount) {
      throw new Error(`D02 overlap/C controls should visibly reshape hinge diagnostics: ${JSON.stringify({ before: d02.snapshot, after: d02Hinge })}.`);
    }
    await page.selectOption("#viewMode", "dual");
    await page.locator("#stepSmo").click();
    await page.waitForTimeout(120);
    const d02Step = await page.evaluate(() => window.__d02LabSnapshot());
    requireStateText(d02Step, /SMO|dual|alpha|support-vector|box/i, "D02 SMO step");
    await page.selectOption("#kernel", "rbf");
    await setRange(page, "#gamma", "2.2");
    await page.waitForTimeout(160);
    const d02Kernel = await page.evaluate(() => window.__d02LabSnapshot());
    requireStateText(d02Kernel, /kernel trick|RBF|gamma|decision boundary|support vectors/i, "D02 kernel");
    if (d02Kernel.kernelSurfaceHash === d02Hinge.kernelSurfaceHash || d02Kernel.rbfBumpCount < 16) {
      throw new Error(`D02 RBF controls should reshape kernel surface diagnostics: ${JSON.stringify({ hinge: d02Hinge, kernel: d02Kernel })}.`);
    }

    const d03 = await loadLab(page, "d03-tree-models-lab.html", "__d03LabReady", "__d03LabSnapshot");
    if (d03.bytes < 15000 || d03.overflowX > 18 || d03.overflowY > 18 || d03.commandBarHeight > 170) {
      throw new Error(`D03 render should be fitted and readable: ${JSON.stringify(d03)}.`);
    }
    requireVersion(d03.snapshot, "D03");
    if (
      d03.snapshot.partitionObjectCount < 5 ||
      d03.snapshot.impurityScanObjectCount < 5 ||
      d03.snapshot.pruningObjectCount < 4 ||
      d03.snapshot.forestVoteObjectCount < 4 ||
      d03.snapshot.treeDiagnosticObjectCount < 5
    ) {
      throw new Error(`D03 lacks a full canonical CART inventory: ${JSON.stringify(d03.snapshot)}.`);
    }
    requireIncludes(d03.snapshot.treeModelObjects, [
      "root_node_training_sample_bucket",
      "axis_aligned_cart_split_wall_xj_less_equal_t",
      "recursive_feature_space_leaf_rectangles",
      "leaf_class_probability_tiles_or_mean_plateaus",
      "gini_impurity_parent_child_decomposition",
      "entropy_information_gain_reference",
      "squared_error_reduction_regression_reference",
      "candidate_threshold_scan_bars",
      "selected_max_gain_threshold_marker",
      "blocked_min_leaf_candidate_markers",
      "cart_tree_structure_nodes_and_edges",
      "cost_complexity_pruning_alpha_path",
      "merged_pruned_branch_cells",
      "bootstrap_tree_vote_slabs",
      "forest_vote_disagreement_surface",
      "regression_leaf_mean_plateaus"
    ], "D03 objects");
    requireIncludes(d03.snapshot.canonicalReferences, [
      "CART recursive binary partitioning",
      "Gini impurity and information gain",
      "regression tree squared error reduction",
      "cost complexity pruning alpha path",
      "random forest bootstrap vote disagreement"
    ], "D03 references");
    requireFiniteNumbers(d03.snapshot, [
      "leaves", "splits", "prunedSplits", "bestGain", "accuracy", "rmse",
      "forestDisagreement", "steps", "blockedCandidateCount", "mergedCellCount",
      "maxDepth", "minLeaf", "pruneAlpha"
    ], "D03");
    requireIncludes(d03.snapshot.diagnosticMetrics, [
      "leaves", "splits", "best_gain", "accuracy", "rmse",
      "blocked_candidates", "merged_cells", "forest_disagreement",
      "max_depth", "min_leaf", "prune_alpha"
    ], "D03 diagnostics");
    if (!Array.isArray(d03.snapshot.partitionCells) || !Array.isArray(d03.snapshot.impurityCandidates) || !Array.isArray(d03.snapshot.pruningPath) || !Array.isArray(d03.snapshot.forestVotes)) {
      throw new Error(`D03 should expose cells, candidates, pruning path, and votes: ${JSON.stringify(d03.snapshot)}.`);
    }
    if (!d03.snapshot.partitionGeometryHash || !d03.snapshot.impurityScanHash || !d03.snapshot.pruningPathHash || !d03.snapshot.forestVoteHash || !d03.snapshot.commandEffectHash) {
      throw new Error(`D03 should expose partition/impurity/pruning/forest/command hashes: ${JSON.stringify(d03.snapshot)}.`);
    }
    requireStateText(d03.snapshot, /decision tree|axis-aligned|leaf|impurity|pruning|forest/i, "D03 initial");
    const d03InitialHashes = [
      d03.snapshot.partitionGeometryHash,
      d03.snapshot.impurityScanHash,
      d03.snapshot.pruningPathHash,
      d03.snapshot.forestVoteHash,
      d03.snapshot.commandEffectHash
    ];
    await page.selectOption("#viewMode", "impurity");
    await setRange(page, "#minLeaf", "12");
    await page.waitForTimeout(160);
    const d03Impurity = await page.evaluate(() => window.__d03LabSnapshot());
    requireStateText(d03Impurity, /Gini|candidate root thresholds|impurity|split/i, "D03 impurity");
    if (d03Impurity.blockedCandidateCount <= d03.snapshot.blockedCandidateCount || d03Impurity.impurityScanHash === d03.snapshot.impurityScanHash) {
      throw new Error(`D03 min-leaf control should visibly block threshold candidates: ${JSON.stringify({ before: d03.snapshot, after: d03Impurity })}.`);
    }
    await page.selectOption("#viewMode", "pruning");
    await setRange(page, "#minLeaf", "3");
    await setRange(page, "#pruneAlpha", "1.5");
    await page.waitForTimeout(160);
    const d03Pruned = await page.evaluate(() => window.__d03LabSnapshot());
    requireStateText(d03Pruned, /Cost-complexity|alpha|collapses|branches|leaves/i, "D03 pruning");
    const d03Changed = d03InitialHashes.filter((hash, index) => hash !== [
      d03Pruned.partitionGeometryHash,
      d03Pruned.impurityScanHash,
      d03Pruned.pruningPathHash,
      d03Pruned.forestVoteHash,
      d03Pruned.commandEffectHash
    ][index]).length;
    if (d03Changed < 3 || d03Pruned.leaves > d03.snapshot.leaves) {
      throw new Error(`D03 pruning controls should simplify tree geometry: ${JSON.stringify({ before: d03.snapshot, after: d03Pruned })}.`);
    }
    await page.selectOption("#viewMode", "forest");
    await setRange(page, "#bootstrap", "1.0");
    await page.waitForTimeout(160);
    const d03Forest = await page.evaluate(() => window.__d03LabSnapshot());
    requireStateText(d03Forest, /Forest vote|bootstrap|disagreement|splits/i, "D03 forest");
    if (d03Forest.forestVoteHash === d03Pruned.forestVoteHash || !d03Forest.forestVotes.some((vote) => vote.votesForClass0 > 0 && vote.votesForClass1 > 0)) {
      throw new Error(`D03 bootstrap should expose forest vote disagreement: ${JSON.stringify(d03Forest)}.`);
    }
    await page.selectOption("#task", "regression");
    await page.selectOption("#dataset", "regression");
    await page.waitForTimeout(160);
    const d03Regression = await page.evaluate(() => window.__d03LabSnapshot());
    if (d03Regression.criterion !== "squared" || !d03Regression.partitionCells.every((cell) => Number.isFinite(cell.meanY))) {
      throw new Error(`D03 regression mode should show squared-error mean plateaus: ${JSON.stringify(d03Regression)}.`);
    }
  } finally {
    await browser.close();
  }

  console.log("d02-d03 canonical clarity passed: SVM and CART expose textbook objects, commands, and diagnostics.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
