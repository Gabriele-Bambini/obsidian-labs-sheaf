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
  await page.goto(`file:///${labPath}?clarity-regression=c02-c03`);
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
    const c02 = await loadLab(page, "c02-optimization-landscape.html", "__c02LabReady", "__c02LabSnapshot");
    if (c02.bytes < 15000 || c02.overflowX > 18 || c02.overflowY > 18) {
      throw new Error(`C02 clarity render is weak or does not fit: ${JSON.stringify(c02)}.`);
    }
    if (c02.snapshot.clarityVersion !== "c02-c03-canonical-clarity-v2" || c02.snapshot.legacyClarityVersion !== "c02-c03-canonical-clarity-v1" || c02.snapshot.visualScaffoldCount < 44) {
      throw new Error(`C02 missing canonical unconstrained-optimization scaffold: ${JSON.stringify(c02.snapshot)}.`);
    }
    requireIncludes(c02.snapshot.visualRoles, [
      "objective ravine surface with condition number ellipses",
      "current iterate theta_k on objective landscape",
      "uphill gradient vector nabla f",
      "negative gradient descent direction -nabla f",
      "gradient descent zigzag trajectory across ravine",
      "local tangent plane first order model",
      "local quadratic Taylor model m_k p",
      "Armijo sufficient decrease ladder",
      "Wolfe slope flattening gate",
      "accepted alpha step marker",
      "rejected oversized alpha marker",
      "Newton Hessian solve board H p equals minus g",
      "Newton curvature ellipse eigenvalue frame",
      "condition number lambda max over lambda min tower",
      "BFGS secant equation y_k equals B_k s_k",
      "BFGS inverse Hessian approximation memory board",
      "positive curvature test s_k dot y_k greater than zero",
      "momentum velocity recurrence board",
      "indefinite Hessian negative curvature escape warning",
      "optimizer diagnostics ledger"
    ], "C02");
    requireIncludes(c02.snapshot.clarityLabels, [
      "theta_k", "f(theta)", "grad f", "-grad f", "alpha", "Armijo", "Wolfe",
      "H p=-g", "lambda_max/lambda_min", "BFGS", "s_k", "y_k", "v_k", "||grad f||"
    ], "C02 labels");
    requireIncludes(c02.rail, ["Objective landscape", "Gradient descent", "Line search", "Newton model", "BFGS memory", "Momentum"], "C02 rail");
    requireIncludes(c02.railAliases, ["objective surface", "gradient vector", "line search", "Newton step", "BFGS"], "C02 legacy rail");
    await page.selectOption("[data-control='mode']", "line");
    await page.waitForTimeout(90);
    requireIncludes(await page.evaluate(() => [...document.querySelectorAll("button")].map((node) => node.textContent.trim())), ["Accept alpha"], "C02 line buttons");
    await page.selectOption("[data-control='mode']", "bfgs");
    await page.waitForTimeout(90);
    requireIncludes(await page.evaluate(() => [...document.querySelectorAll("button")].map((node) => node.textContent.trim())), ["Update BFGS memory"], "C02 BFGS buttons");
    requireFiniteNumbers(c02.snapshot, [
      "objectiveValue", "gradientNorm", "stepDecrease", "newtonGain", "conditionNumber",
      "hessianEigenMin", "hessianEigenMax", "acceptedAlpha", "armijoMargin", "wolfeSlopeRatio",
      "newtonStepNorm", "bfgsSecantResidual", "bfgsCurvature", "momentumVelocity",
      "zigzagAmplitude", "trustRegionRadius"
    ], "C02 telemetry");
    if (!c02.snapshot.optimizationSceneHash || !c02.snapshot.lineSearchHash || !c02.snapshot.newtonModelHash || !c02.snapshot.bfgsMemoryHash) {
      throw new Error(`C02 should expose optimizer diagnostics, got: ${JSON.stringify(c02.snapshot)}.`);
    }
    const c02HashBefore = c02.snapshot.optimizationSceneHash;
    await setRange(page, "#c02-curvature", "1.65");
    await setRange(page, "#c02-step", "0.74");
    await setRange(page, "#c02-regularization", "0.82");
    await page.waitForTimeout(180);
    const c02After = await page.evaluate(() => window.__c02LabSnapshot());
    if (c02After.optimizationSceneHash === c02HashBefore || c02After.conditionNumber <= c02.snapshot.conditionNumber || c02After.acceptedAlpha === c02.snapshot.acceptedAlpha) {
      throw new Error(`C02 controls did not alter optimizer diagnostics: ${JSON.stringify({ before: c02.snapshot, after: c02After })}.`);
    }

    const c03 = await loadLab(page, "c03-constrained-optimization.html", "__c03LabReady", "__c03LabSnapshot");
    if (c03.bytes < 15000 || c03.overflowX > 18 || c03.overflowY > 18) {
      throw new Error(`C03 clarity render is weak or does not fit: ${JSON.stringify(c03)}.`);
    }
    if (c03.snapshot.clarityVersion !== "c02-c03-canonical-clarity-v2" || c03.snapshot.legacyClarityVersion !== "c02-c03-canonical-clarity-v1" || c03.snapshot.visualScaffoldCount < 46) {
      throw new Error(`C03 missing canonical constrained-optimization scaffold: ${JSON.stringify(c03.snapshot)}.`);
    }
    requireIncludes(c03.snapshot.visualRoles, [
      "KKT force balance objective surface",
      "projected feasible region under objective",
      "active inequality boundary wall",
      "inactive inequality slack boundary",
      "equality constraint tangent rail h x equals zero",
      "unconstrained optimum illegal witness",
      "projected feasible iterate Pi_C step",
      "projection arrow from illegal step to feasible set",
      "constrained optimum on active boundary",
      "objective negative gradient vector points outside feasible set",
      "constraint outward normal vector",
      "lambda normal force closes stationarity",
      "normal cone fan blocks illegal descent",
      "KKT table primal feasibility tile",
      "KKT table dual feasibility tile",
      "KKT table complementary slackness tile",
      "KKT table stationarity residual tile",
      "penalty spring wall punishes violation",
      "interior log barrier wall",
      "interior barrier central path",
      "active set switchboard active inactive constraints",
      "Slater strictly feasible witness",
      "primal dual certificate gap bar",
      "SVM margin support vector mini panel"
    ], "C03");
    requireIncludes(c03.snapshot.clarityLabels, [
      "C", "g(x)<=0", "h(x)=0", "x_unc", "Pi_C", "x*", "grad f", "N_C(x*)",
      "lambda grad g", "KKT", "primal", "dual", "lambda g=0", "stationarity",
      "penalty rho", "barrier mu", "Slater", "gap"
    ], "C03 labels");
    requireIncludes(c03.rail, ["Feasible set", "Projection", "Lagrange/KKT", "Penalty", "Barrier", "Primal-dual"], "C03 rail");
    requireIncludes(c03.railAliases, ["feasible half-space", "active wall", "normal force", "barrier path"], "C03 legacy rail");
    await page.selectOption("[data-control='mode']", "projection");
    await page.waitForTimeout(90);
    requireIncludes(await page.evaluate(() => [...document.querySelectorAll("button")].map((node) => node.textContent.trim())), ["Project step"], "C03 projection buttons");
    await page.selectOption("[data-control='mode']", "penalty");
    await page.waitForTimeout(90);
    requireIncludes(await page.evaluate(() => [...document.querySelectorAll("button")].map((node) => node.textContent.trim())), ["Raise penalty"], "C03 penalty buttons");
    requireFiniteNumbers(c03.snapshot, [
      "maxViolation", "kktResidual", "lagrangeLambda", "complementarity", "projectedStepNorm",
      "normalConeBalance", "equalityResidual", "slaterMargin", "penaltyWeight", "penaltyViolation",
      "barrierMu", "centralPathDistance", "primalDualGap", "activeSetSize", "stationarityResidual"
    ], "C03 telemetry");
    if (!c03.snapshot.constrainedSceneHash || !c03.snapshot.kktTableHash || !c03.snapshot.projectionHash || !c03.snapshot.penaltyBarrierHash) {
      throw new Error(`C03 should expose constrained diagnostics, got: ${JSON.stringify(c03.snapshot)}.`);
    }
    const c03HashBefore = c03.snapshot.constrainedSceneHash;
    await setRange(page, "#c03-curvature", "1.4");
    await setRange(page, "#c03-noise", "0.82");
    await setRange(page, "#c03-regularization", "0.74");
    await page.waitForTimeout(180);
    const c03After = await page.evaluate(() => window.__c03LabSnapshot());
    if (c03After.constrainedSceneHash === c03HashBefore || c03After.lagrangeLambda <= c03.snapshot.lagrangeLambda || c03After.penaltyWeight <= c03.snapshot.penaltyWeight) {
      throw new Error(`C03 controls did not alter constrained diagnostics: ${JSON.stringify({ before: c03.snapshot, after: c03After })}.`);
    }
  } finally {
    await browser.close();
  }
  console.log("c02-c03 visual clarity passed: unconstrained and constrained optimization expose canonical textbook objects, fitted controls, and live diagnostics.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
