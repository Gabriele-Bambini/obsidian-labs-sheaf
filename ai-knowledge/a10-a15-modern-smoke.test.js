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
    id: "a10",
    file: "a10-category-limits-adjunctions-lab.html",
    visualKind: "advanced-category-lab",
    topic: /limit|cone|adjunction|monad|Kan|universal/i,
    selected: /Advanced category|limits|adjunction|monad|Kan/i,
    rail: ["limit cone", "universal arrow", "adjunction", "monad", "Kan extension"],
    modes: ["Limits", "Adjunction", "Monad", "Kan extension", "Sheaf glue"],
    metrics: ["Universal defect", "Adjunction fit", "Monad coherence", "Extension cost"],
    pulseMode: "adjunction",
    pulseRegex: /Pulse.*adjunction|hom-set|free|forgetful|unit/i,
    stepMode: "monad",
    stepRegex: /Step.*monad|unit|multiplication|flatten|coherence/i
  },
  {
    id: "a11",
    file: "a11-information-theory-lab.html",
    visualKind: "information-theory-lab",
    topic: /entropy|cross-entropy|KL|mutual information|coding/i,
    selected: /Information|entropy|KL|mutual information|channel/i,
    rail: ["distribution p", "model q", "code length", "KL penalty", "channel MI"],
    modes: ["Entropy", "Cross entropy", "KL mismatch", "Mutual information", "Noisy channel"],
    metrics: ["Entropy H(p)", "Cross entropy", "KL divergence", "Mutual information"],
    pulseMode: "kl",
    pulseRegex: /Pulse.*KL|extra bits|model q|coding penalty/i,
    stepMode: "channel",
    stepRegex: /Step.*channel|mutual information|noise|input.*output/i
  },
  {
    id: "a12",
    file: "a12-algebraic-topology-lab.html",
    visualKind: "algebraic-topology-lab",
    topic: /homology|boundary|cycle|Betti|simplicial/i,
    selected: /Algebraic topology|chain|boundary|homology|Betti/i,
    rail: ["simplicial complex", "chain groups", "boundary map", "cycle vs boundary", "barcode"],
    modes: ["Simplicial complex", "Boundary maps", "Homology", "Fundamental loop", "Persistence"],
    metrics: ["Betti-0", "Betti-1", "Boundary rank", "Persistence span"],
    pulseMode: "homology",
    pulseRegex: /Pulse.*cycle|boundary|hole|homology|Betti/i,
    stepMode: "boundary",
    stepRegex: /Step.*boundary|chain complex|partial|cycle|Betti/i
  },
  {
    id: "a13",
    file: "a13-differential-equations-flow-lab.html",
    visualKind: "differential-equations-flow-lab",
    topic: /ODE|vector field|equilibrium|Euler|Runge|stiff/i,
    selected: /Differential equation|vector field|trajectory|stability|solver/i,
    rail: ["vector field", "initial state", "local derivative", "solver trajectory", "stability"],
    modes: ["ODE flow", "Euler vs RK", "Equilibrium", "Stiff system", "Boundary value"],
    metrics: ["Step error", "Stability margin", "Equilibrium gap", "Stiffness ratio"],
    pulseMode: "flow",
    pulseRegex: /Pulse.*vector field|derivative|initial state|trajectory/i,
    stepMode: "solver",
    stepRegex: /Step.*Euler|Runge|solver|step size|local derivative/i
  },
  {
    id: "a14",
    file: "a14-complex-contour-residue-lab.html",
    visualKind: "complex-analysis-contour-lab",
    topic: /complex|contour|pole|residue|winding|Cauchy/i,
    selected: /Complex analysis|contour|residue|winding|pole/i,
    rail: ["complex plane", "contour", "pole", "winding number", "residue"],
    modes: ["Cauchy-Riemann", "Contour integral", "Residue theorem", "Laurent pole", "Branch cut"],
    metrics: ["Winding number", "Residue integral", "CR defect", "Pole distance"],
    pulseMode: "residue",
    pulseRegex: /Pulse.*residue|pole|winding|contour/i,
    stepMode: "contour",
    stepRegex: /Step.*contour|sample|integral|2pi|winding/i
  },
  {
    id: "a15",
    file: "a15-numerical-methods-stability-lab.html",
    visualKind: "numerical-methods-stability-lab",
    topic: /condition|stability|roundoff|residual|digits|iteration/i,
    selected: /Numerical methods|conditioning|stability|residual|trusted digits/i,
    rail: ["problem data", "condition number", "roundoff", "residual path", "trusted digits"],
    modes: ["Conditioning", "Root finding", "Finite differences", "Linear solve", "Time stepping"],
    metrics: ["Condition number", "Residual norm", "Trusted digits", "Stability margin"],
    pulseMode: "conditioning",
    pulseRegex: /Pulse.*conditioning|roundoff|digits|stability/i,
    stepMode: "root",
    stepRegex: /Step.*iteration|residual|root|Newton|bisection/i
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
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.32, canvasBox.y + canvasBox.height * 0.62);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.72, canvasBox.y + canvasBox.height * 0.31, { steps: 8 });
  await page.mouse.up();
  const afterOrbit = await page.evaluate((id) => window[`__${id}LabSnapshot`]().cameraTheta, lab.id);
  if (Math.abs(afterOrbit - beforeOrbit) < 0.05) throw new Error(`${lab.id}: dragging canvas did not orbit.`);

  await page.selectOption("[data-control='mode']", lab.pulseMode);
  await setRange(page, `#${lab.id}-defect`, "0.55");
  await setRange(page, `#${lab.id}-mismatch`, "0.62");
  await setRange(page, `#${lab.id}-noise`, "0.48");
  await setRange(page, `#${lab.id}-fill`, "0.35");
  await setRange(page, `#${lab.id}-step`, "0.38");
  await setRange(page, `#${lab.id}-radius`, "1.3");
  await setRange(page, `#${lab.id}-condition`, "5.5");
  await page.locator("[data-action='pulse']").click();
  await page.waitForTimeout(120);
  const pulse = await page.locator("#stateBox").textContent();
  if (!lab.pulseRegex.test(pulse)) throw new Error(`${lab.id}: Pulse task is weak: ${pulse}`);

  await page.selectOption("[data-control='mode']", lab.stepMode);
  await setRange(page, `#${lab.id}-depth`, "5");
  await setRange(page, `#${lab.id}-samples`, "8");
  await setRange(page, `#${lab.id}-iterations`, "7");
  await page.locator("[data-action='step']").click();
  await page.waitForTimeout(120);
  const step = await page.locator("#stateBox").textContent();
  if (!lab.stepRegex.test(step)) throw new Error(`${lab.id}: Step task is weak: ${step}`);

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
  console.log("a10-a15 smoke passed: all remaining A-block labs have dedicated visuals, real Pulse/Step tasks, orbiting, and fitted layout.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
