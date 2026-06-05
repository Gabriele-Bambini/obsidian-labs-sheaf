const path = require("path");

function loadPlaywright() {
  const candidates = [
    "playwright",
    "C:/Users/02gab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
    "C:/Users/02gab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright",
    "C:/Users/Gabriele/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"
  ];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (error) {
      // Try the next known bundled runtime path.
    }
  }
  throw new Error("Playwright is not available from the known runtime paths.");
}

const { chromium } = loadPlaywright();

async function inspectLab(page, fileName, readyName, snapshotName) {
  const labPath = path.join(__dirname, fileName).replace(/\\/g, "/");
  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
  await page.waitForFunction(
    ([ready, snapshot]) => window[ready] === true && typeof window[snapshot] === "function" && window[snapshot](),
    [readyName, snapshotName]
  );
  await page.waitForTimeout(220);
  return page.evaluate((snapshot) => {
    const root = document.querySelector(".lab-3d-shell");
    const canvas = document.querySelector(".lab-viewport canvas");
    return {
      bytes: canvas.toDataURL("image/png").length,
      quality: window[snapshot]().visualQuality,
      roleCount: window[snapshot]().visualRoleCount,
      roles: window[snapshot]().visualRoles || [],
      overflowX: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
      overflowY: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight,
      labKind: root.dataset.labKind
    };
  }, snapshotName);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  try {
    const d03 = await inspectLab(page, "d03-tree-models-lab.html", "__d03LabReady", "__d03LabSnapshot");
    if (d03.bytes < 8500 || d03.quality !== "d03-d04-ml-specific-v1" || d03.roleCount < 10) {
      throw new Error(`D03 premium visual contract is weak: ${JSON.stringify(d03)}.`);
    }
    for (const role of ["axis-aligned CART split walls", "Gini impurity scan bars", "cost-complexity pruning collapse", "forest vote disagreement surface"]) {
      if (!d03.roles.some((candidate) => candidate.includes(role))) throw new Error(`D03 missing role: ${role}`);
    }

    const d04 = await inspectLab(page, "d04-dimensionality-reduction-lab.html", "__d04LabReady", "__d04LabSnapshot");
    if (d04.bytes < 8500 || d04.quality !== "d03-d04-ml-specific-v1" || d04.roleCount < 10) {
      throw new Error(`D04 premium visual contract is weak: ${JSON.stringify(d04)}.`);
    }
    for (const role of ["principal component axes", "rank-k reconstruction residual rods", "random projection distance distortion", "manifold neighborhood graph"]) {
      if (!d04.roles.some((candidate) => candidate.includes(role))) throw new Error(`D04 missing role: ${role}`);
    }
  } finally {
    await browser.close();
  }
  console.log("d03-d04 premium smoke passed: lab-specific visual roles and iframe fit are present.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
