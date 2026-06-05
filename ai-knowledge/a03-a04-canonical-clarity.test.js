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
const CLARITY_VERSION = "a03-a04-canonical-clarity-v1";

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
    return {
      bytes: canvas.toDataURL("image/png").length,
      snapshot: window[snapshotName](),
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

async function testA03(page) {
  const result = await loadLab(page, "a03-eigen-quadratic-form.html", "__a03LabReady", "__a03LabSnapshot");
  requireFit(result, "A03 desktop");
  const initial = result.snapshot;
  if (result.bytes < 12000 || initial.clarityVersion !== CLARITY_VERSION || initial.labId !== "a03" || initial.has3d !== true) {
    throw new Error(`A03 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    surfaceObjectCount: 1,
    tangentGradientObjectCount: 3,
    hessianEigenObjectCount: 3,
    levelSetObjectCount: 2,
    jacobianTaylorObjectCount: 3,
    constraintObjectCount: 1
  }, "A03");
  requireFields(initial, [
    "surfaceHash",
    "pointGradientHash",
    "tangentPlaneHash",
    "hessianEigenHash",
    "levelSetHash",
    "jacobianTaylorHash",
    "directionalConstraintHash",
    "commandEffectHash",
    "canonicalReferences",
    "calculusObjects",
    "diagnosticMetrics"
  ], "A03");
  requireIncludes(initial, "calculusObjects", [
    "quadratic_surface",
    "evaluation_point_p",
    "gradient_arrow",
    "negative_gradient_flow",
    "tangent_plane",
    "hessian_eigenvectors",
    "level_set_contours",
    "jacobian_linear_tile",
    "taylor_value_linear_quadratic_stack",
    "directional_derivative_probe",
    "constraint_tangent_path"
  ], "A03");
  requireIncludes(initial, "diagnosticMetrics", [
    "gradient_norm",
    "hessian_determinant",
    "curvature_class",
    "directional_derivative",
    "taylor_formula",
    "kkt_alignment"
  ], "A03");

  await page.locator("[data-control='mode']").selectOption("hessian");
  await setRange(page, "#a03-lambda1", "1.65");
  await setRange(page, "#a03-lambda2", "-1.15");
  await setRange(page, "#a03-px", "-0.75");
  await setRange(page, "#a03-py", "0.8");
  await setRange(page, "#a03-rotation", "54");
  const configured = await page.evaluate(() => window.__a03LabSnapshot());
  if (configured.mode !== "hessian" || configured.criticalPointClass !== "saddle" || configured.hessianDeterminant >= 0 || !/hessian|saddle|lambda|gradient/i.test(configured.stateText)) {
    throw new Error(`A03 Hessian controls are not concrete: ${JSON.stringify(configured)}`);
  }
  requireChanged(initial, configured, ["surfaceHash", "pointGradientHash", "tangentPlaneHash", "hessianEigenHash", "levelSetHash", "jacobianTaylorHash"], "A03 controls", 5);

  await page.locator("[data-action='pulse']").click();
  await page.waitForFunction(() => window.__a03LabSnapshot().visualMode === "pulse");
  const pulsed = await page.evaluate(() => window.__a03LabSnapshot());
  if (!/pulse/i.test(pulsed.commandEffectHash) || !/Pulse highlights/i.test(pulsed.stateText)) {
    throw new Error(`A03 pulse action is not explicit: ${JSON.stringify(pulsed)}`);
  }
  requireChanged(configured, pulsed, ["commandEffectHash", "pointGradientHash", "hessianEigenHash"], "A03 pulse", 1);

  await page.locator("[data-action='step']").click();
  await page.waitForFunction(() => window.__a03LabSnapshot().visualMode === "step");
  const stepped = await page.evaluate(() => window.__a03LabSnapshot());
  if (!/step/i.test(stepped.commandEffectHash) || !/Step expands/i.test(stepped.stateText)) {
    throw new Error(`A03 step action is not explicit: ${JSON.stringify(stepped)}`);
  }
  requireChanged(pulsed, stepped, ["commandEffectHash", "tangentPlaneHash", "jacobianTaylorHash"], "A03 step", 1);
}

async function testA04(page) {
  const result = await loadLab(page, "a04-measure-convergence-lab.html", "__a04LabReady", "__a04LabSnapshot");
  requireFit(result, "A04 desktop");
  const initial = result.snapshot;
  if (result.bytes < 12000 || initial.clarityVersion !== CLARITY_VERSION || initial.labId !== "a04" || initial.has3d !== true) {
    throw new Error(`A04 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    domainObjectCount: 2,
    sigmaAlgebraObjectCount: 1,
    functionSequenceObjectCount: 4,
    supportMeasureObjectCount: 1,
    lebesgueSliceObjectCount: 3,
    dominatedConvergenceObjectCount: 2,
    integralMassObjectCount: 1
  }, "A04");
  requireFields(initial, [
    "measureSpaceHash",
    "functionSequenceHash",
    "supportMeasureHash",
    "simpleFunctionHash",
    "dominationHash",
    "integralLimitHash",
    "commandEffectHash",
    "canonicalReferences",
    "measureObjects",
    "diagnosticMetrics"
  ], "A04");
  requireIncludes(initial, "measureObjects", [
    "domain_interval",
    "borel_sigma_algebra_shelf",
    "function_sequence_bars",
    "support_footprint",
    "lebesgue_range_slices",
    "simple_function_step_bands",
    "dominating_envelope",
    "almost_everywhere_null_set",
    "integral_mass_basin",
    "convergence_theorem_switchboard"
  ], "A04");
  requireIncludes(initial, "diagnosticMetrics", [
    "support_measure",
    "l1_integral",
    "sup_error",
    "dominated_ratio",
    "simple_function_levels",
    "active_set_count"
  ], "A04");

  await page.locator("[data-control='mode']").selectOption("spike");
  await setRange(page, "#a04-n", "30");
  await setRange(page, "#a04-epsilon", "0.05");
  await setRange(page, "#a04-support", "0.3");
  await setRange(page, "#a04-partitions", "11");
  await setRange(page, "#a04-envelope", "0.75");
  const configured = await page.evaluate(() => window.__a04LabSnapshot());
  if (configured.mode !== "spike" || configured.supportMeasure > 0.06 || configured.l1Integral !== 1 || configured.dominatedConvergenceCondition !== false || !/almost everywhere|spike|integral|dominated/i.test(configured.stateText)) {
    throw new Error(`A04 spike controls are not concrete: ${JSON.stringify(configured)}`);
  }
  requireChanged(initial, configured, ["measureSpaceHash", "functionSequenceHash", "supportMeasureHash", "simpleFunctionHash", "dominationHash", "integralLimitHash"], "A04 controls", 5);

  await page.locator("[data-action='pulse']").click();
  await page.waitForFunction(() => window.__a04LabSnapshot().visualMode === "pulse");
  const pulsed = await page.evaluate(() => window.__a04LabSnapshot());
  if (!/pulse/i.test(pulsed.commandEffectHash) || !/support|mass|integral|almost everywhere/i.test(pulsed.stateText)) {
    throw new Error(`A04 pulse action is not explicit: ${JSON.stringify(pulsed)}`);
  }
  requireChanged(configured, pulsed, ["commandEffectHash", "supportMeasureHash", "integralLimitHash"], "A04 pulse", 1);

  await page.locator("[data-action='step']").click();
  await page.waitForFunction(() => window.__a04LabSnapshot().visualMode === "step");
  const stepped = await page.evaluate(() => window.__a04LabSnapshot());
  if (!/step/i.test(stepped.commandEffectHash) || !/Step reads/i.test(stepped.stateText)) {
    throw new Error(`A04 step action is not explicit: ${JSON.stringify(stepped)}`);
  }
  requireChanged(pulsed, stepped, ["commandEffectHash", "simpleFunctionHash", "integralLimitHash"], "A04 step", 1);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 700 } });
  try {
    await testA03(page);
    await testA04(page);
    console.log("A03/A04 canonical clarity checks passed");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
