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
    const file = path.join(__dirname, "g14-gnn-adversarial-perturbation-lab.html").replace(/\\/g, "/");
    await page.goto(`file:///${file}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__g14LabReady === true && window.__g14LabSnapshot());
    await page.waitForTimeout(180);

    let result = await page.evaluate(() => ({
      bytes: document.querySelector("#canvas").toDataURL("image/png").length,
      snapshot: window.__g14LabSnapshot(),
      stateText: document.querySelector("#state").textContent.trim(),
      rangeCount: document.querySelectorAll('input[type="range"]').length,
      actionCount: document.querySelectorAll("[data-action]").length
    }));
    if (result.bytes < 13000 || result.snapshot.has3d !== true || result.snapshot.nodeCount < 10 || result.snapshot.cleanEdgeCount < 10) {
      throw new Error(`G14 initial render is weak: ${JSON.stringify(result)}`);
    }
    if (result.rangeCount < 5 || result.actionCount < 4) throw new Error(`G14 controls are incomplete: ${JSON.stringify(result)}`);
    if (!/attack|robust|perturbation|evasion|poison/i.test(result.stateText)) throw new Error(`G14 state copy is off-topic: ${result.stateText}`);
    await noScrollbars(page, "desktop");

    const thetaBefore = result.snapshot.cameraTheta;
    await page.mouse.move(430, 310);
    await page.mouse.down();
    await page.mouse.move(560, 360);
    await page.mouse.up();
    await page.waitForTimeout(80);
    result = await page.evaluate(() => window.__g14LabSnapshot());
    if (Math.abs(result.cameraTheta - thetaBefore) < 0.05) throw new Error("G14 camera did not rotate manually.");

    await page.selectOption("#attackType", "evasion");
    await page.selectOption("#defenseMode", "none");
    await setRange(page, "#attackBudget", 1);
    await page.click("#flipEdge");
    await page.waitForFunction(() => window.__g14LabSnapshot().phase === "attack");
    const lowBudget = await page.evaluate(() => window.__g14LabSnapshot());
    await setRange(page, "#attackBudget", 6);
    await page.click("#flipEdge");
    await page.waitForTimeout(120);
    result = await page.evaluate(() => ({ snapshot: window.__g14LabSnapshot(), stateText: document.querySelector("#state").textContent.trim(), confidenceText: document.querySelector("#confidenceLabel").textContent.trim() }));
    if (!(result.snapshot.changedEdges > lowBudget.changedEdges) || !(result.snapshot.robustMargin < lowBudget.robustMargin) || !/\d+\.\d+/.test(result.confidenceText) || !/edge|evasion|target|margin/i.test(result.stateText)) {
      throw new Error(`G14 edge budget should visibly reduce the target margin: ${JSON.stringify({ lowBudget, result })}`);
    }

    await page.selectOption("#defenseMode", "similarity");
    await setRange(page, "#defenseStrength", 0.1);
    await page.click("#applyDefense");
    await page.waitForFunction(() => window.__g14LabSnapshot().phase === "defense");
    const weakDefense = await page.evaluate(() => window.__g14LabSnapshot());
    await setRange(page, "#defenseStrength", 1.25);
    await page.click("#applyDefense");
    await page.waitForTimeout(120);
    result = await page.evaluate(() => ({ snapshot: window.__g14LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (!(result.snapshot.rejectedEdgeCount > weakDefense.rejectedEdgeCount) || !(result.snapshot.robustMargin > weakDefense.robustMargin) || !/defense|filter|robust|rejected/i.test(result.stateText)) {
      throw new Error(`G14 stronger sanitation should reject more adversarial edges and recover margin: ${JSON.stringify({ weakDefense, result })}`);
    }

    await page.selectOption("#defenseMode", "similarity");
    await page.click("#applyDefense");
    await page.waitForTimeout(100);
    const similarityDefense = await page.evaluate(() => window.__g14LabSnapshot());
    await page.selectOption("#defenseMode", "trimmed");
    await page.click("#applyDefense");
    await page.waitForTimeout(100);
    const trimmedDefense = await page.evaluate(() => window.__g14LabSnapshot());
    await page.selectOption("#defenseMode", "attention");
    await page.click("#applyDefense");
    await page.waitForTimeout(100);
    const attentionDefense = await page.evaluate(() => window.__g14LabSnapshot());
    const distinctDefenseModes = new Set([
      `${similarityDefense.rejectedEdgeCount}:${similarityDefense.defenseCost.toFixed(3)}:${similarityDefense.robustMargin.toFixed(3)}`,
      `${trimmedDefense.rejectedEdgeCount}:${trimmedDefense.defenseCost.toFixed(3)}:${trimmedDefense.robustMargin.toFixed(3)}`,
      `${attentionDefense.rejectedEdgeCount}:${attentionDefense.defenseCost.toFixed(3)}:${attentionDefense.robustMargin.toFixed(3)}`
    ]);
    if (distinctDefenseModes.size < 3) {
      throw new Error(`G14 defense selector should have real mathematical and visual consequences: ${JSON.stringify({ similarityDefense, trimmedDefense, attentionDefense })}`);
    }

    await page.selectOption("#attackType", "poisoning");
    await setRange(page, "#attackBudget", 5);
    await setRange(page, "#featureShift", 0.32);
    await page.click("#poisonTraining");
    await page.waitForFunction(() => window.__g14LabSnapshot().phase === "poison");
    result = await page.evaluate(() => ({ snapshot: window.__g14LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (result.snapshot.poisonedLabels <= 0 || result.snapshot.trainingDamage <= 0 || !/poison|training|label|before learning/i.test(result.stateText)) {
      throw new Error(`G14 poisoning mode should show training-label damage: ${JSON.stringify(result)}`);
    }

    await setRange(page, "#featureShift", 0.85);
    await page.click("#runThreatModel");
    await page.waitForFunction(() => window.__g14LabSnapshot().phase === "threat");
    result = await page.evaluate(() => ({ snapshot: window.__g14LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (result.snapshot.featureDrift <= 0.5 || result.snapshot.attackSurface <= 0 || !/threat model|feature|budget|plausibility/i.test(result.stateText)) {
      throw new Error(`G14 threat model should expose feature and structure attack surface: ${JSON.stringify(result)}`);
    }

    await setRange(page, "#attackBudget", 0);
    await setRange(page, "#featureShift", 0);
    await page.selectOption("#attackType", "poisoning");
    await page.click("#poisonTraining");
    await page.waitForFunction(() => window.__g14LabSnapshot().phase === "poison");
    const zeroBudgetPoison = await page.evaluate(() => window.__g14LabSnapshot());
    if (zeroBudgetPoison.poisonedLabels !== 0 || zeroBudgetPoison.trainingDamage !== 0) {
      throw new Error(`G14 zero perturbation budget should not poison labels or damage training: ${JSON.stringify(zeroBudgetPoison)}`);
    }

    await page.setViewportSize({ width: 900, height: 700 });
    await page.waitForTimeout(120);
    await noScrollbars(page, "narrow iframe");
    console.log("g14 smoke passed: robustness lab renders evasion, poisoning, perturbation budgets, defenses, threat model diagnostics, and fits iframe.");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
