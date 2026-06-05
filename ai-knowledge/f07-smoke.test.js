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
    const elements = [...document.querySelectorAll(".lab-3d-shell, .stage, .lab-viewport, .lab-3d-panel, .controls")];
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

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 700 } });
  const labPath = path.join(__dirname, "f07-graph-signal-filtering.html").replace(/\\/g, "/");

  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
  await page.waitForFunction(() => window.__f07LabReady === true && window.__f07LabSnapshot());
  await page.waitForTimeout(180);

  const initial = await page.evaluate(() => {
    const canvas = document.querySelector(".lab-viewport canvas");
    return {
      bytes: canvas.toDataURL("image/png").length,
      snapshot: window.__f07LabSnapshot(),
      stateText: document.querySelector("#state").textContent.trim()
    };
  });
  if (initial.bytes < 9000) throw new Error(`F07 lab canvas appears blank; png payload only ${initial.bytes} bytes.`);
  if (initial.snapshot.has3d !== true || initial.snapshot.nodeCount < 8 || initial.snapshot.edgeCount < 7) {
    throw new Error(`F07 lab did not expose useful 3D graph signal state: ${JSON.stringify(initial.snapshot)}.`);
  }
  if (!/graph Laplacian|frequency|Signal/i.test(initial.stateText)) {
    throw new Error(`Initial F07 diagnostics are weak: ${initial.stateText}`);
  }
  await assertNoDedicatedScrollbars(page, "desktop iframe");

  const beforeOrbit = await page.evaluate(() => window.__f07LabSnapshot().cameraTheta);
  const canvasBox = await page.locator(".lab-viewport canvas").boundingBox();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.35, canvasBox.y + canvasBox.height * 0.58);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.70, canvasBox.y + canvasBox.height * 0.32, { steps: 8 });
  await page.mouse.up();
  const afterOrbit = await page.evaluate(() => window.__f07LabSnapshot().cameraTheta);
  if (Math.abs(afterOrbit - beforeOrbit) < 0.05) {
    throw new Error("Dragging the canvas did not orbit the 3D graph signal visualization.");
  }

  await page.selectOption("#mode", "high");
  await page.locator("#filterSignal").click();
  await page.waitForFunction(() => window.__f07LabSnapshot().status === "Filtered" && window.__f07LabSnapshot().mode === "high");
  const high = await page.evaluate(() => ({
    snapshot: window.__f07LabSnapshot(),
    modeLabel: document.querySelector("#modeLabel").textContent.trim(),
    text: document.querySelector("#state").textContent.trim()
  }));
  if (high.modeLabel !== "High-pass" || !/High-pass filtering|Laplacian disagreement|spikes/i.test(high.text)) {
    throw new Error(`F07 high-pass diagnostics are weak: ${JSON.stringify(high)}.`);
  }

  await page.selectOption("#graphPreset", "bridge");
  await page.selectOption("#signalPreset", "spike");
  await page.selectOption("#mode", "band");
  await page.selectOption("#viewSelect", "spectrum");
  await page.locator("#randomize").click();
  await page.waitForFunction(() => window.__f07LabSnapshot().graph === "bridge" && window.__f07LabSnapshot().signalPreset === "spike");
  const spectrum = await page.evaluate(() => ({
    snapshot: window.__f07LabSnapshot(),
    text: document.querySelector("#state").textContent.trim()
  }));
  if (spectrum.snapshot.highShare < 0 || !/noise|filtering|roughness/i.test(spectrum.text)) {
    throw new Error(`F07 spectrum/noise diagnostics are weak: ${JSON.stringify(spectrum)}.`);
  }

  await page.locator("#iterate").click();
  await page.waitForFunction(() => window.__f07LabSnapshot().status === "Iterated" && window.__f07LabSnapshot().steps >= 1);
  const iterated = await page.evaluate(() => ({
    snapshot: window.__f07LabSnapshot(),
    text: document.querySelector("#state").textContent.trim()
  }));
  if (!/filter steps|denoises|discontinuities/i.test(iterated.text)) {
    throw new Error(`F07 iteration state text is weak: ${iterated.text}`);
  }

  await page.locator("#heatFlow").click();
  await page.waitForFunction(() => window.__f07LabSnapshot().status === "Heat");
  const heat = await page.evaluate(() => document.querySelector("#state").textContent.trim());
  if (!/Heat flow|exp\\(-tL\\)|smooth graph modes/i.test(heat)) {
    throw new Error(`F07 heat flow state text is weak: ${heat}`);
  }

  await page.setViewportSize({ width: 900, height: 700 });
  await assertNoDedicatedScrollbars(page, "narrow iframe");

  await browser.close();
  console.log("f07 smoke passed: 3D graph signal lab renders, orbits, filters, iterates, shows spectrum, runs heat flow, and fits iframe.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
