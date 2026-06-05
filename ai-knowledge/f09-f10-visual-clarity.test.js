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
  await page.waitForTimeout(240);
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
    const f09 = await loadLab(page, "f09-hypergraph-incidence-lab.html", "__f09LabReady", "__f09LabSnapshot");
    if (f09.bytes < 15000 || f09.overflowX > 18 || f09.overflowY > 18) {
      throw new Error(`F09 clarity render is weak or does not fit: ${JSON.stringify(f09)}.`);
    }
    if (f09.snapshot.clarityVersion !== "f09-f10-physical-clarity-v2" || f09.snapshot.visualScaffoldCount < 8) {
      throw new Error(`F09 missing physical hypergraph scaffold: ${JSON.stringify(f09.snapshot)}.`);
    }
    requireIncludes(f09.snapshot.visualRoles, [
      "incidence matrix H as node-hyperedge board",
      "translucent hyperedge set sheets",
      "star expansion bipartite lift",
      "clique expansion pairwise shadow",
      "node-to-hyperedge aggregation conveyor",
      "hyperedge-to-node broadcast conveyor",
      "normalization size-degree scale",
      "overlap vertex participation lens",
      "hypergraph Laplacian smoothness energy"
    ], "F09");
    requireIncludes(f09.snapshot.clarityLabels, [
      "H",
      "v in e",
      "node -> hyperedge",
      "hyperedge -> node",
      "D_v",
      "D_e",
      "star expansion",
      "clique expansion",
      "L_H"
    ], "F09");
    if (!/Incidence board|Hyperedge sheets|Star lift|Clique shadow|Broadcast/i.test(f09.overlayText)) {
      throw new Error(`F09 overlay should name physical hypergraph objects, got: ${f09.overlayText}`);
    }
    if (!f09.snapshot.incidenceMatrixShape || f09.snapshot.incidenceMatrixShape !== "12x5") {
      throw new Error(`F09 should expose incidence matrix shape 12x5, got: ${JSON.stringify(f09.snapshot)}.`);
    }
    if (f09.snapshot.starLiftEdgeCount !== f09.snapshot.incidenceCount || f09.snapshot.cliqueShadowEdgeCount !== f09.snapshot.cliqueEdges) {
      throw new Error(`F09 expansion counts should match incidence/clique algebra: ${JSON.stringify(f09.snapshot)}.`);
    }
    if (!(f09.snapshot.normalizationVectorHash || "").includes("Dv") || !(f09.snapshot.normalizationVectorHash || "").includes("De")) {
      throw new Error(`F09 should expose D_v and D_e normalization vectors, got: ${JSON.stringify(f09.snapshot)}.`);
    }

    const f10 = await loadLab(page, "f10-persistent-homology-filtration.html", "__f10LabReady", "__f10LabSnapshot");
    if (f10.bytes < 15000 || f10.overflowX > 18 || f10.overflowY > 18) {
      throw new Error(`F10 clarity render is weak or does not fit: ${JSON.stringify(f10)}.`);
    }
    if (f10.snapshot.clarityVersion !== "f09-f10-physical-clarity-v2" || f10.snapshot.visualScaffoldCount < 8) {
      throw new Error(`F10 missing physical persistent-homology scaffold: ${JSON.stringify(f10.snapshot)}.`);
    }
    requireIncludes(f10.snapshot.visualRoles, [
      "growing radius balls filtration",
      "Vietoris-Rips edge threshold",
      "filled triangle death cap",
      "component merge tree",
      "loop birth death ring",
      "barcode interval rack",
      "persistence diagram plane",
      "Betti counter dashboard",
      "noise versus persistent feature comparator"
    ], "F10");
    requireIncludes(f10.snapshot.clarityLabels, [
      "epsilon",
      "Rips",
      "Cech",
      "H0",
      "H1",
      "birth",
      "death",
      "barcode",
      "persistence diagram",
      "Betti"
    ], "F10");
    if (!/Radius balls|Rips edges|Loop birth|Triangle death|Barcode rack/i.test(f10.overlayText)) {
      throw new Error(`F10 overlay should name physical TDA objects, got: ${f10.overlayText}`);
    }
    if (!f10.snapshot.filtrationObjectCounts || f10.snapshot.filtrationObjectCounts.points < 8) {
      throw new Error(`F10 should expose concrete filtration object counts, got: ${JSON.stringify(f10.snapshot)}.`);
    }
    if (!f10.snapshot.diagramPointHash || !f10.snapshot.barcodeIntervalHash || !f10.snapshot.bettiCurveHash) {
      throw new Error(`F10 should expose barcode, persistence diagram, and Betti curve telemetry, got: ${JSON.stringify(f10.snapshot)}.`);
    }
  } finally {
    await browser.close();
  }
  console.log("f09-f10 visual clarity passed: hypergraph and TDA labs expose beginner-readable physical scaffolds and fit the iframe.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
