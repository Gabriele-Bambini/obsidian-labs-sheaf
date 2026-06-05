const path = require("path");

function loadPlaywright() {
  const candidates = [
    "playwright",
    "C:/Users/02gab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright",
    "C:/Users/02gab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
    "C:/Users/Gabriele/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright",
    "C:/Users/Gabriele/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"
  ];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (error) {
      // Try the next bundled/runtime location.
    }
  }
  throw new Error(`Unable to load Playwright from: ${candidates.join(", ")}`);
}

const { chromium } = loadPlaywright();
const CLARITY_VERSION = "a01-a02-canonical-clarity-v1";

async function loadLab(page, fileName, readyName, snapshotName) {
  const labPath = path.join(__dirname, fileName).replace(/\\/g, "/");
  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas#canvas").waitFor({ state: "visible" });
  await page.waitForFunction(
    ([ready, snapshot]) => window[ready] === true && typeof window[snapshot] === "function" && window[snapshot](),
    [readyName, snapshotName]
  );
  await page.waitForTimeout(180);
  return page.evaluate((snapshotName) => {
    const canvas = document.querySelector(".lab-viewport canvas#canvas");
    const command = document.querySelector(".command-bar");
    const stateNode = document.querySelector("#stateBox") || document.querySelector("#state") || document.querySelector(".state-box");
    return {
      bytes: canvas.toDataURL("image/png").length,
      snapshot: window[snapshotName](),
      stateText: stateNode.textContent.trim(),
      overflowX: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
      overflowY: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight,
      commandOverflowX: command ? command.scrollWidth - command.clientWidth : 0,
      commandOverflowY: command ? command.scrollHeight - command.clientHeight : 0
    };
  }, snapshotName);
}

