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
  const labPath = path.join(__dirname, "h13-directed-hypergraph-sheaf-lab.html").replace(/\\/g, "/");

  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
  await page.waitForFunction(() => window.__h13LabReady === true && window.__h13LabSnapshot());
  await page.waitForTimeout(180);

  const initial = await page.evaluate(() => {
    const canvas = document.querySelector(".lab-viewport canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    return {
      hasWebgl: Boolean(gl),
      imageBytes: canvas.toDataURL("image/png").length,
      snapshot: window.__h13LabSnapshot(),
      text: document.querySelector("#stateBox").textContent.trim()
    };
  });
  if (!initial.hasWebgl) throw new Error("H13 lab did not create a WebGL canvas.");
  if (initial.imageBytes < 9000) throw new Error(`H13 lab canvas appears blank; png payload only ${initial.imageBytes} bytes.`);
  if (
    initial.snapshot.kind !== "directed-hypergraph-sheaf-incidence" ||
    initial.snapshot.visualKind !== "incidence-gather-correct-broadcast" ||
    initial.snapshot.mode !== "directed" ||
    initial.snapshot.nodeStalkCount < 6 ||
    initial.snapshot.directedEdgeStalkCount < 2 ||
    initial.snapshot.hyperedgeStalkCount < 1 ||
    initial.snapshot.incidenceMapCount < 9 ||
    initial.snapshot.cliqueExpansionEdgeCount >= initial.snapshot.groupIncidenceCount
  ) {
    throw new Error(`H13 lab did not expose concrete directed/hypergraph sheaf objects: ${JSON.stringify(initial.snapshot)}.`);
  }
  if (!/source role|target role|directed edge stalk|asymmetric/i.test(initial.text)) {
    throw new Error(`Initial H13 state text is weak: ${initial.text}`);
  }
  await assertNoDedicatedScrollbars(page, "desktop iframe");

  for (const selector of ["#mode", "#mapFamily", "#residualView", "#stepSize", "#roleAsymmetry", "#hyperedgeSize", "#tolerance", "#normalization"]) {
    if (!(await page.locator(selector).count())) throw new Error(`H13 missing control ${selector}`);
  }
  for (const selector of ["#toggleMode", "#flowStep", "#flipDirection", "#balance", "#showClique", "#resetH13"]) {
    if (!(await page.locator(selector).count())) throw new Error(`H13 missing action ${selector}`);
  }

  const beforeOrbit = await page.evaluate(() => window.__h13LabSnapshot().cameraTheta);
  const canvasBox = await page.locator(".lab-viewport canvas").boundingBox();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.42, canvasBox.y + canvasBox.height * 0.58);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.72, canvasBox.y + canvasBox.height * 0.34, { steps: 8 });
  await page.mouse.up();
  const afterOrbit = await page.evaluate(() => window.__h13LabSnapshot().cameraTheta);
  if (Math.abs(afterOrbit - beforeOrbit) < 0.05) {
    throw new Error("Dragging the canvas did not orbit the 3D directed/hypergraph sheaf visualization.");
  }

  await page.locator("#toggleMode").click();
  await page.waitForFunction(() => window.__h13LabSnapshot().mode === "hypergraph");
  const hypergraph = await page.evaluate(() => ({
    snapshot: window.__h13LabSnapshot(),
    label: document.querySelector("#modeLabel").textContent.trim(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!hypergraph.label.includes("hypergraph") || !hypergraph.text.includes("group stalk") || hypergraph.snapshot.gatherProjectionCount < 4) {
    throw new Error(`Toggle did not expose hypergraph sheaf semantics: ${JSON.stringify(hypergraph)}.`);
  }

  await setRange(page, "#stepSize", "0.74");
  await setRange(page, "#hyperedgeSize", "5");
  const beforeEnergy = await page.evaluate(() => window.__h13LabSnapshot().energy);
  await page.locator("#flowStep").click();
  await page.waitForFunction((previous) => window.__h13LabSnapshot().stepCount > 0 && window.__h13LabSnapshot().energy < previous, beforeEnergy);
  const stepped = await page.evaluate(() => ({
    snapshot: window.__h13LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!stepped.text.includes("gather") || !stepped.text.includes("broadcast") || stepped.snapshot.compatibleCount < hypergraph.snapshot.compatibleCount) {
    throw new Error(`Hypergraph correction did not improve gather-correct-broadcast compatibility: ${JSON.stringify(stepped)}.`);
  }

  await page.locator("#toggleMode").click();
  await page.locator("#flipDirection").click();
  await page.waitForFunction(() => window.__h13LabSnapshot().flipped === true && window.__h13LabSnapshot().mode === "directed");
  const flipped = await page.evaluate(() => ({
    snapshot: window.__h13LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!flipped.text.includes("reversing") || !flipped.text.includes("source/target maps") || flipped.snapshot.asymmetry < 0.1) {
    throw new Error(`Directed role reversal did not change asymmetric residuals: ${JSON.stringify(flipped)}.`);
  }

  await page.locator("#balance").click();
  await page.waitForFunction(() => window.__h13LabSnapshot().projectionCount > 0);
  const projected = await page.evaluate(() => ({
    snapshot: window.__h13LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!projected.text.includes("edge-stalk agreement") || projected.snapshot.projectionDefect > flipped.snapshot.projectionDefect) {
    throw new Error(`Projection action did not expose sheaf consistency text: ${JSON.stringify(projected)}.`);
  }

  await page.locator("#showClique").click();
  await page.waitForFunction(() => window.__h13LabSnapshot().mode === "clique");
  const clique = await page.evaluate(() => ({
    snapshot: window.__h13LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!clique.text.includes("clique expansion") || clique.snapshot.groupStalkVisible !== false || clique.snapshot.cliqueExpansionEdgeCount < 10) {
    throw new Error(`Clique expansion did not visibly remove the shared group stalk: ${JSON.stringify(clique)}.`);
  }

  await page.setViewportSize({ width: 900, height: 700 });
  await assertNoDedicatedScrollbars(page, "narrow iframe");

  await browser.close();
  console.log("h13 smoke passed: concrete directed/hypergraph sheaf lab renders incidence objects, orbits, toggles group stalks, propagates corrections, flips roles, projects consistency, shows clique failure, and fits iframe.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
