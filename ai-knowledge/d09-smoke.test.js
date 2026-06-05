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
  const labPath = path.join(__dirname, "d09-regularization-lab.html").replace(/\\/g, "/");

  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
  await page.waitForFunction(() => window.__d09LabReady === true && window.__d09LabSnapshot());
  await page.waitForTimeout(220);

  const initial = await page.evaluate(() => {
    const canvas = document.querySelector(".lab-viewport canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    return {
      hasWebgl: Boolean(gl),
      imageBytes: canvas.toDataURL("image/png").length,
      snapshot: window.__d09LabSnapshot(),
      stateText: document.querySelector("#state").textContent.trim()
    };
  });
  if (!initial.hasWebgl) throw new Error("D09 lab did not create a WebGL canvas.");
  if (initial.imageBytes < 10000) throw new Error(`D09 lab canvas appears blank; png payload only ${initial.imageBytes} bytes.`);
  if (initial.snapshot.regularizer !== "ridge" || initial.snapshot.degree !== 9 || initial.snapshot.testError <= 0) {
    throw new Error(`D09 lab did not expose useful regularization diagnostics: ${JSON.stringify(initial.snapshot)}.`);
  }
  if (!/Regularization|coefficients|validation|shrink/i.test(initial.stateText)) {
    throw new Error(`D09 state text is weak: ${initial.stateText}`);
  }
  await assertNoDedicatedScrollbars(page, "desktop iframe");

  const beforeOrbit = await page.evaluate(() => window.__d09LabSnapshot().cameraTheta);
  const canvasBox = await page.locator(".lab-viewport canvas").boundingBox();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.42, canvasBox.y + canvasBox.height * 0.54);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.72, canvasBox.y + canvasBox.height * 0.35, { steps: 8 });
  await page.mouse.up();
  const afterOrbit = await page.evaluate(() => window.__d09LabSnapshot().cameraTheta);
  if (Math.abs(afterOrbit - beforeOrbit) < 0.05) {
    throw new Error("Dragging the canvas did not orbit the 3D regularization visualization.");
  }

  await page.locator("#regularizer").selectOption("elastic");
  await page.locator("#scenario").selectOption("wiggle");
  await setRange(page, "#lambda", "1.10");
  await setRange(page, "#degree", "11");
  await page.click("#best");
  await page.waitForFunction(() => window.__d09LabSnapshot().regularizer === "elastic" && window.__d09LabSnapshot().degree === 11);

  const tuned = await page.evaluate(() => ({
    snapshot: window.__d09LabSnapshot(),
    train: document.querySelector("#trainLabel").textContent.trim(),
    test: document.querySelector("#testLabel").textContent.trim(),
    active: document.querySelector("#activeLabel").textContent.trim(),
    stateText: document.querySelector("#state").textContent.trim()
  }));
  if (!/^\d+\.\d{3}$/.test(tuned.train) || !/^\d+\.\d{3}$/.test(tuned.test)) {
    throw new Error(`Expected formatted train/test MSE values, got "${tuned.train}" and "${tuned.test}".`);
  }
  if (!/^\d+\/\d+$/.test(tuned.active)) {
    throw new Error(`Expected active coefficient count, got "${tuned.active}".`);
  }
  if (tuned.snapshot.validationMinimum <= 0 || tuned.snapshot.norm <= 0 || tuned.snapshot.coefficientCount < 8) {
    throw new Error(`D09 tuned diagnostics are weak: ${JSON.stringify(tuned.snapshot)}.`);
  }
  if (!/coefficients|validation|stability|bias|variance|shrink/i.test(tuned.stateText)) {
    throw new Error(`D09 tuned state text is weak: ${tuned.stateText}`);
  }

  await page.setViewportSize({ width: 900, height: 700 });
  await assertNoDedicatedScrollbars(page, "narrow iframe");

  await browser.close();
  console.log("d09 smoke passed: 3D regularization lab renders, orbits, tunes validation penalty, exposes shrinkage diagnostics, and fits iframe.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
