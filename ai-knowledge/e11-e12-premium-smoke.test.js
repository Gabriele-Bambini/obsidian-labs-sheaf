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
  await page.locator(".lab-viewport canvas#canvas").waitFor({ state: "visible" });
  await page.waitForFunction(
    ([ready, snapshot]) => window[ready] === true && typeof window[snapshot] === "function" && window[snapshot](),
    [readyName, snapshotName]
  );
  await page.waitForTimeout(240);
  return page.evaluate((snapshot) => {
    const canvas = document.querySelector(".lab-viewport canvas");
    const stateNode = document.querySelector("#state") || document.querySelector("#stateBox") || document.querySelector(".state-box");
    return {
      bytes: canvas.toDataURL("image/png").length,
      snapshot: window[snapshot](),
      stateText: stateNode.textContent.trim(),
      overflowX: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
      overflowY: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight
    };
  }, snapshotName);
}

function requireRoles(snapshot, roles, lab) {
  for (const role of roles) {
    if (!snapshot.visualRoles || !snapshot.visualRoles.some((candidate) => candidate.includes(role))) {
      throw new Error(`${lab} missing visual role: ${role}`);
    }
  }
}

function requireFitted(result, lab) {
  if (result.overflowX > 18 || result.overflowY > 18) {
    throw new Error(`${lab} iframe fit regressed: overflowX=${result.overflowX}, overflowY=${result.overflowY}`);
  }
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
  try {
    let e11 = await loadLab(page, "e11-gridworld-bellman-lab.html", "__e11LabReady", "__e11LabSnapshot");
    requireFitted(e11, "E11");
    if (e11.bytes < 10000 || e11.snapshot.visualQuality !== "e11-e12-rl-specific-v1" || e11.snapshot.visualRoleCount < 10) {
      throw new Error(`E11 premium visual contract is weak: ${JSON.stringify(e11)}.`);
    }
    requireRoles(e11.snapshot, [
      "gridworld value-height landscape",
      "terminal reward and trap beacons",
      "Bellman backup wavefront",
      "greedy policy arrow field",
      "discount horizon attenuation rings",
      "step-cost path penalty tiles",
      "stochastic transition slip fan",
      "wall blocked-propagation barrier",
      "Bellman residual convergence bars",
      "state action Q-value candidate spokes"
    ], "E11");
    if (!/Bellman|value|policy|discount|residual|gridworld/i.test(e11.stateText)) {
      throw new Error(`E11 state text is weak: ${e11.stateText}`);
    }
    await page.locator("#worldPreset").selectOption("cliff");
    await page.locator("#backupMode").selectOption("optimal");
    await setRange(page, "#discount", "0.82");
    await setRange(page, "#stepCost", "-0.06");
    await setRange(page, "#slip", "0.22");
    await setRange(page, "#iterationsPerSweep", "4");
    await page.click("#backup");
    e11 = await page.evaluate(() => ({
      snapshot: window.__e11LabSnapshot(),
      text: (document.querySelector("#state") || document.querySelector("#stateBox")).textContent.trim(),
      iterationText: document.querySelector("#iterationLabel").textContent.trim(),
      deltaText: document.querySelector("#deltaLabel").textContent.trim()
    }));
    if (e11.snapshot.worldPreset !== "cliff" || e11.snapshot.backupMode !== "optimal" || e11.snapshot.iteration < 1 || Math.abs(e11.snapshot.discount - 0.82) > 0.01) {
      throw new Error(`E11 controls did not update Bellman parameters: ${JSON.stringify(e11)}.`);
    }
    if (e11.snapshot.maxDelta <= 0 || e11.snapshot.greedyPolicySwitches < 0 || e11.snapshot.valueSpread <= 0 || !e11.iterationText.includes("1") || !e11.deltaText.includes(".") || !/backup|Bellman|policy|residual/i.test(e11.text)) {
      throw new Error(`E11 controls did not reshape Bellman backup dynamics: ${JSON.stringify(e11)}.`);
    }

    let e12 = await loadLab(page, "e12-dqn-target-update-lab.html", "__e12LabReady", "__e12LabSnapshot");
    requireFitted(e12, "E12");
    if (e12.bytes < 10000 || e12.snapshot.visualQuality !== "e11-e12-rl-specific-v1" || e12.snapshot.visualRoleCount < 10) {
      throw new Error(`E12 premium visual contract is weak: ${JSON.stringify(e12)}.`);
    }
    requireRoles(e12.snapshot, [
      "online Q-network value tower",
      "delayed target network shadow tower",
      "experience replay buffer conveyor",
      "sampled transition Bellman target card",
      "temporal-difference error gap bridge",
      "terminal transition bootstrap gate",
      "target sync hard-copy bridge",
      "Double DQN action selector evaluator split",
      "prioritized replay surprise bars",
      "deadly triad instability meter"
    ], "E12");
    if (!/DQN|target|replay|TD|Bellman|network/i.test(e12.stateText)) {
      throw new Error(`E12 state text is weak: ${e12.stateText}`);
    }
    await page.locator("#targetMode").selectOption("double");
    await page.locator("#replayMode").selectOption("prioritized");
    await setRange(page, "#learningRate", "0.32");
    await setRange(page, "#discount", "0.88");
    await setRange(page, "#targetLag", "0.70");
    await setRange(page, "#batchSize", "6");
    await setRange(page, "#terminalMix", "0.35");
    await page.click("#trainDqn");
    e12 = await page.evaluate(() => ({
      snapshot: window.__e12LabSnapshot(),
      text: (document.querySelector("#state") || document.querySelector("#stateBox")).textContent.trim(),
      tdText: document.querySelector("#tdLabel").textContent.trim(),
      targetText: document.querySelector("#targetGapLabel").textContent.trim()
    }));
    if (e12.snapshot.targetMode !== "double" || e12.snapshot.replayMode !== "prioritized" || e12.snapshot.trainStep < 1 || Math.abs(e12.snapshot.learningRate - 0.32) > 0.01) {
      throw new Error(`E12 controls did not update DQN parameters: ${JSON.stringify(e12)}.`);
    }
    if (Math.abs(e12.snapshot.tdError) <= 0 || e12.snapshot.targetGap < 0 || e12.snapshot.replayPriority <= 0 || !e12.tdText.includes(".") || !e12.targetText.includes(".") || !/target|TD|replay|Double DQN|Bellman/i.test(e12.text)) {
      throw new Error(`E12 controls did not reshape DQN target dynamics: ${JSON.stringify(e12)}.`);
    }
  } finally {
    await browser.close();
  }
  console.log("e11-e12 premium smoke passed: Bellman gridworld and DQN target labs expose specific visual roles, controls, diagnostics, and iframe fit.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
