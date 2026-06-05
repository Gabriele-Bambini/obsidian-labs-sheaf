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
    let e09 = await loadLab(page, "e09-diffusion-denoising.html", "__e09LabReady", "__e09LabSnapshot");
    requireFitted(e09, "E09");
    if (e09.bytes < 10000 || e09.snapshot.visualQuality !== "e09-e10-neural-specific-v1" || e09.snapshot.visualRoleCount < 10) {
      throw new Error(`E09 premium visual contract is weak: ${JSON.stringify(e09)}.`);
    }
    requireRoles(e09.snapshot, [
      "forward noising Markov chain ladder",
      "reverse denoising trajectory",
      "noise schedule beta rail",
      "score vector field arrows",
      "data manifold mode islands",
      "x0 noise prediction bridge",
      "guidance scale condition magnet",
      "sampler step-size stability gauge",
      "DDPM stochastic noise injection cloud",
      "DDIM deterministic shortcut path"
    ], "E09");
    if (!/diffusion|noise|denois|score|schedule|guidance/i.test(e09.stateText)) {
      throw new Error(`E09 state text is weak: ${e09.stateText}`);
    }
    await page.locator("#schedule").selectOption("cosine");
    await page.locator("#sampler").selectOption("ddim");
    await setRange(page, "#timestep", "42");
    await setRange(page, "#guidanceScale", "2.2");
    await setRange(page, "#stepSize", "0.65");
    await setRange(page, "#noiseLevel", "0.70");
    await page.click("#denoiseStep");
    e09 = await page.evaluate(() => ({
      snapshot: window.__e09LabSnapshot(),
      text: (document.querySelector("#state") || document.querySelector("#stateBox")).textContent.trim(),
      snrText: document.querySelector("#snrLabel").textContent.trim()
    }));
    if (e09.snapshot.schedule !== "cosine" || e09.snapshot.sampler !== "ddim" || e09.snapshot.denoiseStep < 1 || Math.abs(e09.snapshot.guidanceScale - 2.2) > 0.01) {
      throw new Error(`E09 controls did not update diffusion parameters: ${JSON.stringify(e09)}.`);
    }
    if (e09.snapshot.scoreMagnitude <= 0 || e09.snapshot.signalToNoise <= 0 || e09.snapshot.predictedNoise <= 0 || !e09.snrText.includes(".") || !/denois|score|guidance|schedule/i.test(e09.text)) {
      throw new Error(`E09 controls did not reshape diffusion denoising dynamics: ${JSON.stringify(e09)}.`);
    }

    let e10 = await loadLab(page, "e10-normalizing-flow-density.html", "__e10LabReady", "__e10LabSnapshot");
    requireFitted(e10, "E10");
    if (e10.bytes < 10000 || e10.snapshot.visualQuality !== "e09-e10-neural-specific-v1" || e10.snapshot.visualRoleCount < 10) {
      throw new Error(`E10 premium visual contract is weak: ${JSON.stringify(e10)}.`);
    }
    requireRoles(e10.snapshot, [
      "base gaussian density curve",
      "invertible flow warp grid",
      "change-of-variables mass conservation tiles",
      "jacobian log-det volume bars",
      "affine coupling triangular jacobian",
      "data-to-latent forward path",
      "latent-to-data sampling path",
      "composition logdet sum stack",
      "highlighted x z density bead",
      "likelihood anomaly warning ridge"
    ], "E10");
    if (!/flow|invertible|Jacobian|log-det|density|likelihood/i.test(e10.stateText)) {
      throw new Error(`E10 state text is weak: ${e10.stateText}`);
    }
    await page.locator("#flowType").selectOption("coupling");
    await page.locator("#direction").selectOption("density");
    await setRange(page, "#layers", "5");
    await setRange(page, "#bendStrength", "1.4");
    await setRange(page, "#xPoint", "1.25");
    await setRange(page, "#scaleClamp", "0.8");
    await setRange(page, "#dequantization", "0.25");
    await page.click("#warp");
    e10 = await page.evaluate(() => ({
      snapshot: window.__e10LabSnapshot(),
      text: (document.querySelector("#state") || document.querySelector("#stateBox")).textContent.trim(),
      logdetText: document.querySelector("#logdetLabel").textContent.trim()
    }));
    if (e10.snapshot.flowType !== "coupling" || e10.snapshot.direction !== "density" || e10.snapshot.layers !== 5 || e10.snapshot.warpStep < 1 || Math.abs(e10.snapshot.bendStrength - 1.4) > 0.01) {
      throw new Error(`E10 controls did not update flow parameters: ${JSON.stringify(e10)}.`);
    }
    if (!Number.isFinite(e10.snapshot.logDet) || !Number.isFinite(e10.snapshot.likelihood) || e10.snapshot.densityRatio <= 0 || !e10.logdetText.includes(".") || !/log-det|Jacobian|density|likelihood/i.test(e10.text)) {
      throw new Error(`E10 controls did not reshape normalizing-flow density dynamics: ${JSON.stringify(e10)}.`);
    }
  } finally {
    await browser.close();
  }
  console.log("e09-e10 premium smoke passed: diffusion and flow labs expose specific visual roles, controls, diagnostics, and iframe fit.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
