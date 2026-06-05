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
      return require("C:/Users/Gabriele/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
    }
  }
}

const { chromium } = loadPlaywright();

const noteDir = path.resolve(__dirname, "..");
const cases = [
  ["C01- Convex Analysis.md", "c01-convex-analysis-lab.html"],
  ["C02- Unconstrained Optimization.md", "c02-optimization-landscape.html"],
  ["C03- Constrained Optimization.md", "c03-constrained-optimization.html"],
  ["C04- Stochastic Optimization.md", "c04-stochastic-optimization-lab.html"],
  ["C05- Calculus of Variations.md", "c05-euler-lagrange-action-lab.html"],
  ["C06- Optimal Control Theory.md", "c06-optimal-control-lab.html"],
  ["C07- Duality Theory.md", "c07-duality-theory-lab.html"],
  ["C08- Proximal Methods.md", "c08-proximal-methods-lab.html"],
  ["C09- Non-convex Optimization.md", "c09-nonconvex-optimization-lab.html"],
  ["C10- Optimal Transport.md", "c10-optimal-transport-lab.html"]
];

async function waitForLabFrame(page, fileName) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const frame = page.frames().find((candidate) => candidate.url().includes(fileName));
    if (frame) return frame;
    await page.waitForTimeout(100);
  }
  throw new Error(`No iframe loaded ${fileName}.`);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const failures = [];

  try {
    for (const [index, [noteName, labFile]] of cases.entries()) {
      const notePath = path.join(noteDir, noteName);
      const note = fs.readFileSync(notePath, "utf8");
      const match = note.match(/<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/i);
      if (!match) {
        failures.push(`${noteName}: missing iframe`);
        continue;
      }

      const iframeHtml = match[0];
      const src = match[1];
      const expectedSrc = `http://127.0.0.1:8765/${labFile}`;
      if (src !== expectedSrc) {
        failures.push(`${noteName}: iframe should use ${expectedSrc}, got ${src}`);
        continue;
      }

      if (!/height\s*=\s*["']720["']/i.test(iframeHtml)) {
        failures.push(`${noteName}: iframe height should be 720px, got ${iframeHtml}`);
        continue;
      }

      const harnessPath = path.join(noteDir, `__c_block_iframe_${index}.html`);
      try {
        fs.writeFileSync(harnessPath, `<!doctype html><meta charset="utf-8">${iframeHtml}`, "utf8");
        const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
        await page.goto(pathToFileURL(harnessPath).href);
        const frame = await waitForLabFrame(page, labFile);
        await frame.locator("canvas").first().waitFor({ state: "visible" });
        await frame.waitForTimeout(220);
        const result = await frame.evaluate(() => {
          const canvas = document.querySelector("canvas");
          const text = document.body ? document.body.textContent.trim() : "";
          return {
            bytes: canvas ? canvas.toDataURL("image/png").length : 0,
            textLength: text.length,
            scrollOverflow: Math.max(
              document.documentElement.scrollHeight,
              document.body.scrollHeight
            ) - window.innerHeight
          };
        });
        await page.close();

        if (result.bytes < 5000) {
          failures.push(`${noteName}: weak canvas render ${JSON.stringify(result)}`);
        }
        if (result.textLength < 120) {
          failures.push(`${noteName}: weak state/text render ${JSON.stringify(result)}`);
        }
        if (result.scrollOverflow > 4) {
          failures.push(`${noteName}: iframe page overflows by ${result.scrollOverflow}px`);
        }
      } finally {
        if (fs.existsSync(harnessPath)) fs.unlinkSync(harnessPath);
      }
    }
  } finally {
    await browser.close();
  }

  if (failures.length) {
    throw new Error(`C-block iframe smoke failed:\n${failures.join("\n")}`);
  }

  console.log(`C-block iframe smoke passed: ${cases.length}/${cases.length} local-server C labs rendered.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
