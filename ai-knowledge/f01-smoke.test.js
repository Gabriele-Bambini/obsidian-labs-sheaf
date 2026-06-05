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
  const labPath = path.join(__dirname, "f01-graph-spectral-algebra-lab.html").replace(/\\/g, "/");

  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
  await page.waitForFunction(() => window.__f01LabReady === true && window.__f01LabSnapshot());
  await page.waitForTimeout(180);

  const initial = await page.evaluate(() => {
    const canvas = document.querySelector(".lab-viewport canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    return {
      hasWebgl: Boolean(gl),
      imageBytes: canvas.toDataURL("image/png").length,
      snapshot: window.__f01LabSnapshot(),
      stateText: document.querySelector("#stateBox").textContent.trim()
    };
  });
  if (!initial.hasWebgl) throw new Error("F01 lab did not create a WebGL canvas.");
  if (initial.imageBytes < 9000) throw new Error(`F01 lab canvas appears blank; png payload only ${initial.imageBytes} bytes.`);
  if (initial.snapshot.mode !== "operators" || initial.snapshot.nodeCount < 6 || initial.snapshot.laplacianEnergy <= 0 || initial.snapshot.algebraicConnectivity <= 0) {
    throw new Error(`F01 lab did not expose useful operator diagnostics: ${JSON.stringify(initial.snapshot)}.`);
  }
  if (!initial.stateText.includes("adjacency") || !initial.stateText.includes("incidence") || !initial.stateText.includes("Laplacian")) {
    throw new Error(`Operator state text is weak: ${initial.stateText}`);
  }
  await assertNoDedicatedScrollbars(page, "desktop iframe");

  const beforeOrbit = await page.evaluate(() => window.__f01LabSnapshot().cameraTheta);
  const canvasBox = await page.locator(".lab-viewport canvas").boundingBox();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.45, canvasBox.y + canvasBox.height * 0.55);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.74, canvasBox.y + canvasBox.height * 0.35, { steps: 8 });
  await page.mouse.up();
  const afterOrbit = await page.evaluate(() => window.__f01LabSnapshot().cameraTheta);
  if (Math.abs(afterOrbit - beforeOrbit) < 0.05) {
    throw new Error("Dragging the canvas did not orbit the 3D graph spectral visualization.");
  }

  await page.locator("#mode").selectOption("spectrum");
  await page.waitForFunction(() => window.__f01LabSnapshot().mode === "spectrum");
  const spectrum = await page.evaluate(() => ({
    snapshot: window.__f01LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!spectrum.text.includes("eigenvalue") || !spectrum.text.includes("Fiedler") || spectrum.snapshot.spectralGap <= 0) {
    throw new Error(`Spectrum view did not expose eigen/Fiedler diagnostics: ${JSON.stringify(spectrum)}.`);
  }

  await page.locator("#graphType").selectOption("disconnected");
  await page.waitForFunction(() => window.__f01LabSnapshot().graphType === "disconnected");
  const disconnected = await page.evaluate(() => window.__f01LabSnapshot());
  if (disconnected.componentCount < 2 || disconnected.algebraicConnectivity !== 0 || disconnected.nullity < 2) {
    throw new Error(`Disconnected graph did not expose Laplacian nullity: ${JSON.stringify(disconnected)}.`);
  }

  await page.locator("#graphType").selectOption("bridge");
  await page.locator("#mode").selectOption("diffusion");
  await page.waitForFunction(() => window.__f01LabSnapshot().mode === "diffusion" && window.__f01LabSnapshot().graphType === "bridge");
  const beforeHeat = await page.evaluate(() => window.__f01LabSnapshot().laplacianEnergy);
  await page.locator("#stepHeat").click();
  await page.waitForFunction((previous) => window.__f01LabSnapshot().heatStep >= 1 && window.__f01LabSnapshot().laplacianEnergy < previous, beforeHeat);
  const afterHeat = await page.evaluate(() => ({
    snapshot: window.__f01LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!afterHeat.text.includes("heat") || afterHeat.snapshot.laplacianEnergy >= beforeHeat) {
    throw new Error(`Diffusion view did not reduce Laplacian energy: ${JSON.stringify(afterHeat)}.`);
  }

  await page.locator("#mode").selectOption("cuts");
  await setRange(page, "#cutBalance", "0.62");
  await page.waitForFunction(() => window.__f01LabSnapshot().mode === "cuts");
  const cuts = await page.evaluate(() => ({
    snapshot: window.__f01LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!cuts.text.includes("cut") || cuts.snapshot.cutWeight <= 0 || cuts.snapshot.conductance <= 0) {
    throw new Error(`Cut view did not expose cut/conductance diagnostics: ${JSON.stringify(cuts)}.`);
  }

  await setRange(page, "#edgeWeight", "1.8");
  await page.waitForFunction(() => window.__f01LabSnapshot().edgeWeight > 1.7);
  const weighted = await page.evaluate(() => window.__f01LabSnapshot());
  if (weighted.laplacianEnergy <= cuts.snapshot.laplacianEnergy) {
    throw new Error(`Increasing bridge weight did not increase weighted Laplacian energy: ${JSON.stringify(weighted)}.`);
  }

  await page.setViewportSize({ width: 900, height: 700 });
  await assertNoDedicatedScrollbars(page, "narrow iframe");

  await browser.close();
  console.log("f01 smoke passed: 3D graph spectral lab renders, orbits, shows operators, spectrum, nullity, heat diffusion, cuts, weighted energy, and fits iframe.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
