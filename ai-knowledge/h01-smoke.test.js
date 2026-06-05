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
  const labPath = path.join(__dirname, "h01-introduction-sheaf-theory-lab.html").replace(/\\/g, "/");

  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
  await page.waitForFunction(() => window.__h01LabReady === true && window.__h01LabSnapshot());
  await page.waitForTimeout(180);

  const initial = await page.evaluate(() => {
    const canvas = document.querySelector(".lab-viewport canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    return {
      hasWebgl: Boolean(gl),
      imageBytes: canvas.toDataURL("image/png").length,
      snapshot: window.__h01LabSnapshot(),
      stateText: document.querySelector("#stateBox").textContent.trim()
    };
  });
  if (!initial.hasWebgl) throw new Error("H01 lab did not create a WebGL canvas.");
  if (initial.imageBytes < 9000) throw new Error(`H01 lab canvas appears blank; png payload only ${initial.imageBytes} bytes.`);
  if (initial.snapshot.mode !== "cover" || initial.snapshot.overlapCount < 2 || initial.snapshot.coverDefect <= 0) {
    throw new Error(`H01 cover view did not expose local-to-global diagnostics: ${JSON.stringify(initial.snapshot)}.`);
  }
  if (!initial.stateText.includes("restriction") || !initial.stateText.includes("overlap") || !initial.stateText.includes("gluing")) {
    throw new Error(`Cover state text is weak: ${initial.stateText}`);
  }
  await assertNoDedicatedScrollbars(page, "desktop iframe");

  const beforeOrbit = await page.evaluate(() => window.__h01LabSnapshot().cameraTheta);
  const canvasBox = await page.locator(".lab-viewport canvas").boundingBox();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.44, canvasBox.y + canvasBox.height * 0.58);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.72, canvasBox.y + canvasBox.height * 0.34, { steps: 8 });
  await page.mouse.up();
  const afterOrbit = await page.evaluate(() => window.__h01LabSnapshot().cameraTheta);
  if (Math.abs(afterOrbit - beforeOrbit) < 0.05) {
    throw new Error("Dragging the canvas did not orbit the 3D sheaf visualization.");
  }

  const beforeGlue = initial.snapshot.coverDefect;
  await page.locator("#makeCompatible").click();
  await page.waitForFunction((previous) => window.__h01LabSnapshot().coverDefect < previous && window.__h01LabSnapshot().gluePossible === true, beforeGlue);
  const glued = await page.evaluate(() => ({
    snapshot: window.__h01LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (glued.snapshot.coverDefect > 0.05 || !glued.text.includes("global section")) {
    throw new Error(`Make-compatible action did not produce a glued global section: ${JSON.stringify(glued)}.`);
  }

  await page.locator("#mode").selectOption("cellular");
  await page.locator("#restrictionMode").selectOption("signed");
  await setRange(page, "#sectionV", "-0.80");
  await page.waitForFunction(() => window.__h01LabSnapshot().mode === "cellular" && window.__h01LabSnapshot().restrictionMode === "signed");
  const signed = await page.evaluate(() => ({
    snapshot: window.__h01LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!signed.text.includes("stalk") || !signed.text.includes("residual") || signed.snapshot.cellularResidual > 0.35) {
    throw new Error(`Signed cellular sheaf did not show compatible stalk residuals: ${JSON.stringify(signed)}.`);
  }

  await page.locator("#mode").selectOption("laplacian");
  await page.waitForFunction(() => window.__h01LabSnapshot().mode === "laplacian");
  const beforeEnergy = await page.evaluate(() => window.__h01LabSnapshot().sheafEnergy);
  await page.locator("#stepDiffuse").click();
  await page.waitForFunction((previous) => window.__h01LabSnapshot().diffusionStep >= 1 && window.__h01LabSnapshot().sheafEnergy < previous, beforeEnergy);
  const diffused = await page.evaluate(() => ({
    snapshot: window.__h01LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!diffused.text.includes("sheaf Laplacian") || diffused.snapshot.sheafEnergy >= beforeEnergy) {
    throw new Error(`Sheaf Laplacian diffusion did not reduce energy: ${JSON.stringify(diffused)}.`);
  }

  await page.setViewportSize({ width: 900, height: 700 });
  await assertNoDedicatedScrollbars(page, "narrow iframe");

  await browser.close();
  console.log("h01 smoke passed: 3D introductory sheaf lab renders, orbits, checks cover gluing, signed cellular restrictions, Laplacian diffusion, and fits iframe.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
