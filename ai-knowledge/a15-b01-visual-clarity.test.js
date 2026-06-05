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
    const a15 = await loadLab(page, "a15-numerical-methods-stability-lab.html", "__a15LabReady", "__a15LabSnapshot");
    if (a15.bytes < 15000 || a15.overflowX > 18 || a15.overflowY > 18) {
      throw new Error(`A15 clarity render is weak or does not fit: ${JSON.stringify(a15)}.`);
    }
    if (a15.snapshot.clarityVersion !== "a15-b01-canonical-clarity-v2" || a15.snapshot.legacyClarityVersion !== "a15-b01-canonical-clarity-v1" || a15.snapshot.visualScaffoldCount < 28) {
      throw new Error(`A15 missing canonical numerical-methods scaffold: ${JSON.stringify(a15.snapshot)}.`);
    }
    requireIncludes(a15.snapshot.visualRoles, [
      "floating point mantissa exponent rack",
      "unit roundoff error bead cloud",
      "condition number singular value ladder",
      "input perturbation ball",
      "output amplification cone",
      "residual convergence curve",
      "backward error nearby problem plate",
      "trusted digits register",
      "catastrophic cancellation subtraction gap",
      "scaling preconditioner balance board",
      "root finding bracket interval",
      "Newton tangent step",
      "bisection midpoint ticks",
      "finite difference stencil",
      "truncation error curve",
      "roundoff error curve",
      "optimal h marker",
      "linear system Ax=b matrix board",
      "pivoting row swap rail",
      "QR orthogonality panel",
      "least squares residual perpendicular",
      "stability region disk",
      "Euler time step arrow",
      "implicit step stabilizer",
      "Krylov subspace ladder"
    ], "A15");
    requireIncludes(a15.snapshot.clarityLabels, [
      "fl(x)",
      "mantissa",
      "exponent",
      "u",
      "kappa(A)",
      "sigma_max",
      "sigma_min",
      "delta b",
      "delta x",
      "residual",
      "backward error",
      "trusted digits",
      "a-b",
      "scale",
      "[a,b]",
      "Newton",
      "bisection",
      "h",
      "O(h)",
      "O(u/h)",
      "Ax=b",
      "PA=LU",
      "QR",
      "r=b-Ax",
      "stability",
      "Euler",
      "implicit",
      "Krylov"
    ], "A15");
    requireIncludes(a15.rail, ["Floating point", "Conditioning", "Residual/error", "Root/stencil", "Linear solve", "Time stability"], "A15 rail");
    requireIncludes(a15.railAliases, ["problem data", "condition number", "roundoff", "residual path", "trusted digits"], "A15 legacy rail");
    requireIncludes(a15.buttons, ["Show conditioning", "Perturb data"], "A15 buttons");
    if (!/Floating point|Conditioning|Root\/stencil|Linear solve|Time stability/i.test(a15.overlayText)) {
      throw new Error(`A15 overlay should name concrete numerical-method objects, got: ${a15.overlayText}`);
    }
    requireFiniteNumbers(a15.snapshot, [
      "conditionNumber",
      "residualNorm",
      "trustedDigits",
      "stabilityMargin",
      "unitRoundoffStress",
      "amplificationFactor",
      "backwardError",
      "forwardErrorBound",
      "cancellationLoss",
      "preconditionerGain",
      "rootBracketWidth",
      "newtonStepSize",
      "finiteDifferenceError",
      "roundoffError",
      "truncationError",
      "optimalStepSize",
      "leastSquaresResidual",
      "orthogonalityLoss",
      "stabilityRegionMargin",
      "krylovResidualDrop"
    ], "A15 telemetry");
    if (
      !a15.snapshot.numericalSceneHash ||
      !a15.snapshot.conditioningHash ||
      !a15.snapshot.solverReliabilityHash ||
      !a15.snapshot.stabilityRegionHash ||
      a15.snapshot.qrSaferThanNormalEquations !== true
    ) {
      throw new Error(`A15 should expose numerical diagnostics, got: ${JSON.stringify(a15.snapshot)}.`);
    }
    const a15HashBefore = a15.snapshot.numericalSceneHash;
    await setRange(page, "#a15-condition", "7.2");
    await setRange(page, "#a15-step", "0.58");
    await setRange(page, "#a15-roundoff", "0.74");
    await page.waitForTimeout(160);
    const a15After = await page.evaluate(() => window.__a15LabSnapshot());
    if (a15After.numericalSceneHash === a15HashBefore || a15After.conditionNumber <= a15.snapshot.conditionNumber) {
      throw new Error(`A15 controls did not visibly alter diagnostics: ${JSON.stringify({ before: a15.snapshot, after: a15After })}.`);
    }

    const b01 = await loadLab(page, "b01-probability-foundations-lab.html", "__b01LabReady", "__b01LabSnapshot");
    if (b01.bytes < 15000 || b01.overflowX > 18 || b01.overflowY > 18) {
      throw new Error(`B01 clarity render is weak or does not fit: ${JSON.stringify(b01)}.`);
    }
    if (b01.snapshot.clarityVersion !== "a15-b01-canonical-clarity-v2" || b01.snapshot.legacyClarityVersion !== "a15-b01-canonical-clarity-v1" || b01.snapshot.visualScaffoldCount < 24) {
      throw new Error(`B01 missing canonical probability scaffold: ${JSON.stringify(b01.snapshot)}.`);
    }
    requireIncludes(b01.snapshot.visualRoles, [
      "sample space Omega outcome tiles",
      "probability mass bar chart",
      "Kolmogorov total mass gauge",
      "event A set region",
      "event B evidence region",
      "A union B overlap plate",
      "A intersection B highlight",
      "complement Ac shadow",
      "conditional probability renormalization lane",
      "Bayes partition hypothesis tiles",
      "likelihood evidence arrows",
      "posterior normalized bars",
      "random variable function bridge X:Omega->R",
      "PMF value towers",
      "CDF cumulative staircase",
      "PDF continuous density ribbon",
      "expectation balance beam",
      "variance spread arms",
      "independence product board",
      "Monte Carlo sample beads",
      "empirical mean convergence trace"
    ], "B01");
    requireIncludes(b01.snapshot.clarityLabels, [
      "Omega",
      "omega",
      "P(omega)",
      "P(Omega)=1",
      "A",
      "B",
      "A union B",
      "A cap B",
      "A^c",
      "P(A|B)",
      "Bayes",
      "H_i",
      "P(B|H_i)",
      "posterior",
      "X(omega)",
      "PMF",
      "CDF",
      "PDF",
      "E[X]",
      "Var(X)",
      "independent?",
      "samples",
      "mean"
    ], "B01");
    requireIncludes(b01.rail, ["Sample space", "Events/set rules", "Conditioning/Bayes", "Random variable", "Distribution functions", "Expectation/MC"], "B01 rail");
    requireIncludes(b01.railAliases, ["sample space", "event A", "evidence B", "conditional mass", "Monte Carlo"], "B01 legacy rail");
    requireIncludes(b01.buttons, ["Show event A", "Draw outcome"], "B01 buttons");
    if (!/Sample space|Conditioning\/Bayes|Random variable|Expectation\/MC/i.test(b01.overlayText)) {
      throw new Error(`B01 overlay should name concrete probability objects, got: ${b01.overlayText}`);
    }
    requireFiniteNumbers(b01.snapshot, [
      "eventProbability",
      "entropy",
      "conditionalMass",
      "expectation",
      "totalMass",
      "eventAMass",
      "eventBMass",
      "intersectionMass",
      "unionMass",
      "complementMass",
      "bayesEvidence",
      "posteriorMass",
      "randomVariableMean",
      "variance",
      "cdfAtFocus",
      "monteCarloMean",
      "empiricalError",
      "independenceGap"
    ], "B01 telemetry");
    if (
      !b01.snapshot.probabilitySceneHash ||
      !b01.snapshot.eventAlgebraHash ||
      !b01.snapshot.conditioningHash ||
      !b01.snapshot.randomVariableHash ||
      b01.snapshot.bayesNormalizerPositive !== true
    ) {
      throw new Error(`B01 should expose probability diagnostics, got: ${JSON.stringify(b01.snapshot)}.`);
    }
    const b01HashBefore = b01.snapshot.probabilitySceneHash;
    await setRange(page, "#b01-focus", "0.72");
    await setRange(page, "#b01-spread", "0.34");
    await setRange(page, "#b01-strength", "0.86");
    await setRange(page, "#b01-samples", "12");
    await page.waitForTimeout(160);
    const b01After = await page.evaluate(() => window.__b01LabSnapshot());
    if (b01After.probabilitySceneHash === b01HashBefore || b01After.eventProbability <= b01.snapshot.eventProbability) {
      throw new Error(`B01 controls did not visibly alter diagnostics: ${JSON.stringify({ before: b01.snapshot, after: b01After })}.`);
    }
  } finally {
    await browser.close();
  }
  console.log("a15-b01 visual clarity passed: numerical methods and probability labs expose canonical textbook objects, fitted controls, and live diagnostics.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
