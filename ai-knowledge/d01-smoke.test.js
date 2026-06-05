const path = require("path");

function loadPlaywright() {
  try {
    return require("playwright");
  } catch (error) {
    try {
      return require("C:/Users/02gab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
    } catch (fallbackError) {
      try {
        return require("C:/Users/02gab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright");
      } catch (pnpmError) {
        return require("C:/Users/Gabriele/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
      }
    }
  }
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
  const labPath = path.join(__dirname, "d01-linear-models-lab.html").replace(/\\/g, "/");

  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
  await page.waitForFunction(() => window.__d01LabReady === true && window.__d01LabSnapshot());
  await page.waitForTimeout(180);

  const initial = await page.evaluate(() => {
    const canvas = document.querySelector(".lab-viewport canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    return {
      hasWebgl: Boolean(gl),
      imageBytes: canvas.toDataURL("image/png").length,
      snapshot: window.__d01LabSnapshot(),
      stateText: document.querySelector("#stateBox").textContent.trim()
    };
  });
  if (!initial.hasWebgl) throw new Error("D01 lab did not create a WebGL canvas.");
  if (initial.imageBytes < 9000) throw new Error(`D01 lab canvas appears blank; png payload only ${initial.imageBytes} bytes.`);
  if (initial.snapshot.view !== "fit" || initial.snapshot.model !== "ols" || !Number.isFinite(initial.snapshot.loss) || initial.snapshot.residualRms <= 0) {
    throw new Error(`D01 lab did not expose a meaningful linear-regression state: ${JSON.stringify(initial.snapshot)}.`);
  }
  if (!initial.stateText.includes("Linear regression") || !initial.stateText.includes("residuals")) {
    throw new Error(`Fit-plane state text is not technical enough: "${initial.stateText}".`);
  }
  await assertNoDedicatedScrollbars(page, "desktop iframe");

  const beforeOrbit = await page.evaluate(() => window.__d01LabSnapshot().cameraTheta);
  const canvasBox = await page.locator(".lab-viewport canvas").boundingBox();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.50, canvasBox.y + canvasBox.height * 0.55);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.73, canvasBox.y + canvasBox.height * 0.36, { steps: 8 });
  await page.mouse.up();
  const afterOrbit = await page.evaluate(() => window.__d01LabSnapshot().cameraTheta);
  if (Math.abs(afterOrbit - beforeOrbit) < 0.05) {
    throw new Error("Dragging the canvas did not orbit the 3D linear-model visualization.");
  }

  const beforeFit = await page.evaluate(() => window.__d01LabSnapshot().loss);
  await page.locator("#fitClosedForm").click();
  await page.waitForFunction((loss) => window.__d01LabSnapshot().loss < loss, beforeFit);
  const fitted = await page.evaluate(() => window.__d01LabSnapshot());
  if (fitted.gradientNorm > 0.12 || fitted.r2 < 0.7) {
    throw new Error(`Closed-form fitting did not improve the OLS model enough: ${JSON.stringify(fitted)}.`);
  }

  await page.locator("#viewMode").selectOption("loss");
  await page.waitForFunction(() => window.__d01LabSnapshot().view === "loss");
  const lossView = await page.evaluate(() => ({
    snapshot: window.__d01LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!lossView.text.includes("loss bowl") || !lossView.text.includes("gradient descent")) {
    throw new Error(`Loss-bowl view did not expose convex optimization diagnostics: ${JSON.stringify(lossView)}.`);
  }

  await page.locator("#model").selectOption("ridge");
  await page.locator("#viewMode").selectOption("regularization");
  await setRange(page, "#lambda", "1.60");
  await page.locator("#fitClosedForm").click();
  await page.waitForFunction(() => window.__d01LabSnapshot().model === "ridge" && window.__d01LabSnapshot().lambda > 1.5);
  const ridge = await page.evaluate(() => ({
    snapshot: window.__d01LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!ridge.text.includes("Ridge regularization") || ridge.snapshot.shrinkage <= 0) {
    throw new Error(`Ridge view did not expose shrinkage diagnostics: ${JSON.stringify(ridge)}.`);
  }

  await page.locator("#model").selectOption("logistic");
  await page.locator("#viewMode").selectOption("classification");
  await page.locator("#fitClosedForm").click();
  await page.waitForFunction(() => window.__d01LabSnapshot().model === "logistic" && window.__d01LabSnapshot().accuracy >= 0.7);
  const logistic = await page.evaluate(() => ({
    snapshot: window.__d01LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!logistic.text.includes("Logistic regression") || !logistic.text.includes("decision boundary") || !Number.isFinite(logistic.snapshot.decisionMargin)) {
    throw new Error(`Logistic view did not expose probability-boundary diagnostics: ${JSON.stringify(logistic)}.`);
  }

  await page.setViewportSize({ width: 900, height: 700 });
  await assertNoDedicatedScrollbars(page, "narrow iframe");

  await browser.close();
  console.log("d01 smoke passed: 3D linear-model lab renders, orbits, fits OLS, shows loss/ridge/logistic views, and fits iframe.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
