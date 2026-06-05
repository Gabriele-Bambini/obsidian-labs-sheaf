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
    const a07 = await loadLab(page, "a07-measure-integration.html", "__a07LabReady", "__a07LabSnapshot");
    if (a07.bytes < 15500 || a07.overflowX > 18 || a07.overflowY > 18) {
      throw new Error(`A07 clarity render is weak or does not fit: ${JSON.stringify(a07)}.`);
    }
    if (
      a07.snapshot.clarityVersion !== "a07-a08-canonical-clarity-v1" ||
      a07.snapshot.legacyClarityVersion !== "a07-a08-physical-clarity-v2" ||
      a07.snapshot.visualScaffoldCount < 13
    ) {
      throw new Error(`A07 missing concrete differential-geometry scaffold: ${JSON.stringify(a07.snapshot)}.`);
    }
    requireIncludes(a07.snapshot.visualRoles, [
      "embedded manifold surface patch",
      "coordinate chart grid and atlas seam",
      "chart coordinate axes u v",
      "point p on manifold",
      "tangent plane T_pM local linear model",
      "tangent basis arrows u and v",
      "normal vector orthogonality witness",
      "Jacobian tangent map board",
      "Riemannian metric tensor tile",
      "metric volume element patch",
      "projected gradient tangent arrow",
      "exponential retraction step bead",
      "geodesic manifold path",
      "ambient chord warning",
      "curvature normal-section ring",
      "tangent vector field arrows",
      "differential form orientation patch",
      "manifold volume element cells"
    ], "A07");
    requireIncludes(a07.snapshot.clarityLabels, [
      "M",
      "chart",
      "u",
      "v",
      "p",
      "T_pM",
      "J",
      "g_p",
      "grad_M f",
      "exp_p(v)",
      "geodesic",
      "ambient chord",
      "K",
      "omega",
      "dVol"
    ], "A07");
    requireIncludes(a07.rail, ["Manifold M", "Chart/atlas", "Tangent space", "Metric", "Geodesic", "Curvature/forms"], "A07 rail");
    requireIncludes(a07.railAliases, ["manifold surface", "point p", "tangent plane", "metric volume", "geodesic"], "A07 legacy rail");
    if (!/Manifold M|Chart\/atlas|Tangent space|Metric|Geodesic|Curvature\/forms/i.test(a07.overlayText)) {
      throw new Error(`A07 overlay should name concrete differential-geometry objects, got: ${a07.overlayText}`);
    }
    if (!a07.snapshot.chartCoordinates || !a07.snapshot.tangentBasisHash || !a07.snapshot.metricTensorHash || !a07.snapshot.jacobianHash) {
      throw new Error(`A07 should expose chart/tangent/metric/Jacobian telemetry, got: ${JSON.stringify(a07.snapshot)}.`);
    }
    requireFiniteNumbers(a07.snapshot, ["normalOrthogonality", "geodesicGap", "curvatureSign", "volumeElement", "tangentError"], "A07 telemetry");
    if (a07.snapshot.projectedGradientTangent !== true || a07.snapshot.chartSeamVisible !== true) {
      throw new Error(`A07 should expose projected-gradient and chart-seam diagnostics, got: ${JSON.stringify(a07.snapshot)}.`);
    }
    if (!a07.snapshot.parallelTransportHolonomyHash || !a07.snapshot.formOrientationHash) {
      throw new Error(`A07 should expose transport/form diagnostics, got: ${JSON.stringify(a07.snapshot)}.`);
    }

    const a08 = await loadLab(page, "a08-algebra-structure-lab.html", "__a08LabReady", "__a08LabSnapshot");
    if (a08.bytes < 15500 || a08.overflowX > 18 || a08.overflowY > 18) {
      throw new Error(`A08 clarity render is weak or does not fit: ${JSON.stringify(a08)}.`);
    }
    if (
      a08.snapshot.clarityVersion !== "a07-a08-canonical-clarity-v1" ||
      a08.snapshot.legacyClarityVersion !== "a07-a08-physical-clarity-v2" ||
      a08.snapshot.visualScaffoldCount < 13
    ) {
      throw new Error(`A08 missing concrete abstract-algebra scaffold: ${JSON.stringify(a08.snapshot)}.`);
    }
    requireIncludes(a08.snapshot.visualRoles, [
      "Cayley operation table grid",
      "closure result height cells",
      "identity row and column cross",
      "inverse pair connector arcs",
      "associativity triple witness cube",
      "commutativity symmetry mirror",
      "modular arithmetic clock Z_n",
      "ring multiplication overlay",
      "unit group invertible elements",
      "zero divisor collision gate",
      "field test prime-composite panel",
      "generator orbit cycle",
      "stabilizer fixed-set anchor",
      "homomorphism map conveyor",
      "kernel preimage of identity",
      "quotient coset stack",
      "first isomorphism bridge",
      "group action square"
    ], "A08");
    requireIncludes(a08.snapshot.clarityLabels, [
      "Cayley",
      "closure",
      "e",
      "a^-1",
      "assoc",
      "ab=ba?",
      "Z_n",
      "units",
      "zero divisors",
      "field?",
      "<g>",
      "Stab(x)",
      "phi",
      "ker(phi)",
      "G/ker",
      "orbit"
    ], "A08");
    requireIncludes(a08.rail, ["Cayley table", "Axioms", "Ring/field", "Homomorphism", "Kernel/quotient", "Action/orbit"], "A08 rail");
    requireIncludes(a08.railAliases, ["operation table", "identity", "inverse/unit", "generator orbit", "kernel quotient"], "A08 legacy rail");
    if (!/Cayley table|Axioms|Ring\/field|Homomorphism|Kernel\/quotient|Action\/orbit/i.test(a08.overlayText)) {
      throw new Error(`A08 overlay should name concrete algebra objects, got: ${a08.overlayText}`);
    }
    requireFiniteNumbers(a08.snapshot, [
      "closureScore",
      "identityElement",
      "quotientCosetCount",
      "homomorphismLawResidual",
      "actionOrbitLength",
      "fieldIndicator"
    ], "A08 telemetry");
    if (
      a08.snapshot.associativityChecked !== true ||
      !a08.snapshot.inversePairHash ||
      !a08.snapshot.unitSetHash ||
      !a08.snapshot.zeroDivisorHash ||
      !a08.snapshot.generatorOrbitHash ||
      !a08.snapshot.stabilizerHash ||
      !a08.snapshot.kernelHash ||
      a08.snapshot.firstIsoCheck !== true
    ) {
      throw new Error(`A08 should expose algebra diagnostics, got: ${JSON.stringify(a08.snapshot)}.`);
    }
  } finally {
    await browser.close();
  }
  console.log("a07-a08 visual clarity passed: differential geometry and algebra labs expose concrete canonical objects and fit the iframe.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
