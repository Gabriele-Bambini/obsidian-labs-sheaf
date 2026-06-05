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
    const a11 = await loadLab(page, "a11-information-theory-lab.html", "__a11LabReady", "__a11LabSnapshot");
    if (a11.bytes < 15500 || a11.overflowX > 18 || a11.overflowY > 18) {
      throw new Error(`A11 clarity render is weak or does not fit: ${JSON.stringify(a11)}.`);
    }
    if (a11.snapshot.clarityVersion !== "a11-a12-canonical-clarity-v1" || a11.snapshot.legacyClarityVersion !== "a11-a12-concrete-clarity-v2" || a11.snapshot.visualScaffoldCount < 20) {
      throw new Error(`A11 missing concrete information-theory scaffold: ${JSON.stringify(a11.snapshot)}.`);
    }
    requireIncludes(a11.snapshot.visualRoles, [
      "data distribution p towers",
      "model distribution q towers",
      "self-information surprise spikes -log p",
      "Shannon code length rack",
      "typical set sequence slab",
      "cross-entropy coding bridge",
      "KL extra bits penalty braces",
      "log-likelihood sample beads",
      "joint distribution matrix p(x,y)",
      "product distribution independence matrix p(x)p(y)",
      "conditional entropy uncertainty reducer",
      "mutual information shared channel band",
      "noisy channel transition matrix",
      "input alphabet tokens",
      "output alphabet tokens",
      "channel capacity meter",
      "support mismatch infinite KL wall",
      "perplexity wheel",
      "information bottleneck compression gate",
      "entropy maximum uniform reference"
    ], "A11");
    requireIncludes(a11.snapshot.clarityLabels, [
      "p(x)",
      "q(x)",
      "-log p(x)",
      "H(p)",
      "H(p,q)",
      "D_KL",
      "extra bits",
      "samples",
      "typical set",
      "p(x,y)",
      "p(x)p(y)",
      "H(X|Y)",
      "I(X;Y)",
      "channel",
      "P(y|x)",
      "capacity",
      "perplexity",
      "support",
      "bottleneck"
    ], "A11");
    requireIncludes(a11.rail, ["P distribution", "Code lengths", "Cross entropy/KL", "Joint vs product", "Noisy channel", "Typical set"], "A11 rail");
    requireIncludes(a11.railAliases, ["distribution p", "model q", "code length", "KL penalty", "channel MI"], "A11 legacy rail");
    requireIncludes(a11.buttons, ["Show coding cost", "Send channel"], "A11 buttons");
    if (!/P distribution|Code lengths|Cross entropy\/KL|Joint vs product|Noisy channel|Typical set/i.test(a11.overlayText)) {
      throw new Error(`A11 overlay should name concrete information-theory objects, got: ${a11.overlayText}`);
    }
    requireFiniteNumbers(a11.snapshot, [
      "entropyBits",
      "crossEntropyBits",
      "klBits",
      "supportMismatchRisk",
      "typicalSetSizeEstimate",
      "perplexity",
      "mutualInformationBits",
      "conditionalEntropyBits",
      "channelCapacityBits",
      "jointProductGap",
      "bottleneckRetainedInfo"
    ], "A11 telemetry");
    if (
      a11.snapshot.klAsymmetryVisible !== true ||
      !a11.snapshot.distributionHash ||
      !a11.snapshot.codingIdentityHash ||
      !a11.snapshot.channelMatrixHash
    ) {
      throw new Error(`A11 should expose coding/channel diagnostics, got: ${JSON.stringify(a11.snapshot)}.`);
    }

    const a12 = await loadLab(page, "a12-algebraic-topology-lab.html", "__a12LabReady", "__a12LabSnapshot");
    if (a12.bytes < 15500 || a12.overflowX > 18 || a12.overflowY > 18) {
      throw new Error(`A12 clarity render is weak or does not fit: ${JSON.stringify(a12)}.`);
    }
    if (a12.snapshot.clarityVersion !== "a11-a12-canonical-clarity-v1" || a12.snapshot.legacyClarityVersion !== "a11-a12-concrete-clarity-v2" || a12.snapshot.visualScaffoldCount < 22) {
      throw new Error(`A12 missing concrete algebraic-topology scaffold: ${JSON.stringify(a12.snapshot)}.`);
    }
    requireIncludes(a12.snapshot.visualRoles, [
      "simplicial complex vertex set",
      "1-simplex edge skeleton",
      "2-simplex filled face killer",
      "chain group shelf C0",
      "chain group shelf C1",
      "chain group shelf C2",
      "boundary matrix partial_1 board",
      "boundary matrix partial_2 board",
      "oriented boundary arrows",
      "boundary of boundary zero cancellation",
      "cycle kernel loop Z1",
      "boundary image fill plate B1",
      "homology quotient gate H1=Z1/B1",
      "Betti counter towers beta0 beta1 beta2",
      "fundamental group basepoint loop",
      "winding number lift rail",
      "cochain dual probe",
      "coboundary delta arrow",
      "cup product tile",
      "filtration radius balls",
      "barcode interval rack",
      "persistence diagram birth-death plane"
    ], "A12");
    requireIncludes(a12.snapshot.clarityLabels, [
      "v0",
      "v1",
      "v2",
      "e01",
      "e12",
      "e02",
      "[v0v1v2]",
      "C0",
      "C1",
      "C2",
      "partial_1",
      "partial_2",
      "partial partial=0",
      "Z1",
      "B1",
      "H1=Z1/B1",
      "beta_0",
      "beta_1",
      "pi_1",
      "winding",
      "C^1",
      "delta",
      "cup",
      "radius",
      "barcode",
      "birth/death"
    ], "A12");
    requireIncludes(a12.rail, ["Simplices", "Chains Ck", "Boundary matrices", "Cycles/quotient", "Fundamental/cohomology", "Persistence"], "A12 rail");
    requireIncludes(a12.railAliases, ["simplicial complex", "chain groups", "boundary map", "cycle vs boundary", "barcode"], "A12 legacy rail");
    requireIncludes(a12.buttons, ["Show cycle", "Apply boundary"], "A12 buttons");
    if (!/Simplices|Chains Ck|Boundary matrices|Cycles\/quotient|Fundamental\/cohomology|Persistence/i.test(a12.overlayText)) {
      throw new Error(`A12 overlay should name concrete algebraic-topology objects, got: ${a12.overlayText}`);
    }
    requireFiniteNumbers(a12.snapshot, [
      "betti0",
      "betti1",
      "betti2",
      "boundaryRank",
      "boundarySquaredResidual",
      "cycleKernelDimension",
      "boundaryImageRank",
      "homologyDimension",
      "windingNumber",
      "cohomologyProbeValue",
      "persistenceSpan",
      "filtrationRadius"
    ], "A12 telemetry");
    if (
      a12.snapshot.boundaryOfBoundaryZero !== true ||
      !a12.snapshot.chainComplexHash ||
      !a12.snapshot.persistenceBarcodeHash ||
      !a12.snapshot.quotientHash
    ) {
      throw new Error(`A12 should expose chain-complex diagnostics, got: ${JSON.stringify(a12.snapshot)}.`);
    }
  } finally {
    await browser.close();
  }
  console.log("a11-a12 visual clarity passed: information theory and algebraic topology expose concrete canonical objects and fitted controls.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
