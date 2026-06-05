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
  const labPath = path.join(__dirname, "h06-sheaf-diffusion.html").replace(/\\/g, "/");

  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
  await page.waitForFunction(() => window.__h06LabReady === true && window.__h06LabSnapshot());
  await page.waitForTimeout(180);

  const initial = await page.evaluate(() => {
    const canvas = document.querySelector(".lab-viewport canvas");
    return {
      bytes: canvas.toDataURL("image/png").length,
      snapshot: window.__h06LabSnapshot(),
      stateText: document.querySelector("#state").textContent.trim()
    };
  });
  if (initial.bytes < 9000) throw new Error(`H06 lab canvas appears blank; png payload only ${initial.bytes} bytes.`);
  if (
    initial.snapshot.kind !== "sheaf-heat-equation-diffusion" ||
    initial.snapshot.visualKind !== "sheaf-diffusion-heat-spectrum" ||
    initial.snapshot.nodeStalkCount !== 4 ||
    initial.snapshot.edgeResidualCount !== 4 ||
    initial.snapshot.spectralModeCount < 4 ||
    initial.snapshot.heatTracePointCount < 8
  ) {
    throw new Error(`H06 lab did not expose a concrete sheaf heat-equation object: ${JSON.stringify(initial.snapshot)}.`);
  }
  if (!/heat equation|edge residual|global section|spectral damping/i.test(initial.stateText)) {
    throw new Error(`Initial H06 state text is weak: ${initial.stateText}`);
  }
  await assertNoDedicatedScrollbars(page, "desktop iframe");

  const beforeOrbit = await page.evaluate(() => window.__h06LabSnapshot().cameraTheta);
  const canvasBox = await page.locator(".lab-viewport canvas").boundingBox();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.36, canvasBox.y + canvasBox.height * 0.58);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.72, canvasBox.y + canvasBox.height * 0.36, { steps: 8 });
  await page.mouse.up();
  const afterOrbit = await page.evaluate(() => window.__h06LabSnapshot().cameraTheta);
  if (Math.abs(afterOrbit - beforeOrbit) < 0.05) {
    throw new Error("Dragging the canvas did not orbit the concrete sheaf diffusion visualization.");
  }

  await page.locator("#sheafPreset").selectOption("signed");
  await page.locator("#viewSelect").selectOption("spectrum");
  await setRange(page, "#diffusionTime", "7");
  await setRange(page, "#spectralGap", "1.45");
  await setRange(page, "#noiseLevel", "0.36");
  await setRange(page, "#visibleModes", "6");
  await setRange(page, "#harmonicWeight", "0.74");
  const changed = await page.evaluate(() => ({
    snapshot: window.__h06LabSnapshot(),
    text: document.querySelector("#state").textContent.trim()
  }));
  if (changed.snapshot.visibleModeCount !== 6 || changed.snapshot.spectralDamping <= initial.snapshot.spectralDamping) {
    throw new Error(`H06 sliders did not reshape spectrum and heat trace: ${JSON.stringify(changed)}.`);
  }
  if (!changed.text.includes("signed") || !changed.text.includes("spectral")) {
    throw new Error(`H06 control text is not concrete after parameter changes: ${changed.text}`);
  }

  const beforeEnergy = changed.snapshot.energy;
  await page.locator("#runHeat").click();
  await page.waitForFunction((previous) => window.__h06LabSnapshot().status === "Heat step" && window.__h06LabSnapshot().energy < previous, beforeEnergy);
  const diffused = await page.evaluate(() => ({
    snapshot: window.__h06LabSnapshot(),
    text: document.querySelector("#state").textContent.trim(),
    energy: document.querySelector("#energy").textContent.trim()
  }));
  if (!diffused.text.includes("-L_F x") || !diffused.text.includes("exp(-t L_F)") || diffused.snapshot.energy >= beforeEnergy) {
    throw new Error(`Heat step did not visibly damp sheaf energy: ${JSON.stringify(diffused)}.`);
  }

  await page.locator("#projectGlobal").click();
  await page.waitForFunction(() => window.__h06LabSnapshot().status === "Projected");
  const projected = await page.evaluate(() => ({
    snapshot: window.__h06LabSnapshot(),
    text: document.querySelector("#state").textContent.trim(),
    kernel: document.querySelector("#kernelLabel").textContent.trim()
  }));
  if (!projected.text.includes("global section") || projected.snapshot.maxResidual > diffused.snapshot.maxResidual) {
    throw new Error(`Projection did not expose the harmonic global-section limit: ${JSON.stringify(projected)}.`);
  }

  await page.setViewportSize({ width: 900, height: 700 });
  await assertNoDedicatedScrollbars(page, "narrow iframe");

  await browser.close();
  console.log("h06 smoke passed: concrete sheaf heat equation renders residuals, spectrum, heat trace, projection, orbit, and fitted iframe.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
