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
    const file = path.join(__dirname, "g07-link-graph-readout-lab.html").replace(/\\/g, "/");
    await page.goto(`file:///${file}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__g07LabReady === true && window.__g07LabSnapshot());
    await page.waitForTimeout(180);

    let result = await page.evaluate(() => ({
      bytes: document.querySelector("#canvas").toDataURL("image/png").length,
      snapshot: window.__g07LabSnapshot(),
      stateText: document.querySelector("#state").textContent.trim(),
      rangeCount: document.querySelectorAll('input[type="range"]').length,
      actionCount: document.querySelectorAll("[data-action]").length
    }));
    if (result.bytes < 13000 || result.snapshot.has3d !== true || result.snapshot.nodeCount < 14 || result.snapshot.edgeCount < 16) {
      throw new Error(`G07 initial render is weak: ${JSON.stringify(result)}`);
    }
    if (result.rangeCount < 5 || result.actionCount < 4) throw new Error(`G07 controls are incomplete: ${JSON.stringify(result)}`);
    if (!/link|pair|decoder|readout|pooling/i.test(result.stateText)) throw new Error(`G07 state copy is off-topic: ${result.stateText}`);
    await noScrollbars(page, "desktop");

    const thetaBefore = result.snapshot.cameraTheta;
    await page.mouse.move(430, 310);
    await page.mouse.down();
    await page.mouse.move(560, 360);
    await page.mouse.up();
    await page.waitForTimeout(80);
    result = await page.evaluate(() => window.__g07LabSnapshot());
    if (Math.abs(result.cameraTheta - thetaBefore) < 0.05) throw new Error("G07 camera did not rotate manually.");

    await page.click("#scoreLink");
    await page.waitForFunction(() => window.__g07LabSnapshot().phase === "link");
    result = await page.evaluate(() => ({ snapshot: window.__g07LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (result.snapshot.decoderMargin <= 0 || result.snapshot.pairScore <= result.snapshot.negativeScore || result.snapshot.candidateCount <= 0) {
      throw new Error(`G07 link decoder should score the candidate pair above sampled negatives: ${JSON.stringify(result)}`);
    }
    if (!/pair|link|decoder|candidate/i.test(result.stateText)) throw new Error(`G07 link state is weak: ${result.stateText}`);

    await setRange(page, "#negativeHardness", 0.1);
    await page.click("#sampleNegatives");
    await page.waitForFunction(() => window.__g07LabSnapshot().phase === "negative");
    const easyNegatives = await page.evaluate(() => window.__g07LabSnapshot());
    await setRange(page, "#negativeHardness", 1.2);
    await page.click("#sampleNegatives");
    await page.waitForTimeout(120);
    const hardNegatives = await page.evaluate(() => window.__g07LabSnapshot());
    if (!(hardNegatives.negativeDifficulty > easyNegatives.negativeDifficulty) || !(hardNegatives.precisionProxy < easyNegatives.precisionProxy)) {
      throw new Error(`G07 hard negatives should become harder and lower precision proxy: ${JSON.stringify({ easyNegatives, hardNegatives })}`);
    }

    await page.selectOption("#readoutMode", "mean");
    await page.click("#poolGraph");
    await page.waitForFunction(() => window.__g07LabSnapshot().phase === "readout" && window.__g07LabSnapshot().readoutMode === "mean");
    const meanReadout = await page.evaluate(() => window.__g07LabSnapshot());
    await page.selectOption("#readoutMode", "sum");
    await page.click("#poolGraph");
    await page.waitForTimeout(120);
    result = await page.evaluate(() => ({ snapshot: window.__g07LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (!(result.snapshot.readoutNorm > meanReadout.readoutNorm) || !/sum|mean|readout|pooling/i.test(result.stateText)) {
      throw new Error(`G07 sum readout should preserve count/scale more than mean readout: ${JSON.stringify({ meanReadout, result })}`);
    }

    await page.selectOption("#decoderMode", "bilinear");
    await page.click("#scoreLink");
    await page.waitForFunction(() => window.__g07LabSnapshot().decoderMode === "bilinear" && window.__g07LabSnapshot().phase === "link");
    result = await page.evaluate(() => ({ snapshot: window.__g07LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (result.snapshot.directedAsymmetry <= 0 || !/bilinear|compatibility|directed/i.test(result.stateText)) {
      throw new Error(`G07 bilinear decoder should show role/direction compatibility: ${JSON.stringify(result)}`);
    }

    await page.click("#diffPoolStep");
    await page.waitForFunction(() => window.__g07LabSnapshot().phase === "hierarchy");
    result = await page.evaluate(() => ({ snapshot: window.__g07LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (result.snapshot.clusterCount < 2 || result.snapshot.coarsenedEdgeCount <= 0 || !/DiffPool|cluster|coarsen|hierarch/i.test(result.stateText)) {
      throw new Error(`G07 DiffPool hierarchy should coarsen nodes into graph-level modules: ${JSON.stringify(result)}`);
    }

    await page.setViewportSize({ width: 900, height: 700 });
    await page.waitForTimeout(120);
    await noScrollbars(page, "narrow iframe");
    console.log("g07 smoke passed: link/readout lab renders pair decoding, hard negatives, pooling assumptions, bilinear compatibility, DiffPool coarsening, and fits iframe.");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
