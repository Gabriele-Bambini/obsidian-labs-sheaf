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
  const labPath = path.join(__dirname, "d02-svm-margin-kernel-lab.html").replace(/\\/g, "/");

  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
  await page.waitForFunction(() => window.__d02LabReady === true && window.__d02LabSnapshot());
  await page.waitForTimeout(180);

  const initial = await page.evaluate(() => {
    const canvas = document.querySelector(".lab-viewport canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    return {
      hasWebgl: Boolean(gl),
      imageBytes: canvas.toDataURL("image/png").length,
      snapshot: window.__d02LabSnapshot(),
      stateText: document.querySelector("#stateBox").textContent.trim()
    };
  });
  if (!initial.hasWebgl) throw new Error("D02 lab did not create a WebGL canvas.");
  if (initial.imageBytes < 9000) throw new Error(`D02 lab canvas appears blank; png payload only ${initial.imageBytes} bytes.`);
  if (initial.snapshot.view !== "margin" || initial.snapshot.kernel !== "linear" || initial.snapshot.marginWidth <= 0 || initial.snapshot.supportCount < 1) {
    throw new Error(`D02 lab did not expose a meaningful SVM margin state: ${JSON.stringify(initial.snapshot)}.`);
  }
  if (!initial.stateText.includes("support vector machine") || !initial.stateText.includes("maximum margin")) {
    throw new Error(`Margin state text is not technical enough: "${initial.stateText}".`);
  }
  await assertNoDedicatedScrollbars(page, "desktop iframe");

  const beforeOrbit = await page.evaluate(() => window.__d02LabSnapshot().cameraTheta);
  const canvasBox = await page.locator(".lab-viewport canvas").boundingBox();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.50, canvasBox.y + canvasBox.height * 0.55);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.74, canvasBox.y + canvasBox.height * 0.37, { steps: 8 });
  await page.mouse.up();
  const afterOrbit = await page.evaluate(() => window.__d02LabSnapshot().cameraTheta);
  if (Math.abs(afterOrbit - beforeOrbit) < 0.05) {
    throw new Error("Dragging the canvas did not orbit the 3D SVM visualization.");
  }

  await page.locator("#fitModel").click();
  await page.waitForFunction(() => window.__d02LabSnapshot().steps >= 100);
  const fitted = await page.evaluate(() => window.__d02LabSnapshot());
  if (fitted.accuracy < 0.85 || fitted.supportCount < 1 || fitted.marginWidth <= 0) {
    throw new Error(`Linear SVM fitting did not produce a useful margin solution: ${JSON.stringify(fitted)}.`);
  }

  await page.locator("#viewMode").selectOption("hinge");
  await page.waitForFunction(() => window.__d02LabSnapshot().view === "hinge");
  await setRange(page, "#cPenalty", "3.20");
  const hinge = await page.evaluate(() => ({
    snapshot: window.__d02LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!hinge.text.includes("Hinge loss") || !hinge.text.includes("C") || !Number.isFinite(hinge.snapshot.hingeMean)) {
    throw new Error(`Hinge view did not expose soft-margin diagnostics: ${JSON.stringify(hinge)}.`);
  }

  await page.locator("#kernel").selectOption("rbf");
  await page.waitForFunction(() => window.__d02LabSnapshot().kernel === "rbf" && window.__d02LabSnapshot().view === "kernel");
  await setRange(page, "#gamma", "1.80");
  await page.locator("#fitModel").click();
  await page.waitForFunction(() => window.__d02LabSnapshot().steps >= 150 && window.__d02LabSnapshot().kernel === "rbf");
  const kernel = await page.evaluate(() => ({
    snapshot: window.__d02LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!kernel.text.includes("kernel trick") || !kernel.text.includes("support vectors") || kernel.snapshot.supportCount < 2 || kernel.snapshot.accuracy < 0.75) {
    throw new Error(`RBF kernel view did not expose nonlinear SVM diagnostics: ${JSON.stringify(kernel)}.`);
  }

  await page.locator("#viewMode").selectOption("dual");
  await page.waitForFunction(() => window.__d02LabSnapshot().view === "dual");
  const dual = await page.evaluate(() => ({
    snapshot: window.__d02LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!dual.text.includes("Dual weights") || dual.snapshot.alphaMass <= 0) {
    throw new Error(`Dual view did not expose alpha/support-vector diagnostics: ${JSON.stringify(dual)}.`);
  }

  await page.setViewportSize({ width: 900, height: 700 });
  await assertNoDedicatedScrollbars(page, "narrow iframe");

  await browser.close();
  console.log("d02 smoke passed: 3D SVM lab renders, orbits, fits linear margin, shows hinge/dual diagnostics, uses RBF kernel, and fits iframe.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
