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
  const labPath = path.join(__dirname, "f02-algebraic-graph-matrices.html").replace(/\\/g, "/");

  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
  await page.waitForFunction(() => window.__f02LabReady === true && window.__f02LabSnapshot());
  await page.waitForTimeout(180);

  const initial = await page.evaluate(() => {
    const canvas = document.querySelector(".lab-viewport canvas");
    return {
      bytes: canvas.toDataURL("image/png").length,
      snapshot: window.__f02LabSnapshot(),
      stateText: document.querySelector("#stateText").textContent.trim()
    };
  });
  if (initial.bytes < 9000) throw new Error(`F02 lab canvas appears blank; png payload only ${initial.bytes} bytes.`);
  if (initial.snapshot.nodeCount !== 5 || initial.snapshot.edgeCount !== 4 || initial.snapshot.has3d !== true) {
    throw new Error(`F02 lab did not expose useful 3D matrix state: ${JSON.stringify(initial.snapshot)}.`);
  }
  if (!/Adjacency|edge set|matrices/i.test(initial.stateText)) {
    throw new Error(`Initial F02 diagnostics are weak: ${initial.stateText}`);
  }
  await assertNoDedicatedScrollbars(page, "desktop iframe");

  const beforeOrbit = await page.evaluate(() => window.__f02LabSnapshot().cameraTheta);
  const canvasBox = await page.locator(".lab-viewport canvas").boundingBox();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.35, canvasBox.y + canvasBox.height * 0.58);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.68, canvasBox.y + canvasBox.height * 0.34, { steps: 8 });
  await page.mouse.up();
  const afterOrbit = await page.evaluate(() => window.__f02LabSnapshot().cameraTheta);
  if (Math.abs(afterOrbit - beforeOrbit) < 0.05) {
    throw new Error("Dragging the canvas did not orbit the 3D graph matrix visualization.");
  }

  await page.selectOption("#matrixSelect", "B");
  await page.locator("#reverseEdge").click();
  await page.waitForFunction(() => window.__f02LabSnapshot().matrix === "B" && window.__f02LabSnapshot().status === "Reversed");
  const incidence = await page.evaluate(() => ({
    snapshot: window.__f02LabSnapshot(),
    text: document.querySelector("#stateText").textContent.trim()
  }));
  if (incidence.snapshot.rankB <= 0 || !/incidence matrix|orientation|column/i.test(incidence.text)) {
    throw new Error(`F02 incidence diagnostics are weak: ${JSON.stringify(incidence)}.`);
  }

  await page.selectOption("#graphSelect", "Cycle");
  await page.selectOption("#matrixSelect", "A2");
  await page.selectOption("#viewSelect", "walks");
  await setRange(page, "#weightSlider", "1.5");
  await page.waitForFunction(() => window.__f02LabSnapshot().graph === "Cycle" && window.__f02LabSnapshot().matrix === "A2");
  const walks = await page.evaluate(() => ({
    snapshot: window.__f02LabSnapshot(),
    text: document.querySelector("#stateText").textContent.trim()
  }));
  if (walks.snapshot.beta1 < 1 || walks.snapshot.traceA2 <= 0) {
    throw new Error(`F02 walk/cycle diagnostics are weak: ${JSON.stringify(walks)}.`);
  }
  if (!/two-step walks|trace\\(A\\^2\\)|closed/i.test(walks.text)) {
    throw new Error(`F02 two-step walk state text is weak: ${walks.text}`);
  }

  const beforeToggle = await page.evaluate(() => window.__f02LabSnapshot().edgeCount);
  await page.locator("#toggleEdge").click();
  await page.waitForFunction((previous) => window.__f02LabSnapshot().edgeCount !== previous, beforeToggle);

  await page.setViewportSize({ width: 900, height: 700 });
  await assertNoDedicatedScrollbars(page, "narrow iframe");

  await browser.close();
  console.log("f02 smoke passed: 3D graph matrix lab renders, orbits, updates incidence/walk matrices, toggles edges, and fits iframe.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
