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
const CLARITY_VERSION = "e10-e11-canonical-clarity-v2";
const LEGACY_VERSION = "e10-e11-canonical-clarity-v1";

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
  await page.mouse.move(cx + 110, cy + 48, { steps: 8 });
  await page.mouse.up();
  await page.mouse.wheel(0, -260);
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
    let e10 = await loadLab(page, "e10-normalizing-flow-density.html", "__e10LabReady", "__e10LabSnapshot");
    requireFitted(e10, "E10");
    if (e10.bytes < 10000) {
      throw new Error(`E10 canonical clarity render is weak: ${JSON.stringify(e10.snapshot)}`);
    }
    requireVersion(e10.snapshot, "E10");
    await requireOrbitZoom(page, "__e10LabSnapshot", "E10");
    [
      ["invertibleTransformObjectCount", 8],
      ["densityAccountingObjectCount", 6],
      ["jacobianObjectCount", 5],
      ["couplingLayerObjectCount", 4],
      ["samplingLikelihoodObjectCount", 5]
    ].forEach(([field, min]) => requireMin(e10.snapshot, field, min, "E10"));
    requireIncludes(e10.snapshot.flowObjects, [
      "standard_gaussian_base_density_curve",
      "data_space_transformed_density_curve",
      "invertible_flow_warp_grid",
      "change_of_variables_mass_tiles",
      "jacobian_logdet_volume_bars",
      "triangular_affine_coupling_jacobian",
      "coupling_mask_frozen_transformed_split",
      "composition_logdet_stack",
      "data_to_latent_forward_path",
      "latent_to_data_inverse_sampling_path",
      "selected_x_z_density_beads",
      "dequantization_continuous_pixel_pad",
      "likelihood_accounting_ledger",
      "local_volume_element_stretch_box",
      "likelihood_anomaly_ridge",
      "conditional_flow_shift_channel"
    ], "E10 objects");
    requireIncludes(e10.snapshot.canonicalReferences, [
      "change of variables formula",
      "Jacobian determinant local volume",
      "RealNVP affine coupling layer",
      "triangular Jacobian cheap logdet",
      "composition logdet sum",
      "dequantization for discrete images",
      "exact likelihood density evaluation"
    ], "E10 references");
    requireIncludes(e10.snapshot.diagnosticMetrics, [
      "log_det",
      "base_log_prob",
      "likelihood",
      "density_ratio",
      "volume_scale",
      "inverse_consistency",
      "layers",
      "dequantization_noise"
    ], "E10 metrics");
    requireFiniteNumbers(e10.snapshot, [
      "logDet",
      "baseLogProb",
      "likelihood",
      "densityRatio",
      "volumeScale",
      "invertibilityScore",
      "jacobianVolumeChange",
      "likelihoodEnergy",
      "densityConservationError",
      "compositionDepthScore",
      "dequantizationNoise"
    ], "E10");
    [
      ["baseCurvePointCount", 80],
      ["warpedCurvePointCount", 80],
      ["warpGridLineCount", 17],
      ["massTileCount", 9],
      ["logDetBarCount", 11],
      ["jacobianMatrixCellCount", 16],
      ["flowLayerCount", 8],
      ["forwardInversePathCount", 2],
      ["dequantizationObjectCount", 1],
      ["likelihoodLedgerCount", 3],
      ["volumeElementCount", 2],
      ["couplingMaskCellCount", 8]
    ].forEach(([field, min]) => requireMin(e10.snapshot, field, min, "E10"));
    requireFields(e10.snapshot, [
      "baseDensityCurveHash",
      "warpedDensityCurveHash",
      "invertibleWarpGridHash",
      "massConservationHash",
      "jacobianLogdetHash",
      "couplingMatrixHash",
      "flowCompositionHash",
      "forwardInversePathHash",
      "dequantizationHash",
      "likelihoodAccountingHash",
      "volumeElementHash",
      "couplingMaskHash",
      "flowArchitectureHash",
      "invertibleWarpHash",
      "jacobianVolumeHash",
      "changeOfVariablesHash",
      "samplingPathHash",
      "likelihoodDiagnosticHash",
      "commandEffectHash"
    ], "E10");
    const e10Before = e10.snapshot;
    await page.locator("#flowType").selectOption("spline");
    await page.locator("#direction").selectOption("sample");
    await setRange(page, "#layers", "7");
    await setRange(page, "#bendStrength", "1.55");
    await setRange(page, "#xPoint", "-1.15");
    await setRange(page, "#scaleClamp", "0.95");
    await setRange(page, "#dequantization", "0.42");
    await setRange(page, "#conditionShift", "-0.65");
    await page.click("#warp");
    await page.click("#inverseSample");
    e10 = await page.evaluate(() => ({ snapshot: window.__e10LabSnapshot() }));
    requireChanged(e10Before, e10.snapshot, [
      "baseDensityCurveHash",
      "warpedDensityCurveHash",
      "invertibleWarpHash",
      "jacobianVolumeHash",
      "changeOfVariablesHash",
      "samplingPathHash",
      "likelihoodDiagnosticHash",
      "commandEffectHash"
    ], "E10");
    if (e10.snapshot.flowType !== "spline" || e10.snapshot.direction !== "sample" || e10.snapshot.warpStep < 2 || !Number.isFinite(e10.snapshot.likelihood)) {
      throw new Error(`E10 controls did not change flow state: ${JSON.stringify(e10.snapshot)}`);
    }

    let e11 = await loadLab(page, "e11-gridworld-bellman-lab.html", "__e11LabReady", "__e11LabSnapshot");
    requireFitted(e11, "E11");
    if (e11.bytes < 10000) {
      throw new Error(`E11 canonical clarity render is weak: ${JSON.stringify(e11.snapshot)}`);
    }
    requireVersion(e11.snapshot, "E11");
    await requireOrbitZoom(page, "__e11LabSnapshot", "E11");
    [
      ["mdpObjectCount", 7],
      ["policyValueObjectCount", 5],
      ["bellmanBackupObjectCount", 5],
      ["trajectoryLearningObjectCount", 3],
      ["explorationDiagnosticObjectCount", 3]
    ].forEach(([field, min]) => requireMin(e11.snapshot, field, min, "E11"));
    requireIncludes(e11.snapshot.rlObjects, [
      "finite_mdp_gridworld_state_tiles",
      "action_arrows_policy_field",
      "terminal_reward_trap_beacons",
      "wall_blocked_transition_barriers",
      "value_function_height_landscape",
      "bellman_backup_wavefront",
      "bellman_reward_gamma_next_value_equation",
      "q_value_action_spokes",
      "temporal_difference_sample_transition_trail",
      "bellman_residual_convergence_bars",
      "discount_horizon_rings",
      "epsilon_slip_transition_fan",
      "step_cost_penalty_tiles",
      "mdp_state_action_reward_transition_cycle",
      "sutton_barto_value_iteration_canvas"
    ], "E11 objects");
    requireIncludes(e11.snapshot.canonicalReferences, [
      "Sutton Barto gridworld MDP",
      "Bellman expectation and optimality equations",
      "value iteration contraction",
      "temporal-difference error",
      "epsilon-greedy exploration",
      "discounted return",
      "policy induced by value function"
    ], "E11 references");
    requireIncludes(e11.snapshot.diagnosticMetrics, [
      "state_count",
      "action_count",
      "discount_gamma",
      "epsilon_slip",
      "bellman_residual",
      "value_spread",
      "policy_entropy",
      "discounted_return",
      "td_error"
    ], "E11 metrics");
    requireFiniteNumbers(e11.snapshot, [
      "bellmanResidual",
      "policyEntropy",
      "discountedReturn",
      "valueSpread",
      "explorationRate",
      "learningProgress",
      "tdError",
      "stateCount",
      "actionCount"
    ], "E11");
    [
      ["gridCellCount", 25],
      ["stateCellCount", 16],
      ["valueBarCount", 25],
      ["policyArrowCount", 16],
      ["residualBarCount", 25],
      ["qSpokeCount", 4],
      ["horizonRingCount", 4],
      ["wavefrontBeadCount", 18],
      ["slipFanCount", 3],
      ["terminalBeaconCount", 2],
      ["bellmanFormulaTermCount", 4],
      ["sampleTransitionCount", 3]
    ].forEach(([field, min]) => requireMin(e11.snapshot, field, min, "E11"));
    requireFields(e11.snapshot, [
      "gridValueLandscapeHash",
      "terminalBeaconHash",
      "bellmanWavefrontHash",
      "greedyPolicyHash",
      "residualBarsHash",
      "qCandidateHash",
      "horizonHash",
      "slipFanHash",
      "wallBarrierHash",
      "sampleTransitionHash",
      "bellmanBackupEquationHash",
      "rewardLayoutHash",
      "mdpGridHash",
      "policyArrowHash",
      "valueFunctionHash",
      "bellmanBackupHash",
      "tdLearningHash",
      "trajectoryReturnHash",
      "commandEffectHash"
    ], "E11");
    const e11Before = e11.snapshot;
    await page.locator("#worldPreset").selectOption("maze");
    await page.locator("#backupMode").selectOption("sample");
    await setRange(page, "#discount", "0.96");
    await setRange(page, "#stepCost", "-0.10");
    await setRange(page, "#slip", "0.34");
    await setRange(page, "#iterationsPerSweep", "6");
    await setRange(page, "#rewardScale", "1.45");
    await page.click("#backup");
    await page.click("#sweepBellman");
    await page.click("#policyGreedy");
    e11 = await page.evaluate(() => ({ snapshot: window.__e11LabSnapshot() }));
    requireChanged(e11Before, e11.snapshot, [
      "mdpGridHash",
      "policyArrowHash",
      "valueFunctionHash",
      "bellmanBackupHash",
      "tdLearningHash",
      "trajectoryReturnHash",
      "commandEffectHash"
    ], "E11");
    if (e11.snapshot.worldPreset !== "maze" || e11.snapshot.backupMode !== "sample" || e11.snapshot.iteration < 7 || e11.snapshot.valueSpread <= e11Before.valueSpread) {
      throw new Error(`E11 controls did not change Bellman state: ${JSON.stringify(e11.snapshot)}`);
    }
  } finally {
    await browser.close();
  }

  console.log("e10-e11 canonical clarity passed: normalizing flow and Bellman labs expose concrete textbook objects, live control consequences, and fitted iframes.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
