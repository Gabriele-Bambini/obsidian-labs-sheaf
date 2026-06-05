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
const CLARITY_VERSION = "a11-a12-canonical-clarity-v1";
const LEGACY_VERSION = "a11-a12-concrete-clarity-v2";

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

async function testA11(page) {
  const result = await loadLab(page, "a11-information-theory-lab.html", "__a11LabReady", "__a11LabSnapshot");
  requireFit(result, "A11 desktop");
  const initial = result.snapshot;
  if (result.bytes < 12000 || initial.clarityVersion !== CLARITY_VERSION || initial.legacyClarityVersion !== LEGACY_VERSION || initial.labId !== "a11" || initial.has3d !== true) {
    throw new Error(`A11 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    distributionTowerObjectCount: 10,
    codingLengthObjectCount: 5,
    klPenaltyObjectCount: 3,
    jointChannelObjectCount: 10,
    mutualInformationObjectCount: 3,
    compressionDiagnosticObjectCount: 3
  }, "A11");
  requireFields(initial, [
    "distributionHash",
    "codingIdentityHash",
    "channelMatrixHash",
    "jointProductHash",
    "typicalSetHash",
    "bottleneckHash",
    "commandEffectHash",
    "canonicalReferences",
    "informationObjects",
    "diagnosticMetrics"
  ], "A11");
  requireIncludes(initial, "informationObjects", [
    "data_distribution_p_towers",
    "model_distribution_q_towers",
    "surprise_spikes_minus_log_p",
    "shannon_code_length_rack",
    "cross_entropy_bridge",
    "kl_extra_bits_brace",
    "typical_set_slab",
    "joint_distribution_matrix",
    "product_independence_matrix",
    "noisy_channel_transition_matrix",
    "mutual_information_band",
    "channel_capacity_meter",
    "support_mismatch_wall",
    "perplexity_wheel",
    "information_bottleneck_gate"
  ], "A11");
  requireIncludes(initial, "diagnosticMetrics", [
    "entropy_bits",
    "cross_entropy_bits",
    "kl_extra_bits",
    "support_mismatch_risk",
    "typical_set_size",
    "perplexity",
    "mutual_information_bits",
    "conditional_entropy_bits",
    "channel_capacity_bits",
    "bottleneck_retained_info"
  ], "A11");

  await page.locator("[data-control='mode']").selectOption("kl");
  await setRange(page, "#a11-spread", "0.24");
  await setRange(page, "#a11-mismatch", "0.88");
  await setRange(page, "#a11-noise", "0.42");
  await setRange(page, "#a11-samples", "10");
  await setRange(page, "#a11-temperature", "0.55");
  const configured = await page.evaluate(() => window.__a11LabSnapshot());
  if (configured.mode !== "kl" || configured.klBits <= initial.klBits || !/KL|extra code length|model q|data from p/i.test(configured.stateText)) {
    throw new Error(`A11 KL controls are not concrete: ${JSON.stringify(configured)}`);
  }
  requireChanged(initial, configured, ["distributionHash", "codingIdentityHash", "channelMatrixHash", "jointProductHash", "typicalSetHash", "bottleneckHash"], "A11 controls", 5);

  await page.locator("[data-action='pulse']").click();
  await page.waitForFunction(() => window.__a11LabSnapshot().visualMode === "pulse");
  const pulsed = await page.evaluate(() => window.__a11LabSnapshot());
  if (!/pulse/i.test(pulsed.commandEffectHash) || !/Pulse.*KL|Pulse.*extra bits|Pulse.*coding/i.test(pulsed.stateText)) {
    throw new Error(`A11 pulse action is not explicit: ${JSON.stringify(pulsed)}`);
  }
  requireChanged(configured, pulsed, ["commandEffectHash", "codingIdentityHash", "bottleneckHash"], "A11 pulse", 1);

  await page.locator("[data-control='mode']").selectOption("channel");
  await page.locator("[data-action='step']").click();
  await page.waitForFunction(() => window.__a11LabSnapshot().visualMode === "step");
  const stepped = await page.evaluate(() => window.__a11LabSnapshot());
  if (!/step/i.test(stepped.commandEffectHash) || !/Step.*noisy channel|Step.*mutual information|input.*output/i.test(stepped.stateText)) {
    throw new Error(`A11 step action is not explicit: ${JSON.stringify(stepped)}`);
  }
  requireChanged(pulsed, stepped, ["commandEffectHash", "channelMatrixHash", "jointProductHash"], "A11 step", 2);
}

async function testA12(page) {
  const result = await loadLab(page, "a12-algebraic-topology-lab.html", "__a12LabReady", "__a12LabSnapshot");
  requireFit(result, "A12 desktop");
  const initial = result.snapshot;
  if (result.bytes < 12000 || initial.clarityVersion !== CLARITY_VERSION || initial.legacyClarityVersion !== LEGACY_VERSION || initial.labId !== "a12" || initial.has3d !== true) {
    throw new Error(`A12 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    simplexObjectCount: 7,
    chainGroupObjectCount: 3,
    boundaryMatrixObjectCount: 6,
    homologyQuotientObjectCount: 4,
    fundamentalCohomologyObjectCount: 4,
    persistenceObjectCount: 5
  }, "A12");
  requireFields(initial, [
    "chainComplexHash",
    "boundaryMatrixHash",
    "cycleBoundaryHash",
    "quotientHash",
    "cohomologyHash",
    "persistenceBarcodeHash",
    "commandEffectHash",
    "canonicalReferences",
    "algebraicTopologyObjects",
    "diagnosticMetrics"
  ], "A12");
  requireIncludes(initial, "algebraicTopologyObjects", [
    "simplicial_complex_vertices_edges_face",
    "oriented_boundary_arrows",
    "chain_group_shelves_C0_C1_C2",
    "boundary_matrix_partial_1",
    "boundary_matrix_partial_2",
    "boundary_of_boundary_zero_witness",
    "cycle_kernel_loop_Z1",
    "boundary_image_plate_B1",
    "homology_quotient_gate_H1",
    "betti_counter_towers",
    "fundamental_group_loop",
    "winding_number_rail",
    "cochain_dual_probe",
    "coboundary_delta_arrow",
    "cup_product_tile",
    "filtration_radius_balls",
    "barcode_interval_rack",
    "birth_death_plane"
  ], "A12");
  requireIncludes(initial, "diagnosticMetrics", [
    "betti_0",
    "betti_1",
    "betti_2",
    "boundary_rank",
    "boundary_squared_residual",
    "cycle_kernel_dimension",
    "boundary_image_rank",
    "homology_dimension",
    "winding_number",
    "persistence_span"
  ], "A12");

  await page.locator("[data-control='mode']").selectOption("homology");
  await setRange(page, "#a12-radius", "1.55");
  await setRange(page, "#a12-fill", "0.82");
  await setRange(page, "#a12-boundary", "0.92");
  await setRange(page, "#a12-twist", "0.72");
  await setRange(page, "#a12-persistence", "0.84");
  const configured = await page.evaluate(() => window.__a12LabSnapshot());
  if (configured.mode !== "homology" || configured.faceKillsLoop !== true || configured.betti1 !== 0 || !/filled triangle|kills|1-cycle|Betti-1|homology/i.test(configured.stateText)) {
    throw new Error(`A12 homology controls are not concrete: ${JSON.stringify(configured)}`);
  }
  requireChanged(initial, configured, ["chainComplexHash", "boundaryMatrixHash", "cycleBoundaryHash", "quotientHash", "cohomologyHash", "persistenceBarcodeHash"], "A12 controls", 5);

  await page.locator("[data-action='pulse']").click();
  await page.waitForFunction(() => window.__a12LabSnapshot().visualMode === "pulse");
  const pulsed = await page.evaluate(() => window.__a12LabSnapshot());
  if (!/pulse/i.test(pulsed.commandEffectHash) || !/Pulse.*cycle|Pulse.*boundary|Pulse.*Betti/i.test(pulsed.stateText)) {
    throw new Error(`A12 pulse action is not explicit: ${JSON.stringify(pulsed)}`);
  }
  requireChanged(configured, pulsed, ["commandEffectHash", "cycleBoundaryHash", "quotientHash"], "A12 pulse", 1);

  await page.locator("[data-control='mode']").selectOption("boundary");
  await page.locator("[data-action='step']").click();
  await page.waitForFunction(() => window.__a12LabSnapshot().visualMode === "step");
  const stepped = await page.evaluate(() => window.__a12LabSnapshot());
  if (!/step/i.test(stepped.commandEffectHash) || !/Step.*boundary operator|Step.*partial|Step.*chain complex/i.test(stepped.stateText)) {
    throw new Error(`A12 step action is not explicit: ${JSON.stringify(stepped)}`);
  }
  requireChanged(pulsed, stepped, ["commandEffectHash", "boundaryMatrixHash", "cycleBoundaryHash"], "A12 step", 2);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 700 } });
  try {
    await testA11(page);
    await testA12(page);
    console.log("A11/A12 canonical clarity checks passed");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
