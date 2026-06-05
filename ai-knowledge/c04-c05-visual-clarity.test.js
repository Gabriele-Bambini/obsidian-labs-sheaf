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
      // Try the next bundled runtime location.
    }
  }
  throw new Error(`Unable to load Playwright from: ${candidates.join(", ")}`);
}

const { chromium } = loadPlaywright();

async function loadLab(page, fileName, readyName, snapshotName) {
  const labPath = path.join(__dirname, fileName).replace(/\\/g, "/");
  await page.goto(`file:///${labPath}?clarity-regression=c04-c05`);
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
    const c04 = await loadLab(page, "c04-stochastic-optimization-lab.html", "__c04LabReady", "__c04LabSnapshot");
    if (c04.bytes < 15000 || c04.overflowX > 18 || c04.overflowY > 18) {
      throw new Error(`C04 clarity render is weak or does not fit: ${JSON.stringify(c04)}.`);
    }
    if (c04.snapshot.clarityVersion !== "c04-c05-canonical-clarity-v2" || c04.snapshot.legacyClarityVersion !== "c04-c05-canonical-clarity-v1" || c04.snapshot.visualScaffoldCount < 56) {
      throw new Error(`C04 missing canonical stochastic-optimization scaffold: ${JSON.stringify(c04.snapshot)}.`);
    }
    requireIncludes(c04.snapshot.visualRoles, [
      "noisy quadratic optimizer loss surface",
      "full gradient arrow on loss surface",
      "per-example stochastic gradient fan",
      "minibatch mean gradient arrow",
      "noise covariance ellipse shrinks with batch size",
      "finite-sum empirical risk dataset tiles L(theta)=1/N sum_i ell_i",
      "unbiased estimator expectation balance E[g_k]=grad L",
      "variance scales as sigma squared over batch gauge",
      "learning-rate schedule rail alpha_k",
      "momentum velocity vector",
      "Adam first moment m_k accumulator",
      "Adam second moment s_k denominator tank",
      "Adam bias correction board",
      "AdamW decoupled weight decay shrink rail",
      "SVRG snapshot full-gradient anchor",
      "SVRG control variate corrected gradient arrow",
      "Polyak Ruppert iterate averaging cloud",
      "gradient clipping gate"
    ], "C04");
    requireIncludes(c04.snapshot.clarityLabels, [
      "L(theta)=1/N sum ell_i", "g_k", "E[g_k]=grad L", "Var(g_k)~sigma^2/b",
      "alpha_k", "m_k", "s_k", "bias correction", "AdamW", "SVRG", "SWA", "clip"
    ], "C04 labels");
    requireIncludes(c04.rail, ["Finite-sum loss", "Unbiased minibatch", "Variance / batch", "Momentum memory", "Adam / AdamW", "Variance reduction"], "C04 rail");
    requireIncludes(c04.railAliases, ["loss surface", "gradient fan", "minibatch mean", "update vector", "Adam scale"], "C04 legacy rail");
    await page.selectOption("[data-control='mode']", "reduction");
    await page.waitForTimeout(90);
    requireIncludes(await page.evaluate(() => [...document.querySelectorAll("button")].map((node) => node.textContent.trim())), ["Refresh snapshot"], "C04 reduction buttons");
    await page.selectOption("[data-control='mode']", "adam");
    await page.waitForTimeout(90);
    requireIncludes(await page.evaluate(() => [...document.querySelectorAll("button")].map((node) => node.textContent.trim())), ["Adaptive step"], "C04 Adam buttons");
    requireFiniteNumbers(c04.snapshot, [
      "gradientVariance", "updateNorm", "gradientAngleError", "batchCoverage", "unbiasednessError",
      "varianceReductionRatio", "learningRate", "momentumEnergy", "adamScaleX", "adamScaleZ",
      "biasCorrection", "weightDecayShrink", "svrgVariance", "averagingRadius", "clipFraction"
    ], "C04 telemetry");
    if (!c04.snapshot.stochasticSceneHash || !c04.snapshot.minibatchEstimatorHash || !c04.snapshot.adamMechanismHash || !c04.snapshot.varianceReductionHash) {
      throw new Error(`C04 should expose stochastic diagnostics, got: ${JSON.stringify(c04.snapshot)}.`);
    }
    const c04HashBefore = c04.snapshot.stochasticSceneHash;
    await setRange(page, "#c04-noise", "0.78");
    await setRange(page, "#c04-budget", "12");
    await setRange(page, "#c04-step", "0.74");
    await setRange(page, "#c04-regularization", "0.82");
    await page.waitForTimeout(180);
    const c04After = await page.evaluate(() => window.__c04LabSnapshot());
    if (c04After.stochasticSceneHash === c04HashBefore || c04After.updateNorm <= c04.snapshot.updateNorm || c04After.batchCoverage <= c04.snapshot.batchCoverage) {
      throw new Error(`C04 controls did not alter stochastic diagnostics: ${JSON.stringify({ before: c04.snapshot, after: c04After })}.`);
    }

    const c05 = await loadLab(page, "c05-euler-lagrange-action-lab.html", "__c05LabReady", "__c05LabSnapshot");
    if (c05.bytes < 15000 || c05.overflowX > 18 || c05.overflowY > 18) {
      throw new Error(`C05 clarity render is weak or does not fit: ${JSON.stringify(c05)}.`);
    }
    if (c05.snapshot.clarityVersion !== "c04-c05-canonical-clarity-v2" || c05.snapshot.legacyClarityVersion !== "c04-c05-canonical-clarity-v1" || c05.snapshot.visualScaffoldCount < 58) {
      throw new Error(`C05 missing canonical calculus-of-variations scaffold: ${JSON.stringify(c05.snapshot)}.`);
    }
    requireIncludes(c05.snapshot.visualRoles, [
      "function-space curve runway",
      "candidate admissible curve y(x)",
      "stationary Euler-Lagrange target curve",
      "admissible variation eta zero at endpoints",
      "perturbed curve y plus epsilon eta",
      "functional action integral quadrature columns",
      "local Lagrangian density L(x,y,yprime) sheet",
      "integration by parts boundary bracket",
      "Euler-Lagrange residual coefficient bracket",
      "fundamental lemma test-function weight sheet",
      "shortest-path straight-line extremal panel",
      "Dirichlet energy membrane with Laplace residual grid",
      "natural boundary free-endpoint gate",
      "isoperimetric multiplier constraint ring",
      "brachistochrone cycloid bead time track",
      "Beltrami conserved quantity gauge",
      "PINN collocation residual sample points"
    ], "C05");
    requireIncludes(c05.snapshot.clarityLabels, [
      "y(x)", "eta(x)", "y+epsilon eta", "J[y]", "L(x,y,y')",
      "d/dx partial L/partial y'", "partial L/partial y", "EL=0",
      "boundary term", "eta(a)=eta(b)=0", "Delta u=0", "Beltrami", "lambda(K-c)", "collocation"
    ], "C05 labels");
    requireIncludes(c05.rail, ["Function y", "Admissible variation", "Action integral", "Euler-Lagrange", "Boundary terms", "PDE / mechanics"], "C05 rail");
    requireIncludes(c05.railAliases, ["function space", "variation eta", "action density", "Euler residual", "boundary term"], "C05 legacy rail");
    await page.selectOption("[data-control='mode']", "dirichlet");
    await page.waitForTimeout(90);
    requireIncludes(await page.evaluate(() => [...document.querySelectorAll("button")].map((node) => node.textContent.trim())), ["Relax Laplace"], "C05 Dirichlet buttons");
    await page.selectOption("[data-control='mode']", "brachistochrone");
    await page.waitForTimeout(90);
    requireIncludes(await page.evaluate(() => [...document.querySelectorAll("button")].map((node) => node.textContent.trim())), ["Slide bead"], "C05 brachistochrone buttons");
    requireFiniteNumbers(c05.snapshot, [
      "actionValue", "eulerResidual", "boundaryDefect", "firstVariation", "epsilon",
      "quadratureSamples", "densityIntegral", "endpointError", "naturalBoundaryResidual",
      "dirichletEnergy", "laplaceResidual", "beltramiDrift", "constraintResidual", "pinnSamplingGap"
    ], "C05 telemetry");
    if (!c05.snapshot.variationalSceneHash || !c05.snapshot.eulerLagrangeHash || !c05.snapshot.boundaryTermHash || !c05.snapshot.dirichletBrachistochroneHash) {
      throw new Error(`C05 should expose variational diagnostics, got: ${JSON.stringify(c05.snapshot)}.`);
    }
    const c05HashBefore = c05.snapshot.variationalSceneHash;
    await setRange(page, "#c05-noise", "0.76");
    await setRange(page, "#c05-budget", "13");
    await setRange(page, "#c05-step", "0.7");
    await setRange(page, "#c05-regularization", "0.82");
    await page.waitForTimeout(180);
    const c05After = await page.evaluate(() => window.__c05LabSnapshot());
    if (c05After.variationalSceneHash === c05HashBefore || c05After.quadratureSamples <= c05.snapshot.quadratureSamples || c05After.epsilon <= c05.snapshot.epsilon) {
      throw new Error(`C05 controls did not alter variational diagnostics: ${JSON.stringify({ before: c05.snapshot, after: c05After })}.`);
    }
  } finally {
    await browser.close();
  }
  console.log("c04-c05 visual clarity passed: stochastic optimization and calculus of variations expose canonical textbook objects, fitted controls, and live diagnostics.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
