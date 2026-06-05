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
  const labPath = path.join(__dirname, "h03-cellular-sheaf-cohomology.html").replace(/\\/g, "/");

  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
  await page.waitForFunction(() => window.__h03LabReady === true && window.__h03LabSnapshot());
  await page.waitForTimeout(180);

  const initial = await page.evaluate(() => {
    const canvas = document.querySelector(".lab-viewport canvas");
    return {
      bytes: canvas.toDataURL("image/png").length,
      snapshot: window.__h03LabSnapshot(),
      stateText: document.querySelector("#stateBox").textContent.trim(),
      rangeCount: document.querySelectorAll('input[type="range"]').length,
      actionCount: document.querySelectorAll("[data-action]").length
    };
  });
  if (initial.bytes < 10000) throw new Error(`H03 lab canvas appears blank; png payload only ${initial.bytes} bytes.`);
  if (initial.rangeCount < 5 || initial.actionCount < 4) throw new Error(`H03 controls are incomplete: ${JSON.stringify(initial)}`);
  if (
    initial.snapshot.kind !== "cellular-sheaf-cochain-complex" ||
    initial.snapshot.visualKind !== "triangular-cell-complex-cohomology" ||
    initial.snapshot.vertexCount !== 3 ||
    initial.snapshot.edgeCount !== 3 ||
    initial.snapshot.faceCount !== 1 ||
    initial.snapshot.zeroCochainCount !== 3 ||
    initial.snapshot.oneCochainCount !== 3 ||
    initial.snapshot.twoCochainCount !== 1 ||
    initial.snapshot.restrictionMapCount < 6 ||
    initial.snapshot.coboundary0Rows !== 3 ||
    initial.snapshot.coboundary1Rows !== 1 ||
    initial.snapshot.has3d !== true
  ) {
    throw new Error(`H03 did not render a concrete triangular cochain complex: ${JSON.stringify(initial.snapshot)}.`);
  }
  if (!/0-cochain|1-cochain|2-cochain|delta0|delta1|face/i.test(initial.stateText)) {
    throw new Error(`Initial H03 state text is weak: ${initial.stateText}`);
  }
  await assertNoDedicatedScrollbars(page, "desktop iframe");

  const beforeOrbit = await page.evaluate(() => window.__h03LabSnapshot().cameraTheta);
  const canvasBox = await page.locator(".lab-viewport canvas").boundingBox();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.42, canvasBox.y + canvasBox.height * 0.58);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.73, canvasBox.y + canvasBox.height * 0.32, { steps: 8 });
  await page.mouse.up();
  const afterOrbit = await page.evaluate(() => window.__h03LabSnapshot().cameraTheta);
  if (Math.abs(afterOrbit - beforeOrbit) < 0.05) throw new Error("Dragging the canvas did not orbit the triangular cochain complex.");

  await page.selectOption("#ruleMode", "rotated");
  await page.selectOption("#complexMode", "filled");
  await setRange(page, "#vertexSignal", "0.88");
  await setRange(page, "#twist", "0.82");
  await setRange(page, "#faceWeight", "1.25");
  await page.locator("#computeDelta0").click();
  await page.waitForFunction(() => window.__h03LabSnapshot().status === "Coboundary");
  const coboundary = await page.evaluate(() => ({
    snapshot: window.__h03LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!/delta0|edge stalk residuals|coboundary matrix/i.test(coboundary.text) || coboundary.snapshot.coboundaryNorm <= 0) {
    throw new Error(`H03 delta0 action is not concrete: ${JSON.stringify(coboundary)}`);
  }

  const beforeHarmonize = coboundary.snapshot.coboundaryNorm;
  await page.locator("#harmonize").click();
  await page.waitForFunction((previous) => window.__h03LabSnapshot().status === "Projected" && window.__h03LabSnapshot().coboundaryNorm < previous, beforeHarmonize);
  const projected = await page.evaluate(() => ({
    snapshot: window.__h03LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim(),
    status: document.querySelector("#statusLabel").textContent.trim()
  }));
  if (projected.status !== "Projected" || !/Harmonization|ker delta0|global sections/i.test(projected.text)) {
    throw new Error(`H03 harmonization did not project toward global sections: ${JSON.stringify(projected)}`);
  }

  await page.selectOption("#complexMode", "hole");
  await setRange(page, "#circulationDefect", "0.72");
  await page.locator("#showCocycle").click();
  await page.waitForFunction(() => window.__h03LabSnapshot().status === "Cocycle");
  const cocycle = await page.evaluate(() => ({
    snapshot: window.__h03LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim(),
    face: document.querySelector("#faceLabel").textContent.trim()
  }));
  if (cocycle.snapshot.cocycleMagnitude <= 0 || !/1-cochain|H1|face circulation|hole/i.test(cocycle.text)) {
    throw new Error(`H03 cocycle action did not expose H1: ${JSON.stringify(cocycle)}`);
  }

  await page.setViewportSize({ width: 900, height: 700 });
  await assertNoDedicatedScrollbars(page, "narrow iframe");

  await browser.close();
  console.log("h03 smoke passed: triangular cellular sheaf cochain complex renders vertices, edges, face, delta0, delta1, H0/H1 diagnostics, orbit, and iframe fit.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
