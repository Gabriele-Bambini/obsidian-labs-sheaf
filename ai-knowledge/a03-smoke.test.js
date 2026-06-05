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
  const labPath = path.join(__dirname, "a03-eigen-quadratic-form.html").replace(/\\/g, "/");

  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas#canvas").waitFor({ state: "visible" });
  await page.waitForFunction(() => window.__a03LabReady === true && window.__a03LabSnapshot());
  await page.waitForTimeout(260);

  const initial = await page.evaluate(() => {
    const canvas = document.querySelector(".lab-viewport canvas#canvas");
    return {
      bytes: canvas.toDataURL("image/png").length,
      snapshot: window.__a03LabSnapshot(),
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

  if (initial.bytes < 9000) throw new Error(`A03 lab canvas appears blank; png payload only ${initial.bytes} bytes.`);
  if (initial.snapshot.visualKind !== "quadratic-taylor-surface" || initial.root.visualKind !== "quadratic-taylor-surface") {
    throw new Error(`A03 should use the dedicated quadratic-taylor-surface visual: ${JSON.stringify(initial.snapshot)}.`);
  }
  if (initial.snapshot.graphStyle !== "hidden" || initial.root.graphStyle !== "hidden") {
    throw new Error(`A03 should hide generic graph scaffolding: ${JSON.stringify(initial.root)}.`);
  }
  if (!/surface|gradient|tangent plane|Hessian|eigen/i.test(initial.stateText)) {
    throw new Error(`Initial A03 explanation is not calculus-specific enough: ${initial.stateText}`);
  }
  if (!/Taylor surface|gradient|Hessian|classification/i.test(initial.selectedText)) {
    throw new Error(`A03 selected chip should summarize local calculus: ${initial.selectedText}`);
  }
  for (const label of ["surface f", "point p", "gradient", "tangent plane", "Hessian eigens"]) {
    if (!initial.rail.includes(label)) throw new Error(`A03 missing concept rail chip "${label}": ${initial.rail.join(" | ")}`);
  }
  for (const label of ["Taylor surface", "Gradient flow", "Hessian saddle"]) {
    if (!initial.modeLabels.includes(label)) throw new Error(`A03 missing mode "${label}".`);
  }
  for (const label of ["Gradient norm", "Hessian det", "Curvature class", "Directional derivative"]) {
    if (!initial.metricLabels.includes(label)) throw new Error(`A03 missing metric "${label}".`);
  }
  await assertNoDedicatedScrollbars(page, "desktop iframe");

  const beforeOrbit = await page.evaluate(() => window.__a03LabSnapshot().cameraTheta);
  const canvasBox = await page.locator(".lab-viewport canvas").boundingBox();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.34, canvasBox.y + canvasBox.height * 0.58);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.72, canvasBox.y + canvasBox.height * 0.30, { steps: 8 });
  await page.mouse.up();
  const afterOrbit = await page.evaluate(() => window.__a03LabSnapshot().cameraTheta);
  if (Math.abs(afterOrbit - beforeOrbit) < 0.05) {
    throw new Error("Dragging the canvas did not orbit the A03 Taylor surface.");
  }

  const beforePulse = await page.locator("#stateBox").textContent();
  await page.locator("[data-action='pulse']").click();
  await page.waitForTimeout(90);
  const afterPulse = await page.locator("#stateBox").textContent();
  if (afterPulse === beforePulse || !/Pulse.*surface|gradient arrow|tangent plane|Hessian eigen/i.test(afterPulse)) {
    throw new Error(`A03 Pulse does not explain a real visual consequence: ${afterPulse}`);
  }

  await setRange(page, "#a03-lambda1", "1.50");
  await setRange(page, "#a03-lambda2", "-0.95");
  await setRange(page, "#a03-px", "0.55");
  await setRange(page, "#a03-py", "-0.40");
  const saddle = await page.evaluate(() => ({
    text: document.querySelector("#stateBox").textContent.trim(),
    metrics: [...document.querySelectorAll("[data-role='metric'] strong")].map((node) => node.textContent.trim()),
    snapshot: window.__a03LabSnapshot()
  }));
  if (!/lambda1 1\.50|lambda2 -0\.95|saddle|gradient/i.test(saddle.text)) {
    throw new Error(`A03 sliders should report actual curvature and point effects: ${saddle.text}`);
  }
  if (saddle.snapshot.params.lambda1 !== 1.5 || saddle.snapshot.params.lambda2 !== -0.95) {
    throw new Error(`A03 snapshot did not retain Hessian eigenvalues: ${JSON.stringify(saddle.snapshot.params)}.`);
  }
  if (!saddle.metrics.some((value) => value.startsWith("-"))) {
    throw new Error(`A03 Hessian determinant should become negative in saddle state: ${saddle.metrics.join(", ")}`);
  }

  await page.selectOption("[data-control='mode']", "gradient");
  await page.waitForTimeout(90);
  const gradient = await page.locator("#stateBox").textContent();
  if (!/gradient flow|steepest descent|negative gradient/i.test(gradient)) {
    throw new Error(`A03 gradient mode should explain descent direction: ${gradient}`);
  }

  await page.locator("[data-action='step']").click();
  await page.waitForTimeout(90);
  const stepped = await page.locator("#stateBox").textContent();
  if (!/Step.*Taylor approximation|linear term|quadratic Hessian/i.test(stepped)) {
    throw new Error(`A03 Step should advance Taylor approximation: ${stepped}`);
  }

  await page.setViewportSize({ width: 900, height: 700 });
  await assertNoDedicatedScrollbars(page, "narrow iframe");

  await browser.close();
  console.log("a03 smoke passed: dedicated Taylor surface renders, orbits, reacts to gradient/Hessian parameters, and fits iframe.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
