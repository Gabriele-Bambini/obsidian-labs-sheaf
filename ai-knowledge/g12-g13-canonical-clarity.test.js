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
      // Continue through known runtime locations.
    }
  }

  throw new Error(`Unable to load Playwright from: ${candidates.join(", ")}`);
}

const { chromium } = loadPlaywright();
const CLARITY_VERSION = "g12-g13-canonical-clarity-v1";

async function setRange(page, selector, value) {
  await page.locator(selector).evaluate((input, nextValue) => {
    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function loadLab(page, fileName, readyName, snapshotName) {
  const labPath = path.join(__dirname, fileName).replace(/\\/g, "/");
  await page.goto(`file:///${labPath}`, { waitUntil: "domcontentloaded" });
  await page.locator(".lab-viewport canvas#canvas").waitFor({ state: "visible" });
  await page.waitForFunction(
    ([ready, snapshot]) => window[ready] === true && typeof window[snapshot] === "function" && window[snapshot](),
    [readyName, snapshotName]
  );
  await page.waitForTimeout(220);
  return page.evaluate((snapshot) => {
    const canvas = document.querySelector(".lab-viewport canvas#canvas");
    const command = document.querySelector(".command-bar");
    const stateNode = document.querySelector("#state") || document.querySelector("#stateBox") || document.querySelector(".state-box");
    return {
      bytes: canvas.toDataURL("image/png").length,
      snapshot: window[snapshot](),
      stateText: stateNode.textContent.trim(),
      overflowX: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
      overflowY: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight,
      commandOverflowX: command ? command.scrollWidth - command.clientWidth : 0,
      commandOverflowY: command ? command.scrollHeight - command.clientHeight : 0
    };
  }, snapshotName);
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

function requireChanged(before, after, fields, label) {
  const changed = fields.filter((field) => before[field] !== after[field]);
  if (changed.length < Math.max(4, Math.ceil(fields.length * 0.45))) {
    throw new Error(`${label} controls changed too little. Changed ${changed.length}/${fields.length}: ${changed.join(", ")}`);
  }
}

async function requireOrbit(page, snapshotName) {
  const before = await page.evaluate((snapshot) => window[snapshot](), snapshotName);
  await page.mouse.move(420, 300);
  await page.mouse.down();
  await page.mouse.move(575, 365);
  await page.mouse.up();
  await page.waitForTimeout(90);
  const after = await page.evaluate((snapshot) => window[snapshot](), snapshotName);
  if (Math.abs(after.cameraTheta - before.cameraTheta) < 0.04) {
    throw new Error(`${snapshotName} camera did not rotate manually`);
  }
}

async function testG12(page) {
  const result = await loadLab(page, "g12-molecular-message-passing-lab.html", "__g12LabReady", "__g12LabSnapshot");
  requireFit(result, "G12 desktop");
  await requireOrbit(page, "__g12LabSnapshot");
  const initial = result.snapshot;
  if (result.bytes < 13000 || initial.clarityVersion !== CLARITY_VERSION || initial.labId !== "g12" || initial.has3d !== true) {
    throw new Error(`G12 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    atomFeatureObjectCount: 8,
    typedBondObjectCount: 6,
    bondMessageObjectCount: 6,
    radialBasisObjectCount: 6,
    cutoffGeometryObjectCount: 3,
    nonbondedNeighborObjectCount: 6,
    conformerObjectCount: 6,
    readoutObjectCount: 6,
    chargeDipoleObjectCount: 4,
    mpnnPipelineObjectCount: 3,
    energyForceHeadObjectCount: 3
  }, "G12");
  requireFields(initial, [
    "atomFeatureHash",
    "typedBondHash",
    "bondMessageHash",
    "radialBasisHash",
    "cutoffGeometryHash",
    "nonbondedNeighborHash",
    "conformerHash",
    "readoutHash",
    "chargeDipoleHash",
    "mpnnPipelineHash",
    "energyForceHeadHash",
    "targetTypes",
    "symmetryChecks"
  ], "G12");
  for (const target of ["energy", "dipole", "force"]) {
    if (!initial.targetTypes.includes(target)) throw new Error(`G12 missing molecular target ${target}: ${JSON.stringify(initial)}`);
  }
  for (const symmetry of ["permutation", "translation", "rotation"]) {
    if (!initial.symmetryChecks.includes(symmetry)) throw new Error(`G12 missing symmetry check ${symmetry}: ${JSON.stringify(initial)}`);
  }

  await page.locator("#moleculeSelect").selectOption("aromatic");
  await page.locator("#messageRule").selectOption("hybrid");
  await page.locator("#readoutMode").selectOption("attention");
  await setRange(page, "#mpnnLayers", "6");
  await setRange(page, "#bondWeight", "1.85");
  await setRange(page, "#geometryWeight", "1.35");
  await setRange(page, "#distanceCutoff", "4.25");
  await page.click("#passMessages");
  await page.click("#toggleGeometry");
  await page.click("#poolReadout");
  await page.waitForTimeout(160);
  const after = await page.evaluate(() => window.__g12LabSnapshot());
  requireChanged(initial, after, [
    "atomFeatureHash",
    "typedBondHash",
    "bondMessageHash",
    "radialBasisHash",
    "cutoffGeometryHash",
    "nonbondedNeighborHash",
    "readoutHash",
    "chargeDipoleHash",
    "mpnnPipelineHash",
    "energyForceHeadHash"
  ], "G12");
  if (after.phase !== "readout" || after.messageRule !== "hybrid" || after.nonbondedEdgeCount <= initial.nonbondedEdgeCount || after.energyProxy <= initial.energyProxy) {
    throw new Error(`G12 controls did not drive molecular MPNN geometry/readout: ${JSON.stringify(after)}`);
  }
  if (!/MPNN|atom feature|typed bond|radial basis|cutoff|conformer|readout|energy|force/i.test(after.stateText)) {
    throw new Error(`G12 explanation lost canonical molecular terms: ${after.stateText}`);
  }

  await setRange(page, "#conformerBend", "0.92");
  await page.click("#bendConformer");
  await page.waitForTimeout(120);
  const bent = await page.evaluate(() => window.__g12LabSnapshot());
  if (bent.conformerHash === after.conformerHash || bent.dipoleProxy <= 0 || !/conformer|3D|distance|dipole/i.test(bent.stateText)) {
    throw new Error(`G12 conformer bend must visibly alter 3D molecular geometry: ${JSON.stringify(bent)}`);
  }
}

async function testG13(page) {
  const result = await loadLab(page, "g13-knowledge-graph-relations-lab.html", "__g13LabReady", "__g13LabSnapshot");
  requireFit(result, "G13 desktop");
  await requireOrbit(page, "__g13LabSnapshot");
  const initial = result.snapshot;
  if (result.bytes < 13000 || initial.clarityVersion !== CLARITY_VERSION || initial.labId !== "g13" || initial.has3d !== true) {
    throw new Error(`G13 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    typedTripleObjectCount: 10,
    entityTypeObjectCount: 8,
    relationChannelObjectCount: 8,
    relationMatrixObjectCount: 4,
    basisDecompositionObjectCount: 4,
    decoderGeometryObjectCount: 4,
    pathRuleObjectCount: 4,
    negativeCandidateObjectCount: 3,
    schemaConstraintObjectCount: 4,
    inverseSelfLoopObjectCount: 3,
    rankingBoardObjectCount: 5,
    compgcnCompositionObjectCount: 3
  }, "G13");
  requireFields(initial, [
    "typedTripleHash",
    "entityTypeHash",
    "relationChannelHash",
    "relationMatrixHash",
    "basisDecompositionHash",
    "decoderGeometryHash",
    "pathRuleHash",
    "negativeCandidateHash",
    "schemaConstraintHash",
    "inverseSelfLoopHash",
    "rankingBoardHash",
    "compgcnCompositionHash",
    "candidateTriple",
    "supportPathRelations",
    "decoderFamilies"
  ], "G13");
  for (const decoder of ["TransE", "DistMult", "ComplEx", "RotatE"]) {
    if (!initial.decoderFamilies.includes(decoder)) throw new Error(`G13 missing decoder family ${decoder}: ${JSON.stringify(initial)}`);
  }

  await page.locator("#scenarioSelect").selectOption("biomed");
  await page.locator("#candidateRelation").selectOption("candidate_treats");
  await page.locator("#decoderSelect").selectOption("rotate");
  await setRange(page, "#reasoningHops", "4");
  await setRange(page, "#relationGain", "1.9");
  await setRange(page, "#basisCount", "7");
  await page.click("#routeMessages");
  await page.click("#composePath");
  await page.click("#scoreTriplet");
  await page.waitForTimeout(160);
  const scored = await page.evaluate(() => window.__g13LabSnapshot());
  requireChanged(initial, scored, [
    "typedTripleHash",
    "relationChannelHash",
    "relationMatrixHash",
    "basisDecompositionHash",
    "decoderGeometryHash",
    "pathRuleHash",
    "rankingBoardHash",
    "compgcnCompositionHash"
  ], "G13");
  if (scored.phase !== "score" || scored.decoder !== "rotate" || scored.tripleScore <= initial.tripleScore || scored.supportPathLength < 2) {
    throw new Error(`G13 controls did not drive KG path scoring: ${JSON.stringify(scored)}`);
  }
  if (!/R-GCN|CompGCN|typed triple|relation channel|basis|decoder|path|RotatE/i.test(scored.stateText)) {
    throw new Error(`G13 explanation lost canonical KG terms: ${scored.stateText}`);
  }

  await setRange(page, "#negativeHardness", "0.92");
  await page.click("#corruptNegative");
  await page.waitForTimeout(120);
  const negative = await page.evaluate(() => window.__g13LabSnapshot());
  if (negative.negativeCandidateHash === scored.negativeCandidateHash || negative.falseNegativeRisk <= 0 || !/hard negative|type|schema|missing fact/i.test(negative.stateText)) {
    throw new Error(`G13 hard negative view must expose type constraints and missing-fact risk: ${JSON.stringify(negative)}`);
  }
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 980, height: 720 } });
  try {
    await testG12(page);
    await page.setViewportSize({ width: 900, height: 700 });
    await testG13(page);
  } finally {
    await browser.close();
  }
  console.log("g12-g13 canonical clarity passed: molecule and knowledge-graph labs expose canonical objects, hashes, controls, orbit, and fit.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
