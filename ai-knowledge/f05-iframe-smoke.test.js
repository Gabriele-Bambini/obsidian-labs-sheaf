const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

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

async function waitForLabFrame(page, fileName) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const frame = page.frames().find((candidate) => candidate.url().includes(fileName));
    if (frame) return frame;
    await page.waitForTimeout(100);
  }
  throw new Error(`No iframe loaded ${fileName}.`);
}

async function setRange(frame, selector, value) {
  await frame.locator(selector).evaluate((input, nextValue) => {
    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function main() {
  const notePath = path.resolve(__dirname, "..", "F05 - Graph Clustering.md");
  const note = fs.readFileSync(notePath, "utf8");
  const match = note.match(/<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/i);
  if (!match) throw new Error("F05 note does not contain an iframe.");

  const iframeHtml = match[0];
  const src = match[1];
  const labFile = "f05-graph-clustering-lab.html";
  const expectedSrc = `http://127.0.0.1:8765/${labFile}`;
  if (src !== expectedSrc) {
    throw new Error(`F05 iframe should use the local Obsidian lab server src, got: ${src}`);
  }
  if (!/height\s*=\s*["']720["']/i.test(iframeHtml)) {
    throw new Error(`F05 iframe should use a 720px no-scroll viewport, got: ${iframeHtml}`);
  }
  if (!/background:\s*#071015/i.test(iframeHtml)) {
    throw new Error("F05 iframe should set the dark lab background to avoid Obsidian black/white flash.");
  }

  const noteDir = path.resolve(__dirname, "..");
  const harnessPath = path.join(noteDir, "__f05_iframe_harness.html");
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  let result;
  let spectral;
  let objective;
  let noisy;
  try {
    fs.writeFileSync(harnessPath, `<!doctype html><meta charset="utf-8">${iframeHtml}`, "utf8");
    const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
    await page.goto(pathToFileURL(harnessPath).href);
    const frame = await waitForLabFrame(page, labFile);
    await frame.locator(".lab-viewport canvas").waitFor({ state: "visible" });
    await frame.waitForFunction(() => window.__f05LabReady === true && window.__f05LabSnapshot && window.__f05LabSnapshot());
    await frame.waitForTimeout(220);

    result = await frame.evaluate(() => {
      const canvas = document.querySelector(".lab-viewport canvas");
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      return {
        hasWebgl: Boolean(gl),
        bytes: canvas.toDataURL("image/png").length,
        snapshot: window.__f05LabSnapshot(),
        stateText: document.querySelector("#stateBox").textContent.trim(),
        shellBackground: getComputedStyle(document.querySelector(".lab-3d-shell")).backgroundColor
      };
    });

    await frame.locator("#mode").selectOption("spectral");
    await frame.waitForFunction(() => window.__f05LabSnapshot().mode === "spectral");
    spectral = await frame.evaluate(() => ({
      snapshot: window.__f05LabSnapshot(),
      stateText: document.querySelector("#stateBox").textContent.trim()
    }));

    await frame.locator("#graphType").selectOption("ring");
    await frame.locator("#mode").selectOption("objective");
    await setRange(frame, "#clusterCount", "3");
    await frame.waitForFunction(() => window.__f05LabSnapshot().graphType === "ring" && window.__f05LabSnapshot().clusterCount === 3);
    objective = await frame.evaluate(() => ({
      snapshot: window.__f05LabSnapshot(),
      stateText: document.querySelector("#stateBox").textContent.trim()
    }));

    await frame.locator("#mode").selectOption("stability");
    const beforeNoise = await frame.evaluate(() => window.__f05LabSnapshot().stability);
    await setRange(frame, "#noiseEdges", "0.55");
    await frame.waitForFunction(
      (previous) => window.__f05LabSnapshot().noiseEdges > 0.5 && window.__f05LabSnapshot().stability < previous,
      beforeNoise
    );
    noisy = await frame.evaluate((previous) => ({
      beforeNoise: previous,
      snapshot: window.__f05LabSnapshot(),
      stateText: document.querySelector("#stateBox").textContent.trim()
    }), beforeNoise);
  } finally {
    await browser.close();
    if (fs.existsSync(harnessPath)) fs.unlinkSync(harnessPath);
  }

  if (!result.hasWebgl || result.bytes < 12000 || result.snapshot.mode !== "partition") {
    throw new Error(`F05 embedded iframe render is weak: ${JSON.stringify(result)}.`);
  }
  if (result.snapshot.nodeCount < 12 || result.snapshot.modularity <= 0 || result.snapshot.conductance <= 0) {
    throw new Error(`F05 embedded partition diagnostics are weak: ${JSON.stringify(result)}.`);
  }
  if (!/conductance|modularity|cut/i.test(result.stateText)) {
    throw new Error(`F05 embedded partition state text is weak: ${JSON.stringify(result)}.`);
  }
  if (!/Fiedler|eigengap/i.test(spectral.stateText) || spectral.snapshot.eigengap <= 0 || spectral.snapshot.fiedlerSpread <= 0) {
    throw new Error(`F05 embedded spectral diagnostics are weak: ${JSON.stringify(spectral)}.`);
  }
  if (!/RatioCut|Normalized Cut/i.test(objective.stateText) || objective.snapshot.normalizedCut <= 0) {
    throw new Error(`F05 embedded objective diagnostics are weak: ${JSON.stringify(objective)}.`);
  }
  if (!/stability/i.test(noisy.stateText) || noisy.snapshot.stability >= noisy.beforeNoise) {
    throw new Error(`F05 embedded stability diagnostics are weak: ${JSON.stringify(noisy)}.`);
  }

  console.log(`F05 local-server iframe render passed: ${src}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
