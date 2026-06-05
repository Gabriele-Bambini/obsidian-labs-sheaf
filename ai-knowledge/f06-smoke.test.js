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
  const labPath = path.join(__dirname, "f06-random-graph-models-lab.html").replace(/\\/g, "/");

  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
  await page.waitForFunction(() => window.__f06LabReady === true && window.__f06LabSnapshot());
  await page.waitForTimeout(180);

  const initial = await page.evaluate(() => {
    const canvas = document.querySelector(".lab-viewport canvas");
    return {
      bytes: canvas.toDataURL("image/png").length,
      snapshot: window.__f06LabSnapshot(),
      stateText: document.querySelector("#stateText").textContent.trim()
    };
  });
  if (initial.bytes < 9000) throw new Error(`F06 lab canvas appears blank; png payload only ${initial.bytes} bytes.`);
  if (initial.snapshot.nodes !== 30 || initial.snapshot.edges <= 0 || initial.snapshot.has3d !== true) {
    throw new Error(`F06 lab did not expose useful 3D random-graph state: ${JSON.stringify(initial.snapshot)}.`);
  }
  if (!/Erdos-Renyi|independent edge|giant component/i.test(initial.stateText)) {
    throw new Error(`Initial F06 diagnostics are weak: ${initial.stateText}`);
  }
  await assertNoDedicatedScrollbars(page, "desktop iframe");

  const beforeOrbit = await page.evaluate(() => window.__f06LabSnapshot().cameraTheta);
  const canvasBox = await page.locator(".lab-viewport canvas").boundingBox();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.35, canvasBox.y + canvasBox.height * 0.58);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.70, canvasBox.y + canvasBox.height * 0.32, { steps: 8 });
  await page.mouse.up();
  const afterOrbit = await page.evaluate(() => window.__f06LabSnapshot().cameraTheta);
  if (Math.abs(afterOrbit - beforeOrbit) < 0.05) {
    throw new Error("Dragging the canvas did not orbit the 3D random graph visualization.");
  }

  await page.locator("#switchModel").click();
  await page.waitForFunction(() => window.__f06LabSnapshot().label === "BA");
  const ba = await page.evaluate(() => ({
    snapshot: window.__f06LabSnapshot(),
    label: document.querySelector("#modelLabel").textContent.trim(),
    text: document.querySelector("#stateText").textContent.trim()
  }));
  if (ba.label !== "BA" || ba.snapshot.hubs < 1 || !/Preferential attachment|High-degree|hubs/i.test(ba.text)) {
    throw new Error(`F06 BA model diagnostics are weak: ${JSON.stringify(ba)}.`);
  }

  await page.selectOption("#model", "sbm");
  await page.selectOption("#viewSelect", "matrix");
  await setRange(page, "#contrast", "0.90");
  await page.waitForFunction(() => window.__f06LabSnapshot().model === "sbm" && window.__f06LabSnapshot().view === "matrix");
  const sbm = await page.evaluate(() => ({
    snapshot: window.__f06LabSnapshot(),
    text: document.querySelector("#stateText").textContent.trim()
  }));
  if (sbm.snapshot.edges <= 0 || sbm.snapshot.closure < 0 || !/block model|communities|matrix/i.test(sbm.text)) {
    throw new Error(`F06 SBM diagnostics are weak: ${JSON.stringify(sbm)}.`);
  }

  await page.locator("#runFive").click();
  await page.waitForFunction(() => window.__f06LabSnapshot().status === "Batch" && window.__f06LabSnapshot().batch.length === 5);
  const batch = await page.evaluate(() => ({
    snapshot: window.__f06LabSnapshot(),
    text: document.querySelector("#stateText").textContent.trim()
  }));
  if (!/Five samples|Repetition|one lucky draw/i.test(batch.text)) {
    throw new Error(`F06 ensemble state text is weak: ${batch.text}`);
  }

  await page.locator("#stressNull").click();
  await page.waitForFunction(() => window.__f06LabSnapshot().status === "Null");
  const nullTest = await page.evaluate(() => document.querySelector("#stateText").textContent.trim());
  if (!/Null-model test|matched density|density artifact/i.test(nullTest)) {
    throw new Error(`F06 null-model state text is weak: ${nullTest}`);
  }

  await page.setViewportSize({ width: 900, height: 700 });
  await assertNoDedicatedScrollbars(page, "narrow iframe");

  await browser.close();
  console.log("f06 smoke passed: 3D random graph lab renders, orbits, switches models, runs ensembles, tests nulls, and fits iframe.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
