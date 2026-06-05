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
const CLARITY_VERSION = "i06-canonical-clarity-v1";

async function loadLab(page) {
  const labPath = path.join(__dirname, "i06-quantum-advantage-boundary-lab.html").replace(/\\/g, "/");
  await page.goto(`file:///${labPath}`);
  await page.locator(".lab-viewport canvas#canvas").waitFor({ state: "visible" });
  await page.waitForFunction(() => window.__i06LabReady === true && typeof window.__i06LabSnapshot === "function" && window.__i06LabSnapshot());
  await page.waitForTimeout(180);
  return page.evaluate(() => {
    const canvas = document.querySelector(".lab-viewport canvas#canvas");
    const command = document.querySelector(".command-bar");
    const stateNode = document.querySelector("#stateBox") || document.querySelector("#state") || document.querySelector(".state-box");
    return {
      bytes: canvas.toDataURL("image/png").length,
      snapshot: window.__i06LabSnapshot(),
      stateText: stateNode.textContent.trim(),
      overflowX: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
      overflowY: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight,
      commandOverflowX: command ? command.scrollWidth - command.clientWidth : 0,
      commandOverflowY: command ? command.scrollHeight - command.clientHeight : 0
    };
  });
}

async function setRange(page, selector, value) {
  await page.locator(selector).evaluate((input, nextValue) => {
    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

function requireFit(result) {
  if (result.overflowX > 18 || result.overflowY > 18 || result.commandOverflowX > 6 || result.commandOverflowY > 6) {
    throw new Error(`I06 is not fitted: ${JSON.stringify({
      overflowX: result.overflowX,
      overflowY: result.overflowY,
      commandOverflowX: result.commandOverflowX,
      commandOverflowY: result.commandOverflowY
    })}`);
  }
}

function requireFields(snapshot, fields) {
  for (const field of fields) {
    if (!(field in snapshot)) throw new Error(`I06 missing snapshot field ${field}`);
    if (snapshot[field] == null || snapshot[field] === "") throw new Error(`I06 field ${field} is empty`);
  }
}

function requireIncludes(snapshot, field, values) {
  if (!Array.isArray(snapshot[field])) throw new Error(`I06 ${field} is not an array: ${JSON.stringify(snapshot[field])}`);
  for (const value of values) {
    if (!snapshot[field].includes(value)) throw new Error(`I06 ${field} missing ${value}: ${JSON.stringify(snapshot[field])}`);
  }
}

function requireMinimums(snapshot, minimums) {
  for (const [field, min] of Object.entries(minimums)) {
    if (!(snapshot[field] >= min)) throw new Error(`I06 ${field} too weak: ${snapshot[field]} < ${min}`);
  }
}

function requireChanged(before, after, fields, label, minChanges = 2) {
  const changed = fields.filter((field) => before[field] !== after[field]);
  if (changed.length < minChanges) {
    throw new Error(`${label} controls changed too little. Changed ${changed.length}/${fields.length}: ${changed.join(", ")}`);
  }
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 700 } });
  try {
    const result = await loadLab(page);
    requireFit(result);
    const initial = result.snapshot;
    if (result.bytes < 12000 || initial.clarityVersion !== CLARITY_VERSION || initial.labId !== "i06" || initial.has3d !== true) {
      throw new Error(`I06 canonical clarity contract failed: ${JSON.stringify(initial)}`);
    }
    requireMinimums(initial, {
      scalingCurveObjectCount: 39,
      boundaryObjectCount: 2,
      complexityClassObjectCount: 3,
      complexityArrowObjectCount: 2,
      noiseWallObjectCount: 1,
      qecStackObjectCount: 6,
      loadingBottleneckObjectCount: 1,
      shotBottleneckObjectCount: 1,
      outputBandwidthObjectCount: 1
    });
    requireFields(initial, [
      "classicalCurveHash",
      "idealQuantumCurveHash",
      "endToEndQuantumCurveHash",
      "advantageBoundaryHash",
      "complexityClassHash",
      "noiseWallHash",
      "qecStackHash",
      "loadingBottleneckHash",
      "shotBottleneckHash",
      "outputBandwidthHash",
      "canonicalReferences",
      "advantageObjects",
      "diagnosticMetrics"
    ]);
    requireIncludes(initial, "advantageObjects", [
      "classical_scaling_curve",
      "ideal_quantum_speedup_curve",
      "end_to_end_quantum_runtime_curve",
      "useful_advantage_boundary",
      "bpp_bqp_np_complexity_map",
      "nisq_noise_wall",
      "error_correction_overhead_stack",
      "data_loading_bottleneck",
      "measurement_shot_bottleneck",
      "classical_baseline_moving_target",
      "output_bandwidth_limit"
    ]);
    requireIncludes(initial, "diagnosticMetrics", [
      "advantage_score",
      "classical_cost",
      "ideal_quantum_cost",
      "real_quantum_cost",
      "noise",
      "qec_overhead",
      "loading_cost",
      "shots",
      "baseline_strength"
    ]);

    await page.locator("#problem").selectOption("qml");
    await setRange(page, "#size", "96");
    await setRange(page, "#noise", "0.22");
    await setRange(page, "#qecOverhead", "120");
    await setRange(page, "#baseline", "3.2");
    await setRange(page, "#loadingCost", "0.84");
    await setRange(page, "#shots", "128");
    const configured = await page.evaluate(() => window.__i06LabSnapshot());
    if (configured.problem !== "qml" || configured.size !== 96 || !/Problem qml|Changed shots|real wall-clock curve/i.test(configured.stateText)) {
      throw new Error(`I06 controls are not concrete: ${JSON.stringify(configured)}`);
    }
    requireChanged(initial, configured, ["classicalCurveHash", "idealQuantumCurveHash", "endToEndQuantumCurveHash", "noiseWallHash", "loadingBottleneckHash", "shotBottleneckHash", "advantageBoundaryHash"], "I06 controls", 5);

    await page.locator("#addCorrection").click();
    await page.waitForFunction(() => window.__i06LabSnapshot().corrected === true);
    const corrected = await page.evaluate(() => window.__i06LabSnapshot());
    if (!/Error correction enabled|overhead stack grows/i.test(corrected.stateText) || corrected.corrected !== true) {
      throw new Error(`I06 QEC action is not explicit: ${JSON.stringify(corrected)}`);
    }
    requireChanged(configured, corrected, ["endToEndQuantumCurveHash", "qecStackHash", "advantageBoundaryHash", "noiseWallHash"], "I06 QEC", 3);

    await page.locator("#project").click();
    await page.waitForFunction((before) => window.__i06LabSnapshot().size > before, corrected.size);
    const projected = await page.evaluate(() => window.__i06LabSnapshot());
    if (!/Projected to larger problem size|boundary marker moves/i.test(projected.stateText)) {
      throw new Error(`I06 project action is not explicit: ${JSON.stringify(projected)}`);
    }
    requireChanged(corrected, projected, ["classicalCurveHash", "endToEndQuantumCurveHash", "advantageBoundaryHash"], "I06 projected size", 2);

    await page.locator("#switchProblem").click();
    await page.waitForFunction(() => window.__i06LabSnapshot().problem === "np");
    const np = await page.evaluate(() => window.__i06LabSnapshot());
    if (!/Switched problem family to np|BPP|BQP|NP/i.test(np.stateText)) {
      throw new Error(`I06 complexity-class switch is not explicit: ${JSON.stringify(np)}`);
    }
    requireChanged(projected, np, ["classicalCurveHash", "idealQuantumCurveHash", "complexityClassHash", "advantageBoundaryHash"], "I06 problem switch", 3);

    console.log("I06 canonical clarity checks passed");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
