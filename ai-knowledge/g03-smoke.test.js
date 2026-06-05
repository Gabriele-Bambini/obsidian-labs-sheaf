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
    const file = path.join(__dirname, "g03-graph-attention-coefficients-lab.html").replace(/\\/g, "/");
    await page.goto(`file:///${file}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__g03LabReady === true && window.__g03LabSnapshot());
    await page.waitForTimeout(180);

    let result = await page.evaluate(() => ({
      bytes: document.querySelector("#canvas").toDataURL("image/png").length,
      snapshot: window.__g03LabSnapshot(),
      stateText: document.querySelector("#state").textContent.trim(),
      rangeCount: document.querySelectorAll('input[type="range"]').length,
      actionCount: document.querySelectorAll("[data-action]").length
    }));
    if (result.bytes < 13000 || result.snapshot.has3d !== true || result.snapshot.nodeCount < 10 || result.snapshot.edgeCount < 10) {
      throw new Error(`G03 initial render is weak: ${JSON.stringify(result)}`);
    }
    if (result.rangeCount < 5 || result.actionCount < 3) throw new Error(`G03 controls are incomplete: ${JSON.stringify(result)}`);
    if (!/masked|softmax|attention|neighborhood/i.test(result.stateText)) throw new Error(`G03 state copy is off-topic: ${result.stateText}`);
    await noScrollbars(page, "desktop");

    const thetaBefore = result.snapshot.cameraTheta;
    await page.mouse.move(430, 310);
    await page.mouse.down();
    await page.mouse.move(560, 360);
    await page.mouse.up();
    await page.waitForTimeout(80);
    result = await page.evaluate(() => window.__g03LabSnapshot());
    if (Math.abs(result.cameraTheta - thetaBefore) < 0.05) throw new Error("G03 camera did not rotate manually.");

    await page.click("#computeAttention");
    await page.waitForFunction(() => window.__g03LabSnapshot().phase === "attention");
    result = await page.evaluate(() => ({ snapshot: window.__g03LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (Math.abs(result.snapshot.alphaSum - 1) > 0.01 || result.snapshot.maxCoefficient <= 0 || result.snapshot.activeEdgeCount < 2) {
      throw new Error(`G03 attention pulse is not a local distribution: ${JSON.stringify(result)}`);
    }
    if (!/local softmax|coefficient|neighbor/i.test(result.stateText)) throw new Error(`G03 attention state is weak: ${result.stateText}`);

    await setRange(page, "#temperature", 0.35);
    await page.waitForTimeout(80);
    const sharpMax = await page.evaluate(() => window.__g03LabSnapshot().maxCoefficient);
    await setRange(page, "#temperature", 2.6);
    await page.waitForTimeout(80);
    const flatMax = await page.evaluate(() => window.__g03LabSnapshot().maxCoefficient);
    if (!(sharpMax > flatMax)) throw new Error(`G03 temperature should sharpen then flatten attention, sharp=${sharpMax}, flat=${flatMax}`);

    await page.click("#injectDistractor");
    await page.waitForFunction(() => window.__g03LabSnapshot().distractorAlpha > 0);
    result = await page.evaluate(() => ({ snapshot: window.__g03LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (result.snapshot.distractorAlpha <= 0 || !/distractor|spurious|edge/i.test(result.stateText)) {
      throw new Error(`G03 distractor edge is not visible: ${JSON.stringify(result)}`);
    }

    await page.click("#multiHead");
    await page.waitForFunction(() => window.__g03LabSnapshot().headCount === 3);
    result = await page.evaluate(() => ({
      snapshot: window.__g03LabSnapshot(),
      formula: document.querySelector("#formulaText").textContent.trim(),
      stateText: document.querySelector("#state").textContent.trim()
    }));
    if (result.snapshot.headDiversity <= 0 || !/multi-head|head/i.test(result.formula + " " + result.stateText)) {
      throw new Error(`G03 multi-head behavior is weak: ${JSON.stringify(result)}`);
    }

    await page.setViewportSize({ width: 900, height: 700 });
    await page.waitForTimeout(120);
    await noScrollbars(page, "narrow iframe");
    console.log("g03 smoke passed: graph attention lab renders masked softmax, temperature, distractor edges, multi-head diversity, and fits iframe.");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
