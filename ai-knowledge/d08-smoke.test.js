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
  const labPath = path.join(__dirname, "d08-learning-theory-lab.html").replace(/\\/g, "/");

  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
  await page.waitForFunction(() => window.__d08LabReady === true && window.__d08LabSnapshot());
  await page.waitForTimeout(180);

  const initial = await page.evaluate(() => {
    const canvas = document.querySelector(".lab-viewport canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    return {
      hasWebgl: Boolean(gl),
      imageBytes: canvas.toDataURL("image/png").length,
      snapshot: window.__d08LabSnapshot(),
      stateText: document.querySelector("#stateBox").textContent.trim()
    };
  });
  if (!initial.hasWebgl) throw new Error("D08 lab did not create a WebGL canvas.");
  if (initial.imageBytes < 9000) throw new Error(`D08 lab canvas appears blank; png payload only ${initial.imageBytes} bytes.`);
  if (initial.snapshot.view !== "risk" || initial.snapshot.sampleSize !== 80 || initial.snapshot.generalizationGap <= 0 || initial.snapshot.bound <= 0) {
    throw new Error(`D08 lab did not expose useful risk diagnostics: ${JSON.stringify(initial.snapshot)}.`);
  }
  if (!initial.stateText.includes("empirical risk") || !initial.stateText.includes("population risk")) {
    throw new Error(`Risk state text is weak: ${initial.stateText}`);
  }
  await assertNoDedicatedScrollbars(page, "desktop iframe");

  const beforeOrbit = await page.evaluate(() => window.__d08LabSnapshot().cameraTheta);
  const canvasBox = await page.locator(".lab-viewport canvas").boundingBox();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.45, canvasBox.y + canvasBox.height * 0.55);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.74, canvasBox.y + canvasBox.height * 0.35, { steps: 8 });
  await page.mouse.up();
  const afterOrbit = await page.evaluate(() => window.__d08LabSnapshot().cameraTheta);
  if (Math.abs(afterOrbit - beforeOrbit) < 0.05) {
    throw new Error("Dragging the canvas did not orbit the 3D learning-theory visualization.");
  }

  await setRange(page, "#sampleSize", "180");
  await page.waitForFunction(() => window.__d08LabSnapshot().sampleSize === 180);
  const largerSample = await page.evaluate(() => window.__d08LabSnapshot());
  if (largerSample.bound >= initial.snapshot.bound) {
    throw new Error(`Increasing sample size did not shrink the generalization bound: ${JSON.stringify(largerSample)}.`);
  }

  await page.locator("#viewMode").selectOption("vc");
  await setRange(page, "#capacity", "8");
  await page.waitForFunction(() => window.__d08LabSnapshot().view === "vc" && window.__d08LabSnapshot().capacity === 8);
  const vc = await page.evaluate(() => ({
    snapshot: window.__d08LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!vc.text.includes("shattering") || vc.snapshot.vcDimension < 4 || vc.snapshot.growthFunction <= 0) {
    throw new Error(`VC view did not expose shattering diagnostics: ${JSON.stringify(vc)}.`);
  }

  await page.locator("#viewMode").selectOption("rademacher");
  await page.waitForFunction(() => window.__d08LabSnapshot().view === "rademacher");
  const rademacher = await page.evaluate(() => ({
    snapshot: window.__d08LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!rademacher.text.includes("Rademacher") || !rademacher.text.includes("random signs") || rademacher.snapshot.rademacherComplexity <= 0) {
    throw new Error(`Rademacher view did not expose random-sign diagnostics: ${JSON.stringify(rademacher)}.`);
  }

  await page.locator("#viewMode").selectOption("stability");
  await setRange(page, "#regularization", "0.85");
  await page.waitForFunction(() => window.__d08LabSnapshot().view === "stability");
  const stability = await page.evaluate(() => ({
    snapshot: window.__d08LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!stability.text.includes("stability") || stability.snapshot.stabilityShift <= 0 || stability.snapshot.margin <= 0) {
    throw new Error(`Stability view did not expose algorithmic-stability diagnostics: ${JSON.stringify(stability)}.`);
  }

  await page.setViewportSize({ width: 900, height: 700 });
  await assertNoDedicatedScrollbars(page, "narrow iframe");

  await browser.close();
  console.log("d08 smoke passed: 3D learning-theory lab renders, orbits, shrinks bounds with sample size, exposes VC shattering, Rademacher complexity, stability, and fits iframe.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
