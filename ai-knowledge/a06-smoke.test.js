const path = require("path");

function loadPlaywright() {
  try {
    return require("playwright");
  } catch (error) {
    try {
      return require("C:/Users/02gab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
    } catch (fallbackError) {
      try {
        return require("C:/Users/02gab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright");
      } catch (pnpmError) {
        return require("C:/Users/Gabriele/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
      }
    }
  }
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
  const labPath = path.join(__dirname, "a06-topology-neighborhood-lab.html").replace(/\\/g, "/");

  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas#canvas").waitFor({ state: "visible" });
  await page.waitForFunction(() => window.__a06LabReady === true && window.__a06LabSnapshot());
  await page.waitForTimeout(260);

  const initial = await page.evaluate(() => {
    const canvas = document.querySelector(".lab-viewport canvas#canvas");
    return {
      bytes: canvas.toDataURL("image/png").length,
      snapshot: window.__a06LabSnapshot(),
      stateText: document.querySelector("#stateBox").textContent.trim(),
      selectedText: document.querySelector("[data-role='selected'] strong").textContent.trim(),
      rail: [...document.querySelectorAll(".concept-rail span")].map((node) => node.textContent.trim()),
      modeLabels: [...document.querySelectorAll("[data-control='mode'] option")].map((node) => node.textContent.trim()),
      metricLabels: [...document.querySelectorAll("[data-role='metric'] span")].map((node) => node.textContent.trim()),
      root: {
        visualKind: document.querySelector(".gnn-lab").dataset.visualKind,
        graphStyle: document.querySelector(".gnn-lab").dataset.graphStyle
      }
    };
  });

  if (initial.bytes < 10000) throw new Error(`A06 lab canvas appears blank; png payload only ${initial.bytes} bytes.`);
  if (initial.snapshot.visualKind !== "topology-space-lab" || initial.root.visualKind !== "topology-space-lab") {
    throw new Error(`A06 should use the dedicated topology-space-lab visual: ${JSON.stringify(initial.snapshot)}.`);
  }
  if (initial.snapshot.graphStyle !== "hidden" || initial.root.graphStyle !== "hidden") {
    throw new Error(`A06 should hide generic graph scaffolding: ${JSON.stringify(initial.root)}.`);
  }
  if (!/topology|open set|neighborhood|boundary|continuity/i.test(initial.stateText)) {
    throw new Error(`Initial A06 explanation is not topology-specific enough: ${initial.stateText}`);
  }
  if (!/Topology|open sets|preimage|compact|quotient/i.test(initial.selectedText)) {
    throw new Error(`A06 selected chip should summarize topological structure: ${initial.selectedText}`);
  }
  for (const label of ["space X", "open neighborhoods", "boundary", "preimage test", "finite subcover"]) {
    if (!initial.rail.includes(label)) throw new Error(`A06 missing concept rail chip "${label}": ${initial.rail.join(" | ")}`);
  }
  for (const label of ["Open neighborhoods", "Continuity preimage", "Compact subcover", "Connected split", "Quotient glue"]) {
    if (!initial.modeLabels.includes(label)) throw new Error(`A06 missing mode "${label}".`);
  }
  for (const label of ["Open coverage", "Boundary count", "Subcover size", "Continuity score"]) {
    if (!initial.metricLabels.includes(label)) throw new Error(`A06 missing metric "${label}".`);
  }
  await assertNoDedicatedScrollbars(page, "desktop iframe");

  const beforeOrbit = await page.evaluate(() => window.__a06LabSnapshot().cameraTheta);
  const canvasBox = await page.locator(".lab-viewport canvas").boundingBox();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.34, canvasBox.y + canvasBox.height * 0.58);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.72, canvasBox.y + canvasBox.height * 0.30, { steps: 8 });
  await page.mouse.up();
  const afterOrbit = await page.evaluate(() => window.__a06LabSnapshot().cameraTheta);
  if (Math.abs(afterOrbit - beforeOrbit) < 0.05) {
    throw new Error("Dragging the canvas did not orbit the A06 topology scene.");
  }

  await page.selectOption("[data-control='mode']", "continuity");
  await setRange(page, "#a06-map", "1.45");
  await setRange(page, "#a06-radius", "0.55");
  await page.locator("[data-action='pulse']").click();
  await page.waitForTimeout(120);
  const pulse = await page.locator("#stateBox").textContent();
  if (!/Pulse.*preimage|target open set|continuous|open in X/i.test(pulse)) {
    throw new Error(`A06 Pulse should perform the continuity preimage task: ${pulse}`);
  }

  await page.selectOption("[data-control='mode']", "compact");
  await setRange(page, "#a06-cover", "7");
  await page.locator("[data-action='step']").click();
  await page.waitForTimeout(120);
  const compact = await page.evaluate(() => ({
    text: document.querySelector("#stateBox").textContent.trim(),
    metrics: [...document.querySelectorAll("[data-role='metric'] strong")].map((node) => node.textContent.trim()),
    snapshot: window.__a06LabSnapshot()
  }));
  if (!/Step.*open cover|finite subcover|compactness|finite control/i.test(compact.text)) {
    throw new Error(`A06 Step should perform the compact-subcover task: ${compact.text}`);
  }
  if (compact.snapshot.params.cover !== 7) {
    throw new Error(`A06 snapshot did not retain cover parameter: ${JSON.stringify(compact.snapshot.params)}.`);
  }
  if (!compact.metrics.some((value) => Number.parseFloat(value) >= 2)) {
    throw new Error(`A06 subcover metric should be visible: ${compact.metrics.join(", ")}`);
  }

  await page.selectOption("[data-control='mode']", "connected");
  await setRange(page, "#a06-separation", "0.80");
  await page.waitForTimeout(120);
  const split = await page.locator("#stateBox").textContent();
  if (!/connected|split|separation|disjoint open/i.test(split)) {
    throw new Error(`A06 connected-split mode should explain disconnection: ${split}`);
  }

  await page.selectOption("[data-control='mode']", "quotient");
  await setRange(page, "#a06-glue", "0.95");
  await page.locator("[data-action='step']").click();
  await page.waitForTimeout(120);
  const quotient = await page.locator("#stateBox").textContent();
  if (!/Step.*quotient|glue|0 and 1|circle|projection/i.test(quotient)) {
    throw new Error(`A06 Step should explain quotient endpoint gluing: ${quotient}`);
  }

  await page.setViewportSize({ width: 900, height: 700 });
  await assertNoDedicatedScrollbars(page, "narrow iframe");

  await browser.close();
  console.log("a06 smoke passed: dedicated topology visual renders, orbits, and gives Pulse/Step real topology tasks.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
