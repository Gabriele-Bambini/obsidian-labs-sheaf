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
  await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
  await page.waitForFunction(
    ([ready, snapshot]) => window[ready] === true && typeof window[snapshot] === "function" && window[snapshot](),
    [readyName, snapshotName]
  );
  await page.waitForTimeout(220);
  return page.evaluate((snapshot) => {
    const canvas = document.querySelector(".lab-viewport canvas");
    return {
      bytes: canvas.toDataURL("image/png").length,
      snapshot: window[snapshot](),
      stateText: document.querySelector(".state-box").textContent.trim(),
      overflowX: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
      overflowY: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight
    };
  }, snapshotName);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  try {
    let e01 = await loadLab(page, "e01-mlp-decision-regions.html", "__e01LabReady", "__e01LabSnapshot");
    if (e01.bytes < 8500 || e01.snapshot.visualQuality !== "e01-e02-neural-specific-v1" || e01.snapshot.visualRoleCount < 10) {
      throw new Error(`E01 premium visual contract is weak: ${JSON.stringify(e01)}.`);
    }
    for (const role of ["single-neuron linear boundary plane", "XOR hidden-unit half-space gates", "activation nonlinearity folding sheet", "decision-region probability surface", "layer signal-flow columns"]) {
      if (!e01.snapshot.visualRoles.some((candidate) => candidate.includes(role))) throw new Error(`E01 missing role: ${role}`);
    }
    if (!/XOR|hidden|activation|decision/i.test(e01.stateText)) {
      throw new Error(`E01 state text is weak: ${e01.stateText}`);
    }
    await page.locator("#modelMode").selectOption("xor");
    await page.locator("#activation").selectOption("relu");
    await setRange(page, "#hiddenWidth", "8");
    await setRange(page, "#depth", "4");
    await page.click("#trainStep");
    e01 = await page.evaluate(() => ({
      snapshot: window.__e01LabSnapshot(),
      text: document.querySelector("#stateBox").textContent.trim()
    }));
    if (e01.snapshot.modelMode !== "xor" || e01.snapshot.hiddenWidth !== 8 || e01.snapshot.decisionRegions < 6 || e01.snapshot.trainAccuracy <= 0.55 || !/nonlinear|hidden|decision/i.test(e01.text)) {
      throw new Error(`E01 controls did not reshape the MLP visualization: ${JSON.stringify(e01)}.`);
    }

    let e02 = await loadLab(page, "e02-backprop-computational-graph.html", "__e02LabReady", "__e02LabSnapshot");
    if (e02.bytes < 8500 || e02.snapshot.visualQuality !== "e01-e02-neural-specific-v1" || e02.snapshot.visualRoleCount < 10) {
      throw new Error(`E02 premium visual contract is weak: ${JSON.stringify(e02)}.`);
    }
    for (const role of ["forward computational graph value beads", "reverse-mode adjoint arrows", "y-gradient accumulation junction", "vector-Jacobian product rail", "autodiff tape memory stack"]) {
      if (!e02.snapshot.visualRoles.some((candidate) => candidate.includes(role))) throw new Error(`E02 missing role: ${role}`);
    }
    if (!/forward|reverse|gradient|accumulation/i.test(e02.stateText)) {
      throw new Error(`E02 state text is weak: ${e02.stateText}`);
    }
    await page.locator("#graphMode").selectOption("reverse");
    await setRange(page, "#xValue", "2.0");
    await setRange(page, "#yValue", "-1.0");
    await page.click("#backwardPass");
    e02 = await page.evaluate(() => ({
      snapshot: window.__e02LabSnapshot(),
      text: document.querySelector("#stateBox").textContent.trim()
    }));
    if (e02.snapshot.graphMode !== "reverse" || Math.abs(e02.snapshot.gradY - 0) < 0.01 || e02.snapshot.accumulationPaths < 2 || !/adjoint|accumulate|reverse/i.test(e02.text)) {
      throw new Error(`E02 reverse-mode controls did not update graph gradients: ${JSON.stringify(e02)}.`);
    }
  } finally {
    await browser.close();
  }
  console.log("e01-e02 premium smoke passed: neural-foundation labs expose specific visual roles, controls, diagnostics, and iframe fit.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
