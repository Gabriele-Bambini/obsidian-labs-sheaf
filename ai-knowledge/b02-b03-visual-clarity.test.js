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
  const locator = page.locator(selector);
  await locator.evaluate((input, nextValue) => {
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
    const b02 = await loadLab(page, "b02-multivariate-probability-lab.html", "__b02LabReady", "__b02LabSnapshot");
    if (b02.bytes < 15000 || b02.overflowX > 18 || b02.overflowY > 18) {
      throw new Error(`B02 clarity render is weak or does not fit: ${JSON.stringify(b02)}.`);
    }
    if (b02.snapshot.clarityVersion !== "b02-b03-canonical-clarity-v2" || b02.snapshot.legacyClarityVersion !== "b02-b03-canonical-clarity-v1" || b02.snapshot.visualScaffoldCount < 24) {
      throw new Error(`B02 missing canonical multivariate-probability scaffold: ${JSON.stringify(b02.snapshot)}.`);
    }
    requireIncludes(b02.snapshot.visualRoles, [
      "joint density surface grid fXY",
      "joint probability mass table cells",
      "x marginal projection histogram",
      "y marginal projection histogram",
      "marginalization integrate-out arrows",
      "conditional slice plane X=x0",
      "conditional density curve Y given X",
      "conditional mean shift marker",
      "conditional variance shrink band",
      "covariance matrix Sigma board",
      "covariance ellipse Gaussian law",
      "principal eigenvector axis",
      "minor eigenvector axis",
      "Mahalanobis distance contour",
      "mean vector mu marker",
      "correlation tilt hinge",
      "independence product grid pX pY",
      "chain rule factorization beam",
      "Gaussian ellipsoid volume determinant",
      "linear transform covariance pushforward",
      "integration region probability patch"
    ], "B02");
    requireIncludes(b02.snapshot.clarityLabels, [
      "f_XY(x,y)",
      "p(x,y)",
      "p_X(x)",
      "p_Y(y)",
      "sum_y",
      "int dy",
      "X=x0",
      "p(Y|X=x0)",
      "E[Y|X]",
      "Var(Y|X)",
      "Sigma",
      "rho",
      "mu",
      "lambda1",
      "lambda2",
      "Mahalanobis",
      "p_X p_Y",
      "p(x,y)=p(y|x)p(x)",
      "|Sigma|",
      "A Sigma A^T"
    ], "B02");
    requireIncludes(b02.rail, ["Joint density", "Marginal projections", "Conditional slice", "Covariance geometry", "Gaussian ellipsoid", "Dependence test"], "B02 rail");
    requireIncludes(b02.railAliases, ["joint density", "marginals", "conditioning slice", "covariance ellipse", "Gaussian law"], "B02 legacy rail");
    requireIncludes(b02.buttons, ["Show joint mass", "Project axes"], "B02 buttons");
    requireFiniteNumbers(b02.snapshot, [
      "correlation",
      "marginalSpread",
      "conditionalShift",
      "tailMass",
      "determinantSigma",
      "sigmaXX",
      "sigmaYY",
      "sigmaXY",
      "eigenvalueMajor",
      "eigenvalueMinor",
      "conditionalMean",
      "conditionalVariance",
      "mahalanobisRadius",
      "independenceGap",
      "marginalMassError",
      "gaussianVolume"
    ], "B02 telemetry");
    if (!b02.snapshot.jointSceneHash || !b02.snapshot.marginalizationHash || !b02.snapshot.conditionalGaussianHash || !b02.snapshot.covarianceGeometryHash || b02.snapshot.covariancePsd !== true) {
      throw new Error(`B02 should expose joint/marginal/conditional/covariance diagnostics, got: ${JSON.stringify(b02.snapshot)}.`);
    }
    const b02HashBefore = b02.snapshot.jointSceneHash;
    await setRange(page, "#b02-focus", "0.78");
    await setRange(page, "#b02-spread", "0.33");
    await setRange(page, "#b02-strength", "0.88");
    await page.waitForTimeout(160);
    const b02After = await page.evaluate(() => window.__b02LabSnapshot());
    if (b02After.jointSceneHash === b02HashBefore || Math.abs(b02After.correlation) <= Math.abs(b02.snapshot.correlation)) {
      throw new Error(`B02 controls did not visibly alter diagnostics: ${JSON.stringify({ before: b02.snapshot, after: b02After })}.`);
    }

    const b03 = await loadLab(page, "b03-estimator-likelihood-lab.html", "__b03LabReady", "__b03LabSnapshot");
    if (b03.bytes < 15000 || b03.overflowX > 18 || b03.overflowY > 18) {
      throw new Error(`B03 clarity render is weak or does not fit: ${JSON.stringify(b03)}.`);
    }
    if (b03.snapshot.clarityVersion !== "b02-b03-canonical-clarity-v2" || b03.snapshot.legacyClarityVersion !== "b02-b03-canonical-clarity-v1" || b03.snapshot.visualScaffoldCount < 26) {
      throw new Error(`B03 missing canonical estimation scaffold: ${JSON.stringify(b03.snapshot)}.`);
    }
    requireIncludes(b03.snapshot.visualRoles, [
      "observed sample x1 to xn rug",
      "Bernoulli sufficient statistic k successes",
      "parameter axis theta",
      "likelihood curve L(theta)",
      "log likelihood additive term stack",
      "MLE theta hat marker",
      "score derivative zero crossing",
      "MAP prior penalty curve",
      "Beta prior pseudo-count tanks",
      "posterior mode marker",
      "estimator function T of sample board",
      "sampling distribution of estimator cloud",
      "true parameter theta0 marker",
      "bias vector E theta_hat minus theta0",
      "variance spread ring",
      "MSE decomposition board",
      "standard error ruler",
      "confidence interval band",
      "Fisher information curvature bowl",
      "identifiability flat ridge",
      "model misspecification warning plate",
      "bootstrap resample beads",
      "outlier influence lever"
    ], "B03");
    requireIncludes(b03.snapshot.clarityLabels, [
      "x_1:n",
      "k/n",
      "theta",
      "L(theta)",
      "ell(theta)",
      "theta_hat_MLE",
      "dell/dtheta=0",
      "MAP",
      "Beta(alpha,beta)",
      "posterior",
      "T(X)",
      "sampling dist.",
      "theta0",
      "Bias",
      "Var",
      "MSE=Bias^2+Var",
      "SE",
      "95% CI",
      "I(theta)",
      "identifiable?",
      "misspecified",
      "bootstrap",
      "outlier"
    ], "B03");
    requireIncludes(b03.rail, ["Data -> estimator", "Likelihood surface", "MLE/MAP", "Sampling distribution", "Bias-variance-MSE", "Uncertainty diagnostics"], "B03 rail");
    requireIncludes(b03.railAliases, ["data cloud", "likelihood curve", "MLE marker", "sampling spread", "bias-variance"], "B03 legacy rail");
    requireIncludes(b03.buttons, ["Scan theta", "Move likelihood"], "B03 buttons");
    requireFiniteNumbers(b03.snapshot, [
      "likelihoodPeak",
      "estimatorBias",
      "variance",
      "ciWidth",
      "mleTheta",
      "mapTheta",
      "trueTheta",
      "scoreAtMle",
      "fisherInformation",
      "standardError",
      "mse",
      "biasSquared",
      "bootstrapSpread",
      "identifiabilityScore",
      "misspecificationRisk",
      "outlierInfluence"
    ], "B03 telemetry");
    if (!b03.snapshot.estimationSceneHash || !b03.snapshot.likelihoodHash || !b03.snapshot.samplingDistributionHash || !b03.snapshot.uncertaintyHash || b03.snapshot.scoreZeroAtMle !== true) {
      throw new Error(`B03 should expose likelihood/estimation diagnostics, got: ${JSON.stringify(b03.snapshot)}.`);
    }
    const b03HashBefore = b03.snapshot.estimationSceneHash;
    await setRange(page, "#b03-focus", "0.72");
    await setRange(page, "#b03-samples", "12");
    await setRange(page, "#b03-strength", "0.82");
    await page.waitForTimeout(160);
    const b03After = await page.evaluate(() => window.__b03LabSnapshot());
    if (b03After.estimationSceneHash === b03HashBefore || b03After.standardError >= b03.snapshot.standardError) {
      throw new Error(`B03 controls did not visibly alter diagnostics: ${JSON.stringify({ before: b03.snapshot, after: b03After })}.`);
    }
  } finally {
    await browser.close();
  }
  console.log("b02-b03 visual clarity passed: multivariate probability and estimation labs expose canonical textbook objects, fitted controls, and live diagnostics.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
