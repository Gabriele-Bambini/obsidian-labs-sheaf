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

async function main() {
  const notePath = path.resolve(__dirname, "..", "F04 - Spectral Graph Theory.md");
  const note = fs.readFileSync(notePath, "utf8");
  const match = note.match(/<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/i);
  if (!match) throw new Error("F04 note does not contain an iframe.");

  const iframeHtml = match[0];
  const src = match[1];
  const labFile = "f04-spectral-embedding.html";
  const expectedSrc = `http://127.0.0.1:8765/${labFile}`;
  if (src !== expectedSrc) {
    throw new Error(`F04 iframe should use the local Obsidian lab server src, got: ${src}`);
  }

  const noteDir = path.resolve(__dirname, "..");
  const harnessPath = path.join(noteDir, "__f04_iframe_harness.html");
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
    await frame.waitForFunction(() => window.__f04LabReady === true && window.__f04LabSnapshot());
    await frame.waitForTimeout(180);

    result = await frame.evaluate(() => ({
      bytes: document.querySelector(".lab-viewport canvas").toDataURL("image/png").length,
      snapshot: window.__f04LabSnapshot(),
      stateText: document.querySelector("#stateText").textContent.trim()
    }));
  } finally {
    await browser.close();
    if (fs.existsSync(harnessPath)) fs.unlinkSync(harnessPath);
  }

  if (result.bytes < 9000 || result.snapshot.nodeCount !== 6 || result.snapshot.edgeCount !== 7 || result.snapshot.lambda2 <= 0) {
    throw new Error(`F04 embedded iframe render is weak: ${JSON.stringify(result)}.`);
  }
  if (!/Fiedler|lambda2|Dirichlet/i.test(result.stateText)) {
    throw new Error(`F04 embedded iframe state text is weak: ${result.stateText}`);
  }
  console.log(`F04 local-server iframe render passed: ${src}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
