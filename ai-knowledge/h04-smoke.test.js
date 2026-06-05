const path = require("path");

function loadPlaywright() {
  const candidates = [
    "playwright",
    "C:/Users/02gab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright",
    "C:/Users/02gab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
    "C:/Users/Gabriele/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright",
    "C:/Users/Gabriele/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"
  ];
  let lastError = null;
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

const { chromium } = loadPlaywright();

async function assertNoDedicatedScrollbars(page, viewportName) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const elements = [...document.querySelectorAll(".lab-3d-shell, .stage, .controls, .lab-viewport")];
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
  const labPath = path.join(__dirname, "h04-cellular-sheaf-on-graph-lab.html").replace(/\\/g, "/");

  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
  await page.waitForFunction(() => window.__h04LabReady === true && window.__h04LabSnapshot());
  await page.waitForTimeout(180);

  const initial = await page.evaluate(() => {
    const canvas = document.querySelector(".lab-viewport canvas");
    return {
      bytes: canvas.toDataURL("image/png").length,
      snapshot: window.__h04LabSnapshot(),
      stateText: document.querySelector("#stateBox").textContent.trim(),
      rangeCount: document.querySelectorAll('input[type="range"]').length,
      actionCount: document.querySelectorAll("[data-action]").length
    };
  });
  if (initial.bytes < 10000) throw new Error(`H04 lab canvas appears blank; png payload only ${initial.bytes} bytes.`);
  if (initial.rangeCount < 5 || initial.actionCount < 4) throw new Error(`H04 controls are incomplete: ${JSON.stringify(initial)}`);
  if (
    initial.snapshot.kind !== "cellular-sheaf-graph-coboundary" ||
    initial.snapshot.visualKind !== "graph-stalk-restriction-coboundary" ||
    initial.snapshot.nodeCount !== 4 ||
    initial.snapshot.edgeCount !== 5 ||
    initial.snapshot.nodeStalkCount !== 4 ||
    initial.snapshot.edgeStalkCount !== 5 ||
    initial.snapshot.restrictionMapCount < 10 ||
    initial.snapshot.coboundaryRows !== 5 ||
    initial.snapshot.has3d !== true
  ) {
    throw new Error(`H04 lab did not expose the concrete cellular graph-sheaf object: ${JSON.stringify(initial.snapshot)}.`);
  }
  if (!/node stalk|edge stalk|restriction maps|coboundary|residual/i.test(initial.stateText)) {
    throw new Error(`Initial H04 state text is weak: ${initial.stateText}`);
  }
  await assertNoDedicatedScrollbars(page, "desktop iframe");

  const beforeOrbit = await page.evaluate(() => window.__h04LabSnapshot().cameraTheta);
  const canvasBox = await page.locator(".lab-viewport canvas").boundingBox();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.38, canvasBox.y + canvasBox.height * 0.58);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.71, canvasBox.y + canvasBox.height * 0.34, { steps: 8 });
  await page.mouse.up();
  const afterOrbit = await page.evaluate(() => window.__h04LabSnapshot().cameraTheta);
  if (Math.abs(afterOrbit - beforeOrbit) < 0.05) {
    throw new Error("Dragging the canvas did not orbit the 3D cellular sheaf graph.");
  }

  await page.selectOption("#sheafType", "signed");
  await page.selectOption("#viewSelect", "matrix");
  await setRange(page, "#twist", "0.82");
  await setRange(page, "#inconsistency", "0.74");
  await page.locator("#computeCoboundary").click();
  await page.waitForFunction(() => window.__h04LabSnapshot().status === "Coboundary");
  const coboundary = await page.evaluate(() => ({
    snapshot: window.__h04LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!/delta x|coboundary matrix|edge-stalk residuals/i.test(coboundary.text) || coboundary.snapshot.energy <= 0) {
    throw new Error(`H04 coboundary action is not concrete: ${JSON.stringify(coboundary)}`);
  }

  const beforeHarmonize = coboundary.snapshot.energy;
  await page.locator("#harmonize").click();
  await page.waitForFunction((previous) => window.__h04LabSnapshot().status === "Projected" && window.__h04LabSnapshot().energy < previous, beforeHarmonize);
  const projected = await page.evaluate(() => ({
    snapshot: window.__h04LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim(),
    metric: document.querySelector("#energyLabel").textContent.trim()
  }));
  if (!/harmonization|global section|edge-stalk residuals/i.test(projected.text)) {
    throw new Error(`Projected H04 state text is weak: ${projected.text}`);
  }

  await page.locator("#globalSection").click();
  await page.waitForFunction(() => window.__h04LabSnapshot().status === "Section");
  const section = await page.evaluate(() => ({
    snapshot: window.__h04LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim(),
    compatible: document.querySelector("#compatibleLabel").textContent.trim()
  }));
  if (!/global section|kernel of delta/i.test(section.text) || section.snapshot.compatibleEdges < 5) {
    throw new Error(`Section action did not expose a useful global-section diagnostic: ${JSON.stringify(section)}`);
  }

  await page.selectOption("#sheafType", "projection");
  await setRange(page, "#projection", "0.35");
  await page.locator("#computeCoboundary").click();
  await page.waitForFunction(() => window.__h04LabSnapshot().sheafType === "projection");
  const projection = await page.evaluate(() => ({
    snapshot: window.__h04LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!/projection|visible coordinate|edge stalk/i.test(projection.text) || projection.snapshot.edgeProjection >= 0.5) {
    throw new Error(`Projection sheaf view did not expose coordinate selection: ${JSON.stringify(projection)}`);
  }

  await page.setViewportSize({ width: 900, height: 700 });
  await assertNoDedicatedScrollbars(page, "narrow iframe");

  await browser.close();
  console.log("h04 smoke passed: cellular sheaf graph renders concrete stalks, restrictions, coboundary, energy, global sections, projection maps, orbit, and iframe fit.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
