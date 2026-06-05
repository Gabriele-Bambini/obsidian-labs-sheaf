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
    let e17 = await loadLab(page, "e17-ssm-scan.html", "__e17LabReady", "__e17LabSnapshot");
    requireFitted(e17, "E17");
    if (e17.bytes < 10000 || e17.snapshot.visualQuality !== "e17-e18-sequence-physics-specific-v1" || e17.snapshot.visualRoleCount < 12) {
      throw new Error(`E17 premium visual contract is weak: ${JSON.stringify(e17)}.`);
    }
    requireRoles(e17.snapshot, [
      "continuous-time A matrix memory eigenmodes",
      "input write vector B_t stream",
      "state memory recurrent update lane",
      "readout C_t output taps",
      "convolution kernel impulse-response tail",
      "S4 HiPPO long-memory basis stack",
      "complex eigenvalue oscillation rings",
      "selective Delta_t retention gates",
      "associative scan composition tree",
      "Mamba content-dependent token gates",
      "recurrent convolution scan equivalence bridge",
      "attention quadratic cost comparison panel"
    ], "E17");
    if (!/SSM|state|scan|convolution|Mamba|memory/i.test(e17.stateText)) {
      throw new Error(`E17 state text is weak: ${e17.stateText}`);
    }
    await page.locator("#sequencePreset").selectOption("reset");
    await page.locator("#executionView").selectOption("scan");
    await setRange(page, "#retention", "0.86");
    await setRange(page, "#inputGate", "0.72");
    await setRange(page, "#deltaScale", "0.64");
    await setRange(page, "#stateSize", "7");
    await setRange(page, "#selectivity", "0.78");
    await setRange(page, "#kernelLength", "12");
    await page.click("#scanStep");
    e17 = await page.evaluate(() => ({
      snapshot: window.__e17LabSnapshot(),
      text: (document.querySelector("#state") || document.querySelector("#stateBox")).textContent.trim(),
      memoryText: document.querySelector("#memoryRetentionLabel").textContent.trim(),
      scanText: document.querySelector("#scanErrorLabel").textContent.trim()
    }));
    if (e17.snapshot.sequencePreset !== "reset" || e17.snapshot.executionView !== "scan" || e17.snapshot.scanStep < 1 || Math.abs(e17.snapshot.retention - 0.86) > 0.01) {
      throw new Error(`E17 controls did not update SSM parameters: ${JSON.stringify(e17)}.`);
    }
    if (e17.snapshot.memoryRetention <= 0 || e17.snapshot.scanEquivalenceError < 0 || e17.snapshot.kernelReach <= 0 || e17.snapshot.streamingCost <= 0 || !e17.memoryText.includes(".") || !e17.scanText.includes(".") || !/scan|state|Mamba|Delta|kernel|memory/i.test(e17.text)) {
      throw new Error(`E17 controls did not reshape SSM dynamics: ${JSON.stringify(e17)}.`);
    }

    let e18 = await loadLab(page, "e18-pinn-residual-lab.html", "__e18LabReady", "__e18LabSnapshot");
    requireFitted(e18, "E18");
    if (e18.bytes < 10000 || e18.snapshot.visualQuality !== "e17-e18-sequence-physics-specific-v1" || e18.snapshot.visualRoleCount < 12) {
      throw new Error(`E18 premium visual contract is weak: ${JSON.stringify(e18)}.`);
    }
    requireRoles(e18.snapshot, [
      "sparse supervised measurement points",
      "physics residual collocation halos",
      "PDE operator derivative stencil",
      "boundary condition clamp rails",
      "soft boundary penalty field",
      "hard constraint output transform",
      "data physics boundary loss balance scales",
      "adaptive collocation residual hotspot sampler",
      "inverse coefficient alpha estimate gauge",
      "dense residual validation heatmap",
      "spectral bias high-frequency miss warning",
      "classical solver comparison mesh"
    ], "E18");
    if (!/PINN|physics|residual|collocation|boundary|loss/i.test(e18.stateText)) {
      throw new Error(`E18 state text is weak: ${e18.stateText}`);
    }
    await page.locator("#pdePreset").selectOption("burgers");
    await page.locator("#boundaryMode").selectOption("hard");
    await setRange(page, "#physicsWeight", "0.82");
    await setRange(page, "#dataWeight", "0.44");
    await setRange(page, "#boundaryWeight", "0.76");
    await setRange(page, "#collocationDensity", "14");
    await setRange(page, "#alphaEstimate", "0.61");
    await setRange(page, "#noiseLevel", "0.18");
    await page.click("#trainPinn");
    e18 = await page.evaluate(() => ({
      snapshot: window.__e18LabSnapshot(),
      text: (document.querySelector("#state") || document.querySelector("#stateBox")).textContent.trim(),
      dataText: document.querySelector("#dataLossLabel").textContent.trim(),
      physicsText: document.querySelector("#physicsLossLabel").textContent.trim()
    }));
    if (e18.snapshot.pdePreset !== "burgers" || e18.snapshot.boundaryMode !== "hard" || e18.snapshot.trainStep < 1 || Math.abs(e18.snapshot.physicsWeight - 0.82) > 0.01) {
      throw new Error(`E18 controls did not update PINN parameters: ${JSON.stringify(e18)}.`);
    }
    if (e18.snapshot.dataLoss <= 0 || e18.snapshot.physicsLoss < 0 || e18.snapshot.boundaryLoss < 0 || e18.snapshot.alphaError < 0 || e18.snapshot.residualCoverage <= 0 || !e18.dataText.includes(".") || !e18.physicsText.includes(".") || !/physics|residual|collocation|boundary|PINN|derivative/i.test(e18.text)) {
      throw new Error(`E18 controls did not reshape PINN residual dynamics: ${JSON.stringify(e18)}.`);
    }
  } finally {
    await browser.close();
  }
  console.log("e17-e18 premium smoke passed: SSM scan and PINN residual labs expose specific visual roles, controls, diagnostics, and iframe fit.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
