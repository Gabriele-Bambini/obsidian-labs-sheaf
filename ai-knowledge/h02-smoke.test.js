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
  const labPath = path.join(__dirname, "h02-sheaf-gluing-lab.html").replace(/\\/g, "/");

  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
  await page.waitForFunction(() => window.__h02LabReady === true && window.__h02LabSnapshot());
  await page.waitForTimeout(180);

  const initial = await page.evaluate(() => {
    const canvas = document.querySelector(".lab-viewport canvas");
    return {
      bytes: canvas.toDataURL("image/png").length,
      snapshot: window.__h02LabSnapshot(),
      stateText: document.querySelector("#stateBox").textContent.trim(),
      rangeCount: document.querySelectorAll('input[type="range"]').length,
      actionCount: document.querySelectorAll("[data-action]").length
    };
  });
  if (initial.bytes < 10000) throw new Error(`H02 lab canvas appears blank; png payload only ${initial.bytes} bytes.`);
  if (initial.rangeCount < 5 || initial.actionCount < 5) throw new Error(`H02 controls are incomplete: ${JSON.stringify(initial)}`);
  if (
    initial.snapshot.kind !== "topological-sheaf-open-cover" ||
    initial.snapshot.visualKind !== "open-cover-sections-germs" ||
    initial.snapshot.patchCount < 3 ||
    initial.snapshot.overlapCount < 3 ||
    initial.snapshot.stalkCount < 3 ||
    initial.snapshot.germCount < 3 ||
    initial.snapshot.has3d !== true
  ) {
    throw new Error(`H02 lab did not render the concrete open-cover sheaf object: ${JSON.stringify(initial.snapshot)}.`);
  }
  if (!/open cover|local sections|restriction|overlap|gluing/i.test(initial.stateText)) {
    throw new Error(`Initial H02 state text is weak: ${initial.stateText}`);
  }
  await assertNoDedicatedScrollbars(page, "desktop iframe");

  const beforeOrbit = await page.evaluate(() => window.__h02LabSnapshot().cameraTheta);
  const canvasBox = await page.locator(".lab-viewport canvas").boundingBox();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.45, canvasBox.y + canvasBox.height * 0.55);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.72, canvasBox.y + canvasBox.height * 0.36, { steps: 8 });
  await page.mouse.up();
  const afterOrbit = await page.evaluate(() => window.__h02LabSnapshot().cameraTheta);
  if (Math.abs(afterOrbit - beforeOrbit) < 0.05) {
    throw new Error("Dragging the canvas did not orbit the 3D open-cover visualization.");
  }

  await page.selectOption("#coverMode", "three");
  await page.selectOption("#restrictionMode", "chart");
  await setRange(page, "#uValue", "0.42");
  await setRange(page, "#vValue", "-0.58");
  const incompatible = await page.evaluate(() => window.__h02LabSnapshot());
  await page.locator("#matchOverlap").click();
  await page.waitForFunction((before) => window.__h02LabSnapshot().maxDefect < before, incompatible.maxDefect);
  const matched = await page.evaluate(() => ({ snapshot: window.__h02LabSnapshot(), text: document.querySelector("#stateBox").textContent.trim() }));
  if (!/restriction|overlap/i.test(matched.text)) {
    throw new Error(`H02 match-overlap action did not explain restrictions: ${JSON.stringify(matched)}`);
  }

  await page.locator("#testGlue").click();
  await page.locator("#glueSections").click();
  await page.waitForFunction(() => window.__h02LabSnapshot().compatible === true && window.__h02LabSnapshot().globalExists === true);
  const glued = await page.evaluate(() => ({
    snapshot: window.__h02LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim(),
    global: document.querySelector("#globalLabel").textContent.trim()
  }));
  if (!/exists/i.test(glued.global) || !/unique global section|locality/i.test(glued.text)) {
    throw new Error(`Gluing action did not expose a compatible unique global section: ${JSON.stringify(glued)}`);
  }

  await page.locator("#makeConflict").click();
  await page.waitForFunction(() => window.__h02LabSnapshot().compatible === false && window.__h02LabSnapshot().maxDefect > window.__h02LabSnapshot().tolerance);
  const conflict = await page.evaluate(() => ({
    snapshot: window.__h02LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim(),
    defect: document.querySelector("#defectLabel").textContent.trim()
  }));
  if (!/obstruction|presheaf/i.test(conflict.text) || conflict.snapshot.maxDefect <= conflict.snapshot.tolerance) {
    throw new Error(`Conflict mode did not expose a gluing obstruction: ${JSON.stringify(conflict)}`);
  }

  await page.locator("#sheafify").click();
  await page.waitForFunction(() => window.__h02LabSnapshot().mode === "sheafified");
  const sheafified = await page.evaluate(() => ({
    snapshot: window.__h02LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!/germs|local-to-global|sheafification/i.test(sheafified.text) || sheafified.snapshot.germCount < initial.snapshot.germCount) {
    throw new Error(`Sheafification state is not concrete: ${JSON.stringify(sheafified)}`);
  }

  await page.setViewportSize({ width: 900, height: 700 });
  await assertNoDedicatedScrollbars(page, "narrow iframe");

  await browser.close();
  console.log("h02 smoke passed: open-cover sheaf lab renders concrete patches, sections, germs, gluing, obstruction, sheafification, orbit, and iframe fit.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
