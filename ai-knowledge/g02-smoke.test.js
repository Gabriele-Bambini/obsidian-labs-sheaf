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
  if (overflow.x > 2 || overflow.y > 2) throw new Error(`${label}: page overflow ${JSON.stringify(overflow)}`);
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
    const file = path.join(__dirname, "g02-gcn-message-passing.html").replace(/\\/g, "/");
    await page.goto(`file:///${file}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__g02LabReady === true && window.__g02LabSnapshot());
    await page.waitForTimeout(180);

    let result = await page.evaluate(() => ({
      bytes: document.querySelector("#canvas").toDataURL("image/png").length,
      snapshot: window.__g02LabSnapshot(),
      stateText: document.querySelector("#state").textContent.trim(),
      rangeCount: document.querySelectorAll('input[type="range"]').length,
      actionCount: document.querySelectorAll("[data-action]").length
    }));
    if (result.bytes < 12000 || result.snapshot.has3d !== true || result.snapshot.nodeCount < 10) {
      throw new Error(`G02 initial render is weak: ${JSON.stringify(result)}`);
    }
    if (result.snapshot.normalization !== "symmetric") throw new Error(`G02 should start with symmetric normalization: ${JSON.stringify(result.snapshot)}`);
    if (result.rangeCount < 5 || result.actionCount < 3) throw new Error(`G02 controls are incomplete: ${JSON.stringify(result)}`);
    if (!/gcn|normalized|self-loop|smoothing/i.test(result.stateText)) throw new Error(`G02 state copy is off-topic: ${result.stateText}`);
    await noScrollbars(page, "desktop");

    const thetaBefore = result.snapshot.cameraTheta;
    const energyBefore = result.snapshot.dirichletEnergy;
    await page.mouse.move(430, 310);
    await page.mouse.down();
    await page.mouse.move(560, 360);
    await page.mouse.up();
    await page.waitForTimeout(80);
    result = await page.evaluate(() => window.__g02LabSnapshot());
    if (Math.abs(result.cameraTheta - thetaBefore) < 0.05) throw new Error("G02 camera did not rotate manually.");

    await page.click("#showRenorm");
    await page.waitForFunction(() => window.__g02LabSnapshot().renormVisible === true);
    result = await page.evaluate(() => ({
      snapshot: window.__g02LabSnapshot(),
      stateText: document.querySelector("#state").textContent.trim()
    }));
    if (result.snapshot.selfLoopWeight <= 0 || result.snapshot.matrixCells < 20 || !/self-loop|renormalization|degree/i.test(result.stateText)) {
      throw new Error(`G02 renormalization view is weak: ${JSON.stringify(result)}`);
    }

    await page.click("#applyLayer");
    await page.waitForFunction(() => window.__g02LabSnapshot().layerCount >= 1);
    result = await page.evaluate(() => ({
      snapshot: window.__g02LabSnapshot(),
      stateText: document.querySelector("#state").textContent.trim()
    }));
    if (!(result.snapshot.dirichletEnergy < energyBefore) || result.snapshot.smoothingIndex <= 0) {
      throw new Error(`G02 layer did not smooth the graph signal: ${JSON.stringify(result)}`);
    }
    if (!/normalized adjacency|message|layer/i.test(result.stateText)) throw new Error(`G02 layer state is weak: ${result.stateText}`);

    await page.selectOption("#normalization", "raw");
    await page.click("#applyLayer");
    await page.waitForFunction(() => window.__g02LabSnapshot().normalization === "raw");
    result = await page.evaluate(() => ({
      snapshot: window.__g02LabSnapshot(),
      stateText: document.querySelector("#state").textContent.trim()
    }));
    if (result.snapshot.hubBias <= 0.2 || !/unnormalized|degree bias/i.test(result.stateText)) {
      throw new Error(`G02 raw adjacency degree bias is not visible: ${JSON.stringify(result)}`);
    }

    await page.click("#oversmooth");
    await page.waitForFunction(() => window.__g02LabSnapshot().layerCount >= 8);
    result = await page.evaluate(() => ({
      snapshot: window.__g02LabSnapshot(),
      stateText: document.querySelector("#state").textContent.trim()
    }));
    if (result.snapshot.nodeVariance > 0.08 || !/over-smoothing|similar|equilibrium/i.test(result.stateText)) {
      throw new Error(`G02 over-smoothing is not visible: ${JSON.stringify(result)}`);
    }

    await page.setViewportSize({ width: 900, height: 700 });
    await page.waitForTimeout(120);
    await noScrollbars(page, "narrow iframe");
    console.log("g02 smoke passed: GCN lab renders renormalization, normalized smoothing, raw degree bias, over-smoothing, and fits iframe.");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
