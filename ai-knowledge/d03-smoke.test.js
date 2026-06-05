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
  const labPath = path.join(__dirname, "d03-tree-models-lab.html").replace(/\\/g, "/");

  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
  await page.waitForFunction(() => window.__d03LabReady === true && window.__d03LabSnapshot());
  await page.waitForTimeout(180);

  const initial = await page.evaluate(() => {
    const canvas = document.querySelector(".lab-viewport canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    return {
      hasWebgl: Boolean(gl),
      imageBytes: canvas.toDataURL("image/png").length,
      snapshot: window.__d03LabSnapshot(),
      stateText: document.querySelector("#stateBox").textContent.trim()
    };
  });
  if (!initial.hasWebgl) throw new Error("D03 lab did not create a WebGL canvas.");
  if (initial.imageBytes < 9000) throw new Error(`D03 lab canvas appears blank; png payload only ${initial.imageBytes} bytes.`);
  if (initial.snapshot.view !== "tree" || initial.snapshot.task !== "classification" || initial.snapshot.leaves < 2 || initial.snapshot.bestGain <= 0) {
    throw new Error(`D03 lab did not expose a meaningful decision-tree state: ${JSON.stringify(initial.snapshot)}.`);
  }
  if (initial.snapshot.accuracy < 0.65 || !initial.stateText.includes("decision tree") || !initial.stateText.includes("axis-aligned")) {
    throw new Error(`Tree split state text or accuracy is weak: ${JSON.stringify(initial)}.`);
  }
  await assertNoDedicatedScrollbars(page, "desktop iframe");

  const beforeOrbit = await page.evaluate(() => window.__d03LabSnapshot().cameraTheta);
  const canvasBox = await page.locator(".lab-viewport canvas").boundingBox();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.50, canvasBox.y + canvasBox.height * 0.55);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.73, canvasBox.y + canvasBox.height * 0.36, { steps: 8 });
  await page.mouse.up();
  const afterOrbit = await page.evaluate(() => window.__d03LabSnapshot().cameraTheta);
  if (Math.abs(afterOrbit - beforeOrbit) < 0.05) {
    throw new Error("Dragging the canvas did not orbit the 3D decision-tree visualization.");
  }

  await page.locator("#fitTree").click();
  await page.waitForFunction(() => window.__d03LabSnapshot().steps >= 8);
  const fitted = await page.evaluate(() => window.__d03LabSnapshot());
  if (fitted.splits < 1 || fitted.leaves < 2 || fitted.accuracy < 0.65) {
    throw new Error(`Fitting did not produce useful CART splits: ${JSON.stringify(fitted)}.`);
  }

  await page.locator("#viewMode").selectOption("impurity");
  await page.waitForFunction(() => window.__d03LabSnapshot().view === "impurity");
  const impurity = await page.evaluate(() => ({
    snapshot: window.__d03LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!impurity.text.includes("Gini impurity") || !impurity.text.includes("candidate root thresholds") || impurity.snapshot.bestGain <= 0) {
    throw new Error(`Impurity scan did not expose split-gain diagnostics: ${JSON.stringify(impurity)}.`);
  }

  await page.locator("#viewMode").selectOption("pruning");
  await setRange(page, "#pruneAlpha", "1.50");
  await page.waitForFunction(() => window.__d03LabSnapshot().view === "pruning");
  const pruning = await page.evaluate(() => ({
    snapshot: window.__d03LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!pruning.text.includes("Cost-complexity pruning") || pruning.snapshot.prunedSplits < 0 || pruning.snapshot.leaves < 1) {
    throw new Error(`Pruning view did not expose subtree diagnostics: ${JSON.stringify(pruning)}.`);
  }

  await page.locator("#viewMode").selectOption("forest");
  await page.waitForFunction(() => window.__d03LabSnapshot().view === "forest");
  const forest = await page.evaluate(() => ({
    snapshot: window.__d03LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!forest.text.includes("Forest vote") || !Number.isFinite(forest.snapshot.forestDisagreement) || forest.snapshot.forestDisagreement < 0) {
    throw new Error(`Forest vote view did not expose ensemble diagnostics: ${JSON.stringify(forest)}.`);
  }

  await page.locator("#task").selectOption("regression");
  await page.locator("#dataset").selectOption("regression");
  await page.waitForFunction(() => window.__d03LabSnapshot().task === "regression" && Number.isFinite(window.__d03LabSnapshot().rmse));
  const regression = await page.evaluate(() => window.__d03LabSnapshot());
  if (regression.rmse <= 0 || regression.criterion !== "squared") {
    throw new Error(`Regression tree mode did not expose squared-error diagnostics: ${JSON.stringify(regression)}.`);
  }

  await page.setViewportSize({ width: 900, height: 700 });
  await assertNoDedicatedScrollbars(page, "narrow iframe");

  await browser.close();
  console.log("d03 smoke passed: 3D CART lab renders, orbits, fits splits, scans impurity, prunes, compares forest votes, supports regression, and fits iframe.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
