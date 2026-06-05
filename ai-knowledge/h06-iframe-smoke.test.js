const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { ensureLocalServer } = require("./local-iframe-test-server");

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

async function waitForLabFrame(page, fileName) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const frame = page.frames().find((candidate) => candidate.url().includes(fileName));
    if (frame) return frame;
    await page.waitForTimeout(100);
  }
  throw new Error(`No iframe loaded ${fileName}.`);
}

async function main() {
  const notePath = path.resolve(__dirname, "..", "H06 - Sheaf Diffusion.md");
  const note = fs.readFileSync(notePath, "utf8");
  const match = note.match(/<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/i);
  if (!match) throw new Error("H06 note does not contain an iframe.");

  const iframeHtml = match[0];
  const src = match[1];
  const labFile = "h06-sheaf-diffusion.html";
  const expectedSrc = `http://127.0.0.1:8765/${labFile}`;
  if (src !== expectedSrc) {
    throw new Error(`H06 iframe should use the local Obsidian lab server src, got: ${src}`);
  }

  const noteDir = path.resolve(__dirname, "..");
  const harnessPath = path.join(noteDir, "__h06_iframe_harness.html");
  const closeLocalServer = await ensureLocalServer(__dirname);
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
    await frame.waitForFunction(() => window.__h06LabReady === true && window.__h06LabSnapshot());
    await frame.waitForTimeout(180);

    result = await frame.evaluate(() => ({
      bytes: document.querySelector(".lab-viewport canvas").toDataURL("image/png").length,
      snapshot: window.__h06LabSnapshot(),
      stateText: document.querySelector("#state").textContent.trim()
    }));
  } finally {
    await browser.close();
    if (fs.existsSync(harnessPath)) fs.unlinkSync(harnessPath);
    await closeLocalServer();
  }

  if (
    result.bytes < 9000 ||
    result.snapshot.kind !== "sheaf-heat-equation-diffusion" ||
    result.snapshot.nodeStalkCount !== 4 ||
    result.snapshot.edgeResidualCount !== 4 ||
    result.snapshot.heatTracePointCount < 8
  ) {
    throw new Error(`H06 embedded iframe render is weak: ${JSON.stringify(result)}`);
  }
  if (!/sheaf diffusion|edge residual|global section|heat equation/i.test(result.stateText)) {
    throw new Error(`H06 embedded iframe state text is weak: ${result.stateText}`);
  }
  console.log(`H06 local-server iframe render passed: ${src}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
