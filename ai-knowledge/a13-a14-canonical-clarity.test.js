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
const CLARITY_VERSION = "a13-a14-canonical-clarity-v3";
const LEGACY_VERSION = "a13-a14-canonical-clarity-v2";

async function loadLab(page, fileName, readyName, snapshotName) {
  const labPath = path.join(__dirname, fileName).replace(/\\/g, "/");
  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas#canvas").waitFor({ state: "visible" });
  await page.waitForFunction(
    ([ready, snapshot]) => window[ready] === true && typeof window[snapshot] === "function" && window[snapshot](),
    [readyName, snapshotName]
  );
  await page.waitForTimeout(220);
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
  if (result.overflowX > 18 || result.overflowY > 18 || result.commandOverflowX > 8 || result.commandOverflowY > 8) {
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

async function testA13(page) {
  const result = await loadLab(page, "a13-differential-equations-flow-lab.html", "__a13LabReady", "__a13LabSnapshot");
  requireFit(result, "A13 desktop");
  const initial = result.snapshot;
  if (result.bytes < 12000 || initial.clarityVersion !== CLARITY_VERSION || initial.legacyClarityVersion !== LEGACY_VERSION || initial.labId !== "a13" || initial.has3d !== true) {
    throw new Error(`A13 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    phaseFieldObjectCount: 18,
    solverObjectCount: 7,
    equilibriumObjectCount: 8,
    stiffModeObjectCount: 5,
    boundaryValueObjectCount: 5,
    trajectoryObjectCount: 2
  }, "A13");
  requireFields(initial, [
    "odeSceneHash",
    "solverPathHash",
    "boundaryValueHash",
    "phaseFieldHash",
    "stabilityHash",
    "stiffnessHash",
    "nullclineHash",
    "commandEffectHash",
    "canonicalReferences",
    "differentialEquationObjects",
    "diagnosticMetrics"
  ], "A13");
  requireIncludes(initial, "differentialEquationObjects", [
    "phase_plane_coordinate_grid",
    "vector_field_derivative_arrows",
    "initial_condition_x0",
    "local_derivative_tangent",
    "solution_trajectory_xt",
    "euler_step_chord",
    "euler_error_gap",
    "rk4_corrected_path",
    "runge_kutta_k_samples",
    "equilibrium_point_x_star",
    "stable_unstable_manifolds",
    "jacobian_eigenvalue_rail",
    "fast_slow_mode_rails",
    "bvp_endpoint_clamps",
    "shooting_slope_ray",
    "shooting_residual_bridge",
    "nullcline_curves",
    "lyapunov_energy_contours"
  ], "A13");
  requireIncludes(initial, "diagnosticMetrics", [
    "step_error",
    "euler_error",
    "rk_error",
    "error_ratio",
    "stability_margin",
    "equilibrium_gap",
    "stiffness_ratio",
    "local_derivative_norm",
    "lyapunov_energy",
    "shooting_residual",
    "nullcline_gap",
    "fast_slow_separation"
  ], "A13");

  await page.locator("[data-control='mode']").selectOption("solver");
  await setRange(page, "#a13-step", "0.82");
  await setRange(page, "#a13-stiffness", "6.7");
  await setRange(page, "#a13-damping", "0.12");
  await setRange(page, "#a13-initial", "1.25");
  await setRange(page, "#a13-solver", "0.08");
  const configured = await page.evaluate(() => window.__a13LabSnapshot());
  if (configured.mode !== "solver" || configured.stepError <= initial.stepError || configured.eulerError <= initial.eulerError || !/Euler|Runge-Kutta|step|error|vector field|local derivative|initial/i.test(configured.stateText)) {
    throw new Error(`A13 solver controls are not concrete: ${JSON.stringify(configured)}`);
  }
  requireChanged(initial, configured, ["odeSceneHash", "solverPathHash", "phaseFieldHash", "stabilityHash", "stiffnessHash", "nullclineHash"], "A13 controls", 5);

  await page.locator("[data-action='pulse']").click();
  await page.waitForFunction(() => window.__a13LabSnapshot().visualMode === "pulse");
  const pulsed = await page.evaluate(() => window.__a13LabSnapshot());
  if (!/pulse/i.test(pulsed.commandEffectHash) || !/Pulse.*vector field|Pulse.*local derivative|Pulse.*initial/i.test(pulsed.stateText)) {
    throw new Error(`A13 pulse action is not explicit: ${JSON.stringify(pulsed)}`);
  }
  requireChanged(configured, pulsed, ["commandEffectHash", "phaseFieldHash", "solverPathHash"], "A13 pulse", 1);

  await page.locator("[data-action='step']").click();
  await page.waitForFunction(() => window.__a13LabSnapshot().visualMode === "step");
  const stepped = await page.evaluate(() => window.__a13LabSnapshot());
  if (!/step/i.test(stepped.commandEffectHash) || !/Step.*Euler|Step.*Runge-Kutta|Step.*solver/i.test(stepped.stateText)) {
    throw new Error(`A13 step action is not explicit: ${JSON.stringify(stepped)}`);
  }
  requireChanged(pulsed, stepped, ["commandEffectHash", "solverPathHash", "boundaryValueHash"], "A13 step", 2);
}

async function testA14(page) {
  const result = await loadLab(page, "a14-complex-contour-residue-lab.html", "__a14LabReady", "__a14LabSnapshot");
  requireFit(result, "A14 desktop");
  const initial = result.snapshot;
  if (result.bytes < 12000 || initial.clarityVersion !== CLARITY_VERSION || initial.legacyClarityVersion !== LEGACY_VERSION || initial.labId !== "a14" || initial.has3d !== true) {
    throw new Error(`A14 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    complexPlaneObjectCount: 15,
    cauchyRiemannObjectCount: 4,
    contourResidueObjectCount: 8,
    laurentObjectCount: 6,
    branchSheetObjectCount: 4,
    cauchyDiskObjectCount: 1
  }, "A14");
  requireFields(initial, [
    "complexPlaneHash",
    "contourIntegralHash",
    "branchSheetHash",
    "residueTheoremHash",
    "laurentAnnulusHash",
    "cauchyRiemannHash",
    "commandEffectHash",
    "canonicalReferences",
    "complexAnalysisObjects",
    "diagnosticMetrics"
  ], "A14");
  requireIncludes(initial, "complexAnalysisObjects", [
    "complex_plane_axes_grid",
    "conformal_local_square_grid",
    "mapped_conformal_grid",
    "cauchy_riemann_check_board",
    "oriented_contour_gamma",
    "contour_integral_samples",
    "pole_marker_a",
    "residue_vector_arrow",
    "winding_number_loop_stack",
    "cauchy_disk_region",
    "laurent_annulus_punctured_disk",
    "principal_part_coefficient_rack",
    "branch_cut_barrier",
    "riemann_sheet_surfaces",
    "sheet_jump_connector",
    "derivative_multiplication_rotor",
    "zero_pole_field_markers"
  ], "A14");
  requireIncludes(initial, "diagnosticMetrics", [
    "winding_number",
    "residue_integral",
    "residue_integral_real",
    "residue_integral_imag",
    "cr_defect",
    "pole_distance",
    "contour_radius",
    "residue_strength",
    "laurent_principal_energy",
    "annulus_inner_radius",
    "annulus_outer_radius",
    "branch_cut_gap",
    "branch_jump",
    "conformal_angle_error",
    "cauchy_safe_margin"
  ], "A14");

  await page.locator("[data-control='mode']").selectOption("residue");
  await setRange(page, "#a14-radius", "1.9");
  await setRange(page, "#a14-pole", "0.62");
  await setRange(page, "#a14-residue", "1.55");
  await setRange(page, "#a14-winding", "2");
  await setRange(page, "#a14-branch", "0.72");
  const configured = await page.evaluate(() => window.__a14LabSnapshot());
  if (configured.mode !== "residue" || configured.enclosedPoleCount !== 1 || configured.residueTheoremCheck !== true || !/residue|pole|winding|2pi|contour/i.test(configured.stateText)) {
    throw new Error(`A14 residue controls are not concrete: ${JSON.stringify(configured)}`);
  }
  requireChanged(initial, configured, ["complexPlaneHash", "contourIntegralHash", "branchSheetHash", "residueTheoremHash", "laurentAnnulusHash", "cauchyRiemannHash"], "A14 controls", 5);

  await page.locator("[data-action='pulse']").click();
  await page.waitForFunction(() => window.__a14LabSnapshot().visualMode === "pulse");
  const pulsed = await page.evaluate(() => window.__a14LabSnapshot());
  if (!/pulse/i.test(pulsed.commandEffectHash) || !/Pulse.*residue|Pulse.*pole|Pulse.*winding/i.test(pulsed.stateText)) {
    throw new Error(`A14 pulse action is not explicit: ${JSON.stringify(pulsed)}`);
  }
  requireChanged(configured, pulsed, ["commandEffectHash", "residueTheoremHash", "contourIntegralHash"], "A14 pulse", 1);

  await page.locator("[data-action='step']").click();
  await page.waitForFunction(() => window.__a14LabSnapshot().visualMode === "step");
  const stepped = await page.evaluate(() => window.__a14LabSnapshot());
  if (!/step/i.test(stepped.commandEffectHash) || !/Step.*contour|Step.*integral|Step.*2pi|Step.*winding/i.test(stepped.stateText)) {
    throw new Error(`A14 step action is not explicit: ${JSON.stringify(stepped)}`);
  }
  requireChanged(pulsed, stepped, ["commandEffectHash", "contourIntegralHash", "branchSheetHash"], "A14 step", 2);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 700 } });
  try {
    await testA13(page);
    await testA14(page);
    console.log("A13/A14 canonical clarity checks passed");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
