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
  const labPath = path.join(__dirname, "h12-sheaf-applications-domain-lab.html").replace(/\\/g, "/");

  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
  await page.waitForFunction(() => window.__h12LabReady === true && window.__h12LabSnapshot());
  await page.waitForTimeout(180);

  const initial = await page.evaluate(() => {
    const canvas = document.querySelector(".lab-viewport canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    return {
      hasWebgl: Boolean(gl),
      imageBytes: canvas.toDataURL("image/png").length,
      snapshot: window.__h12LabSnapshot(),
      stateText: document.querySelector("#stateBox").textContent.trim()
    };
  });
  if (!initial.hasWebgl) throw new Error("H12 lab did not create a WebGL canvas.");
  if (initial.imageBytes < 9000) throw new Error(`H12 lab canvas appears blank; png payload only ${initial.imageBytes} bytes.`);
  if (
    initial.snapshot.kind !== "sheaf-application-translation-workbench" ||
    initial.snapshot.visualKind !== "domain-relation-space-adapter" ||
    initial.snapshot.domain !== "fraud" ||
    initial.snapshot.domainStationCount < 5 ||
    initial.snapshot.relationAdapterCount < 5 ||
    initial.snapshot.domainObjectCount < 24 ||
    initial.snapshot.rawSmoothingLaneCount !== 1 ||
    initial.snapshot.sheafTransportLaneCount !== 1
  ) {
    throw new Error(`H12 lab did not expose concrete domain-application objects: ${JSON.stringify(initial.snapshot)}.`);
  }
  if (!/fraud|account|device|relation-specific transport|relation space/i.test(initial.stateText)) {
    throw new Error(`Initial H12 state text is weak: ${initial.stateText}`);
  }
  await assertNoDedicatedScrollbars(page, "desktop iframe");

  for (const selector of ["#domain", "#mapFamily", "#view", "#mapStrength", "#relationNoise", "#edgeMetadata", "#baselineDepth", "#domainShift"]) {
    if (!(await page.locator(selector).count())) throw new Error(`H12 missing control ${selector}`);
  }
  for (const selector of ["#switchDomain", "#applySheaf", "#runDiffusion", "#showFailure", "#resetH12"]) {
    if (!(await page.locator(selector).count())) throw new Error(`H12 missing action ${selector}`);
  }

  const beforeOrbit = await page.evaluate(() => window.__h12LabSnapshot().cameraTheta);
  const canvasBox = await page.locator(".lab-viewport canvas").boundingBox();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.43, canvasBox.y + canvasBox.height * 0.58);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.72, canvasBox.y + canvasBox.height * 0.34, { steps: 8 });
  await page.mouse.up();
  const afterOrbit = await page.evaluate(() => window.__h12LabSnapshot().cameraTheta);
  if (Math.abs(afterOrbit - beforeOrbit) < 0.05) {
    throw new Error("Dragging the canvas did not orbit the 3D application sheaf visualization.");
  }

  await page.locator("#switchDomain").click();
  await page.waitForFunction(() => window.__h12LabSnapshot().domain === "weather");
  const weather = await page.evaluate(() => ({
    snapshot: window.__h12LabSnapshot(),
    domainLabel: document.querySelector("#domainLabel").textContent.trim(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!weather.domainLabel.includes("weather") || !weather.text.includes("local frames") || weather.snapshot.vectorFieldArrowCount < 4) {
    throw new Error(`Domain switch did not expose weather transport semantics: ${JSON.stringify(weather)}.`);
  }

  await page.locator("#domain").selectOption("molecule");
  await page.locator("#mapFamily").selectOption("edge-type");
  await setRange(page, "#edgeMetadata", "0.82");
  await page.waitForFunction(() => window.__h12LabSnapshot().domain === "molecule");
  const molecule = await page.evaluate(() => ({
    snapshot: window.__h12LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!molecule.text.includes("bond") || molecule.snapshot.bondConstraintCount < 5 || molecule.snapshot.edgeMetadata < 0.8) {
    throw new Error(`Molecule station did not expose bond-relation constraints: ${JSON.stringify(molecule)}.`);
  }

  await page.locator("#domain").selectOption("fraud");
  await page.locator("#mapFamily").selectOption("diagonal");
  await setRange(page, "#mapStrength", "0.92");
  await setRange(page, "#relationNoise", "0.35");
  await page.locator("#applySheaf").click();
  await page.waitForFunction(() => window.__h12LabSnapshot().mode === "sheaf" && window.__h12LabSnapshot().sheafEnergy < window.__h12LabSnapshot().rawEnergy);
  const sheaf = await page.evaluate(() => ({
    snapshot: window.__h12LabSnapshot(),
    mapLabel: document.querySelector("#mapLabel").textContent.trim(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!sheaf.text.includes("maps endpoints into the relation space") || !sheaf.mapLabel.includes("transport")) {
    throw new Error(`Sheaf map did not expose relation-space transport diagnostics: ${JSON.stringify(sheaf)}.`);
  }

  await setRange(page, "#baselineDepth", "7");
  await setRange(page, "#domainShift", "0.42");
  await page.locator("#runDiffusion").click();
  await page.waitForFunction(() => window.__h12LabSnapshot().diffusionStep >= 1);
  const diffusion = await page.evaluate(() => ({
    snapshot: window.__h12LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!diffusion.text.includes("domain split") || diffusion.snapshot.robustness <= 0.45 || diffusion.snapshot.evaluationPanelCount < 3) {
    throw new Error(`Diffusion/evaluation diagnostics are weak: ${JSON.stringify(diffusion)}.`);
  }

  await page.locator("#showFailure").click();
  await page.waitForFunction(() => window.__h12LabSnapshot().mode === "failure");
  const failure = await page.evaluate(() => ({
    snapshot: window.__h12LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!failure.text.includes("plain smoothing") || failure.snapshot.rawEnergy <= failure.snapshot.sheafEnergy || failure.snapshot.baselineCollapse <= 0.5) {
    throw new Error(`Failure mode did not contrast raw smoothing against sheaf transport: ${JSON.stringify(failure)}.`);
  }

  await page.setViewportSize({ width: 900, height: 700 });
  await assertNoDedicatedScrollbars(page, "narrow iframe");

  await browser.close();
  console.log("h12 smoke passed: concrete application sheaf workbench renders domain objects, switches physical stations, applies transport, evaluates splits, shows baseline collapse, orbits, and fits iframe.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
