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
  const labPath = path.join(__dirname, "h14-persistent-sheaf-topology-lab.html").replace(/\\/g, "/");

  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
  await page.waitForFunction(() => window.__h14LabReady === true && window.__h14LabSnapshot());
  await page.waitForTimeout(180);

  const initial = await page.evaluate(() => {
    const canvas = document.querySelector(".lab-viewport canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    return {
      hasWebgl: Boolean(gl),
      imageBytes: canvas.toDataURL("image/png").length,
      snapshot: window.__h14LabSnapshot(),
      text: document.querySelector("#stateBox").textContent.trim()
    };
  });
  if (!initial.hasWebgl) throw new Error("H14 lab did not create a WebGL canvas.");
  if (initial.imageBytes < 9000) throw new Error(`H14 lab canvas appears blank; png payload only ${initial.imageBytes} bytes.`);
  if (
    initial.snapshot.kind !== "persistent-sheaf-filtration" ||
    initial.snapshot.visualKind !== "vietoris-rips-sheaf-barcode" ||
    initial.snapshot.pointCount < 8 ||
    initial.snapshot.stalkColumnCount < 8 ||
    initial.snapshot.restrictionMapCount < 8 ||
    initial.snapshot.ordinaryBarcodeCount < 3 ||
    initial.snapshot.sheafBarcodeCount < 3 ||
    initial.snapshot.defectHeatCount < 8
  ) {
    throw new Error(`H14 lab did not expose concrete persistent-sheaf topology objects: ${JSON.stringify(initial.snapshot)}.`);
  }
  if (!/filtration|point cloud|stalk|ordinary barcode|sheaf/i.test(initial.text)) {
    throw new Error(`Initial H14 state text is weak: ${initial.text}`);
  }
  await assertNoDedicatedScrollbars(page, "desktop iframe");

  for (const selector of ["#scenario", "#restriction", "#view", "#radius", "#defectBias", "#signalNoise", "#barThreshold", "#faceFill"]) {
    if (!(await page.locator(selector).count())) throw new Error(`H14 missing control ${selector}`);
  }
  for (const selector of ["#growFiltration", "#projectSection", "#toggleBarcode", "#showHolonomy", "#resetH14"]) {
    if (!(await page.locator(selector).count())) throw new Error(`H14 missing action ${selector}`);
  }

  const beforeOrbit = await page.evaluate(() => window.__h14LabSnapshot().cameraTheta);
  const canvasBox = await page.locator(".lab-viewport canvas").boundingBox();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.42, canvasBox.y + canvasBox.height * 0.58);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.74, canvasBox.y + canvasBox.height * 0.30, { steps: 8 });
  await page.mouse.up();
  const afterOrbit = await page.evaluate(() => window.__h14LabSnapshot().cameraTheta);
  if (Math.abs(afterOrbit - beforeOrbit) < 0.05) {
    throw new Error("Dragging the canvas did not orbit the 3D persistent sheaf visualization.");
  }

  const beforeGrow = await page.evaluate(() => window.__h14LabSnapshot());
  await page.locator("#growFiltration").click();
  await page.waitForFunction((before) => window.__h14LabSnapshot().activeEdgeCount > before.activeEdgeCount, beforeGrow);
  const grown = await page.evaluate(() => ({
    snapshot: window.__h14LabSnapshot(),
    cells: document.querySelector("#cellsLabel").textContent.trim(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!grown.cells.includes("edges") || !grown.text.includes("radius") || grown.snapshot.activeFaceCount < 1) {
    throw new Error(`Grow action did not add edges/faces with useful text: ${JSON.stringify(grown)}.`);
  }

  await page.locator("#restriction").selectOption("holonomy");
  await page.locator("#view").selectOption("defect");
  await setRange(page, "#defectBias", "0.42");
  await setRange(page, "#signalNoise", "0.34");
  await page.waitForFunction(() => window.__h14LabSnapshot().view === "defect" && window.__h14LabSnapshot().restriction === "holonomy");
  const defect = await page.evaluate(() => window.__h14LabSnapshot());
  if (defect.totalDefect <= 0.15 || defect.holonomyDefect <= 0.1 || defect.sheafH0Dimension < 0) {
    throw new Error(`Defect view did not expose sheaf obstruction metrics: ${JSON.stringify(defect)}.`);
  }

  const beforeProject = await page.evaluate(() => window.__h14LabSnapshot());
  await page.locator("#projectSection").click();
  await page.waitForFunction((before) => window.__h14LabSnapshot().projectionCount > before.projectionCount && window.__h14LabSnapshot().totalDefect < before.totalDefect, beforeProject);
  const projected = await page.evaluate(() => ({
    snapshot: window.__h14LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!/global section|compatibility|delta/i.test(projected.text)) {
    throw new Error(`Projection action did not explain sheaf consistency: ${JSON.stringify(projected)}.`);
  }

  await page.locator("#toggleBarcode").click();
  await page.waitForFunction(() => window.__h14LabSnapshot().view === "barcode");
  const barcode = await page.evaluate(() => ({
    snapshot: window.__h14LabSnapshot(),
    label: document.querySelector("#bettiLabel").textContent.trim(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!barcode.label.includes("b0=") || !barcode.label.includes("b1=") || !barcode.text.includes("sheaf barcode")) {
    throw new Error(`Barcode/topology metrics are missing: ${JSON.stringify(barcode)}.`);
  }

  await page.locator("#showHolonomy").click();
  await page.waitForFunction(() => window.__h14LabSnapshot().status === "Holonomy obstruction");
  const holonomy = await page.evaluate(() => ({
    snapshot: window.__h14LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!holonomy.text.includes("loop") || !holonomy.text.includes("obstruction") || holonomy.snapshot.holonomyDefect <= 0.2) {
    throw new Error(`Holonomy action did not show persistent loop obstruction: ${JSON.stringify(holonomy)}.`);
  }

  await page.setViewportSize({ width: 900, height: 700 });
  await assertNoDedicatedScrollbars(page, "narrow iframe");

  await browser.close();
  console.log("h14 smoke passed: concrete persistent sheaf lab renders point-cloud filtration, stalks, restrictions, barcodes, defects, holonomy, orbit, and fitted iframe.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
