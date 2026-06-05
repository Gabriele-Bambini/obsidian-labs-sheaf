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

async function readLab(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector(".lab-viewport canvas");
    return {
      bytes: canvas.toDataURL("image/png").length,
      snapshot: window.__d07LabSnapshot(),
      stateText: document.querySelector("#stateBox").textContent.trim(),
      viewport: {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight
      }
    };
  });
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });

  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
    const labPath = path.join(__dirname, "d07-metric-learning-lab.html").replace(/\\/g, "/");
    await page.goto(`file:///${labPath}`);
    await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
    await page.waitForFunction(() => window.__d07LabReady === true && window.__d07LabSnapshot && window.__d07LabSnapshot());
    await page.waitForTimeout(220);

    let result = await readLab(page);
    if (result.bytes < 14000 || result.snapshot.lossType !== "triplet") {
      throw new Error(`D07 initial render is weak: ${JSON.stringify(result)}.`);
    }
    if (result.snapshot.knnAccuracy <= 0 || result.snapshot.positiveDistance <= 0 || result.snapshot.negativeDistance <= 0) {
      throw new Error(`D07 initial diagnostics are weak: ${JSON.stringify(result)}.`);
    }
    if (!/triplet|margin|retrieval/i.test(result.stateText)) {
      throw new Error(`D07 initial state text is weak: ${JSON.stringify(result)}.`);
    }

    const beforeTheta = result.snapshot.theta;
    const box = await page.locator(".lab-viewport canvas").boundingBox();
    if (!box || box.width < 420 || box.height < 360) {
      throw new Error(`D07 canvas has an unstable viewport: ${JSON.stringify(box)}.`);
    }
    await page.mouse.move(box.x + box.width * 0.30, box.y + box.height * 0.50);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.70, box.y + box.height * 0.42);
    await page.mouse.up();
    await page.waitForTimeout(80);
    result = await readLab(page);
    if (Math.abs(result.snapshot.theta - beforeTheta) < 0.01) {
      throw new Error(`D07 orbit drag did not update the 3D view: ${JSON.stringify(result)}.`);
    }

    await page.selectOption("#metricType", "mahalanobis");
    await page.selectOption("#miningMode", "hard");
    await page.click("#mineTriplet");
    await page.click("#trainStep");
    result = await readLab(page);
    if (result.snapshot.metricType !== "mahalanobis" || result.snapshot.miningMode !== "hard") {
      throw new Error(`D07 controls did not update snapshot: ${JSON.stringify(result)}.`);
    }
    if (!/hard negative|Triplet step/i.test(result.stateText)) {
      throw new Error(`D07 triplet training text is weak: ${JSON.stringify(result)}.`);
    }

    await page.selectOption("#lossType", "contrastive");
    await page.click("#trainStep");
    result = await readLab(page);
    if (result.snapshot.lossType !== "contrastive" || !/Contrastive step/i.test(result.stateText)) {
      throw new Error(`D07 contrastive branch is weak: ${JSON.stringify(result)}.`);
    }

    await page.selectOption("#lossType", "proxy");
    await page.click("#runFive");
    result = await readLab(page);
    if (result.snapshot.lossType !== "proxy" || !/Proxy step/i.test(result.stateText)) {
      throw new Error(`D07 proxy branch is weak: ${JSON.stringify(result)}.`);
    }
    if (result.viewport.scrollWidth > result.viewport.clientWidth + 2) {
      throw new Error(`D07 lab creates horizontal overflow: ${JSON.stringify(result.viewport)}.`);
    }

    console.log("D07 browser smoke passed for 3D metric-learning lab.");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
