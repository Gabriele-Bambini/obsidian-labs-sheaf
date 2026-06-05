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
  await page.waitForTimeout(280);
  return page.evaluate((snapshotName) => {
    const canvas = document.querySelector(".lab-viewport canvas");
    return {
      bytes: canvas.toDataURL("image/png").length,
      snapshot: window[snapshotName](),
      overlayText: [...document.querySelectorAll("[data-visual-key], .formula-chip, [data-role='insight'], .selected-chip")]
        .map((node) => node.textContent.trim())
        .join(" | "),
      rail: [...document.querySelectorAll(".concept-rail span")].map((node) => node.textContent.trim()),
      overflowX: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
      overflowY: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight
    };
  }, snapshotName);
}

function requireIncludes(list, expected, lab) {
  for (const item of expected) {
    if (!list || !list.some((candidate) => String(candidate).toLowerCase().includes(item.toLowerCase()))) {
      throw new Error(`${lab} missing clarity marker "${item}". Found: ${(list || []).join(" | ")}`);
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
    const a03 = await loadLab(page, "a03-eigen-quadratic-form.html", "__a03LabReady", "__a03LabSnapshot");
    if (a03.bytes < 15500 || a03.overflowX > 18 || a03.overflowY > 18) {
      throw new Error(`A03 clarity render is weak or does not fit: ${JSON.stringify(a03)}.`);
    }
    if (
      a03.snapshot.clarityVersion !== "a03-a04-canonical-clarity-v1" ||
      a03.snapshot.legacyClarityVersion !== "a03-a04-physical-clarity-v2" ||
      a03.snapshot.visualScaffoldCount < 12
    ) {
      throw new Error(`A03 missing physical multivariable-calculus scaffold: ${JSON.stringify(a03.snapshot)}.`);
    }
    requireIncludes(a03.snapshot.visualRoles, [
      "quadratic Taylor surface",
      "tangent plane local linearization",
      "gradient Taylor arrow",
      "negative gradient descent arrow",
      "Hessian eigenvector curvature axes",
      "level set contour floor",
      "partial derivative coordinate slice walls",
      "Jacobian local linear map tile",
      "Hessian matrix curvature board",
      "Taylor value linear quadratic stack",
      "directional derivative probe ruler",
      "constraint tangent feasible path"
    ], "A03");
    requireIncludes(a03.snapshot.clarityLabels, [
      "f(x,y)",
      "p",
      "grad f",
      "tangent",
      "lambda1",
      "lambda2",
      "level set",
      "J",
      "H",
      "Taylor",
      "D_u f",
      "constraint"
    ], "A03");
    requireIncludes(a03.rail, ["Surface", "Gradient", "Tangent", "Hessian", "Level sets", "Taylor/Jacobian"], "A03 rail");
    if (!/Surface|Gradient|Tangent|Hessian|Level sets|Taylor\/Jacobian/i.test(a03.overlayText)) {
      throw new Error(`A03 overlay should name physical calculus objects, got: ${a03.overlayText}`);
    }
    if (!Array.isArray(a03.snapshot.gradientVector) || a03.snapshot.gradientVector.length !== 2) {
      throw new Error(`A03 should expose gradient telemetry, got: ${JSON.stringify(a03.snapshot)}.`);
    }
    if (!a03.snapshot.hessianMatrix || !a03.snapshot.eigenvaluePair || !a03.snapshot.taylorFormulaHash) {
      throw new Error(`A03 should expose Hessian/eigen/Taylor telemetry, got: ${JSON.stringify(a03.snapshot)}.`);
    }
    if (a03.snapshot.levelGradientOrthogonal !== true || !Number.isFinite(a03.snapshot.directionalDerivative)) {
      throw new Error(`A03 should expose level-set orthogonality and directional derivative telemetry, got: ${JSON.stringify(a03.snapshot)}.`);
    }

    const a04 = await loadLab(page, "a04-measure-convergence-lab.html", "__a04LabReady", "__a04LabSnapshot");
    if (a04.bytes < 15500 || a04.overflowX > 18 || a04.overflowY > 18) {
      throw new Error(`A04 clarity render is weak or does not fit: ${JSON.stringify(a04)}.`);
    }
    if (
      a04.snapshot.clarityVersion !== "a03-a04-canonical-clarity-v1" ||
      a04.snapshot.legacyClarityVersion !== "a03-a04-physical-clarity-v2" ||
      a04.snapshot.visualScaffoldCount < 12
    ) {
      throw new Error(`A04 missing physical measure-theory scaffold: ${JSON.stringify(a04.snapshot)}.`);
    }
    requireIncludes(a04.snapshot.visualRoles, [
      "measurable domain floor",
      "domain interval axis",
      "sigma algebra event shelf",
      "function sequence vertical bar",
      "support measure footprint",
      "Lebesgue range slice",
      "simple function step approximation bands",
      "dominating envelope plane",
      "limit function baseline",
      "almost-everywhere null-set dust",
      "integral mass accumulation basin",
      "convergence theorem condition switchboard"
    ], "A04");
    requireIncludes(a04.snapshot.clarityLabels, [
      "Omega",
      "sigma-algebra",
      "f_n",
      "support",
      "mu(A)",
      "range slices",
      "simple s",
      "dominated g",
      "a.e.",
      "L1",
      "int f dmu",
      "limit test"
    ], "A04");
    requireIncludes(a04.rail, ["Domain", "Measurable sets", "Function sequence", "Support", "Lebesgue slices", "DCT test"], "A04 rail");
    if (!/Domain|Measurable sets|Function sequence|Support|Lebesgue slices|DCT test/i.test(a04.overlayText)) {
      throw new Error(`A04 overlay should name physical measure objects, got: ${a04.overlayText}`);
    }
    if (!a04.snapshot.measureSpace || !a04.snapshot.lebesgueSliceHash || !a04.snapshot.integralMassHash) {
      throw new Error(`A04 should expose measure-space, slice, and integral telemetry, got: ${JSON.stringify(a04.snapshot)}.`);
    }
    if (!Number.isFinite(a04.snapshot.supportMeasure) || !Number.isFinite(a04.snapshot.l1Integral)) {
      throw new Error(`A04 should expose support and integral telemetry, got: ${JSON.stringify(a04.snapshot)}.`);
    }
    if (!("dominatedConvergenceCondition" in a04.snapshot) || !("pointwiseNotUniform" in a04.snapshot) || a04.snapshot.nullSetIgnored !== true) {
      throw new Error(`A04 should expose convergence theorem diagnostics, got: ${JSON.stringify(a04.snapshot)}.`);
    }
  } finally {
    await browser.close();
  }
  console.log("a03-a04 visual clarity passed: calculus and measure labs expose beginner-readable physical scaffolds and fit the iframe.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
