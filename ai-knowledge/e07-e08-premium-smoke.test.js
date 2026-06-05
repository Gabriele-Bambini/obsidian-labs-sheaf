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
  await page.waitForTimeout(220);
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

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  try {
    let e07 = await loadLab(page, "e07-vae-latent-space-lab.html", "__e07LabReady", "__e07LabSnapshot");
    if (e07.bytes < 10000 || e07.snapshot.visualQuality !== "e07-e08-neural-specific-v1" || e07.snapshot.visualRoleCount < 10) {
      throw new Error(`E07 premium visual contract is weak: ${JSON.stringify(e07)}.`);
    }
    requireRoles(e07.snapshot, [
      "encoder posterior gaussian ellipses",
      "standard normal prior bowl",
      "reparameterization epsilon bridge",
      "decoder manifold reconstruction sheet",
      "ELBO reconstruction KL balance seesaw",
      "latent traversal interpolation rail",
      "posterior collapse warning funnel",
      "prior-sampling hole detector",
      "beta-VAE regularization dial",
      "smooth latent neighborhood grid"
    ], "E07");
    if (!/encoder|decoder|latent|KL|ELBO|reparameter/i.test(e07.stateText)) {
      throw new Error(`E07 state text is weak: ${e07.stateText}`);
    }
    await page.locator("#sampleMode").selectOption("prior");
    await page.locator("#inputClass").selectOption("loop");
    await setRange(page, "#beta", "2.4");
    await setRange(page, "#latentSpread", "1.6");
    await setRange(page, "#reconstructionWeight", "0.45");
    await setRange(page, "#epsilon", "1.2");
    await page.click("#sampleLatent");
    e07 = await page.evaluate(() => ({
      snapshot: window.__e07LabSnapshot(),
      text: (document.querySelector("#state") || document.querySelector("#stateBox")).textContent.trim()
    }));
    if (e07.snapshot.sampleMode !== "prior" || e07.snapshot.inputClass !== "loop" || Math.abs(e07.snapshot.beta - 2.4) > 0.01 || Math.abs(e07.snapshot.latentSpread - 1.6) > 0.01) {
      throw new Error(`E07 controls did not update VAE parameters: ${JSON.stringify(e07)}.`);
    }
    if (e07.snapshot.klLoss <= 0 || e07.snapshot.elboLoss <= 0 || e07.snapshot.priorOverlap <= 0 || !/prior|KL|latent|sample/i.test(e07.text)) {
      throw new Error(`E07 controls did not reshape the VAE objective visualization: ${JSON.stringify(e07)}.`);
    }

    let e08 = await loadLab(page, "e08-gan-minimax-game.html", "__e08LabReady", "__e08LabSnapshot");
    if (e08.bytes < 10000 || e08.snapshot.visualQuality !== "e07-e08-neural-specific-v1" || e08.snapshot.visualRoleCount < 10) {
      throw new Error(`E08 premium visual contract is weak: ${JSON.stringify(e08)}.`);
    }
    requireRoles(e08.snapshot, [
      "real data density mode islands",
      "generator fake sample swarm",
      "discriminator decision surface curtain",
      "minimax saddle game board",
      "generator gradient vector field",
      "discriminator training boundary lift",
      "mode-collapse alarm funnel",
      "Wasserstein critic distance rail",
      "real fake score histogram",
      "coverage versus realism diagnostic"
    ], "E08");
    if (!/generator|discriminator|real|fake|collapse|gradient/i.test(e08.stateText)) {
      throw new Error(`E08 state text is weak: ${e08.stateText}`);
    }
    await page.locator("#dataModes").selectOption("two");
    await page.locator("#lossMode").selectOption("wgan");
    await setRange(page, "#generatorMean", "1.4");
    await setRange(page, "#generatorSpread", "0.38");
    await setRange(page, "#discriminatorStrength", "1.6");
    await setRange(page, "#collapsePressure", "0.85");
    await page.click("#trainG");
    e08 = await page.evaluate(() => ({
      snapshot: window.__e08LabSnapshot(),
      text: (document.querySelector("#state") || document.querySelector("#stateBox")).textContent.trim(),
      gapText: document.querySelector("#gapLabel").textContent.trim()
    }));
    if (e08.snapshot.dataModes !== "two" || e08.snapshot.lossMode !== "wgan" || e08.snapshot.generatorStep < 1 || Math.abs(e08.snapshot.collapsePressure - 0.85) > 0.01) {
      throw new Error(`E08 controls did not update GAN game parameters: ${JSON.stringify(e08)}.`);
    }
    if (e08.snapshot.coverage < 0 || e08.snapshot.modeCollapseRisk <= 0 || e08.snapshot.distributionGap <= 0 || !e08.gapText.includes(".") || !/generator|critic|fake|real|coverage/i.test(e08.text)) {
      throw new Error(`E08 controls did not reshape GAN minimax dynamics: ${JSON.stringify(e08)}.`);
    }
  } finally {
    await browser.close();
  }
  console.log("e07-e08 premium smoke passed: VAE and GAN labs expose specific visual roles, controls, diagnostics, and iframe fit.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
