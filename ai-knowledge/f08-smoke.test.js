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
  const labPath = path.join(__dirname, "f08-network-centrality-communities.html").replace(/\\/g, "/");

  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
  await page.waitForFunction(() => window.__f08LabReady === true && window.__f08LabSnapshot());
  await page.waitForTimeout(180);

  const initial = await page.evaluate(() => {
    const canvas = document.querySelector(".lab-viewport canvas");
    return {
      bytes: canvas.toDataURL("image/png").length,
      snapshot: window.__f08LabSnapshot(),
      stateText: document.querySelector("#state").textContent.trim()
    };
  });
  if (initial.bytes < 9000) throw new Error(`F08 lab canvas appears blank; png payload only ${initial.bytes} bytes.`);
  if (initial.snapshot.has3d !== true || initial.snapshot.nodeCount < 10 || initial.snapshot.edgeCount < 10) {
    throw new Error(`F08 lab did not expose useful 3D network state: ${JSON.stringify(initial.snapshot)}.`);
  }
  if (!/centrality|betweenness|community|Degree/i.test(initial.stateText)) {
    throw new Error(`Initial F08 diagnostics are weak: ${initial.stateText}`);
  }
  await assertNoDedicatedScrollbars(page, "desktop iframe");

  const beforeOrbit = await page.evaluate(() => window.__f08LabSnapshot().cameraTheta);
  const canvasBox = await page.locator(".lab-viewport canvas").boundingBox();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.35, canvasBox.y + canvasBox.height * 0.58);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.70, canvasBox.y + canvasBox.height * 0.32, { steps: 8 });
  await page.mouse.up();
  const afterOrbit = await page.evaluate(() => window.__f08LabSnapshot().cameraTheta);
  if (Math.abs(afterOrbit - beforeOrbit) < 0.05) {
    throw new Error("Dragging the canvas did not orbit the 3D network visualization.");
  }

  await page.selectOption("#scenario", "smallWorld");
  await page.selectOption("#metric", "betweenness");
  await page.selectOption("#viewSelect", "communities");
  await page.locator("#recompute").click();
  await page.waitForFunction(() => window.__f08LabSnapshot().scenario === "smallWorld" && window.__f08LabSnapshot().metric === "betweenness");
  const betweenness = await page.evaluate(() => ({
    snapshot: window.__f08LabSnapshot(),
    formula: document.querySelector("#formulaText").textContent.trim(),
    text: document.querySelector("#state").textContent.trim()
  }));
  if (!/shortest paths/i.test(betweenness.formula) || betweenness.snapshot.topScore <= 0) {
    throw new Error(`F08 betweenness diagnostics are weak: ${JSON.stringify(betweenness)}.`);
  }

  await page.locator("#attackTop").click();
  await page.waitForFunction(() => window.__f08LabSnapshot().status === "Attack" && window.__f08LabSnapshot().removedCount >= 1);
  const attacked = await page.evaluate(() => ({
    snapshot: window.__f08LabSnapshot(),
    text: document.querySelector("#state").textContent.trim()
  }));
  if (!/Targeted attack|Robustness|largest connected component/i.test(attacked.text)) {
    throw new Error(`F08 attack state text is weak: ${attacked.text}`);
  }

  await page.locator("#runCascade").click();
  await page.waitForFunction(() => window.__f08LabSnapshot().status === "Cascade");
  const cascade = await page.evaluate(() => document.querySelector("#state").textContent.trim());
  if (!/Cascade attack|fragmentation|longer routes/i.test(cascade)) {
    throw new Error(`F08 cascade state text is weak: ${cascade}`);
  }

  await page.locator("#reset").click();
  await page.locator("#addShortcut").click();
  await page.waitForFunction(() => window.__f08LabSnapshot().status === "Shortcut" && window.__f08LabSnapshot().shortcuts >= 1);
  const shortcut = await page.evaluate(() => document.querySelector("#state").textContent.trim());
  if (!/shortcut|average path|communities/i.test(shortcut)) {
    throw new Error(`F08 shortcut state text is weak: ${shortcut}`);
  }

  await page.selectOption("#viewSelect", "null");
  const nullView = await page.evaluate(() => ({
    snapshot: window.__f08LabSnapshot(),
    bytes: document.querySelector(".lab-viewport canvas").toDataURL("image/png").length
  }));
  if (nullView.bytes < 9000 || nullView.snapshot.view !== "null") {
    throw new Error(`F08 null-model view did not render: ${JSON.stringify(nullView)}.`);
  }

  await page.setViewportSize({ width: 900, height: 700 });
  await assertNoDedicatedScrollbars(page, "narrow iframe");

  await browser.close();
  console.log("f08 smoke passed: 3D network science lab renders, orbits, ranks centrality, attacks nodes, adds shortcuts, shows null model, and fits iframe.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
