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
  const labPath = path.join(__dirname, "a01-linear-algebra-foundations-lab.html").replace(/\\/g, "/");

  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas#canvas").waitFor({ state: "visible" });
  await page.waitForFunction(() => window.__a01LabReady === true && window.__a01LabSnapshot());
  await page.waitForTimeout(220);

  const initial = await page.evaluate(() => {
    const canvas = document.querySelector(".lab-viewport canvas#canvas");
    return {
      bytes: canvas.toDataURL("image/png").length,
      snapshot: window.__a01LabSnapshot(),
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

  if (initial.bytes < 9000) throw new Error(`A01 lab canvas appears blank; png payload only ${initial.bytes} bytes.`);
  if (initial.snapshot.visualKind !== "vector-space-3d" || initial.root.visualKind !== "vector-space-3d") {
    throw new Error(`A01 should use a simple interactive vector-space-3d visual: ${JSON.stringify(initial.snapshot)}.`);
  }
  if (initial.snapshot.graphStyle !== "hidden" || initial.root.graphStyle !== "hidden") {
    throw new Error(`A01 should hide generic graph scaffolding: ${JSON.stringify(initial.root)}.`);
  }
  if (!/3D axes|vector|component|projection|x\/y\/z/i.test(initial.stateText)) {
    throw new Error(`Initial A01 explanation is not concept-specific enough: ${initial.stateText}`);
  }
  if (!/Vector space|v =|components|projection/i.test(initial.selectedText)) {
    throw new Error(`A01 selected chip should summarize the learning path: ${initial.selectedText}`);
  }
  for (const label of ["3D axes", "vector v", "components", "projection", "second vector"]) {
    if (!initial.rail.includes(label)) throw new Error(`A01 missing concept rail chip "${label}": ${initial.rail.join(" | ")}`);
  }
  for (const label of ["Vector coordinates", "Components", "Projection"]) {
    if (!initial.modeLabels.includes(label)) throw new Error(`A01 missing mode "${label}".`);
  }
  for (const label of ["Vector length", "Plane projection", "Dot with u", "Basis volume"]) {
    if (!initial.metricLabels.includes(label)) throw new Error(`A01 missing metric "${label}".`);
  }
  await assertNoDedicatedScrollbars(page, "desktop iframe");

  const beforeOrbit = await page.evaluate(() => window.__a01LabSnapshot().cameraTheta);
  const canvasBox = await page.locator(".lab-viewport canvas").boundingBox();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.38, canvasBox.y + canvasBox.height * 0.58);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.74, canvasBox.y + canvasBox.height * 0.28, { steps: 8 });
  await page.mouse.up();
  const afterOrbit = await page.evaluate(() => window.__a01LabSnapshot().cameraTheta);
  if (Math.abs(afterOrbit - beforeOrbit) < 0.05) {
    throw new Error("Dragging the canvas did not orbit the A01 3D linear algebra visualization.");
  }

  const beforePulse = await page.locator("#stateBox").textContent();
  await page.locator("[data-action='pulse']").click();
  await page.waitForTimeout(80);
  const afterPulse = await page.locator("#stateBox").textContent();
  if (afterPulse === beforePulse || !/Pulse.*vector|component legs|projection shadow|second vector/i.test(afterPulse)) {
    throw new Error(`A01 Pulse does not explain a real visual consequence: ${afterPulse}`);
  }

  await setRange(page, "#a01-x", "1.75");
  await setRange(page, "#a01-y", "1.10");
  await setRange(page, "#a01-z", "-0.65");
  const changed = await page.evaluate(() => ({
    text: document.querySelector("#stateBox").textContent.trim(),
    metrics: [...document.querySelectorAll("[data-role='metric'] strong")].map((node) => node.textContent.trim()),
    snapshot: window.__a01LabSnapshot()
  }));
  if (!/x component 1\.75|y component 1\.10|z component -0\.65/i.test(changed.text)) {
    throw new Error(`A01 x/y/z sliders should report their actual vector effects: ${changed.text}`);
  }
  if (changed.snapshot.params.x !== 1.75 || changed.snapshot.params.y !== 1.1 || changed.snapshot.params.z !== -0.65) {
    throw new Error(`A01 snapshot did not retain vector coordinates: ${JSON.stringify(changed.snapshot.params)}.`);
  }
  if (new Set(changed.metrics).size < 2) {
    throw new Error(`A01 metric values did not react meaningfully: ${changed.metrics.join(", ")}`);
  }

  await page.locator("[data-action='step']").click();
  await page.waitForTimeout(80);
  const stepped = await page.locator("#stateBox").textContent();
  if (!/Step.*component decomposition|basis scale|projection/i.test(stepped)) {
    throw new Error(`A01 Step should advance the vector-space decomposition: ${stepped}`);
  }

  await page.setViewportSize({ width: 900, height: 700 });
  await assertNoDedicatedScrollbars(page, "narrow iframe");

  await browser.close();
  console.log("a01 smoke passed: simple 3D vector-space visual renders, orbits, reacts to x/y/z parameters, and fits iframe.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
