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
    const f11 = await loadLab(page, "f11-discrete-calculus-lab.html", "__f11LabReady", "__f11LabSnapshot");
    if (f11.bytes < 15000 || f11.overflowX > 18 || f11.overflowY > 18) {
      throw new Error(`F11 clarity render is weak or does not fit: ${JSON.stringify(f11)}.`);
    }
    if (f11.snapshot.clarityVersion !== "f11-f12-physical-clarity-v2" || f11.snapshot.visualScaffoldCount < 9) {
      throw new Error(`F11 missing physical discrete-calculus scaffold: ${JSON.stringify(f11.snapshot)}.`);
    }
    requireIncludes(f11.snapshot.visualRoles, [
      "0-cochain scalar potential towers",
      "oriented 1-cochain edge-flow arrows",
      "2-cochain face curl panel",
      "incidence matrix B0 signed board",
      "face incidence matrix B1 signed board",
      "d0 gradient conveyor",
      "minus B0 divergence rings",
      "d1 d0 equals zero cancellation witness",
      "Hodge exact coexact harmonic split rack",
      "Hodge 1-Laplacian energy meter"
    ], "F11");
    requireIncludes(f11.snapshot.clarityLabels, [
      "C0",
      "C1",
      "C2",
      "B0",
      "B1",
      "d0 f",
      "-B0 F",
      "B1^T F",
      "d1 d0=0",
      "exact",
      "coexact",
      "harmonic",
      "L1"
    ], "F11");
    if (!/0-cochain|1-cochain|2-cochain|B0\/B1|Hodge split/i.test(f11.overlayText)) {
      throw new Error(`F11 overlay should name physical discrete-calculus objects, got: ${f11.overlayText}`);
    }
    if (!f11.snapshot.incidenceShape || !f11.snapshot.faceIncidenceShape || f11.snapshot.boundaryOfBoundaryZero !== true) {
      throw new Error(`F11 should expose B0, B1, and B0B1=0 telemetry, got: ${JSON.stringify(f11.snapshot)}.`);
    }
    if (!f11.snapshot.hodgeComponentHash || !f11.snapshot.operatorEnergyHash) {
      throw new Error(`F11 should expose Hodge split and operator energy telemetry, got: ${JSON.stringify(f11.snapshot)}.`);
    }

    const f12 = await loadLab(page, "f12-graphon-sampling-lab.html", "__f12LabReady", "__f12LabSnapshot");
    if (f12.bytes < 17000 || f12.overflowX > 18 || f12.overflowY > 18) {
      throw new Error(`F12 clarity render is weak or does not fit: ${JSON.stringify(f12)}.`);
    }
    if (f12.snapshot.clarityVersion !== "f11-f12-physical-clarity-v2" || f12.snapshot.visualScaffoldCount < 10) {
      throw new Error(`F12 missing physical graphon scaffold: ${JSON.stringify(f12.snapshot)}.`);
    }
    requireIncludes(f12.snapshot.visualRoles, [
      "continuous graphon W(x,y) probability surface",
      "latent coordinate ruler U_i",
      "Bernoulli edge draw coins",
      "finite sampled graph G(n,W)",
      "ordered adjacency matrix from latent order",
      "permuted adjacency matrix exchangeability",
      "step graphon blocky finite approximation",
      "second noisy draw same W",
      "degree function row integral curve",
      "cut norm rectangle discrepancy panel",
      "subgraph density triangle counter"
    ], "F12");
    requireIncludes(f12.snapshot.clarityLabels, [
      "W(x,y)",
      "U_i",
      "Bernoulli",
      "A_ij",
      "G(n,W)",
      "step graphon",
      "phi relabeling",
      "d_W(x)",
      "t(K3,W)",
      "cut norm"
    ], "F12");
    if (!/Graphon surface|Latent ruler|Step graphon|Cut rectangle|Degree curve/i.test(f12.overlayText)) {
      throw new Error(`F12 overlay should name physical graphon objects, got: ${f12.overlayText}`);
    }
    if (!f12.snapshot.graphonGridShape || f12.snapshot.latentCount !== f12.snapshot.nodeCount || !f12.snapshot.degreeFunctionHash) {
      throw new Error(`F12 should expose graphon grid, latent coordinates, and degree-function telemetry, got: ${JSON.stringify(f12.snapshot)}.`);
    }
    if (!f12.snapshot.stepGraphonCellCount || !f12.snapshot.cutRectangleMass || f12.snapshot.relabelingInvariantDensity !== true) {
      throw new Error(`F12 should expose step graphon, cut rectangle, and relabeling telemetry, got: ${JSON.stringify(f12.snapshot)}.`);
    }
  } finally {
    await browser.close();
  }
  console.log("f11-f12 visual clarity passed: discrete-calculus and graphon labs expose beginner-readable physical scaffolds and fit the iframe.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
