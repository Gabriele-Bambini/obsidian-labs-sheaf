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
  await page.waitForTimeout(260);
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
    const a01 = await loadLab(page, "a01-linear-algebra-foundations-lab.html", "__a01LabReady", "__a01LabSnapshot");
    if (a01.bytes < 15500 || a01.overflowX > 18 || a01.overflowY > 18) {
      throw new Error(`A01 clarity render is weak or does not fit: ${JSON.stringify(a01)}.`);
    }
    if (
      a01.snapshot.clarityVersion !== "a01-a02-canonical-clarity-v1" ||
      a01.snapshot.legacyClarityVersion !== "a01-a02-physical-clarity-v2" ||
      a01.snapshot.visualScaffoldCount < 11
    ) {
      throw new Error(`A01 missing physical linear-algebra scaffold: ${JSON.stringify(a01.snapshot)}.`);
    }
    requireIncludes(a01.snapshot.visualRoles, [
      "basis triad e1 e2 e3",
      "3D coordinate grid and origin",
      "vector v coordinate arrow",
      "linear combination parallelogram",
      "span plane through basis directions",
      "matrix columns action board",
      "rank-nullspace collapse gate",
      "projection foot on subspace",
      "orthogonal residual segment",
      "dot product angle meter",
      "determinant area-volume tile"
    ], "A01");
    requireIncludes(a01.snapshot.clarityLabels, [
      "v",
      "e1",
      "e2",
      "e3",
      "span",
      "Av",
      "rank",
      "nullspace",
      "proj",
      "residual",
      "dot",
      "det"
    ], "A01");
    requireIncludes(a01.rail, ["Vector", "Basis", "Span", "Projection", "Rank/nullspace"], "A01 rail");
    if (!/Vector|Basis|Span|Projection|Rank\/nullspace/i.test(a01.overlayText)) {
      throw new Error(`A01 overlay should name physical linear-algebra objects, got: ${a01.overlayText}`);
    }
    if (!Array.isArray(a01.snapshot.coordinateVector) || a01.snapshot.coordinateVector.length !== 3) {
      throw new Error(`A01 should expose coordinate vector telemetry, got: ${JSON.stringify(a01.snapshot)}.`);
    }
    if (!a01.snapshot.basisMatrix || !a01.snapshot.linearCombinationHash || !a01.snapshot.projectionResidualOrthogonal) {
      throw new Error(`A01 should expose basis, linear combination, and projection telemetry, got: ${JSON.stringify(a01.snapshot)}.`);
    }
    if (!a01.snapshot.rankNullityCheck || !Number.isFinite(a01.snapshot.determinantArea) || !Number.isFinite(a01.snapshot.dotProductValue)) {
      throw new Error(`A01 should expose rank/nullity, determinant, and dot-product telemetry, got: ${JSON.stringify(a01.snapshot)}.`);
    }

    const a02 = await loadLab(page, "a02-linear-map-grid.html", "__a02LabReady", "__a02LabSnapshot");
    if (a02.bytes < 15500 || a02.overflowX > 18 || a02.overflowY > 18) {
      throw new Error(`A02 clarity render is weak or does not fit: ${JSON.stringify(a02)}.`);
    }
    if (
      a02.snapshot.clarityVersion !== "a01-a02-canonical-clarity-v1" ||
      a02.snapshot.legacyClarityVersion !== "a01-a02-physical-clarity-v2" ||
      a02.snapshot.visualScaffoldCount < 12
    ) {
      throw new Error(`A02 missing physical vector-space/linear-map scaffold: ${JSON.stringify(a02.snapshot)}.`);
    }
    requireIncludes(a02.snapshot.visualRoles, [
      "abstract vector-space object shelf",
      "subspace closure plane through origin",
      "non-subspace affine line warning",
      "linear map preserves addition and scaling",
      "kernel collapse tunnel",
      "image reachable output plane",
      "rank-nullity balance scale",
      "coordinate basis change bridge",
      "dual functional measuring plane",
      "quotient space coset stack",
      "isomorphism reversible bridge",
      "domain codomain transformation grid"
    ], "A02");
    requireIncludes(a02.snapshot.clarityLabels, [
      "V",
      "W",
      "T",
      "kernel",
      "image",
      "rank+nullity",
      "basis",
      "coordinates",
      "dual",
      "quotient",
      "isomorphism"
    ], "A02");
    requireIncludes(a02.rail, ["Vector space", "Linear map", "Kernel", "Image", "Dual/quotient"], "A02 rail");
    if (!/Vector space|Linear map|Kernel|Image|Dual\/quotient/i.test(a02.overlayText)) {
      throw new Error(`A02 overlay should name physical vector-space objects, got: ${a02.overlayText}`);
    }
    if (a02.snapshot.domainDimension !== 3 || a02.snapshot.codomainDimension !== 3 || !a02.snapshot.rankNullityCheck) {
      throw new Error(`A02 should expose rank-nullity telemetry, got: ${JSON.stringify(a02.snapshot)}.`);
    }
    if (!a02.snapshot.kernelVectorHash || !a02.snapshot.imageBasisHash || !a02.snapshot.basisChangeMatrixHash) {
      throw new Error(`A02 should expose kernel/image/basis-change telemetry, got: ${JSON.stringify(a02.snapshot)}.`);
    }
    if (!Number.isFinite(a02.snapshot.dualFunctionalValue) || !a02.snapshot.quotientCosetCount || a02.snapshot.linearityResidual > 1e-6) {
      throw new Error(`A02 should expose dual, quotient, and linearity telemetry, got: ${JSON.stringify(a02.snapshot)}.`);
    }
  } finally {
    await browser.close();
  }
  console.log("a01-a02 visual clarity passed: foundational linear algebra labs expose beginner-readable physical scaffolds and fit the iframe.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
