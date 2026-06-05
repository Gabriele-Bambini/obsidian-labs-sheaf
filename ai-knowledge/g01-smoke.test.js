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

async function noScrollbars(page, label) {
  const overflow = await page.evaluate(() => ({
    x: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
    y: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight,
    command: (() => {
      const bar = document.querySelector(".command-bar");
      if (!bar) return null;
      return {
        x: bar.scrollWidth - bar.clientWidth,
        y: bar.scrollHeight - bar.clientHeight
      };
    })()
  }));
  if (overflow.x > 2 || overflow.y > 2) {
    throw new Error(`${label}: page overflow ${JSON.stringify(overflow)}`);
  }
  if (overflow.command && (overflow.command.x > 3 || overflow.command.y > 3)) {
    throw new Error(`${label}: command bar clips ${JSON.stringify(overflow.command)}`);
  }
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  try {
    const file = path.join(__dirname, "g01-message-passing-playground.html").replace(/\\/g, "/");
    await page.goto(`file:///${file}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__g01LabReady === true && window.__g01LabSnapshot());
    await page.waitForTimeout(180);

    let result = await page.evaluate(() => ({
      bytes: document.querySelector("#canvas").toDataURL("image/png").length,
      snapshot: window.__g01LabSnapshot(),
      stateText: document.querySelector("#state").textContent.trim(),
      rangeCount: document.querySelectorAll('input[type="range"]').length,
      actionCount: document.querySelectorAll("[data-action]").length
    }));
    if (result.bytes < 12000 || result.snapshot.has3d !== true || result.snapshot.nodeCount < 10) {
      throw new Error(`G01 initial render is weak: ${JSON.stringify(result)}`);
    }
    if (result.snapshot.aggregator !== "sum") throw new Error(`G01 should start in sum aggregation: ${JSON.stringify(result.snapshot)}`);
    if (result.rangeCount < 5 || result.actionCount < 3) throw new Error(`G01 controls are incomplete: ${JSON.stringify(result)}`);
    if (!/message|aggregation|neighborhood/i.test(result.stateText)) throw new Error(`G01 state copy is off-topic: ${result.stateText}`);
    await noScrollbars(page, "desktop");

    const thetaBefore = result.snapshot.cameraTheta;
    await page.mouse.move(430, 310);
    await page.mouse.down();
    await page.mouse.move(560, 360);
    await page.mouse.up();
    await page.waitForTimeout(80);
    result = await page.evaluate(() => window.__g01LabSnapshot());
    if (Math.abs(result.cameraTheta - thetaBefore) < 0.05) throw new Error("G01 camera did not rotate manually.");

    await page.click("#sendMessages");
    await page.waitForFunction(() => window.__g01LabSnapshot().phase === "messages");
    result = await page.evaluate(() => ({
      snapshot: window.__g01LabSnapshot(),
      stateText: document.querySelector("#state").textContent.trim()
    }));
    if (result.snapshot.activeEdgeCount < 4 || result.snapshot.messageNorm <= 0) {
      throw new Error(`G01 message pulse has no visual consequence: ${JSON.stringify(result)}`);
    }
    if (!/sum|message|neighbor/i.test(result.stateText)) throw new Error(`G01 message state is weak: ${result.stateText}`);

    await page.selectOption("#aggregator", "mean");
    await page.waitForFunction(() => window.__g01LabSnapshot().aggregator === "mean");
    const meanEffect = await page.evaluate(() => window.__g01LabSnapshot().degreeBias);
    await page.selectOption("#aggregator", "sum");
    await page.waitForFunction(() => window.__g01LabSnapshot().aggregator === "sum");
    const sumEffect = await page.evaluate(() => window.__g01LabSnapshot().degreeBias);
    if (!(sumEffect > meanEffect)) {
      throw new Error(`G01 sum should expose stronger degree bias than mean, got sum=${sumEffect}, mean=${meanEffect}`);
    }

    await page.click("#permuteOrder");
    await page.waitForFunction(() => window.__g01LabSnapshot().permutationSeed > 0);
    result = await page.evaluate(() => ({
      snapshot: window.__g01LabSnapshot(),
      stateText: document.querySelector("#state").textContent.trim()
    }));
    if (result.snapshot.equivarianceGap > 0.001 || !/permutation|equivariant|order/i.test(result.stateText)) {
      throw new Error(`G01 permutation invariance is not visible: ${JSON.stringify(result)}`);
    }

    await page.selectOption("#aggregator", "max");
    await page.click("#stepFrontier");
    await page.waitForFunction(() => window.__g01LabSnapshot().aggregator === "max" && window.__g01LabSnapshot().phase === "frontier");
    result = await page.evaluate(() => ({
      snapshot: window.__g01LabSnapshot(),
      stateText: document.querySelector("#state").textContent.trim()
    }));
    if (result.snapshot.maxDropped <= 0 || !/max|ignores|strongest/i.test(result.stateText)) {
      throw new Error(`G01 max aggregation does not explain dropped neighbors: ${JSON.stringify(result)}`);
    }

    await page.setViewportSize({ width: 900, height: 700 });
    await page.waitForTimeout(120);
    await noScrollbars(page, "narrow iframe");
    console.log("g01 smoke passed: message-passing lab renders neighborhood aggregation, degree bias, permutation equivariance, max dropping, and fits iframe.");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
