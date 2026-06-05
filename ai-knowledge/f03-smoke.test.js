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
  const labPath = path.join(__dirname, "f03-graph-laplacian-energy.html").replace(/\\/g, "/");

  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
  await page.waitForFunction(() => window.__f03LabReady === true && window.__f03LabSnapshot());
  await page.waitForTimeout(180);

  const initial = await page.evaluate(() => {
    const canvas = document.querySelector(".lab-viewport canvas");
    return {
      bytes: canvas.toDataURL("image/png").length,
      snapshot: window.__f03LabSnapshot(),
      stateText: document.querySelector("#stateText").textContent.trim()
    };
  });
  if (initial.bytes < 9000) throw new Error(`F03 lab canvas appears blank; png payload only ${initial.bytes} bytes.`);
  if (initial.snapshot.nodeCount !== 7 || initial.snapshot.edgeCount !== 7 || initial.snapshot.has3d !== true) {
    throw new Error(`F03 lab did not expose useful 3D Laplacian state: ${JSON.stringify(initial.snapshot)}.`);
  }
  if (!/Graph Laplacian|Dirichlet energy|Heat flow/i.test(initial.stateText)) {
    throw new Error(`Initial F03 state text is weak: ${initial.stateText}`);
  }
  await assertNoDedicatedScrollbars(page, "desktop iframe");

  const beforeOrbit = await page.evaluate(() => window.__f03LabSnapshot().cameraTheta);
  const canvasBox = await page.locator(".lab-viewport canvas").boundingBox();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.36, canvasBox.y + canvasBox.height * 0.58);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.72, canvasBox.y + canvasBox.height * 0.36, { steps: 8 });
  await page.mouse.up();
  const afterOrbit = await page.evaluate(() => window.__f03LabSnapshot().cameraTheta);
  if (Math.abs(afterOrbit - beforeOrbit) < 0.05) {
    throw new Error("Dragging the canvas did not orbit the 3D Graph Laplacian visualization.");
  }

  await page.selectOption("#graph", "bridge");
  await page.selectOption("#operator", "combinatorial");
  await page.selectOption("#viewSelect", "diffusion");
  await page.selectOption("#signalPreset", "rough");
  await setRange(page, "#alpha", "0.04");
  await setRange(page, "#weightScale", "0.55");
  const beforeHeat = await page.evaluate(() => window.__f03LabSnapshot().energy);
  await page.locator("#heat").click();
  await page.waitForFunction(() => window.__f03LabSnapshot().step === 1 && window.__f03LabSnapshot().status === "Diffused");
  const diffused = await page.evaluate(() => ({
    snapshot: window.__f03LabSnapshot(),
    stepLabel: document.querySelector("#stepLabel").textContent.trim(),
    text: document.querySelector("#stateText").textContent.trim()
  }));
  if (diffused.snapshot.energy > beforeHeat + 0.04 || diffused.stepLabel !== "1") {
    throw new Error(`F03 heat step did not reduce energy or update step label: ${JSON.stringify(diffused)}.`);
  }
  if (!/x <- x - alpha Lx|Dirichlet energy|Laplacian nullspace/i.test(diffused.text)) {
    throw new Error(`Diffused F03 state text is weak: ${diffused.text}`);
  }

  await page.locator("#project").click();
  await page.waitForFunction(() => window.__f03LabSnapshot().status === "Projected");
  const projected = await page.evaluate(() => ({
    snapshot: window.__f03LabSnapshot(),
    text: document.querySelector("#stateText").textContent.trim()
  }));
  if (projected.snapshot.energy > 0.001 || projected.snapshot.maxDisagreement > 0.001) {
    throw new Error(`F03 projection did not reach the graph Laplacian nullspace: ${JSON.stringify(projected)}.`);
  }
  if (!/Laplacian nullspace|connected-component average|Dirichlet energy/i.test(projected.text)) {
    throw new Error(`Projected F03 state text is weak: ${projected.text}`);
  }

  await page.setViewportSize({ width: 900, height: 700 });
  await assertNoDedicatedScrollbars(page, "narrow iframe");

  await browser.close();
  console.log("f03 smoke passed: 3D Graph Laplacian lab renders, orbits, diffuses, projects, and fits iframe.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
