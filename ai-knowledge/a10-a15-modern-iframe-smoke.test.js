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

const LABS = [
  ["a10", "A10- Advanced Category Theory.md", "a10-category-limits-adjunctions-lab.html", "advanced-category-lab", /limit|cone|adjunction|monad|Kan|universal/i],
  ["a11", "A11- Information Theory.md", "a11-information-theory-lab.html", "information-theory-lab", /entropy|KL|mutual information|coding/i],
  ["a12", "A12- Algebraic Topology.md", "a12-algebraic-topology-lab.html", "algebraic-topology-lab", /homology|boundary|cycle|Betti|simplicial/i],
  ["a13", "A13- Differential Equations.md", "a13-differential-equations-flow-lab.html", "differential-equations-flow-lab", /ODE|vector field|trajectory|solver|stability/i],
  ["a14", "A14- Complex Analysis.md", "a14-complex-contour-residue-lab.html", "complex-analysis-contour-lab", /complex|contour|pole|residue|winding/i],
  ["a15", "A15- Numerical Methods.md", "a15-numerical-methods-stability-lab.html", "numerical-methods-stability-lab", /condition|stability|roundoff|residual|digits/i]
];

async function waitForLabFrame(page, fileName) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const frame = page.frames().find((candidate) => candidate.url().includes(fileName));
    if (frame) return frame;
    await page.waitForTimeout(100);
  }
  throw new Error(`No iframe loaded ${fileName}.`);
}

async function checkIframe(browser, lab) {
  const [id, noteName, labFile, visualKind, topicRegex] = lab;
  const notePath = path.resolve(__dirname, "..", noteName);
  const note = fs.readFileSync(notePath, "utf8");
  const match = note.match(/<iframe\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/i);
  if (!match) throw new Error(`${id}: note does not contain an iframe.`);
  const iframeHtml = match[0];
  const src = match[1];
  const expectedSrc = `http://127.0.0.1:8765/${labFile}`;
  if (src !== expectedSrc) throw new Error(`${id}: iframe src mismatch, got: ${src}`);
  if (!/height\s*=\s*["']720["']/i.test(iframeHtml)) throw new Error(`${id}: iframe should use height 720.`);
  if (!/background:\s*#071015/i.test(iframeHtml)) throw new Error(`${id}: iframe should set dark lab background.`);

  const harnessPath = path.resolve(__dirname, "..", `__${id}_iframe_harness.html`);
  let result;
  try {
    fs.writeFileSync(harnessPath, `<!doctype html><meta charset="utf-8">${iframeHtml}`, "utf8");
    const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
    await page.goto(pathToFileURL(harnessPath).href);
    const frame = await waitForLabFrame(page, labFile);
    await frame.locator(".lab-viewport canvas#canvas").waitFor({ state: "visible" });
    await frame.waitForFunction((labId) => window[`__${labId}LabReady`] === true && window[`__${labId}LabSnapshot`](), id);
    await frame.waitForTimeout(180);
    result = await frame.evaluate((labId) => ({
      bytes: document.querySelector(".lab-viewport canvas#canvas").toDataURL("image/png").length,
      snapshot: window[`__${labId}LabSnapshot`](),
      stateText: document.querySelector("#stateBox").textContent.trim(),
      selectedText: document.querySelector("[data-role='selected'] strong").textContent.trim(),
      root: {
        visualKind: document.querySelector(".gnn-lab").dataset.visualKind,
        graphStyle: document.querySelector(".gnn-lab").dataset.graphStyle
      }
    }), id);
    await page.close();
  } finally {
    if (fs.existsSync(harnessPath)) fs.unlinkSync(harnessPath);
  }

  if (result.bytes < 10000) throw new Error(`${id}: embedded iframe render is weak: ${JSON.stringify(result)}.`);
  if (result.snapshot.visualKind !== visualKind || result.root.visualKind !== visualKind) {
    throw new Error(`${id}: iframe expected ${visualKind}, got ${JSON.stringify(result)}.`);
  }
  if (result.snapshot.graphStyle !== "hidden" || result.root.graphStyle !== "hidden") {
    throw new Error(`${id}: iframe should hide generic graph scaffolding: ${JSON.stringify(result.root)}.`);
  }
  if (!topicRegex.test(`${result.stateText} ${result.selectedText}`)) {
    throw new Error(`${id}: iframe topic text is weak: ${JSON.stringify(result)}.`);
  }
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  try {
    for (const lab of LABS) await checkIframe(browser, lab);
  } finally {
    await browser.close();
  }
  console.log("a10-a15 iframe smoke passed: all remaining A-block notes embed dedicated fitted modern labs.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
