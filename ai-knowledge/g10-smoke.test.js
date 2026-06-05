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
    const file = path.join(__dirname, "g10-equivariance-transform-lab.html").replace(/\\/g, "/");
    await page.goto(`file:///${file}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__g10LabReady === true && window.__g10LabSnapshot());
    await page.waitForTimeout(180);

    let result = await page.evaluate(() => ({
      bytes: document.querySelector("#canvas").toDataURL("image/png").length,
      snapshot: window.__g10LabSnapshot(),
      stateText: document.querySelector("#state").textContent.trim(),
      rangeCount: document.querySelectorAll('input[type="range"]').length,
      actionCount: document.querySelectorAll("[data-action]").length
    }));
    if (result.bytes < 13000 || result.snapshot.has3d !== true || result.snapshot.nodeCount < 6 || result.snapshot.edgeCount < 5) {
      throw new Error(`G10 initial render is weak: ${JSON.stringify(result)}`);
    }
    if (result.rangeCount < 5 || result.actionCount < 4) throw new Error(`G10 controls are incomplete: ${JSON.stringify(result)}`);
    if (!/symmetry|equivariance|invariance|rotation|contract/i.test(result.stateText)) throw new Error(`G10 state copy is off-topic: ${result.stateText}`);
    await noScrollbars(page, "desktop");

    const thetaBefore = result.snapshot.cameraTheta;
    await page.mouse.move(430, 310);
    await page.mouse.down();
    await page.mouse.move(560, 360);
    await page.mouse.up();
    await page.waitForTimeout(80);
    result = await page.evaluate(() => window.__g10LabSnapshot());
    if (Math.abs(result.cameraTheta - thetaBefore) < 0.05) throw new Error("G10 camera did not rotate manually.");

    await page.selectOption("#transformType", "rotation");
    await setRange(page, "#transformAngle", 62);
    await page.click("#applyTransform");
    await page.waitForFunction(() => window.__g10LabSnapshot().phase === "transform");
    result = await page.evaluate(() => ({ snapshot: window.__g10LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (result.snapshot.transformMagnitude <= 0 || result.snapshot.distanceDrift > 0.02 || !/rotation|group action|transformed copy/i.test(result.stateText)) {
      throw new Error(`G10 rigid transform should move coordinates while preserving pair distances: ${JSON.stringify(result)}`);
    }

    await page.selectOption("#outputRule", "invariant");
    await page.click("#testInvariant");
    await page.waitForFunction(() => window.__g10LabSnapshot().phase === "invariant");
    const invariant = await page.evaluate(() => ({ snapshot: window.__g10LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (invariant.snapshot.invarianceError >= 0.08 || invariant.snapshot.contractScore <= 0.8 || !/invariant|scalar|energy|same/i.test(invariant.stateText)) {
      throw new Error(`G10 invariant scalar contract should keep energy stable: ${JSON.stringify(invariant)}`);
    }

    await page.selectOption("#outputRule", "equivariant");
    await page.click("#testEquivariant");
    await page.waitForFunction(() => window.__g10LabSnapshot().phase === "equivariant");
    const equivariant = await page.evaluate(() => ({ snapshot: window.__g10LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (equivariant.snapshot.equivarianceError >= 0.1 || equivariant.snapshot.vectorAlignment <= 0.86 || !/equivariant|vector|rotates|matching/i.test(equivariant.stateText)) {
      throw new Error(`G10 equivariant vector contract should rotate force vectors with the molecule: ${JSON.stringify(equivariant)}`);
    }

    await page.selectOption("#architectureMode", "naive");
    await page.click("#breakContract");
    await page.waitForFunction(() => window.__g10LabSnapshot().phase === "broken");
    result = await page.evaluate(() => ({ snapshot: window.__g10LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (!(result.snapshot.equivarianceError > equivariant.snapshot.equivarianceError) || !(result.snapshot.contractScore < equivariant.snapshot.contractScore) || !/break|wrong|coordinate|contract/i.test(result.stateText)) {
      throw new Error(`G10 broken architecture should visibly fail the symmetry contract: ${JSON.stringify({ equivariant, result })}`);
    }

    await setRange(page, "#frameSamples", 3);
    await page.click("#testEquivariant");
    await page.waitForTimeout(120);
    const fewSamples = await page.evaluate(() => window.__g10LabSnapshot());
    await setRange(page, "#frameSamples", 12);
    await page.click("#testEquivariant");
    await page.waitForTimeout(120);
    const manySamples = await page.evaluate(() => window.__g10LabSnapshot());
    if (!(manySamples.sampleCoverage > fewSamples.sampleCoverage) || !(manySamples.contractScore >= fewSamples.contractScore - 0.05)) {
      throw new Error(`G10 frame sample budget should change sampled transform coverage: ${JSON.stringify({ fewSamples, manySamples })}`);
    }

    await page.selectOption("#outputRule", "invariant");
    await setRange(page, "#invariantMix", 0.12);
    await page.click("#testInvariant");
    await page.waitForTimeout(120);
    const lowScalarMix = await page.evaluate(() => window.__g10LabSnapshot());
    await setRange(page, "#invariantMix", 0.92);
    await page.click("#testInvariant");
    await page.waitForTimeout(120);
    const highScalarMix = await page.evaluate(() => window.__g10LabSnapshot());
    if (!(highScalarMix.scalarEnergy > lowScalarMix.scalarEnergy) || !/scalar|energy|invariant/i.test(highScalarMix.stateText)) {
      throw new Error(`G10 invariant scalar mix should change displayed scalar energy: ${JSON.stringify({ lowScalarMix, highScalarMix })}`);
    }

    await page.selectOption("#transformType", "reflection");
    await page.selectOption("#architectureMode", "distances");
    await page.click("#testInvariant");
    await page.waitForFunction(() => window.__g10LabSnapshot().transformType === "reflection" && window.__g10LabSnapshot().phase === "invariant");
    result = await page.evaluate(() => ({ snapshot: window.__g10LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (result.snapshot.chiralitySignal <= 0 || !/reflection|chirality|distance|invariant/i.test(result.stateText)) {
      throw new Error(`G10 reflection view should expose what distance-only invariants can miss: ${JSON.stringify(result)}`);
    }

    await page.setViewportSize({ width: 900, height: 700 });
    await page.waitForTimeout(120);
    await noScrollbars(page, "narrow iframe");
    console.log("g10 smoke passed: equivariance lab renders rigid transforms, invariant scalar contract, equivariant vector contract, broken coordinate rule, reflection/chirality, and fits iframe.");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
