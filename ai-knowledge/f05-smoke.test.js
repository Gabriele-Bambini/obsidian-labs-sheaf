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
  const labPath = path.join(__dirname, "f05-graph-clustering-lab.html").replace(/\\/g, "/");

  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
  await page.waitForFunction(() => window.__f05LabReady === true && window.__f05LabSnapshot());
  await page.waitForTimeout(180);

  const initial = await page.evaluate(() => {
    const canvas = document.querySelector(".lab-viewport canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    return {
      hasWebgl: Boolean(gl),
      imageBytes: canvas.toDataURL("image/png").length,
      snapshot: window.__f05LabSnapshot(),
      stateText: document.querySelector("#stateBox").textContent.trim()
    };
  });
  if (!initial.hasWebgl) throw new Error("F05 lab did not create a WebGL canvas.");
  if (initial.imageBytes < 9000) throw new Error(`F05 lab canvas appears blank; png payload only ${initial.imageBytes} bytes.`);
  if (initial.snapshot.mode !== "partition" || initial.snapshot.nodeCount < 12 || initial.snapshot.clusterCount < 2) {
    throw new Error(`F05 lab did not expose useful partition state: ${JSON.stringify(initial.snapshot)}.`);
  }
  if (initial.snapshot.modularity <= 0 || initial.snapshot.conductance <= 0 || initial.snapshot.cutWeight <= 0) {
    throw new Error(`F05 partition metrics are weak: ${JSON.stringify(initial.snapshot)}.`);
  }
  if (!initial.stateText.includes("conductance") || !initial.stateText.includes("modularity") || !initial.stateText.includes("cut")) {
    throw new Error(`Partition state text is weak: ${initial.stateText}`);
  }
  await assertNoDedicatedScrollbars(page, "desktop iframe");

  const beforeOrbit = await page.evaluate(() => window.__f05LabSnapshot().cameraTheta);
  const canvasBox = await page.locator(".lab-viewport canvas").boundingBox();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.44, canvasBox.y + canvasBox.height * 0.58);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.72, canvasBox.y + canvasBox.height * 0.35, { steps: 8 });
  await page.mouse.up();
  const afterOrbit = await page.evaluate(() => window.__f05LabSnapshot().cameraTheta);
  if (Math.abs(afterOrbit - beforeOrbit) < 0.05) {
    throw new Error("Dragging the canvas did not orbit the 3D graph-clustering visualization.");
  }

  await page.locator("#mode").selectOption("spectral");
  await page.waitForFunction(() => window.__f05LabSnapshot().mode === "spectral");
  const spectral = await page.evaluate(() => ({
    snapshot: window.__f05LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!spectral.text.includes("Fiedler") || !spectral.text.includes("eigengap") || spectral.snapshot.eigengap <= 0 || spectral.snapshot.fiedlerSpread <= 0) {
    throw new Error(`Spectral view did not expose Fiedler/eigengap diagnostics: ${JSON.stringify(spectral)}.`);
  }

  const weakBridgeLambda = spectral.snapshot.lambda2;
  await setRange(page, "#bridgeWeight", "1.8");
  await page.waitForFunction((previous) => window.__f05LabSnapshot().bridgeWeight > 1.7 && window.__f05LabSnapshot().lambda2 > previous, weakBridgeLambda);
  const strongBridge = await page.evaluate(() => window.__f05LabSnapshot());
  if (strongBridge.conductance <= spectral.snapshot.conductance) {
    throw new Error(`Increasing bridge weight did not raise bottleneck conductance: ${JSON.stringify(strongBridge)}.`);
  }

  await page.locator("#graphType").selectOption("ring");
  await page.locator("#mode").selectOption("objective");
  await setRange(page, "#clusterCount", "3");
  await page.waitForFunction(() => window.__f05LabSnapshot().graphType === "ring" && window.__f05LabSnapshot().clusterCount === 3);
  const objective = await page.evaluate(() => ({
    snapshot: window.__f05LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!objective.text.includes("RatioCut") || !objective.text.includes("Normalized Cut") || objective.snapshot.normalizedCut <= 0) {
    throw new Error(`Objective view did not expose balanced-cut diagnostics: ${JSON.stringify(objective)}.`);
  }

  await page.locator("#mode").selectOption("stability");
  const beforeNoise = await page.evaluate(() => window.__f05LabSnapshot().stability);
  await setRange(page, "#noiseEdges", "0.55");
  await page.waitForFunction((previous) => window.__f05LabSnapshot().noiseEdges > 0.5 && window.__f05LabSnapshot().stability < previous, beforeNoise);
  const noisy = await page.evaluate(() => ({
    snapshot: window.__f05LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!noisy.text.includes("stability") || noisy.snapshot.stability >= beforeNoise) {
    throw new Error(`Noise did not reduce partition stability: ${JSON.stringify(noisy)}.`);
  }

  await page.setViewportSize({ width: 900, height: 700 });
  await assertNoDedicatedScrollbars(page, "narrow iframe");

  await browser.close();
  console.log("f05 smoke passed: 3D graph clustering lab renders, orbits, shows partition, spectral, objective, stability diagnostics, reacts to parameters, and fits iframe.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
