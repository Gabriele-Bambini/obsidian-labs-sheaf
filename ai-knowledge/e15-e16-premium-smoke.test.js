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
  await page.waitForTimeout(260);
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
    let e15 = await loadLab(page, "e15-neural-ode-flow.html", "__e15LabReady", "__e15LabSnapshot");
    requireFitted(e15, "E15");
    if (e15.bytes < 10000 || e15.snapshot.visualQuality !== "e15-e16-dynamics-energy-specific-v1" || e15.snapshot.visualRoleCount < 12) {
      throw new Error(`E15 premium visual contract is weak: ${JSON.stringify(e15)}.`);
    }
    requireRoles(e15.snapshot, [
      "learned vector field arrows",
      "continuous-depth trajectory ribbon",
      "Euler residual-step ladder",
      "midpoint trial-state markers",
      "adaptive solver step-size gates",
      "terminal classifier target basin",
      "adjoint backward sensitivity path",
      "direct-backprop memory tape",
      "stiffness small-step warning zone",
      "augmented-dimension overpass",
      "continuous normalizing-flow log-density rail",
      "ResNet discrete-layer comparison scaffold"
    ], "E15");
    if (!/ODE|solver|vector field|adjoint|continuous|stiff/i.test(e15.stateText)) {
      throw new Error(`E15 state text is weak: ${e15.stateText}`);
    }
    await page.locator("#solverMode").selectOption("adaptive");
    await page.locator("#fieldType").selectOption("stiff");
    await setRange(page, "#finalTime", "2.4");
    await setRange(page, "#stepCount", "9");
    await setRange(page, "#tolerance", "0.32");
    await setRange(page, "#stiffness", "0.78");
    await setRange(page, "#augmentationDim", "0.55");
    await setRange(page, "#adjointTradeoff", "0.68");
    await page.click("#solveForward");
    e15 = await page.evaluate(() => ({
      snapshot: window.__e15LabSnapshot(),
      text: (document.querySelector("#state") || document.querySelector("#stateBox")).textContent.trim(),
      nfeText: document.querySelector("#nfeLabel").textContent.trim(),
      errorText: document.querySelector("#endpointErrorLabel").textContent.trim()
    }));
    if (e15.snapshot.solverMode !== "adaptive" || e15.snapshot.fieldType !== "stiff" || e15.snapshot.solveStep < 1 || Math.abs(e15.snapshot.finalTime - 2.4) > 0.01) {
      throw new Error(`E15 controls did not update ODE parameters: ${JSON.stringify(e15)}.`);
    }
    if (e15.snapshot.nfe <= 0 || e15.snapshot.endpointError < 0 || e15.snapshot.adjointMismatch < 0 || e15.snapshot.trajectoryLength <= 0 || !e15.nfeText.includes(".") || !e15.errorText.includes(".") || !/adaptive|solver|adjoint|stiff|continuous/i.test(e15.text)) {
      throw new Error(`E15 controls did not reshape solver dynamics: ${JSON.stringify(e15)}.`);
    }

    let e16 = await loadLab(page, "e16-energy-langevin-lab.html", "__e16LabReady", "__e16LabSnapshot");
    requireFitted(e16, "E16");
    if (e16.bytes < 10000 || e16.snapshot.visualQuality !== "e15-e16-dynamics-energy-specific-v1" || e16.snapshot.visualRoleCount < 12) {
      throw new Error(`E16 premium visual contract is weak: ${JSON.stringify(e16)}.`);
    }
    requireRoles(e16.snapshot, [
      "low-energy data valley basins",
      "high-energy barrier ridges",
      "score-field downhill arrows",
      "Langevin particle chains",
      "temperature exploration noise halo",
      "positive phase data clamps",
      "negative phase model-sample raisers",
      "partition-function mass contour rings",
      "replay buffer persistent particles",
      "contrastive divergence short-chain bias marker",
      "mode-mixing barrier crossing bridge",
      "out-of-distribution low-energy trap warning"
    ], "E16");
    if (!/energy|Langevin|positive|negative|partition|score/i.test(e16.stateText)) {
      throw new Error(`E16 state text is weak: ${e16.stateText}`);
    }
    await page.locator("#energyLandscape").selectOption("twoValleys");
    await page.locator("#samplerMode").selectOption("langevin");
    await setRange(page, "#temperature", "0.72");
    await setRange(page, "#stepSize", "0.34");
    await setRange(page, "#samplerSteps", "7");
    await setRange(page, "#replayMix", "0.66");
    await setRange(page, "#energyScale", "1.35");
    await setRange(page, "#negativePressure", "0.58");
    await page.click("#langevinStep");
    e16 = await page.evaluate(() => ({
      snapshot: window.__e16LabSnapshot(),
      text: (document.querySelector("#state") || document.querySelector("#stateBox")).textContent.trim(),
      dataText: document.querySelector("#dataEnergyLabel").textContent.trim(),
      negativeText: document.querySelector("#negativeEnergyLabel").textContent.trim()
    }));
    if (e16.snapshot.energyLandscape !== "twoValleys" || e16.snapshot.samplerMode !== "langevin" || e16.snapshot.sampleStep < 1 || Math.abs(e16.snapshot.temperature - 0.72) > 0.01) {
      throw new Error(`E16 controls did not update EBM parameters: ${JSON.stringify(e16)}.`);
    }
    if (e16.snapshot.dataEnergy >= e16.snapshot.negativeEnergy || e16.snapshot.mixingScore < 0 || e16.snapshot.partitionProxy <= 0 || e16.snapshot.phaseGap <= 0 || !e16.dataText.includes(".") || !e16.negativeText.includes(".") || !/Langevin|energy|positive|negative|partition|score/i.test(e16.text)) {
      throw new Error(`E16 controls did not reshape EBM dynamics: ${JSON.stringify(e16)}.`);
    }
  } finally {
    await browser.close();
  }
  console.log("e15-e16 premium smoke passed: Neural ODE and EBM labs expose specific visual roles, controls, diagnostics, and iframe fit.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
