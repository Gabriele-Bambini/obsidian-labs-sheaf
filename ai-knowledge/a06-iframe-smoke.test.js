const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

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

async function waitForLabFrame(page, fileName) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const frame = page.frames().find((candidate) => candidate.url().includes(fileName));
    if (frame) return frame;
    await page.waitForTimeout(100);
  }
  throw new Error(`No iframe loaded ${fileName}.`);
}

async function main() {
  const notePath = path.resolve(__dirname, "..", "A06- Topology Basics.md");
  const note = fs.readFileSync(notePath, "utf8");
  const match = note.match(/<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/i);
  if (!match) throw new Error("A06 note does not contain an iframe.");

  const iframeHtml = match[0];
  const src = match[1];
  const labFile = "a06-topology-neighborhood-lab.html";
  const expectedSrc = `http://127.0.0.1:8765/${labFile}`;
  if (src !== expectedSrc) {
    throw new Error(`A06 iframe should use the local Obsidian lab server src, got: ${src}`);
  }
  if (!/height\s*=\s*["']720["']/i.test(iframeHtml)) {
    throw new Error(`A06 iframe should use a 720px no-scroll viewport, got: ${iframeHtml}`);
  }
  if (!/background:\s*#071015/i.test(iframeHtml)) {
    throw new Error("A06 iframe should set the dark lab background to avoid Obsidian black/white flash.");
  }

  const noteDir = path.resolve(__dirname, "..");
  const harnessPath = path.join(noteDir, "__a06_iframe_harness.html");
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
    await frame.locator(".lab-viewport canvas#canvas").waitFor({ state: "visible" });
    await frame.waitForFunction(() => window.__a06LabReady === true && window.__a06LabSnapshot());
    await frame.waitForTimeout(180);

    result = await frame.evaluate(() => ({
      bytes: document.querySelector(".lab-viewport canvas#canvas").toDataURL("image/png").length,
      snapshot: window.__a06LabSnapshot(),
      stateText: document.querySelector("#stateBox").textContent.trim(),
      selectedText: document.querySelector("[data-role='selected'] strong").textContent.trim(),
      rail: [...document.querySelectorAll(".concept-rail span")].map((node) => node.textContent.trim()),
      root: {
        visualKind: document.querySelector(".gnn-lab").dataset.visualKind,
        graphStyle: document.querySelector(".gnn-lab").dataset.graphStyle
      }
    }));
  } finally {
    await browser.close();
    if (fs.existsSync(harnessPath)) fs.unlinkSync(harnessPath);
  }

  if (result.bytes < 10000) {
    throw new Error(`A06 embedded iframe render is weak: ${JSON.stringify(result)}.`);
  }
  if (result.snapshot.visualKind !== "topology-space-lab" || result.root.visualKind !== "topology-space-lab") {
    throw new Error(`A06 iframe should use the dedicated topology-space-lab visual: ${JSON.stringify(result)}.`);
  }
  if (result.snapshot.graphStyle !== "hidden" || result.root.graphStyle !== "hidden") {
    throw new Error(`A06 iframe should hide generic graph scaffolding: ${JSON.stringify(result.root)}.`);
  }
  if (!/topology|open set|neighborhood|boundary|continuity/i.test(result.stateText)) {
    throw new Error(`A06 embedded iframe state text is weak: ${result.stateText}`);
  }
  if (!/Topology|open sets|preimage|compact|quotient/i.test(result.selectedText)) {
    throw new Error(`A06 embedded iframe selected chip is weak: ${result.selectedText}`);
  }
  for (const label of ["space X", "open neighborhoods", "boundary", "preimage test", "finite subcover"]) {
    if (!result.rail.includes(label)) throw new Error(`A06 iframe missing concept rail chip "${label}".`);
  }
  console.log(`A06 local-server iframe render passed: ${src}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
