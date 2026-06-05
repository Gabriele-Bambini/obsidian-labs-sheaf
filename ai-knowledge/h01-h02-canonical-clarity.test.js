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
const CLARITY_VERSION = "h01-h02-canonical-clarity-v1";

async function loadLab(page, fileName, readyName, snapshotName) {
  const labPath = path.join(__dirname, fileName).replace(/\\/g, "/");
  await page.goto(`file:///${labPath}`, { waitUntil: "domcontentloaded" });
  await page.locator(".lab-viewport canvas#canvas").waitFor({ state: "visible" });
  await page.waitForFunction(
    ([ready, snapshot]) => window[ready] === true && typeof window[snapshot] === "function" && window[snapshot](),
    [readyName, snapshotName]
  );
  await page.waitForTimeout(220);
  return page.evaluate((snapshotName) => {
    const canvas = document.querySelector(".lab-viewport canvas#canvas");
    const command = document.querySelector(".command-bar");
    const stateNode = document.querySelector("#state") || document.querySelector("#stateBox") || document.querySelector(".state-box");
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

function requireMinimums(snapshot, minimums, label) {
  for (const [field, min] of Object.entries(minimums)) {
    if (!(snapshot[field] >= min)) throw new Error(`${label} ${field} too weak: ${snapshot[field]} < ${min}`);
  }
}

function requireIncludes(snapshot, field, values, label) {
  if (!Array.isArray(snapshot[field])) throw new Error(`${label} ${field} is not an array: ${JSON.stringify(snapshot[field])}`);
  for (const value of values) {
    if (!snapshot[field].includes(value)) throw new Error(`${label} ${field} missing ${value}: ${JSON.stringify(snapshot[field])}`);
  }
}

function requireChanged(before, after, fields, label, minChanges = 2) {
  const changed = fields.filter((field) => before[field] !== after[field]);
  if (changed.length < minChanges) {
    throw new Error(`${label} controls changed too little. Changed ${changed.length}/${fields.length}: ${changed.join(", ")}`);
  }
}

async function testH01(page) {
  const result = await loadLab(page, "h01-introduction-sheaf-theory-lab.html", "__h01LabReady", "__h01LabSnapshot");
  requireFit(result, "H01 desktop");
  const initial = result.snapshot;
  if (result.bytes < 12000 || initial.clarityVersion !== CLARITY_VERSION || initial.labId !== "h01" || initial.has3d !== true) {
    throw new Error(`H01 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    openCoverPatchObjectCount: 3,
    localSectionObjectCount: 3,
    overlapAgreementObjectCount: 6,
    restrictionMapObjectCount: 6,
    stalkObjectCount: 9,
    cellIncidenceObjectCount: 6,
    coboundaryObjectCount: 5,
    globalSectionObjectCount: 3,
    laplacianEnergyObjectCount: 5,
    kernelGlobalSectionObjectCount: 3,
    diffusionFlowObjectCount: 5
  }, "H01");
  requireFields(initial, [
    "openCoverPatchHash",
    "localSectionHash",
    "overlapAgreementHash",
    "restrictionMapHash",
    "stalkHash",
    "cellIncidenceHash",
    "coboundaryHash",
    "globalSectionHash",
    "laplacianEnergyHash",
    "kernelGlobalSectionHash",
    "diffusionFlowHash",
    "canonicalReferences",
    "sheafObjects",
    "diagnosticMetrics"
  ], "H01");
  requireIncludes(initial, "sheafObjects", ["open_cover", "local_section", "restriction_map", "stalk", "coboundary", "global_section", "sheaf_laplacian"], "H01");
  requireIncludes(initial, "diagnosticMetrics", ["restriction_defect", "gluing_score", "global_section_gap", "sheaf_energy"], "H01");

  await page.click("#breakGluing");
  await page.waitForTimeout(120);
  const broken = await page.evaluate(() => window.__h01LabSnapshot());
  if (!(broken.coverDefect > initial.coverDefect) || !/open cover|local sections|restriction|overlap|global section/i.test(broken.stateText)) {
    throw new Error(`H01 break gluing did not visibly increase overlap obstruction: ${JSON.stringify({ initial, broken })}`);
  }
  requireChanged(initial, broken, ["overlapAgreementHash", "restrictionMapHash", "globalSectionHash", "coboundaryHash"], "H01 broken gluing", 2);

  await page.click("#makeCompatible");
  await page.waitForFunction(() => window.__h01LabSnapshot().gluePossible === true && window.__h01LabSnapshot().coverDefect < 0.08);
  const glued = await page.evaluate(() => window.__h01LabSnapshot());
  if (!/compatible|gluing axiom|unique global/i.test(glued.stateText)) {
    throw new Error(`H01 glue action does not explain the global-section axiom: ${JSON.stringify(glued)}`);
  }
  requireChanged(broken, glued, ["overlapAgreementHash", "restrictionMapHash", "globalSectionHash", "kernelGlobalSectionHash"], "H01 glued section", 2);

  await page.locator("#mode").selectOption("cellular");
  await page.locator("#restrictionMode").selectOption("signed");
  await setRange(page, "#sectionV", "-0.80");
  await page.waitForFunction(() => window.__h01LabSnapshot().mode === "cellular" && window.__h01LabSnapshot().restrictionMode === "signed");
  const cellular = await page.evaluate(() => window.__h01LabSnapshot());
  if (!/stalk|cellular|coboundary|restriction/i.test(cellular.stateText)) {
    throw new Error(`H01 cellular view does not expose stalk/restriction/coboundary objects: ${JSON.stringify(cellular)}`);
  }
  if (cellular.cellIncidenceHash === glued.cellIncidenceHash || cellular.coboundaryHash === glued.coboundaryHash) {
    throw new Error(`H01 cellular mode did not change incidence/coboundary geometry: ${JSON.stringify({ glued, cellular })}`);
  }

  const beforeEnergy = cellular.sheafEnergy;
  await page.click("#stepDiffuse");
  await page.waitForFunction((previous) => window.__h01LabSnapshot().diffusionStep >= 1 && window.__h01LabSnapshot().sheafEnergy < previous, beforeEnergy);
  const diffused = await page.evaluate(() => window.__h01LabSnapshot());
  if (!/L_F|delta\\^T delta|kernel|sheaf Laplacian/i.test(diffused.stateText)) {
    throw new Error(`H01 Laplacian diffusion does not explain energy/kernel: ${JSON.stringify(diffused)}`);
  }
  if (diffused.diffusionFlowHash === cellular.diffusionFlowHash || diffused.laplacianEnergyHash === cellular.laplacianEnergyHash) {
    throw new Error(`H01 diffusion did not animate flow/energy objects: ${JSON.stringify({ cellular, diffused })}`);
  }
}

async function testH02(page) {
  const result = await loadLab(page, "h02-sheaf-gluing-lab.html", "__h02LabReady", "__h02LabSnapshot");
  requireFit(result, "H02 desktop");
  const initial = result.snapshot;
  if (result.bytes < 12000 || initial.clarityVersion !== CLARITY_VERSION || initial.labId !== "h02" || initial.has3d !== true) {
    throw new Error(`H02 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    topologicalSpaceObjectCount: 1,
    openSetObjectCount: 3,
    localSectionSurfaceObjectCount: 3,
    overlapBandObjectCount: 3,
    restrictionArrowObjectCount: 6,
    equalizerDiagramObjectCount: 4,
    localityAxiomObjectCount: 3,
    gluingAxiomObjectCount: 3,
    germObjectCount: 7,
    presheafFailureObjectCount: 3,
    uniqueGlobalSectionObjectCount: 1,
    sheafificationObjectCount: 3
  }, "H02");
  requireFields(initial, [
    "topologicalSpaceHash",
    "openSetHash",
    "localSectionSurfaceHash",
    "overlapBandHash",
    "restrictionArrowHash",
    "equalizerDiagramHash",
    "localityAxiomHash",
    "gluingAxiomHash",
    "germHash",
    "presheafFailureHash",
    "uniqueGlobalSectionHash",
    "sheafificationHash",
    "canonicalReferences",
    "sheafAxioms",
    "exampleTypes",
    "diagnosticMetrics"
  ], "H02");
  requireIncludes(initial, "sheafAxioms", ["presheaf_restriction", "functoriality", "locality", "gluing", "unique_global_section"], "H02");
  requireIncludes(initial, "exampleTypes", ["continuous_functions", "bounded_functions_failure", "locally_constant_sheaf"], "H02");

  await page.locator("#restrictionMode").selectOption("chart");
  await setRange(page, "#uValue", "0.48");
  await setRange(page, "#vValue", "-0.54");
  await page.click("#matchOverlap");
  await page.waitForFunction(() => window.__h02LabSnapshot().phase === "matched");
  const matched = await page.evaluate(() => window.__h02LabSnapshot());
  if (!/restriction|overlap|equalizer/i.test(matched.stateText)) {
    throw new Error(`H02 match action does not make the equalizer/restriction check visible: ${JSON.stringify(matched)}`);
  }
  requireChanged(initial, matched, ["restrictionArrowHash", "overlapBandHash", "equalizerDiagramHash", "localityAxiomHash"], "H02 matched overlaps", 2);

  await page.click("#glueSections");
  await page.waitForFunction(() => window.__h02LabSnapshot().compatible === true && window.__h02LabSnapshot().globalExists === true);
  const glued = await page.evaluate(() => window.__h02LabSnapshot());
  if (!/unique global section|locality|gluing/i.test(glued.stateText) || glued.uniqueGlobalSectionHash === matched.uniqueGlobalSectionHash) {
    throw new Error(`H02 glue action did not construct a unique global section: ${JSON.stringify(glued)}`);
  }

  await page.click("#makeConflict");
  await page.waitForFunction(() => window.__h02LabSnapshot().phase === "conflict" && window.__h02LabSnapshot().compatible === false);
  const conflict = await page.evaluate(() => window.__h02LabSnapshot());
  if (!/presheaf|obstruction|gluing/i.test(conflict.stateText) || conflict.presheafFailureHash === glued.presheafFailureHash) {
    throw new Error(`H02 conflict action did not expose presheaf failure: ${JSON.stringify(conflict)}`);
  }

  await page.click("#sheafify");
  await page.waitForFunction(() => window.__h02LabSnapshot().mode === "sheafified");
  const sheafified = await page.evaluate(() => window.__h02LabSnapshot());
  if (!/germs|local-to-global|sheafification/i.test(sheafified.stateText)) {
    throw new Error(`H02 sheafification action is not concrete: ${JSON.stringify(sheafified)}`);
  }
  if (sheafified.sheafificationHash === conflict.sheafificationHash || sheafified.germHash === conflict.germHash) {
    throw new Error(`H02 sheafification did not change germ/sheafification geometry: ${JSON.stringify({ conflict, sheafified })}`);
  }
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 700 } });
  try {
    await testH01(page);
    await testH02(page);
  } finally {
    await browser.close();
  }
  console.log("h01/h02 canonical clarity passed: concrete sheaf objects, axiom-specific interactions, hashes, metrics, and fit are present.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
