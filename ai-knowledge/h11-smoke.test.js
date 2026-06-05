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
  const labPath = path.join(__dirname, "h11-sheaf-gauge-transformation-lab.html").replace(/\\/g, "/");

  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
  await page.waitForFunction(() => window.__h11LabReady === true && window.__h11LabSnapshot());
  await page.waitForTimeout(180);

  const initial = await page.evaluate(() => {
    const canvas = document.querySelector(".lab-viewport canvas");
    return {
      imageBytes: canvas.toDataURL("image/png").length,
      snapshot: window.__h11LabSnapshot(),
      stateText: document.querySelector("#stateBox").textContent.trim()
    };
  });
  if (initial.imageBytes < 9000) throw new Error(`H11 lab canvas appears blank; png payload only ${initial.imageBytes} bytes.`);
  if (
    initial.snapshot.kind !== "sheaf-gauge-covariance" ||
    initial.snapshot.visualKind !== "gauge-frame-covariant-restriction" ||
    initial.snapshot.localFrameCount < 3 ||
    initial.snapshot.fiberVectorCount < 3 ||
    initial.snapshot.restrictionMapCount < 4 ||
    initial.snapshot.gaugeMatrixCount < 3 ||
    initial.snapshot.invariantOrbitCount !== 1
  ) {
    throw new Error(`H11 lab did not expose a concrete gauge/sheaf object: ${JSON.stringify(initial.snapshot)}.`);
  }
  if (!/local frame|gauge|B'_ve = B_ve g_v\^-1|invariant energy/i.test(initial.stateText)) {
    throw new Error(`Initial H11 state text is weak: ${initial.stateText}`);
  }
  await assertNoDedicatedScrollbars(page, "desktop iframe");

  const beforeOrbit = await page.evaluate(() => window.__h11LabSnapshot().cameraTheta);
  const canvasBox = await page.locator(".lab-viewport canvas").boundingBox();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.42, canvasBox.y + canvasBox.height * 0.58);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.72, canvasBox.y + canvasBox.height * 0.34, { steps: 8 });
  await page.mouse.up();
  const afterOrbit = await page.evaluate(() => window.__h11LabSnapshot().cameraTheta);
  if (Math.abs(afterOrbit - beforeOrbit) < 0.05) {
    throw new Error("Dragging the canvas did not orbit the concrete sheaf gauge visualization.");
  }

  await page.locator("#scenario").selectOption("edge");
  await page.locator("#mode").selectOption("covariant");
  await setRange(page, "#gaugeSteps", "5");
  await setRange(page, "#frameRotation", "1.45");
  await setRange(page, "#gaugeMismatch", "0.16");
  await setRange(page, "#visibleFrames", "4");
  await setRange(page, "#invariantAnchor", "0.72");
  const beforeEnergy = await page.evaluate(() => window.__h11LabSnapshot().energy);
  await page.locator("#applyGauge").click();
  await page.waitForFunction(() => window.__h11LabSnapshot().status === "Gauge applied" && window.__h11LabSnapshot().gaugeApplications === 1);
  const covariant = await page.evaluate(() => ({
    snapshot: window.__h11LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!covariant.text.includes("inverse restriction update") || Math.abs(covariant.snapshot.energy - beforeEnergy) > 0.08) {
    throw new Error(`Covariant gauge change did not preserve sheaf energy: ${JSON.stringify(covariant)}.`);
  }

  await page.locator("#breakGauge").click();
  await page.waitForFunction(() => window.__h11LabSnapshot().mode === "broken");
  await page.locator("#applyGauge").click();
  await page.waitForFunction(() => window.__h11LabSnapshot().status === "Gauge applied" && window.__h11LabSnapshot().mode === "broken" && window.__h11LabSnapshot().energyRatio > 1.12);
  const broken = await page.evaluate(() => ({
    snapshot: window.__h11LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!broken.text.includes("broken gauge") || !broken.text.includes("fake residual")) {
    throw new Error(`Broken gauge change did not expose coordinate artifact: ${JSON.stringify(broken)}.`);
  }

  await page.locator("#scenario").selectOption("triangle");
  await page.locator("#cycleHolonomy").click();
  await page.waitForFunction(() => window.__h11LabSnapshot().status === "Holonomy shown" && Math.abs(window.__h11LabSnapshot().holonomyAngle) > 15);
  const holonomy = await page.evaluate(() => ({
    snapshot: window.__h11LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!holonomy.text.includes("holonomy") || !holonomy.text.includes("curvature") || Math.abs(holonomy.snapshot.holonomyAngle) < 15) {
    throw new Error(`Triangle cycle did not expose holonomy curvature: ${JSON.stringify(holonomy)}.`);
  }

  await page.setViewportSize({ width: 900, height: 700 });
  await assertNoDedicatedScrollbars(page, "narrow iframe");

  await browser.close();
  console.log("h11 smoke passed: concrete sheaf gauge lab renders local frames, covariant restriction updates, invariant energy, broken gauge artifact, holonomy curvature, orbit, and fitted iframe.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
