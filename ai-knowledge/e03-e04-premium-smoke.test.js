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
    let e03 = await loadLab(page, "e03-convolution-kernel-lab.html", "__e03LabReady", "__e03LabSnapshot");
    if (e03.bytes < 10000 || e03.snapshot.visualQuality !== "e03-e04-neural-specific-v1" || e03.snapshot.visualRoleCount < 10) {
      throw new Error(`E03 premium visual contract is weak: ${JSON.stringify(e03)}.`);
    }
    requireRoles(e03.snapshot, [
      "3D input image pixel tile grid",
      "sliding convolution kernel window",
      "signed kernel weight plate",
      "dot-product beam fan",
      "feature-map activation height field",
      "padding ghost border tiles",
      "stride footprint path",
      "max-pooling basin winners",
      "receptive-field growth tower",
      "weight-sharing reused detector"
    ], "E03");
    if (!/kernel|feature map|padding|stride|pooling|weight sharing/i.test(e03.stateText)) {
      throw new Error(`E03 state text is weak: ${e03.stateText}`);
    }
    await page.locator("#inputPattern").selectOption("corner");
    await page.locator("#pooling").selectOption("max");
    await setRange(page, "#kernelSize", "5");
    await setRange(page, "#stride", "2");
    await setRange(page, "#padding", "2");
    await page.click("#scan");
    e03 = await page.evaluate(() => ({
      snapshot: window.__e03LabSnapshot(),
      text: (document.querySelector("#state") || document.querySelector("#stateBox")).textContent.trim()
    }));
    if (e03.snapshot.kernelSize !== 5 || e03.snapshot.stride !== 2 || e03.snapshot.padding !== 2 || e03.snapshot.inputPattern !== "corner" || e03.snapshot.poolingMode !== "max") {
      throw new Error(`E03 controls did not update CNN parameters: ${JSON.stringify(e03)}.`);
    }
    if (e03.snapshot.outputSize !== 4 || e03.snapshot.pooledOutputSize !== 2 || e03.snapshot.parameterCount !== 25 || !/dot product|feature map|pool/i.test(e03.text)) {
      throw new Error(`E03 controls did not reshape convolution/pooling geometry: ${JSON.stringify(e03)}.`);
    }

    let e04 = await loadLab(page, "e04-rnn-hidden-state-lab.html", "__e04LabReady", "__e04LabSnapshot");
    if (e04.bytes < 10000 || e04.snapshot.visualQuality !== "e03-e04-neural-specific-v1" || e04.snapshot.visualRoleCount < 10) {
      throw new Error(`E04 premium visual contract is weak: ${JSON.stringify(e04)}.`);
    }
    requireRoles(e04.snapshot, [
      "unrolled recurrent hidden-state chain",
      "shared transition cell band",
      "token input plates",
      "hidden-state memory ribbon",
      "BPTT gradient decay trail",
      "exploding-gradient flare markers",
      "LSTM gated cell-state highway",
      "GRU update reset gate mixer",
      "truncated-BPTT boundary wall",
      "gradient clipping norm clamp"
    ], "E04");
    if (!/hidden state|sequence|BPTT|gradient|gate|memory/i.test(e04.stateText)) {
      throw new Error(`E04 state text is weak: ${e04.stateText}`);
    }
    await page.locator("#cellType").selectOption("lstm");
    await setRange(page, "#sequenceLength", "10");
    await setRange(page, "#recurrentScale", "1.15");
    await setRange(page, "#gateStrength", "0.8");
    await setRange(page, "#truncationWindow", "4");
    await page.click("#step");
    await page.click("#backpropStep");
    e04 = await page.evaluate(() => ({
      snapshot: window.__e04LabSnapshot(),
      text: (document.querySelector("#state") || document.querySelector("#stateBox")).textContent.trim()
    }));
    if (e04.snapshot.cellType !== "lstm" || e04.snapshot.sequenceLength !== 10 || e04.snapshot.truncationWindow !== 4 || e04.snapshot.timeStep < 1) {
      throw new Error(`E04 controls did not update RNN sequence parameters: ${JSON.stringify(e04)}.`);
    }
    if (e04.snapshot.memoryStrength <= 0.4 || e04.snapshot.gradientNorm <= 0 || e04.snapshot.bpttSpan !== 4 || !/LSTM|gate|BPTT|gradient/i.test(e04.text)) {
      throw new Error(`E04 controls did not reshape memory/gradient visualization: ${JSON.stringify(e04)}.`);
    }
  } finally {
    await browser.close();
  }
  console.log("e03-e04 premium smoke passed: CNN and RNN labs expose specific visual roles, controls, diagnostics, and iframe fit.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
