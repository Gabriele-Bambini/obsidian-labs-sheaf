const path = require("path");

function loadPlaywright() {
  const candidates = [
    "playwright",
    "C:/Users/02gab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
    "C:/Users/02gab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright",
    "C:/Users/Gabriele/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"
  ];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (error) {
      // Try the next known bundled runtime path.
    }
  }
  throw new Error("Playwright is not available from the known runtime paths.");
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
  const labPath = path.join(__dirname, "d05-clustering-algorithms-lab.html").replace(/\\/g, "/");

  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
  await page.waitForFunction(() => window.__d05LabReady === true && window.__d05LabSnapshot());
  await page.waitForTimeout(180);

  const initial = await page.evaluate(() => {
    const canvas = document.querySelector(".lab-viewport canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    return {
      hasWebgl: Boolean(gl),
      imageBytes: canvas.toDataURL("image/png").length,
      snapshot: window.__d05LabSnapshot(),
      stateText: document.querySelector("#stateBox").textContent.trim()
    };
  });
  if (!initial.hasWebgl) throw new Error("D05 lab did not create a WebGL canvas.");
  if (initial.imageBytes < 9000) throw new Error(`D05 lab canvas appears blank; png payload only ${initial.imageBytes} bytes.`);
  if (initial.snapshot.view !== "kmeans" || initial.snapshot.k !== 3 || initial.snapshot.inertia <= 0 || initial.snapshot.silhouette <= 0) {
    throw new Error(`D05 lab did not expose useful K-means diagnostics: ${JSON.stringify(initial.snapshot)}.`);
  }
  if (!initial.stateText.includes("K-means") || !initial.stateText.includes("centroid")) {
    throw new Error(`K-means state text is weak: ${initial.stateText}`);
  }
  await assertNoDedicatedScrollbars(page, "desktop iframe");

  const beforeOrbit = await page.evaluate(() => window.__d05LabSnapshot().cameraTheta);
  const canvasBox = await page.locator(".lab-viewport canvas").boundingBox();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.45, canvasBox.y + canvasBox.height * 0.55);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.74, canvasBox.y + canvasBox.height * 0.35, { steps: 8 });
  await page.mouse.up();
  const afterOrbit = await page.evaluate(() => window.__d05LabSnapshot().cameraTheta);
  if (Math.abs(afterOrbit - beforeOrbit) < 0.05) {
    throw new Error("Dragging the canvas did not orbit the 3D clustering visualization.");
  }

  await page.locator("#stepAlgo").click();
  await page.waitForFunction(() => window.__d05LabSnapshot().iteration >= 1);
  const stepped = await page.evaluate(() => window.__d05LabSnapshot());
  if (stepped.inertia <= 0 || stepped.assignmentChanges < 0) {
    throw new Error(`K-means step did not update assignments/inertia: ${JSON.stringify(stepped)}.`);
  }

  await page.locator("#dataset").selectOption("moons");
  await page.locator("#viewMode").selectOption("dbscan");
  await setRange(page, "#epsilon", "0.42");
  await page.waitForFunction(() => window.__d05LabSnapshot().view === "dbscan" && window.__d05LabSnapshot().dataset === "moons");
  const dbscan = await page.evaluate(() => ({
    snapshot: window.__d05LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!dbscan.text.includes("density-reachable") || dbscan.snapshot.dbscanClusters < 2 || dbscan.snapshot.corePoints <= 0) {
    throw new Error(`DBSCAN view did not expose density diagnostics: ${JSON.stringify(dbscan)}.`);
  }

  await page.locator("#viewMode").selectOption("gmm");
  await page.waitForFunction(() => window.__d05LabSnapshot().view === "gmm");
  const gmm = await page.evaluate(() => ({
    snapshot: window.__d05LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!gmm.text.includes("responsibility") || !Number.isFinite(gmm.snapshot.gmmUncertainty) || gmm.snapshot.gmmUncertainty <= 0) {
    throw new Error(`GMM view did not expose soft-assignment diagnostics: ${JSON.stringify(gmm)}.`);
  }

  await page.locator("#viewMode").selectOption("spectral");
  await setRange(page, "#neighborCount", "10");
  await page.waitForFunction(() => window.__d05LabSnapshot().view === "spectral");
  const spectral = await page.evaluate(() => ({
    snapshot: window.__d05LabSnapshot(),
    text: document.querySelector("#stateBox").textContent.trim()
  }));
  if (!spectral.text.includes("graph cut") || !spectral.text.includes("Laplacian") || spectral.snapshot.spectralCut <= 0) {
    throw new Error(`Spectral view did not expose graph-cut diagnostics: ${JSON.stringify(spectral)}.`);
  }

  await page.setViewportSize({ width: 900, height: 700 });
  await assertNoDedicatedScrollbars(page, "narrow iframe");

  await browser.close();
  console.log("d05 smoke passed: 3D clustering lab renders, orbits, steps K-means, exposes DBSCAN density, GMM responsibilities, spectral graph cuts, and fits iframe.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
