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
  const labPath = path.join(__dirname, "f12-graphon-sampling-lab.html").replace(/\\/g, "/");

  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
  await page.waitForFunction(() => window.__f12LabReady === true && window.__f12LabSnapshot());
  await page.waitForTimeout(180);

  const initial = await page.evaluate(() => ({
    bytes: document.querySelector(".lab-viewport canvas").toDataURL("image/png").length,
    snapshot: window.__f12LabSnapshot(),
    text: document.querySelector("#state").textContent.trim()
  }));
  if (initial.bytes < 16000) throw new Error(`F12 canvas appears weak or blank; png payload only ${initial.bytes} bytes.`);
  if (initial.snapshot.has3d !== true || initial.snapshot.nodeCount < 12 || initial.snapshot.surfaceCells < 20) {
    throw new Error(`F12 lab did not expose useful graphon state: ${JSON.stringify(initial.snapshot)}.`);
  }
  if (!/graphon|surface|finite|draw/i.test(initial.text)) {
    throw new Error(`Initial F12 explanation is weak: ${initial.text}`);
  }
  await assertNoDedicatedScrollbars(page, "desktop iframe");

  const beforeOrbit = await page.evaluate(() => window.__f12LabSnapshot().cameraTheta);
  const canvasBox = await page.locator(".lab-viewport canvas").boundingBox();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.32, canvasBox.y + canvasBox.height * 0.60);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.72, canvasBox.y + canvasBox.height * 0.28, { steps: 8 });
  await page.mouse.up();
  const afterOrbit = await page.evaluate(() => window.__f12LabSnapshot().cameraTheta);
  if (Math.abs(afterOrbit - beforeOrbit) < 0.05) {
    throw new Error("Dragging the F12 canvas did not orbit the graphon scene.");
  }

  await page.locator("#compareDraws").click();
  await page.waitForFunction(() => window.__f12LabSnapshot().showSecond === true);
  const second = await page.evaluate(() => ({
    snapshot: window.__f12LabSnapshot(),
    text: document.querySelector("#state").textContent.trim()
  }));
  if (second.snapshot.secondDifference <= 0 || !/second|same latent|noisy/i.test(second.text)) {
    throw new Error(`F12 two-draw diagnostics are weak: ${JSON.stringify(second)}.`);
  }

  await page.locator("#sortLatent").click();
  await page.waitForFunction(() => window.__f12LabSnapshot().sorted === false);
  const shuffled = await page.evaluate(() => ({
    snapshot: window.__f12LabSnapshot(),
    orderText: document.querySelector("#orderLabel").textContent.trim(),
    text: document.querySelector("#state").textContent.trim()
  }));
  if (shuffled.orderText !== "shuffled" || !/shuffled|matrix|latent/i.test(shuffled.text)) {
    throw new Error(`F12 label-shuffle diagnostics are weak: ${JSON.stringify(shuffled)}.`);
  }

  await page.selectOption("#graphon", "band");
  await page.selectOption("#viewSelect", "cut");
  await page.waitForFunction(() => {
    const snap = window.__f12LabSnapshot();
    return snap.family === "band" && snap.view === "cut";
  });
  const cut = await page.evaluate(() => ({
    snapshot: window.__f12LabSnapshot(),
    formula: document.querySelector("#formulaText").textContent.trim(),
    text: document.querySelector("#state").textContent.trim()
  }));
  if (cut.snapshot.contrast <= 0 || !/band|latent distance/i.test(cut.formula) || cut.snapshot.cutGap < 0) {
    throw new Error(`F12 cut/graphon diagnostics are weak: ${JSON.stringify(cut)}.`);
  }

  await page.locator("#alignBlocks").click();
  await page.waitForFunction(() => window.__f12LabSnapshot().sorted === true);
  await page.setViewportSize({ width: 900, height: 700 });
  await assertNoDedicatedScrollbars(page, "narrow iframe");

  await browser.close();
  console.log("f12 smoke passed: 3D graphon lab renders, orbits, resamples, compares draws, and fits iframe.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
