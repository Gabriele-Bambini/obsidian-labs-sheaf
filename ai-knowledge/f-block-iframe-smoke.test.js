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
const noteDir = path.resolve(__dirname, "..");

async function waitForFrame(page, fileName) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const frame = page.frames().find((candidate) => candidate.url().includes(fileName));
    if (frame) return frame;
    await page.waitForTimeout(100);
  }
  throw new Error(`No iframe loaded ${fileName}.`);
}

async function main() {
  const notes = fs
    .readdirSync(noteDir)
    .filter((name) => /^F\d+.*\.md$/.test(name))
    .sort();

  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });

  const failures = [];
  const renders = [];

  try {
    for (const noteName of notes) {
      const notePath = path.join(noteDir, noteName);
      const note = fs.readFileSync(notePath, "utf8");
      const match = note.match(/<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/i);
      if (!match) {
        failures.push(`${noteName}: missing iframe`);
        continue;
      }

      const iframeHtml = match[0];
      const src = match[1];
      const labFile = src.split("/").pop();
      if (!src.startsWith("http://127.0.0.1:8765/")) {
        failures.push(`${noteName}: iframe should use local lab server, got ${src}`);
        continue;
      }

      const harnessPath = path.join(noteDir, `__fblock_${noteName.replace(/[^A-Za-z0-9]/g, "_")}.html`);
      let page;
      try {
        fs.writeFileSync(harnessPath, `<!doctype html><meta charset="utf-8">${iframeHtml}`, "utf8");
        page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
        await page.goto(pathToFileURL(harnessPath).href, { waitUntil: "domcontentloaded", timeout: 10000 });
        const frame = await waitForFrame(page, labFile);
        await frame.waitForSelector("canvas", { timeout: 10000 });
        await frame.waitForFunction(() => {
          const canvas = document.querySelector("canvas");
          const ready = Object.keys(window).some((key) => /^__.+LabReady$/.test(key) && window[key] === true);
          return canvas && ready && canvas.toDataURL("image/png").length >= 8000;
        }, { timeout: 15000 });
        const result = await frame.evaluate(() => {
          const canvas = document.querySelector("canvas");
          return {
            title: document.title,
            bytes: canvas ? canvas.toDataURL("image/png").length : 0
          };
        });
        if (result.bytes < 8000) {
          failures.push(`${noteName}: weak or black canvas payload ${result.bytes}`);
        } else {
          renders.push(`${noteName}: ${result.bytes} bytes`);
        }
      } catch (error) {
        failures.push(`${noteName}: ${error.message}`);
      } finally {
        if (page) await page.close();
        if (fs.existsSync(harnessPath)) fs.unlinkSync(harnessPath);
      }
    }
  } finally {
    await browser.close();
  }

  if (failures.length) {
    throw new Error(`F-block iframe failures:\n${failures.join("\n")}`);
  }

  console.log(`F-block iframe smoke passed for ${renders.length} labs.`);
  console.log(renders.join("\n"));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
