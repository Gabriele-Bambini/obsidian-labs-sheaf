const path = require("path");

function loadPlaywright() {
  try {
    return require("playwright");
  } catch (error) {
    try {
      return require("C:/Users/02gab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
    } catch (fallbackError) {
      return require("C:/Users/Gabriele/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
    }
  }
}

const { chromium } = loadPlaywright();

const labs = [
  ["I01", "i01-quantum-state-measurement.html", "__i01LabSnapshot"],
  ["I02", "i02-qubit-bloch-sphere.html", "__i02LabSnapshot"],
  ["I03", "i03-quantum-algorithm-interference-lab.html", "__i03LabSnapshot"],
  ["I04", "i04-variational-quantum-circuit-lab.html", "__i04LabSnapshot"],
  ["I05", "i05-quantum-graph-circuit-lab.html", "__i05LabSnapshot"],
  ["I06", "i06-quantum-advantage-boundary-lab.html", "__i06LabSnapshot"]
];

async function snapshot(page, hook) {
  return page.evaluate((name) => window[name](), hook);
}

async function assertControl(page, hook, selector, index, code, file) {
  const locator = page.locator(selector).nth(index);
  const id = await locator.evaluate((element) => element.id || element.getAttribute("data-gate") || element.textContent.trim().replace(/\s+/g, " "));
  if (!id) throw new Error(`${code}: ${selector}[${index}] lacks a stable id or command label.`);

  const box = await locator.boundingBox();
  if (!box || box.width < 24 || box.height < 16) {
    throw new Error(`${code}: ${id} is clipped or not visibly usable in ${file}.`);
  }

  const before = await snapshot(page, hook);
  if (typeof before.revision !== "number") throw new Error(`${code}: snapshot must expose numeric revision.`);
  if (!before.controls || !before.metrics || typeof before.stateText !== "string") {
    throw new Error(`${code}: snapshot must expose controls, metrics, and stateText.`);
  }
  const beforeCanvas = await page.locator("canvas#canvas").evaluate((canvas) => canvas.toDataURL("image/png").length);
  const beforeSemantic = JSON.stringify({
    controls: before.controls,
    metrics: before.metrics,
    stateText: before.stateText,
    mode: before.mode,
    view: before.view,
    revision: before.revision
  });

  let expectedValue = "clicked";
  if (selector === "button") {
    await locator.click();
  } else if (selector === "select") {
    const values = await locator.locator("option").evaluateAll((options) => options.map((option) => option.value || option.textContent.trim()));
    const current = await locator.inputValue();
    const next = values.find((value) => value !== current) || values[0];
    expectedValue = next;
    await locator.selectOption(next);
  } else {
    const min = Number(await locator.getAttribute("min"));
    const max = Number(await locator.getAttribute("max"));
    const current = Number(await locator.inputValue());
    const next = Number.isFinite(min) && Number.isFinite(max)
      ? String(current === min ? max : min)
      : String(current + 1);
    expectedValue = next;
    await locator.evaluate((element, value) => {
      element.value = value;
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    }, next);
  }

  await page.waitForTimeout(120);
  const after = await snapshot(page, hook);
  const afterCanvas = await page.locator("canvas#canvas").evaluate((canvas) => canvas.toDataURL("image/png").length);
  if (after.revision <= before.revision) throw new Error(`${code}: ${id} did not advance revision.`);
  if (after.lastControl !== id) throw new Error(`${code}: ${id} did not become lastControl; got ${after.lastControl}.`);
  if (!after.controls || String(after.controls[id]) !== String(expectedValue)) {
    throw new Error(`${code}: ${id} did not persist expected value ${expectedValue}. Snapshot: ${JSON.stringify(after)}`);
  }
  if (!after.stateText || !after.stateText.includes(id)) throw new Error(`${code}: ${id} did not update visible state text.`);

  const afterSemantic = JSON.stringify({
    controls: after.controls,
    metrics: after.metrics,
    stateText: after.stateText,
    mode: after.mode,
    view: after.view,
    revision: after.revision
  });
  if (afterSemantic === beforeSemantic) throw new Error(`${code}: ${id} did not change semantic lab state.`);
  if (afterCanvas < 12000 || beforeCanvas < 12000) throw new Error(`${code}: canvas too weak or blank around ${id}.`);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });

  try {
    for (const [code, file, hook] of labs) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });

      const labPath = path.join(__dirname, file).replace(/\\/g, "/");
      await page.goto(`file:///${labPath}`);
      await page.locator(".lab-shell.lab-3d-shell .lab-viewport canvas#canvas").waitFor({ state: "visible" });
      await page.waitForFunction((name) => typeof window[name] === "function", hook);

      const style = await page.evaluate(() => ({
        hasStandardPanel: Boolean(document.querySelector(".side-panel.lab-3d-panel")),
        hasDock: Boolean(document.querySelector(".control-dock")),
        hasHud: Boolean(document.querySelector(".hud h1")),
        bodyOverflowY: getComputedStyle(document.body).overflowY,
        overflowY: Math.max(document.body.scrollHeight, document.documentElement.scrollHeight) - window.innerHeight
      }));
      if (!style.hasStandardPanel) throw new Error(`${code}: must use the shared side-panel/lab-3d-panel visual grammar.`);
      if (style.hasDock) throw new Error(`${code}: must not use the custom Block I control-dock.`);
      if (!style.hasHud) throw new Error(`${code}: stage must include an explanatory HUD.`);
      if (style.bodyOverflowY !== "hidden" || style.overflowY > 2) throw new Error(`${code}: page must not scroll: ${JSON.stringify(style)}`);

      const counts = {
        button: await page.locator("button").count(),
        select: await page.locator("select").count(),
        range: await page.locator('input[type="range"]').count()
      };
      if (counts.button < 3 || counts.button + counts.select + counts.range < 7) {
        throw new Error(`${code}: expected a complete control surface; got ${JSON.stringify(counts)}.`);
      }

      for (let i = 0; i < counts.button; i += 1) await assertControl(page, hook, "button", i, code, file);
      for (let i = 0; i < counts.select; i += 1) await assertControl(page, hook, "select", i, code, file);
      for (let i = 0; i < counts.range; i += 1) await assertControl(page, hook, 'input[type="range"]', i, code, file);

      if (errors.length) throw new Error(`${code}: console/page errors: ${errors.join(" | ")}`);
      await page.close();
    }
  } finally {
    await browser.close();
  }

  console.log(`I-block semantic controls smoke passed for ${labs.length} labs.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
