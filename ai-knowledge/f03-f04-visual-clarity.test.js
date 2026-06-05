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
    const f03 = await loadLab(page, "f03-graph-laplacian-energy.html", "__f03LabReady", "__f03LabSnapshot");
    if (f03.bytes < 15000 || f03.overflowX > 18 || f03.overflowY > 18) {
      throw new Error(`F03 clarity render is weak or does not fit: ${JSON.stringify(f03)}.`);
    }
    if (f03.snapshot.clarityVersion !== "f03-f04-physical-clarity-v2" || f03.snapshot.visualScaffoldCount < 7) {
      throw new Error(`F03 missing physical clarity scaffold: ${JSON.stringify(f03.snapshot)}.`);
    }
    requireIncludes(f03.snapshot.visualRoles, [
      "beginner signal pillars",
      "edge spring disagreement gauges",
      "Lx force-arrow forest",
      "matrix wall D minus A",
      "heat descent runway",
      "component-average nullspace deck",
      "energy ledger basin"
    ], "F03");
    requireIncludes(f03.snapshot.clarityLabels, [
      "x_i node values",
      "edge difference",
      "Lx force",
      "x^T L x",
      "x <- x - alpha Lx",
      "component average"
    ], "F03");
    if (!/Signal pillars|Edge springs|Heat runway|Nullspace deck/i.test(f03.overlayText)) {
      throw new Error(`F03 overlay should name physical objects, got: ${f03.overlayText}`);
    }

    const f04 = await loadLab(page, "f04-spectral-embedding.html", "__f04LabReady", "__f04LabSnapshot");
    if (f04.bytes < 15000 || f04.overflowX > 18 || f04.overflowY > 18) {
      throw new Error(`F04 clarity render is weak or does not fit: ${JSON.stringify(f04)}.`);
    }
    if (f04.snapshot.clarityVersion !== "f03-f04-physical-clarity-v2" || f04.snapshot.visualScaffoldCount < 7) {
      throw new Error(`F04 missing physical clarity scaffold: ${JSON.stringify(f04.snapshot)}.`);
    }
    requireIncludes(f04.snapshot.visualRoles, [
      "graph-to-Fiedler coordinate conveyor",
      "u2-u3 embedding floor",
      "lambda ladder with highlighted lambda2",
      "Fiedler sign-cut gate",
      "Cheeger conductance scale",
      "heat-mode decay runway",
      "chain-versus-community comparison rail"
    ], "F04");
    requireIncludes(f04.snapshot.clarityLabels, [
      "u2 Fiedler coordinate",
      "u3 second coordinate",
      "lambda2 gap",
      "sign cut",
      "conductance",
      "exp(-lambda t)"
    ], "F04");
    if (!/Fiedler conveyor|Embedding floor|Lambda ladder|Heat decay/i.test(f04.overlayText)) {
      throw new Error(`F04 overlay should name physical objects, got: ${f04.overlayText}`);
    }
  } finally {
    await browser.close();
  }
  console.log("f03-f04 visual clarity passed: Laplacian and spectral labs expose beginner-readable physical scaffolds and fit the iframe.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
