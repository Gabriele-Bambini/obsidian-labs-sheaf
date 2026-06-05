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
    const a13 = await loadLab(page, "a13-differential-equations-flow-lab.html", "__a13LabReady", "__a13LabSnapshot");
    if (a13.bytes < 15000 || a13.overflowX > 18 || a13.overflowY > 18) {
      throw new Error(`A13 clarity render is weak or does not fit: ${JSON.stringify(a13)}.`);
    }
    if (a13.snapshot.clarityVersion !== "a13-a14-canonical-clarity-v3" || a13.snapshot.legacyClarityVersion !== "a13-a14-canonical-clarity-v2" || a13.snapshot.visualScaffoldCount < 22) {
      throw new Error(`A13 missing canonical differential-equations scaffold: ${JSON.stringify(a13.snapshot)}.`);
    }
    requireIncludes(a13.snapshot.visualRoles, [
      "phase plane coordinate grid",
      "vector field derivative arrows",
      "initial condition marker x0",
      "local derivative tangent f(x0)",
      "solution trajectory x(t)",
      "time axis tick marks",
      "Euler step chord",
      "Euler step error gap",
      "RK4 corrected path",
      "Runge Kutta k1 k2 k3 k4 sample beads",
      "equilibrium point x*",
      "stable basin arrows",
      "unstable perturbation arrows",
      "Jacobian eigenvalue rail",
      "fast mode rail",
      "slow mode manifold",
      "BVP endpoint clamp y(a)",
      "BVP endpoint clamp y(b)",
      "shooting slope ray",
      "shooting residual bridge",
      "nullcline curve dx/dt=0",
      "nullcline curve dv/dt=0",
      "Lyapunov energy contour"
    ], "A13");
    requireIncludes(a13.snapshot.clarityLabels, [
      "phase plane",
      "x0",
      "f(x0)",
      "x(t)",
      "t",
      "Euler",
      "RK4",
      "k1",
      "k2",
      "k3",
      "k4",
      "h",
      "error",
      "x*",
      "stable",
      "unstable",
      "lambda",
      "fast mode",
      "slow mode",
      "y(a)=A",
      "y(b)=B",
      "shooting slope",
      "nullcline",
      "energy"
    ], "A13");
    requireIncludes(a13.rail, ["Phase field", "Initial condition", "Euler vs RK", "Equilibrium stability", "Stiff modes", "BVP constraints"], "A13 rail");
    requireIncludes(a13.railAliases, ["vector field", "initial state", "local derivative", "solver trajectory", "stability"], "A13 legacy rail");
    requireIncludes(a13.buttons, ["Show field", "Solver step"], "A13 buttons");
    if (!/Phase field|Euler vs RK|Equilibrium stability|Stiff modes|BVP constraints/i.test(a13.overlayText)) {
      throw new Error(`A13 overlay should name concrete ODE objects, got: ${a13.overlayText}`);
    }
    requireFiniteNumbers(a13.snapshot, [
      "stepError",
      "eulerError",
      "rkError",
      "errorRatio",
      "stabilityMargin",
      "equilibriumGap",
      "stiffnessRatio",
      "localDerivativeNorm",
      "lyapunovEnergy",
      "shootingResidual",
      "nullclineGap",
      "fastSlowSeparation",
      "timeStep",
      "stableEigenvalue",
      "fastEigenvalue",
      "shootingSlope"
    ], "A13 telemetry");
    if (
      !a13.snapshot.odeSceneHash ||
      !a13.snapshot.solverPathHash ||
      !a13.snapshot.boundaryValueHash ||
      !/stable|unstable|stiff/i.test(a13.snapshot.equilibriumType)
    ) {
      throw new Error(`A13 should expose ODE/solver/stability diagnostics, got: ${JSON.stringify(a13.snapshot)}.`);
    }

    const a14 = await loadLab(page, "a14-complex-contour-residue-lab.html", "__a14LabReady", "__a14LabSnapshot");
    if (a14.bytes < 15000 || a14.overflowX > 18 || a14.overflowY > 18) {
      throw new Error(`A14 clarity render is weak or does not fit: ${JSON.stringify(a14)}.`);
    }
    if (a14.snapshot.clarityVersion !== "a13-a14-canonical-clarity-v3" || a14.snapshot.legacyClarityVersion !== "a13-a14-canonical-clarity-v2" || a14.snapshot.visualScaffoldCount < 22) {
      throw new Error(`A14 missing canonical complex-analysis scaffold: ${JSON.stringify(a14.snapshot)}.`);
    }
    requireIncludes(a14.snapshot.visualRoles, [
      "complex plane Re axis",
      "complex plane Im axis",
      "complex plane coordinate grid",
      "analytic conformal local square grid",
      "mapped rotated scaled conformal grid",
      "Cauchy Riemann derivative check board",
      "oriented contour gamma with tangent arrows",
      "residue accumulation path beads",
      "singularity pole marker",
      "residue vector arrow",
      "winding number counter loop stack",
      "running contour integral accumulator",
      "Cauchy disk singularity free region",
      "Laurent annulus punctured disk",
      "principal part coefficient rack",
      "branch cut barrier",
      "Riemann sheet 1 surface",
      "Riemann sheet 2 surface",
      "sheet jump connector",
      "derivative multiplication rotor",
      "zero pole field markers"
    ], "A14");
    requireIncludes(a14.snapshot.clarityLabels, [
      "Re z",
      "Im z",
      "0",
      "z",
      "f(z)",
      "u",
      "v",
      "u_x=v_y",
      "u_y=-v_x",
      "f'(z)",
      "gamma",
      "orientation",
      "dz",
      "a",
      "pole",
      "n(gamma,a)",
      "Res(f,a)=c_-1",
      "int_gamma f(z) dz",
      "2pi i Res",
      "0<|z-a|<R",
      "principal part",
      "branch cut",
      "sheet k",
      "sheet k+1",
      "Cauchy disk"
    ], "A14");
    requireIncludes(a14.rail, ["Complex plane", "Cauchy-Riemann", "Contour integral", "Pole/residue", "Laurent annulus", "Branch sheets"], "A14 rail");
    requireIncludes(a14.railAliases, ["complex plane", "contour", "pole", "winding number", "residue"], "A14 legacy rail");
    requireIncludes(a14.buttons, ["Show residue", "Sample contour"], "A14 buttons");
    if (!/Complex plane|Cauchy-Riemann|Contour integral|Pole\/residue|Laurent annulus|Branch sheets/i.test(a14.overlayText)) {
      throw new Error(`A14 overlay should name concrete complex-analysis objects, got: ${a14.overlayText}`);
    }
    requireFiniteNumbers(a14.snapshot, [
      "windingNumber",
      "residueIntegral",
      "residueIntegralReal",
      "residueIntegralImag",
      "crDefect",
      "crEquationResidual",
      "poleDistance",
      "contourRadius",
      "residueStrength",
      "laurentPrincipalEnergy",
      "laurentPrincipalPartOrder",
      "annulusInnerRadius",
      "annulusOuterRadius",
      "branchCutGap",
      "branchSheetIndex",
      "branchJump",
      "conformalAngleError",
      "cauchySafeMargin",
      "integralSampleCount",
      "orientationSign",
      "enclosedPoleCount"
    ], "A14 telemetry");
    if (
      a14.snapshot.residueTheoremCheck !== true ||
      !a14.snapshot.complexPlaneHash ||
      !a14.snapshot.contourIntegralHash ||
      !a14.snapshot.branchSheetHash
    ) {
      throw new Error(`A14 should expose contour/residue/branch diagnostics, got: ${JSON.stringify(a14.snapshot)}.`);
    }
  } finally {
    await browser.close();
  }
  console.log("a13-a14 visual clarity passed: ODE and complex-analysis labs expose canonical textbook objects and fitted controls.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
