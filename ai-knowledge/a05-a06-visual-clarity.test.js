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
    const a05 = await loadLab(page, "a05-functional-analysis-operator-lab.html", "__a05LabReady", "__a05LabSnapshot");
    if (a05.bytes < 15500 || a05.overflowX > 18 || a05.overflowY > 18) {
      throw new Error(`A05 clarity render is weak or does not fit: ${JSON.stringify(a05)}.`);
    }
    if (
      a05.snapshot.clarityVersion !== "a05-a06-canonical-clarity-v1" ||
      a05.snapshot.legacyClarityVersion !== "a05-a06-physical-clarity-v2" ||
      a05.snapshot.visualScaffoldCount < 12
    ) {
      throw new Error(`A05 missing concrete functional-analysis scaffold: ${JSON.stringify(a05.snapshot)}.`);
    }
    requireIncludes(a05.snapshot.visualRoles, [
      "function-space waveform lane",
      "Hilbert inner-product geometry plane",
      "Banach norm comparison meter",
      "orthonormal basis sine mode rack",
      "basis coefficient input tower",
      "bounded operator norm unit-ball gauge",
      "compact smoothing high-mode damper",
      "derivative high-frequency amplifier",
      "closed subspace projection plane",
      "orthogonal residual magnitude",
      "dual Riesz representer waveform",
      "RKHS representer finite span",
      "weak convergence functional probes"
    ], "A05");
    requireIncludes(a05.snapshot.clarityLabels, [
      "f(t)",
      "L1",
      "L2",
      "Linf",
      "e_k",
      "a_k",
      "T",
      "||T||",
      "compact",
      "D",
      "P_C f",
      "ell(f)",
      "k_x",
      "weak"
    ], "A05");
    requireIncludes(a05.rail, ["Function f", "Norms", "Basis", "Operator T", "Projection", "Dual/RKHS"], "A05 rail");
    requireIncludes(a05.railAliases, ["function f", "basis coefficients", "operator T", "projection", "dual functional"], "A05 legacy rail");
    if (!/Function f|Norms|Basis|Operator T|Projection|Dual\/RKHS/i.test(a05.overlayText)) {
      throw new Error(`A05 overlay should name concrete function-space objects, got: ${a05.overlayText}`);
    }
    if (!a05.snapshot.functionalNormLedger || !a05.snapshot.basisCoefficientHash || !a05.snapshot.operatorOutputHash) {
      throw new Error(`A05 should expose norms and coefficient hashes, got: ${JSON.stringify(a05.snapshot)}.`);
    }
    requireFiniteNumbers(a05.snapshot.functionalNormLedger, ["l1", "l2", "linf"], "A05 norm ledger");
    requireFiniteNumbers(a05.snapshot, ["operatorGain", "dualScalar", "derivativeAmplification"], "A05 telemetry");
    if (a05.snapshot.projectionResidualOrthogonal !== true || a05.snapshot.boundedOperatorCondition !== true) {
      throw new Error(`A05 should expose Hilbert projection and bounded-operator diagnostics, got: ${JSON.stringify(a05.snapshot)}.`);
    }
    if (!a05.snapshot.rieszRepresenterHash || !a05.snapshot.compactDecayHash || !a05.snapshot.weakProbeHash || a05.snapshot.rkhsFiniteSpanCount < 2) {
      throw new Error(`A05 should expose dual/RKHS/compact/weak telemetry, got: ${JSON.stringify(a05.snapshot)}.`);
    }

    const a06 = await loadLab(page, "a06-topology-neighborhood-lab.html", "__a06LabReady", "__a06LabSnapshot");
    if (a06.bytes < 15500 || a06.overflowX > 18 || a06.overflowY > 18) {
      throw new Error(`A06 clarity render is weak or does not fit: ${JSON.stringify(a06)}.`);
    }
    if (
      a06.snapshot.clarityVersion !== "a05-a06-canonical-clarity-v1" ||
      a06.snapshot.legacyClarityVersion !== "a05-a06-physical-clarity-v2" ||
      a06.snapshot.visualScaffoldCount < 12
    ) {
      throw new Error(`A06 missing concrete topology scaffold: ${JSON.stringify(a06.snapshot)}.`);
    }
    requireIncludes(a06.snapshot.visualRoles, [
      "topological space X point-set floor",
      "topology tau open-set rack",
      "basis open interval generator",
      "neighborhood ball around point x",
      "boundary two-sided contact markers",
      "continuity target open set V",
      "preimage f inverse V open strip",
      "open cover family tiles",
      "finite subcover selected plates",
      "compactness finite control witness",
      "connected split separated open sets",
      "quotient interval endpoints glue path",
      "quotient circle image",
      "topological invariant board"
    ], "A06");
    requireIncludes(a06.snapshot.clarityLabels, [
      "X",
      "tau",
      "basis",
      "N(x)",
      "dU",
      "Y",
      "V",
      "f^-1(V)",
      "cover",
      "finite subcover",
      "connected?",
      "0~1",
      "S1",
      "invariants"
    ], "A06");
    requireIncludes(a06.rail, ["Space X", "Open sets", "Neighborhoods", "Preimage continuity", "Compact subcover", "Quotient"], "A06 rail");
    requireIncludes(a06.railAliases, ["space X", "open neighborhoods", "boundary", "preimage test", "finite subcover"], "A06 legacy rail");
    if (!/Space X|Open sets|Neighborhoods|Preimage continuity|Compact subcover|Quotient/i.test(a06.overlayText)) {
      throw new Error(`A06 overlay should name concrete topology objects, got: ${a06.overlayText}`);
    }
    requireFiniteNumbers(a06.snapshot, [
      "neighborhoodRadius",
      "finiteSubcoverSize",
      "continuityScore",
      "openSetCount",
      "basisSetCount",
      "boundaryPointCount",
      "connectedComponentCount"
    ], "A06 telemetry");
    if (
      a06.snapshot.topologyAxiomsSatisfied !== true ||
      a06.snapshot.preimageOpen !== true ||
      a06.snapshot.circleBoundaryRemoved !== true ||
      !a06.snapshot.quotientIdentificationHash ||
      !a06.snapshot.invariantHash
    ) {
      throw new Error(`A06 should expose topology/preimage/quotient diagnostics, got: ${JSON.stringify(a06.snapshot)}.`);
    }
  } finally {
    await browser.close();
  }
  console.log("a05-a06 visual clarity passed: functional analysis and topology labs expose concrete canonical objects and fit the iframe.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
