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
  const labPath = path.join(__dirname, "d10-model-selection-evaluation-lab.html").replace(/\\/g, "/");

  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
  await page.waitForFunction(() => window.__d10LabReady === true && window.__d10LabSnapshot());
  await page.waitForTimeout(180);

  const initial = await page.evaluate(() => {
    const canvas = document.querySelector(".lab-viewport canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    return {
      hasWebgl: Boolean(gl),
      imageBytes: canvas.toDataURL("image/png").length,
      snapshot: window.__d10LabSnapshot(),
      stateText: document.querySelector("#stateBox").textContent.trim()
    };
  });
  if (!initial.hasWebgl) throw new Error("D10 lab did not create a WebGL canvas.");
  if (initial.imageBytes < 9000) throw new Error(`D10 lab canvas appears blank; png payload only ${initial.imageBytes} bytes.`);
  if (initial.snapshot.mode !== "holdout" || initial.snapshot.validationScore <= 0 || initial.snapshot.testScore <= 0 || initial.snapshot.optimism <= 0) {
    throw new Error(`D10 lab did not expose useful holdout diagnostics: ${JSON.stringify(initial.snapshot)}.`);
  }
  if (!initial.stateText.includes("train") || !initial.stateText.includes("validation") || !initial.stateText.includes("test")) {
    throw new Error(`Holdout state text is weak: ${initial.stateText}`);
  }
  await assertNoDedicatedScrollbars(page, "desktop iframe");

  const beforeOrbit = await page.evaluate(() => window.__d10LabSnapshot().cameraTheta);
  const canvasBox = await page.locator(".lab-viewport canvas").boundingBox();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.45, canvasBox.y + canvasBox.height * 0.55);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.74, canvasBox.y + canvasBox.height * 0.35, { steps: 8 });
  await page.mouse.up();
  const afterOrbit = await page.evaluate(() => window.__d10LabSnapshot().cameraTheta);
  if (Math.abs(afterOrbit - beforeOrbit) < 0.05) {
    throw new Error("Dragging the canvas did not orbit the 3D model-selection visualization.");
  }

  await setRange(page, "#searchBreadth", "18");
  await page.waitForFunction(() => window.__d10LabSnapshot().searchBreadth === 18);
  const broadSearch = await page.evaluate(() => window.__d10LabSnapshot());
  if (broadSearch.optimism <= initial.snapshot.optimism) {
    throw new Error(`Broadening hyperparameter search did not increase selection optimism: ${JSON.stringify(broadSearch)}.`);
  }

  await page.locator("#mode").selectOption("crossValidation");
  await setRange(page, "#folds", "8");
  await page.waitForFunction(() => window.__d10LabSnapshot().mode === "crossValidation" && window.__d10LabSnapshot().folds === 8);
  const cv = await page.evaluate(() => ({
    snapshot: window.__d10LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!cv.text.includes("cross-validation") || cv.snapshot.foldVariance <= 0 || cv.snapshot.foldStability <= 0) {
    throw new Error(`Cross-validation view did not expose fold diagnostics: ${JSON.stringify(cv)}.`);
  }

  await page.locator("#mode").selectOption("nested");
  await page.waitForFunction(() => window.__d10LabSnapshot().mode === "nested");
  const nested = await page.evaluate(() => ({
    snapshot: window.__d10LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!nested.text.includes("outer") || !nested.text.includes("inner") || nested.snapshot.nestedBias >= nested.snapshot.optimism) {
    throw new Error(`Nested CV view did not separate inner selection from outer estimation: ${JSON.stringify(nested)}.`);
  }

  await page.locator("#mode").selectOption("threshold");
  await setRange(page, "#threshold", "0.31");
  await setRange(page, "#costRatio", "5.0");
  await page.waitForFunction(() => window.__d10LabSnapshot().mode === "threshold" && window.__d10LabSnapshot().threshold < 0.35);
  const threshold = await page.evaluate(() => ({
    snapshot: window.__d10LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!threshold.text.includes("threshold") || !threshold.text.includes("calibration") || threshold.snapshot.expectedCost <= 0 || threshold.snapshot.calibrationError <= 0) {
    throw new Error(`Threshold/calibration view did not expose deployment diagnostics: ${JSON.stringify(threshold)}.`);
  }

  await page.locator("#mode").selectOption("leakage");
  await setRange(page, "#leakage", "0.72");
  await page.waitForFunction(() => window.__d10LabSnapshot().mode === "leakage" && window.__d10LabSnapshot().leakage > 0.7);
  const leakage = await page.evaluate(() => ({
    snapshot: window.__d10LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!leakage.text.includes("leakage") || leakage.snapshot.leakInflation <= 0 || leakage.snapshot.testScore >= leakage.snapshot.validationScore) {
    throw new Error(`Leakage view did not show validation inflation over test evidence: ${JSON.stringify(leakage)}.`);
  }

  await page.setViewportSize({ width: 900, height: 700 });
  await assertNoDedicatedScrollbars(page, "narrow iframe");

  await browser.close();
  console.log("d10 smoke passed: 3D model-selection lab renders, orbits, shows holdout optimism, CV folds, nested CV, thresholds/calibration, leakage, and fits iframe.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
