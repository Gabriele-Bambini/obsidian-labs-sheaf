const path = require("path");

function requirePlaywright() {
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

const { chromium } = requirePlaywright();
const PREMIUM_QUALITY = "c09-c10-premium-v1";

const LABS = [
  {
    id: "c09",
    file: "c09-nonconvex-optimization-lab.html",
    requiredRoles: [
      /nonconvex multi-basin loss surface/i,
      /strict saddle plateau with small gradient/i,
      /negative-curvature escape direction/i,
      /gradient descent trajectory trapped near saddle/i,
      /perturbed trajectory escaping saddle/i,
      /sharp minimum narrow basin/i,
      /flat minimum wide basin/i,
      /basin boundary ridge/i,
      /initialization seed cloud/i,
      /Hessian eigenvalue sign frame/i,
      /momentum overshoot arc/i,
      /validation robustness halo around flat minimum/i
    ],
    forbiddenRoles: [/nonconvex loss landscape/i, /saddle negative curvature ring/i, /flat versus sharp minimum band/i]
  },
  {
    id: "c10",
    file: "c10-optimal-transport-lab.html",
    requiredRoles: [
      /source distribution mass columns/i,
      /target distribution demand columns/i,
      /transport plan matrix tubes/i,
      /ground cost distance floor/i,
      /row marginal conservation bars/i,
      /column marginal conservation bars/i,
      /Sinkhorn row scaling wave/i,
      /Sinkhorn column scaling wave/i,
      /dual potential price shelves/i,
      /tight Kantorovich constraint contacts/i,
      /entropic blur cloud/i,
      /Wasserstein displacement interpolation path/i,
      /Monge map deterministic arrows/i
    ],
    forbiddenRoles: [/source mass atom/i, /target mass atom/i, /transport coupling lane/i, /Sinkhorn scaling bar/i]
  }
];

async function setRange(page, selector, value) {
  await page.locator(selector).evaluate((input, nextValue) => {
    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
  await page.waitForTimeout(140);
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
      throw new Error(`${lab.id}: still exposes old generic role ${forbidden}.`);
    }
  }
}

async function checkC09(page) {
  await checkCommon(page, LABS[0]);
  await setRange(page, "#c09-noise", "0.05");
  await setRange(page, "#c09-regularization", "0.1");
  const calm = await readLab(page, "c09");
  await setRange(page, "#c09-noise", "0.9");
  await setRange(page, "#c09-regularization", "0.85");
  const perturbed = await readLab(page, "c09");
  if (!(perturbed.metrics["Saddle escape"] > calm.metrics["Saddle escape"])) {
    throw new Error(`c09: perturbing the run did not increase saddle escape (${calm.metrics["Saddle escape"]} -> ${perturbed.metrics["Saddle escape"]}).`);
  }
}

async function checkC10(page) {
  await checkCommon(page, LABS[1]);
  await setRange(page, "#c10-regularization", "0.08");
  const sharp = await readLab(page, "c10");
  await setRange(page, "#c10-regularization", "0.9");
  const blurry = await readLab(page, "c10");
  if (!(blurry.metrics.Entropy > sharp.metrics.Entropy)) {
    throw new Error(`c10: raising entropy epsilon did not increase entropy (${sharp.metrics.Entropy} -> ${blurry.metrics.Entropy}).`);
  }
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 700 }, deviceScaleFactor: 1 });
    await checkC09(page);
    await checkC10(page);
  } finally {
    await browser.close();
  }
  console.log("c09-c10 premium smoke passed: non-convex and optimal-transport labs are specific, fitted, and parameter-causal.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
