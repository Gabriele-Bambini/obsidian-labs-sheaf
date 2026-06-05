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

const labs = [
  { file: "h03-cellular-sheaf-cohomology.html", action: 'button[data-action="step"]', metric: ".state-box", expected: "Step" },
  { file: "e03-convolution-kernel-lab.html", action: "#scan", metric: "#sizeLabel", expected: "8x8" },
  { file: "e04-rnn-hidden-state-lab.html", action: "#step", metric: "#timeLabel", expected: "1" },
  { file: "e07-vae-latent-space-lab.html", action: "#sampleLatent", metric: ".state-box", expected: "Sample" }
];

async function canvasHasInk(page) {
  return page.locator("canvas").evaluate((canvas) => {
    const copy = document.createElement("canvas");
    copy.width = canvas.width;
    copy.height = canvas.height;
    const ctx = copy.getContext("2d");
    ctx.drawImage(canvas, 0, 0);
    const sample = ctx.getImageData(0, 0, copy.width, copy.height).data;
    let ink = 0;
    for (let i = 0; i < sample.length; i += 16) {
      const r = sample[i];
      const g = sample[i + 1];
      const b = sample[i + 2];
      if (r < 245 || g < 245 || b < 245) ink += 1;
      if (ink > 400) return true;
    }
    return false;
  });
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });

  for (const lab of labs) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const labPath = path.join(__dirname, lab.file).replace(/\\/g, "/");
    await page.goto(`file:///${labPath}`);
    await page.locator("canvas").waitFor({ state: "visible" });

    const box = await page.locator("canvas").boundingBox();
    if (!box || box.width < 300 || box.height < 300) {
      throw new Error(`${lab.file}: canvas is too small or missing`);
    }

    if (!(await canvasHasInk(page))) {
      throw new Error(`${lab.file}: canvas appears blank`);
    }

    await page.click(lab.action);
    const metricText = (await page.locator(lab.metric).textContent()).trim();
    if (!metricText.includes(lab.expected)) {
      throw new Error(`${lab.file}: expected ${lab.metric} to include "${lab.expected}", got "${metricText}"`);
    }

    const stateText = (await page.locator(".state-box").textContent()).trim();
    if (stateText.length < 40) {
      throw new Error(`${lab.file}: state explanation is too short`);
    }

    await page.close();
  }

  await browser.close();
  console.log(`Phase 7 browser smoke passed for ${labs.length} labs.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
