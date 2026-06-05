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
  { file: "h04-cellular-sheaf-on-graph-lab.html", action: "#toggleMaps", metric: "#energyLabel", expected: "." },
  { file: "h08-neural-sheaf-diffusion-lab.html", action: "#diffuseStep", metric: "#timeLabel", expected: "." },
  { file: "h09-connection-laplacian-transport-lab.html", action: "#transportVector", metric: "#normLabel", expected: "1.00" },
  { file: "h11-sheaf-gauge-transformation-lab.html", action: "#applyGauge", metric: "#energyLabel", expected: "." }
];

async function canvasHasInk(page) {
  return page.locator("canvas").evaluate((canvas) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return canvas.toDataURL("image/png").length > 9000;
    }
    const sample = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
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
  console.log(`Phase 14 browser smoke passed for ${labs.length} labs.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
