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

async function loadLab(page, fileName, readyName, snapshotName) {
  const labPath = path.join(__dirname, fileName).replace(/\\/g, "/");
  await page.goto(`file:///${labPath}?clarity-regression=1`);
  await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
  await page.waitForFunction(
    ([ready, snapshot]) => window[ready] === true && typeof window[snapshot] === "function" && window[snapshot](),
    [readyName, snapshotName]
  );
  await page.waitForTimeout(320);
  return page.evaluate((snapshotName) => {
    const canvas = document.querySelector(".lab-viewport canvas");
    return {
      bytes: canvas.toDataURL("image/png").length,
      snapshot: window[snapshotName](),
      overlayText: [...document.querySelectorAll("[data-visual-key], .formula-chip, [data-role='insight'], .selected-chip")]
        .map((node) => node.textContent.trim())
        .join(" | "),
      buttons: [...document.querySelectorAll("button")].map((node) => node.textContent.trim()),
      rail: [...document.querySelectorAll(".concept-rail span:not(.rail-alias)")].map((node) => node.textContent.trim()),
      railAliases: [...document.querySelectorAll(".concept-rail span.rail-alias")].map((node) => node.textContent.trim()),
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
    if (!list || !list.some((candidate) => String(candidate).toLowerCase().includes(item.toLowerCase()))) {
      throw new Error(`${lab} missing clarity marker "${item}". Found: ${(list || []).join(" | ")}`);
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

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1180, height: 700 } });
  try {
    const b06 = await loadLab(page, "b06-markov-chain-lab.html", "__b06LabReady", "__b06LabSnapshot");
    if (b06.bytes < 15000 || b06.overflowX > 18 || b06.overflowY > 18) {
      throw new Error(`B06 clarity render is weak or does not fit: ${JSON.stringify(b06)}.`);
    }
    if (b06.snapshot.clarityVersion !== "b06-b07-canonical-clarity-v2" || b06.snapshot.legacyClarityVersion !== "b06-b07-canonical-clarity-v1" || b06.snapshot.visualScaffoldCount < 30) {
      throw new Error(`B06 missing canonical stochastic-process scaffold: ${JSON.stringify(b06.snapshot)}.`);
    }
    requireIncludes(b06.snapshot.visualRoles, [
      "time indexed random variables X_t timeline",
      "finite Markov state space node",
      "transition matrix P row stochastic board",
      "row probability simplex fan",
      "current distribution vector pi_t bars",
      "next distribution pi_t P bars",
      "transition kernel weighted arrows Pij",
      "sample path beads X0 to Xt",
      "stationary distribution pi star bars",
      "stationary eigenvector pi equals pi P plate",
      "mixing total variation distance gauge",
      "spectral gap convergence dial",
      "hitting target set A gate",
      "absorbing state trap",
      "hitting time equation h_i board",
      "graph random walk degree weighted nodes",
      "Poisson arrival counting timeline",
      "exponential waiting time clocks",
      "continuous time generator Q board",
      "martingale fair game path",
      "filtration information shelves F_t",
      "empirical visit frequency bars"
    ], "B06");
    requireIncludes(b06.snapshot.clarityLabels, [
      "X_t", "S", "P_ij", "sum_j P_ij=1", "pi_t", "pi_{t+1}=pi_t P", "X_0...X_t",
      "pi*", "pi*=pi*P", "TV(pi_t,pi*)", "1-lambda2", "tau_A", "A", "absorbing", "h_i=1+sum Pij h_j",
      "d_i/sum d", "N_t", "Exp(lambda)", "Q", "d pi/dt=pi Q", "M_t", "F_t", "visits/t"
    ], "B06");
    requireIncludes(b06.rail, ["Process timeline", "Transition matrix", "Distribution update", "Sample path", "Stationary/mixing", "Hitting/Poisson"], "B06 rail");
    requireIncludes(b06.railAliases, ["states", "transition kernel", "sample path", "stationary law", "hitting time"], "B06 legacy rail");
    requireIncludes(b06.buttons, ["Apply kernel", "Advance path"], "B06 buttons");
    requireFiniteNumbers(b06.snapshot, [
      "stationaryMass", "mixingGap", "pathEntropy", "hittingChance", "rowStochasticError",
      "stationaryResidual", "totalVariationDistance", "spectralGap", "expectedHittingTime",
      "absorbingProbability", "poissonRate", "expectedArrivals", "waitingMean", "martingaleDrift",
      "empiricalStationaryError", "randomWalkDegreeBias"
    ], "B06 telemetry");
    if (!b06.snapshot.processSceneHash || !b06.snapshot.transitionMatrixHash || !b06.snapshot.mixingHash || !b06.snapshot.hittingPoissonHash || b06.snapshot.rowStochastic !== true) {
      throw new Error(`B06 should expose Markov-chain diagnostics, got: ${JSON.stringify(b06.snapshot)}.`);
    }
    const b06HashBefore = b06.snapshot.processSceneHash;
    await setRange(page, "#b06-focus", "0.78");
    await setRange(page, "#b06-samples", "13");
    await setRange(page, "#b06-strength", "0.86");
    await page.waitForTimeout(160);
    const b06After = await page.evaluate(() => window.__b06LabSnapshot());
    if (b06After.processSceneHash === b06HashBefore || b06After.expectedArrivals <= b06.snapshot.expectedArrivals || b06After.hittingChance <= b06.snapshot.hittingChance) {
      throw new Error(`B06 controls did not visibly alter stochastic-process diagnostics: ${JSON.stringify({ before: b06.snapshot, after: b06After })}.`);
    }

    const b07 = await loadLab(page, "b07-advanced-stochastic-calculus-lab.html", "__b07LabReady", "__b07LabSnapshot");
    if (b07.bytes < 15000 || b07.overflowX > 18 || b07.overflowY > 18) {
      throw new Error(`B07 clarity render is weak or does not fit: ${JSON.stringify(b07)}.`);
    }
    if (b07.snapshot.clarityVersion !== "b06-b07-canonical-clarity-v2" || b07.snapshot.legacyClarityVersion !== "b06-b07-canonical-clarity-v1" || b07.snapshot.visualScaffoldCount < 32) {
      throw new Error(`B07 missing canonical stochastic-calculus scaffold: ${JSON.stringify(b07.snapshot)}.`);
    }
    requireIncludes(b07.snapshot.visualRoles, [
      "Brownian motion W_t rough continuous path",
      "smooth ODE finite variation comparison path",
      "sqrt dt Brownian increment ruler",
      "dt deterministic increment ruler",
      "quadratic variation sum of squared increments bars",
      "Ito multiplication table dW squared equals dt plate",
      "filtration adapted information shelves F_t",
      "adapted integrand H_t step process",
      "Ito integral left endpoint rectangles",
      "Ito isometry variance energy board",
      "Stratonovich midpoint contrast rail",
      "SDE drift mu dt arrows",
      "SDE diffusion sigma dW cones",
      "Euler Maruyama step ladder",
      "Ito lemma formula board",
      "fx dX linear term strip",
      "one half sigma squared fxx correction plate",
      "infinitesimal generator L operator board",
      "Fokker Planck density flow surface",
      "Ornstein Uhlenbeck mean reversion spring",
      "geometric Brownian log correction track",
      "Langevin potential U landscape",
      "reverse diffusion score field arrows",
      "noising denoising trajectory beads"
    ], "B07");
    requireIncludes(b07.snapshot.clarityLabels, [
      "W_t", "smooth x(t)", "Delta W~sqrt(dt)Z", "Delta x~dt", "sum (Delta W)^2 -> T",
      "(dW)^2=dt", "F_t", "H_t", "int H dW", "E[(int H dW)^2]", "Stratonovich",
      "mu dt", "sigma dW", "Euler-Maruyama", "Ito lemma", "f_x dX", "1/2 sigma^2 f_xx dt",
      "L f", "Fokker-Planck", "OU", "d log X", "U(x)", "score", "reverse SDE"
    ], "B07");
    requireIncludes(b07.rail, ["Brownian scaling", "Quadratic variation", "Ito integral", "SDE step", "Ito lemma", "Reverse diffusion"], "B07 rail");
    requireIncludes(b07.railAliases, ["Brownian path", "quadratic variation", "Ito integral", "drift field", "SDE solution"], "B07 legacy rail");
    requireIncludes(b07.buttons, ["Show rough path", "Add dW"], "B07 buttons");
    requireFiniteNumbers(b07.snapshot, [
      "quadraticVariation", "itoDrift", "diffusionScale", "sdeStability", "brownianRoughness",
      "sqrtDtScale", "dtScale", "quadraticVariationError", "itoCorrection", "itoIntegralVariance",
      "driftMagnitude", "diffusionVariance", "eulerStepSize", "generatorStrength", "fokkerPlanckMassError",
      "ouMeanReversion", "gbmLogCorrection", "langevinEnergyDrop", "reverseScoreNorm", "denoisingProgress",
      "martingaleMeanError"
    ], "B07 telemetry");
    if (!b07.snapshot.stochasticCalculusSceneHash || !b07.snapshot.brownianScalingHash || !b07.snapshot.itoIntegralHash || !b07.snapshot.sdeFlowHash || !b07.snapshot.reverseDiffusionHash || b07.snapshot.quadraticVariationSurvives !== true) {
      throw new Error(`B07 should expose Brownian/Ito/SDE diagnostics, got: ${JSON.stringify(b07.snapshot)}.`);
    }
    const b07HashBefore = b07.snapshot.stochasticCalculusSceneHash;
    await setRange(page, "#b07-spread", "0.88");
    await setRange(page, "#b07-noise", "0.62");
    await setRange(page, "#b07-samples", "13");
    await page.waitForTimeout(160);
    const b07After = await page.evaluate(() => window.__b07LabSnapshot());
    if (b07After.stochasticCalculusSceneHash === b07HashBefore || b07After.quadraticVariation <= b07.snapshot.quadraticVariation || b07After.diffusionScale <= b07.snapshot.diffusionScale) {
      throw new Error(`B07 controls did not visibly alter stochastic-calculus diagnostics: ${JSON.stringify({ before: b07.snapshot, after: b07After })}.`);
    }
  } finally {
    await browser.close();
  }
  console.log("b06-b07 visual clarity passed: stochastic processes and stochastic calculus expose canonical textbook objects, fitted controls, and live diagnostics.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
