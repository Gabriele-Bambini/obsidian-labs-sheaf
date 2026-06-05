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
  await page.goto(`file:///${labPath}?clarity-regression=c08-c09`);
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
    const c08 = await loadLab(page, "c08-proximal-methods-lab.html", "__c08LabReady", "__c08LabSnapshot");
    if (c08.bytes < 15000 || c08.overflowX > 18 || c08.overflowY > 18) {
      throw new Error(`C08 clarity render is weak or does not fit: ${JSON.stringify(c08)}.`);
    }
    if (c08.snapshot.clarityVersion !== "c08-c09-canonical-clarity-v2" || c08.snapshot.legacyClarityVersion !== "c08-c09-canonical-clarity-v1" || c08.snapshot.visualScaffoldCount < 70) {
      throw new Error(`C08 missing canonical proximal scaffold: ${JSON.stringify(c08.snapshot)}.`);
    }
    requireIncludes(c08.snapshot.visualRoles, [
      "smooth least-squares bowl g(x)=1/2||Ax-b||^2",
      "L1 absolute-value cusp lambda||x||1",
      "forward gradient proposal v=x-alpha grad g",
      "proximal subproblem bowl plus nonsmooth corner",
      "quadratic pull tether from v to prox",
      "proximal optimality inclusion board",
      "subgradient arrow (v-x+)/alpha in partial h(x+)",
      "Moreau envelope smooth surface",
      "Moreau gradient vector grad M=(v-prox)/alpha",
      "Moreau decomposition primal dual split",
      "soft-threshold deadzone slab",
      "coefficient vector before after shrinkage bars",
      "support mask active zero coordinates",
      "ISTA proximal-gradient trajectory bead",
      "FISTA extrapolation momentum arc",
      "stepsize safety wall alpha<=1/L",
      "prox gradient mapping residual ring",
      "box projection clipping rails",
      "simplex projection probability tray",
      "group lasso block shrink disks",
      "nuclear norm singular value threshold rack",
      "TV denoising edge-preserving stair strip",
      "ADMM x-update ridge solve board",
      "ADMM z-update soft-threshold board",
      "ADMM dual u accumulator",
      "ADMM primal and dual residual meters",
      "rho residual balance scale",
      "consensus constraint x=z bridge"
    ], "C08");
    requireIncludes(c08.snapshot.clarityLabels, [
      "prox_{alpha h}(v)", "v", "x+", "h(x)", "1/(2alpha)||x-v||^2", "0 in partial h(x+)+(x+-v)/alpha",
      "G_alpha(x)", "M_alpha h", "grad M=(v-prox)/alpha", "S_{alpha lambda}", "support",
      "ISTA", "FISTA", "alpha<=1/L", "Pi_C", "simplex", "SVT", "ADMM", "r_k", "s_k", "rho"
    ], "C08 labels");
    requireIncludes(c08.rail, ["Composite objective", "Prox subproblem", "Soft threshold", "Moreau envelope", "ISTA/FISTA", "ADMM residuals"], "C08 rail");
    requireIncludes(c08.railAliases, ["point v", "quadratic tether", "prox output", "deadzone", "ADMM residual"], "C08 legacy rail");
    await page.selectOption("[data-control='mode']", "projection");
    await page.waitForTimeout(90);
    requireIncludes(await page.evaluate(() => [...document.querySelectorAll("button")].map((node) => node.textContent.trim())), ["Project onto C"], "C08 projection buttons");
    await page.selectOption("[data-control='mode']", "fista");
    await page.waitForTimeout(90);
    requireIncludes(await page.evaluate(() => [...document.querySelectorAll("button")].map((node) => node.textContent.trim())), ["FISTA restart"], "C08 FISTA buttons");
    requireFiniteNumbers(c08.snapshot, [
      "proxDistance", "moreauSmoothness", "sparsity", "admmResidual", "threshold",
      "vCoordinate", "proxCoordinate", "quadraticPull", "proxGradientMapping", "supportSize",
      "compositeObjective", "monotoneDecrease", "istaResidual", "fistaMomentum", "restartFlag",
      "projectionViolation", "boxClipCount", "simplexMassError", "groupShrinkFactor",
      "singularValuesKept", "tvEdgePreservation", "admmPrimalResidual", "admmDualResidual",
      "rhoBalance", "consensusGap", "moreauGradientNorm", "moreauEnvelopeValue", "decompositionGap"
    ], "C08 telemetry");
    if (!c08.snapshot.proxSceneHash || !c08.snapshot.moreauSoftHash || !c08.snapshot.splittingAdmmHash || !c08.snapshot.projectionCatalogHash) {
      throw new Error(`C08 should expose proximal diagnostics, got: ${JSON.stringify(c08.snapshot)}.`);
    }
    const c08HashBefore = c08.snapshot.proxSceneHash;
    await setRange(page, "#c08-step", "0.78");
    await setRange(page, "#c08-budget", "12");
    await setRange(page, "#c08-regularization", "0.86");
    await page.waitForTimeout(180);
    const c08After = await page.evaluate(() => window.__c08LabSnapshot());
    if (c08After.proxSceneHash === c08HashBefore || c08After.supportSize >= c08.snapshot.supportSize || c08After.fistaMomentum <= c08.snapshot.fistaMomentum) {
      throw new Error(`C08 controls did not alter proximal diagnostics: ${JSON.stringify({ before: c08.snapshot, after: c08After })}.`);
    }

    const c09 = await loadLab(page, "c09-nonconvex-optimization-lab.html", "__c09LabReady", "__c09LabSnapshot");
    if (c09.bytes < 15000 || c09.overflowX > 18 || c09.overflowY > 18) {
      throw new Error(`C09 clarity render is weak or does not fit: ${JSON.stringify(c09)}.`);
    }
    if (c09.snapshot.clarityVersion !== "c08-c09-canonical-clarity-v2" || c09.snapshot.legacyClarityVersion !== "c08-c09-canonical-clarity-v1" || c09.snapshot.visualScaffoldCount < 72) {
      throw new Error(`C09 missing canonical non-convex scaffold: ${JSON.stringify(c09.snapshot)}.`);
    }
    requireIncludes(c09.snapshot.visualRoles, [
      "worked landscape f(x,y)=x^3-3x+y^2",
      "gradient vector field grad f",
      "critical point marker local minimum (1,0)",
      "critical point marker saddle (-1,0)",
      "Hessian eigenvalue sign frame",
      "lambda_min negative curvature gauge",
      "epsilon first-order stationarity ball",
      "epsilon second-order stationarity band",
      "degenerate zero-Hessian x2y2 panel",
      "degenerate higher-order saddle x4-y4 panel",
      "nonconvex multi-basin loss surface",
      "gradient descent trajectory trapped near saddle",
      "perturbed trajectory escaping saddle",
      "strict saddle stable manifold sheet",
      "negative-curvature escape direction",
      "SGD noise cloud around saddle",
      "momentum overshoot arc",
      "trust-region radius ball and quadratic model",
      "cubic regularization lift",
      "initialization seed cloud",
      "basin boundary ridge",
      "sharp minimum narrow basin",
      "flat minimum wide basin",
      "validation robustness halo around flat minimum",
      "reparameterization symmetry flat valley rail",
      "training validation gap meter",
      "learning-rate schedule rail",
      "curvature probe Lanczos bars"
    ], "C09");
    requireIncludes(c09.snapshot.clarityLabels, [
      "f(x,y)", "grad f", "H", "lambda_min", "grad=0", "(1,0) min", "(-1,0) saddle",
      "epsilon-FOSP", "epsilon-SOSP", "negative curvature", "perturb", "SGD", "momentum",
      "trust region", "flat", "sharp", "validation", "seed", "basin", "symmetry", "LR schedule"
    ], "C09 labels");
    requireIncludes(c09.rail, ["Landscape diagnostics", "Critical points", "Saddle escape", "Basins/seeds", "Optimizer dynamics", "Generalization geometry"], "C09 rail");
    requireIncludes(c09.railAliases, ["multi-basin terrain", "seed cloud", "saddle plateau", "escape direction", "flat vs sharp"], "C09 legacy rail");
    await page.selectOption("[data-control='mode']", "curvature");
    await page.waitForTimeout(90);
    requireIncludes(await page.evaluate(() => [...document.querySelectorAll("button")].map((node) => node.textContent.trim())), ["Probe Hessian"], "C09 curvature buttons");
    await page.selectOption("[data-control='mode']", "flatness");
    await page.waitForTimeout(90);
    requireIncludes(await page.evaluate(() => [...document.querySelectorAll("button")].map((node) => node.textContent.trim())), ["Compare validation"], "C09 flatness buttons");
    requireFiniteNumbers(c09.snapshot, [
      "saddleEscape", "sharpness", "basinEnergy", "perturbationGain", "lossAtCurrent",
      "gradientNorm", "lambdaMin", "negativeCurvatureStrength", "stationaryFirstOrder",
      "secondOrderViolation", "basinCount", "seedCount", "trappedTrajectoryLength",
      "perturbationRadius", "escapeTime", "momentumEnergy", "sgdNoiseScale",
      "trustRegionRadius", "trustRegionAgreement", "flatnessScore", "sharpnessScore",
      "validationGap", "trainingLoss", "reparamSymmetryDrift", "lrStability",
      "curvatureProbe", "hessianCondition", "saddleBandWidth"
    ], "C09 telemetry");
    if (!c09.snapshot.nonconvexSceneHash || !c09.snapshot.saddleEscapeHash || !c09.snapshot.optimizerDynamicsHash || !c09.snapshot.flatSharpHash) {
      throw new Error(`C09 should expose non-convex diagnostics, got: ${JSON.stringify(c09.snapshot)}.`);
    }
    const c09HashBefore = c09.snapshot.nonconvexSceneHash;
    await setRange(page, "#c09-noise", "0.84");
    await setRange(page, "#c09-budget", "12");
    await setRange(page, "#c09-regularization", "0.84");
    await page.waitForTimeout(180);
    const c09After = await page.evaluate(() => window.__c09LabSnapshot());
    if (c09After.nonconvexSceneHash === c09HashBefore || c09After.seedCount <= c09.snapshot.seedCount || c09After.perturbationRadius <= c09.snapshot.perturbationRadius) {
      throw new Error(`C09 controls did not alter non-convex diagnostics: ${JSON.stringify({ before: c09.snapshot, after: c09After })}.`);
    }
  } finally {
    await browser.close();
  }
  console.log("c08-c09 visual clarity passed: proximal methods and non-convex optimization expose canonical textbook objects, fitted controls, and live diagnostics.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
