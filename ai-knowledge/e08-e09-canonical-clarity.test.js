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
const CLARITY_VERSION = "e08-e09-canonical-clarity-v2";
const LEGACY_VERSION = "e08-e09-canonical-clarity-v1";

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
  await page.mouse.move(cx + 110, cy + 45, { steps: 8 });
  await page.mouse.up();
  await page.mouse.wheel(0, -260);
  await page.waitForTimeout(120);
  const after = await page.evaluate((snapshot) => window[snapshot](), snapshotName);
  const rotated = Math.abs(after.cameraTheta - before.cameraTheta) > 0.1 || Math.abs(after.cameraPhi - before.cameraPhi) > 0.05;
  const zoomed = Math.abs(after.cameraRadius - before.cameraRadius) > 0.1;
  if (!rotated || !zoomed) {
    throw new Error(`${lab} manual orbit/zoom did not affect camera: before=${JSON.stringify(before)}, after=${JSON.stringify(after)}`);
  }
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });

  try {
    let e08 = await loadLab(page, "e08-gan-minimax-game.html", "__e08LabReady", "__e08LabSnapshot");
    requireFitted(e08, "E08");
    if (e08.bytes < 10000) {
      throw new Error(`E08 canonical clarity contract is missing: ${JSON.stringify(e08.snapshot)}`);
    }
    requireVersion(e08.snapshot, "E08");
    await requireOrbitZoom(page, "__e08LabSnapshot", "E08");
    [
      ["generatorDiscriminatorObjectCount", 8],
      ["distributionGameObjectCount", 8],
      ["minimaxLossObjectCount", 5],
      ["stabilityDiagnosticObjectCount", 7],
      ["wganObjectCount", 4]
    ].forEach(([field, min]) => requireMin(e08.snapshot, field, min, "E08"));
    requireIncludes(e08.snapshot.ganObjects, [
      "latent_noise_prior_samples",
      "generator_network_plates",
      "generated_fake_sample_distribution",
      "real_data_density_modes",
      "discriminator_probability_surface",
      "critic_score_surface_wgan",
      "optimal_discriminator_density_ratio_cells",
      "minimax_saddle_objective_board",
      "real_fake_score_histogram",
      "generator_gradient_vector_field",
      "non_saturating_gradient_boost",
      "wasserstein_distance_rail",
      "lipschitz_gradient_penalty_ring",
      "alternating_d_g_update_clock",
      "mode_collapse_funnel",
      "coverage_vs_realism_tiles",
      "fixed_noise_sample_grid_diagnostics",
      "conditional_label_channel"
    ], "E08 objects");
    requireIncludes(e08.snapshot.canonicalReferences, [
      "original GAN minimax objective",
      "optimal discriminator density ratio",
      "p_g equals p_data equilibrium",
      "non-saturating generator loss",
      "Wasserstein critic with Lipschitz constraint",
      "mode collapse coverage diagnostics",
      "alternating discriminator generator updates"
    ], "E08 references");
    requireIncludes(e08.snapshot.diagnosticMetrics, [
      "distribution_gap",
      "coverage",
      "realism",
      "critic_gap",
      "generator_gradient",
      "mode_collapse_risk",
      "update_ratio",
      "real_mode_count"
    ], "E08 metrics");
    requireFiniteNumbers(e08.snapshot, [
      "distributionGap",
      "coverage",
      "realism",
      "modeCollapseRisk",
      "criticGap",
      "generatorGradient",
      "discriminatorGeneratorBalance",
      "coverageRecall",
      "collapseSeverity",
      "wassersteinSignal",
      "gradientUsefulness",
      "updateRatioStress"
    ], "E08");
    [
      ["realSampleCount", 50],
      ["fakeSampleCount", 50],
      ["latentNoiseCount", 12],
      ["generatorPlateCount", 4],
      ["discriminatorPlateCount", 4],
      ["densityRatioCellCount", 3],
      ["minimaxLossBarCount", 4],
      ["gradientVectorCount", 14],
      ["modeCoverageCellCount", 3],
      ["wganCriticObjectCount", 3],
      ["gradientPenaltyObjectCount", 1],
      ["alternatingClockCount", 1]
    ].forEach(([field, min]) => requireMin(e08.snapshot, field, min, "E08"));
    requireFields(e08.snapshot, [
      "latentGeneratorHash",
      "realFakeDistributionHash",
      "discriminatorSurfaceHash",
      "densityRatioHash",
      "minimaxLossHash",
      "generatorGradientHash",
      "coverageDiagnosticHash",
      "collapseFunnelHash",
      "wganCriticHash",
      "updateClockHash",
      "scoreHistogramHash",
      "ganArchitectureHash",
      "distributionMatchHash",
      "discriminatorDecisionHash",
      "minimaxGameHash",
      "generatorGradientFlowHash",
      "coverageCollapseHash",
      "wganStabilityHash",
      "commandEffectHash"
    ], "E08");
    const e08Before = e08.snapshot;
    await page.locator("#dataModes").selectOption("wide");
    await page.locator("#lossMode").selectOption("wgan");
    await setRange(page, "#generatorMean", "1.6");
    await setRange(page, "#generatorSpread", "0.32");
    await setRange(page, "#discriminatorStrength", "1.85");
    await setRange(page, "#collapsePressure", "0.88");
    await setRange(page, "#criticSmoothness", "0.28");
    await setRange(page, "#updateRatio", "4");
    await page.click("#trainD");
    await page.click("#trainG");
    await page.click("#collapse");
    e08 = await page.evaluate(() => ({ snapshot: window.__e08LabSnapshot() }));
    requireChanged(e08Before, e08.snapshot, [
      "latentGeneratorHash",
      "realFakeDistributionHash",
      "discriminatorSurfaceHash",
      "densityRatioHash",
      "minimaxLossHash",
      "generatorGradientHash",
      "coverageDiagnosticHash",
      "wganCriticHash",
      "updateClockHash"
    ], "E08");
    if (e08.snapshot.lossMode !== "wgan" || e08.snapshot.generatorStep < 1 || e08.snapshot.discriminatorStep < 4 || e08.snapshot.modeCollapseRisk <= e08Before.modeCollapseRisk) {
      throw new Error(`E08 GAN controls did not change training state: ${JSON.stringify(e08.snapshot)}`);
    }

    let e09 = await loadLab(page, "e09-diffusion-denoising.html", "__e09LabReady", "__e09LabSnapshot");
    requireFitted(e09, "E09");
    if (e09.bytes < 10000) {
      throw new Error(`E09 canonical clarity contract is missing: ${JSON.stringify(e09.snapshot)}`);
    }
    requireVersion(e09.snapshot, "E09");
    await requireOrbitZoom(page, "__e09LabSnapshot", "E09");
    [
      ["forwardProcessObjectCount", 6],
      ["reverseDenoisingObjectCount", 8],
      ["scoreGuidanceObjectCount", 7],
      ["denoiserArchitectureObjectCount", 7],
      ["samplerDiagnosticObjectCount", 5]
    ].forEach(([field, min]) => requireMin(e09.snapshot, field, min, "E09"));
    requireIncludes(e09.snapshot.diffusionObjects, [
      "clean_data_manifold_mode_islands",
      "forward_noising_markov_ladder",
      "beta_noise_schedule_rail",
      "alpha_bar_coefficient_board",
      "x_t_signal_noise_mixture_bead",
      "epsilon_noise_target_ruler",
      "unet_denoiser_timestep_condition_plates",
      "score_vector_field_arrows",
      "predicted_epsilon_theta_bead",
      "predicted_x0_bridge",
      "reverse_denoising_trajectory_beads",
      "ddpm_stochastic_noise_cloud",
      "ddim_deterministic_shortcut_path",
      "solver_sampler_path_tiles",
      "classifier_free_guidance_magnet",
      "condition_embedding_line",
      "signal_to_noise_gauge",
      "training_loop_x0_xt_epsilon",
      "sampler_step_size_stability_gauge",
      "latent_diffusion_space_hint"
    ], "E09 objects");
    requireIncludes(e09.snapshot.canonicalReferences, [
      "fixed Gaussian forward process q(x_t|x_t-1)",
      "closed form x_t signal plus epsilon noise",
      "noise prediction objective",
      "score field as gradient of log density",
      "reverse denoising Markov chain",
      "DDPM DDIM solver sampler tradeoff",
      "classifier-free guidance tradeoff"
    ], "E09 references");
    requireIncludes(e09.snapshot.diagnosticMetrics, [
      "schedule_beta",
      "signal_to_noise",
      "score_magnitude",
      "predicted_noise",
      "reverse_error",
      "guidance_scale",
      "timestep",
      "denoise_step"
    ], "E09 metrics");
    requireFiniteNumbers(e09.snapshot, [
      "scheduleProgress",
      "scheduleBeta",
      "signalToNoise",
      "scoreMagnitude",
      "predictedNoise",
      "reverseError",
      "alphaBarSignalCoefficient",
      "noiseCoefficient",
      "guidancePull",
      "samplerStabilityScore",
      "reverseStepProgress",
      "denoisingDifficulty"
    ], "E09");
    [
      ["cleanSampleCount", 60],
      ["noisySampleCount", 72],
      ["forwardLadderCount", 3],
      ["scheduleBarCount", 14],
      ["scoreVectorCount", 20],
      ["reverseTrajectoryPointCount", 14],
      ["ddpmNoiseObjectCount", 32],
      ["coefficientBoardCount", 3],
      ["epsilonResidualObjectCount", 3],
      ["unetPlateCount", 7],
      ["guidanceObjectCount", 1],
      ["samplerComparisonCount", 3]
    ].forEach(([field, min]) => requireMin(e09.snapshot, field, min, "E09"));
    requireFields(e09.snapshot, [
      "forwardNoisingHash",
      "scheduleRailHash",
      "scoreFieldHash",
      "reversePathHash",
      "epsilonPredictionHash",
      "coefficientBoardHash",
      "unetDenoiserHash",
      "guidanceHash",
      "samplerHash",
      "manifoldHash",
      "diffusionArchitectureHash",
      "forwardNoisingProcessHash",
      "scoreGuidanceFieldHash",
      "reverseDenoisingPathHash",
      "epsilonPredictionFlowHash",
      "coefficientScheduleHash",
      "samplerTrajectoryHash",
      "commandEffectHash"
    ], "E09");
    const e09Before = e09.snapshot;
    await page.locator("#schedule").selectOption("cosine");
    await page.locator("#sampler").selectOption("solver");
    await setRange(page, "#timestep", "78");
    await setRange(page, "#noiseLevel", "0.86");
    await setRange(page, "#guidanceScale", "3.1");
    await setRange(page, "#stepSize", "0.72");
    await setRange(page, "#stepCount", "54");
    await setRange(page, "#conditionStrength", "0.84");
    await page.click("#noiseForward");
    await page.click("#denoiseStep");
    await page.click("#runReverse");
    e09 = await page.evaluate(() => ({ snapshot: window.__e09LabSnapshot() }));
    requireChanged(e09Before, e09.snapshot, [
      "forwardNoisingHash",
      "scheduleRailHash",
      "scoreFieldHash",
      "reversePathHash",
      "epsilonPredictionHash",
      "coefficientBoardHash",
      "unetDenoiserHash",
      "guidanceHash",
      "samplerHash"
    ], "E09");
    if (e09.snapshot.schedule !== "cosine" || e09.snapshot.sampler !== "solver" || e09.snapshot.denoiseStep < 2 || e09.snapshot.signalToNoise >= e09Before.signalToNoise) {
      throw new Error(`E09 diffusion controls did not change denoising state: ${JSON.stringify(e09.snapshot)}`);
    }
  } finally {
    await browser.close();
  }

  console.log("e08-e09 canonical clarity passed: GAN and diffusion labs expose concrete textbook objects, live control consequences, and fitted iframes.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
