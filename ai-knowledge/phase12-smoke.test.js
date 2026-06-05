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
  { file: "f12-graphon-sampling-lab.html", action: "#resample", metric: "#densityLabel", expected: "." },
  { file: "g09-temporal-gnn-memory-lab.html", action: "#processEvent", metric: "#memoryLabel", expected: "." },
  { file: "g11-geometric-domain-symmetry-lab.html", action: "#switchDomain", metric: "#symmetryLabel", expected: "permutation" },
  { file: "g12-molecular-message-passing-lab.html", action: "#passMessages", metric: "#energyLabel", expected: "." }
];

async function canvasHasInk(page) {
  return page.locator("canvas").evaluate((canvas) => {
    return canvas.toDataURL("image/png").length > 12000;
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
  console.log(`Phase 12 browser smoke passed for ${labs.length} labs.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
