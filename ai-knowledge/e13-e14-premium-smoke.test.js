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

async function setRange(page, selector, value) {
  await page.locator(selector).evaluate((input, nextValue) => {
    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function loadLab(page, fileName, readyName, snapshotName) {
  const labPath = path.join(__dirname, fileName).replace(/\\/g, "/");
  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas#canvas").waitFor({ state: "visible" });
  await page.waitForFunction(
    ([ready, snapshot]) => window[ready] === true && typeof window[snapshot] === "function" && window[snapshot](),
    [readyName, snapshotName]
  );
  await page.waitForTimeout(240);
  return page.evaluate((snapshot) => {
    const canvas = document.querySelector(".lab-viewport canvas");
    const stateNode = document.querySelector("#state") || document.querySelector("#stateBox") || document.querySelector(".state-box");
    return {
      bytes: canvas.toDataURL("image/png").length,
      snapshot: window[snapshot](),
      stateText: stateNode.textContent.trim(),
      overflowX: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
      overflowY: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight
    };
  }, snapshotName);
}

function requireRoles(snapshot, roles, lab) {
  for (const role of roles) {
    if (!snapshot.visualRoles || !snapshot.visualRoles.some((candidate) => candidate.includes(role))) {
      throw new Error(`${lab} missing visual role: ${role}`);
    }
  }
}

function requireFitted(result, lab) {
  if (result.overflowX > 18 || result.overflowY > 18) {
    throw new Error(`${lab} iframe fit regressed: overflowX=${result.overflowX}, overflowY=${result.overflowY}`);
  }
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  try {
    let e13 = await loadLab(page, "e13-meta-learning-inner-loop.html", "__e13LabReady", "__e13LabSnapshot");
    requireFitted(e13, "E13");
    if (e13.bytes < 10000 || e13.snapshot.visualQuality !== "e13-e14-representation-specific-v1" || e13.snapshot.visualRoleCount < 10) {
      throw new Error(`E13 premium visual contract is weak: ${JSON.stringify(e13)}.`);
    }
    requireRoles(e13.snapshot, [
      "support set task evidence points",
      "query set held-out evaluation points",
      "meta initialization parameter basin",
      "inner-loop gradient adaptation path",
      "outer-loop meta-gradient bridge",
      "task-optima constellation",
      "MAML second-order curvature sheet",
      "Reptile first-order pull vector",
      "prototypical class centroid anchors",
      "meta-overfitting distribution-shift warning"
    ], "E13");
    if (!/meta|support|query|MAML|inner|outer|adapt/i.test(e13.stateText)) {
      throw new Error(`E13 state text is weak: ${e13.stateText}`);
    }
    await page.locator("#taskFamily").selectOption("sinusoid");
    await page.locator("#adaptationMode").selectOption("maml");
    await setRange(page, "#innerSteps", "3");
    await setRange(page, "#innerLR", "0.45");
    await setRange(page, "#metaLR", "0.30");
    await setRange(page, "#shots", "2");
    await setRange(page, "#taskSpread", "1.4");
    await setRange(page, "#queryShift", "0.35");
    await page.click("#adaptTask");
    e13 = await page.evaluate(() => ({
      snapshot: window.__e13LabSnapshot(),
      text: (document.querySelector("#state") || document.querySelector("#stateBox")).textContent.trim(),
      queryText: document.querySelector("#queryLossLabel").textContent.trim(),
      gainText: document.querySelector("#adaptGainLabel").textContent.trim()
    }));
    if (e13.snapshot.taskFamily !== "sinusoid" || e13.snapshot.adaptationMode !== "maml" || e13.snapshot.innerStepCount < 1 || Math.abs(e13.snapshot.innerLR - 0.45) > 0.01) {
      throw new Error(`E13 controls did not update meta-learning parameters: ${JSON.stringify(e13)}.`);
    }
    if (e13.snapshot.queryLoss <= 0 || e13.snapshot.adaptationGain <= 0 || e13.snapshot.metaGradientMagnitude <= 0 || !e13.queryText.includes(".") || !e13.gainText.includes(".") || !/support|query|inner|outer|MAML|adapt/i.test(e13.text)) {
      throw new Error(`E13 controls did not reshape meta-learning dynamics: ${JSON.stringify(e13)}.`);
    }

    let e14 = await loadLab(page, "e14-contrastive-representation-lab.html", "__e14LabReady", "__e14LabSnapshot");
    requireFitted(e14, "E14");
    if (e14.bytes < 10000 || e14.snapshot.visualQuality !== "e13-e14-representation-specific-v1" || e14.snapshot.visualRoleCount < 10) {
      throw new Error(`E14 premium visual contract is weak: ${JSON.stringify(e14)}.`);
    }
    requireRoles(e14.snapshot, [
      "positive augmented-view tether pairs",
      "negative embedding repulsion field",
      "InfoNCE temperature softmax bowl",
      "hard-negative focus spotlight",
      "augmentation invariance distortion tunnel",
      "representation collapse warning sink",
      "projection head separation gate",
      "masked patch reconstruction panel",
      "linear probe transfer axis",
      "false-negative semantic collision beacon"
    ], "E14");
    if (!/contrastive|InfoNCE|positive|negative|temperature|collapse|representation/i.test(e14.stateText)) {
      throw new Error(`E14 state text is weak: ${e14.stateText}`);
    }
    await page.locator("#pretextTask").selectOption("contrastive");
    await page.locator("#augmentation").selectOption("crop");
    await setRange(page, "#temperature", "0.35");
    await setRange(page, "#hardNegative", "0.82");
    await setRange(page, "#augmentationStrength", "0.55");
    await setRange(page, "#negativeCount", "10");
    await setRange(page, "#collapsePressure", "0.38");
    await setRange(page, "#maskRatio", "0.60");
    await page.click("#contrastiveStep");
    e14 = await page.evaluate(() => ({
      snapshot: window.__e14LabSnapshot(),
      text: (document.querySelector("#state") || document.querySelector("#stateBox")).textContent.trim(),
      lossText: document.querySelector("#infoNceLabel").textContent.trim(),
      collapseText: document.querySelector("#collapseLabel").textContent.trim()
    }));
    if (e14.snapshot.pretextTask !== "contrastive" || e14.snapshot.augmentation !== "crop" || e14.snapshot.step < 1 || Math.abs(e14.snapshot.temperature - 0.35) > 0.01) {
      throw new Error(`E14 controls did not update SSL parameters: ${JSON.stringify(e14)}.`);
    }
    if (e14.snapshot.infoNceLoss <= 0 || e14.snapshot.alignment <= 0 || e14.snapshot.uniformity <= 0 || e14.snapshot.collapseRisk < 0 || !e14.lossText.includes(".") || !e14.collapseText.includes(".") || !/InfoNCE|positive|negative|temperature|collapse/i.test(e14.text)) {
      throw new Error(`E14 controls did not reshape contrastive SSL dynamics: ${JSON.stringify(e14)}.`);
    }
  } finally {
    await browser.close();
  }
  console.log("e13-e14 premium smoke passed: meta-learning and contrastive SSL labs expose specific visual roles, controls, diagnostics, and iframe fit.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
