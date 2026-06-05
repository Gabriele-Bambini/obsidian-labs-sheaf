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

async function main() {
  const indexPath = path.join(__dirname, "index.html").replace(/\\/g, "/");
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await page.goto(`file:///${indexPath}`);

  const cards = await page.locator(".card").count();
  const coverageText = await page
    .locator('a[href="./COVERAGE_MAP.md"]')
    .textContent();

  if (cards !== 113) {
    throw new Error(`Expected 113 lab cards, found ${cards}.`);
  }

  if (!coverageText || !coverageText.includes("coverage map")) {
    throw new Error("Missing coverage map link in catalog.");
  }

  await browser.close();
  console.log(`catalog smoke passed: ${cards} cards and coverage link present.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
