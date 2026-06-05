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
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  try {
    const file = path.join(__dirname, "g32-ai-foundations-lab.html").replace(/\\/g, "/");
    await page.goto(`file:///${file}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__g32LabReady === true && window.__g32LabSnapshot());
    await page.waitForTimeout(180);

    let result = await page.evaluate(() => ({
      bytes: document.querySelector("#canvas").toDataURL("image/png").length,
      snapshot: window.__g32LabSnapshot(),
      stateText: document.querySelector("#state").textContent.trim(),
      rangeCount: document.querySelectorAll('input[type="range"]').length,
      actionCount: document.querySelectorAll("[data-action]").length
    }));
    if (result.bytes < 13000 || result.snapshot.has3d !== true || result.snapshot.moduleCount < 6 || result.snapshot.pipelineEdgeCount < 6) {
      throw new Error(`G32 initial render is weak: ${JSON.stringify(result)}`);
    }
    if (result.rangeCount < 5 || result.actionCount < 5) throw new Error(`G32 controls are incomplete: ${JSON.stringify(result)}`);
    if (!/task|representation|inductive bias|objective|evaluation|deployment/i.test(result.stateText)) {
      throw new Error(`G32 state copy is off-topic: ${result.stateText}`);
    }
    await noScrollbars(page, "desktop");

    const thetaBefore = result.snapshot.cameraTheta;
    await page.mouse.move(440, 305);
    await page.mouse.down();
    await page.mouse.move(585, 360);
    await page.mouse.up();
    await page.waitForTimeout(80);
    result = await page.evaluate(() => window.__g32LabSnapshot());
    if (Math.abs(result.cameraTheta - thetaBefore) < 0.05) throw new Error("G32 camera did not rotate manually.");

    await page.selectOption("#taskFamily", "classification");
    await page.selectOption("#representationMode", "tokens");
    await page.selectOption("#objectiveType", "cross_entropy");
    await setRange(page, "#dataSize", 4);
    await setRange(page, "#modelCapacity", 2.4);
    await setRange(page, "#dataNoise", 0.75);
    await page.click("#trainModel");
    await page.waitForFunction(() => window.__g32LabSnapshot().phase === "train");
    const overfit = await page.evaluate(() => ({ snapshot: window.__g32LabSnapshot(), text: document.querySelector("#state").textContent.trim() }));
    if (overfit.snapshot.generalizationGap < 0.25 || overfit.snapshot.trainingLoss >= overfit.snapshot.validationLoss || !/training|generalization gap|overfit/i.test(overfit.text)) {
      throw new Error(`G32 high-capacity low-data training should expose overfitting: ${JSON.stringify(overfit)}`);
    }

    await setRange(page, "#dataSize", 15);
    await setRange(page, "#biasMatch", 0.9);
    await page.click("#buildBaseline");
    await page.waitForFunction(() => window.__g32LabSnapshot().phase === "baseline");
    result = await page.evaluate(() => ({ snapshot: window.__g32LabSnapshot(), text: document.querySelector("#state").textContent.trim(), gapText: document.querySelector("#gapLabel").textContent.trim() }));
    if (!(result.snapshot.generalizationGap < overfit.snapshot.generalizationGap) || !(result.snapshot.biasAlignment > overfit.snapshot.biasAlignment) || !/\d+\.\d+/.test(result.gapText) || !/baseline|inductive bias|representation/i.test(result.text)) {
      throw new Error(`G32 baseline and matched bias should reduce the gap: ${JSON.stringify({ overfit, result })}`);
    }

    await setRange(page, "#shiftLevel", 0.1);
    await page.click("#stressTest");
    await page.waitForFunction(() => window.__g32LabSnapshot().phase === "stress");
    const mildShift = await page.evaluate(() => window.__g32LabSnapshot());
    await setRange(page, "#shiftLevel", 0.85);
    await page.click("#stressTest");
    await page.waitForTimeout(120);
    result = await page.evaluate(() => ({ snapshot: window.__g32LabSnapshot(), text: document.querySelector("#state").textContent.trim() }));
    if (!(result.snapshot.deploymentRisk > mildShift.deploymentRisk) || !(result.snapshot.calibrationError > mildShift.calibrationError) || !/stress|distribution shift|deployment|calibration/i.test(result.text)) {
      throw new Error(`G32 stress testing should raise deployment and calibration risk under shift: ${JSON.stringify({ mildShift, result })}`);
    }

    await page.selectOption("#taskFamily", "agentic");
    await page.selectOption("#objectiveType", "reward");
    await page.click("#runAgentLoop");
    await page.waitForFunction(() => window.__g32LabSnapshot().phase === "agent");
    result = await page.evaluate(() => ({ snapshot: window.__g32LabSnapshot(), text: document.querySelector("#state").textContent.trim() }));
    if (result.snapshot.agentLoopDepth < 2 || result.snapshot.verificationCoverage <= 0 || !/agent|tool|feedback|verification|reward/i.test(result.text)) {
      throw new Error(`G32 agent loop should expose planning, tools, feedback, and verification: ${JSON.stringify(result)}`);
    }

    await setRange(page, "#dataNoise", 1.1);
    await setRange(page, "#shiftLevel", 0.9);
    await page.click("#resetG32");
    await page.waitForFunction(() => window.__g32LabSnapshot().phase === "ready");
    result = await page.evaluate(() => ({ snapshot: window.__g32LabSnapshot(), noiseValue: document.querySelector("#dataNoise").value, shiftValue: document.querySelector("#shiftLevel").value }));
    if (result.snapshot.taskFamily !== "classification" || Number(result.noiseValue) !== 0.25 || Number(result.shiftValue) !== 0.22) {
      throw new Error(`G32 reset should restore system defaults: ${JSON.stringify(result)}`);
    }

    await page.setViewportSize({ width: 900, height: 700 });
    await page.waitForTimeout(120);
    await noScrollbars(page, "narrow iframe");
    console.log("g32 smoke passed: AI foundations lab renders system pipeline, overfitting, baselines, stress tests, agent loop, manual rotation, and iframe fit.");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
