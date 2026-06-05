const path = require("path");

function loadPlaywright() {
  const candidates = [
    "playwright",
    "C:/Users/02gab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
    "C:/Users/02gab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright",
    "C:/Users/Gabriele/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"
  ];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (error) {
      // Try the next known bundled runtime path.
    }
  }
  throw new Error("Playwright is not available from the known runtime paths.");
}

const { chromium } = loadPlaywright();

const labs = [
  ["e01-mlp-decision-regions.html", "__e01LabSnapshot"],
  ["e02-backprop-computational-graph.html", "__e02LabSnapshot"],
  ["e03-convolution-kernel-lab.html", "__e03LabSnapshot"],
  ["e04-rnn-hidden-state-lab.html", "__e04LabSnapshot"],
  ["e05-attention-flow.html", "__e05LabSnapshot"],
  ["e06-llm-token-prediction.html", "__e06LabSnapshot"],
  ["e07-vae-latent-space-lab.html", "__e07LabSnapshot"],
  ["e08-gan-minimax-game.html", "__e08LabSnapshot"],
  ["e09-diffusion-denoising.html", "__e09LabSnapshot"],
  ["e10-normalizing-flow-density.html", "__e10LabSnapshot"],
  ["e11-gridworld-bellman-lab.html", "__e11LabSnapshot"],
  ["e12-dqn-target-update-lab.html", "__e12LabSnapshot"],
  ["e13-meta-learning-inner-loop.html", "__e13LabSnapshot"],
  ["e14-contrastive-representation-lab.html", "__e14LabSnapshot"],
  ["e15-neural-ode-flow.html", "__e15LabSnapshot"],
  ["e16-energy-langevin-lab.html", "__e16LabSnapshot"],
  ["e17-ssm-scan.html", "__e17LabSnapshot"],
  ["e18-pinn-residual-lab.html", "__e18LabSnapshot"]
];

async function snapshot(page, hook) {
  return page.evaluate((name) => window[name](), hook);
}

async function assertControlUsable(page, hook, selector, index, file) {
  const locator = page.locator(selector).nth(index);
  const controlId = await locator.evaluate((element, fallback) => element.id || element.dataset.action || element.dataset.control || element.dataset.param || fallback, `${selector}-${index}`);
  const box = await locator.boundingBox();
  if (!box || box.width < 24 || box.height < 14) {
    throw new Error(`${file}: ${selector}[${index}] is not visibly usable.`);
  }
  const disabled = await locator.evaluate((element) => element.disabled || element.getAttribute("aria-disabled") === "true");
  if (disabled) {
    throw new Error(`${file}: ${selector}[${index}] is disabled.`);
  }

  const before = await snapshot(page, hook);
  const hasSemanticRevision = typeof before.revision === "number";
  const beforeSemantic = JSON.stringify({
    step: before.step,
    controls: before.controls,
    metrics: before.metrics,
    stateText: before.stateText
  });

  let expectedValue = "clicked";
  if (selector.startsWith("button")) {
    await locator.click();
  } else if (selector.startsWith("select")) {
    const values = await locator.locator("option").evaluateAll((options) => options.map((option) => option.value));
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

  await page.waitForTimeout(80);
  const after = await snapshot(page, hook);
  if (!hasSemanticRevision) return;
  if (after.revision <= before.revision) {
    throw new Error(`${file}: ${selector}[${index}] did not advance lab revision.`);
  }
  if (after.lastControl !== controlId) {
    throw new Error(`${file}: ${controlId} did not become the active control; got ${after.lastControl}.`);
  }
  if (!after.controls || String(after.controls[controlId]) !== String(expectedValue)) {
    throw new Error(`${file}: ${controlId} did not persist its expected control value ${expectedValue}.`);
  }
  if (!after.stateText || !after.stateText.includes(controlId)) {
    throw new Error(`${file}: ${controlId} did not update visible state text.`);
  }
  const afterSemantic = JSON.stringify({
    step: after.step,
    controls: after.controls,
    metrics: after.metrics,
    stateText: after.stateText
  });
  if (afterSemantic === beforeSemantic) {
    throw new Error(`${file}: ${controlId} did not change semantic lab state.`);
  }
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });

  try {
    for (const [file, hook] of labs) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });

      const labPath = path.join(__dirname, file).replace(/\\/g, "/");
      await page.goto(`file:///${labPath}`);
      await page.locator(".lab-viewport canvas#canvas").waitFor({ state: "visible" });
      await page.waitForFunction((name) => typeof window[name] === "function", hook);

      const counts = {
        button: await page.locator('button:not([aria-hidden="true"])').count(),
        select: await page.locator('select:not([aria-hidden="true"])').count(),
        range: await page.locator('input[type="range"]:not([aria-hidden="true"])').count()
      };
      if (counts.button < 1 || counts.button + counts.select + counts.range < 3) {
        throw new Error(`${file}: expected at least three controls with at least one button; got ${JSON.stringify(counts)}.`);
      }

      for (let i = 0; i < counts.button; i += 1) await assertControlUsable(page, hook, 'button:not([aria-hidden="true"])', i, file);
      for (let i = 0; i < counts.select; i += 1) await assertControlUsable(page, hook, 'select:not([aria-hidden="true"])', i, file);
      for (let i = 0; i < counts.range; i += 1) await assertControlUsable(page, hook, 'input[type="range"]:not([aria-hidden="true"])', i, file);

      if (errors.length) {
        throw new Error(`${file}: control interaction produced console/page errors: ${errors.join(" | ")}`);
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }

  console.log(`E-block controls smoke passed for ${labs.length} labs.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
