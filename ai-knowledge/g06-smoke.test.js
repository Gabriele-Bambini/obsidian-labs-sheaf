const path = require("path");

function loadPlaywright() {
  const candidates = [
    "playwright",
    "C:/Users/02gab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright",
    "C:/Users/02gab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
    "C:/Users/Gabriele/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright",
    "C:/Users/Gabriele/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"
  ];
  const failures = [];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (error) {
      failures.push(`${candidate}: ${error.message}`);
    }
  }
  throw new Error(`Unable to load Playwright:\n${failures.join("\n")}`);
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
    const file = path.join(__dirname, "g06-higher-order-gnn-lab.html").replace(/\\/g, "/");
    await page.goto(`file:///${file}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__g06LabReady === true && window.__g06LabSnapshot());
    await page.waitForTimeout(180);

    let result = await page.evaluate(() => ({
      bytes: document.querySelector("#canvas").toDataURL("image/png").length,
      snapshot: window.__g06LabSnapshot(),
      stateText: document.querySelector("#state").textContent.trim(),
      rangeCount: document.querySelectorAll('input[type="range"]').length,
      actionCount: document.querySelectorAll("[data-action]").length
    }));
    if (result.bytes < 13000 || result.snapshot.has3d !== true || result.snapshot.nodeCount < 12 || result.snapshot.graphCount !== 2) {
      throw new Error(`G06 initial render is weak: ${JSON.stringify(result)}`);
    }
    if (result.rangeCount < 5 || result.actionCount < 3) throw new Error(`G06 controls are incomplete: ${JSON.stringify(result)}`);
    if (!/higher-order|1-WL|pair|motif|subgraph/i.test(result.stateText)) throw new Error(`G06 state copy is off-topic: ${result.stateText}`);
    await noScrollbars(page, "desktop");

    const thetaBefore = result.snapshot.cameraTheta;
    await page.mouse.move(430, 310);
    await page.mouse.down();
    await page.mouse.move(560, 360);
    await page.mouse.up();
    await page.waitForTimeout(80);
    result = await page.evaluate(() => window.__g06LabSnapshot());
    if (Math.abs(result.cameraTheta - thetaBefore) < 0.05) throw new Error("G06 camera did not rotate manually.");

    await page.selectOption("#liftMode", "triangles");
    await page.waitForTimeout(120);
    result = await page.evaluate(() => ({ snapshot: window.__g06LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (result.snapshot.phase !== "motifs" || result.snapshot.triangleSignalGap <= 0 || !/trace|triangle|closed walk/i.test(result.stateText)) {
      throw new Error(`G06 lift mode dropdown should directly activate triangle trace: ${JSON.stringify(result)}`);
    }

    await page.selectOption("#liftMode", "subgraphs");
    await page.waitForTimeout(120);
    result = await page.evaluate(() => ({ snapshot: window.__g06LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (result.snapshot.phase !== "subgraphs" || result.snapshot.subgraphCoverage <= 0 || !/subgraph|coverage|sampling/i.test(result.stateText)) {
      throw new Error(`G06 lift mode dropdown should directly activate subgraph sampling: ${JSON.stringify(result)}`);
    }

    await page.selectOption("#liftMode", "pairs");
    await page.waitForTimeout(120);
    result = await page.evaluate(() => ({ snapshot: window.__g06LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (result.snapshot.phase !== "pairLift" || result.snapshot.pairStateCount < 72 || !/pair|2-WL|tuple/i.test(result.stateText)) {
      throw new Error(`G06 lift mode dropdown should directly activate pair states: ${JSON.stringify(result)}`);
    }

    await page.click("#liftPairs");
    await page.waitForFunction(() => window.__g06LabSnapshot().phase === "pairLift");
    const pairSnapshot = await page.evaluate(() => ({ snapshot: window.__g06LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (pairSnapshot.snapshot.pairStateCount < 72 || pairSnapshot.snapshot.memoryCost <= 0) {
      throw new Error(`G06 pair lift should expose n^2 pair states: ${JSON.stringify(pairSnapshot)}`);
    }
    if (!/pair|2-WL|tuple|n\^2/i.test(pairSnapshot.stateText)) throw new Error(`G06 pair-lift state is weak: ${pairSnapshot.stateText}`);

    await page.click("#showTriangles");
    await page.waitForFunction(() => window.__g06LabSnapshot().phase === "motifs");
    result = await page.evaluate(() => ({ snapshot: window.__g06LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (result.snapshot.triangleSignalGap <= 0 || result.snapshot.cycleTriangleTrace !== 0 || result.snapshot.triangleGraphTrace < 12) {
      throw new Error(`G06 triangle evidence should separate C6 from two triangles: ${JSON.stringify(result)}`);
    }
    if (!/trace|A\^3|triangle|closed walk/i.test(result.stateText)) throw new Error(`G06 triangle state is weak: ${result.stateText}`);

    await setRange(page, "#motifBudget", 2);
    await page.click("#sampleSubgraphs");
    await page.waitForFunction(() => window.__g06LabSnapshot().phase === "subgraphs");
    const lowBudget = await page.evaluate(() => window.__g06LabSnapshot());
    await setRange(page, "#motifBudget", 10);
    await page.click("#sampleSubgraphs");
    await page.waitForTimeout(120);
    const highBudget = await page.evaluate(() => window.__g06LabSnapshot());
    if (!(highBudget.subgraphCoverage > lowBudget.subgraphCoverage) || !(highBudget.samplingBias < lowBudget.samplingBias)) {
      throw new Error(`G06 subgraph budget should raise coverage and reduce bias: ${JSON.stringify({ lowBudget, highBudget })}`);
    }

    await setRange(page, "#tupleOrder", 3);
    await page.click("#compareCost");
    await page.waitForFunction(() => window.__g06LabSnapshot().phase === "cost");
    result = await page.evaluate(() => ({ snapshot: window.__g06LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (!(result.snapshot.memoryCost > pairSnapshot.snapshot.memoryCost) || !/O\(n\^k\)|memory|cost|tuple/i.test(result.stateText)) {
      throw new Error(`G06 tuple-order cost should grow beyond pair states: ${JSON.stringify(result)}`);
    }

    await page.setViewportSize({ width: 900, height: 700 });
    await page.waitForTimeout(120);
    await noScrollbars(page, "narrow iframe");
    console.log("g06 smoke passed: higher-order lab renders pair lift, triangle trace evidence, subgraph coverage/bias, tuple-order cost, and fits iframe.");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
