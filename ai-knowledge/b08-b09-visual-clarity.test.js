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
    const b08 = await loadLab(page, "b08-information-geometry-lab.html", "__b08LabReady", "__b08LabSnapshot");
    if (b08.bytes < 15000 || b08.overflowX > 18 || b08.overflowY > 18) {
      throw new Error(`B08 clarity render is weak or does not fit: ${JSON.stringify(b08)}.`);
    }
    if (b08.snapshot.clarityVersion !== "b08-b09-canonical-clarity-v2" || b08.snapshot.legacyClarityVersion !== "b08-b09-canonical-clarity-v1" || b08.snapshot.visualScaffoldCount < 34) {
      throw new Error(`B08 missing canonical information-geometry scaffold: ${JSON.stringify(b08.snapshot)}.`);
    }
    requireIncludes(b08.snapshot.visualRoles, [
      "statistical manifold surface of distributions p_theta",
      "coordinate chart theta grid",
      "distribution point p_theta bead",
      "probability simplex distribution towers",
      "score function centered bars s_i",
      "Fisher information matrix Iij board",
      "Fisher metric local ellipse unit ball",
      "KL quadratic neighborhood contours",
      "line element ds squared ruler",
      "reparameterization chart p to eta bridge",
      "Jacobian transform J transpose I J plate",
      "Bernoulli boundary Fisher stretch rail",
      "Jeffreys prior sqrt det I density",
      "Euclidean gradient arrow",
      "natural gradient I inverse grad arrow",
      "KL trust region ball",
      "geodesic on statistical manifold",
      "coordinate chord comparison",
      "exponential family natural coordinate theta rail",
      "mean parameter mu dual rail",
      "Legendre dual potential bridge",
      "forward KL projection panel",
      "reverse KL mode seeking panel",
      "Fisher spectrum eigenvalue bars",
      "sloppy null direction sheet",
      "normal family scale sigma wall"
    ], "B08");
    requireIncludes(b08.snapshot.clarityLabels, [
      "p_theta", "theta", "dtheta", "s_i", "E[s_i]=0", "I_ij=E[s_i s_j]", "ds^2=dtheta^T I dtheta",
      "D_KL~1/2 dtheta^T I dtheta", "p", "eta=log(p/(1-p))", "J", "I_phi=J^T I_theta J",
      "I(p)=1/[p(1-p)]", "sqrt(det I)", "pi_J", "grad L", "I^-1 grad L", "KL<=epsilon",
      "geodesic", "chord", "theta natural", "mu=E[T]", "A(theta)", "D_KL(p||q)", "D_KL(q||p)",
      "lambda_i", "near-null", "sigma"
    ], "B08");
    requireIncludes(b08.rail, ["Statistical manifold", "Fisher metric", "KL microscope", "Reparameterization", "Natural gradient", "Projections/priors"], "B08 rail");
    requireIncludes(b08.railAliases, ["statistical manifold", "Fisher metric", "KL neighborhood", "geodesic", "natural gradient"], "B08 legacy rail");
    await page.selectOption("[data-control='mode']", "fisher");
    await page.waitForTimeout(80);
    const b08FisherButtons = await page.evaluate(() => [...document.querySelectorAll("button")].map((node) => node.textContent.trim()));
    requireIncludes(b08FisherButtons, ["Show Fisher unit ball"], "B08 Fisher buttons");
    await page.selectOption("[data-control='mode']", "natural");
    await page.waitForTimeout(80);
    const b08NaturalButtons = await page.evaluate(() => [...document.querySelectorAll("button")].map((node) => node.textContent.trim()));
    requireIncludes(b08NaturalButtons, ["Take natural step"], "B08 natural buttons");
    requireFiniteNumbers(b08.snapshot, [
      "fisherLength", "klProjection", "geodesicGap", "curvature", "fisherMatrixCondition",
      "localKlQuadratic", "reparameterizationInvariantError", "jeffreysPriorMass", "naturalGradientGain",
      "euclideanGradientNorm", "trustRegionRadius", "geodesicLength", "chordLength", "forwardReverseKlGap",
      "fisherSpectrumMin", "fisherSpectrumMax", "sloppyDirectionStrength", "bernoulliBoundaryStretch",
      "normalScaleVolume"
    ], "B08 telemetry");
    if (!b08.snapshot.informationGeometryHash || !b08.snapshot.fisherMetricHash || !b08.snapshot.naturalGradientHash || !b08.snapshot.klProjectionHash || b08.snapshot.coordinateInvariant !== true) {
      throw new Error(`B08 should expose information-geometric diagnostics, got: ${JSON.stringify(b08.snapshot)}.`);
    }
    const b08HashBefore = b08.snapshot.informationGeometryHash;
    await setRange(page, "#b08-focus", "0.78");
    await setRange(page, "#b08-strength", "0.86");
    await setRange(page, "#b08-spread", "0.34");
    await page.waitForTimeout(180);
    const b08After = await page.evaluate(() => window.__b08LabSnapshot());
    if (b08After.informationGeometryHash === b08HashBefore || b08After.fisherLength <= b08.snapshot.fisherLength || b08After.naturalGradientGain <= b08.snapshot.naturalGradientGain) {
      throw new Error(`B08 controls did not alter information-geometry diagnostics: ${JSON.stringify({ before: b08.snapshot, after: b08After })}.`);
    }

    const b09 = await loadLab(page, "b09-nonparametric-statistics-lab.html", "__b09LabReady", "__b09LabSnapshot");
    if (b09.bytes < 15000 || b09.overflowX > 18 || b09.overflowY > 18) {
      throw new Error(`B09 clarity render is weak or does not fit: ${JSON.stringify(b09)}.`);
    }
    if (b09.snapshot.clarityVersion !== "b08-b09-canonical-clarity-v2" || b09.snapshot.legacyClarityVersion !== "b08-b09-canonical-clarity-v1" || b09.snapshot.visualScaffoldCount < 36) {
      throw new Error(`B09 missing canonical nonparametric scaffold: ${JSON.stringify(b09.snapshot)}.`);
    }
    requireIncludes(b09.snapshot.visualRoles, [
      "data sample rug observations x_i",
      "histogram bins width h",
      "bin origin shift ghost bins",
      "kernel bump centered on each sample",
      "KDE summed density curve f_hat_h",
      "bandwidth ruler h",
      "undersmoothing spike lane",
      "oversmoothing merged mode lane",
      "bimodal valley preservation marker",
      "local window count n h to d meter",
      "curse of dimensionality sparse cube",
      "Nadaraya Watson query point x star",
      "kernel weight spokes K distance over h",
      "local weighted average prediction m_hat",
      "local polynomial boundary line",
      "smoothing spline roughness penalty beam",
      "spline knot basis functions",
      "Gaussian process prior function samples",
      "GP covariance matrix K board",
      "GP posterior mean curve",
      "GP uncertainty band shrinks near data",
      "kernel lengthscale ell ruler",
      "k nearest neighbor adaptive radius dense",
      "k nearest neighbor adaptive radius sparse",
      "Dirichlet process restaurant tables",
      "new cluster probability alpha over n alpha",
      "occupied cluster growth bars",
      "infinite mixture atom sticks",
      "cross validation smoothing curve",
      "bias variance tradeoff balance"
    ], "B09");
    requireIncludes(b09.snapshot.clarityLabels, [
      "x_i", "bins h", "origin", "K((x-x_i)/h)", "f_hat_h", "h", "too small h", "too large h",
      "valley", "n h^d", "d up", "x*", "w_i(x*)", "m_hat(x)", "local linear",
      "lambda int(f'')^2", "basis knots", "f~GP(m,k)", "K_ij", "mu_*", "sigma_*^2", "ell",
      "kNN dense", "kNN sparse", "DP(alpha,G0)", "alpha/(n+alpha)", "K_n~alpha log n",
      "stick weights", "CV(h)", "bias/variance"
    ], "B09");
    requireIncludes(b09.rail, ["Data anchors", "Density smoothing", "Kernel regression", "Spline/GP uncertainty", "kNN/DP growth", "Diagnostics"], "B09 rail");
    requireIncludes(b09.railAliases, ["sample rug", "kernel bumps", "KDE curve", "bootstrap cloud", "adaptive smoother"], "B09 legacy rail");
    requireIncludes(b09.buttons, ["Pulse kernels"], "B09 KDE buttons");
    await page.selectOption("[data-control='mode']", "bootstrap");
    await page.waitForTimeout(80);
    const b09BootstrapButtons = await page.evaluate(() => [...document.querySelectorAll("button")].map((node) => node.textContent.trim()));
    requireIncludes(b09BootstrapButtons, ["Resample bootstrap"], "B09 bootstrap buttons");
    requireFiniteNumbers(b09.snapshot, [
      "bandwidth", "bootstrapSpread", "edfGap", "smoothRisk", "kdeBandwidth",
      "effectiveDegreesFreedom", "modeCountEstimate", "valleyDepth", "localSampleCount",
      "curseDimensionalityPressure", "kernelWeightEntropy", "nadarayaWatsonPrediction",
      "splineRoughness", "gpPosteriorVariance", "gpLengthscale", "knnDenseRadius",
      "knnSparseRadius", "dpNewClusterProbability", "occupiedClusterEstimate",
      "crossValidationRisk", "biasVarianceBalance"
    ], "B09 telemetry");
    if (!b09.snapshot.nonparametricSceneHash || !b09.snapshot.kdeHash || !b09.snapshot.regressionHash || !b09.snapshot.gpDpHash || b09.snapshot.bandwidthControlsModes !== true) {
      throw new Error(`B09 should expose nonparametric diagnostics, got: ${JSON.stringify(b09.snapshot)}.`);
    }
    const b09HashBefore = b09.snapshot.nonparametricSceneHash;
    await setRange(page, "#b09-spread", "0.88");
    await setRange(page, "#b09-samples", "13");
    await setRange(page, "#b09-strength", "0.74");
    await page.waitForTimeout(180);
    const b09After = await page.evaluate(() => window.__b09LabSnapshot());
    if (b09After.nonparametricSceneHash === b09HashBefore || b09After.kdeBandwidth <= b09.snapshot.kdeBandwidth || b09After.localSampleCount <= b09.snapshot.localSampleCount) {
      throw new Error(`B09 controls did not alter nonparametric diagnostics: ${JSON.stringify({ before: b09.snapshot, after: b09After })}.`);
    }
  } finally {
    await browser.close();
  }
  console.log("b08-b09 visual clarity passed: information geometry and non-parametric statistics expose canonical textbook objects, fitted controls, and live diagnostics.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
