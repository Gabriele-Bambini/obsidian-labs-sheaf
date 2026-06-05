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
  const labPath = path.join(__dirname, "h09-connection-laplacian-transport-lab.html").replace(/\\/g, "/");

  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
  await page.waitForFunction(() => window.__h09LabReady === true && window.__h09LabSnapshot());
  await page.waitForTimeout(180);

  const initial = await page.evaluate(() => {
    const canvas = document.querySelector(".lab-viewport canvas");
    return {
      imageBytes: canvas.toDataURL("image/png").length,
      snapshot: window.__h09LabSnapshot(),
      stateText: document.querySelector("#stateBox").textContent.trim()
    };
  });
  if (initial.imageBytes < 9000) throw new Error(`H09 lab canvas appears blank; png payload only ${initial.imageBytes} bytes.`);
  if (
    initial.snapshot.kind !== "connection-laplacian-transport" ||
    initial.snapshot.visualKind !== "connection-laplacian-holonomy-loop" ||
    initial.snapshot.localFrameCount !== 4 ||
    initial.snapshot.transportMatrixCount !== 4 ||
    initial.snapshot.vectorArrowCount < 5 ||
    initial.snapshot.blockMatrixCount < 16 ||
    !(initial.snapshot.orthogonalityError <= 0.04) ||
    Math.abs(initial.snapshot.vectorNorm - 1) > 0.04
  ) {
    throw new Error(`H09 lab did not expose a concrete connection Laplacian object: ${JSON.stringify(initial.snapshot)}.`);
  }
  if (!/local frames|parallel transport|holonomy|connection-Laplacian/i.test(initial.stateText)) {
    throw new Error(`Initial H09 state text is weak: ${initial.stateText}`);
  }
  await assertNoDedicatedScrollbars(page, "desktop iframe");

  const beforeOrbit = await page.evaluate(() => window.__h09LabSnapshot().cameraTheta);
  const canvasBox = await page.locator(".lab-viewport canvas").boundingBox();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.42, canvasBox.y + canvasBox.height * 0.58);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.72, canvasBox.y + canvasBox.height * 0.34, { steps: 8 });
  await page.mouse.up();
  const afterOrbit = await page.evaluate(() => window.__h09LabSnapshot().cameraTheta);
  if (Math.abs(afterOrbit - beforeOrbit) < 0.05) {
    throw new Error("Dragging the canvas did not orbit the concrete connection Laplacian visualization.");
  }

  await page.locator("#preset").selectOption("curved");
  await page.locator("#view").selectOption("transport");
  await setRange(page, "#loopTraversals", "4");
  await setRange(page, "#rotationScale", "1.25");
  await setRange(page, "#frameNoise", "0.22");
  await setRange(page, "#visibleTransports", "4");
  await setRange(page, "#normLock", "0.82");
  const configured = await page.evaluate(() => ({
    snapshot: window.__h09LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (configured.snapshot.preset !== "curved" || configured.snapshot.visibleTransportCount !== 4 || configured.snapshot.rotationScale < 1.2) {
    throw new Error(`H09 controls did not update connection telemetry: ${JSON.stringify(configured)}.`);
  }
  if (!configured.text.includes("curved") || !configured.text.includes("orthogonal")) {
    throw new Error(`H09 connection readout is weak after controls: ${configured.text}`);
  }

  await page.locator("#transportVector").click();
  await page.waitForFunction(() => window.__h09LabSnapshot().status === "Transported" && window.__h09LabSnapshot().transportCursor === 1);
  const transported = await page.evaluate(() => ({
    snapshot: window.__h09LabSnapshot(),
    normLabel: document.querySelector("#normLabel").textContent.trim(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (Math.abs(Number(transported.normLabel) - 1) > 0.04 || !transported.text.includes("preserved vector norm")) {
    throw new Error(`Transport did not preserve orthogonal norm diagnostics: ${JSON.stringify(transported)}.`);
  }

  await page.locator("#runLoop").click();
  await page.waitForFunction(() => window.__h09LabSnapshot().status === "Loop holonomy" && Math.abs(window.__h09LabSnapshot().holonomyAngle) > 10);
  const loop = await page.evaluate(() => ({
    snapshot: window.__h09LabSnapshot(),
    twist: document.querySelector("#twistLabel").textContent.trim(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!loop.text.includes("holonomy") || Math.abs(loop.snapshot.transportedAngle) < 10) {
    throw new Error(`Full loop did not expose nonzero holonomy: ${JSON.stringify(loop)}.`);
  }

  const beforeEnergy = loop.snapshot.energy;
  await page.locator("#diffuse").click();
  await page.waitForFunction((previous) => window.__h09LabSnapshot().status === "Diffused" && window.__h09LabSnapshot().energy < previous, beforeEnergy);
  const diffused = await page.evaluate(() => ({
    snapshot: window.__h09LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!diffused.text.includes("connection-Laplacian") || diffused.snapshot.energy >= beforeEnergy) {
    throw new Error(`Connection diffusion did not lower transported energy: ${JSON.stringify(diffused)}.`);
  }

  const beforeGaugeEnergy = diffused.snapshot.energy;
  await page.locator("#gaugeShift").click();
  await page.waitForFunction(() => window.__h09LabSnapshot().status === "Gauge shifted");
  const gauge = await page.evaluate(() => ({
    snapshot: window.__h09LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!gauge.text.includes("gauge") || Math.abs(gauge.snapshot.energy - beforeGaugeEnergy) > 0.08) {
    throw new Error(`Gauge action did not preserve connection energy under local frame change: ${JSON.stringify(gauge)}.`);
  }

  await page.locator("#preset").selectOption("flat");
  await page.waitForFunction(() => Math.abs(window.__h09LabSnapshot().holonomyAngle) < 1);
  const flat = await page.evaluate(() => ({
    snapshot: window.__h09LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!flat.text.includes("flat") || Math.abs(flat.snapshot.holonomyAngle) > 1) {
    throw new Error(`Flat preset did not remove loop holonomy: ${JSON.stringify(flat)}.`);
  }

  await page.setViewportSize({ width: 900, height: 700 });
  await assertNoDedicatedScrollbars(page, "narrow iframe");

  await browser.close();
  console.log("h09 smoke passed: concrete connection Laplacian renders local frames, SO(2) transports, holonomy loop, matrix blocks, diffusion, gauge action, orbit, and fitted iframe.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
