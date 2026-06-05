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
    throw new Error(`${lab} controls did not visibly alter enough canonical geometry hashes: ${changed.join(", ") || "none"}`);
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
    let e14 = await loadLab(page, "e14-contrastive-representation-lab.html", "__e14LabReady", "__e14LabSnapshot");
    requireFitted(e14, "E14");
    if (e14.bytes < 10000 || e14.snapshot.clarityVersion !== "e14-e15-canonical-clarity-v2" || e14.snapshot.legacyClarityVersion !== "e14-e15-canonical-clarity-v1" || e14.snapshot.has3d !== true) {
      throw new Error(`E14 canonical clarity contract is missing: ${JSON.stringify(e14.snapshot)}`);
    }
    await requireOrbitZoom(page, "__e14LabSnapshot", "E14");
    requireArrayIncludes(e14.snapshot, "selfSupervisedObjects", [
      "augmented positive pairs",
      "encoder projection head",
      "InfoNCE",
      "negative memory bank",
      "masked autoencoder",
      "collapse",
      "linear probe"
    ], "E14");
    requireArrayIncludes(e14.snapshot, "canonicalReferences", [
      "SimCLR",
      "InfoNCE",
      "MAE",
      "BYOL"
    ], "E14");
    requireArrayIncludes(e14.snapshot, "diagnosticMetrics", [
      "alignment",
      "uniformity",
      "collapse",
      "linear probe"
    ], "E14");
    [
      ["positivePairCount", 3],
      ["negativeSampleCount", 10],
      ["infoNceLogitCount", 4],
      ["temperatureBowlCount", 1],
      ["augmentationViewCount", 6],
      ["projectionHeadObjectCount", 3],
      ["maskPatchCount", 12],
      ["linearProbeAxisCount", 1],
      ["collapseWarningObjectCount", 1],
      ["falseNegativeBeaconCount", 1],
      ["embeddingObjectCount", 16],
      ["semanticClusterCount", 3],
      ["augmentationObjectCount", 6],
      ["contrastivePairObjectCount", 3],
      ["embeddingGeometryObjectCount", 16],
      ["objectiveDiagnosticObjectCount", 5],
      ["transferProbeObjectCount", 1]
    ].forEach(([field, min]) => requireMin(e14.snapshot, field, min, "E14"));
    [
      "infoNceLoss",
      "alignment",
      "uniformity",
      "collapseRisk",
      "temperature",
      "hardNegativePressure",
      "augmentationStrength",
      "negativeCount",
      "maskRatio",
      "linearProbeScore",
      "falseNegativeRisk",
      "representationSpread",
      "invarianceStrength"
    ].forEach((field) => requireNumber(e14.snapshot, field, "E14"));
    requireFields(e14.snapshot, [
      "positivePairHash",
      "negativeRepulsionHash",
      "infoNceSoftmaxHash",
      "temperatureBowlHash",
      "augmentationTunnelHash",
      "projectionHeadHash",
      "maskedPatchHash",
      "linearProbeHash",
      "collapseSinkHash",
      "falseNegativeHash",
      "embeddingUniformityHash",
      "pretextTaskHash",
      "sslArchitectureHash",
      "infoNceObjectiveHash",
      "augmentationInvariantHash",
      "collapseDiagnosticHash",
      "maskedReconstructionHash",
      "commandEffectHash"
    ], "E14");
    const e14Before = e14.snapshot;
    await page.locator("#pretextTask").selectOption("masked");
    await page.locator("#augmentation").selectOption("graph");
    await setRange(page, "#temperature", "0.34");
    await setRange(page, "#hardNegative", "0.86");
    await setRange(page, "#augmentationStrength", "0.68");
    await setRange(page, "#negativeCount", "13");
    await setRange(page, "#collapsePressure", "0.62");
    await setRange(page, "#maskRatio", "0.72");
    await page.click("#contrastiveStep");
    await page.click("#maskPretext");
    await page.click("#collapseDemo");
    e14 = await page.evaluate(() => ({ snapshot: window.__e14LabSnapshot() }));
    requireChanged(e14Before, e14.snapshot, [
      "positivePairHash",
      "negativeRepulsionHash",
      "infoNceSoftmaxHash",
      "temperatureBowlHash",
      "augmentationTunnelHash",
      "projectionHeadHash",
      "maskedPatchHash",
      "linearProbeHash",
      "collapseSinkHash",
      "falseNegativeHash",
      "embeddingUniformityHash",
      "pretextTaskHash"
    ], "E14");
    if (e14.snapshot.pretextTask !== "masked" || e14.snapshot.augmentation !== "graph" || e14.snapshot.step < 2 || e14.snapshot.maskPulse < 1 || e14.snapshot.collapsePulse < 1) {
      throw new Error(`E14 controls did not advance SSL phenomena: ${JSON.stringify(e14.snapshot)}`);
    }

    let e15 = await loadLab(page, "e15-neural-ode-flow.html", "__e15LabReady", "__e15LabSnapshot");
    requireFitted(e15, "E15");
    if (e15.bytes < 10000 || e15.snapshot.clarityVersion !== "e14-e15-canonical-clarity-v2" || e15.snapshot.legacyClarityVersion !== "e14-e15-canonical-clarity-v1" || e15.snapshot.has3d !== true) {
      throw new Error(`E15 canonical clarity contract is missing: ${JSON.stringify(e15.snapshot)}`);
    }
    await requireOrbitZoom(page, "__e15LabSnapshot", "E15");
    requireArrayIncludes(e15.snapshot, "neuralOdeObjects", [
      "learned vector field",
      "continuous trajectory",
      "Euler",
      "adaptive solver",
      "adjoint",
      "ResNet",
      "stiffness"
    ], "E15");
    requireArrayIncludes(e15.snapshot, "canonicalReferences", [
      "Neural ODE",
      "adjoint sensitivity",
      "Euler",
      "Runge-Kutta"
    ], "E15");
    requireArrayIncludes(e15.snapshot, "diagnosticMetrics", [
      "NFE",
      "solver error",
      "adjoint",
      "stiffness"
    ], "E15");
    [
      ["vectorFieldArrowCount", 28],
      ["trajectoryPointCount", 16],
      ["eulerStepCount", 6],
      ["midpointMarkerCount", 6],
      ["adaptiveGateCount", 6],
      ["targetBasinCount", 1],
      ["adjointPathCount", 1],
      ["memoryTapeCount", 6],
      ["stiffnessWarningCount", 1],
      ["augmentationOverpassCount", 1],
      ["cnfLogDensityCount", 1],
      ["resnetLayerCount", 5],
      ["vectorFieldObjectCount", 28],
      ["trajectoryObjectCount", 16],
      ["solverDiagnosticObjectCount", 18],
      ["adjointObjectCount", 7],
      ["continuousDepthObjectCount", 5]
    ].forEach(([field, min]) => requireMin(e15.snapshot, field, min, "E15"));
    [
      "solverError",
      "functionEvaluations",
      "stepSize",
      "stiffnessScore",
      "adjointError",
      "trajectoryLoss",
      "timeHorizon",
      "fieldStrength",
      "continuousDepthScore",
      "phaseDivergence"
    ].forEach((field) => requireNumber(e15.snapshot, field, "E15"));
    requireFields(e15.snapshot, [
      "vectorFieldHash",
      "trajectoryHash",
      "eulerLadderHash",
      "midpointHash",
      "adaptiveGateHash",
      "targetBasinHash",
      "adjointPathHash",
      "memoryTapeHash",
      "stiffnessHash",
      "augmentationOverpassHash",
      "cnfLogDensityHash",
      "resnetScaffoldHash",
      "trajectoryFlowHash",
      "solverStepHash",
      "adjointBackpropHash",
      "continuousDepthHash",
      "stiffnessDiagnosticHash",
      "phasePortraitHash",
      "commandEffectHash"
    ], "E15");
    const e15Before = e15.snapshot;
    await page.locator("#solverMode").selectOption("adaptive");
    await page.locator("#fieldType").selectOption("stiff");
    await setRange(page, "#finalTime", "2.55");
    await setRange(page, "#stepCount", "10");
    await setRange(page, "#tolerance", "0.28");
    await setRange(page, "#stiffness", "0.82");
    await setRange(page, "#augmentationDim", "0.64");
    await setRange(page, "#adjointTradeoff", "0.73");
    await page.click("#solveForward");
    await page.click("#traceAdjoint");
    await page.click("#compareResnet");
    e15 = await page.evaluate(() => ({ snapshot: window.__e15LabSnapshot() }));
    requireChanged(e15Before, e15.snapshot, [
      "vectorFieldHash",
      "trajectoryHash",
      "eulerLadderHash",
      "midpointHash",
      "adaptiveGateHash",
      "targetBasinHash",
      "adjointPathHash",
      "memoryTapeHash",
      "stiffnessHash",
      "augmentationOverpassHash",
      "cnfLogDensityHash",
      "resnetScaffoldHash"
    ], "E15");
    if (e15.snapshot.solverMode !== "adaptive" || e15.snapshot.fieldType !== "stiff" || e15.snapshot.solveStep < 1 || e15.snapshot.adjointStep < 1 || e15.snapshot.resnetStep < 1) {
      throw new Error(`E15 controls did not advance Neural ODE phenomena: ${JSON.stringify(e15.snapshot)}`);
    }
  } finally {
    await browser.close();
  }

  console.log("e14-e15 canonical clarity passed: SSL and Neural ODE labs expose canonical objects, control consequences, orbit/zoom, and fitted iframes.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
