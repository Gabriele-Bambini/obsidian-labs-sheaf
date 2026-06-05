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
    const b10 = await loadLab(page, "b10-causal-inference-lab.html", "__b10LabReady", "__b10LabSnapshot");
    if (b10.bytes < 15000 || b10.overflowX > 18 || b10.overflowY > 18) {
      throw new Error(`B10 clarity render is weak or does not fit: ${JSON.stringify(b10)}.`);
    }
    if (b10.snapshot.clarityVersion !== "b10-c01-canonical-clarity-v2" || b10.snapshot.legacyClarityVersion !== "b10-c01-canonical-clarity-v1" || b10.snapshot.visualScaffoldCount < 48) {
      throw new Error(`B10 missing canonical causal-inference scaffold: ${JSON.stringify(b10.snapshot)}.`);
    }
    requireIncludes(b10.snapshot.visualRoles, [
      "structural causal model exogenous noise boxes",
      "causal DAG node severity confounder Z",
      "causal DAG node treatment T",
      "causal DAG node mediator M",
      "causal DAG node outcome Y",
      "causal DAG directed edge Z to T",
      "causal DAG directed edge Z to Y",
      "causal DAG directed edge T to Y",
      "open backdoor path Z creates association",
      "adjustment stratum panes compare treated untreated within Z",
      "do operator scissors cut incoming arrows into T",
      "interventional distribution bar P Y given do T",
      "observational association bar P Y given T",
      "collider conditioning opens false path",
      "mediator block changes total effect",
      "potential outcomes twin columns Y1 Y0",
      "fundamental missing counterfactual slot",
      "ATE population average treatment effect beam",
      "ATT treated target population beam",
      "propensity score e Z balance scale",
      "IPW pseudo population weight towers",
      "overlap positivity support strip",
      "doubly robust outcome propensity score board",
      "front door mediator identification bridge",
      "instrumental variable encouragement lever",
      "difference in differences parallel trends panel",
      "regression discontinuity cutoff window"
    ], "B10");
    requireIncludes(b10.snapshot.clarityLabels, [
      "Z", "T", "M", "Y", "U", "P(Y|T)", "P(Y|do(T))", "do(T=1)", "cut in(T)",
      "backdoor", "adjust Z", "collider C", "mediator M", "Y_i(1)", "Y_i(0)",
      "missing counterfactual", "ATE", "ATT", "e(Z)", "IPW", "overlap", "DR",
      "front-door", "IV", "DiD", "RD"
    ], "B10 labels");
    requireIncludes(b10.rail, ["DAG structure", "Backdoor adjustment", "do-intervention", "Potential outcomes", "Propensity/IPW", "Designs"], "B10 rail");
    requireIncludes(b10.railAliases, ["confounder", "treatment", "outcome", "do-intervention"], "B10 legacy rail");
    await page.selectOption("[data-control='mode']", "backdoor");
    await page.waitForTimeout(90);
    requireIncludes(await page.evaluate(() => [...document.querySelectorAll("button")].map((node) => node.textContent.trim())), ["Block backdoor"], "B10 backdoor buttons");
    await page.selectOption("[data-control='mode']", "intervention");
    await page.waitForTimeout(90);
    requireIncludes(await page.evaluate(() => [...document.querySelectorAll("button")].map((node) => node.textContent.trim())), ["Apply do(T)"], "B10 intervention buttons");
    requireFiniteNumbers(b10.snapshot, [
      "causalEffect", "backdoorBias", "adjustmentScore", "ateStability", "associationCausalGap",
      "propensityOverlap", "ipwWeightSpread", "balanceAfterWeighting", "colliderBiasRisk",
      "mediatorBlockedEffect", "counterfactualMissingRate", "ate", "att", "frontdoorScore",
      "instrumentStrength", "parallelTrendGap", "rdLocalWindow"
    ], "B10 telemetry");
    if (!b10.snapshot.causalSceneHash || !b10.snapshot.dagPathHash || !b10.snapshot.interventionHash || !b10.snapshot.potentialOutcomeHash || b10.snapshot.backdoorBlocked !== false) {
      throw new Error(`B10 should expose causal diagnostics, got: ${JSON.stringify(b10.snapshot)}.`);
    }
    const b10HashBefore = b10.snapshot.causalSceneHash;
    await setRange(page, "#b10-strength", "0.88");
    await setRange(page, "#b10-spread", "0.28");
    await setRange(page, "#b10-noise", "0.12");
    await page.waitForTimeout(180);
    const b10After = await page.evaluate(() => window.__b10LabSnapshot());
    if (b10After.causalSceneHash === b10HashBefore || b10After.adjustmentScore <= b10.snapshot.adjustmentScore || b10After.backdoorBias >= b10.snapshot.backdoorBias) {
      throw new Error(`B10 controls did not alter causal diagnostics: ${JSON.stringify({ before: b10.snapshot, after: b10After })}.`);
    }

    const c01 = await loadLab(page, "c01-convex-analysis-lab.html", "__c01LabReady", "__c01LabSnapshot");
    if (c01.bytes < 15000 || c01.overflowX > 18 || c01.overflowY > 18) {
      throw new Error(`C01 clarity render is weak or does not fit: ${JSON.stringify(c01)}.`);
    }
    if (c01.snapshot.clarityVersion !== "b10-c01-canonical-clarity-v2" || c01.snapshot.legacyClarityVersion !== "b10-c01-canonical-clarity-v1" || c01.snapshot.visualScaffoldCount < 42) {
      throw new Error(`C01 missing canonical convex-analysis scaffold: ${JSON.stringify(c01.snapshot)}.`);
    }
    requireIncludes(c01.snapshot.visualRoles, [
      "convex set filled body C contains whole line segment",
      "convex hull of points simplex object",
      "nonconvex crescent counterexample split body",
      "epigraph vertical slice chamber",
      "convex function graph below every chord",
      "Jensen chord through two surface points",
      "Jensen expectation bead f E X",
      "supporting tangent plane on 3D convex bowl",
      "subgradient lower bound plane certificate",
      "absolute value corner with subdifferential interval",
      "normal cone to feasible set at boundary",
      "Hessian PSD eigenvalue bars",
      "extended value indicator wall outside domain",
      "Fenchel affine plane tangent to convex bowl",
      "Fenchel Young gap bar",
      "conjugate slope handle y in dual space",
      "entropy log sum exp conjugate pair",
      "L1 sparsity zero subgradient interval"
    ], "C01");
    requireIncludes(c01.snapshot.clarityLabels, [
      "C", "x", "y", "theta x+(1-theta)y", "conv{x_i}", "not convex", "epi(f)",
      "f(theta x+(1-theta)y)", "theta f(x)+(1-theta)f(y)", "E[X]", "f(E[X])",
      "E[f(X)]", "g in partial f(x)", "support plane", "partial |x|=[-1,1]",
      "N_C(x)", "H>=0", "I_C(x)=+infty", "f*(s)", "f(x)+f*(s)>=s x",
      "p log p", "logsumexp", "lambda |w|"
    ], "C01 labels");
    requireIncludes(c01.rail, ["Convex set", "Epigraph", "Jensen", "Subgradient", "Fenchel dual", "Certificates"], "C01 rail");
    requireIncludes(c01.railAliases, ["convex set", "epigraph", "Jensen chord", "subgradient plane", "Fenchel dual"], "C01 legacy rail");
    await page.selectOption("[data-control='mode']", "jensen");
    await page.waitForTimeout(90);
    requireIncludes(await page.evaluate(() => [...document.querySelectorAll("button")].map((node) => node.textContent.trim())), ["Draw Jensen chord"], "C01 Jensen buttons");
    await page.selectOption("[data-control='mode']", "fenchel");
    await page.waitForTimeout(90);
    requireIncludes(await page.evaluate(() => [...document.querySelectorAll("button")].map((node) => node.textContent.trim())), ["Move dual slope"], "C01 Fenchel buttons");
    requireFiniteNumbers(c01.snapshot, [
      "jensenGap", "supportViolation", "subgradientNorm", "fenchelGap", "convexity",
      "theta", "epigraphLift", "supportSlope", "supportSlopeZ", "hessianMinEigen",
      "hessianMaxEigen", "normalConeAngle", "subdifferentialWidth", "indicatorWallHeight",
      "fenchelSlope", "fenchelYoungGap", "entropyConjugateGap", "convexHullArea",
      "nonconvexViolation"
    ], "C01 telemetry");
    if (!c01.snapshot.convexSceneHash || !c01.snapshot.jensenCertificateHash || !c01.snapshot.supportCertificateHash || !c01.snapshot.fenchelCertificateHash || c01.snapshot.localMinGlobalCertificate !== true) {
      throw new Error(`C01 should expose convex diagnostics, got: ${JSON.stringify(c01.snapshot)}.`);
    }
    const c01HashBefore = c01.snapshot.convexSceneHash;
    await setRange(page, "#c01-curvature", "1.45");
    await setRange(page, "#c01-step", "0.62");
    await setRange(page, "#c01-regularization", "0.72");
    await page.waitForTimeout(180);
    const c01After = await page.evaluate(() => window.__c01LabSnapshot());
    if (c01After.convexSceneHash === c01HashBefore || c01After.jensenGap <= c01.snapshot.jensenGap || c01After.hessianMinEigen <= c01.snapshot.hessianMinEigen) {
      throw new Error(`C01 controls did not alter convex diagnostics: ${JSON.stringify({ before: c01.snapshot, after: c01After })}.`);
    }
  } finally {
    await browser.close();
  }
  console.log("b10-c01 visual clarity passed: causal inference and convex analysis expose canonical textbook objects, fitted controls, and live diagnostics.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