async function setRange(page, selector, value) {
  await page.locator(selector).evaluate((input, nextValue) => {
    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

function requireFit(result, label) {
  if (result.overflowX > 18 || result.overflowY > 18 || result.commandOverflowX > 6 || result.commandOverflowY > 6) {
    throw new Error(`${label} is not fitted: ${JSON.stringify({
      overflowX: result.overflowX,
      overflowY: result.overflowY,
      commandOverflowX: result.commandOverflowX,
      commandOverflowY: result.commandOverflowY
    })}`);
  }
}

function requireFields(snapshot, fields, label) {
  for (const field of fields) {
    if (!(field in snapshot)) throw new Error(`${label} missing snapshot field ${field}`);
    if (snapshot[field] == null || snapshot[field] === "") throw new Error(`${label} field ${field} is empty`);
  }
}

function requireIncludes(snapshot, field, values, label) {
  if (!Array.isArray(snapshot[field])) throw new Error(`${label} ${field} is not an array: ${JSON.stringify(snapshot[field])}`);
  for (const value of values) {
    if (!snapshot[field].includes(value)) throw new Error(`${label} ${field} missing ${value}: ${JSON.stringify(snapshot[field])}`);
  }
}

function requireMinimums(snapshot, minimums, label) {
  for (const [field, min] of Object.entries(minimums)) {
    if (!(snapshot[field] >= min)) throw new Error(`${label} ${field} too weak: ${snapshot[field]} < ${min}`);
  }
}

function requireChanged(before, after, fields, label, minChanges = 2) {
  const changed = fields.filter((field) => before[field] !== after[field]);
  if (changed.length < minChanges) {
    throw new Error(`${label} controls changed too little. Changed ${changed.length}/${fields.length}: ${changed.join(", ")}`);
  }
}

async function testA01(page) {
  const result = await loadLab(page, "a01-linear-algebra-foundations-lab.html", "__a01LabReady", "__a01LabSnapshot");
  requireFit(result, "A01 desktop");
  const initial = result.snapshot;
  if (result.bytes < 12000 || initial.clarityVersion !== CLARITY_VERSION || initial.labId !== "a01" || initial.has3d !== true) {
    throw new Error(`A01 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    coordinateAxisObjectCount: 3,
    componentLegObjectCount: 3,
    vectorObjectCount: 2,
    projectionObjectCount: 2,
    spanPlaneObjectCount: 1,
    matrixRankObjectCount: 2,
    dotDeterminantObjectCount: 2
  }, "A01");
  requireFields(initial, [
    "coordinateFrameHash",
    "vectorHash",
    "componentHash",
    "projectionHash",
    "spanBasisHash",
    "matrixRankHash",
    "dotProductHash",
    "determinantHash",
    "commandEffectHash",
    "canonicalReferences",
    "linearAlgebraObjects",
    "diagnosticMetrics"
  ], "A01");
  requireIncludes(initial, "linearAlgebraObjects", [
    "coordinate_axes",
    "vector_v",
    "component_legs",
    "span_plane",
    "projection_shadow",
    "orthogonal_residual",
    "second_vector_dot_angle",
    "matrix_columns_rank_nullspace",
    "determinant_volume_tile"
  ], "A01");
  requireIncludes(initial, "diagnosticMetrics", [
    "vector_length",
    "projection_norm",
    "residual_norm",
    "dot_product",
    "determinant_volume",
    "rank",
    "nullspace_dimension"
  ], "A01");

  await page.locator("[data-control='mode']").selectOption("projection");
  await setRange(page, "#a01-x", "1.75");
  await setRange(page, "#a01-y", "-1.25");
  await setRange(page, "#a01-z", "1.4");
  await setRange(page, "#a01-basis", "1.85");
  await setRange(page, "#a01-mix", "-0.65");
  const configured = await page.evaluate(() => window.__a01LabSnapshot());
  if (configured.mode !== "projection" || configured.projectionResidual < 1 || !/projection|residual|orthogonal|v =/i.test(configured.stateText)) {
    throw new Error(`A01 projection controls are not concrete: ${JSON.stringify(configured)}`);
  }
  requireChanged(initial, configured, ["coordinateFrameHash", "vectorHash", "componentHash", "projectionHash", "dotProductHash", "determinantHash"], "A01 controls", 5);

  await page.locator("[data-action='pulse']").click();
  await page.waitForFunction(() => window.__a01LabSnapshot().visualMode === "pulse");
  const pulsed = await page.evaluate(() => window.__a01LabSnapshot());
  if (!/pulse/i.test(pulsed.commandEffectHash) || !/Pulse lights/i.test(pulsed.stateText)) {
    throw new Error(`A01 pulse action is not explicit: ${JSON.stringify(pulsed)}`);
  }
  requireChanged(configured, pulsed, ["commandEffectHash", "projectionHash", "spanBasisHash"], "A01 pulse", 1);

  await page.locator("[data-action='step']").click();
  await page.waitForFunction(() => window.__a01LabSnapshot().visualMode === "step");
  const stepped = await page.evaluate(() => window.__a01LabSnapshot());
  if (!/step/i.test(stepped.commandEffectHash) || !/Step walks/i.test(stepped.stateText)) {
    throw new Error(`A01 step action is not explicit: ${JSON.stringify(stepped)}`);
  }
  requireChanged(pulsed, stepped, ["commandEffectHash", "projectionHash", "matrixRankHash"], "A01 step", 1);
}

async function testA02(page) {
  const result = await loadLab(page, "a02-linear-map-grid.html", "__a02LabReady", "__a02LabSnapshot");
  requireFit(result, "A02 desktop");
  const initial = result.snapshot;
  if (result.bytes < 12000 || initial.clarityVersion !== CLARITY_VERSION || initial.labId !== "a02" || initial.has3d !== true) {
    throw new Error(`A02 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    domainCodomainObjectCount: 2,
    linearMapArrowObjectCount: 4,
    kernelImageObjectCount: 3,
    rankNullityObjectCount: 1,
    basisCoordinateObjectCount: 2,
    dualFunctionalObjectCount: 2,
    quotientObjectCount: 3
  }, "A02");
  requireFields(initial, [
    "domainCodomainHash",
    "linearMapHash",
    "kernelImageHash",
    "rankNullityHash",
    "basisCoordinateHash",
    "dualFunctionalHash",
    "quotientHash",
    "commandEffectHash",
    "canonicalReferences",
    "linearMapObjects",
    "diagnosticMetrics"
  ], "A02");
  requireIncludes(initial, "linearMapObjects", [
    "domain_vector_space",
    "codomain_vector_space",
    "linear_map_T_arrow",
    "input_vector_v",
    "image_vector_Tv",
    "kernel_collapse_tunnel",
    "image_subspace_plane",
    "rank_nullity_balance",
    "basis_change_bridge",
    "dual_functional_probe",
    "quotient_coset_stack"
  ], "A02");
  requireIncludes(initial, "diagnosticMetrics", [
    "rank",
    "nullity",
    "determinant",
    "kernel_direction",
    "image_dimension",
    "dual_functional_value",
    "linearity_residual"
  ], "A02");

  await page.locator("[data-control='mode']").selectOption("kernel");
  await setRange(page, "#a02-stretch", "1.9");
  await setRange(page, "#a02-shear", "-0.75");
  await setRange(page, "#a02-collapse", "0.94");
  await setRange(page, "#a02-angle", "118");
  await setRange(page, "#a02-dual", "-0.55");
  const configured = await page.evaluate(() => window.__a02LabSnapshot());
  if (configured.mode !== "kernel" || configured.rank !== 2 || configured.nullity !== 1 || !/kernel|image|rank-nullity|T\(v\)/i.test(configured.stateText)) {
    throw new Error(`A02 kernel/image controls are not concrete: ${JSON.stringify(configured)}`);
  }
  requireChanged(initial, configured, ["domainCodomainHash", "linearMapHash", "kernelImageHash", "rankNullityHash", "basisCoordinateHash", "dualFunctionalHash"], "A02 controls", 5);

  await page.locator("[data-action='pulse']").click();
  await page.waitForFunction(() => window.__a02LabSnapshot().visualMode === "pulse");
  const pulsed = await page.evaluate(() => window.__a02LabSnapshot());
  if (!/pulse/i.test(pulsed.commandEffectHash) || !/Pulse highlights/i.test(pulsed.stateText)) {
    throw new Error(`A02 pulse action is not explicit: ${JSON.stringify(pulsed)}`);
  }
  requireChanged(configured, pulsed, ["commandEffectHash", "linearMapHash", "dualFunctionalHash"], "A02 pulse", 1);

  await page.locator("[data-action='step']").click();
  await page.waitForFunction(() => window.__a02LabSnapshot().visualMode === "step");
  const stepped = await page.evaluate(() => window.__a02LabSnapshot());
  if (!/step/i.test(stepped.commandEffectHash) || !/Step traces/i.test(stepped.stateText)) {
    throw new Error(`A02 step action is not explicit: ${JSON.stringify(stepped)}`);
  }
  requireChanged(pulsed, stepped, ["commandEffectHash", "kernelImageHash", "rankNullityHash"], "A02 step", 1);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 700 } });
  try {
    await testA01(page);
    await testA02(page);
    console.log("A01/A02 canonical clarity checks passed");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
