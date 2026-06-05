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
  const labPath = path.join(__dirname, "a08-algebra-structure-lab.html").replace(/\\/g, "/");

  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas#canvas").waitFor({ state: "visible" });
  await page.waitForFunction(() => window.__a08LabReady === true && window.__a08LabSnapshot());
  await page.waitForTimeout(260);

  const initial = await page.evaluate(() => {
    const canvas = document.querySelector(".lab-viewport canvas#canvas");
    return {
      bytes: canvas.toDataURL("image/png").length,
      snapshot: window.__a08LabSnapshot(),
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

  if (initial.bytes < 10000) throw new Error(`A08 lab canvas appears blank; png payload only ${initial.bytes} bytes.`);
  if (initial.snapshot.visualKind !== "abstract-algebra-lab" || initial.root.visualKind !== "abstract-algebra-lab") {
    throw new Error(`A08 should use the dedicated abstract-algebra-lab visual: ${JSON.stringify(initial.snapshot)}.`);
  }
  if (initial.snapshot.graphStyle !== "hidden" || initial.root.graphStyle !== "hidden") {
    throw new Error(`A08 should hide generic graph scaffolding: ${JSON.stringify(initial.root)}.`);
  }
  if (!/group|operation|closure|identity|inverse/i.test(initial.stateText)) {
    throw new Error(`Initial A08 explanation is not abstract-algebra-specific enough: ${initial.stateText}`);
  }
  if (!/Algebra|operation table|orbit|kernel/i.test(initial.selectedText)) {
    throw new Error(`A08 selected chip should summarize algebra structure: ${initial.selectedText}`);
  }
  for (const label of ["operation table", "identity", "inverse/unit", "generator orbit", "kernel quotient"]) {
    if (!initial.rail.includes(label)) throw new Error(`A08 missing concept rail chip "${label}": ${initial.rail.join(" | ")}`);
  }
  for (const label of ["Group table", "Ring units", "Homomorphism", "Group action"]) {
    if (!initial.modeLabels.includes(label)) throw new Error(`A08 missing mode "${label}".`);
  }
  for (const label of ["Closure score", "Unit fraction", "Kernel size", "Orbit length"]) {
    if (!initial.metricLabels.includes(label)) throw new Error(`A08 missing metric "${label}".`);
  }
  await assertNoDedicatedScrollbars(page, "desktop iframe");

  const beforeOrbit = await page.evaluate(() => window.__a08LabSnapshot().cameraTheta);
  const canvasBox = await page.locator(".lab-viewport canvas").boundingBox();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.34, canvasBox.y + canvasBox.height * 0.58);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.72, canvasBox.y + canvasBox.height * 0.30, { steps: 8 });
  await page.mouse.up();
  const afterOrbit = await page.evaluate(() => window.__a08LabSnapshot().cameraTheta);
  if (Math.abs(afterOrbit - beforeOrbit) < 0.05) {
    throw new Error("Dragging the canvas did not orbit the A08 algebra scene.");
  }

  await page.selectOption("[data-control='mode']", "ring");
  await setRange(page, "#a08-modulus", "6");
  await setRange(page, "#a08-operation", "1");
  await page.waitForTimeout(120);
  const ring = await page.evaluate(() => ({
    text: document.querySelector("#stateBox").textContent.trim(),
    metrics: [...document.querySelectorAll("[data-role='metric'] strong")].map((node) => node.textContent.trim()),
    snapshot: window.__a08LabSnapshot()
  }));
  if (!/Z_6|ring|units|zero divisors|not a field/i.test(ring.text)) {
    throw new Error(`A08 ring mode should explain units and zero divisors in Z_6: ${ring.text}`);
  }
  if (ring.snapshot.params.modulus !== 6 || ring.snapshot.params.operation !== 1) {
    throw new Error(`A08 snapshot did not retain ring parameters: ${JSON.stringify(ring.snapshot.params)}.`);
  }

  await page.selectOption("[data-control='mode']", "homomorphism");
  await setRange(page, "#a08-quotient", "3");
  await page.locator("[data-action='step']").click();
  await page.waitForTimeout(120);
  const hom = await page.locator("#stateBox").textContent();
  if (!/Step.*homomorphism|kernel|quotient|collapses/i.test(hom)) {
    throw new Error(`A08 Step should explain homomorphism/kernel/quotient: ${hom}`);
  }

  await page.selectOption("[data-control='mode']", "action");
  await setRange(page, "#a08-generator", "2");
  await page.locator("[data-action='pulse']").click();
  await page.waitForTimeout(120);
  const action = await page.locator("#stateBox").textContent();
  if (!/Pulse.*generator|orbit|stabilizer|action/i.test(action)) {
    throw new Error(`A08 Pulse should describe generator orbit/action consequences: ${action}`);
  }

  await page.setViewportSize({ width: 900, height: 700 });
  await assertNoDedicatedScrollbars(page, "narrow iframe");

  await browser.close();
  console.log("a08 smoke passed: dedicated abstract-algebra visual renders, orbits, reacts to operation/kernel/action parameters, and fits iframe.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
