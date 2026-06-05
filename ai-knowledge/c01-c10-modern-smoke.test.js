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
    id: "c01",
    file: "c01-convex-analysis-lab.html",
    visualKind: "convex-analysis-lab",
    topic: /convex|epigraph|Jensen|subgradient|Fenchel/i,
    selected: /Convex analysis|epigraph|supporting|Jensen|Fenchel/i,
    rail: ["convex set", "epigraph", "Jensen chord", "subgradient plane", "Fenchel dual"],
    modes: ["Convex set", "Epigraph", "Jensen", "Fenchel conjugate"],
    metrics: ["Jensen gap", "Support violation", "Subgradient norm", "Fenchel gap"],
    pulseMode: "jensen",
    pulseButton: /Jensen|chord/i,
    pulseRegex: /Pulse.*Jensen|chord|convex combination/i,
    stepMode: "fenchel",
    stepButton: /Fenchel|dual|slope/i,
    stepRegex: /Step.*Fenchel|dual slope|conjugate/i
  },
  {
    id: "c02",
    file: "c02-optimization-landscape.html",
    visualKind: "unconstrained-optimization-lab",
    topic: /gradient descent|Newton|line search|objective|unconstrained/i,
    selected: /Unconstrained|objective|gradient|Newton|descent/i,
    rail: ["objective surface", "gradient vector", "descent path", "line search", "Newton step"],
    modes: ["Gradient descent", "Line search", "Newton", "Momentum"],
    metrics: ["Objective value", "Gradient norm", "Step decrease", "Newton gain"],
    pulseMode: "gradient",
    pulseButton: /gradient|descent/i,
    pulseRegex: /Pulse.*gradient|steepest descent|objective/i,
    stepMode: "newton",
    stepButton: /Newton|curvature/i,
    stepRegex: /Step.*Newton|Hessian|curvature/i
  },
  {
    id: "c03",
    file: "c03-constrained-optimization.html",
    visualKind: "constrained-optimization-lab",
    topic: /constraint|feasible|Lagrange|KKT|active set/i,
    selected: /Constrained|feasible|KKT|Lagrange|active/i,
    rail: ["objective bowl", "feasible half-space", "active wall", "normal force", "barrier path"],
    modes: ["Feasible set", "Lagrange", "KKT", "Barrier"],
    metrics: ["Max violation", "KKT residual", "Lagrange lambda", "Complementarity"],
    pulseMode: "kkt",
    pulseButton: /KKT|active/i,
    pulseRegex: /Pulse.*KKT|active set|normal cone/i,
    stepMode: "barrier",
    stepButton: /barrier|feasible/i,
    stepRegex: /Step.*barrier|feasible|constraint/i
  },
  {
    id: "c04",
    file: "c04-stochastic-optimization-lab.html",
    visualKind: "stochastic-optimization-lab",
    topic: /stochastic gradient|minibatch|momentum|Adam|variance/i,
    selected: /Stochastic optimization|SGD|minibatch|momentum|variance/i,
    rail: ["loss surface", "gradient fan", "minibatch mean", "update vector", "Adam scale"],
    modes: ["SGD", "Minibatch", "Momentum", "Adam"],
    metrics: ["Gradient variance", "Update norm", "Angle error", "Batch coverage"],
    pulseMode: "sgd",
    pulseButton: /SGD|gradient/i,
    pulseRegex: /Pulse.*stochastic gradient|noise|unbiased/i,
    stepMode: "minibatch",
    stepButton: /batch|minibatch|sample/i,
    stepRegex: /Step.*minibatch|variance|sample/i
  },
  {
    id: "c05",
    file: "c05-euler-lagrange-action-lab.html",
    visualKind: "calculus-variations-lab",
    topic: /functional|variation|Euler-Lagrange|action|boundary/i,
    selected: /Calculus of variations|functional|variation|Euler|boundary/i,
    rail: ["function space", "variation eta", "action density", "Euler residual", "boundary term"],
    modes: ["Functional", "Variation", "Euler-Lagrange", "Boundary terms"],
    metrics: ["Action J[y]", "Euler residual", "Boundary defect", "First variation"],
    pulseMode: "variation",
    pulseButton: /variation|curve/i,
    pulseRegex: /Pulse.*variation|admissible curve|first variation/i,
    stepMode: "euler",
    stepButton: /Euler|stationary/i,
    stepRegex: /Step.*Euler-Lagrange|stationary|residual/i
  },
  {
    id: "c06",
    file: "c06-optimal-control-lab.html",
    visualKind: "optimal-control-lab",
    topic: /control|state|Pontryagin|HJB|Riccati|LQR/i,
    selected: /Optimal control|state|control|Pontryagin|HJB/i,
    rail: ["state dynamics", "control u(t)", "costate lambda", "HJB value", "Riccati feedback"],
    modes: ["State-control", "Pontryagin", "HJB", "LQR"],
    metrics: ["Control cost", "HJB residual", "Riccati gain", "Terminal error"],
    pulseMode: "pontryagin",
    pulseButton: /Pontryagin|Hamiltonian/i,
    pulseRegex: /Pulse.*Pontryagin|Hamiltonian|costate/i,
    stepMode: "lqr",
    stepButton: /Riccati|feedback|LQR/i,
    stepRegex: /Step.*Riccati|feedback|terminal/i
  },
  {
    id: "c07",
    file: "c07-duality-theory-lab.html",
    visualKind: "duality-theory-lab",
    topic: /duality|Lagrangian|dual gap|Fenchel|certificate/i,
    selected: /Duality|primal|dual|certificate|gap/i,
    rail: ["primal value", "feasible wall", "dual bound", "gap certificate", "complementarity"],
    modes: ["Lagrangian", "Dual gap", "Fenchel", "Minimax"],
    metrics: ["Duality gap", "Primal residual", "Complementarity", "Certificate slack"],
    pulseMode: "dual",
    pulseButton: /dual|gap/i,
    pulseRegex: /Pulse.*duality gap|dual bound|certificate/i,
    stepMode: "fenchel",
    stepButton: /Fenchel|pair/i,
    stepRegex: /Step.*Fenchel|conjugate|certificate/i
  },
  {
    id: "c08",
    file: "c08-proximal-methods-lab.html",
    visualKind: "proximal-methods-lab",
    topic: /proximal|Moreau|soft threshold|ADMM|splitting/i,
    selected: /Proximal|prox map|Moreau|threshold|ADMM/i,
    rail: ["point v", "quadratic tether", "prox output", "deadzone", "ADMM residual"],
    modes: ["Prox map", "Moreau envelope", "Soft threshold", "ADMM split"],
    metrics: ["Prox distance", "Moreau smoothness", "Sparsity", "ADMM residual"],
    pulseMode: "soft",
    pulseButton: /threshold|sparse/i,
    pulseRegex: /Pulse.*soft threshold|sparsity|shrink/i,
    stepMode: "admm",
    stepButton: /ADMM|split/i,
    stepRegex: /Step.*ADMM|split|residual/i
  },
  {
    id: "c09",
    file: "c09-nonconvex-optimization-lab.html",
    visualKind: "nonconvex-optimization-lab",
    topic: /non-convex|saddle|basin|sharp|flat|perturb/i,
    selected: /Non-convex|saddle|basin|sharp|flat/i,
    rail: ["multi-basin terrain", "seed cloud", "saddle plateau", "escape direction", "flat vs sharp"],
    modes: ["Landscape", "Basins", "Saddle", "Optimizer"],
    metrics: ["Saddle escape", "Sharpness", "Basin energy", "Perturbation gain"],
    pulseMode: "saddle",
    pulseButton: /saddle|escape/i,
    pulseRegex: /Pulse.*saddle|negative curvature|escape/i,
    stepMode: "optimizer",
    stepButton: /optimizer|noise/i,
    stepRegex: /Step.*optimizer|noise|escape|basin/i
  },
  {
    id: "c10",
    file: "c10-optimal-transport-lab.html",
    visualKind: "optimal-transport-lab",
    topic: /transport plan|coupling|Sinkhorn|dual potentials|Wasserstein/i,
    selected: /Optimal transport|coupling|Sinkhorn|Wasserstein|displacement/i,
    rail: ["source towers", "target demand", "Pij tubes", "marginal meters", "Wasserstein geodesic"],
    modes: ["Plan", "Sinkhorn", "Dual potentials", "Displacement"],
    metrics: ["Transport cost", "Marginal error", "Entropy", "Wasserstein path"],
    pulseMode: "plan",
    pulseButton: /plan|Pij/i,
    pulseRegex: /Pulse.*transport plan|coupling|source.*target|mass/i,
    stepMode: "sinkhorn",
    stepButton: /Sinkhorn|scale/i,
    stepRegex: /Step.*Sinkhorn|scaling|entropy/i
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
  await setRange(page, `#${lab.id}-curvature`, "1.35");
  await setRange(page, `#${lab.id}-step`, "0.42");
  await setRange(page, `#${lab.id}-noise`, "0.34");
  await setRange(page, `#${lab.id}-budget`, "9");
  await setRange(page, `#${lab.id}-regularization`, "0.62");
  await page.locator("[data-action='pulse']").click();
  await page.waitForTimeout(140);
  const pulse = await page.locator("#stateBox").textContent();
  if (!lab.pulseRegex.test(pulse)) throw new Error(`${lab.id}: Pulse task is weak: ${pulse}`);

  await page.selectOption("[data-control='mode']", lab.stepMode);
  const stepLabel = (await page.locator("[data-action='step']").textContent()).trim();
  if (!lab.stepButton.test(stepLabel) || /^Step$/i.test(stepLabel)) {
    throw new Error(`${lab.id}: Step button label must describe progression, got "${stepLabel}".`);
  }
  await setRange(page, `#${lab.id}-curvature`, "0.78");
  await setRange(page, `#${lab.id}-step`, "0.31");
  await setRange(page, `#${lab.id}-noise`, "0.48");
  await setRange(page, `#${lab.id}-budget`, "8");
  await setRange(page, `#${lab.id}-regularization`, "0.45");
  const beforeStepParams = await page.evaluate((id) => window[`__${id}LabSnapshot`]().params, lab.id);
  await page.locator("[data-action='step']").click();
  await page.waitForTimeout(140);
  const step = await page.locator("#stateBox").textContent();
  if (!lab.stepRegex.test(step)) throw new Error(`${lab.id}: Step task is weak: ${step}`);
  const afterStepParams = await page.evaluate((id) => window[`__${id}LabSnapshot`]().params, lab.id);
  const advanced = ["curvature", "step", "noise", "budget", "regularization"].some((key) => String(beforeStepParams[key]) !== String(afterStepParams[key]));
  if (!advanced) {
    throw new Error(`${lab.id}: Step did not advance a visible Block-C parameter: ${JSON.stringify({ beforeStepParams, afterStepParams })}.`);
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
  console.log("c01-c10 smoke passed: Block C labs are dedicated, orbitable, fitted, and have semantic progressive commands.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
