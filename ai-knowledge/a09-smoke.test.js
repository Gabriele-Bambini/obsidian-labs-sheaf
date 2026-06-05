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
  const labPath = path.join(__dirname, "a09-category-theory-diagram-lab.html").replace(/\\/g, "/");

  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas#canvas").waitFor({ state: "visible" });
  await page.waitForFunction(() => window.__a09LabReady === true && window.__a09LabSnapshot());
  await page.waitForTimeout(260);

  const initial = await page.evaluate(() => {
    const canvas = document.querySelector(".lab-viewport canvas#canvas");
    return {
      bytes: canvas.toDataURL("image/png").length,
      snapshot: window.__a09LabSnapshot(),
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

  if (initial.bytes < 10000) throw new Error(`A09 lab canvas appears blank; png payload only ${initial.bytes} bytes.`);
  if (initial.snapshot.visualKind !== "category-diagram-lab" || initial.root.visualKind !== "category-diagram-lab") {
    throw new Error(`A09 should use the dedicated category-diagram-lab visual: ${JSON.stringify(initial.snapshot)}.`);
  }
  if (initial.snapshot.graphStyle !== "hidden" || initial.root.graphStyle !== "hidden") {
    throw new Error(`A09 should hide generic graph scaffolding: ${JSON.stringify(initial.root)}.`);
  }
  if (!/category|object|arrow|identity|composition/i.test(initial.stateText)) {
    throw new Error(`Initial A09 explanation is not category-theory-specific enough: ${initial.stateText}`);
  }
  if (!/Category|arrows|functor|naturality/i.test(initial.selectedText)) {
    throw new Error(`A09 selected chip should summarize categorical structure: ${initial.selectedText}`);
  }
  for (const label of ["objects", "arrows", "composition", "functor image", "naturality square"]) {
    if (!initial.rail.includes(label)) throw new Error(`A09 missing concept rail chip "${label}": ${initial.rail.join(" | ")}`);
  }
  for (const label of ["Category laws", "Functor layer", "Naturality square", "Poset category", "One-object monoid"]) {
    if (!initial.modeLabels.includes(label)) throw new Error(`A09 missing mode "${label}".`);
  }
  for (const label of ["Composition error", "Functor law", "Naturality gap", "Arrow count"]) {
    if (!initial.metricLabels.includes(label)) throw new Error(`A09 missing metric "${label}".`);
  }
  await assertNoDedicatedScrollbars(page, "desktop iframe");

  const beforeOrbit = await page.evaluate(() => window.__a09LabSnapshot().cameraTheta);
  const canvasBox = await page.locator(".lab-viewport canvas").boundingBox();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.34, canvasBox.y + canvasBox.height * 0.58);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.72, canvasBox.y + canvasBox.height * 0.30, { steps: 8 });
  await page.mouse.up();
  const afterOrbit = await page.evaluate(() => window.__a09LabSnapshot().cameraTheta);
  if (Math.abs(afterOrbit - beforeOrbit) < 0.05) {
    throw new Error("Dragging the canvas did not orbit the A09 category scene.");
  }

  await page.selectOption("[data-control='mode']", "functor");
  await setRange(page, "#a09-functor", "0.85");
  await setRange(page, "#a09-composition", "0.90");
  await page.locator("[data-action='pulse']").click();
  await page.waitForTimeout(120);
  const functor = await page.locator("#stateBox").textContent();
  if (!/Pulse.*functor|preserves composition|source category|target category/i.test(functor)) {
    throw new Error(`A09 Pulse should describe functor composition preservation: ${functor}`);
  }

  await page.selectOption("[data-control='mode']", "naturality");
  await setRange(page, "#a09-naturality", "0.75");
  await page.locator("[data-action='step']").click();
  await page.waitForTimeout(120);
  const naturality = await page.evaluate(() => ({
    text: document.querySelector("#stateBox").textContent.trim(),
    metrics: [...document.querySelectorAll("[data-role='metric'] strong")].map((node) => node.textContent.trim()),
    snapshot: window.__a09LabSnapshot()
  }));
  if (!/Step.*naturality square|eta|two routes|commute/i.test(naturality.text)) {
    throw new Error(`A09 Step should explain naturality square and eta routes: ${naturality.text}`);
  }
  if (naturality.snapshot.params.naturality !== 0.75) {
    throw new Error(`A09 snapshot did not retain naturality parameter: ${JSON.stringify(naturality.snapshot.params)}.`);
  }
  if (!naturality.metrics.some((value) => Number.parseFloat(value) > 0.5)) {
    throw new Error(`A09 naturality gap should become visible: ${naturality.metrics.join(", ")}`);
  }

  await page.selectOption("[data-control='mode']", "poset");
  await page.waitForTimeout(120);
  const poset = await page.locator("#stateBox").textContent();
  if (!/poset|order relation|transitivity|at most one arrow/i.test(poset)) {
    throw new Error(`A09 poset mode should explain order as category: ${poset}`);
  }

  await page.selectOption("[data-control='mode']", "monoid");
  await page.waitForTimeout(120);
  const monoid = await page.locator("#stateBox").textContent();
  if (!/one-object monoid|endomorphism|identity|composition/i.test(monoid)) {
    throw new Error(`A09 monoid mode should explain one-object category: ${monoid}`);
  }

  await page.setViewportSize({ width: 900, height: 700 });
  await assertNoDedicatedScrollbars(page, "narrow iframe");

  await browser.close();
  console.log("a09 smoke passed: dedicated category-diagram visual renders, orbits, reacts to functor/naturality parameters, and fits iframe.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
