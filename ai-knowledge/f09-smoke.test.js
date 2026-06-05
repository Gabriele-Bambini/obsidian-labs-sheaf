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
    const elements = [...document.querySelectorAll(".lab-3d-shell, .stage, .lab-viewport, .lab-3d-panel, .controls")];
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

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 700 } });
  const labPath = path.join(__dirname, "f09-hypergraph-incidence-lab.html").replace(/\\/g, "/");

  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
  await page.waitForFunction(() => window.__f09LabReady === true && window.__f09LabSnapshot());
  await page.waitForTimeout(180);

  const initial = await page.evaluate(() => {
    const canvas = document.querySelector(".lab-viewport canvas");
    return {
      bytes: canvas.toDataURL("image/png").length,
      snapshot: window.__f09LabSnapshot(),
      stateText: document.querySelector("#state").textContent.trim()
    };
  });
  if (initial.bytes < 9000) throw new Error(`F09 lab canvas appears blank; png payload only ${initial.bytes} bytes.`);
  if (initial.snapshot.has3d !== true || initial.snapshot.nodeCount < 6 || initial.snapshot.hyperedgeCount < 3) {
    throw new Error(`F09 lab did not expose useful 3D hypergraph state: ${JSON.stringify(initial.snapshot)}.`);
  }
  if (!/higher-order|incidence|hyperedge/i.test(initial.stateText)) {
    throw new Error(`Initial F09 diagnostics are weak: ${initial.stateText}`);
  }
  await assertNoDedicatedScrollbars(page, "desktop iframe");

  const beforeOrbit = await page.evaluate(() => window.__f09LabSnapshot().cameraTheta);
  const canvasBox = await page.locator(".lab-viewport canvas").boundingBox();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.35, canvasBox.y + canvasBox.height * 0.58);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.70, canvasBox.y + canvasBox.height * 0.32, { steps: 8 });
  await page.mouse.up();
  const afterOrbit = await page.evaluate(() => window.__f09LabSnapshot().cameraTheta);
  if (Math.abs(afterOrbit - beforeOrbit) < 0.05) {
    throw new Error("Dragging the canvas did not orbit the 3D hypergraph visualization.");
  }

  await page.locator("#passMessages").click();
  await page.waitForFunction(() => ["toEdge", "toNode", "idle"].includes(window.__f09LabSnapshot().phase));
  await page.waitForFunction(() => window.__f09LabSnapshot().stepCount >= 1);
  const passed = await page.evaluate(() => ({
    snapshot: window.__f09LabSnapshot(),
    text: document.querySelector("#state").textContent.trim()
  }));
  if (passed.snapshot.stepCount < 1 || !/Phase|incidence pass|hyperedge summary/i.test(passed.text)) {
    throw new Error(`F09 message passing diagnostics are weak: ${JSON.stringify(passed)}.`);
  }

  await page.selectOption("#scenario", "reaction");
  await page.selectOption("#viewSelect", "star");
  await page.locator("#toggleExpansion").click();
  await page.waitForFunction(() => window.__f09LabSnapshot().scenario === "reaction" && window.__f09LabSnapshot().view === "clique");
  const expansion = await page.evaluate(() => ({
    snapshot: window.__f09LabSnapshot(),
    formula: document.querySelector("#formulaText").textContent.trim(),
    text: document.querySelector("#state").textContent.trim()
  }));
  if (expansion.snapshot.cliqueEdges < 3 || !/star|clique|pairwise/i.test(expansion.text)) {
    throw new Error(`F09 expansion diagnostics are weak: ${JSON.stringify(expansion)}.`);
  }

  await page.selectOption("#normalization", "sum");
  await page.locator("#runPasses").click();
  await page.waitForFunction(() => window.__f09LabSnapshot().status === "Run");
  const batch = await page.evaluate(() => ({
    snapshot: window.__f09LabSnapshot(),
    text: document.querySelector("#state").textContent.trim()
  }));
  if (batch.snapshot.stepCount < 2 || !/incidence passes|overlapping hyperedges|smooth/i.test(batch.text)) {
    throw new Error(`F09 batch propagation diagnostics are weak: ${JSON.stringify(batch)}.`);
  }

  await page.selectOption("#viewSelect", "matrix");
  const matrix = await page.evaluate(() => ({
    snapshot: window.__f09LabSnapshot(),
    bytes: document.querySelector(".lab-viewport canvas").toDataURL("image/png").length
  }));
  if (matrix.bytes < 9000 || matrix.snapshot.view !== "matrix") {
    throw new Error(`F09 incidence matrix view did not render: ${JSON.stringify(matrix)}.`);
  }

  await page.locator("#perturb").click();
  await page.waitForFunction(() => window.__f09LabSnapshot().status === "Perturb");
  const perturbed = await page.evaluate(() => document.querySelector("#state").textContent.trim());
  if (!/Perturbed node|group containing the node/i.test(perturbed)) {
    throw new Error(`F09 perturbation state text is weak: ${perturbed}`);
  }

  await page.setViewportSize({ width: 900, height: 700 });
  await assertNoDedicatedScrollbars(page, "narrow iframe");

  await browser.close();
  console.log("f09 smoke passed: 3D hypergraph lab renders, orbits, propagates incidence messages, compares expansions, shows the matrix, perturbs nodes, and fits iframe.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
