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
  ["b01", "B01- Probability Theory Foundations.md", "b01-probability-foundations-lab.html", "probability-space-lab", /sample space|event|conditional|Monte Carlo|random variable/i],
  ["b02", "B02- Multivariate Probability.md", "b02-multivariate-probability-lab.html", "joint-distribution-lab", /joint distribution|marginal|conditional|covariance|Gaussian/i],
  ["b03", "B03- Statistical Estimation.md", "b03-estimator-likelihood-lab.html", "estimation-likelihood-lab", /likelihood|MLE|estimator|bias|variance/i],
  ["b04", "B04- Hypothesis Testing.md", "b04-hypothesis-testing-lab.html", "hypothesis-testing-lab", /null|p-value|rejection|power|hypothesis/i],
  ["b05", "B05- Bayesian Inference.md", "b05-bayesian-updating.html", "bayesian-updating-lab", /prior|likelihood|posterior|Bayes/i],
  ["b06", "B06- Stochastic Processes.md", "b06-markov-chain-lab.html", "stochastic-process-lab", /Markov|transition|stationary|mixing|hitting/i],
  ["b07", "B07- Advanced Stochastic Calculus.md", "b07-advanced-stochastic-calculus-lab.html", "stochastic-calculus-lab", /Brownian|Ito|SDE|quadratic variation|diffusion/i],
  ["b08", "B08- Information Geometry.md", "b08-information-geometry-lab.html", "information-geometry-lab", /Fisher|statistical manifold|KL|geodesic|natural gradient/i],
  ["b09", "B09- Non-parametric Statistics.md", "b09-nonparametric-statistics-lab.html", "nonparametric-statistics-lab", /KDE|kernel|non-parametric|bootstrap|smoothing/i],
  ["b10", "B10- Causal Inference.md", "b10-causal-inference-lab.html", "causal-inference-lab", /causal|DAG|do-operator|backdoor|treatment/i]
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
  console.log("b01-b10 iframe smoke passed: all Block B notes embed dedicated fitted modern labs.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
