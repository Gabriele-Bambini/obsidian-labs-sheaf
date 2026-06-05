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
    const file = path.join(__dirname, "g12-molecular-message-passing-lab.html").replace(/\\/g, "/");
    await page.goto(`file:///${file}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__g12LabReady === true && window.__g12LabSnapshot());
    await page.waitForTimeout(180);

    let result = await page.evaluate(() => ({
      bytes: document.querySelector("#canvas").toDataURL("image/png").length,
      snapshot: window.__g12LabSnapshot(),
      stateText: document.querySelector("#state").textContent.trim(),
      rangeCount: document.querySelectorAll('input[type="range"]').length,
      actionCount: document.querySelectorAll("[data-action]").length
    }));
    if (result.bytes < 13000 || result.snapshot.has3d !== true || result.snapshot.nodeCount < 7 || result.snapshot.bondCount < 6) {
      throw new Error(`G12 initial render is weak: ${JSON.stringify(result)}`);
    }
    if (result.rangeCount < 5 || result.actionCount < 4) throw new Error(`G12 controls are incomplete: ${JSON.stringify(result)}`);
    if (!/molecule|atom|bond|message|readout/i.test(result.stateText)) throw new Error(`G12 state copy is off-topic: ${result.stateText}`);
    await noScrollbars(page, "desktop");

    const thetaBefore = result.snapshot.cameraTheta;
    await page.mouse.move(430, 310);
    await page.mouse.down();
    await page.mouse.move(560, 360);
    await page.mouse.up();
    await page.waitForTimeout(80);
    result = await page.evaluate(() => window.__g12LabSnapshot());
    if (Math.abs(result.cameraTheta - thetaBefore) < 0.05) throw new Error("G12 camera did not rotate manually.");

    await page.selectOption("#messageRule", "bond");
    await page.click("#passMessages");
    await page.waitForFunction(() => window.__g12LabSnapshot().phase === "message");
    result = await page.evaluate(() => ({ snapshot: window.__g12LabSnapshot(), stateText: document.querySelector("#state").textContent.trim(), energyText: document.querySelector("#energyLabel").textContent.trim() }));
    if (result.snapshot.messageNorm <= 0 || result.snapshot.activeBondCount <= 0 || result.snapshot.bondConditioningStrength <= 0 || !/bond|condition|message|atom/i.test(result.stateText) || !/\d+\.\d+/.test(result.energyText)) {
      throw new Error(`G12 bond-conditioned message passing should update atoms through typed bonds: ${JSON.stringify(result)}`);
    }

    await setRange(page, "#distanceCutoff", 1.2);
    await page.click("#toggleGeometry");
    await page.waitForFunction(() => window.__g12LabSnapshot().phase === "geometry");
    const lowCutoff = await page.evaluate(() => window.__g12LabSnapshot());
    await setRange(page, "#distanceCutoff", 4.2);
    await page.click("#toggleGeometry");
    await page.waitForTimeout(120);
    result = await page.evaluate(() => ({ snapshot: window.__g12LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (!(result.snapshot.nonbondedEdgeCount > lowCutoff.nonbondedEdgeCount) || !(result.snapshot.geometryShare >= lowCutoff.geometryShare) || !/distance|cutoff|geometry|nonbonded/i.test(result.stateText)) {
      throw new Error(`G12 distance cutoff should add non-bonded geometric neighbors: ${JSON.stringify({ lowCutoff, result })}`);
    }

    await page.selectOption("#moleculeSelect", "aromatic");
    await page.selectOption("#readoutMode", "sum");
    await page.click("#poolReadout");
    await page.waitForFunction(() => window.__g12LabSnapshot().phase === "readout");
    result = await page.evaluate(() => ({ snapshot: window.__g12LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (result.snapshot.readoutMode !== "sum" || result.snapshot.readoutNorm <= 0 || result.snapshot.energyProxy <= 0 || !/sum|readout|extensive|energy/i.test(result.stateText)) {
      throw new Error(`G12 sum readout should represent an extensive molecular property: ${JSON.stringify(result)}`);
    }

    await setRange(page, "#conformerBend", 0.82);
    await page.click("#bendConformer");
    await page.waitForFunction(() => window.__g12LabSnapshot().phase === "conformer");
    result = await page.evaluate(() => ({ snapshot: window.__g12LabSnapshot(), stateText: document.querySelector("#state").textContent.trim() }));
    if (result.snapshot.conformerShift <= 0.5 || result.snapshot.dipoleProxy <= 0 || !/conformer|3d|distance|geometry/i.test(result.stateText)) {
      throw new Error(`G12 conformer bending should change 3D distances and dipole proxy: ${JSON.stringify(result)}`);
    }

    await setRange(page, "#geometryWeight", 0.1);
    await page.click("#toggleGeometry");
    await page.waitForTimeout(100);
    const weakGeometry = await page.evaluate(() => window.__g12LabSnapshot());
    await setRange(page, "#geometryWeight", 1.4);
    await page.click("#toggleGeometry");
    await page.waitForTimeout(100);
    const strongGeometry = await page.evaluate(() => window.__g12LabSnapshot());
    if (!(strongGeometry.geometryShare > weakGeometry.geometryShare) || !(Math.abs(strongGeometry.energyProxy - weakGeometry.energyProxy) > 0.02)) {
      throw new Error(`G12 geometry weight should change the property estimate: ${JSON.stringify({ weakGeometry, strongGeometry })}`);
    }

    await page.setViewportSize({ width: 900, height: 700 });
    await page.waitForTimeout(120);
    await noScrollbars(page, "narrow iframe");
    console.log("g12 smoke passed: molecular lab renders atoms, typed bonds, distance geometry, conformer effects, readouts, and fits iframe.");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
