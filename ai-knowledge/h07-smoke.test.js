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
  const labPath = path.join(__dirname, "h07-sheaf-neural-networks-lab.html").replace(/\\/g, "/");

  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
  await page.waitForFunction(() => window.__h07LabReady === true && window.__h07LabSnapshot());
  await page.waitForTimeout(180);

  const initial = await page.evaluate(() => {
    const canvas = document.querySelector(".lab-viewport canvas");
    return {
      bytes: canvas.toDataURL("image/png").length,
      snapshot: window.__h07LabSnapshot(),
      stateText: document.querySelector("#stateBox").textContent.trim()
    };
  });
  if (initial.bytes < 9000) throw new Error(`H07 lab canvas appears blank; png payload only ${initial.bytes} bytes.`);
  if (
    initial.snapshot.kind !== "sheaf-neural-network-architecture" ||
    initial.snapshot.visualKind !== "snn-layer-restriction-message-architecture" ||
    initial.snapshot.nodeFeatureTowerCount < 4 ||
    initial.snapshot.restrictionMapCount < 6 ||
    initial.snapshot.edgeStalkChamberCount < 3 ||
    initial.snapshot.messageArrowCount < 6
  ) {
    throw new Error(`H07 lab did not expose a concrete SNN architecture: ${JSON.stringify(initial.snapshot)}.`);
  }
  if (!/restriction predictor|edge-stalk|transported message|aggregation/i.test(initial.stateText)) {
    throw new Error(`Initial H07 state text is weak: ${initial.stateText}`);
  }
  await assertNoDedicatedScrollbars(page, "desktop iframe");

  const beforeOrbit = await page.evaluate(() => window.__h07LabSnapshot().cameraTheta);
  const canvasBox = await page.locator(".lab-viewport canvas").boundingBox();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.42, canvasBox.y + canvasBox.height * 0.58);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.72, canvasBox.y + canvasBox.height * 0.34, { steps: 8 });
  await page.mouse.up();
  const afterOrbit = await page.evaluate(() => window.__h07LabSnapshot().cameraTheta);
  if (Math.abs(afterOrbit - beforeOrbit) < 0.05) {
    throw new Error("Dragging the canvas did not orbit the concrete SNN architecture.");
  }

  await page.locator("#mode").selectOption("restrictions");
  await page.locator("#mapFamily").selectOption("orthogonal");
  await setRange(page, "#layerDepth", "6");
  await setRange(page, "#relationSharpness", "1.5");
  await setRange(page, "#relationNoise", "0.22");
  await setRange(page, "#neighborBudget", "5");
  await setRange(page, "#selfWeight", "0.64");
  const configured = await page.evaluate(() => ({
    snapshot: window.__h07LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (configured.snapshot.layerDepth !== 6 || configured.snapshot.mapFamily !== "orthogonal" || configured.snapshot.activeNeighborCount !== 5) {
    throw new Error(`H07 parameter controls did not alter architecture telemetry: ${JSON.stringify(configured)}.`);
  }
  if (!configured.text.includes("orthogonal") || !configured.text.includes("restriction")) {
    throw new Error(`H07 restriction-family readout is weak: ${configured.text}`);
  }

  const beforeLearn = configured.snapshot.sheafEnergy;
  await page.locator("#learnMaps").click();
  await page.waitForFunction(
    (previous) => window.__h07LabSnapshot().status === "Maps learned" && window.__h07LabSnapshot().mapAgreement > 0.82 && window.__h07LabSnapshot().sheafEnergy < previous,
    beforeLearn
  );
  const learned = await page.evaluate(() => ({
    snapshot: window.__h07LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!learned.text.includes("learned restriction maps") || learned.snapshot.mapAgreement < 0.82) {
    throw new Error(`Learning restrictions did not align SNN maps: ${JSON.stringify(learned)}.`);
  }

  await page.locator("#passMessage").click();
  await page.waitForFunction(() => window.__h07LabSnapshot().status === "Message passed" && window.__h07LabSnapshot().messageQuality > 0.72);
  const passed = await page.evaluate(() => ({
    snapshot: window.__h07LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!passed.text.includes("B_v^T B_u h_u") || !passed.text.includes("aggregation")) {
    throw new Error(`SNN message pass did not show transported message mechanics: ${JSON.stringify(passed)}.`);
  }

  await page.locator("#mode").selectOption("oversmoothing");
  await page.locator("#comparison").selectOption("graph");
  await page.locator("#stepLayer").click();
  await page.waitForFunction(() => window.__h07LabSnapshot().status === "Layer stepped" && window.__h07LabSnapshot().comparison === "graph");
  const graphStep = await page.evaluate(() => ({
    snapshot: window.__h07LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!graphStep.text.includes("over-smoothing") || graphStep.snapshot.oversmoothing <= passed.snapshot.oversmoothing) {
    throw new Error(`Graph comparison did not show stronger over-smoothing than SNN transport: ${JSON.stringify(graphStep)}.`);
  }

  await page.setViewportSize({ width: 900, height: 700 });
  await assertNoDedicatedScrollbars(page, "narrow iframe");

  await browser.close();
  console.log("h07 smoke passed: concrete SNN architecture renders restriction predictor, messages, learning, oversmoothing comparison, orbit, and fitted iframe.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
