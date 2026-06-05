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
  const labPath = path.join(__dirname, "h10-heterophily-restriction-lab.html").replace(/\\/g, "/");

  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
  await page.waitForFunction(() => window.__h10LabReady === true && window.__h10LabSnapshot());
  await page.waitForTimeout(180);

  const initial = await page.evaluate(() => {
    const canvas = document.querySelector(".lab-viewport canvas");
    return {
      imageBytes: canvas.toDataURL("image/png").length,
      snapshot: window.__h10LabSnapshot(),
      stateText: document.querySelector("#stateBox").textContent.trim()
    };
  });
  if (initial.imageBytes < 9000) throw new Error(`H10 lab canvas appears blank; png payload only ${initial.imageBytes} bytes.`);
  if (
    initial.snapshot.kind !== "sheaf-heterophily-compatibility" ||
    initial.snapshot.visualKind !== "heterophily-role-compatibility-matrix" ||
    initial.snapshot.roleNodeCount < 6 ||
    initial.snapshot.compatibilityMatrixCellCount < 9 ||
    initial.snapshot.edgeStalkPlateCount < 5 ||
    initial.snapshot.restrictionMapCount < 10 ||
    initial.snapshot.rawSmoothingLaneCount !== 1 ||
    initial.snapshot.sheafCompatibilityLaneCount !== 1 ||
    initial.snapshot.homophilyRatio > 0.35
  ) {
    throw new Error(`H10 lab did not expose a concrete heterophily/sheaf compatibility object: ${JSON.stringify(initial.snapshot)}.`);
  }
  if (!/heterophily|compatibility matrix|edge-stalk|restriction/i.test(initial.stateText)) {
    throw new Error(`Initial H10 state text is weak: ${initial.stateText}`);
  }
  await assertNoDedicatedScrollbars(page, "desktop iframe");

  const beforeOrbit = await page.evaluate(() => window.__h10LabSnapshot().cameraTheta);
  const canvasBox = await page.locator(".lab-viewport canvas").boundingBox();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.42, canvasBox.y + canvasBox.height * 0.58);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.72, canvasBox.y + canvasBox.height * 0.34, { steps: 8 });
  await page.mouse.up();
  const afterOrbit = await page.evaluate(() => window.__h10LabSnapshot().cameraTheta);
  if (Math.abs(afterOrbit - beforeOrbit) < 0.05) {
    throw new Error("Dragging the canvas did not orbit the concrete heterophily visualization.");
  }

  await page.locator("#scenario").selectOption("bipartite");
  await page.locator("#relationFamily").selectOption("signed");
  await page.locator("#view").selectOption("matrix");
  await setRange(page, "#propagationRounds", "5");
  await setRange(page, "#compatibilitySharpness", "1.35");
  await setRange(page, "#relationNoise", "0.18");
  await setRange(page, "#relationTypes", "5");
  await setRange(page, "#roleIdentity", "0.68");
  const configured = await page.evaluate(() => ({
    snapshot: window.__h10LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (configured.snapshot.scenario !== "bipartite" || configured.snapshot.relationFamily !== "signed" || configured.snapshot.activeRelationTypeCount !== 5) {
    throw new Error(`H10 controls did not update role compatibility telemetry: ${JSON.stringify(configured)}.`);
  }
  if (!configured.text.includes("buyer-seller") || !configured.text.includes("signed")) {
    throw new Error(`H10 configured readout is weak: ${configured.text}`);
  }

  await page.locator("#learnRelations").click();
  await page.waitForFunction(() => window.__h10LabSnapshot().status === "Relations learned" && window.__h10LabSnapshot().mapAgreement > 0.82);
  const learned = await page.evaluate(() => ({
    snapshot: window.__h10LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!learned.text.includes("compatibility matrix") || !learned.text.includes("restriction maps")) {
    throw new Error(`Learning relations did not expose matrix/restriction diagnostics: ${JSON.stringify(learned)}.`);
  }

  const beforeSheaf = learned.snapshot.sheafEnergy;
  await page.locator("#stepSheaf").click();
  await page.waitForFunction((previous) => window.__h10LabSnapshot().status === "Sheaf stepped" && window.__h10LabSnapshot().sheafEnergy < previous, beforeSheaf);
  const sheafStep = await page.evaluate(() => ({
    snapshot: window.__h10LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!sheafStep.text.includes("B_u x_u") || !sheafStep.text.includes("B_v x_v") || sheafStep.snapshot.roleAccuracy < 0.82) {
    throw new Error(`Sheaf step did not preserve heterophilic roles through edge-stalk comparison: ${JSON.stringify(sheafStep)}.`);
  }

  await page.locator("#runGraph").click();
  await page.waitForFunction(() => window.__h10LabSnapshot().status === "Graph smoothed" && window.__h10LabSnapshot().graphStepCount > 0);
  const graphRun = await page.evaluate(() => ({
    snapshot: window.__h10LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!graphRun.text.includes("raw Laplacian") || graphRun.snapshot.oversmoothing <= sheafStep.snapshot.oversmoothing) {
    throw new Error(`Raw graph smoothing did not show stronger collapse than sheaf compatibility: ${JSON.stringify(graphRun)}.`);
  }

  await page.locator("#scenario").selectOption("homophily");
  await page.waitForFunction(() => window.__h10LabSnapshot().scenario === "homophily" && window.__h10LabSnapshot().homophilyRatio > 0.55);
  const homophily = await page.evaluate(() => ({
    snapshot: window.__h10LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!homophily.text.includes("homophily") || homophily.snapshot.homophilyRatio < 0.55) {
    throw new Error(`Homophily preset did not update relation diagnostics: ${JSON.stringify(homophily)}.`);
  }

  await page.setViewportSize({ width: 900, height: 700 });
  await assertNoDedicatedScrollbars(page, "narrow iframe");

  await browser.close();
  console.log("h10 smoke passed: concrete heterophily lab renders compatibility matrix, edge-stalk restrictions, role-aware sheaf smoothing, graph collapse comparison, orbit, and fitted iframe.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
