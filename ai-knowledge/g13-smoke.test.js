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
    const file = path.join(__dirname, "g13-knowledge-graph-relations-lab.html").replace(/\\/g, "/");
    await page.goto(`file:///${file}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__g13LabReady === true && window.__g13LabSnapshot());
    await page.waitForTimeout(180);

    let result = await page.evaluate(() => ({
      bytes: document.querySelector("#canvas").toDataURL("image/png").length,
      snapshot: window.__g13LabSnapshot(),
      stateText: document.querySelector("#state").textContent.trim(),
      rangeCount: document.querySelectorAll('input[type="range"]').length,
      actionCount: document.querySelectorAll("[data-action]").length
    }));
    if (result.bytes < 13000 || result.snapshot.has3d !== true || result.snapshot.entityCount < 8 || result.snapshot.relationTypeCount < 4 || result.snapshot.tripleCount < 8) {
      throw new Error(`G13 initial render is weak: ${JSON.stringify(result)}`);
    }
    if (result.rangeCount < 5 || result.actionCount < 4) throw new Error(`G13 controls are incomplete: ${JSON.stringify(result)}`);
    if (!/knowledge graph|relation|triple|typed|decoder/i.test(result.stateText)) throw new Error(`G13 state copy is off-topic: ${result.stateText}`);
    await noScrollbars(page, "desktop");

    const thetaBefore = result.snapshot.cameraTheta;
    await page.mouse.move(430, 310);
    await page.mouse.down();
    await page.mouse.move(560, 360);
    await page.mouse.up();
    await page.waitForTimeout(80);
    result = await page.evaluate(() => window.__g13LabSnapshot());
    if (Math.abs(result.cameraTheta - thetaBefore) < 0.05) throw new Error("G13 camera did not rotate manually.");

    await page.selectOption("#scenarioSelect", "biography");
    await page.selectOption("#candidateRelation", "born_country");
    await page.selectOption("#decoderSelect", "transe");
    await page.click("#composePath");
    await page.waitForFunction(() => window.__g13LabSnapshot().phase === "path");
    result = await page.evaluate(() => ({ snapshot: window.__g13LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (result.snapshot.supportPathLength < 2 || result.snapshot.pathEvidence <= 0 || !/born_in|located_in|path|rule|country/i.test(result.stateText)) {
      throw new Error(`G13 path composition should explain a missing born-country triple: ${JSON.stringify(result)}`);
    }

    await page.click("#scoreTriplet");
    await page.waitForFunction(() => window.__g13LabSnapshot().phase === "score");
    result = await page.evaluate(() => ({ snapshot: window.__g13LabSnapshot(), stateText: document.querySelector("#state").textContent.trim(), scoreText: document.querySelector("#scoreLabel").textContent.trim() }));
    if (result.snapshot.tripleScore <= 0 || result.snapshot.rankProxy <= 0 || !/\d+\.\d+/.test(result.scoreText) || !/score|triple|TransE|candidate/i.test(result.stateText)) {
      throw new Error(`G13 triple scoring should rank the candidate fact with the selected decoder: ${JSON.stringify(result)}`);
    }

    await setRange(page, "#negativeHardness", 0.1);
    await page.click("#corruptNegative");
    await page.waitForFunction(() => window.__g13LabSnapshot().phase === "negative");
    const easyNegative = await page.evaluate(() => window.__g13LabSnapshot());
    await setRange(page, "#negativeHardness", 0.92);
    await page.click("#corruptNegative");
    await page.waitForTimeout(120);
    result = await page.evaluate(() => ({ snapshot: window.__g13LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (!(result.snapshot.negativeScore > easyNegative.negativeScore) || !(result.snapshot.falseNegativeRisk > easyNegative.falseNegativeRisk) || !/hard negative|corrupt|type|missing/i.test(result.stateText)) {
      throw new Error(`G13 harder negatives should become plausible and raise missing-fact risk: ${JSON.stringify({ easyNegative, result })}`);
    }

    await setRange(page, "#basisCount", 2);
    await page.click("#routeMessages");
    await page.waitForFunction(() => window.__g13LabSnapshot().phase === "message");
    const sharedBasis = await page.evaluate(() => window.__g13LabSnapshot());
    await setRange(page, "#basisCount", 8);
    await page.click("#routeMessages");
    await page.waitForTimeout(120);
    result = await page.evaluate(() => ({ snapshot: window.__g13LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (!(result.snapshot.relationParameterCount > sharedBasis.relationParameterCount) || !(sharedBasis.basisCompression > result.snapshot.basisCompression) || !/R-GCN|basis|relation-specific|channel/i.test(result.stateText)) {
      throw new Error(`G13 basis count should change relation parameter sharing: ${JSON.stringify({ sharedBasis, result })}`);
    }

    await page.setViewportSize({ width: 900, height: 700 });
    await page.waitForTimeout(120);
    await noScrollbars(page, "narrow iframe");
    console.log("g13 smoke passed: KG lab renders typed triples, path reasoning, decoder scoring, negative sampling, relation basis sharing, and fits iframe.");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
