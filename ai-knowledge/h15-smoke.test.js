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
  const labPath = path.join(__dirname, "h15-sheaf-research-frontier-lab.html").replace(/\\/g, "/");

  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
  await page.waitForFunction(() => window.__h15LabReady === true && window.__h15LabSnapshot());
  await page.waitForTimeout(180);

  const initial = await page.evaluate(() => {
    const canvas = document.querySelector(".lab-viewport canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    return {
      hasWebgl: Boolean(gl),
      imageBytes: canvas.toDataURL("image/png").length,
      snapshot: window.__h15LabSnapshot(),
      text: document.querySelector("#stateBox").textContent.trim()
    };
  });
  if (!initial.hasWebgl) throw new Error("H15 lab did not create a WebGL canvas.");
  if (initial.imageBytes < 9000) throw new Error(`H15 lab canvas appears blank; png payload only ${initial.imageBytes} bytes.`);
  if (
    initial.snapshot.kind !== "sheaf-research-frontier-bench" ||
    initial.snapshot.visualKind !== "experiment-pipeline-benchmark" ||
    initial.snapshot.frontier !== "dynamic" ||
    initial.snapshot.moduleCount < 7 ||
    initial.snapshot.pipelineStageCount < 6 ||
    initial.snapshot.constraintFamilyCount < 4 ||
    initial.snapshot.benchmarkPanelCount < 3 ||
    initial.snapshot.ablationLaneCount !== 2 ||
    initial.snapshot.costMeterCount < 3 ||
    initial.snapshot.metric.expressivity <= 0
  ) {
    throw new Error(`H15 lab did not expose a concrete research experiment bench: ${JSON.stringify(initial.snapshot)}.`);
  }
  if (!/event stream|restriction generator|frontier|baseline/i.test(initial.text)) {
    throw new Error(`Initial H15 state text is weak: ${initial.text}`);
  }
  await assertNoDedicatedScrollbars(page, "desktop iframe");

  for (const selector of ["#frontier", "#mapFamily", "#benchmark", "#timeDrift", "#topologyFreedom", "#constraintStrength", "#scale", "#supervision", "#noise"]) {
    if (!(await page.locator(selector).count())) throw new Error(`H15 missing control ${selector}`);
  }
  for (const selector of ["#advanceFrontier", "#applyConstraint", "#stressScale", "#runAblation", "#resetH15"]) {
    if (!(await page.locator(selector).count())) throw new Error(`H15 missing action ${selector}`);
  }

  const beforeOrbit = await page.evaluate(() => window.__h15LabSnapshot().cameraTheta);
  const canvasBox = await page.locator(".lab-viewport canvas").boundingBox();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.42, canvasBox.y + canvasBox.height * 0.58);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.73, canvasBox.y + canvasBox.height * 0.33, { steps: 8 });
  await page.mouse.up();
  const afterOrbit = await page.evaluate(() => window.__h15LabSnapshot().cameraTheta);
  if (Math.abs(afterOrbit - beforeOrbit) < 0.05) {
    throw new Error("Dragging the canvas did not orbit the 3D research-frontier visualization.");
  }

  await page.locator("#advanceFrontier").click();
  await page.waitForFunction(() => window.__h15LabSnapshot().frontier === "structure");
  const advanced = await page.evaluate(() => ({
    snapshot: window.__h15LabSnapshot(),
    label: document.querySelector("#frontierLabel").textContent.trim(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!advanced.label.toLowerCase().includes("topology") || !advanced.text.includes("candidate topology")) {
    throw new Error(`Advance did not move to structure discovery frontier: ${JSON.stringify(advanced)}.`);
  }

  await page.locator("#mapFamily").selectOption("orthogonal");
  await setRange(page, "#constraintStrength", "0.84");
  const beforeConstraint = await page.evaluate(() => window.__h15LabSnapshot());
  await page.locator("#applyConstraint").click();
  await page.waitForFunction((before) => window.__h15LabSnapshot().constraintApplications > before.constraintApplications && window.__h15LabSnapshot().metric.stability > before.metric.stability, beforeConstraint);
  const constrained = await page.evaluate(() => ({
    snapshot: window.__h15LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!constrained.text.includes("orthogonal") || !constrained.text.includes("gauge")) {
    throw new Error(`Constraint action did not expose map-family semantics: ${JSON.stringify(constrained)}.`);
  }

  await setRange(page, "#scale", "86");
  await setRange(page, "#supervision", "0.38");
  await page.locator("#stressScale").click();
  await page.waitForFunction(() => window.__h15LabSnapshot().stressCount > 0);
  const stressed = await page.evaluate(() => window.__h15LabSnapshot());
  if (stressed.metric.cost <= stressed.metric.stability || stressed.memoryBarHeight <= 0.6) {
    throw new Error(`Scale stress did not expose the cost/stability tradeoff: ${JSON.stringify(stressed)}.`);
  }

  await page.locator("#runAblation").click();
  await page.waitForFunction(() => window.__h15LabSnapshot().ablated === true);
  const ablated = await page.evaluate(() => ({
    snapshot: window.__h15LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!ablated.text.includes("baseline") || ablated.snapshot.metric.expressivity >= stressed.metric.expressivity) {
    throw new Error(`Ablation did not expose the baseline comparison: ${JSON.stringify(ablated)}.`);
  }

  await page.locator("#frontier").selectOption("quantum");
  await page.waitForFunction(() => window.__h15LabSnapshot().frontier === "quantum");
  const quantum = await page.evaluate(() => ({
    snapshot: window.__h15LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!quantum.text.includes("unitary") || !quantum.text.includes("shot cost")) {
    throw new Error(`Quantum/physical frontier did not expose concrete constraints: ${JSON.stringify(quantum)}.`);
  }

  await page.setViewportSize({ width: 900, height: 700 });
  await assertNoDedicatedScrollbars(page, "narrow iframe");

  await browser.close();
  console.log("h15 smoke passed: concrete research-frontier bench renders pipeline modules, constraints, scale stress, ablation, quantum checks, orbit, and fitted iframe.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
