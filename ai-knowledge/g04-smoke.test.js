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
    const file = path.join(__dirname, "g04-graphsage-sampling-lab.html").replace(/\\/g, "/");
    await page.goto(`file:///${file}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__g04LabReady === true && window.__g04LabSnapshot());
    await page.waitForTimeout(180);

    let result = await page.evaluate(() => ({
      bytes: document.querySelector("#canvas").toDataURL("image/png").length,
      snapshot: window.__g04LabSnapshot(),
      stateText: document.querySelector("#state").textContent.trim(),
      rangeCount: document.querySelectorAll('input[type="range"]').length,
      actionCount: document.querySelectorAll("[data-action]").length
    }));
    if (result.bytes < 13000 || result.snapshot.has3d !== true || result.snapshot.nodeCount < 14 || result.snapshot.totalEdges < 14) {
      throw new Error(`G04 initial render is weak: ${JSON.stringify(result)}`);
    }
    if (result.rangeCount < 5 || result.actionCount < 3) throw new Error(`G04 controls are incomplete: ${JSON.stringify(result)}`);
    if (!/graphsage|sampling|fanout|inductive/i.test(result.stateText)) throw new Error(`G04 state copy is off-topic: ${result.stateText}`);
    await noScrollbars(page, "desktop");

    const thetaBefore = result.snapshot.cameraTheta;
    await page.mouse.move(430, 310);
    await page.mouse.down();
    await page.mouse.move(560, 360);
    await page.mouse.up();
    await page.waitForTimeout(80);
    result = await page.evaluate(() => window.__g04LabSnapshot());
    if (Math.abs(result.cameraTheta - thetaBefore) < 0.05) throw new Error("G04 camera did not rotate manually.");

    await setRange(page, "#fanout", 2);
    await page.click("#sampleNeighbors");
    await page.waitForFunction(() => window.__g04LabSnapshot().phase === "sample");
    const lowFanout = await page.evaluate(() => window.__g04LabSnapshot());
    if (lowFanout.sampledCount <= 0 || lowFanout.coverage <= 0 || lowFanout.samplingVariance <= 0) {
      throw new Error(`G04 low-fanout sample is weak: ${JSON.stringify(lowFanout)}`);
    }

    await setRange(page, "#fanout", 8);
    await page.click("#sampleNeighbors");
    await page.waitForTimeout(120);
    const highFanout = await page.evaluate(() => window.__g04LabSnapshot());
    if (!(highFanout.coverage > lowFanout.coverage) || !(highFanout.samplingVariance < lowFanout.samplingVariance)) {
      throw new Error(`G04 fanout should increase coverage and reduce variance: ${JSON.stringify({ lowFanout, highFanout })}`);
    }

    await page.click("#newNode");
    await page.waitForFunction(() => window.__g04LabSnapshot().inductiveNode === true);
    result = await page.evaluate(() => ({ snapshot: window.__g04LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (!/unseen|inductive|features|neighborhood/i.test(result.stateText)) {
      throw new Error(`G04 inductive node is not visible: ${JSON.stringify(result)}`);
    }

    await page.selectOption("#aggregator", "pool");
    await page.click("#aggregate");
    await page.waitForFunction(() => window.__g04LabSnapshot().phase === "aggregate" && window.__g04LabSnapshot().aggregator === "pool");
    result = await page.evaluate(() => ({ snapshot: window.__g04LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (result.snapshot.embeddingDrift <= 0 || !/pool|aggregator|combine/i.test(result.stateText)) {
      throw new Error(`G04 pooling aggregate is weak: ${JSON.stringify(result)}`);
    }

    await page.click("#contrastiveSplit");
    await page.waitForFunction(() => window.__g04LabSnapshot().negativeCount > 0);
    result = await page.evaluate(() => ({ snapshot: window.__g04LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (!/negative|contrastive|nearby/i.test(result.stateText)) {
      throw new Error(`G04 contrastive objective is not visible: ${JSON.stringify(result)}`);
    }

    await page.setViewportSize({ width: 900, height: 700 });
    await page.waitForTimeout(120);
    await noScrollbars(page, "narrow iframe");
    console.log("g04 smoke passed: GraphSAGE lab renders fanout sampling, coverage-variance tradeoff, inductive node embedding, pooling, contrastive negatives, and fits iframe.");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
