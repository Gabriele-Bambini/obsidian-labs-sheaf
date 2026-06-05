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
    const file = path.join(__dirname, "g05-wl-color-refinement-lab.html").replace(/\\/g, "/");
    await page.goto(`file:///${file}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__g05LabReady === true && window.__g05LabSnapshot());
    await page.waitForTimeout(180);

    let result = await page.evaluate(() => ({
      bytes: document.querySelector("#canvas").toDataURL("image/png").length,
      snapshot: window.__g05LabSnapshot(),
      stateText: document.querySelector("#state").textContent.trim(),
      rangeCount: document.querySelectorAll('input[type="range"]').length,
      actionCount: document.querySelectorAll("[data-action]").length
    }));
    if (result.bytes < 13000 || result.snapshot.has3d !== true || result.snapshot.nodeCount < 12 || result.snapshot.graphCount !== 2) {
      throw new Error(`G05 initial render is weak: ${JSON.stringify(result)}`);
    }
    if (result.rangeCount < 5 || result.actionCount < 3) throw new Error(`G05 controls are incomplete: ${JSON.stringify(result)}`);
    if (!/weisfeiler|WL|color refinement|histogram/i.test(result.stateText)) throw new Error(`G05 state copy is off-topic: ${result.stateText}`);
    await noScrollbars(page, "desktop");

    const thetaBefore = result.snapshot.cameraTheta;
    await page.mouse.move(430, 310);
    await page.mouse.down();
    await page.mouse.move(560, 360);
    await page.mouse.up();
    await page.waitForTimeout(80);
    result = await page.evaluate(() => window.__g05LabSnapshot());
    if (Math.abs(result.cameraTheta - thetaBefore) < 0.05) throw new Error("G05 camera did not rotate manually.");

    await page.click("#refineColors");
    await page.waitForFunction(() => window.__g05LabSnapshot().phase === "refine" && window.__g05LabSnapshot().round >= 1);
    result = await page.evaluate(() => ({ snapshot: window.__g05LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (result.snapshot.histogramGap !== 0 || result.snapshot.distinguishedScore > 0.05 || result.snapshot.wlSeparated !== false) {
      throw new Error(`G05 regular pair should fool 1-WL: ${JSON.stringify(result)}`);
    }
    if (!/same histogram|cannot distinguish|fails|1-WL/i.test(result.stateText)) throw new Error(`G05 failure state is weak: ${result.stateText}`);

    await page.click("#seedFeature");
    await page.waitForFunction(() => window.__g05LabSnapshot().phase === "seed" && window.__g05LabSnapshot().seeded === true);
    result = await page.evaluate(() => ({ snapshot: window.__g05LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (result.snapshot.histogramGap <= 0 || result.snapshot.distinguishedScore <= 0 || result.snapshot.wlSeparated !== true) {
      throw new Error(`G05 seeded feature should break symmetry: ${JSON.stringify(result)}`);
    }
    if (!/seed|initial feature|symmetry|histogram/i.test(result.stateText)) throw new Error(`G05 seed state is weak: ${result.stateText}`);

    await page.selectOption("#aggregator", "mean");
    await page.click("#compareAggregators");
    await page.waitForFunction(() => window.__g05LabSnapshot().phase === "aggregator" && window.__g05LabSnapshot().aggregator === "mean");
    const meanSnapshot = await page.evaluate(() => window.__g05LabSnapshot());
    if (meanSnapshot.meanCollision !== true) throw new Error(`G05 mean aggregator should show a multiset collision: ${JSON.stringify(meanSnapshot)}`);

    await page.selectOption("#aggregator", "gin");
    await page.click("#compareAggregators");
    await page.waitForFunction(() => window.__g05LabSnapshot().phase === "aggregator" && window.__g05LabSnapshot().aggregator === "gin");
    result = await page.evaluate(() => ({ snapshot: window.__g05LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (!(result.snapshot.multisetSeparation > meanSnapshot.multisetSeparation) || !/sum|GIN|multiset|mean/i.test(result.stateText)) {
      throw new Error(`G05 GIN-style aggregator should separate more than mean: ${JSON.stringify(result)}`);
    }

    await setRange(page, "#hashSharpness", 0.4);
    await page.waitForTimeout(80);
    const softHash = await page.evaluate(() => window.__g05LabSnapshot());
    await setRange(page, "#hashSharpness", 2.4);
    await page.waitForTimeout(80);
    const sharpHash = await page.evaluate(() => window.__g05LabSnapshot());
    if (!(sharpHash.signatureContrast > softHash.signatureContrast)) {
      throw new Error(`G05 hash sharpness should visibly increase signature contrast: ${JSON.stringify({ softHash, sharpHash })}`);
    }

    await setRange(page, "#selfWeight", 0.05);
    await page.waitForTimeout(80);
    const weakSelf = await page.evaluate(() => window.__g05LabSnapshot());
    await setRange(page, "#selfWeight", 0.95);
    await page.waitForTimeout(80);
    const strongSelf = await page.evaluate(() => window.__g05LabSnapshot());
    if (!(strongSelf.selfRetention > weakSelf.selfRetention)) {
      throw new Error(`G05 self color weight should visibly increase self-retention: ${JSON.stringify({ weakSelf, strongSelf })}`);
    }

    await setRange(page, "#roundBudget", 5);
    await page.click("#runToStable");
    await page.waitForFunction(() => window.__g05LabSnapshot().phase === "stable");
    result = await page.evaluate(() => ({ snapshot: window.__g05LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (result.snapshot.stableRound > 5 || result.snapshot.histogramStable !== true || !/stable|round|color/i.test(result.stateText)) {
      throw new Error(`G05 stable refinement is not visible: ${JSON.stringify(result)}`);
    }

    await page.setViewportSize({ width: 900, height: 700 });
    await page.waitForTimeout(120);
    await noScrollbars(page, "narrow iframe");
    console.log("g05 smoke passed: WL lab renders the C6 vs two-triangles failure, seeded symmetry break, aggregator multiset collision, stable refinement, and fits iframe.");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
