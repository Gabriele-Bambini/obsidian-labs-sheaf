const path = require("path");

function loadPlaywright() {
  const candidates = [
    "playwright",
    "C:/Users/02gab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright",
    "C:/Users/02gab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
    "C:/Users/Gabriele/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright",
    "C:/Users/Gabriele/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"
  ];

  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (error) {
      // Try the next known runtime location.
    }
  }

  throw new Error(`Unable to load Playwright from: ${candidates.join(", ")}`);
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
  const labPath = path.join(__dirname, "f04-spectral-embedding.html").replace(/\\/g, "/");

  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
  await page.waitForFunction(() => window.__f04LabReady === true && window.__f04LabSnapshot());
  await page.waitForTimeout(180);

  const initial = await page.evaluate(() => {
    const canvas = document.querySelector(".lab-viewport canvas");
    return {
      bytes: canvas.toDataURL("image/png").length,
      snapshot: window.__f04LabSnapshot(),
      stateText: document.querySelector("#stateText").textContent.trim()
    };
  });
  if (initial.bytes < 9000) throw new Error(`F04 lab canvas appears blank; png payload only ${initial.bytes} bytes.`);
  if (initial.snapshot.nodeCount !== 6 || initial.snapshot.edgeCount !== 7 || initial.snapshot.has3d !== true) {
    throw new Error(`F04 lab did not expose useful 3D spectral state: ${JSON.stringify(initial.snapshot)}.`);
  }
  if (initial.snapshot.lambda2 <= 0 || !/Fiedler|lambda2|Dirichlet/i.test(initial.stateText)) {
    throw new Error(`Initial F04 diagnostics are weak: ${JSON.stringify(initial)}.`);
  }
  await assertNoDedicatedScrollbars(page, "desktop iframe");

  const beforeOrbit = await page.evaluate(() => window.__f04LabSnapshot().cameraTheta);
  const canvasBox = await page.locator(".lab-viewport canvas").boundingBox();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.35, canvasBox.y + canvasBox.height * 0.58);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.70, canvasBox.y + canvasBox.height * 0.35, { steps: 8 });
  await page.mouse.up();
  const afterOrbit = await page.evaluate(() => window.__f04LabSnapshot().cameraTheta);
  if (Math.abs(afterOrbit - beforeOrbit) < 0.05) {
    throw new Error("Dragging the canvas did not orbit the 3D spectral graph visualization.");
  }

  await page.locator("#cut").click();
  await page.waitForFunction(() => window.__f04LabSnapshot().status === "Cut" && window.__f04LabSnapshot().showCut === true);
  const cut = await page.evaluate(() => ({
    snapshot: window.__f04LabSnapshot(),
    cutLabel: document.querySelector("#cutLabel").textContent.trim(),
    text: document.querySelector("#stateText").textContent.trim()
  }));
  if (!cut.cutLabel.includes("Cut") || cut.snapshot.conductance <= 0 || cut.snapshot.cutWeight <= 0) {
    throw new Error(`F04 cut toggle did not expose useful cut diagnostics: ${JSON.stringify(cut)}.`);
  }
  if (!/Fiedler sign cut|conductance|low-energy separation/i.test(cut.text)) {
    throw new Error(`F04 cut state text is weak: ${cut.text}`);
  }

  await page.selectOption("#graphSelect", "Chain");
  await page.selectOption("#laplacianSelect", "normalized");
  await page.selectOption("#viewSelect", "spectrum");
  await page.waitForFunction(() => window.__f04LabSnapshot().graph === "Chain" && window.__f04LabSnapshot().view === "spectrum");
  const spectrum = await page.evaluate(() => ({
    snapshot: window.__f04LabSnapshot(),
    text: document.querySelector("#stateText").textContent.trim()
  }));
  if (spectrum.snapshot.lambda2 <= 0 || spectrum.snapshot.spectralGap <= 0) {
    throw new Error(`F04 spectrum view lacks positive lambda2/gap: ${JSON.stringify(spectrum)}.`);
  }
  if (!/eigenvalue ladder|lambda2|spectral embedding/i.test(spectrum.text)) {
    throw new Error(`F04 spectrum state text is weak: ${spectrum.text}`);
  }

  await page.selectOption("#graphSelect", "Bridge");
  await page.selectOption("#viewSelect", "diffusion");
  await setRange(page, "#heatSlider", "0.20");
  const beforeHeat = await page.evaluate(() => window.__f04LabSnapshot().energy);
  await page.locator("#heat").click();
  await page.waitForFunction((previous) => window.__f04LabSnapshot().status === "Heat" && window.__f04LabSnapshot().energy < previous, beforeHeat);
  const heated = await page.evaluate(() => ({
    snapshot: window.__f04LabSnapshot(),
    text: document.querySelector("#stateText").textContent.trim()
  }));
  if (!/Heat diffusion|exp\\(-lambda t\\)|Fiedler mode/i.test(heated.text)) {
    throw new Error(`F04 heat state text is weak: ${heated.text}`);
  }

  await page.setViewportSize({ width: 900, height: 700 });
  await assertNoDedicatedScrollbars(page, "narrow iframe");

  await browser.close();
  console.log("f04 smoke passed: 3D spectral graph lab renders, orbits, cuts, shows spectrum, diffuses heat, and fits iframe.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
