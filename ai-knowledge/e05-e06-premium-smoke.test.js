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
    let e05 = await loadLab(page, "e05-attention-flow.html", "__e05LabReady", "__e05LabSnapshot");
    if (e05.bytes < 10000 || e05.snapshot.visualQuality !== "e05-e06-neural-specific-v1" || e05.snapshot.visualRoleCount < 10) {
      throw new Error(`E05 premium visual contract is weak: ${JSON.stringify(e05)}.`);
    }
    requireRoles(e05.snapshot, [
      "query key value token rails",
      "selected query score row",
      "softmax temperature probability bars",
      "causal mask shutter wall",
      "multi-head specialization lanes",
      "positional encoding wave ruler",
      "value-mixing output basin",
      "transformer residual block bridge",
      "attention entropy diagnostic",
      "quadratic attention cost lattice"
    ], "E05");
    if (!/query|key|value|softmax|mask|head|position/i.test(e05.stateText)) {
      throw new Error(`E05 state text is weak: ${e05.stateText}`);
    }
    await page.locator("#queryToken").selectOption("sat");
    await page.locator("#maskType").selectOption("causal");
    await setRange(page, "#temperature", "0.45");
    await setRange(page, "#headCount", "4");
    await setRange(page, "#positionBias", "0.8");
    await page.click("#applyMask");
    e05 = await page.evaluate(() => ({
      snapshot: window.__e05LabSnapshot(),
      text: (document.querySelector("#state") || document.querySelector("#stateBox")).textContent.trim()
    }));
    if (e05.snapshot.queryToken !== "sat" || e05.snapshot.maskType !== "causal" || e05.snapshot.headCount !== 4 || Math.abs(e05.snapshot.temperature - 0.45) > 0.01) {
      throw new Error(`E05 controls did not update attention parameters: ${JSON.stringify(e05)}.`);
    }
    if (e05.snapshot.maskedCount <= 0 || e05.snapshot.allowedKeyCount !== 3 || e05.snapshot.maxWeight <= 0.35 || e05.snapshot.outputMixMagnitude <= 0 || !/causal|softmax|query|value/i.test(e05.text)) {
      throw new Error(`E05 controls did not reshape attention distribution: ${JSON.stringify(e05)}.`);
    }

    let e06 = await loadLab(page, "e06-llm-token-prediction.html", "__e06LabReady", "__e06LabSnapshot");
    if (e06.bytes < 10000 || e06.snapshot.visualQuality !== "e05-e06-neural-specific-v1" || e06.snapshot.visualRoleCount < 10) {
      throw new Error(`E06 premium visual contract is weak: ${JSON.stringify(e06)}.`);
    }
    requireRoles(e06.snapshot, [
      "autoregressive context token conveyor",
      "tokenizer subword segmentation plates",
      "embedding vector lift rack",
      "decoder transformer stack tower",
      "causal attention mask triangle",
      "logits vocabulary skyline",
      "softmax probability distribution fan",
      "decoding top-k top-p filter gate",
      "generated-token feedback loop",
      "KV cache memory shelves"
    ], "E06");
    if (!/token|logit|softmax|temperature|context|decode/i.test(e06.stateText)) {
      throw new Error(`E06 state text is weak: ${e06.stateText}`);
    }
    await page.locator("#promptScenario").selectOption("causal");
    await page.locator("#decodingMode").selectOption("topk");
    await setRange(page, "#temperature", "1.4");
    await setRange(page, "#topK", "2");
    await setRange(page, "#topP", "0.65");
    await setRange(page, "#contextWindow", "7");
    await page.click("#generateToken");
    e06 = await page.evaluate(() => ({
      snapshot: window.__e06LabSnapshot(),
      text: (document.querySelector("#state") || document.querySelector("#stateBox")).textContent.trim()
    }));
    if (e06.snapshot.promptScenario !== "causal" || e06.snapshot.decodingMode !== "topk" || e06.snapshot.topK !== 2 || e06.snapshot.generatedLength < 1) {
      throw new Error(`E06 controls did not update generation parameters: ${JSON.stringify(e06)}.`);
    }
    if (e06.snapshot.contextLength > 7 || e06.snapshot.candidateCount > 2 || !e06.snapshot.selectedToken || e06.snapshot.kvCacheSlots <= 0 || !/next token|context|distribution|top-k/i.test(e06.text)) {
      throw new Error(`E06 controls did not reshape token prediction process: ${JSON.stringify(e06)}.`);
    }
  } finally {
    await browser.close();
  }
  console.log("e05-e06 premium smoke passed: attention and LLM labs expose specific visual roles, controls, diagnostics, and iframe fit.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
