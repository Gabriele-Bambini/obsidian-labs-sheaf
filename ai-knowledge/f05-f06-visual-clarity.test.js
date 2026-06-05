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
    const f05 = await loadLab(page, "f05-graph-clustering-lab.html", "__f05LabReady", "__f05LabSnapshot");
    if (f05.bytes < 15000 || f05.overflowX > 18 || f05.overflowY > 18) {
      throw new Error(`F05 clarity render is weak or does not fit: ${JSON.stringify(f05)}.`);
    }
    if (f05.snapshot.clarityVersion !== "f05-f06-physical-clarity-v2" || f05.snapshot.visualScaffoldCount < 8) {
      throw new Error(`F05 missing physical clarity scaffold: ${JSON.stringify(f05.snapshot)}.`);
    }
    requireIncludes(f05.snapshot.visualRoles, [
      "partition basin islands",
      "cut edge toll gate",
      "conductance numerator denominator scale",
      "modularity internal density reservoir",
      "Fiedler coordinate sorting ribbon",
      "spectral embedding k-means basins",
      "singleton trap warning rail",
      "noise stability ghost edges"
    ], "F05");
    requireIncludes(f05.snapshot.clarityLabels, [
      "S",
      "V\\S",
      "cut(S,V\\S)",
      "vol(S)",
      "phi(S)",
      "Q modularity",
      "u2 Fiedler",
      "k-means"
    ], "F05");
    if (!/Partition basins|Cut toll|Conductance scale|Fiedler ribbon|K-means basins/i.test(f05.overlayText)) {
      throw new Error(`F05 overlay should name physical graph-clustering objects, got: ${f05.overlayText}`);
    }

    const f06 = await loadLab(page, "f06-random-graph-models-lab.html", "__f06LabReady", "__f06LabSnapshot");
    if (f06.bytes < 15000 || f06.overflowX > 18 || f06.overflowY > 18) {
      throw new Error(`F06 clarity render is weak or does not fit: ${JSON.stringify(f06)}.`);
    }
    if (f06.snapshot.clarityVersion !== "f05-f06-physical-clarity-v2" || f06.snapshot.visualScaffoldCount < 8) {
      throw new Error(`F06 missing physical clarity scaffold: ${JSON.stringify(f06.snapshot)}.`);
    }
    requireIncludes(f06.snapshot.visualRoles, [
      "Erdos-Renyi p sprinkler",
      "giant component phase gate",
      "Watts-Strogatz rewiring bridge",
      "Barabasi-Albert attachment magnet",
      "degree histogram tower",
      "clustering coefficient triangle counter",
      "path length small-world ruler",
      "SBM block probability wall"
    ], "F06");
    requireIncludes(f06.snapshot.clarityLabels, [
      "G(n,p)",
      "p",
      "giant component",
      "rewire beta",
      "preferential attachment",
      "degree distribution",
      "clustering",
      "path length"
    ], "F06");
    if (!/ER sprinkler|Giant gate|Small-world ruler|Attachment magnet|Block matrix/i.test(f06.overlayText)) {
      throw new Error(`F06 overlay should name physical random-graph objects, got: ${f06.overlayText}`);
    }
  } finally {
    await browser.close();
  }
  console.log("f05-f06 visual clarity passed: clustering and random-graph labs expose beginner-readable physical scaffolds and fit the iframe.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
