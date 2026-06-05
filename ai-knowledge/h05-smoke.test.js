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
  const labPath = path.join(__dirname, "h05-sheaf-laplacian-builder.html").replace(/\\/g, "/");

  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
  await page.waitForFunction(() => window.__h05LabReady === true && window.__h05LabSnapshot());
  await page.waitForTimeout(180);

  const initial = await page.evaluate(() => {
    const canvas = document.querySelector(".lab-viewport canvas");
    return {
      bytes: canvas.toDataURL("image/png").length,
      snapshot: window.__h05LabSnapshot(),
      stateText: document.querySelector("#stateText").textContent.trim(),
      rangeCount: document.querySelectorAll('input[type="range"]').length,
      actionCount: document.querySelectorAll("[data-action]").length
    };
  });
  if (initial.bytes < 10000) throw new Error(`H05 lab canvas appears blank; png payload only ${initial.bytes} bytes.`);
  if (initial.rangeCount < 5 || initial.actionCount < 4) throw new Error(`H05 controls are incomplete: ${JSON.stringify(initial)}`);
  if (
    initial.snapshot.kind !== "sheaf-laplacian-operator" ||
    initial.snapshot.visualKind !== "sheaf-laplacian-matrix-energy" ||
    initial.snapshot.nodeCount !== 3 ||
    initial.snapshot.edgeCount !== 3 ||
    initial.snapshot.edgeStalkCount !== 3 ||
    initial.snapshot.deltaRows !== 3 ||
    initial.snapshot.laplacianBlockCount < 9 ||
    initial.snapshot.residualRodCount !== 3 ||
    initial.snapshot.has3d !== true
  ) {
    throw new Error(`H05 did not render the concrete sheaf Laplacian operator: ${JSON.stringify(initial.snapshot)}.`);
  }
  if (!/restriction maps|edge residuals|delta\\^T delta|matrix|kernel|diffusion/i.test(initial.stateText)) {
    throw new Error(`Initial H05 state text is weak: ${initial.stateText}`);
  }
  await assertNoDedicatedScrollbars(page, "desktop iframe");

  const beforeOrbit = await page.evaluate(() => window.__h05LabSnapshot().cameraTheta);
  const canvasBox = await page.locator(".lab-viewport canvas").boundingBox();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.38, canvasBox.y + canvasBox.height * 0.58);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.71, canvasBox.y + canvasBox.height * 0.34, { steps: 8 });
  await page.mouse.up();
  const afterOrbit = await page.evaluate(() => window.__h05LabSnapshot().cameraTheta);
  if (Math.abs(afterOrbit - beforeOrbit) < 0.05) throw new Error("Dragging the canvas did not orbit the sheaf Laplacian operator.");

  await page.selectOption("#scenario", "connection");
  await page.selectOption("#viewSelect", "blocks");
  await setRange(page, "#twistAmount", "0.82");
  await setRange(page, "#mapStrength", "1.18");
  await page.locator("#assembleDelta").click();
  await page.waitForFunction(() => window.__h05LabSnapshot().status === "Assembled");
  const assembled = await page.evaluate(() => ({
    snapshot: window.__h05LabSnapshot(),
    text: document.querySelector("#stateText").textContent.trim()
  }));
  if (!/delta matrix|block rows|restriction maps/i.test(assembled.text) || assembled.snapshot.energy <= 0) {
    throw new Error(`H05 assemble action is not concrete: ${JSON.stringify(assembled)}`);
  }

  const beforeDiffuse = assembled.snapshot.energy;
  await page.locator("#diffuse").click();
  await page.waitForFunction((previous) => window.__h05LabSnapshot().status === "Diffused" && window.__h05LabSnapshot().energy < previous, beforeDiffuse);
  const diffused = await page.evaluate(() => ({
    snapshot: window.__h05LabSnapshot(),
    text: document.querySelector("#stateText").textContent.trim(),
    metric: document.querySelector("#energyLabel").textContent.trim()
  }));
  if (!/Sheaf diffusion|L_F x|energy/i.test(diffused.text)) {
    throw new Error(`Diffused H05 state text is weak: ${diffused.text}`);
  }

  await page.locator("#projectKernel").click();
  await page.waitForFunction(() => window.__h05LabSnapshot().status === "Projected");
  const projected = await page.evaluate(() => ({
    snapshot: window.__h05LabSnapshot(),
    text: document.querySelector("#stateText").textContent.trim(),
    kernel: document.querySelector("#kernelLabel").textContent.trim()
  }));
  if (!/global-section|kernel of delta|kernel of L_F/i.test(projected.text) || projected.snapshot.maxResidual > 0.25) {
    throw new Error(`Projection did not expose a useful kernel diagnostic: ${JSON.stringify(projected)}`);
  }

  await page.locator("#twist").click();
  await page.waitForFunction(() => window.__h05LabSnapshot().modeLabel === "Twisted");
  const twisted = await page.evaluate(() => ({
    snapshot: window.__h05LabSnapshot(),
    mode: document.querySelector("#modeLabel").textContent.trim(),
    text: document.querySelector("#stateText").textContent.trim()
  }));
  if (twisted.mode !== "Twisted" || !/signed sheaf|opposite signs/i.test(twisted.text)) {
    throw new Error(`Signed twist action did not preserve concrete semantics: ${JSON.stringify(twisted)}`);
  }

  await page.setViewportSize({ width: 900, height: 700 });
  await assertNoDedicatedScrollbars(page, "narrow iframe");

  await browser.close();
  console.log("h05 smoke passed: concrete sheaf Laplacian renders delta, L=delta^T delta, residuals, energy, diffusion, kernel projection, signed twist, orbit, and iframe fit.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
