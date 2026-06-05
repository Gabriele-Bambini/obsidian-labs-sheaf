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
  const labPath = path.join(__dirname, "a07-measure-integration.html").replace(/\\/g, "/");

  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas#canvas").waitFor({ state: "visible" });
  await page.waitForFunction(() => window.__a07LabReady === true && window.__a07LabSnapshot());
  await page.waitForTimeout(260);

  const initial = await page.evaluate(() => {
    const canvas = document.querySelector(".lab-viewport canvas#canvas");
    return {
      bytes: canvas.toDataURL("image/png").length,
      snapshot: window.__a07LabSnapshot(),
      stateText: document.querySelector("#stateBox").textContent.trim(),
      selectedText: document.querySelector("[data-role='selected'] strong").textContent.trim(),
      rail: [...document.querySelectorAll(".concept-rail span")].map((node) => node.textContent.trim()),
      modeLabels: [...document.querySelectorAll("[data-control='mode'] option")].map((node) => node.textContent.trim()),
      metricLabels: [...document.querySelectorAll("[data-role='metric'] span")].map((node) => node.textContent.trim()),
      root: {
        visualKind: document.querySelector(".gnn-lab").dataset.visualKind,
        graphStyle: document.querySelector(".gnn-lab").dataset.graphStyle
      }
    };
  });

  if (initial.bytes < 10000) throw new Error(`A07 lab canvas appears blank; png payload only ${initial.bytes} bytes.`);
  if (initial.snapshot.visualKind !== "differential-manifold-3d" || initial.root.visualKind !== "differential-manifold-3d") {
    throw new Error(`A07 should use the dedicated differential-manifold-3d visual: ${JSON.stringify(initial.snapshot)}.`);
  }
  if (initial.snapshot.graphStyle !== "hidden" || initial.root.graphStyle !== "hidden") {
    throw new Error(`A07 should hide generic graph scaffolding: ${JSON.stringify(initial.root)}.`);
  }
  if (!/manifold|tangent|metric|geodesic|curvature/i.test(initial.stateText)) {
    throw new Error(`Initial A07 explanation is not differential-geometry-specific enough: ${initial.stateText}`);
  }
  if (!/Manifold|tangent|geodesic|curvature/i.test(initial.selectedText)) {
    throw new Error(`A07 selected chip should summarize manifold geometry: ${initial.selectedText}`);
  }
  for (const label of ["manifold surface", "point p", "tangent plane", "metric volume", "geodesic"]) {
    if (!initial.rail.includes(label)) throw new Error(`A07 missing concept rail chip "${label}": ${initial.rail.join(" | ")}`);
  }
  for (const label of ["Tangent chart", "Metric volume", "Geodesic path", "Curvature field"]) {
    if (!initial.modeLabels.includes(label)) throw new Error(`A07 missing mode "${label}".`);
  }
  for (const label of ["Metric area", "Geodesic gap", "Curvature sign", "Tangent error"]) {
    if (!initial.metricLabels.includes(label)) throw new Error(`A07 missing metric "${label}".`);
  }
  await assertNoDedicatedScrollbars(page, "desktop iframe");

  const beforeOrbit = await page.evaluate(() => window.__a07LabSnapshot().cameraTheta);
  const canvasBox = await page.locator(".lab-viewport canvas").boundingBox();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.34, canvasBox.y + canvasBox.height * 0.58);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.72, canvasBox.y + canvasBox.height * 0.30, { steps: 8 });
  await page.mouse.up();
  const afterOrbit = await page.evaluate(() => window.__a07LabSnapshot().cameraTheta);
  if (Math.abs(afterOrbit - beforeOrbit) < 0.05) {
    throw new Error("Dragging the canvas did not orbit the A07 manifold scene.");
  }

  await page.selectOption("[data-control='mode']", "curvature");
  await setRange(page, "#a07-curvature", "-1.20");
  await setRange(page, "#a07-theta", "0.70");
  await setRange(page, "#a07-phi", "0.35");
  await page.waitForTimeout(120);
  const curvature = await page.evaluate(() => ({
    text: document.querySelector("#stateBox").textContent.trim(),
    metrics: [...document.querySelectorAll("[data-role='metric'] strong")].map((node) => node.textContent.trim()),
    snapshot: window.__a07LabSnapshot()
  }));
  if (!/negative curvature|saddle|geodesics spread|curvature/i.test(curvature.text)) {
    throw new Error(`A07 curvature mode should explain negative/saddle geometry: ${curvature.text}`);
  }
  if (curvature.snapshot.params.curvature !== -1.2 || curvature.snapshot.params.theta !== 0.7) {
    throw new Error(`A07 snapshot did not retain curvature/chart parameters: ${JSON.stringify(curvature.snapshot.params)}.`);
  }
  if (!curvature.metrics.some((value) => value.startsWith("-"))) {
    throw new Error(`A07 curvature-sign metric should become negative: ${curvature.metrics.join(", ")}`);
  }

  await page.selectOption("[data-control='mode']", "geodesic");
  await setRange(page, "#a07-step", "0.85");
  await page.locator("[data-action='step']").click();
  await page.waitForTimeout(120);
  const step = await page.locator("#stateBox").textContent();
  if (!/Step.*geodesic|retraction|ambient chord|manifold path/i.test(step)) {
    throw new Error(`A07 Step should compare geodesic/retraction with ambient chord: ${step}`);
  }

  await page.locator("[data-action='pulse']").click();
  await page.waitForTimeout(120);
  const pulse = await page.locator("#stateBox").textContent();
  if (!/Pulse.*tangent|metric|volume|geodesic/i.test(pulse)) {
    throw new Error(`A07 Pulse should describe visible tangent/metric/geodesic consequences: ${pulse}`);
  }

  await page.setViewportSize({ width: 900, height: 700 });
  await assertNoDedicatedScrollbars(page, "narrow iframe");

  await browser.close();
  console.log("a07 smoke passed: dedicated differential-manifold visual renders, orbits, reacts to tangent/metric/curvature parameters, and fits iframe.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
