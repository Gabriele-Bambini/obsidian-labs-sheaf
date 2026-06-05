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
    const file = path.join(__dirname, "g15-over-smoothing-depth-lab.html").replace(/\\/g, "/");
    await page.goto(`file:///${file}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__g15LabReady === true && window.__g15LabSnapshot());
    await page.waitForTimeout(180);

    let result = await page.evaluate(() => ({
      bytes: document.querySelector("#canvas").toDataURL("image/png").length,
      snapshot: window.__g15LabSnapshot(),
      stateText: document.querySelector("#state").textContent.trim(),
      similarityText: document.querySelector("#similarityLabel")?.textContent.trim(),
      rangeCount: document.querySelectorAll('input[type="range"]').length,
      actionCount: document.querySelectorAll("[data-action]").length
    }));
    if (result.bytes < 13000 || result.snapshot.has3d !== true || result.snapshot.nodeCount < 12 || result.snapshot.edgeCount < 10) {
      throw new Error(`G15 initial render is weak: ${JSON.stringify(result)}`);
    }
    if (result.rangeCount < 5 || result.actionCount < 5) throw new Error(`G15 controls are incomplete: ${JSON.stringify(result)}`);
    if (!/over-smoothing|over-squashing|depth|diffusion|bottleneck/i.test(result.stateText)) throw new Error(`G15 state copy is off-topic: ${result.stateText}`);
    await noScrollbars(page, "desktop");

    const thetaBefore = result.snapshot.cameraTheta;
    await page.mouse.move(440, 305);
    await page.mouse.down();
    await page.mouse.move(580, 365);
    await page.mouse.up();
    await page.waitForTimeout(80);
    result = await page.evaluate(() => window.__g15LabSnapshot());
    if (Math.abs(result.cameraTheta - thetaBefore) < 0.05) throw new Error("G15 camera did not rotate manually.");

    const beforeDirectLayer = await page.evaluate(() => window.__g15LabSnapshot());
    await page.click("#addLayer");
    await page.waitForFunction((previousDepth) => window.__g15LabSnapshot().layerDepth > previousDepth, beforeDirectLayer.layerDepth);
    const directLayer = await page.evaluate(() => ({ snapshot: window.__g15LabSnapshot(), depthValue: document.querySelector("#layerDepth").value }));
    if (directLayer.snapshot.layerDepth <= beforeDirectLayer.layerDepth || Number(directLayer.depthValue) !== directLayer.snapshot.layerDepth) {
      throw new Error(`G15 Layer command should increment depth directly: ${JSON.stringify({ beforeDirectLayer, directLayer })}`);
    }

    await page.selectOption("#graphShape", "barbell");
    await page.selectOption("#propagationRule", "plain");
    await setRange(page, "#residualWeight", 0);
    await setRange(page, "#rewireAmount", 0);
    await setRange(page, "#layerDepth", 2);
    await page.click("#addLayer");
    await page.waitForFunction(() => window.__g15LabSnapshot().phase === "layer");
    const shallow = await page.evaluate(() => window.__g15LabSnapshot());
    await setRange(page, "#layerDepth", 10);
    await page.click("#addLayer");
    await page.waitForTimeout(140);
    result = await page.evaluate(() => ({
      snapshot: window.__g15LabSnapshot(),
      stateText: document.querySelector("#state").textContent.trim(),
      similarityText: document.querySelector("#similarityLabel").textContent.trim()
    }));
    if (!(result.snapshot.meanSimilarity > shallow.meanSimilarity) || !(result.snapshot.dirichletEnergy < shallow.dirichletEnergy) || !(result.snapshot.classSeparation < shallow.classSeparation) || !/\d+\.\d+/.test(result.similarityText) || !/over-smoothing|pairwise|Dirichlet|diffusion/i.test(result.stateText)) {
      throw new Error(`G15 deeper plain propagation should smooth features and reduce class separation: ${JSON.stringify({ shallow, result })}`);
    }

    await setRange(page, "#bottleneckWidth", 1);
    await page.click("#runFive");
    await page.waitForFunction(() => window.__g15LabSnapshot().phase === "squash");
    const narrowCut = await page.evaluate(() => window.__g15LabSnapshot());
    await setRange(page, "#bottleneckWidth", 6);
    await page.click("#runFive");
    await page.waitForTimeout(140);
    result = await page.evaluate(() => ({ snapshot: window.__g15LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (!(result.snapshot.bottleneckLoad < narrowCut.bottleneckLoad) || !(result.snapshot.oversquashingIndex < narrowCut.oversquashingIndex) || !/bottleneck|over-squashing|cut|compressed/i.test(result.stateText)) {
      throw new Error(`G15 widening the cut should relieve over-squashing: ${JSON.stringify({ narrowCut, result })}`);
    }

    await page.selectOption("#propagationRule", "residual");
    await setRange(page, "#residualWeight", 0.85);
    await page.click("#addLayer");
    await page.waitForTimeout(120);
    const residual = await page.evaluate(() => ({ snapshot: window.__g15LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (!(residual.snapshot.classSeparation > result.snapshot.classSeparation) || !(residual.snapshot.meanSimilarity < result.snapshot.meanSimilarity) || !/residual|initial|preserve/i.test(residual.stateText)) {
      throw new Error(`G15 residual propagation should preserve initial features: ${JSON.stringify({ before: result, residual })}`);
    }

    await page.click("#rewireGraph");
    await page.waitForFunction(() => window.__g15LabSnapshot().phase === "rewire");
    result = await page.evaluate(() => ({ snapshot: window.__g15LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (result.snapshot.rewiredEdges <= 0 || result.snapshot.effectiveRadius <= shallow.effectiveRadius || !/rewire|shortcut|route/i.test(result.stateText)) {
      throw new Error(`G15 rewiring should add shortcut routes and enlarge effective reach: ${JSON.stringify(result)}`);
    }

    await page.click("#jumpReadout");
    await page.waitForFunction(() => window.__g15LabSnapshot().phase === "jump");
    result = await page.evaluate(() => ({ snapshot: window.__g15LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (result.snapshot.jumpingReadout !== true || !/Jumping|multi-depth|shallow/i.test(result.stateText)) {
      throw new Error(`G15 Jumping Knowledge readout should expose multi-depth rescue: ${JSON.stringify(result)}`);
    }

    await setRange(page, "#layerDepth", 13);
    await setRange(page, "#rewireAmount", 0.9);
    await page.click("#resetG15");
    await page.waitForFunction(() => window.__g15LabSnapshot().phase === "ready");
    result = await page.evaluate(() => ({ snapshot: window.__g15LabSnapshot(), depthValue: document.querySelector("#layerDepth").value, wireValue: document.querySelector("#rewireAmount").value }));
    if (result.snapshot.layerDepth !== 5 || result.snapshot.rewiredEdges !== 0 || result.snapshot.jumpingReadout !== false || Number(result.depthValue) !== 5 || Number(result.wireValue) !== 0) {
      throw new Error(`G15 reset should restore sliders and mitigation flags: ${JSON.stringify(result)}`);
    }

    await page.setViewportSize({ width: 900, height: 700 });
    await page.waitForTimeout(140);
    await noScrollbars(page, "narrow iframe");
    console.log("g15 smoke passed: over-smoothing, over-squashing, residual, rewiring, Jumping Knowledge, manual rotation, and iframe fit work.");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
