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
const CLARITY_VERSION = "e12-e13-canonical-clarity-v2";
const LEGACY_VERSION = "e12-e13-canonical-clarity-v1";

async function setRange(page, selector, value) {
  await page.locator(selector).evaluate((input, nextValue) => {
    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function loadLab(page, fileName, readyName, snapshotName) {
  const labPath = path.join(__dirname, fileName).replace(/\\/g, "/");
  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
  await page.waitForFunction(
    ([ready, snapshot]) => window[ready] === true && typeof window[snapshot] === "function" && window[snapshot](),
    [readyName, snapshotName]
  );
  await page.waitForTimeout(260);
  return page.evaluate((snapshot) => {
    const canvas = document.querySelector(".lab-viewport canvas");
    return {
      bytes: canvas.toDataURL("image/png").length,
      snapshot: window[snapshot](),
      overflowX: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
      overflowY: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight
    };
  }, snapshotName);
}

function requireFitted(result, lab) {
  if (result.overflowX > 18 || result.overflowY > 18) {
    throw new Error(`${lab} iframe fit regressed: overflowX=${result.overflowX}, overflowY=${result.overflowY}`);
  }
}

function requireVersion(snapshot, lab) {
  if (snapshot.clarityVersion !== CLARITY_VERSION) {
    throw new Error(`${lab} expected ${CLARITY_VERSION}, got ${snapshot.clarityVersion}: ${JSON.stringify(snapshot)}`);
  }
  if (snapshot.legacyClarityVersion !== LEGACY_VERSION) {
    throw new Error(`${lab} should preserve legacy marker ${LEGACY_VERSION}: ${JSON.stringify(snapshot)}`);
  }
  if (snapshot.has3d !== true) {
    throw new Error(`${lab} should explicitly expose 3D scene telemetry: ${JSON.stringify(snapshot)}`);
  }
}

function requireFields(snapshot, fields, lab) {
  for (const field of fields) {
    if (!(field in snapshot)) throw new Error(`${lab} missing snapshot field ${field}`);
    if (snapshot[field] == null || snapshot[field] === "") throw new Error(`${lab} empty snapshot field ${field}`);
  }
}

function requireIncludes(values, expected, lab) {
  const missing = expected.filter((value) => !values.includes(value));
  if (missing.length) throw new Error(`${lab} missing canonical entries: ${missing.join(", ")} in ${JSON.stringify(values)}`);
}

function requireFiniteNumbers(snapshot, fields, lab) {
  const missing = fields.filter((field) => !Number.isFinite(snapshot[field]));
  if (missing.length) throw new Error(`${lab} missing finite numeric telemetry: ${missing.join(", ")} in ${JSON.stringify(snapshot)}`);
}

function requireMin(snapshot, field, min, lab) {
  if (!(snapshot[field] >= min)) {
    throw new Error(`${lab} expected ${field} >= ${min}, got ${snapshot[field]}`);
  }
}

function requireChanged(before, after, fields, lab) {
  const changed = fields.filter((field) => before[field] !== after[field]);
  if (changed.length < Math.min(3, fields.length)) {
    throw new Error(`${lab} controls did not visibly alter enough geometry hashes: ${changed.join(", ") || "none"}`);
  }
}

async function requireOrbitZoom(page, snapshotName, lab) {
  const before = await page.evaluate((snapshot) => window[snapshot](), snapshotName);
  const box = await page.locator(".lab-viewport canvas").boundingBox();
  if (!box) throw new Error(`${lab} canvas bounding box missing`);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 105, cy + 45, { steps: 8 });
  await page.mouse.up();
  await page.mouse.wheel(0, -240);
  await page.waitForTimeout(120);
  const after = await page.evaluate((snapshot) => window[snapshot](), snapshotName);
  const rotated = Math.abs(after.cameraTheta - before.cameraTheta) > 0.1 || Math.abs(after.cameraPhi - before.cameraPhi) > 0.05;
  const zoomed = Math.abs(after.cameraRadius - before.cameraRadius) > 0.1;
  if (!rotated || !zoomed) {
    throw new Error(`${lab} manual orbit/zoom did not affect camera.`);
  }
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });

  try {
    let e12 = await loadLab(page, "e12-dqn-target-update-lab.html", "__e12LabReady", "__e12LabSnapshot");
    requireFitted(e12, "E12");
    if (e12.bytes < 10000) {
      throw new Error(`E12 canonical clarity render is weak: ${JSON.stringify(e12.snapshot)}`);
    }
    requireVersion(e12.snapshot, "E12");
    await requireOrbitZoom(page, "__e12LabSnapshot", "E12");
    [
      ["dqnNetworkObjectCount", 8],
      ["replayLearningObjectCount", 8],
      ["bellmanTargetObjectCount", 5],
      ["stabilityDiagnosticObjectCount", 5],
      ["variantMechanismObjectCount", 3]
    ].forEach(([field, min]) => requireMin(e12.snapshot, field, min, "E12"));
    requireIncludes(e12.snapshot.dqnObjects, [
      "online_q_network_action_value_heads",
      "chosen_action_loss_mask",
      "delayed_target_network_shadow_heads",
      "experience_replay_transition_conveyor",
      "sampled_transition_tuple_s_a_r_s_prime_done",
      "bellman_target_card_y_equals_r_plus_gamma_max_q",
      "temporal_difference_error_bridge",
      "terminal_done_bootstrap_gate",
      "target_network_hard_sync_copy_bridge",
      "double_dqn_selector_evaluator_split",
      "prioritized_replay_surprise_bars",
      "minibatch_decorrelation_tiles",
      "deadly_triad_instability_meter",
      "stale_target_feedback_brake",
      "off_policy_replay_distribution_marker"
    ], "E12 objects");
    requireIncludes(e12.snapshot.canonicalReferences, [
      "DQN Bellman target",
      "experience replay buffer",
      "delayed target network",
      "temporal-difference error",
      "terminal transition no-bootstrap rule",
      "Double DQN online selector target evaluator",
      "prioritized replay by TD error"
    ], "E12 references");
    requireIncludes(e12.snapshot.diagnosticMetrics, [
      "td_error",
      "target_gap",
      "replay_priority",
      "instability_risk",
      "target_value",
      "prediction",
      "selected_action",
      "terminal_mix",
      "learning_rate"
    ], "E12 metrics");
    requireFiniteNumbers(e12.snapshot, [
      "tdError",
      "targetGap",
      "replayPriority",
      "instability",
      "targetValue",
      "prediction",
      "selectedAction",
      "onlineTargetGap",
      "bellmanBackupValue",
      "bootstrapValue",
      "replayDiversity",
      "overestimationRisk",
      "targetStaleness",
      "terminalBootstrapSuppression"
    ], "E12");
    [
      ["onlineQBarCount", 4],
      ["targetQBarCount", 4],
      ["replayTileCount", 14],
      ["priorityBarCount", 8],
      ["bellmanTargetCardCount", 1],
      ["terminalGateCount", 1],
      ["tdBridgeCount", 1],
      ["targetSyncBridgeCount", 1],
      ["doubleDqnPathCount", 2],
      ["instabilityMeterCount", 1],
      ["transitionTupleObjectCount", 5],
      ["bellmanFormulaTermCount", 4]
    ].forEach(([field, min]) => requireMin(e12.snapshot, field, min, "E12"));
    requireFields(e12.snapshot, [
      "onlineNetworkHash",
      "targetNetworkHash",
      "replayBufferHash",
      "priorityReplayHash",
      "bellmanTargetHash",
      "tdErrorBridgeHash",
      "terminalGateHash",
      "targetSyncHash",
      "doubleDqnHash",
      "instabilityMeterHash",
      "transitionTupleHash",
      "chosenActionHash",
      "dqnArchitectureHash",
      "replayExperienceHash",
      "bellmanTargetFlowHash",
      "tdErrorLearningHash",
      "targetNetworkStabilityHash",
      "doubleDqnSelectionHash",
      "terminalBootstrapHash",
      "commandEffectHash"
    ], "E12");
    const e12Before = e12.snapshot;
    await page.locator("#targetMode").selectOption("double");
    await page.locator("#replayMode").selectOption("prioritized");
    await setRange(page, "#learningRate", "0.44");
    await setRange(page, "#discount", "0.82");
    await setRange(page, "#targetLag", "0.68");
    await setRange(page, "#batchSize", "7");
    await setRange(page, "#terminalMix", "0.58");
    await page.click("#trainDqn");
    await page.click("#sampleReplay");
    await page.click("#syncTarget");
    e12 = await page.evaluate(() => ({ snapshot: window.__e12LabSnapshot() }));
    requireChanged(e12Before, e12.snapshot, [
      "dqnArchitectureHash",
      "replayExperienceHash",
      "bellmanTargetFlowHash",
      "tdErrorLearningHash",
      "targetNetworkStabilityHash",
      "doubleDqnSelectionHash",
      "terminalBootstrapHash",
      "commandEffectHash"
    ], "E12");
    if (e12.snapshot.targetMode !== "double" || e12.snapshot.replayMode !== "prioritized" || e12.snapshot.trainStep < 1 || e12.snapshot.sampleIndex < 1 || e12.snapshot.syncStep < 1) {
      throw new Error(`E12 controls did not change DQN state: ${JSON.stringify(e12.snapshot)}`);
    }

    let e13 = await loadLab(page, "e13-meta-learning-inner-loop.html", "__e13LabReady", "__e13LabSnapshot");
    requireFitted(e13, "E13");
    if (e13.bytes < 10000) {
      throw new Error(`E13 canonical clarity render is weak: ${JSON.stringify(e13.snapshot)}`);
    }
    requireVersion(e13.snapshot, "E13");
    await requireOrbitZoom(page, "__e13LabSnapshot", "E13");
    [
      ["episodeObjectCount", 8],
      ["mamlLoopObjectCount", 5],
      ["metricLearningObjectCount", 4],
      ["taskDistributionObjectCount", 5],
      ["generalizationDiagnosticObjectCount", 3]
    ].forEach(([field, min]) => requireMin(e13.snapshot, field, min, "E13"));
    requireIncludes(e13.snapshot.metaLearningObjects, [
      "support_set_task_evidence_points",
      "query_set_heldout_evaluation_points",
      "n_way_k_shot_episode_split",
      "task_distribution_optima_constellation",
      "meta_initialization_theta_basin",
      "adapted_theta_prime_bead",
      "maml_inner_gradient_adaptation_path",
      "outer_query_loss_meta_gradient_bridge",
      "second_order_maml_curvature_sheet",
      "reptile_first_order_pull_vector",
      "prototypical_class_centroid_anchors",
      "few_shot_shot_counter_pillars",
      "query_shift_meta_overfitting_warning",
      "heldout_task_generalization_gap"
    ], "E13 objects");
    requireIncludes(e13.snapshot.canonicalReferences, [
      "MAML inner update theta prime",
      "outer loop query loss through adaptation",
      "support query episodic training",
      "N-way K-shot few-shot classification",
      "prototypical networks class centroids",
      "Reptile first-order meta-update",
      "meta-overfitting task distribution shift"
    ], "E13 references");
    requireIncludes(e13.snapshot.diagnosticMetrics, [
      "support_loss",
      "query_loss",
      "adaptation_gain",
      "meta_gradient_magnitude",
      "meta_gap",
      "shots",
      "query_shift",
      "task_spread"
    ], "E13 metrics");
    requireFiniteNumbers(e13.snapshot, [
      "supportLoss",
      "queryLoss",
      "adaptationGain",
      "metaGradientMagnitude",
      "metaGap",
      "protoSeparation",
      "innerLoopDistance",
      "outerUpdateMagnitude",
      "supportQueryGap",
      "taskDiversity",
      "fewShotEvidence",
      "metaOverfitPressure",
      "adaptationEfficiency"
    ], "E13");
    [
      ["supportPointCount", 8],
      ["queryPointCount", 8],
      ["taskOptimumCount", 7],
      ["innerPathBeadCount", 6],
      ["prototypeAnchorCount", 3],
      ["shotPillarCount", 8],
      ["curvatureSurfaceCount", 1],
      ["taskHullCount", 1],
      ["outerMetaBridgeCount", 1],
      ["reptileVectorCount", 1],
      ["metaInitObjectCount", 1],
      ["queryShiftWarningCount", 1]
    ].forEach(([field, min]) => requireMin(e13.snapshot, field, min, "E13"));
    requireFields(e13.snapshot, [
      "supportSetHash",
      "querySetHash",
      "metaInitializationHash",
      "taskOptimaHash",
      "innerAdaptationPathHash",
      "outerMetaGradientHash",
      "mamlCurvatureHash",
      "reptileVectorHash",
      "prototypeAnchorHash",
      "metaOverfitWarningHash",
      "episodeSplitHash",
      "taskDistributionHash",
      "episodeGeometryHash",
      "mamlInnerLoopHash",
      "outerLoopGradientHash",
      "taskDistributionGeometryHash",
      "prototypeMetricHash",
      "reptileUpdateHash",
      "metaGeneralizationHash",
      "commandEffectHash"
    ], "E13");
    const e13Before = e13.snapshot;
    await page.locator("#taskFamily").selectOption("classes");
    await page.locator("#adaptationMode").selectOption("reptile");
    await setRange(page, "#innerSteps", "4");
    await setRange(page, "#innerLR", "0.52");
    await setRange(page, "#metaLR", "0.34");
    await setRange(page, "#shots", "4");
    await setRange(page, "#taskSpread", "1.55");
    await setRange(page, "#queryShift", "0.48");
    await page.click("#adaptTask");
    await page.click("#outerUpdate");
    await page.click("#compareProto");
    e13 = await page.evaluate(() => ({ snapshot: window.__e13LabSnapshot() }));
    requireChanged(e13Before, e13.snapshot, [
      "episodeGeometryHash",
      "mamlInnerLoopHash",
      "outerLoopGradientHash",
      "taskDistributionGeometryHash",
      "prototypeMetricHash",
      "reptileUpdateHash",
      "metaGeneralizationHash",
      "commandEffectHash"
    ], "E13");
    if (e13.snapshot.taskFamily !== "classes" || e13.snapshot.adaptationMode !== "proto" || e13.snapshot.innerStepCount < 4 || e13.snapshot.outerStep < 1 || e13.snapshot.protoPulse < 1) {
      throw new Error(`E13 controls did not change meta-learning state: ${JSON.stringify(e13.snapshot)}`);
    }
  } finally {
    await browser.close();
  }

  console.log("e12-e13 canonical clarity passed: DQN target and meta-learning labs expose concrete textbook objects, live control consequences, and fitted iframes.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
