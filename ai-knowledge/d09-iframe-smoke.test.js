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

async function main() {
  const notePath = path.resolve(__dirname, "..", "D09- Regularization Techniques.md");
  const note = fs.readFileSync(notePath, "utf8");
  const match = note.match(/<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/i);
  if (!match) throw new Error("D09 note does not contain an iframe.");

  const iframeHtml = match[0];
  const src = match[1];
  const labFile = "d09-regularization-lab.html";
  const expectedSrc = `http://127.0.0.1:8765/${labFile}`;
  if (src !== expectedSrc) {
    throw new Error(`D09 iframe should use the local Obsidian lab server src, got: ${src}`);
  }
  if (!/height\s*=\s*["']720["']/i.test(iframeHtml)) {
    throw new Error(`D09 iframe should use a 720px no-scroll viewport, got: ${iframeHtml}`);
  }
  if (!/background:\s*#071015/i.test(iframeHtml)) {
    throw new Error("D09 iframe should set the dark lab background to avoid Obsidian black/white flash.");
  }

  const noteDir = path.resolve(__dirname, "..");
  const harnessPath = path.join(noteDir, "__d09_iframe_harness.html");
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
    await frame.locator(".lab-viewport canvas").waitFor({ state: "visible" });
    await frame.waitForFunction(() => window.__d09LabReady === true && window.__d09LabSnapshot && window.__d09LabSnapshot());

    await frame.selectOption("#regularizer", "elastic");
    await frame.selectOption("#scenario", "wiggle");
    await frame.fill("#degree", "10");
    await frame.click("#raise");
    await frame.click("#best");
    await frame.waitForTimeout(220);

    result = await frame.evaluate(() => {
      const canvas = document.querySelector(".lab-viewport canvas");
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      return {
        hasWebgl: Boolean(gl),
        bytes: canvas.toDataURL("image/png").length,
        snapshot: window.__d09LabSnapshot(),
        train: document.querySelector("#trainLabel").textContent.trim(),
        test: document.querySelector("#testLabel").textContent.trim(),
        active: document.querySelector("#activeLabel").textContent.trim(),
        stateText: document.querySelector(".state-box").textContent.trim(),
        shellBackground: getComputedStyle(document.querySelector(".lab-3d-shell")).backgroundColor
      };
    });
  } finally {
    await browser.close();
    if (fs.existsSync(harnessPath)) fs.unlinkSync(harnessPath);
  }

  if (!result.hasWebgl || result.bytes < 12000) {
    throw new Error(`D09 embedded iframe render is weak: ${JSON.stringify(result)}.`);
  }
  if (result.snapshot.regularizer !== "elastic" || result.snapshot.scenario !== "wiggle") {
    throw new Error(`D09 embedded iframe controls did not update snapshot: ${JSON.stringify(result)}.`);
  }
  if (result.snapshot.testError <= 0 || result.snapshot.norm <= 0 || result.snapshot.coefficientCount < 2) {
    throw new Error(`D09 embedded iframe diagnostics are weak: ${JSON.stringify(result)}.`);
  }
  if (!/^\d+\.\d{3}$/.test(result.train) || !/^\d+\.\d{3}$/.test(result.test) || !/^\d+\/\d+$/.test(result.active)) {
    throw new Error(`D09 embedded iframe metric labels are malformed: ${JSON.stringify(result)}.`);
  }
  if (!/regularization|validation|coefficient|shrink/i.test(result.stateText)) {
    throw new Error(`D09 embedded iframe state text is weak: ${JSON.stringify(result)}.`);
  }

  console.log(`D09 local-server iframe render passed: ${src}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
