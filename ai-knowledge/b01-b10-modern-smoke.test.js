const path = require("path");

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
  {
    id: "b01",
    file: "b01-probability-foundations-lab.html",
    visualKind: "probability-space-lab",
    topic: /sample space|event|conditional|Monte Carlo|random variable/i,
    selected: /Probability|sample space|event|conditioning|Monte Carlo/i,
    rail: ["sample space", "event A", "evidence B", "conditional mass", "Monte Carlo"],
    modes: ["Sample space", "Conditioning", "Random variable", "Monte Carlo"],
    metrics: ["Event probability", "Entropy", "Conditional mass", "Expectation"],
    pulseMode: "conditioning",
    pulseButton: /condition|evidence|A\|B/i,
    pulseRegex: /Pulse.*conditioning|evidence B|intersection|conditional probability/i,
    stepMode: "montecarlo",
    stepButton: /sample|Monte Carlo|empirical/i,
    stepRegex: /Step.*Monte Carlo|sample|expectation|empirical/i
  },
  {
    id: "b02",
    file: "b02-multivariate-probability-lab.html",
    visualKind: "joint-distribution-lab",
    topic: /joint distribution|marginal|conditional|covariance|Gaussian/i,
    selected: /Multivariate|joint|marginal|conditional|correlation/i,
    rail: ["joint density", "marginals", "conditioning slice", "covariance ellipse", "Gaussian law"],
    modes: ["Joint law", "Marginals", "Conditional slice", "Gaussian covariance"],
    metrics: ["Correlation", "Marginal spread", "Conditional shift", "Tail mass"],
    pulseMode: "conditional",
    pulseButton: /slice|condition/i,
    pulseRegex: /Pulse.*conditional|slice|given|correlation/i,
    stepMode: "marginal",
    stepButton: /marginal|sum out|project/i,
    stepRegex: /Step.*marginal|sum out|project|joint density/i
  },
  {
    id: "b03",
    file: "b03-estimator-likelihood-lab.html",
    visualKind: "estimation-likelihood-lab",
    topic: /likelihood|MLE|estimator|bias|variance|confidence/i,
    selected: /Estimation|likelihood|MLE|bias|sampling distribution/i,
    rail: ["data cloud", "likelihood curve", "MLE marker", "sampling spread", "bias-variance"],
    modes: ["Likelihood", "MLE", "Bias / variance", "Confidence interval"],
    metrics: ["Likelihood peak", "Estimator bias", "Variance", "CI width"],
    pulseMode: "mle",
    pulseButton: /mark|MLE|peak/i,
    pulseRegex: /Pulse.*MLE|likelihood peak|theta|score/i,
    stepMode: "bias",
    stepButton: /resample|sampling|bias/i,
    stepRegex: /Step.*sampling distribution|bias|variance|estimator/i
  },
  {
    id: "b04",
    file: "b04-hypothesis-testing-lab.html",
    visualKind: "hypothesis-testing-lab",
    topic: /null|p-value|rejection|Type I|power|hypothesis/i,
    selected: /Hypothesis|null|p-value|power|rejection/i,
    rail: ["null model", "test statistic", "p-value tail", "rejection region", "power curve"],
    modes: ["Null model", "p-value", "Power", "Multiple tests"],
    metrics: ["p-value", "Power", "Type I risk", "Effect size"],
    pulseMode: "pvalue",
    pulseButton: /p-value|tail/i,
    pulseRegex: /Pulse.*p-value|tail|rejection|null/i,
    stepMode: "power",
    stepButton: /power|type/i,
    stepRegex: /Step.*power|Type I|Type II|effect size/i
  },
  {
    id: "b05",
    file: "b05-bayesian-updating.html",
    visualKind: "bayesian-updating-lab",
    topic: /prior|likelihood|posterior|Bayes|predictive/i,
    selected: /Bayesian|prior|likelihood|posterior|credible/i,
    rail: ["prior belief", "likelihood evidence", "posterior mass", "predictive band", "Bayes update"],
    modes: ["Prior", "Likelihood", "Posterior", "Predictive"],
    metrics: ["Posterior mean", "Posterior precision", "Bayes factor", "Credible width"],
    pulseMode: "posterior",
    pulseButton: /Bayes|posterior|multiply/i,
    pulseRegex: /Pulse.*posterior|prior.*likelihood|Bayes update/i,
    stepMode: "predictive",
    stepButton: /predict|posterior/i,
    stepRegex: /Step.*posterior predictive|credible|new observation|Bayes/i
  },
  {
    id: "b06",
    file: "b06-markov-chain-lab.html",
    visualKind: "stochastic-process-lab",
    topic: /Markov chain|transition|stationary|mixing|hitting/i,
    selected: /Stochastic process|Markov|transition|stationary|hitting/i,
    rail: ["states", "transition kernel", "sample path", "stationary law", "hitting time"],
    modes: ["Markov chain", "Mixing", "Hitting time", "Poisson clock"],
    metrics: ["Stationary mass", "Mixing gap", "Path entropy", "Hitting chance"],
    pulseMode: "chain",
    pulseButton: /transition|kernel/i,
    pulseRegex: /Pulse.*transition|kernel|Markov|one-step/i,
    stepMode: "mixing",
    stepButton: /mix|stationary/i,
    stepRegex: /Step.*mixing|stationary|distribution|steps/i
  },
  {
    id: "b07",
    file: "b07-advanced-stochastic-calculus-lab.html",
    visualKind: "stochastic-calculus-lab",
    topic: /Brownian|Ito|SDE|quadratic variation|diffusion/i,
    selected: /Stochastic calculus|Brownian|Ito|SDE|diffusion/i,
    rail: ["Brownian path", "quadratic variation", "Ito integral", "drift field", "SDE solution"],
    modes: ["Brownian path", "Ito integral", "SDE flow", "Reverse diffusion"],
    metrics: ["Quadratic variation", "Ito drift", "Diffusion scale", "SDE stability"],
    pulseMode: "ito",
    pulseButton: /Ito|variation|dW/i,
    pulseRegex: /Pulse.*Ito|quadratic variation|dW|martingale/i,
    stepMode: "sde",
    stepButton: /SDE|Euler|advance/i,
    stepRegex: /Step.*SDE|drift|diffusion|Euler-Maruyama/i
  },
  {
    id: "b08",
    file: "b08-information-geometry-lab.html",
    visualKind: "information-geometry-lab",
    topic: /Fisher|statistical manifold|KL|geodesic|natural gradient/i,
    selected: /Information geometry|Fisher|manifold|KL|natural gradient/i,
    rail: ["statistical manifold", "Fisher metric", "KL neighborhood", "geodesic", "natural gradient"],
    modes: ["Manifold", "Fisher metric", "KL projection", "Natural gradient"],
    metrics: ["Fisher length", "KL projection", "Geodesic gap", "Curvature"],
    pulseMode: "fisher",
    pulseButton: /Fisher|metric|KL/i,
    pulseRegex: /Pulse.*Fisher|metric|ellipse|local KL/i,
    stepMode: "natural",
    stepButton: /natural|gradient|geodesic/i,
    stepRegex: /Step.*natural gradient|geodesic|Fisher-scaled|projection/i
  },
  {
    id: "b09",
    file: "b09-nonparametric-statistics-lab.html",
    visualKind: "nonparametric-statistics-lab",
    topic: /KDE|kernel|non-parametric|bootstrap|smoothing|Gaussian process/i,
    selected: /Non-parametric|KDE|bandwidth|bootstrap|smoother/i,
    rail: ["sample rug", "kernel bumps", "KDE curve", "bootstrap cloud", "adaptive smoother"],
    modes: ["KDE", "Bootstrap", "Kernel regression", "Gaussian process"],
    metrics: ["Bandwidth", "Bootstrap spread", "EDF gap", "Smooth risk"],
    pulseMode: "kde",
    pulseButton: /kernel|KDE|bandwidth/i,
    pulseRegex: /Pulse.*kernel|bandwidth|KDE|bumps/i,
    stepMode: "bootstrap",
    stepButton: /bootstrap|resample/i,
    stepRegex: /Step.*bootstrap|resample|uncertainty|empirical/i
  },
  {
    id: "b10",
    file: "b10-causal-inference-lab.html",
    visualKind: "causal-inference-lab",
    topic: /causal|DAG|do-operator|backdoor|counterfactual|treatment/i,
    selected: /Causal inference|DAG|intervention|backdoor|ATE/i,
    rail: ["DAG structure", "confounder", "treatment", "outcome", "do-intervention"],
    modes: ["DAG", "Backdoor", "Intervention", "Counterfactual"],
    metrics: ["Causal effect", "Backdoor bias", "Adjustment score", "ATE stability"],
    pulseMode: "backdoor",
    pulseButton: /backdoor|confounder|adjust/i,
    pulseRegex: /Pulse.*backdoor|confounder|adjustment|blocked/i,
    stepMode: "intervention",
    stepButton: /do|intervention|treatment/i,
    stepRegex: /Step.*do-operator|intervention|treatment|ATE/i
  }
];

