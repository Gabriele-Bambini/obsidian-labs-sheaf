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
    const file = path.join(__dirname, "g09-temporal-gnn-memory-lab.html").replace(/\\/g, "/");
    await page.goto(`file:///${file}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__g09LabReady === true && window.__g09LabSnapshot());
    await page.waitForTimeout(180);

    let result = await page.evaluate(() => ({
      bytes: document.querySelector("#canvas").toDataURL("image/png").length,
      snapshot: window.__g09LabSnapshot(),
      stateText: document.querySelector("#state").textContent.trim(),
      rangeCount: document.querySelectorAll('input[type="range"]').length,
      actionCount: document.querySelectorAll("[data-action]").length
    }));
    if (result.bytes < 13000 || result.snapshot.has3d !== true || result.snapshot.nodeCount < 8 || result.snapshot.eventCount < 14) {
      throw new Error(`G09 initial render is weak: ${JSON.stringify(result)}`);
    }
    if (result.rangeCount < 5 || result.actionCount < 4) throw new Error(`G09 controls are incomplete: ${JSON.stringify(result)}`);
    if (!/temporal|event|memory|causal|history/i.test(result.stateText)) throw new Error(`G09 state copy is off-topic: ${result.stateText}`);
    await noScrollbars(page, "desktop");

    const thetaBefore = result.snapshot.cameraTheta;
    await page.mouse.move(430, 310);
    await page.mouse.down();
    await page.mouse.move(560, 360);
    await page.mouse.up();
    await page.waitForTimeout(80);
    result = await page.evaluate(() => window.__g09LabSnapshot());
    if (Math.abs(result.cameraTheta - thetaBefore) < 0.05) throw new Error("G09 camera did not rotate manually.");

    await page.click("#processEvent");
    await page.waitForFunction(() => window.__g09LabSnapshot().phase === "event");
    result = await page.evaluate(() => ({ snapshot: window.__g09LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (result.snapshot.processedEvents <= 0 || result.snapshot.memoryUpdateMagnitude <= 0 || result.snapshot.touchedNodeCount < 2) {
      throw new Error(`G09 processing an event should update exactly the touched memories: ${JSON.stringify(result)}`);
    }
    if (!/event|order|memory|update|touched/i.test(result.stateText)) throw new Error(`G09 event state is weak: ${result.stateText}`);

    await setRange(page, "#historyWindow", 2);
    await page.click("#processEvent");
    await page.waitForTimeout(120);
    const narrowWindow = await page.evaluate(() => window.__g09LabSnapshot());
    await setRange(page, "#historyWindow", 9);
    await page.click("#processEvent");
    await page.waitForTimeout(120);
    const wideWindow = await page.evaluate(() => window.__g09LabSnapshot());
    if (!(wideWindow.activeHistoryCount > narrowWindow.activeHistoryCount) || !(narrowWindow.staleNodeCount >= wideWindow.staleNodeCount)) {
      throw new Error(`G09 wider history window should keep more events active and fewer nodes stale: ${JSON.stringify({ narrowWindow, wideWindow })}`);
    }

    await page.selectOption("#aggregatorMode", "last");
    await page.click("#processEvent");
    await page.waitForTimeout(120);
    const lastAggregation = await page.evaluate(() => window.__g09LabSnapshot());
    await page.selectOption("#aggregatorMode", "mean");
    await page.click("#processEvent");
    await page.waitForTimeout(120);
    const meanAggregation = await page.evaluate(() => window.__g09LabSnapshot());
    if (Math.abs(meanAggregation.memoryUpdateMagnitude - lastAggregation.memoryUpdateMagnitude) < 0.01 || !/mean|batch|aggregat/i.test(meanAggregation.stateText)) {
      throw new Error(`G09 aggregator mode should change memory update semantics: ${JSON.stringify({ lastAggregation, meanAggregation })}`);
    }

    await page.selectOption("#splitMode", "inductive");
    await page.waitForFunction(() => window.__g09LabSnapshot().phase === "inductive");
    result = await page.evaluate(() => ({ snapshot: window.__g09LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (result.snapshot.newNodeCount <= 0 || !/inductive|new node|initial/i.test(result.stateText)) {
      throw new Error(`G09 inductive split should visibly expose new-node memory initialization: ${JSON.stringify(result)}`);
    }

    await page.click("#predictBefore");
    await page.waitForFunction(() => window.__g09LabSnapshot().phase === "causal");
    result = await page.evaluate(() => ({ snapshot: window.__g09LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (result.snapshot.futureLeakage !== false || result.snapshot.causalScore <= 0 || !/causal|before|future|history/i.test(result.stateText)) {
      throw new Error(`G09 causal prediction should score before consuming future events: ${JSON.stringify(result)}`);
    }

    await page.click("#showLeakage");
    await page.waitForFunction(() => window.__g09LabSnapshot().phase === "leakage");
    result = await page.evaluate(() => ({ snapshot: window.__g09LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (result.snapshot.futureLeakage !== true || result.snapshot.leakageGap <= 0 || !/leak|future|invalid|split/i.test(result.stateText)) {
      throw new Error(`G09 leakage view should expose future-edge contamination: ${JSON.stringify(result)}`);
    }

    await setRange(page, "#attentionSharpness", 0.15);
    await page.click("#attentionReplay");
    await page.waitForFunction(() => window.__g09LabSnapshot().phase === "attention");
    const softAttention = await page.evaluate(() => window.__g09LabSnapshot());
    await setRange(page, "#attentionSharpness", 1.35);
    await page.click("#attentionReplay");
    await page.waitForTimeout(120);
    result = await page.evaluate(() => ({ snapshot: window.__g09LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (!(result.snapshot.attentionPeak > softAttention.attentionPeak) || !(result.snapshot.attentionEntropy < softAttention.attentionEntropy) || !/temporal attention|recency|delta|neighbor/i.test(result.stateText)) {
      throw new Error(`G09 attention sharpness should focus recent temporal neighbors: ${JSON.stringify({ softAttention, result })}`);
    }

    await page.setViewportSize({ width: 900, height: 700 });
    await page.waitForTimeout(120);
    await noScrollbars(page, "narrow iframe");
    console.log("g09 smoke passed: temporal lab renders event order, memory updates, causal prediction, leakage, temporal attention, and fits iframe.");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
