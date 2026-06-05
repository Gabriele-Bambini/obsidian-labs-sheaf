const path = require("path");

function loadPlaywright() {
  try {
    return require("playwright");
  } catch (error) {
    try {
      return require("C:/Users/02gab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
    } catch (fallbackError) {
      return require("C:/Users/02gab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright");
    }
  }
}

const { chromium } = loadPlaywright();

const PREMIUM_QUALITY = "c03-c04-premium-v1";

const LABS = [
  {
    id: "c03",
    file: "c03-constrained-optimization.html",
    requiredRoles: [
      /KKT force balance objective surface/i,
      /projected feasible region under objective/i,
      /active inequality boundary wall/i,
      /unconstrained optimum illegal witness/i,
      /constrained optimum on active boundary/i,
      /objective negative gradient vector/i,
      /constraint outward normal vector/i,
      /lambda normal force closes stationarity/i,
      /feasible direction cone on boundary/i,
      /interior barrier central path/i
    ],
    forbiddenRoles: [/active set boundary point/i, /Lagrange multiplier pressure bar/i]
  },
  {
    id: "c04",
    file: "c04-stochastic-optimization-lab.html",
    requiredRoles: [
      /noisy quadratic optimizer loss surface/i,
      /full gradient arrow on loss surface/i,
      /per-example stochastic gradient fan/i,
      /minibatch mean gradient arrow/i,
      /effective optimizer update arrow/i,
      /optimizer trajectory tube on loss surface/i,
      /noise covariance ellipse shrinks with batch size/i,
      /momentum velocity vector/i,
      /Adam per-coordinate scale ellipse/i,
      /full batch comparison direction/i
    ],
    forbiddenRoles: [/gradient variance bar/i, /minibatch gradient sample/i]
  }
];

async function setMode(page, mode) {
  await page.selectOption("[data-control='mode']", mode);
  await page.waitForTimeout(90);
}

async function setRange(page, selector, value) {
  await page.locator(selector).evaluate((input, nextValue) => {
    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function readLab(page, id) {
  return page.evaluate((labId) => {
    const root = document.querySelector(".gnn-lab");
    const canvas = document.querySelector(".lab-viewport canvas#canvas");
    const snapshot = window[`__${labId}LabSnapshot`]();
    const metrics = Object.fromEntries([...document.querySelectorAll("[data-role='metric']")].map((el) => [
      el.dataset.metric,
      Number(el.querySelector("strong").textContent)
    ]));
    return {
      quality: root.dataset.visualQuality || "",
      visualKind: root.dataset.visualKind || "",
      bytes: canvas.toDataURL("image/png").length,
      stateText: document.querySelector("#stateBox").textContent.trim(),
      pulseLabel: document.querySelector("[data-action='pulse']").textContent.trim(),
      stepLabel: document.querySelector("[data-action='step']").textContent.trim(),
      params: snapshot.params,
      roles: snapshot.visualRoles || [],
      roleCount: snapshot.visualRoleCount || 0,
      metrics
    };
  }, id);
}

async function checkCommon(page, lab) {
  const labPath = path.join(__dirname, lab.file).replace(/\\/g, "/");
  await page.goto(`file:///${labPath}?premium-pair-test=1`);
  await page.locator(".lab-viewport canvas#canvas").waitFor({ state: "visible" });
  await page.waitForFunction((id) => window[`__${id}LabReady`] === true && window[`__${id}LabSnapshot`](), lab.id);
  await page.waitForTimeout(180);

  const initial = await readLab(page, lab.id);
  if (initial.bytes < 12000) throw new Error(`${lab.id}: canvas appears blank (${initial.bytes} png bytes).`);
  if (initial.quality !== PREMIUM_QUALITY) throw new Error(`${lab.id}: missing premium quality marker, got "${initial.quality}".`);
  if (initial.roleCount < 24) throw new Error(`${lab.id}: visual system is too sparse (${initial.roleCount} roles).`);
  for (const expected of lab.requiredRoles) {
    if (!initial.roles.some((role) => expected.test(role))) {
      throw new Error(`${lab.id}: missing specific visual role ${expected}. Roles: ${initial.roles.join(" | ")}`);
    }
  }
  for (const forbidden of lab.forbiddenRoles || []) {
    if (initial.roles.some((role) => forbidden.test(role))) {
      throw new Error(`${lab.id}: forbidden old visual role ${forbidden}. Roles: ${initial.roles.join(" | ")}`);
    }
  }
  if (/^Pulse$/i.test(initial.pulseLabel) || /^Step$/i.test(initial.stepLabel)) {
    throw new Error(`${lab.id}: command labels are still generic.`);
  }
  return initial;
}

async function checkC03(page) {
  await checkCommon(page, LABS[0]);
  await setMode(page, "kkt");
  await setRange(page, "#c03-curvature", "1.35");
  await setRange(page, "#c03-step", "0.36");
  await setRange(page, "#c03-noise", "0.8");
  await setRange(page, "#c03-regularization", "0.72");
  const before = await readLab(page, "c03");
  await page.locator("[data-action='step']").click();
  await page.waitForTimeout(180);
  const after = await readLab(page, "c03");
  if (!(after.metrics["KKT residual"] <= before.metrics["KKT residual"] + 0.25)) {
    throw new Error(`c03: KKT step did not keep stationarity residual controlled (${before.metrics["KKT residual"]} -> ${after.metrics["KKT residual"]}).`);
  }
  if (String(before.params.regularization) === String(after.params.regularization) && String(before.params.noise) === String(after.params.noise)) {
    throw new Error("c03: KKT/barrier command did not modify a meaningful visible parameter.");
  }
}

async function checkC04(page) {
  await checkCommon(page, LABS[1]);
  await setMode(page, "minibatch");
  await setRange(page, "#c04-noise", "0.72");
  await setRange(page, "#c04-budget", "2");
  await page.waitForTimeout(120);
  const smallBatch = await readLab(page, "c04");
  await setRange(page, "#c04-budget", "12");
  await page.waitForTimeout(160);
  const largeBatch = await readLab(page, "c04");
  if (!(largeBatch.metrics["Gradient variance"] < smallBatch.metrics["Gradient variance"])) {
    throw new Error(`c04: larger batch did not reduce gradient variance (${smallBatch.metrics["Gradient variance"]} -> ${largeBatch.metrics["Gradient variance"]}).`);
  }
  await setRange(page, "#c04-step", "0.18");
  await page.waitForTimeout(100);
  const smallStep = await readLab(page, "c04");
  await setRange(page, "#c04-step", "0.82");
  await page.waitForTimeout(100);
  const largeStep = await readLab(page, "c04");
  if (!(largeStep.metrics["Update norm"] > smallStep.metrics["Update norm"])) {
    throw new Error(`c04: learning rate did not increase update norm (${smallStep.metrics["Update norm"]} -> ${largeStep.metrics["Update norm"]}).`);
  }
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 700 } });
  try {
    await checkC03(page);
    await checkC04(page);
  } finally {
    await browser.close();
  }
  console.log("c03-c04 premium smoke passed: constrained and stochastic optimization labs are lesson-specific, 3D, fitted, and parameter-causal.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
