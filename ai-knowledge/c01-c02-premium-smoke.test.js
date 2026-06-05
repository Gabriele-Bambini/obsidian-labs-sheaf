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

const PREMIUM_QUALITY = "c01-c02-premium-v1";

const LABS = [
  {
    id: "c01",
    file: "c01-convex-analysis-lab.html",
    pulseMode: "jensen",
    stepMode: "fenchel",
    requiredRoles: [
      /A03-style fixed convex analysis grid landscape/i,
      /fixed convex reticulated certificate surface/i,
      /average input height comparison/i,
      /epigraph vertical slice chamber/i,
      /Jensen chord through two surface points/i,
      /Jensen midpoint vertical gap on 3D convex bowl/i,
      /supporting tangent plane on 3D convex bowl/i,
      /Fenchel affine plane tangent to convex bowl/i
    ],
    forbiddenRoles: [/storyboard/i, /convex hull witness/i, /slope board/i]
  },
  {
    id: "c02",
    file: "c02-optimization-landscape.html",
    pulseMode: "gradient",
    stepMode: "newton",
    requiredRoles: [
      /A03-style fixed convex grid landscape/i,
      /fixed convex reticulated objective surface/i,
      /gradient descent convergence trajectory on surface/i,
      /line-search convergence samples on surface/i,
      /rejected oversized step on landscape/i,
      /Newton convergence trajectory on surface/i,
      /Newton rescaled valley ellipse on landscape/i,
      /newton Hessian curvature frame/i,
      /momentum convergence trajectory on surface/i,
      /minimum target on convex landscape/i
    ],
    forbiddenRoles: [/storyboard/i, /acceptance ladder/i, /trial ray/i]
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
    return {
      quality: root.dataset.visualQuality || "",
      visualKind: root.dataset.visualKind || "",
      bytes: canvas.toDataURL("image/png").length,
      stateText: document.querySelector("#stateBox").textContent.trim(),
      selectedText: document.querySelector("[data-role='selected'] strong").textContent.trim(),
      pulseLabel: document.querySelector("[data-action='pulse']").textContent.trim(),
      stepLabel: document.querySelector("[data-action='step']").textContent.trim(),
      params: snapshot.params,
      roles: snapshot.visualRoles || [],
      roleCount: snapshot.visualRoleCount || 0
    };
  }, id);
}

async function checkLab(page, lab) {
  const labPath = path.join(__dirname, lab.file).replace(/\\/g, "/");
  await page.goto(`file:///${labPath}?premium-pair-test=1`);
  await page.locator(".lab-viewport canvas#canvas").waitFor({ state: "visible" });
  await page.waitForFunction((id) => window[`__${id}LabReady`] === true && window[`__${id}LabSnapshot`](), lab.id);
  await page.waitForTimeout(180);

  const initial = await readLab(page, lab.id);
  if (initial.bytes < 12000) throw new Error(`${lab.id}: canvas appears blank (${initial.bytes} png bytes).`);
  if (initial.quality !== PREMIUM_QUALITY) throw new Error(`${lab.id}: missing premium pair quality marker, got "${initial.quality}".`);
  if (initial.roleCount < 24) throw new Error(`${lab.id}: visual system is too sparse (${initial.roleCount} roles).`);
  for (const expected of lab.requiredRoles) {
    if (!initial.roles.some((role) => expected.test(role))) {
      throw new Error(`${lab.id}: missing specific visual role ${expected}. Roles: ${initial.roles.join(" | ")}`);
    }
  }
  for (const forbidden of lab.forbiddenRoles || []) {
    if (initial.roles.some((role) => forbidden.test(role))) {
      throw new Error(`${lab.id}: forbidden non-landscape role ${forbidden}. Roles: ${initial.roles.join(" | ")}`);
    }
  }
  await setMode(page, lab.pulseMode);
  await setRange(page, `#${lab.id}-curvature`, "1.3");
  await setRange(page, `#${lab.id}-step`, "0.47");
  await setRange(page, `#${lab.id}-noise`, "0.22");
  await setRange(page, `#${lab.id}-budget`, "10");
  await setRange(page, `#${lab.id}-regularization`, "0.58");
  await page.locator("[data-action='pulse']").click();
  await page.waitForTimeout(160);
  const pulsed = await readLab(page, lab.id);
  if (/^Pulse$/i.test(pulsed.pulseLabel)) {
    throw new Error(`${lab.id}: pulse command label is still generic: ${pulsed.pulseLabel}`);
  }

  await setMode(page, lab.stepMode);
  await setRange(page, `#${lab.id}-curvature`, "0.72");
  await setRange(page, `#${lab.id}-step`, "0.29");
  await setRange(page, `#${lab.id}-noise`, "0.36");
  await setRange(page, `#${lab.id}-budget`, "8");
  await setRange(page, `#${lab.id}-regularization`, "0.44");
  const before = await readLab(page, lab.id);
  await page.locator("[data-action='step']").click();
  await page.waitForTimeout(180);
  const after = await readLab(page, lab.id);
  if (/^Step$/i.test(after.stepLabel)) {
    throw new Error(`${lab.id}: step command label is still generic: ${after.stepLabel}`);
  }
  const changed = ["curvature", "step", "noise", "budget", "regularization"].filter((key) => String(before.params[key]) !== String(after.params[key]));
  if (!changed.length) throw new Error(`${lab.id}: step did not modify a visible parameter.`);
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
  console.log("c01-c02 premium smoke passed: C01/C02 have dense, lesson-specific, interactive premium visuals.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
