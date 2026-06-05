const path = require("path");

function loadPlaywright() {
  const candidates = [
    "playwright",
    "C:/Users/02gab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright",
    "C:/Users/02gab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
    "C:/Users/Gabriele/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright",
    "C:/Users/Gabriele/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"
  ];
  let lastError = null;
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

const { chromium } = loadPlaywright();

async function noScrollbars(page, label) {
  const overflow = await page.evaluate(() => ({
    x: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
    y: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight,
    command: (() => {
      const bar = document.querySelector(".command-bar");
      if (!bar) return null;
      return { x: bar.scrollWidth - bar.clientWidth, y: bar.scrollHeight - bar.clientHeight };
    })()
  }));
  if (overflow.x > 2 || overflow.y > 2) throw new Error(`${label}: page overflow ${JSON.stringify(overflow)}`);
  if (overflow.command && (overflow.command.x > 3 || overflow.command.y > 3)) throw new Error(`${label}: command bar clips ${JSON.stringify(overflow.command)}`);
}

async function setRange(page, selector, value) {
  await page.$eval(selector, (input, nextValue) => {
    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  try {
    const file = path.join(__dirname, "g08-scalable-gnn-sampling-lab.html").replace(/\\/g, "/");
    await page.goto(`file:///${file}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__g08LabReady === true && window.__g08LabSnapshot());
    await page.waitForTimeout(180);

    let result = await page.evaluate(() => ({
      bytes: document.querySelector("#canvas").toDataURL("image/png").length,
      snapshot: window.__g08LabSnapshot(),
      stateText: document.querySelector("#state").textContent.trim(),
      rangeCount: document.querySelectorAll('input[type="range"]').length,
      actionCount: document.querySelectorAll("[data-action]").length
    }));
    if (result.bytes < 13000 || result.snapshot.has3d !== true || result.snapshot.nodeCount < 30 || result.snapshot.edgeCount < 44) {
      throw new Error(`G08 initial render is weak: ${JSON.stringify(result)}`);
    }
    if (result.rangeCount < 5 || result.actionCount < 4) throw new Error(`G08 controls are incomplete: ${JSON.stringify(result)}`);
    if (!/scalable|sampling|minibatch|memory|neighbor/i.test(result.stateText)) throw new Error(`G08 state copy is off-topic: ${result.stateText}`);
    await noScrollbars(page, "desktop");

    const thetaBefore = result.snapshot.cameraTheta;
    await page.mouse.move(430, 310);
    await page.mouse.down();
    await page.mouse.move(560, 360);
    await page.mouse.up();
    await page.waitForTimeout(80);
    result = await page.evaluate(() => window.__g08LabSnapshot());
    if (Math.abs(result.cameraTheta - thetaBefore) < 0.05) throw new Error("G08 camera did not rotate manually.");

    await setRange(page, "#fanout", 4);
    await setRange(page, "#depth", 3);
    await page.click("#sampleNeighbors");
    await page.waitForFunction(() => window.__g08LabSnapshot().phase === "neighbor");
    result = await page.evaluate(() => ({ snapshot: window.__g08LabSnapshot(), stateText: document.querySelector("#state").textContent.trim(), strategy: document.querySelector("#strategyLabel").textContent.trim() }));
    if (result.snapshot.loadedNodes <= result.snapshot.targetBatch || result.snapshot.edgesTouched <= 0 || result.snapshot.memoryEstimate <= 0) {
      throw new Error(`G08 neighbor sampling should load a computation tree: ${JSON.stringify(result)}`);
    }
    if (!/neighbor|fanout|explosion|computation tree/i.test(result.stateText + " " + result.strategy)) {
      throw new Error(`G08 neighbor state is weak: ${JSON.stringify(result)}`);
    }

    await setRange(page, "#batchBudget", 6);
    await page.click("#sampleNeighbors");
    await page.waitForTimeout(120);
    const lowBudget = await page.evaluate(() => window.__g08LabSnapshot());
    await setRange(page, "#batchBudget", 22);
    await page.click("#sampleNeighbors");
    await page.waitForTimeout(120);
    const highBudget = await page.evaluate(() => window.__g08LabSnapshot());
    if (!(highBudget.coverage > lowBudget.coverage) || !(highBudget.gradientVariance < lowBudget.gradientVariance) || !(highBudget.memoryEstimate > lowBudget.memoryEstimate)) {
      throw new Error(`G08 larger batch budget should raise coverage, reduce variance, and cost more memory: ${JSON.stringify({ lowBudget, highBudget })}`);
    }

    await page.selectOption("#viewSelect", "walks");
    await page.waitForFunction(() => window.__g08LabSnapshot().phase === "walk");
    result = await page.evaluate(() => ({ snapshot: window.__g08LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (result.snapshot.degreeBias <= 0 || !/GraphSAINT|random walk|degree bias|normalization/i.test(result.stateText)) {
      throw new Error(`G08 diagnostic view selector should directly switch to walk visuals: ${JSON.stringify(result)}`);
    }

    await page.selectOption("#viewSelect", "budget");
    await page.waitForFunction(() => window.__g08LabSnapshot().phase === "budget");
    result = await page.evaluate(() => ({
      snapshot: window.__g08LabSnapshot(),
      stateText: document.querySelector("#state").textContent.trim(),
      strategy: document.querySelector("#strategyLabel").textContent.trim()
    }));
    if (result.snapshot.estimatorQuality <= 0 || !/gradient|estimator|bias|variance|memory/i.test(result.stateText) || !/budget|estimator/i.test(result.strategy)) {
      throw new Error(`G08 diagnostic view selector should directly switch to budget visuals: ${JSON.stringify(result)}`);
    }

    await page.selectOption("#samplingStrategy", "cluster");
    await page.click("#clusterBatch");
    await page.waitForFunction(() => window.__g08LabSnapshot().phase === "cluster");
    result = await page.evaluate(() => ({ snapshot: window.__g08LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (result.snapshot.internalEdgeRatio <= 0 || result.snapshot.boundaryBias <= 0 || !/Cluster-GCN|cluster|boundary|cut/i.test(result.stateText)) {
      throw new Error(`G08 Cluster-GCN should show internal edges and boundary bias: ${JSON.stringify(result)}`);
    }

    await page.selectOption("#samplingStrategy", "walk");
    await page.click("#walkSubgraph");
    await page.waitForFunction(() => window.__g08LabSnapshot().phase === "walk");
    result = await page.evaluate(() => ({ snapshot: window.__g08LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (result.snapshot.degreeBias <= 0 || result.snapshot.normalizationWeight <= 0 || !/GraphSAINT|random walk|degree bias|normalization/i.test(result.stateText)) {
      throw new Error(`G08 GraphSAINT walk should show degree bias and normalization: ${JSON.stringify(result)}`);
    }

    await page.click("#compareBudget");
    await page.waitForFunction(() => window.__g08LabSnapshot().phase === "budget");
    result = await page.evaluate(() => ({ snapshot: window.__g08LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (result.snapshot.estimatorQuality <= 0 || !/gradient|estimator|bias|variance|memory/i.test(result.stateText)) {
      throw new Error(`G08 budget comparison should connect memory to estimator quality: ${JSON.stringify(result)}`);
    }

    await page.setViewportSize({ width: 900, height: 700 });
    await page.waitForTimeout(120);
    await noScrollbars(page, "narrow iframe");
    console.log("g08 smoke passed: scalable GNN lab renders neighbor explosion, budget tradeoff, Cluster-GCN boundary bias, GraphSAINT normalization, estimator quality, and fits iframe.");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
