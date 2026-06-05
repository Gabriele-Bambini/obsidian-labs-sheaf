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
const CLARITY_VERSION = "g02-g03-canonical-clarity-v1";

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

async function testG02(page) {
  let result = await loadLab(page, "g02-gcn-message-passing.html", "__g02LabReady", "__g02LabSnapshot");
  requireFit(result, "G02 desktop");
  await requireOrbit(page, "__g02LabSnapshot");
  const initial = result.snapshot;
  if (result.bytes < 12000 || initial.clarityVersion !== CLARITY_VERSION || initial.labId !== "g02" || initial.has3d !== true) {
    throw new Error(`G02 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    graphNodeObjectCount: 10,
    graphEdgeObjectCount: 10,
    selfLoopObjectCount: 10,
    normalizedMatrixCellCount: 80,
    degreeFactorObjectCount: 10,
    propagationPipelineObjectCount: 4,
    spectralFilterObjectCount: 8,
    fourierObjectCount: 6,
    messageArrowObjectCount: 8,
    overSmoothObjectCount: 1,
    degreeBiasObjectCount: 1
  }, "G02");
  requireFields(initial, [
    "renormalizationBoardHash",
    "degreeFactorHash",
    "normalizedMatrixHash",
    "messageFlowHash",
    "signalBeforeAfterHash",
    "smoothingEnergyHash",
    "spectralFilterHash",
    "fourierBasisHash",
    "overSmoothingHash",
    "hubBiasHash",
    "propagationPipelineHash",
    "selfLoopHash"
  ], "G02");

  await page.locator("#normalization").selectOption("raw");
  await page.locator("#graphType").selectOption("community");
  await page.locator("#viewSelect").selectOption("matrix");
  await setRange(page, "#layers", "6");
  await setRange(page, "#selfLoop", "1.18");
  await setRange(page, "#filterStrength", "0.88");
  await setRange(page, "#inputRoughness", "1.05");
  await setRange(page, "#spectralCutoff", "5");
  await page.click("#showRenorm");
  await page.click("#applyLayer");
  await page.click("#oversmooth");
  await page.waitForTimeout(130);
  const after = await page.evaluate(() => window.__g02LabSnapshot());
  requireChanged(initial, after, [
    "renormalizationBoardHash",
    "degreeFactorHash",
    "normalizedMatrixHash",
    "messageFlowHash",
    "signalBeforeAfterHash",
    "smoothingEnergyHash",
    "spectralFilterHash",
    "fourierBasisHash",
    "overSmoothingHash",
    "hubBiasHash",
    "propagationPipelineHash",
    "selfLoopHash"
  ], "G02");
  if (after.phase !== "oversmooth" || after.layerCount < 8 || after.smoothingIndex <= 0 || after.nodeVariance > 0.12) {
    throw new Error(`G02 controls did not drive smoothing/oversmoothing: ${JSON.stringify(after)}`);
  }
  if (!/GCN|renormalization|degree|smoothing|over-smoothing|matrix/i.test(after.stateText)) {
    throw new Error(`G02 explanation lost canonical terms: ${after.stateText}`);
  }
}

async function testG03(page) {
  let result = await loadLab(page, "g03-graph-attention-coefficients-lab.html", "__g03LabReady", "__g03LabSnapshot");
  requireFit(result, "G03 desktop");
  await requireOrbit(page, "__g03LabSnapshot");
  const initial = result.snapshot;
  if (result.bytes < 13000 || initial.clarityVersion !== CLARITY_VERSION || initial.labId !== "g03" || initial.has3d !== true) {
    throw new Error(`G03 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    graphNodeObjectCount: 10,
    maskedEdgeObjectCount: 10,
    attentionArrowObjectCount: 3,
    coefficientBarObjectCount: 10,
    maskedMatrixCellCount: 80,
    rawLogitObjectCount: 3,
    softmaxSimplexObjectCount: 3,
    qkvProjectionObjectCount: 3,
    multiHeadObjectCount: 12,
    nonNeighborMaskObjectCount: 1,
    alphaSumObjectCount: 1,
    distractorObjectCount: 1
  }, "G03");
  requireFields(initial, [
    "maskedNeighborhoodHash",
    "rawLogitHash",
    "softmaxSimplexHash",
    "attentionCoefficientHash",
    "attentionArrowHash",
    "maskedMatrixHash",
    "multiHeadHash",
    "qkvProjectionHash",
    "distractorHash",
    "nonNeighborMaskHash",
    "alphaSumGaugeHash",
    "temperatureHash"
  ], "G03");

  await page.locator("#attentionHead").selectOption("bridge");
  await page.locator("#focusNode").selectOption("4");
  await page.locator("#viewSelect").selectOption("heads");
  await setRange(page, "#temperature", "0.42");
  await setRange(page, "#distractorStrength", "1.05");
  await setRange(page, "#edgeMask", "0.18");
  await setRange(page, "#headBlend", "0.86");
  await setRange(page, "#selfWeight", "0.95");
  await page.click("#computeAttention");
  await page.click("#injectDistractor");
  await page.click("#multiHead");
  await page.waitForTimeout(130);
  const after = await page.evaluate(() => window.__g03LabSnapshot());
  requireChanged(initial, after, [
    "maskedNeighborhoodHash",
    "rawLogitHash",
    "softmaxSimplexHash",
    "attentionCoefficientHash",
    "attentionArrowHash",
    "maskedMatrixHash",
    "multiHeadHash",
    "qkvProjectionHash",
    "distractorHash",
    "nonNeighborMaskHash",
    "alphaSumGaugeHash",
    "temperatureHash"
  ], "G03");
  if (after.phase !== "heads" || after.headCount !== 3 || after.distractorAlpha <= 0 || after.headDiversity <= 0 || Math.abs(after.alphaSum - 1) > 0.01) {
    throw new Error(`G03 controls did not drive GAT attention: ${JSON.stringify(after)}`);
  }
  if (!/GAT|masked|softmax|alpha|head|distractor|neighbor/i.test(after.stateText)) {
    throw new Error(`G03 explanation lost canonical terms: ${after.stateText}`);
  }
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 980, height: 720 } });
  try {
    await testG02(page);
    await page.setViewportSize({ width: 900, height: 700 });
    await testG03(page);
  } finally {
    await browser.close();
  }
  console.log("g02-g03 canonical clarity passed: GCN and GAT expose canonical objects, hashes, controls, orbit, and fit.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
