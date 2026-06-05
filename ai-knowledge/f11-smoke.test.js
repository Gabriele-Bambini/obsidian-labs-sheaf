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
  const labPath = path.join(__dirname, "f11-discrete-calculus-lab.html").replace(/\\/g, "/");

  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
  await page.waitForFunction(() => window.__f11LabReady === true && window.__f11LabSnapshot());
  await page.waitForTimeout(180);

  const initial = await page.evaluate(() => ({
    bytes: document.querySelector(".lab-viewport canvas").toDataURL("image/png").length,
    snapshot: window.__f11LabSnapshot(),
    text: document.querySelector("#state").textContent.trim()
  }));
  if (initial.bytes < 9000) throw new Error(`F11 canvas appears blank; png payload only ${initial.bytes} bytes.`);
  if (initial.snapshot.has3d !== true || initial.snapshot.edgeCount < 4 || initial.snapshot.mode !== "gradient") {
    throw new Error(`F11 lab did not expose useful 3D discrete-calculus state: ${JSON.stringify(initial.snapshot)}.`);
  }
  if (!/gradient|curl|boundary/i.test(initial.text)) {
    throw new Error(`Initial F11 explanation is weak: ${initial.text}`);
  }
  await assertNoDedicatedScrollbars(page, "desktop iframe");

  const beforeOrbit = await page.evaluate(() => window.__f11LabSnapshot().cameraTheta);
  const canvasBox = await page.locator(".lab-viewport canvas").boundingBox();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.34, canvasBox.y + canvasBox.height * 0.58);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.70, canvasBox.y + canvasBox.height * 0.28, { steps: 8 });
  await page.mouse.up();
  const afterOrbit = await page.evaluate(() => window.__f11LabSnapshot().cameraTheta);
  if (Math.abs(afterOrbit - beforeOrbit) < 0.05) {
    throw new Error("Dragging the canvas did not orbit the 3D discrete-calculus scene.");
  }

  await page.locator("#toggleCurl").click();
  await page.waitForFunction(() => window.__f11LabSnapshot().mode === "cycle");
  const cycle = await page.evaluate(() => ({
    snapshot: window.__f11LabSnapshot(),
    curlText: document.querySelector("#curlLabel").textContent.trim(),
    text: document.querySelector("#state").textContent.trim()
  }));
  if (!cycle.curlText.includes(".") || cycle.snapshot.maxCurl <= 0 || !/cycle|curl|circulation/i.test(cycle.text)) {
    throw new Error(`F11 cycle diagnostics are weak: ${JSON.stringify(cycle)}.`);
  }

  await page.selectOption("#topology", "squareHole");
  await page.locator("#toggleCurl").click();
  await page.waitForFunction(() => window.__f11LabSnapshot().topology === "squareHole" && window.__f11LabSnapshot().mode === "cycle");
  const hole = await page.evaluate(() => ({
    snapshot: window.__f11LabSnapshot(),
    text: document.querySelector("#state").textContent.trim()
  }));
  if (hole.snapshot.faceCount !== 0 || hole.snapshot.residue <= 0 || !/harmonic|residue|loop/i.test(hole.text)) {
    throw new Error(`F11 square-hole residue diagnostics are weak: ${JSON.stringify(hole)}.`);
  }

  await page.locator("#mixFlow").click();
  await page.selectOption("#viewSelect", "hodge");
  await page.waitForFunction(() => window.__f11LabSnapshot().mode === "mixed" && window.__f11LabSnapshot().view === "hodge");
  const mixed = await page.evaluate(() => ({
    snapshot: window.__f11LabSnapshot(),
    bytes: document.querySelector(".lab-viewport canvas").toDataURL("image/png").length,
    text: document.querySelector("#state").textContent.trim()
  }));
  if (mixed.bytes < 9000 || mixed.snapshot.energy <= 0 || !/gradient|circulation|residue/i.test(mixed.text)) {
    throw new Error(`F11 mixed/Hodge diagnostics are weak: ${JSON.stringify(mixed)}.`);
  }

  await page.locator("#projectHarmonic").click();
  await page.waitForFunction(() => window.__f11LabSnapshot().mode === "harmonic");
  const harmonic = await page.evaluate(() => window.__f11LabSnapshot());
  if (!["residue", "curl", "exact"].includes(harmonic.hodgeState)) {
    throw new Error(`F11 harmonic projection did not update hodge state: ${JSON.stringify(harmonic)}.`);
  }

  await page.setViewportSize({ width: 900, height: 700 });
  await assertNoDedicatedScrollbars(page, "narrow iframe");

  await browser.close();
  console.log("f11 smoke passed: 3D discrete-calculus lab renders, orbits, separates gradient/curl/residue, and fits iframe.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
