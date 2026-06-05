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
    const f07 = await loadLab(page, "f07-graph-signal-filtering.html", "__f07LabReady", "__f07LabSnapshot");
    if (f07.bytes < 15000 || f07.overflowX > 18 || f07.overflowY > 18) {
      throw new Error(`F07 clarity render is weak or does not fit: ${JSON.stringify(f07)}.`);
    }
    if (f07.snapshot.clarityVersion !== "f07-f08-physical-clarity-v2" || f07.snapshot.visualScaffoldCount < 8) {
      throw new Error(`F07 missing physical GSP scaffold: ${JSON.stringify(f07.snapshot)}.`);
    }
    requireIncludes(f07.snapshot.visualRoles, [
      "graph signal node-height columns",
      "Laplacian edge-disagreement rods",
      "U^T x Fourier coefficient rack",
      "h(lambda) gain curve gate",
      "inverse reconstruction lane",
      "heat kernel exp(-tL) decay runway",
      "localized wavelet impulse rings",
      "polynomial K-hop locality shells"
    ], "F07");
    requireIncludes(f07.snapshot.clarityLabels, [
      "x_i",
      "edge difference",
      "U^T x",
      "h(lambda)",
      "U h(lambda) U^T x",
      "exp(-tL)",
      "delta_v",
      "K-hop"
    ], "F07");
    if (!/Signal towers|GFT rack|Gain gate|Heat runway|Wavelet rings/i.test(f07.overlayText)) {
      throw new Error(`F07 overlay should name physical GSP objects, got: ${f07.overlayText}`);
    }
    if (f07.snapshot.eigenResidualMax > 1e-6 || f07.snapshot.orthonormalityError > 1e-6 || f07.snapshot.lambdaSorted !== true) {
      throw new Error(`F07 should use a true Laplacian eigensystem, got: ${JSON.stringify({
        eigenResidualMax: f07.snapshot.eigenResidualMax,
        orthonormalityError: f07.snapshot.orthonormalityError,
        lambdaSorted: f07.snapshot.lambdaSorted
      })}`);
    }
    if (!f07.snapshot.signedCoefficientColors || !f07.snapshot.filterGainMonotonic || f07.snapshot.heatDecayHighLessThanLow !== true) {
      throw new Error(`F07 should expose signed GFT coefficients and physically correct low-pass/heat decay markers: ${JSON.stringify(f07.snapshot)}.`);
    }

    const f08 = await loadLab(page, "f08-network-centrality-communities.html", "__f08LabReady", "__f08LabSnapshot");
    if (f08.bytes < 15000 || f08.overflowX > 18 || f08.overflowY > 18) {
      throw new Error(`F08 clarity render is weak or does not fit: ${JSON.stringify(f08)}.`);
    }
    if (f08.snapshot.clarityVersion !== "f07-f08-physical-clarity-v2" || f08.snapshot.visualScaffoldCount < 8) {
      throw new Error(`F08 missing physical network-science scaffold: ${JSON.stringify(f08.snapshot)}.`);
    }
    requireIncludes(f08.snapshot.visualRoles, [
      "centrality process selector towers",
      "degree exposure skyline",
      "betweenness shortest-path traffic bridge",
      "closeness distance basin",
      "eigenvector prestige glow",
      "community modularity basin plates",
      "triangle clustering counter",
      "small-world shortcut ruler",
      "assortativity mixing board",
      "degree-aware null comparator"
    ], "F08");
    requireIncludes(f08.snapshot.clarityLabels, [
      "degree",
      "closeness",
      "betweenness",
      "eigenvector",
      "shortest paths",
      "triangles",
      "communities",
      "average path",
      "assortativity",
      "null model"
    ], "F08");
    if (!/Centrality towers|Bridge traffic|Triangle counter|Small-world ruler|Null baseline/i.test(f08.overlayText)) {
      throw new Error(`F08 overlay should name physical network-science objects, got: ${f08.overlayText}`);
    }
  } finally {
    await browser.close();
  }
  console.log("f07-f08 visual clarity passed: GSP and network-science labs expose beginner-readable physical scaffolds and fit the iframe.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
