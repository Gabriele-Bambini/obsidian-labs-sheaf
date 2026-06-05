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
  const labPath = path.join(__dirname, "a05-functional-analysis-operator-lab.html").replace(/\\/g, "/");

  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas#canvas").waitFor({ state: "visible" });
  await page.waitForFunction(() => window.__a05LabReady === true && window.__a05LabSnapshot());
  await page.waitForTimeout(260);

  const initial = await page.evaluate(() => {
    const canvas = document.querySelector(".lab-viewport canvas#canvas");
    return {
      bytes: canvas.toDataURL("image/png").length,
      snapshot: window.__a05LabSnapshot(),
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

  if (initial.bytes < 10000) throw new Error(`A05 lab canvas appears blank; png payload only ${initial.bytes} bytes.`);
  if (initial.snapshot.visualKind !== "functional-operator-space" || initial.root.visualKind !== "functional-operator-space") {
    throw new Error(`A05 should use the dedicated functional-operator-space visual: ${JSON.stringify(initial.snapshot)}.`);
  }
  if (initial.snapshot.graphStyle !== "hidden" || initial.root.graphStyle !== "hidden") {
    throw new Error(`A05 should hide generic graph scaffolding: ${JSON.stringify(initial.root)}.`);
  }
  if (!/function space|Hilbert|operator|projection|residual/i.test(initial.stateText)) {
    throw new Error(`Initial A05 explanation is not functional-analysis-specific enough: ${initial.stateText}`);
  }
  if (!/Function space|coefficients|operator|residual/i.test(initial.selectedText)) {
    throw new Error(`A05 selected chip should summarize function-space operators: ${initial.selectedText}`);
  }
  for (const label of ["function f", "basis coefficients", "operator T", "projection", "dual functional"]) {
    if (!initial.rail.includes(label)) throw new Error(`A05 missing concept rail chip "${label}": ${initial.rail.join(" | ")}`);
  }
  for (const label of ["Hilbert projection", "Compact smoothing", "Derivative stress", "Dual functional"]) {
    if (!initial.modeLabels.includes(label)) throw new Error(`A05 missing mode "${label}".`);
  }
  for (const label of ["Input norm", "Output norm", "Operator gain", "Residual norm"]) {
    if (!initial.metricLabels.includes(label)) throw new Error(`A05 missing metric "${label}".`);
  }
  await assertNoDedicatedScrollbars(page, "desktop iframe");

  const beforeOrbit = await page.evaluate(() => window.__a05LabSnapshot().cameraTheta);
  const canvasBox = await page.locator(".lab-viewport canvas").boundingBox();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.34, canvasBox.y + canvasBox.height * 0.58);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.72, canvasBox.y + canvasBox.height * 0.30, { steps: 8 });
  await page.mouse.up();
  const afterOrbit = await page.evaluate(() => window.__a05LabSnapshot().cameraTheta);
  if (Math.abs(afterOrbit - beforeOrbit) < 0.05) {
    throw new Error("Dragging the canvas did not orbit the A05 functional-operator scene.");
  }

  await page.selectOption("[data-control='mode']", "derivative");
  await setRange(page, "#a05-frequency", "11");
  await setRange(page, "#a05-strength", "1.60");
  await page.waitForTimeout(120);
  const derivative = await page.evaluate(() => ({
    text: document.querySelector("#stateBox").textContent.trim(),
    metrics: [...document.querySelectorAll("[data-role='metric'] strong")].map((node) => node.textContent.trim()),
    snapshot: window.__a05LabSnapshot()
  }));
  if (!/derivative|high-frequency|unbounded|operator gain/i.test(derivative.text)) {
    throw new Error(`A05 derivative mode should explain high-frequency amplification: ${derivative.text}`);
  }
  if (derivative.snapshot.params.frequency !== 11 || derivative.snapshot.params.strength !== 1.6) {
    throw new Error(`A05 snapshot did not retain frequency/strength parameters: ${JSON.stringify(derivative.snapshot.params)}.`);
  }
  if (!derivative.metrics.some((value) => Number.parseFloat(value) > 2)) {
    throw new Error(`A05 operator gain should exceed 2 under derivative stress: ${derivative.metrics.join(", ")}`);
  }

  await page.selectOption("[data-control='mode']", "compact");
  await page.locator("[data-action='pulse']").click();
  await page.waitForTimeout(120);
  const compact = await page.locator("#stateBox").textContent();
  if (!/Pulse.*compact|smoothing|high modes|operator/i.test(compact)) {
    throw new Error(`A05 compact Pulse should describe smoothing consequences: ${compact}`);
  }

  await page.selectOption("[data-control='mode']", "dual");
  await setRange(page, "#a05-probe", "0.72");
  await page.locator("[data-action='step']").click();
  await page.waitForTimeout(120);
  const dual = await page.locator("#stateBox").textContent();
  if (!/Step.*dual|functional|scalar|Riesz/i.test(dual)) {
    throw new Error(`A05 Step should explain the dual functional scalar readout: ${dual}`);
  }

  await page.setViewportSize({ width: 900, height: 700 });
  await assertNoDedicatedScrollbars(page, "narrow iframe");

  await browser.close();
  console.log("a05 smoke passed: dedicated functional-operator visual renders, orbits, reacts to operator parameters, and fits iframe.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
