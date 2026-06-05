const path = require("path");

function loadPlaywright() {
  const candidates = [
    "playwright",
    "C:/Users/02gab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright",
    "C:/Users/02gab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
    "C:/Users/Gabriele/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright",
    "C:/Users/Gabriele/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"
  ];
  let lastError = null;
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

const { chromium } = loadPlaywright();

async function noScrollbars(page, label) {
  const overflow = await page.evaluate(() => ({
    x: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
    y: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight,
    command: (() => {
      const bar = document.querySelector(".command-bar");
      if (!bar) return null;
      return { x: bar.scrollWidth - bar.clientWidth, y: bar.scrollHeight - bar.clientHeight };
    })()
  }));
  if (overflow.x > 2 || overflow.y > 2) throw new Error(`${label}: page overflow ${JSON.stringify(overflow)}`);
  if (overflow.command && (overflow.command.x > 3 || overflow.command.y > 3)) throw new Error(`${label}: command bar clips ${JSON.stringify(overflow.command)}`);
}

async function setRange(page, selector, value) {
  await page.$eval(selector, (input, nextValue) => {
    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  try {
    const file = path.join(__dirname, "g30-heterophilic-gnn-lab.html").replace(/\\/g, "/");
    await page.goto(`file:///${file}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__g30LabReady === true && window.__g30LabSnapshot());
    await page.waitForTimeout(180);

    let result = await page.evaluate(() => ({
      bytes: document.querySelector("#canvas").toDataURL("image/png").length,
      snapshot: window.__g30LabSnapshot(),
      stateText: document.querySelector("#state").textContent.trim(),
      rangeCount: document.querySelectorAll('input[type="range"]').length,
      actionCount: document.querySelectorAll("[data-action]").length
    }));
    if (result.bytes < 13000 || result.snapshot.has3d !== true || result.snapshot.nodeCount < 12 || result.snapshot.edgeCount < 12) {
      throw new Error(`G30 initial render is weak: ${JSON.stringify(result)}`);
    }
    if (result.rangeCount < 5 || result.actionCount < 5) throw new Error(`G30 controls are incomplete: ${JSON.stringify(result)}`);
    if (!/heterophily|compatibility|high-pass|neighbor/i.test(result.stateText)) throw new Error(`G30 state copy is off-topic: ${result.stateText}`);
    await noScrollbars(page, "desktop");

    const thetaBefore = result.snapshot.cameraTheta;
    await page.mouse.move(440, 305);
    await page.mouse.down();
    await page.mouse.move(585, 360);
    await page.mouse.up();
    await page.waitForTimeout(80);
    result = await page.evaluate(() => window.__g30LabSnapshot());
    if (Math.abs(result.cameraTheta - thetaBefore) < 0.05) throw new Error("G30 camera did not rotate manually.");

    await page.click("#applyCompatibility");
    await page.waitForFunction(() => window.__g30LabSnapshot().phase === "compat");
    let directCommand = await page.evaluate(() => ({ snapshot: window.__g30LabSnapshot(), ruleValue: document.querySelector("#messageRule").value, stateText: document.querySelector("#state").textContent.trim() }));
    if (directCommand.snapshot.messageRule !== "signed" || directCommand.ruleValue !== "signed" || !/signed|compatibility|flip/i.test(directCommand.stateText)) {
      throw new Error(`G30 Map command should switch to signed compatibility directly: ${JSON.stringify(directCommand)}`);
    }
    await page.click("#smoothOnce");
    await page.waitForFunction(() => window.__g30LabSnapshot().phase === "smooth");
    directCommand = await page.evaluate(() => ({ snapshot: window.__g30LabSnapshot(), ruleValue: document.querySelector("#messageRule").value, stateText: document.querySelector("#state").textContent.trim() }));
    if (directCommand.snapshot.messageRule !== "gcn" || directCommand.ruleValue !== "gcn" || !/raw GCN|low-pass|erase/i.test(directCommand.stateText)) {
      throw new Error(`G30 Mean command should switch to raw GCN directly: ${JSON.stringify(directCommand)}`);
    }

    await page.selectOption("#graphRegime", "bipartite");
    await page.selectOption("#messageRule", "gcn");
    await setRange(page, "#homophilyRatio", 0.05);
    await page.click("#smoothOnce");
    await page.waitForFunction(() => window.__g30LabSnapshot().phase === "smooth");
    const rawGcn = await page.evaluate(() => ({ snapshot: window.__g30LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (rawGcn.snapshot.rawGcnSignal > 0.45 || !/GCN|smoothing|opposite|erase/i.test(rawGcn.stateText)) {
      throw new Error(`G30 low-pass GCN should erase opposite-role signal on heterophily: ${JSON.stringify(rawGcn)}`);
    }

    await page.selectOption("#messageRule", "signed");
    await setRange(page, "#compatibilityStrength", 0.9);
    await page.click("#applyCompatibility");
    await page.waitForFunction(() => window.__g30LabSnapshot().phase === "compat");
    result = await page.evaluate(() => ({
      snapshot: window.__g30LabSnapshot(),
      stateText: document.querySelector("#state").textContent.trim(),
      compatText: document.querySelector("#compatLabel").textContent.trim()
    }));
    if (!(result.snapshot.signedSignal > rawGcn.snapshot.rawGcnSignal) || !(result.snapshot.compatScore > rawGcn.snapshot.gcnScore) || !/\d+\.\d+/.test(result.compatText) || !/signed|compatibility|flip|neighbor/i.test(result.stateText)) {
      throw new Error(`G30 compatibility map should flip useful opposite-class neighbors into evidence: ${JSON.stringify({ rawGcn, result })}`);
    }

    await page.selectOption("#messageRule", "twohop");
    await page.click("#showTwoHop");
    await page.waitForFunction(() => window.__g30LabSnapshot().phase === "twohop");
    const twoHop = await page.evaluate(() => ({ snapshot: window.__g30LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (twoHop.snapshot.twoHopSupport <= 0.25 || !/two-hop|same-role|bipartite/i.test(twoHop.stateText)) {
      throw new Error(`G30 two-hop mode should recover same-role support on bipartite heterophily: ${JSON.stringify(twoHop)}`);
    }

    await page.selectOption("#messageRule", "highpass");
    await setRange(page, "#highPassGain", 0.1);
    await page.click("#applyCompatibility");
    await page.waitForTimeout(100);
    const lowHighPass = await page.evaluate(() => window.__g30LabSnapshot());
    await setRange(page, "#highPassGain", 1.25);
    await page.click("#applyCompatibility");
    await page.waitForTimeout(120);
    result = await page.evaluate(() => ({ snapshot: window.__g30LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (!(result.snapshot.highFrequencyEnergy > lowHighPass.highFrequencyEnergy) || !(result.snapshot.classSeparation > lowHighPass.classSeparation) || !/high-pass|frequency|edge difference/i.test(result.stateText)) {
      throw new Error(`G30 high-pass gain should strengthen alternating edge differences: ${JSON.stringify({ lowHighPass, result })}`);
    }

    await setRange(page, "#relationNoise", 0.05);
    await page.click("#applyCompatibility");
    await page.waitForTimeout(100);
    const cleanSigns = await page.evaluate(() => window.__g30LabSnapshot());
    await setRange(page, "#relationNoise", 0.85);
    await page.click("#shuffleSigns");
    await page.waitForFunction(() => window.__g30LabSnapshot().phase === "shuffle");
    result = await page.evaluate(() => ({ snapshot: window.__g30LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (!(result.snapshot.compatibilityAccuracy < cleanSigns.compatibilityAccuracy) || !(result.snapshot.neighborHelp < cleanSigns.neighborHelp) || !/shuffle|noise|edge type|sign/i.test(result.stateText)) {
      throw new Error(`G30 sign noise should damage compatibility-aware neighbor use: ${JSON.stringify({ cleanSigns, result })}`);
    }

    await page.selectOption("#baselineMode", "mlp");
    await page.selectOption("#messageRule", "signed");
    await page.click("#applyCompatibility");
    await page.waitForTimeout(100);
    const mlpBaseline = await page.evaluate(() => window.__g30LabSnapshot());
    await page.selectOption("#baselineMode", "gcn");
    await page.click("#applyCompatibility");
    await page.waitForTimeout(100);
    const gcnBaseline = await page.evaluate(() => window.__g30LabSnapshot());
    await page.selectOption("#baselineMode", "compat");
    await page.click("#applyCompatibility");
    await page.waitForTimeout(100);
    const compatBaseline = await page.evaluate(() => window.__g30LabSnapshot());
    const distinctBaselines = new Set([
      mlpBaseline.classSeparation.toFixed(3),
      gcnBaseline.classSeparation.toFixed(3),
      compatBaseline.classSeparation.toFixed(3)
    ]);
    if (distinctBaselines.size < 3) {
      throw new Error(`G30 baseline selector should have distinct consequences: ${JSON.stringify({ mlpBaseline, gcnBaseline, compatBaseline })}`);
    }

    await setRange(page, "#relationNoise", 0.9);
    await setRange(page, "#homophilyRatio", 0.78);
    await page.click("#resetG30");
    await page.waitForFunction(() => window.__g30LabSnapshot().phase === "ready");
    result = await page.evaluate(() => ({ snapshot: window.__g30LabSnapshot(), noiseValue: document.querySelector("#relationNoise").value, homophilyValue: document.querySelector("#homophilyRatio").value }));
    if (result.snapshot.messageRule !== "gcn" || result.snapshot.signShuffled !== false || Number(result.noiseValue) !== 0.14 || Number(result.homophilyValue) !== 0.16) {
      throw new Error(`G30 reset should restore sliders, rule, and sign shuffle: ${JSON.stringify(result)}`);
    }

    await page.setViewportSize({ width: 900, height: 700 });
    await page.waitForTimeout(140);
    await noScrollbars(page, "narrow iframe");
    console.log("g30 smoke passed: heterophily lab contrasts GCN smoothing, signed compatibility, two-hop support, high-pass filters, sign noise, manual rotation, and iframe fit.");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
