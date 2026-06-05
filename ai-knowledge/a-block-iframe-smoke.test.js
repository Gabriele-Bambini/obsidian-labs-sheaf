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

const noteDir = path.resolve(__dirname, "..");
const cases = [
  ["A01- Linear Algebra Fundamentals.md", "a01-linear-algebra-foundations-lab.html"],
  ["A02 - Vectors, Spaces and Linear Maps.md", "a02-linear-map-grid.html"],
  ["A03- Multivariable Calculus.md", "a03-eigen-quadratic-form.html"],
  ["A04- Real Analysis and Measure Theory.md", "a04-measure-convergence-lab.html"],
  ["A05- Functional Analysis.md", "a05-functional-analysis-operator-lab.html"],
  ["A06- Topology Basics.md", "a06-topology-neighborhood-lab.html"],
  ["A07- Differential Geometry.md", "a07-measure-integration.html"],
  ["A08- Abstract Algebra Fundamentals.md", "a08-algebra-structure-lab.html"],
  ["A09- Category Theory Basics.md", "a09-category-theory-diagram-lab.html"],
  ["A10- Advanced Category Theory.md", "a10-category-limits-adjunctions-lab.html"],
  ["A11- Information Theory.md", "a11-information-theory-lab.html"],
  ["A12- Algebraic Topology.md", "a12-algebraic-topology-lab.html"],
  ["A13- Differential Equations.md", "a13-differential-equations-flow-lab.html"],
  ["A14- Complex Analysis.md", "a14-complex-contour-residue-lab.html"],
  ["A15- Numerical Methods.md", "a15-numerical-methods-stability-lab.html"]
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

      if (!/height\s*=\s*["'](700|720|760)["']/i.test(iframeHtml)) {
        failures.push(`${noteName}: iframe height should stay in the no-scroll A-block band, got ${iframeHtml}`);
        continue;
      }

      const harnessPath = path.join(noteDir, `__a_block_iframe_${index}.html`);
      try {
        fs.writeFileSync(harnessPath, `<!doctype html><meta charset="utf-8">${iframeHtml}`, "utf8");
        const page = await browser.newPage({ viewport: { width: 1280, height: 780 } });
        await page.goto(pathToFileURL(harnessPath).href);
        const frame = await waitForLabFrame(page, labFile);
        await frame.locator("body").waitFor({ state: "visible" });
        await frame.waitForTimeout(180);
        const result = await frame.evaluate(() => {
          const canvas = document.querySelector("canvas");
          const bodyText = document.body ? document.body.textContent.trim() : "";
          return {
            bytes: canvas ? canvas.toDataURL("image/png").length : 0,
            bodyTextLength: bodyText.length,
            background: getComputedStyle(document.body).backgroundColor
          };
        });
        await page.close();

        if (result.bytes < 5000 && result.bodyTextLength < 200) {
          failures.push(`${noteName}: weak embedded render ${JSON.stringify(result)}`);
        }
      } finally {
        if (fs.existsSync(harnessPath)) fs.unlinkSync(harnessPath);
      }
    }
  } finally {
    await browser.close();
  }

  if (failures.length) {
    throw new Error(`A-block iframe smoke failed:\n${failures.join("\n")}`);
  }

  console.log(`A-block iframe smoke passed: ${cases.length}/${cases.length} local-server A labs rendered.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
