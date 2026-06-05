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
const CLARITY_VERSION = "a09-a10-canonical-clarity-v1";
const LEGACY_VERSION = "a09-a10-category-clarity-v2";

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
      modeLabels: [...document.querySelectorAll("[data-control='mode'] option")].map((node) => node.textContent.trim()),
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

async function testA09(page) {
  const result = await loadLab(page, "a09-category-theory-diagram-lab.html", "__a09LabReady", "__a09LabSnapshot");
  requireFit(result, "A09 desktop");
  const initial = result.snapshot;
  if (result.bytes < 12000 || initial.clarityVersion !== CLARITY_VERSION || initial.legacyClarityVersion !== LEGACY_VERSION || initial.labId !== "a09" || initial.has3d !== true) {
    throw new Error(`A09 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  for (const label of ["Category laws", "Commuting square", "Functor layer", "Naturality square", "Poset category", "One-object monoid", "Contravariant/sheaf"]) {
    if (!result.modeLabels.includes(label)) throw new Error(`A09 missing mode "${label}": ${result.modeLabels.join(" | ")}`);
  }
  requireMinimums(initial, {
    sourceCategoryObjectCount: 4,
    targetCategoryObjectCount: 4,
    identityLoopObjectCount: 3,
    compositionArrowObjectCount: 6,
    commutingSquareObjectCount: 5,
    functorLayerObjectCount: 5,
    naturalitySquareObjectCount: 4,
    examplePanelObjectCount: 6
  }, "A09");
  requireFields(initial, [
    "categoryDiagramHash",
    "compositionEquationHash",
    "commutingSquareHash",
    "naturalitySquareHash",
    "functorImageHash",
    "contravariantSheafHash",
    "commandEffectHash",
    "canonicalReferences",
    "categoryObjects",
    "diagnosticMetrics"
  ], "A09");
  requireIncludes(initial, "categoryObjects", [
    "source_category_objects_A_B_C_D",
    "identity_arrows_on_objects",
    "composable_chain_f_g_h",
    "composite_arrows_gof_hog_hogof",
    "commuting_square_route_equality",
    "hom_set_shelf",
    "isomorphism_inverse_pair",
    "functor_image_category",
    "functor_composition_preservation_tile",
    "naturality_eta_square",
    "poset_hasse_diagram",
    "one_object_monoid_endomorphisms",
    "contravariant_pullback_reversal",
    "sheaf_restriction_ladder"
  ], "A09");
  requireIncludes(initial, "diagnosticMetrics", [
    "identity_law_check",
    "associativity_residual",
    "commuting_square_gap",
    "functor_law_residual",
    "naturality_gap",
    "hom_set_count",
    "poset_thinness",
    "monoid_endomorphism_count",
    "restriction_composition_gap"
  ], "A09");

  await page.locator("[data-control='mode']").selectOption("square");
  await setRange(page, "#a09-objects", "4");
  await setRange(page, "#a09-functor", "0.9");
  await setRange(page, "#a09-composition", "0.35");
  await setRange(page, "#a09-naturality", "0.65");
  await setRange(page, "#a09-reversal", "0.8");
  const configured = await page.evaluate(() => window.__a09LabSnapshot());
  if (configured.mode !== "square" || configured.commutingSquareGap < 0.25 || !/commuting square|right then down|down then right|route/i.test(configured.stateText)) {
    throw new Error(`A09 commuting-square controls are not concrete: ${JSON.stringify(configured)}`);
  }
  requireChanged(initial, configured, ["categoryDiagramHash", "compositionEquationHash", "commutingSquareHash", "naturalitySquareHash", "functorImageHash", "contravariantSheafHash"], "A09 controls", 5);

  await page.locator("[data-action='pulse']").click();
  await page.waitForFunction(() => window.__a09LabSnapshot().visualMode === "pulse");
  const pulsed = await page.evaluate(() => window.__a09LabSnapshot());
  if (!/pulse/i.test(pulsed.commandEffectHash) || !/Pulse.*diagram laws|Pulse.*commuting square|Pulse.*functor/i.test(pulsed.stateText)) {
    throw new Error(`A09 pulse action is not explicit: ${JSON.stringify(pulsed)}`);
  }
  requireChanged(configured, pulsed, ["commandEffectHash", "commutingSquareHash", "functorImageHash"], "A09 pulse", 1);

  await page.locator("[data-action='step']").click();
  await page.waitForFunction(() => window.__a09LabSnapshot().visualMode === "step");
  const stepped = await page.evaluate(() => window.__a09LabSnapshot());
  if (!/step/i.test(stepped.commandEffectHash) || !/Step.*compose|Step.*route|Step.*naturality/i.test(stepped.stateText)) {
    throw new Error(`A09 step action is not explicit: ${JSON.stringify(stepped)}`);
  }
  requireChanged(pulsed, stepped, ["commandEffectHash", "compositionEquationHash", "commutingSquareHash"], "A09 step", 1);
}

async function testA10(page) {
  const result = await loadLab(page, "a10-category-limits-adjunctions-lab.html", "__a10LabReady", "__a10LabSnapshot");
  requireFit(result, "A10 desktop");
  const initial = result.snapshot;
  if (result.bytes < 12000 || initial.clarityVersion !== CLARITY_VERSION || initial.legacyClarityVersion !== LEGACY_VERSION || initial.labId !== "a10" || initial.has3d !== true) {
    throw new Error(`A10 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    productConeObjectCount: 4,
    pullbackEqualizerObjectCount: 4,
    colimitGlueObjectCount: 4,
    adjunctionObjectCount: 5,
    monadObjectCount: 4,
    kanSheafObjectCount: 5
  }, "A10");
  requireFields(initial, [
    "universalConeHash",
    "pullbackEqualizerHash",
    "pushoutGlueHash",
    "adjunctionTriangleHash",
    "monadFlattenHash",
    "leftRightKanModeHash",
    "sheafGluingHash",
    "commandEffectHash",
    "canonicalReferences",
    "advancedCategoryObjects",
    "diagnosticMetrics"
  ], "A10");
  requireIncludes(initial, "advancedCategoryObjects", [
    "product_universal_cone",
    "projection_arrows_pi_A_pi_B",
    "mediating_unique_factorization",
    "pullback_compatible_pairs_square",
    "equalizer_agreement_gate",
    "coproduct_injection_alternatives",
    "pushout_gluing_cocone",
    "coequalizer_quotient_rail",
    "adjunction_hom_set_bijection_bridge",
    "unit_eta_and_counit_epsilon",
    "triangular_identity_witness",
    "monad_T_equals_UF_stack",
    "monad_multiplication_mu_flatten",
    "kan_extension_Lan_Ran_envelopes",
    "sheaf_local_to_global_gluing_cover"
  ], "A10");
  requireIncludes(initial, "diagnosticMetrics", [
    "cone_defect",
    "pullback_agreement",
    "equalizer_residual",
    "hom_set_bijection_residual",
    "unit_counit_triangle_gap",
    "monad_flatten_depth",
    "monad_coherence",
    "kan_extension_cost",
    "sheaf_glue_coherence",
    "universal_defect"
  ], "A10");

  await page.locator("[data-control='mode']").selectOption("monad");
  await setRange(page, "#a10-defect", "0.64");
  await setRange(page, "#a10-adjunction", "0.42");
  await setRange(page, "#a10-depth", "7");
  await setRange(page, "#a10-extension", "0.88");
  await setRange(page, "#a10-glue", "0.73");
  const configured = await page.evaluate(() => window.__a10LabSnapshot());
  if (configured.mode !== "monad" || configured.monadFlattenDepth !== 7 || configured.monadCoherence >= initial.monadCoherence || !/Monad|unit|multiplication|flatten|T = U F/i.test(configured.stateText)) {
    throw new Error(`A10 monad controls are not concrete: ${JSON.stringify(configured)}`);
  }
  requireChanged(initial, configured, ["universalConeHash", "pullbackEqualizerHash", "pushoutGlueHash", "adjunctionTriangleHash", "monadFlattenHash", "leftRightKanModeHash", "sheafGluingHash"], "A10 controls", 6);

  await page.locator("[data-action='pulse']").click();
  await page.waitForFunction(() => window.__a10LabSnapshot().visualMode === "pulse");
  const pulsed = await page.evaluate(() => window.__a10LabSnapshot());
  if (!/pulse/i.test(pulsed.commandEffectHash) || !/Pulse.*universal|Pulse.*adjunction|Pulse.*arrow data/i.test(pulsed.stateText)) {
    throw new Error(`A10 pulse action is not explicit: ${JSON.stringify(pulsed)}`);
  }
  requireChanged(configured, pulsed, ["commandEffectHash", "universalConeHash", "adjunctionTriangleHash"], "A10 pulse", 1);

  await page.locator("[data-action='step']").click();
  await page.waitForFunction(() => window.__a10LabSnapshot().visualMode === "step");
  const stepped = await page.evaluate(() => window.__a10LabSnapshot());
  if (!/step/i.test(stepped.commandEffectHash) || !/Step.*monad|Step.*flatten|Step.*universal/i.test(stepped.stateText)) {
    throw new Error(`A10 step action is not explicit: ${JSON.stringify(stepped)}`);
  }
  requireChanged(pulsed, stepped, ["commandEffectHash", "monadFlattenHash", "sheafGluingHash"], "A10 step", 1);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 700 } });
  try {
    await testA09(page);
    await testA10(page);
    console.log("A09/A10 canonical clarity checks passed");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
