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
      // Try the next known runtime location.
    }
  }

  throw new Error(`Unable to load Playwright from: ${candidates.join(", ")}`);
}

const { chromium } = loadPlaywright();

async function setRange(page, selector, value) {
  await page.locator(selector).evaluate((input, nextValue) => {
    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function loadLab(page, fileName, readyName, snapshotName) {
  const labPath = path.join(__dirname, fileName).replace(/\\/g, "/");
  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
  await page.waitForFunction(
    ([ready, snapshot]) => window[ready] === true && typeof window[snapshot] === "function" && window[snapshot](),
    [readyName, snapshotName]
  );
  await page.waitForTimeout(260);
  return page.evaluate((snapshot) => {
    const canvas = document.querySelector(".lab-viewport canvas");
    return {
      bytes: canvas.toDataURL("image/png").length,
      snapshot: window[snapshot](),
      overflowX: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
      overflowY: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight
    };
  }, snapshotName);
}

function requireFitted(result, lab) {
  if (result.overflowX > 18 || result.overflowY > 18) {
    throw new Error(`${lab} iframe fit regressed: overflowX=${result.overflowX}, overflowY=${result.overflowY}`);
  }
}

function requireFields(snapshot, fields, lab) {
  for (const field of fields) {
    if (!(field in snapshot)) throw new Error(`${lab} missing snapshot field ${field}`);
    if (snapshot[field] == null || snapshot[field] === "") throw new Error(`${lab} empty snapshot field ${field}`);
  }
}

function requireArrayIncludes(snapshot, field, fragments, lab) {
  if (!Array.isArray(snapshot[field])) {
    throw new Error(`${lab} expected ${field} to be an array`);
  }
  for (const fragment of fragments) {
    if (!snapshot[field].some((item) => String(item).toLowerCase().includes(fragment.toLowerCase()))) {
      throw new Error(`${lab} ${field} missing canonical fragment: ${fragment}`);
    }
  }
}

function requireMin(snapshot, field, min, lab) {
  if (!(snapshot[field] >= min)) {
    throw new Error(`${lab} expected ${field} >= ${min}, got ${snapshot[field]}`);
  }
}

function requireNumber(snapshot, field, lab) {
  if (typeof snapshot[field] !== "number" || !Number.isFinite(snapshot[field])) {
    throw new Error(`${lab} expected finite numeric ${field}, got ${snapshot[field]}`);
  }
}

function requireChanged(before, after, fields, lab) {
  const changed = fields.filter((field) => before[field] !== after[field]);
  if (changed.length < Math.min(4, fields.length)) {
    throw new Error(`${lab} controls did not visibly alter enough canonical hashes: ${changed.join(", ") || "none"}`);
  }
}

async function requireOrbitZoom(page, snapshotName, lab) {
  const before = await page.evaluate((snapshot) => window[snapshot](), snapshotName);
  const box = await page.locator(".lab-viewport canvas").boundingBox();
  if (!box) throw new Error(`${lab} canvas bounding box missing`);
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 105, cy + 45, { steps: 8 });
  await page.mouse.up();
  await page.mouse.wheel(0, -240);
  await page.waitForTimeout(120);
  const after = await page.evaluate((snapshot) => window[snapshot](), snapshotName);
  const rotated = Math.abs(after.cameraTheta - before.cameraTheta) > 0.1 || Math.abs(after.cameraPhi - before.cameraPhi) > 0.05;
  const zoomed = Math.abs(after.cameraRadius - before.cameraRadius) > 0.1;
  if (!rotated || !zoomed) {
    throw new Error(`${lab} manual orbit/zoom did not affect camera.`);
  }
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });

  try {
    let e16 = await loadLab(page, "e16-energy-langevin-lab.html", "__e16LabReady", "__e16LabSnapshot");
    requireFitted(e16, "E16");
    if (e16.bytes < 10000 || e16.snapshot.clarityVersion !== "e16-e17-canonical-clarity-v2" || e16.snapshot.legacyClarityVersion !== "e16-e17-canonical-clarity-v1" || e16.snapshot.has3d !== true) {
      throw new Error(`E16 canonical clarity contract is missing: ${JSON.stringify(e16.snapshot)}`);
    }
    await requireOrbitZoom(page, "__e16LabSnapshot", "E16");
    requireArrayIncludes(e16.snapshot, "energyBasedObjects", [
      "energy landscape",
      "score field",
      "Langevin",
      "partition",
      "positive phase",
      "negative phase",
      "replay buffer"
    ], "E16");
    requireArrayIncludes(e16.snapshot, "canonicalReferences", [
      "Energy-Based Models",
      "Langevin dynamics",
      "Boltzmann",
      "contrastive divergence"
    ], "E16");
    requireArrayIncludes(e16.snapshot, "diagnosticMetrics", [
      "data energy",
      "negative energy",
      "mixing",
      "partition"
    ], "E16");
    [
      ["energySurfaceCount", 1],
      ["scoreArrowCount", 30],
      ["scoreArrowHeadCount", 30],
      ["langevinChainCount", 10],
      ["chainStepMarkerCount", 8],
      ["dataClampCount", 5],
      ["negativeRaiserCount", 10],
      ["partitionRingCount", 4],
      ["probabilityMassTileCount", 12],
      ["replayParticleCount", 10],
      ["positiveNegativePhaseCount", 2],
      ["histogramBarCount", 10],
      ["barrierBridgeCount", 1],
      ["oodTrapCount", 1],
      ["energyObjectCount", 1],
      ["samplingObjectCount", 18],
      ["trainingPhaseObjectCount", 2],
      ["partitionDiagnosticObjectCount", 4],
      ["replayDiagnosticObjectCount", 10]
    ].forEach(([field, min]) => requireMin(e16.snapshot, field, min, "E16"));
    [
      "dataEnergy",
      "negativeEnergy",
      "mixingScore",
      "partitionProxy",
      "phaseGap",
      "trapRisk",
      "scoreFieldStrength",
      "langevinNoiseScale",
      "energySeparation",
      "replayCoverage",
      "partitionMassProxy",
      "negativeSamplePressure"
    ].forEach((field) => requireNumber(e16.snapshot, field, "E16"));
    requireFields(e16.snapshot, [
      "energyLandscapeHash",
      "scoreFieldHash",
      "langevinChainHash",
      "langevinUpdateHash",
      "probabilityMassHash",
      "positivePhaseHash",
      "negativePhaseHash",
      "partitionFunctionHash",
      "replayBufferHash",
      "cdBiasHash",
      "mixingBridgeHash",
      "histogramHash",
      "oodTrapHash",
      "samplerModeHash",
      "energyProbabilityHash",
      "scoreDirectionHash",
      "trainingPhaseHash",
      "partitionDiagnosticHash",
      "commandEffectHash"
    ], "E16");
    const e16Before = e16.snapshot;
    await page.locator("#energyLandscape").selectOption("ring");
    await page.locator("#samplerMode").selectOption("replay");
    await setRange(page, "#temperature", "0.88");
    await setRange(page, "#stepSize", "0.42");
    await setRange(page, "#samplerSteps", "9");
    await setRange(page, "#replayMix", "0.74");
    await setRange(page, "#energyScale", "1.42");
    await setRange(page, "#negativePressure", "0.67");
    await page.click("#langevinStep");
    await page.click("#trainPhase");
    await page.click("#toggleReplay");
    e16 = await page.evaluate(() => ({ snapshot: window.__e16LabSnapshot() }));
    requireChanged(e16Before, e16.snapshot, [
      "energyLandscapeHash",
      "scoreFieldHash",
      "langevinChainHash",
      "langevinUpdateHash",
      "probabilityMassHash",
      "positivePhaseHash",
      "negativePhaseHash",
      "partitionFunctionHash",
      "replayBufferHash",
      "cdBiasHash",
      "mixingBridgeHash",
      "histogramHash",
      "oodTrapHash",
      "samplerModeHash"
    ], "E16");
    if (e16.snapshot.energyLandscape !== "ring" || e16.snapshot.samplerMode !== "replay" || e16.snapshot.sampleStep < 1 || e16.snapshot.trainStep < 1 || e16.snapshot.replayStep < 1) {
      throw new Error(`E16 controls did not advance EBM phenomena: ${JSON.stringify(e16.snapshot)}`);
    }

    let e17 = await loadLab(page, "e17-ssm-scan.html", "__e17LabReady", "__e17LabSnapshot");
    requireFitted(e17, "E17");
    if (e17.bytes < 10000 || e17.snapshot.clarityVersion !== "e16-e17-canonical-clarity-v2" || e17.snapshot.legacyClarityVersion !== "e16-e17-canonical-clarity-v1" || e17.snapshot.has3d !== true) {
      throw new Error(`E17 canonical clarity contract is missing: ${JSON.stringify(e17.snapshot)}`);
    }
    await requireOrbitZoom(page, "__e17LabSnapshot", "E17");
    requireArrayIncludes(e17.snapshot, "stateSpaceObjects", [
      "A matrix",
      "B_t",
      "C_t",
      "Delta",
      "HiPPO",
      "selective scan",
      "Mamba"
    ], "E17");
    requireArrayIncludes(e17.snapshot, "canonicalReferences", [
      "S4",
      "Mamba",
      "state space",
      "HiPPO"
    ], "E17");
    requireArrayIncludes(e17.snapshot, "diagnosticMetrics", [
      "memory retention",
      "scan error",
      "kernel reach",
      "stream cost"
    ], "E17");
    [
      ["tokenCount", 16],
      ["stateLaneCount", 16],
      ["writeVectorCount", 16],
      ["readoutTapCount", 16],
      ["deltaGateCount", 16],
      ["kernelBarCount", 8],
      ["hippoBasisCount", 5],
      ["complexEigenRingCount", 5],
      ["scanCompositionLineCount", 12],
      ["matrixCellCount", 20],
      ["discretizationObjectCount", 4],
      ["attentionComparisonCount", 2],
      ["resetWarningCount", 1],
      ["stateSpaceObjectCount", 16],
      ["scanDiagnosticObjectCount", 12],
      ["mambaGateObjectCount", 8],
      ["kernelDiagnosticObjectCount", 8],
      ["memoryDiagnosticObjectCount", 5]
    ].forEach(([field, min]) => requireMin(e17.snapshot, field, min, "E17"));
    [
      "memoryRetention",
      "scanEquivalenceError",
      "kernelReach",
      "streamingCost",
      "attentionCost",
      "gateActivity",
      "stateCompressionRatio",
      "quadraticAttentionRatio",
      "deltaRetentionScore",
      "selectiveWriteStrength"
    ].forEach((field) => requireNumber(e17.snapshot, field, "E17"));
    requireFields(e17.snapshot, [
      "transitionMatrixHash",
      "inputWriteHash",
      "stateRecurrenceHash",
      "readoutHash",
      "kernelImpulseHash",
      "hippoBasisHash",
      "complexEigenHash",
      "deltaGateHash",
      "scanTreeHash",
      "mambaGateHash",
      "equivalenceBridgeHash",
      "attentionCostHash",
      "compactStateHash",
      "resetLeakageHash",
      "ssmArchitectureHash",
      "discretizationHash",
      "selectiveScanHash",
      "memoryKernelHash",
      "commandEffectHash"
    ], "E17");
    const e17Before = e17.snapshot;
    await page.locator("#sequencePreset").selectOption("reset");
    await page.locator("#executionView").selectOption("scan");
    await setRange(page, "#retention", "0.88");
    await setRange(page, "#inputGate", "0.78");
    await setRange(page, "#deltaScale", "0.72");
    await setRange(page, "#stateSize", "8");
    await setRange(page, "#selectivity", "0.86");
    await setRange(page, "#kernelLength", "13");
    await page.click("#scanStep");
    await page.click("#composeBlocks");
    await page.click("#compareAttention");
    e17 = await page.evaluate(() => ({ snapshot: window.__e17LabSnapshot() }));
    requireChanged(e17Before, e17.snapshot, [
      "transitionMatrixHash",
      "inputWriteHash",
      "stateRecurrenceHash",
      "readoutHash",
      "kernelImpulseHash",
      "hippoBasisHash",
      "complexEigenHash",
      "deltaGateHash",
      "scanTreeHash",
      "mambaGateHash",
      "equivalenceBridgeHash",
      "attentionCostHash",
      "compactStateHash",
      "resetLeakageHash"
    ], "E17");
    if (e17.snapshot.sequencePreset !== "reset" || e17.snapshot.executionView !== "scan" || e17.snapshot.scanStep < 1 || e17.snapshot.composeStep < 1 || e17.snapshot.compareStep < 1) {
      throw new Error(`E17 controls did not advance SSM phenomena: ${JSON.stringify(e17.snapshot)}`);
    }
  } finally {
    await browser.close();
  }

  console.log("e16-e17 canonical clarity passed: EBM and SSM labs expose canonical objects, control consequences, orbit/zoom, and fitted iframes.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
