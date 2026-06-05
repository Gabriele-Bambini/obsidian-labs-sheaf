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
    const file = path.join(__dirname, "g11-geometric-domain-symmetry-lab.html").replace(/\\/g, "/");
    await page.goto(`file:///${file}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__g11LabReady === true && window.__g11LabSnapshot());
    await page.waitForTimeout(180);

    let result = await page.evaluate(() => ({
      bytes: document.querySelector("#canvas").toDataURL("image/png").length,
      snapshot: window.__g11LabSnapshot(),
      stateText: document.querySelector("#state").textContent.trim(),
      rangeCount: document.querySelectorAll('input[type="range"]').length,
      actionCount: document.querySelectorAll("[data-action]").length
    }));
    if (result.bytes < 13000 || result.snapshot.has3d !== true || result.snapshot.domainCount < 4 || result.snapshot.operatorLocality <= 0) {
      throw new Error(`G11 initial render is weak: ${JSON.stringify(result)}`);
    }
    if (result.rangeCount < 5 || result.actionCount < 4) throw new Error(`G11 controls are incomplete: ${JSON.stringify(result)}`);
    if (!/geometric|domain|symmetry|operator|readout/i.test(result.stateText)) throw new Error(`G11 state copy is off-topic: ${result.stateText}`);
    await noScrollbars(page, "desktop");

    const thetaBefore = result.snapshot.cameraTheta;
    await page.mouse.move(420, 300);
    await page.mouse.down();
    await page.mouse.move(570, 360);
    await page.mouse.up();
    await page.waitForTimeout(80);
    result = await page.evaluate(() => window.__g11LabSnapshot());
    if (Math.abs(result.cameraTheta - thetaBefore) < 0.05) throw new Error("G11 camera did not rotate manually.");

    await page.selectOption("#domainSelect", "graph");
    await page.selectOption("#operatorSelect", "message");
    await page.click("#applySymmetry");
    await page.waitForFunction(() => window.__g11LabSnapshot().phase === "symmetry");
    result = await page.evaluate(() => ({ snapshot: window.__g11LabSnapshot(), stateText: document.querySelector("#state").textContent.trim(), symmetryText: document.querySelector("#symmetryLabel").textContent.trim() }));
    if (result.snapshot.domainMode !== "graph" || result.snapshot.symmetryScore <= 0 || !/permutation|graph|node|relabel|symmetry/i.test(result.stateText) || !/permutation/i.test(result.symmetryText)) {
      throw new Error(`G11 graph symmetry should expose permutation equivariance: ${JSON.stringify(result)}`);
    }

    await setRange(page, "#localityRadius", 0.45);
    await page.click("#runOperator");
    await page.waitForFunction(() => window.__g11LabSnapshot().phase === "operator");
    const localOperator = await page.evaluate(() => window.__g11LabSnapshot());
    await setRange(page, "#localityRadius", 2.4);
    await page.click("#runOperator");
    await page.waitForTimeout(120);
    result = await page.evaluate(() => ({ snapshot: window.__g11LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (!(result.snapshot.operatorLocality > localOperator.operatorLocality) || !(result.snapshot.diffusionSpread > localOperator.diffusionSpread) || !/local|operator|neighborhood|diffusion|message/i.test(result.stateText)) {
      throw new Error(`G11 locality radius should widen the visible operator footprint: ${JSON.stringify({ localOperator, result })}`);
    }

    await page.selectOption("#domainSelect", "manifold");
    await page.selectOption("#operatorSelect", "gauge");
    await page.click("#showGauge");
    await page.waitForFunction(() => window.__g11LabSnapshot().phase === "gauge");
    result = await page.evaluate(() => ({ snapshot: window.__g11LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (result.snapshot.localFrameCount < 3 || result.snapshot.transportConsistency <= 0 || !/gauge|frame|transport|manifold/i.test(result.stateText)) {
      throw new Error(`G11 manifold gauge view should show local frames and transport: ${JSON.stringify(result)}`);
    }

    await page.selectOption("#outputType", "invariant");
    await page.click("#testReadout");
    await page.waitForFunction(() => window.__g11LabSnapshot().phase === "readout");
    result = await page.evaluate(() => ({ snapshot: window.__g11LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (result.snapshot.outputType !== "invariant" || result.snapshot.readoutStability <= 0 || !/invariant|readout|pool/i.test(result.stateText)) {
      throw new Error(`G11 invariant readout should pool out the symmetry: ${JSON.stringify(result)}`);
    }

    await page.click("#switchDomain");
    await page.waitForFunction(() => /permutation/i.test(document.querySelector("#symmetryLabel").textContent));

    await page.setViewportSize({ width: 900, height: 700 });
    await page.waitForTimeout(120);
    await noScrollbars(page, "narrow iframe");
    console.log("g11 smoke passed: geometric atlas renders domains, symmetries, operators, gauge transport, invariant readout, and fits iframe.");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
