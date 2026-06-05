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
  const labPath = path.join(__dirname, "a02-linear-map-grid.html").replace(/\\/g, "/");

  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas#canvas").waitFor({ state: "visible" });
  await page.waitForFunction(() => window.__a02LabReady === true && window.__a02LabSnapshot());
  await page.waitForTimeout(240);

  const initial = await page.evaluate(() => {
    const canvas = document.querySelector(".lab-viewport canvas#canvas");
    return {
      bytes: canvas.toDataURL("image/png").length,
      snapshot: window.__a02LabSnapshot(),
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

  if (initial.bytes < 9000) throw new Error(`A02 lab canvas appears blank; png payload only ${initial.bytes} bytes.`);
  if (initial.snapshot.visualKind !== "linear-map-3d" || initial.root.visualKind !== "linear-map-3d") {
    throw new Error(`A02 should use the dedicated linear-map-3d visual: ${JSON.stringify(initial.snapshot)}.`);
  }
  if (initial.snapshot.graphStyle !== "hidden" || initial.root.graphStyle !== "hidden") {
    throw new Error(`A02 should hide generic graph scaffolding: ${JSON.stringify(initial.root)}.`);
  }
  if (!/domain|codomain|T\(v\)|linear map|kernel|image|rank-nullity/i.test(initial.stateText)) {
    throw new Error(`Initial A02 explanation is not map-specific enough: ${initial.stateText}`);
  }
  if (!/Linear map|v -> T\(v\)|kernel|image/i.test(initial.selectedText)) {
    throw new Error(`A02 selected chip should summarize the map: ${initial.selectedText}`);
  }
  for (const label of ["domain", "linear map T", "codomain", "kernel", "dual probe"]) {
    if (!initial.rail.includes(label)) throw new Error(`A02 missing concept rail chip "${label}": ${initial.rail.join(" | ")}`);
  }
  for (const label of ["Map T", "Kernel / image", "Dual action"]) {
    if (!initial.modeLabels.includes(label)) throw new Error(`A02 missing mode "${label}".`);
  }
  for (const label of ["Rank of T", "Kernel dim", "Image norm", "Dual value"]) {
    if (!initial.metricLabels.includes(label)) throw new Error(`A02 missing metric "${label}".`);
  }
  await assertNoDedicatedScrollbars(page, "desktop iframe");

  const beforeOrbit = await page.evaluate(() => window.__a02LabSnapshot().cameraTheta);
  const canvasBox = await page.locator(".lab-viewport canvas").boundingBox();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.36, canvasBox.y + canvasBox.height * 0.58);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.72, canvasBox.y + canvasBox.height * 0.31, { steps: 8 });
  await page.mouse.up();
  const afterOrbit = await page.evaluate(() => window.__a02LabSnapshot().cameraTheta);
  if (Math.abs(afterOrbit - beforeOrbit) < 0.05) {
    throw new Error("Dragging the canvas did not orbit the 3D linear-map visualization.");
  }

  const beforePulse = await page.locator("#stateBox").textContent();
  await page.locator("[data-action='pulse']").click();
  await page.waitForTimeout(90);
  const afterPulse = await page.locator("#stateBox").textContent();
  if (afterPulse === beforePulse || !/Pulse.*domain vector|image vector|kernel direction|dual probe/i.test(afterPulse)) {
    throw new Error(`A02 Pulse does not explain a real visual consequence: ${afterPulse}`);
  }

  await setRange(page, "#a02-stretch", "1.75");
  await setRange(page, "#a02-shear", "0.80");
  await setRange(page, "#a02-collapse", "0.92");
  const changed = await page.evaluate(() => ({
    text: document.querySelector("#stateBox").textContent.trim(),
    metrics: [...document.querySelectorAll("[data-role='metric'] strong")].map((node) => node.textContent.trim()),
    snapshot: window.__a02LabSnapshot()
  }));
  if (!/stretch 1\.75|shear 0\.80|collapse 0\.92|rank 2|kernel dimension 1/i.test(changed.text)) {
    throw new Error(`A02 sliders should report their actual map effects: ${changed.text}`);
  }
  if (changed.snapshot.params.stretch !== 1.75 || changed.snapshot.params.shear !== 0.8 || changed.snapshot.params.collapse !== 0.92) {
    throw new Error(`A02 snapshot did not retain map parameters: ${JSON.stringify(changed.snapshot.params)}.`);
  }
  if (!changed.metrics.includes("2.00") || !changed.metrics.includes("1.00")) {
    throw new Error(`A02 metrics should expose rank 2 and kernel dimension 1 after collapse: ${changed.metrics.join(", ")}`);
  }

  await page.selectOption("[data-control='mode']", "dual");
  await page.waitForTimeout(90);
  const dual = await page.locator("#stateBox").textContent();
  if (!/dual|functional|scalar|row vector/i.test(dual)) {
    throw new Error(`A02 dual mode should explain functional action: ${dual}`);
  }

  await page.locator("[data-action='step']").click();
  await page.waitForTimeout(90);
  const stepped = await page.locator("#stateBox").textContent();
  if (!/Step.*rank-nullity|kernel.*image|domain dimension/i.test(stepped)) {
    throw new Error(`A02 Step should advance kernel/image/rank-nullity: ${stepped}`);
  }

  await page.setViewportSize({ width: 900, height: 700 });
  await assertNoDedicatedScrollbars(page, "narrow iframe");

  await browser.close();
  console.log("a02 smoke passed: dedicated 3D linear-map visual renders, orbits, reacts to map parameters, and fits iframe.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
