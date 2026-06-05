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
  ["c01", "C01- Convex Analysis.md", "c01-convex-analysis-lab.html", "convex-analysis-lab", /convex|epigraph|Jensen|subgradient|Fenchel/i],
  ["c02", "C02- Unconstrained Optimization.md", "c02-optimization-landscape.html", "unconstrained-optimization-lab", /gradient descent|Newton|line search|objective/i],
  ["c03", "C03- Constrained Optimization.md", "c03-constrained-optimization.html", "constrained-optimization-lab", /constraint|feasible|Lagrange|KKT/i],
  ["c04", "C04- Stochastic Optimization.md", "c04-stochastic-optimization-lab.html", "stochastic-optimization-lab", /stochastic gradient|minibatch|momentum|Adam/i],
  ["c05", "C05- Calculus of Variations.md", "c05-euler-lagrange-action-lab.html", "calculus-variations-lab", /functional|variation|Euler-Lagrange|action/i],
  ["c06", "C06- Optimal Control Theory.md", "c06-optimal-control-lab.html", "optimal-control-lab", /control|state|Pontryagin|HJB|Riccati/i],
  ["c07", "C07- Duality Theory.md", "c07-duality-theory-lab.html", "duality-theory-lab", /duality|Lagrangian|dual gap|Fenchel/i],
  ["c08", "C08- Proximal Methods.md", "c08-proximal-methods-lab.html", "proximal-methods-lab", /proximal|Moreau|soft threshold|ADMM/i],
  ["c09", "C09- Non-convex Optimization.md", "c09-nonconvex-optimization-lab.html", "nonconvex-optimization-lab", /non-convex|saddle|basin|sharp|flat/i],
  ["c10", "C10- Optimal Transport.md", "c10-optimal-transport-lab.html", "optimal-transport-lab", /transport plan|coupling|Sinkhorn|Wasserstein/i]
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
  console.log("c01-c10 iframe smoke passed: all Block C notes embed dedicated fitted modern labs.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
