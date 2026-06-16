const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

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

async function waitForLabFrame(page, fileName) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const frame = page.frames().find((candidate) => candidate.url().includes(fileName));
    if (frame) return frame;
    await page.waitForTimeout(100);
  }
  throw new Error(`No iframe loaded ${fileName}.`);
}

function canvasInkScore(canvas) {
  const copy = document.createElement("canvas");
  copy.width = canvas.width;
  copy.height = canvas.height;
  const ctx = copy.getContext("2d");
  ctx.drawImage(canvas, 0, 0);
  const sample = ctx.getImageData(0, 0, copy.width, copy.height).data;
  let ink = 0;
  for (let i = 0; i < sample.length; i += 16) {
    const r = sample[i];
    const g = sample[i + 1];
    const b = sample[i + 2];
    if (r < 245 || g < 245 || b < 245) ink += 1;
  }
  return ink;
}

async function main() {
  const notePath = path.resolve(__dirname, "..", "D07- Metric Learning.md");
  const note = fs.readFileSync(notePath, "utf8");
  const match = note.match(/<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/i);
  if (!match) throw new Error("D07 note does not contain an iframe.");

  const iframeHtml = match[0];
  const src = match[1];
  const labFile = "d07-metric-learning-lab.html";
  const expectedSrc = `http://127.0.0.1:8765/${labFile}`;
  if (src !== expectedSrc) {
    throw new Error(`D07 iframe should use the local Obsidian lab server src, got: ${src}`);
  }
  if (!/height\s*=\s*["']720["']/i.test(iframeHtml)) {
    throw new Error(`D07 iframe should use a 720px no-scroll viewport, got: ${iframeHtml}`);
  }
  if (!/background:\s*#071015/i.test(iframeHtml)) {
    throw new Error("D07 iframe should set the dark lab background to avoid Obsidian black/white flash.");
  }

  const noteDir = path.resolve(__dirname, "..");
  const harnessPath = path.join(noteDir, "__d07_iframe_harness.html");
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  let result;
  try {
    fs.writeFileSync(harnessPath, `<!doctype html><meta charset="utf-8">${iframeHtml}`, "utf8");
    const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
    await page.goto(pathToFileURL(harnessPath).href);
    const frame = await waitForLabFrame(page, labFile);
    await frame.locator("canvas").waitFor({ state: "visible" });
    await frame.waitForFunction(() => window.__d07LabReady === true && window.__d07LabSnapshot && window.__d07LabSnapshot());

    await frame.selectOption("#lossType", "triplet");
    await frame.selectOption("#metricType", "mahalanobis");
    await frame.selectOption("#miningMode", "hard");
    await frame.click("#mineTriplet");
    await frame.click("#trainStep");
    await frame.waitForTimeout(220);

    result = await frame.evaluate((scoreFnSource) => {
      const score = Function(`return (${scoreFnSource})`)();
      const canvas = document.querySelector("canvas");
      return {
        bytes: canvas.toDataURL("image/png").length,
        ink: score(canvas),
        snapshot: window.__d07LabSnapshot(),
        loss: document.querySelector("#lossLabel").textContent.trim(),
        knn: document.querySelector("#scoreBadge").textContent.trim(),
        stateText: document.querySelector(".state-box").textContent.trim(),
        shellBackground: getComputedStyle(document.querySelector(".lab-3d-shell")).backgroundColor
      };
    }, canvasInkScore.toString());
  } finally {
    await browser.close();
    if (fs.existsSync(harnessPath)) fs.unlinkSync(harnessPath);
  }

  if (result.bytes < 12000 || result.ink < 400) {
    throw new Error(`D07 embedded iframe render is weak: ${JSON.stringify(result)}.`);
  }
  if (result.snapshot.metricType !== "mahalanobis" || result.snapshot.miningMode !== "hard") {
    throw new Error(`D07 embedded iframe controls did not update snapshot: ${JSON.stringify(result)}.`);
  }
  if (!/^\d+\.\d{3}$/.test(result.loss) || !/%$/.test(result.knn)) {
    throw new Error(`D07 embedded iframe diagnostics are malformed: ${JSON.stringify(result)}.`);
  }
  if (!/anchor/i.test(result.stateText) || !/negative/i.test(result.stateText) || !/hard negative|Triplet step/i.test(result.stateText)) {
    throw new Error(`D07 embedded iframe state text is weak: ${JSON.stringify(result)}.`);
  }
  console.log(`D07 local-server iframe render passed: ${src}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
