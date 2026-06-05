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
    const d09 = await inspectLab(page, "d09-regularization-lab.html", "__d09LabReady", "__d09LabSnapshot");
    if (d09.bytes < 8500 || d09.quality !== "d09-d10-ml-specific-v1" || d09.roleCount < 10) {
      throw new Error(`D09 premium visual contract is weak: ${JSON.stringify(d09)}.`);
    }
    for (const role of ["L2 ridge shrinkage bowl", "L1 lasso sparsity diamond", "elastic-net compromise corridor", "early-stopping optimization path", "bias-variance validation U-curve"]) {
      if (!d09.roles.some((candidate) => candidate.includes(role))) throw new Error(`D09 missing role: ${role}`);
    }

    const d10 = await inspectLab(page, "d10-model-selection-evaluation-lab.html", "__d10LabReady", "__d10LabSnapshot");
    if (d10.bytes < 8500 || d10.quality !== "d09-d10-ml-specific-v1" || d10.roleCount < 10) {
      throw new Error(`D10 premium visual contract is weak: ${JSON.stringify(d10)}.`);
    }
    for (const role of ["train validation test split firewall", "hyperparameter selection optimism surface", "cross-validation fold carousel", "nested-CV inner outer loops", "threshold calibration cost plane", "leakage forbidden evidence bridge"]) {
      if (!d10.roles.some((candidate) => candidate.includes(role))) throw new Error(`D10 missing role: ${role}`);
    }
  } finally {
    await browser.close();
  }
  console.log("d09-d10 premium smoke passed: lab-specific visual roles and iframe fit are present.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
