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
  const labPath = path.join(__dirname, "f10-persistent-homology-filtration.html").replace(/\\/g, "/");

  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
  await page.waitForFunction(() => window.__f10LabReady === true && window.__f10LabSnapshot());
  await page.waitForTimeout(180);

  const initial = await page.evaluate(() => {
    const canvas = document.querySelector(".lab-viewport canvas");
    return {
      bytes: canvas.toDataURL("image/png").length,
      snapshot: window.__f10LabSnapshot(),
      stateText: document.querySelector("#state").textContent.trim()
    };
  });
  if (initial.bytes < 9000) throw new Error(`F10 lab canvas appears blank; png payload only ${initial.bytes} bytes.`);
  if (initial.snapshot.has3d !== true || initial.snapshot.nodeCount < 8 || initial.snapshot.beta0 < 1) {
    throw new Error(`F10 lab did not expose useful 3D persistent-homology state: ${JSON.stringify(initial.snapshot)}.`);
  }
  if (!/components|epsilon|loop|triangles/i.test(initial.stateText)) {
    throw new Error(`Initial F10 diagnostics are weak: ${initial.stateText}`);
  }
  await assertNoDedicatedScrollbars(page, "desktop iframe");

  const beforeOrbit = await page.evaluate(() => window.__f10LabSnapshot().cameraTheta);
  const canvasBox = await page.locator(".lab-viewport canvas").boundingBox();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.36, canvasBox.y + canvasBox.height * 0.58);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.70, canvasBox.y + canvasBox.height * 0.32, { steps: 8 });
  await page.mouse.up();
  const afterOrbit = await page.evaluate(() => window.__f10LabSnapshot().cameraTheta);
  if (Math.abs(afterOrbit - beforeOrbit) < 0.05) {
    throw new Error("Dragging the canvas did not orbit the 3D filtration visualization.");
  }

  await page.locator("#grow").click();
  await page.waitForFunction(() => window.__f10LabSnapshot().epsilon > 0.4);
  const grown = await page.evaluate(() => ({
    snapshot: window.__f10LabSnapshot(),
    epsilonText: document.querySelector("#epsilonLabel").textContent.trim(),
    text: document.querySelector("#state").textContent.trim()
  }));
  if (!grown.epsilonText.includes(".") || grown.snapshot.edgeCount < 1 || !/component|barcode|loop|scale/i.test(grown.text)) {
    throw new Error(`F10 grow diagnostics are weak: ${JSON.stringify(grown)}.`);
  }

  await page.locator("#jumpLoop").click();
  await page.waitForFunction(() => window.__f10LabSnapshot().view === "barcode");
  const loop = await page.evaluate(() => ({
    snapshot: window.__f10LabSnapshot(),
    text: document.querySelector("#state").textContent.trim()
  }));
  if (loop.snapshot.longestH1 <= 0 || !/H1|loop|barcode/i.test(loop.text)) {
    throw new Error(`F10 loop/barcode diagnostics are weak: ${JSON.stringify(loop)}.`);
  }

  await page.locator("#fillLoop").click();
  await page.waitForFunction(() => window.__f10LabSnapshot().phase === "Filled" && window.__f10LabSnapshot().view === "complex");
  const filled = await page.evaluate(() => ({
    snapshot: window.__f10LabSnapshot(),
    text: document.querySelector("#state").textContent.trim()
  }));
  if (filled.snapshot.triangleCount < 1 || !/triangles|dies|loop disappears/i.test(filled.text)) {
    throw new Error(`F10 filled-complex diagnostics are weak: ${JSON.stringify(filled)}.`);
  }

  await page.selectOption("#dataset", "clusters");
  await page.selectOption("#viewSelect", "diagram");
  await page.locator("#reseed").click();
  await page.waitForFunction(() => window.__f10LabSnapshot().dataset === "clusters" && window.__f10LabSnapshot().view === "diagram");
  const diagram = await page.evaluate(() => ({
    snapshot: window.__f10LabSnapshot(),
    bytes: document.querySelector(".lab-viewport canvas").toDataURL("image/png").length
  }));
  if (diagram.bytes < 9000 || diagram.snapshot.nodeCount < 8) {
    throw new Error(`F10 persistence diagram view did not render: ${JSON.stringify(diagram)}.`);
  }

  await page.setViewportSize({ width: 900, height: 700 });
  await assertNoDedicatedScrollbars(page, "narrow iframe");

  await browser.close();
  console.log("f10 smoke passed: 3D TDA lab renders, orbits, grows filtration, shows barcode/diagram, fills loops, and fits iframe.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
