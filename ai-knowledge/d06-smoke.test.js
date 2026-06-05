const path = require("path");

function loadPlaywright() {
  const candidates = [
    "playwright",
    "C:/Users/02gab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
    "C:/Users/02gab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright",
    "C:/Users/Gabriele/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"
  ];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (error) {
      // Try the next known bundled runtime path.
    }
  }
  throw new Error("Playwright is not available from the known runtime paths.");
}

const { chromium } = loadPlaywright();

async function assertNoDedicatedScrollbars(page, viewportName) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const elements = [...document.querySelectorAll(".lab-3d-shell, .stage, .controls, .lab-viewport")];
    return {
      page: Math.max(root.scrollHeight, body.scrollHeight) - window.innerHeight,
      elements: elements.map((element) => ({
        selector: element.className,
        vertical: element.scrollHeight - element.clientHeight,
        horizontal: element.scrollWidth - element.clientWidth,
        overflowY: getComputedStyle(element).overflowY,
        overflowX: getComputedStyle(element).overflowX
      }))
    };
  });
  if (overflow.page > 2) throw new Error(`${viewportName}: page overflows vertically by ${overflow.page}px.`);
  const scroller = overflow.elements.find(
    (item) =>
      item.vertical > 2 ||
      item.horizontal > 2 ||
      item.overflowY === "auto" ||
      item.overflowY === "scroll" ||
      item.overflowX === "auto" ||
      item.overflowX === "scroll"
  );
  if (scroller) throw new Error(`${viewportName}: dedicated scrollbar/overflow detected on ${scroller.selector}.`);
}

async function setRange(page, selector, value) {
  await page.locator(selector).evaluate((input, nextValue) => {
    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 700 } });
  const labPath = path.join(__dirname, "d06-ensemble-methods-lab.html").replace(/\\/g, "/");

  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
  await page.waitForFunction(() => window.__d06LabReady === true && window.__d06LabSnapshot());
  await page.waitForTimeout(180);

  const initial = await page.evaluate(() => {
    const canvas = document.querySelector(".lab-viewport canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    return {
      hasWebgl: Boolean(gl),
      imageBytes: canvas.toDataURL("image/png").length,
      snapshot: window.__d06LabSnapshot(),
      stateText: document.querySelector("#stateBox").textContent.trim()
    };
  });
  if (!initial.hasWebgl) throw new Error("D06 lab did not create a WebGL canvas.");
  if (initial.imageBytes < 9000) throw new Error(`D06 lab canvas appears blank; png payload only ${initial.imageBytes} bytes.`);
  if (initial.snapshot.mode !== "bagging" || initial.snapshot.modelCount < 6 || initial.snapshot.varianceReduction <= 0) {
    throw new Error(`D06 lab did not expose useful bagging diagnostics: ${JSON.stringify(initial.snapshot)}.`);
  }
  if (!initial.stateText.includes("bagging") || !initial.stateText.includes("variance")) {
    throw new Error(`Bagging state text is weak: ${initial.stateText}`);
  }
  await assertNoDedicatedScrollbars(page, "desktop iframe");

  const beforeOrbit = await page.evaluate(() => window.__d06LabSnapshot().cameraTheta);
  const canvasBox = await page.locator(".lab-viewport canvas").boundingBox();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.45, canvasBox.y + canvasBox.height * 0.55);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.76, canvasBox.y + canvasBox.height * 0.34, { steps: 8 });
  await page.mouse.up();
  const afterOrbit = await page.evaluate(() => window.__d06LabSnapshot().cameraTheta);
  if (Math.abs(afterOrbit - beforeOrbit) < 0.05) {
    throw new Error("Dragging the canvas did not orbit the 3D ensemble visualization.");
  }

  await setRange(page, "#modelCount", "18");
  await page.waitForFunction(() => window.__d06LabSnapshot().modelCount === 18);
  const largerBag = await page.evaluate(() => window.__d06LabSnapshot());
  if (largerBag.varianceReduction <= initial.snapshot.varianceReduction) {
    throw new Error(`Increasing model count did not improve variance reduction: ${JSON.stringify(largerBag)}.`);
  }

  await page.locator("#mode").selectOption("forest");
  await setRange(page, "#featureSubsample", "0.42");
  await page.waitForFunction(() => window.__d06LabSnapshot().mode === "forest");
  const forest = await page.evaluate(() => ({
    snapshot: window.__d06LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!forest.text.includes("feature subsampling") || forest.snapshot.correlation >= 0.75 || forest.snapshot.oobError <= 0) {
    throw new Error(`Random forest view did not expose decorrelation diagnostics: ${JSON.stringify(forest)}.`);
  }

  await page.locator("#mode").selectOption("boosting");
  await setRange(page, "#learningRate", "0.18");
  await page.locator("#stepEnsemble").click();
  await page.waitForFunction(() => window.__d06LabSnapshot().mode === "boosting" && window.__d06LabSnapshot().stage >= 1);
  const boosting = await page.evaluate(() => ({
    snapshot: window.__d06LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!boosting.text.includes("residual") || boosting.snapshot.trainingLoss <= 0 || boosting.snapshot.margin <= 0) {
    throw new Error(`Boosting view did not expose residual/margin diagnostics: ${JSON.stringify(boosting)}.`);
  }

  await page.locator("#mode").selectOption("stacking");
  await page.waitForFunction(() => window.__d06LabSnapshot().mode === "stacking");
  const stacking = await page.evaluate(() => ({
    snapshot: window.__d06LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!stacking.text.includes("out-of-fold") || stacking.snapshot.metaWeightSpread <= 0 || stacking.snapshot.leakageRisk <= 0) {
    throw new Error(`Stacking view did not expose meta-model diagnostics: ${JSON.stringify(stacking)}.`);
  }

  await page.setViewportSize({ width: 900, height: 700 });
  await assertNoDedicatedScrollbars(page, "narrow iframe");

  await browser.close();
  console.log("d06 smoke passed: 3D ensemble lab renders, orbits, changes bagging variance, shows forest decorrelation, boosting residual correction, stacking meta-weights, and fits iframe.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
