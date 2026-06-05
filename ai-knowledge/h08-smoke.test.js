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
  const labPath = path.join(__dirname, "h08-neural-sheaf-diffusion-lab.html").replace(/\\/g, "/");

  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
  await page.waitForFunction(() => window.__h08LabReady === true && window.__h08LabSnapshot());
  await page.waitForTimeout(180);

  const initial = await page.evaluate(() => {
    const canvas = document.querySelector(".lab-viewport canvas");
    return {
      imageBytes: canvas.toDataURL("image/png").length,
      snapshot: window.__h08LabSnapshot(),
      stateText: document.querySelector("#stateBox").textContent.trim()
    };
  });
  if (initial.imageBytes < 9000) throw new Error(`H08 lab canvas appears blank; png payload only ${initial.imageBytes} bytes.`);
  if (
    initial.snapshot.kind !== "neural-sheaf-diffusion-ode" ||
    initial.snapshot.visualKind !== "neural-sheaf-diffusion-ode-kernel" ||
    initial.snapshot.graphDiffusionLaneCount !== 1 ||
    initial.snapshot.sheafDiffusionLaneCount !== 1 ||
    initial.snapshot.learnedRestrictionGateCount < 3 ||
    !(initial.snapshot.edgeStalkPlateCount >= 3) ||
    !(initial.snapshot.residualRodCount >= 3) ||
    initial.snapshot.odeTrajectoryPointCount < 12 ||
    initial.snapshot.kernelSurfaceCount !== 1
  ) {
    throw new Error(`H08 lab did not expose a concrete neural sheaf diffusion object: ${JSON.stringify(initial.snapshot)}.`);
  }
  if (!/graph diffusion|learned restrictions|sheaf ODE|kernel/i.test(initial.stateText)) {
    throw new Error(`Initial H08 state text is weak: ${initial.stateText}`);
  }
  await assertNoDedicatedScrollbars(page, "desktop iframe");

  const beforeOrbit = await page.evaluate(() => window.__h08LabSnapshot().cameraTheta);
  const canvasBox = await page.locator(".lab-viewport canvas").boundingBox();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.42, canvasBox.y + canvasBox.height * 0.58);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.72, canvasBox.y + canvasBox.height * 0.34, { steps: 8 });
  await page.mouse.up();
  const afterOrbit = await page.evaluate(() => window.__h08LabSnapshot().cameraTheta);
  if (Math.abs(afterOrbit - beforeOrbit) < 0.05) {
    throw new Error("Dragging the canvas did not orbit the concrete neural sheaf diffusion visualization.");
  }

  await page.locator("#scenario").selectOption("heterophily");
  await page.locator("#operator").selectOption("sheaf");
  await page.locator("#view").selectOption("ode");
  await setRange(page, "#odeSteps", "7");
  await setRange(page, "#kernelSharpness", "1.45");
  await setRange(page, "#featureNoise", "0.32");
  await setRange(page, "#relationChannels", "6");
  await setRange(page, "#skipConnection", "0.62");
  const configured = await page.evaluate(() => ({
    snapshot: window.__h08LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (configured.snapshot.operator !== "sheaf" || configured.snapshot.odeSteps !== 7 || configured.snapshot.relationChannelCount !== 6) {
    throw new Error(`H08 controls did not change ODE telemetry: ${JSON.stringify(configured)}.`);
  }
  if (!configured.text.includes("heterophily") || !configured.text.includes("sheaf ODE")) {
    throw new Error(`H08 control readout is weak: ${configured.text}`);
  }

  const beforeLearn = configured.snapshot.sheafEnergy;
  await page.locator("#learnRestrictions").click();
  await page.waitForFunction(
    (previous) => window.__h08LabSnapshot().status === "Restrictions learned" && window.__h08LabSnapshot().mapAgreement > 0.82 && window.__h08LabSnapshot().sheafEnergy < previous,
    beforeLearn
  );
  const learned = await page.evaluate(() => ({
    snapshot: window.__h08LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!learned.text.includes("learned restrictions") || !learned.text.includes("edge-stalk") || learned.snapshot.mapAgreement < 0.82) {
    throw new Error(`Learning restrictions did not create useful neural sheaf maps: ${JSON.stringify(learned)}.`);
  }

  const beforeStep = learned.snapshot.sheafEnergy;
  await page.locator("#stepOde").click();
  await page.waitForFunction((previous) => window.__h08LabSnapshot().status === "ODE stepped" && window.__h08LabSnapshot().sheafEnergy < previous, beforeStep);
  const odeStep = await page.evaluate(() => ({
    snapshot: window.__h08LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!odeStep.text.includes("dx/dt = -Delta_F(theta) x") || odeStep.snapshot.odeTime <= 0) {
    throw new Error(`ODE step did not expose neural sheaf diffusion dynamics: ${JSON.stringify(odeStep)}.`);
  }

  await page.locator("#projectKernel").click();
  await page.waitForFunction(() => window.__h08LabSnapshot().status === "Kernel projected" && window.__h08LabSnapshot().kernelDimension >= 2);
  const kernel = await page.evaluate(() => ({
    snapshot: window.__h08LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!kernel.text.includes("learned kernel") || !kernel.text.includes("global section")) {
    throw new Error(`Kernel projection did not expose learned global-section diagnostics: ${JSON.stringify(kernel)}.`);
  }

  await page.locator("#operator").selectOption("graph");
  await page.locator("#view").selectOption("comparison");
  await page.locator("#compareGraph").click();
  await page.waitForFunction(() => window.__h08LabSnapshot().status === "Compared" && window.__h08LabSnapshot().operator === "graph");
  const graphFlow = await page.evaluate(() => ({
    snapshot: window.__h08LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!graphFlow.text.includes("over-smoothing") || graphFlow.snapshot.oversmoothing <= odeStep.snapshot.oversmoothing) {
    throw new Error(`Graph diffusion did not show stronger over-smoothing: ${JSON.stringify(graphFlow)}.`);
  }

  await page.setViewportSize({ width: 900, height: 700 });
  await assertNoDedicatedScrollbars(page, "narrow iframe");

  await browser.close();
  console.log("h08 smoke passed: concrete neural sheaf diffusion renders plain/sheaf lanes, learned restriction gates, ODE trajectory, kernel projection, graph comparison, orbit, and fitted iframe.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
