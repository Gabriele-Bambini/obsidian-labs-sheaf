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
    const d07 = await inspectLab(page, "d07-metric-learning-lab.html", "__d07LabReady", "__d07LabSnapshot");
    if (d07.bytes < 8500 || d07.quality !== "d07-d08-ml-specific-v1" || d07.roleCount < 10) {
      throw new Error(`D07 premium visual contract is weak: ${JSON.stringify(d07)}.`);
    }
    for (const role of ["Mahalanobis metric ellipse", "anchor-positive pull cable", "anchor-negative margin shell", "hard-negative mining spotlight", "proxy class angular margin sphere"]) {
      if (!d07.roles.some((candidate) => candidate.includes(role))) throw new Error(`D07 missing role: ${role}`);
    }

    const d08 = await inspectLab(page, "d08-learning-theory-lab.html", "__d08LabReady", "__d08LabSnapshot");
    if (d08.bytes < 8500 || d08.quality !== "d07-d08-ml-specific-v1" || d08.roleCount < 10) {
      throw new Error(`D08 premium visual contract is weak: ${JSON.stringify(d08)}.`);
    }
    for (const role of ["empirical population risk gap bridge", "Hoeffding PAC confidence funnel", "VC shattering labeling cube", "Rademacher random-sign alignment field", "algorithmic stability perturbation beam"]) {
      if (!d08.roles.some((candidate) => candidate.includes(role))) throw new Error(`D08 missing role: ${role}`);
    }
  } finally {
    await browser.close();
  }
  console.log("d07-d08 premium smoke passed: lab-specific visual roles and iframe fit are present.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
