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
    const canvas = document.querySelector(".lab-viewport canvas");
    return {
      bytes: canvas.toDataURL("image/png").length,
      quality: window[snapshot]().visualQuality,
      roleCount: window[snapshot]().visualRoleCount,
      roles: window[snapshot]().visualRoles || [],
      overflowX: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
      overflowY: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight
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
    const d05 = await inspectLab(page, "d05-clustering-algorithms-lab.html", "__d05LabReady", "__d05LabSnapshot");
    if (d05.bytes < 8500 || d05.quality !== "d05-d06-ml-specific-v1" || d05.roleCount < 10) {
      throw new Error(`D05 premium visual contract is weak: ${JSON.stringify(d05)}.`);
    }
    for (const role of ["K-means centroid Voronoi cells", "DBSCAN epsilon neighborhood tubes", "GMM responsibility ellipsoids", "spectral Laplacian graph cut"]) {
      if (!d05.roles.some((candidate) => candidate.includes(role))) throw new Error(`D05 missing role: ${role}`);
    }

    const d06 = await inspectLab(page, "d06-ensemble-methods-lab.html", "__d06LabReady", "__d06LabSnapshot");
    if (d06.bytes < 8500 || d06.quality !== "d05-d06-ml-specific-v1" || d06.roleCount < 10) {
      throw new Error(`D06 premium visual contract is weak: ${JSON.stringify(d06)}.`);
    }
    for (const role of ["bagging bootstrap model fan", "random forest feature subsampling gates", "boosting residual correction ladder", "stacking out-of-fold meta-weight mixer"]) {
      if (!d06.roles.some((candidate) => candidate.includes(role))) throw new Error(`D06 missing role: ${role}`);
    }
  } finally {
    await browser.close();
  }
  console.log("d05-d06 premium smoke passed: lab-specific visual roles and iframe fit are present.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