async function assertNoDedicatedScrollbars(page, viewportName) {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const elements = [...document.querySelectorAll(".lab-3d-shell, .stage, .lab-viewport, .lab-3d-panel, .controls")];
    return {
      page: Math.max(root.scrollHeight, body.scrollHeight) - window.innerHeight,
      elements: elements.map((element) => ({
        selector: element.className,
        vertical: element.scrollHeight - element.clientHeight,
        horizontal: element.scrollWidth - element.clientWidth,
        overflowY: getComputedStyle(element).overflowY,
        overflowX: getComputedStyle(element).overflowX
      }))
    };
  });
  if (overflow.page > 2) throw new Error(`${viewportName}: page overflows vertically by ${overflow.page}px.`);
  const scroller = overflow.elements.find((item) =>
    item.vertical > 2 ||
    item.horizontal > 2 ||
    item.overflowY === "auto" ||
    item.overflowY === "scroll" ||
    item.overflowX === "auto" ||
    item.overflowX === "scroll"
  );
  if (scroller) throw new Error(`${viewportName}: dedicated scrollbar/overflow detected on ${scroller.selector}.`);
}

async function setRange(page, selector, value) {
  const locator = page.locator(selector);
  if ((await locator.count()) === 0) return;
  await locator.evaluate((input, nextValue) => {
    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function checkLab(page, lab) {
  const labPath = path.join(__dirname, lab.file).replace(/\\/g, "/");
  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas#canvas").waitFor({ state: "visible" });
  await page.waitForFunction((id) => window[`__${id}LabReady`] === true && window[`__${id}LabSnapshot`](), lab.id);
  await page.waitForTimeout(180);

  const initial = await page.evaluate((id) => {
    const canvas = document.querySelector(".lab-viewport canvas#canvas");
    return {
      bytes: canvas.toDataURL("image/png").length,
      snapshot: window[`__${id}LabSnapshot`](),
      stateText: document.querySelector("#stateBox").textContent.trim(),
      selectedText: document.querySelector("[data-role='selected'] strong").textContent.trim(),
      rail: [...document.querySelectorAll(".concept-rail span")].map((node) => node.textContent.trim()),
      modeLabels: [...document.querySelectorAll("[data-control='mode'] option")].map((node) => node.textContent.trim()),
      metricLabels: [...document.querySelectorAll("[data-role='metric'] span")].map((node) => node.textContent.trim()),
      root: {
        visualKind: document.querySelector(".gnn-lab").dataset.visualKind,
        graphStyle: document.querySelector(".gnn-lab").dataset.graphStyle
      }
    };
  }, lab.id);

  if (initial.bytes < 10000) throw new Error(`${lab.id}: canvas appears blank; png payload only ${initial.bytes} bytes.`);
  if (initial.snapshot.visualKind !== lab.visualKind || initial.root.visualKind !== lab.visualKind) {
    throw new Error(`${lab.id}: expected ${lab.visualKind}, got ${JSON.stringify(initial.snapshot)}.`);
  }
  if (initial.snapshot.graphStyle !== "hidden" || initial.root.graphStyle !== "hidden") {
    throw new Error(`${lab.id}: generic graph scaffolding should be hidden: ${JSON.stringify(initial.root)}.`);
  }
  if (!lab.topic.test(initial.stateText)) throw new Error(`${lab.id}: initial explanation is weak: ${initial.stateText}`);
  if (!lab.selected.test(initial.selectedText)) throw new Error(`${lab.id}: selected chip is weak: ${initial.selectedText}`);
  for (const label of lab.rail) {
    if (!initial.rail.includes(label)) throw new Error(`${lab.id}: missing concept rail chip "${label}".`);
  }
  for (const label of lab.modes) {
    if (!initial.modeLabels.includes(label)) throw new Error(`${lab.id}: missing mode "${label}".`);
  }
  for (const label of lab.metrics) {
    if (!initial.metricLabels.includes(label)) throw new Error(`${lab.id}: missing metric "${label}".`);
  }
  await assertNoDedicatedScrollbars(page, `${lab.id} desktop`);

  const beforeOrbit = await page.evaluate((id) => window[`__${id}LabSnapshot`]().cameraTheta, lab.id);
  const canvasBox = await page.locator(".lab-viewport canvas#canvas").boundingBox();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.3, canvasBox.y + canvasBox.height * 0.62);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.76, canvasBox.y + canvasBox.height * 0.3, { steps: 8 });
  await page.mouse.up();
  const afterOrbit = await page.evaluate((id) => window[`__${id}LabSnapshot`]().cameraTheta, lab.id);
  if (Math.abs(afterOrbit - beforeOrbit) < 0.05) throw new Error(`${lab.id}: dragging canvas did not orbit.`);

  await page.selectOption("[data-control='mode']", lab.pulseMode);
  const pulseLabel = (await page.locator("[data-action='pulse']").textContent()).trim();
  if (!lab.pulseButton.test(pulseLabel) || /^Pulse$/i.test(pulseLabel)) {
    throw new Error(`${lab.id}: Pulse button label must be specific to the phenomenon, got "${pulseLabel}".`);
  }
  await setRange(page, `#${lab.id}-focus`, "0.62");
  await setRange(page, `#${lab.id}-spread`, "0.58");
  await setRange(page, `#${lab.id}-noise`, "0.36");
  await setRange(page, `#${lab.id}-samples`, "9");
  await setRange(page, `#${lab.id}-strength`, "0.68");
  await page.locator("[data-action='pulse']").click();
  await page.waitForTimeout(140);
  const pulse = await page.locator("#stateBox").textContent();
  if (!lab.pulseRegex.test(pulse)) throw new Error(`${lab.id}: Pulse task is weak: ${pulse}`);

  await page.selectOption("[data-control='mode']", lab.stepMode);
  const stepLabel = (await page.locator("[data-action='step']").textContent()).trim();
  if (!lab.stepButton.test(stepLabel) || /^Step$/i.test(stepLabel)) {
    throw new Error(`${lab.id}: Step button label must describe progression, got "${stepLabel}".`);
  }
  await setRange(page, `#${lab.id}-focus`, "0.38");
  await setRange(page, `#${lab.id}-spread`, "0.72");
  await setRange(page, `#${lab.id}-noise`, "0.48");
  await setRange(page, `#${lab.id}-samples`, "11");
  await setRange(page, `#${lab.id}-strength`, "0.42");
  const beforeStepParams = await page.evaluate((id) => window[`__${id}LabSnapshot`]().params, lab.id);
  await page.locator("[data-action='step']").click();
  await page.waitForTimeout(140);
  const step = await page.locator("#stateBox").textContent();
  if (!lab.stepRegex.test(step)) throw new Error(`${lab.id}: Step task is weak: ${step}`);
  const afterStepParams = await page.evaluate((id) => window[`__${id}LabSnapshot`]().params, lab.id);
  const advanced = ["focus", "spread", "noise", "samples", "strength"].some((key) => String(beforeStepParams[key]) !== String(afterStepParams[key]));
  if (!advanced) {
    throw new Error(`${lab.id}: Step did not advance a visible Block-B parameter: ${JSON.stringify({ beforeStepParams, afterStepParams })}.`);
  }

  const afterControls = await page.evaluate((id) => {
    const snapshot = window[`__${id}LabSnapshot`]();
    return {
      activeNodes: snapshot.activeNodeCount,
      activeEdges: snapshot.activeEdgeCount,
      entropy: snapshot.attentionEntropy,
      selected: document.querySelector("[data-role='selected'] strong").textContent.trim()
    };
  }, lab.id);
  if (afterControls.activeNodes < 1 || afterControls.activeEdges < 1) {
    throw new Error(`${lab.id}: controls did not leave a live visual state: ${JSON.stringify(afterControls)}.`);
  }

  await page.setViewportSize({ width: 900, height: 700 });
  await assertNoDedicatedScrollbars(page, `${lab.id} narrow`);
  await page.setViewportSize({ width: 1280, height: 700 });
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 700 } });
  try {
    for (const lab of LABS) await checkLab(page, lab);
  } finally {
    await browser.close();
  }
  console.log("b01-b10 smoke passed: Block B labs are dedicated, orbitable, fitted, and have real Pulse/Step concept actions.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
