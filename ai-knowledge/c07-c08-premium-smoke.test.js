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

const PREMIUM_QUALITY = "c07-c08-premium-v1";

const LABS = [
  {
    id: "c07",
    file: "c07-duality-theory-lab.html",
    requiredRoles: [
      /primal objective surface with feasible candidate/i,
      /dual lower-bound plane certificate/i,
      /vertical primal-dual gap certificate/i,
      /Lagrangian saddle surface over x lambda/i,
      /active constraint complementarity contact/i,
      /Fenchel support plane touches primal function/i,
      /dual feasible price vector/i,
      /weak duality bound ladder/i,
      /strong duality zero-gap target/i,
      /minimax saddle exchange axes/i
    ],
    forbiddenRoles: [/Lagrangian saddle ring/i, /certificate slack band/i]
  },
  {
    id: "c08",
    file: "c08-proximal-methods-lab.html",
    requiredRoles: [
      /proximal subproblem bowl plus nonsmooth corner/i,
      /current point v before prox/i,
      /prox output x plus after shrinkage/i,
      /quadratic pull tether from v to prox/i,
      /soft-threshold deadzone slab/i,
      /Moreau envelope smooth surface/i,
      /forward gradient step before backward prox/i,
      /ADMM split x variable lane/i,
      /ADMM split z variable lane/i,
      /primal dual residual connector/i
    ],
    forbiddenRoles: [/soft threshold coefficient bar/i, /proximal map center/i]
  }
];

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
}

async function checkC07(page) {
  await checkCommon(page, LABS[0]);
  await setRange(page, "#c07-regularization", "0.2");
  await page.waitForTimeout(120);
  const loose = await readLab(page, "c07");
  await setRange(page, "#c07-regularization", "0.88");
  await page.waitForTimeout(160);
  const tight = await readLab(page, "c07");
  if (!(tight.metrics["Duality gap"] < loose.metrics["Duality gap"])) {
    throw new Error(`c07: tightening certificate did not reduce duality gap (${loose.metrics["Duality gap"]} -> ${tight.metrics["Duality gap"]}).`);
  }
}

async function checkC08(page) {
  await checkCommon(page, LABS[1]);
  await setRange(page, "#c08-regularization", "0.12");
  await page.waitForTimeout(120);
  const weak = await readLab(page, "c08");
  await setRange(page, "#c08-regularization", "0.9");
  await page.waitForTimeout(160);
  const strong = await readLab(page, "c08");
  if (!(strong.metrics["Sparsity"] > weak.metrics["Sparsity"])) {
    throw new Error(`c08: stronger threshold did not increase sparsity (${weak.metrics["Sparsity"]} -> ${strong.metrics["Sparsity"]}).`);
  }
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 700 } });
  try {
    await checkC07(page);
    await checkC08(page);
  } finally {
    await browser.close();
  }
  console.log("c07-c08 premium smoke passed: duality and proximal-method labs are specific, 3D, fitted, and parameter-causal.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
