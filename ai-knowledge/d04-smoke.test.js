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
  const labPath = path.join(__dirname, "d04-dimensionality-reduction-lab.html").replace(/\\/g, "/");

  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
  await page.waitForFunction(() => window.__d04LabReady === true && window.__d04LabSnapshot());
  await page.waitForTimeout(180);

  const initial = await page.evaluate(() => {
    const canvas = document.querySelector(".lab-viewport canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    return {
      hasWebgl: Boolean(gl),
      imageBytes: canvas.toDataURL("image/png").length,
      snapshot: window.__d04LabSnapshot(),
      stateText: document.querySelector("#stateBox").textContent.trim()
    };
  });
  if (!initial.hasWebgl) throw new Error("D04 lab did not create a WebGL canvas.");
  if (initial.imageBytes < 9000) throw new Error(`D04 lab canvas appears blank; png payload only ${initial.imageBytes} bytes.`);
  if (initial.snapshot.view !== "pca" || initial.snapshot.retainedVariance < 0.55 || initial.snapshot.reconstructionRmse <= 0) {
    throw new Error(`D04 lab did not expose useful PCA projection diagnostics: ${JSON.stringify(initial.snapshot)}.`);
  }
  if (!initial.stateText.includes("principal component") || !initial.stateText.includes("reconstruction residual")) {
    throw new Error(`PCA state text is weak: ${initial.stateText}`);
  }
  await assertNoDedicatedScrollbars(page, "desktop iframe");

  const beforeOrbit = await page.evaluate(() => window.__d04LabSnapshot().cameraTheta);
  const canvasBox = await page.locator(".lab-viewport canvas").boundingBox();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.44, canvasBox.y + canvasBox.height * 0.55);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.72, canvasBox.y + canvasBox.height * 0.34, { steps: 8 });
  await page.mouse.up();
  const afterOrbit = await page.evaluate(() => window.__d04LabSnapshot().cameraTheta);
  if (Math.abs(afterOrbit - beforeOrbit) < 0.05) {
    throw new Error("Dragging the canvas did not orbit the 3D dimensionality-reduction visualization.");
  }

  await page.locator("#viewMode").selectOption("residuals");
  await setRange(page, "#targetDim", "1");
  await page.waitForFunction(() => window.__d04LabSnapshot().view === "residuals" && window.__d04LabSnapshot().targetDim === 1);
  const residuals = await page.evaluate(() => ({
    snapshot: window.__d04LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!residuals.text.includes("Rank-1") || residuals.snapshot.reconstructionRmse <= 0 || residuals.snapshot.retainedVariance >= initial.snapshot.retainedVariance) {
    throw new Error(`Residual view did not expose rank-k compression loss: ${JSON.stringify(residuals)}.`);
  }

  await page.locator("#dataset").selectOption("swiss");
  await page.locator("#viewMode").selectOption("manifold");
  await setRange(page, "#neighborScale", "18");
  await page.waitForFunction(() => window.__d04LabSnapshot().dataset === "swiss" && window.__d04LabSnapshot().view === "manifold");
  const manifold = await page.evaluate(() => ({
    snapshot: window.__d04LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!manifold.text.includes("neighborhood") || !manifold.text.includes("manifold") || manifold.snapshot.trustworthiness <= 0.35) {
    throw new Error(`Manifold view did not expose neighborhood-preservation diagnostics: ${JSON.stringify(manifold)}.`);
  }

  await page.locator("#viewMode").selectOption("random");
  await setRange(page, "#targetDim", "2");
  await page.waitForFunction(() => window.__d04LabSnapshot().view === "random");
  const random = await page.evaluate(() => ({
    snapshot: window.__d04LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!random.text.includes("Random projection") || !Number.isFinite(random.snapshot.distanceDistortion) || random.snapshot.distanceDistortion <= 0) {
    throw new Error(`Random projection view did not expose distance-distortion diagnostics: ${JSON.stringify(random)}.`);
  }

  await page.setViewportSize({ width: 900, height: 700 });
  await assertNoDedicatedScrollbars(page, "narrow iframe");

  await browser.close();
  console.log("d04 smoke passed: 3D dimensionality-reduction lab renders, orbits, compresses PCA, shows residuals, compares random projection, preserves manifold neighborhoods, and fits iframe.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
