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

  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const labPath = path.join(__dirname, "e01-mlp-decision-regions.html").replace(/\\/g, "/");
  await page.goto(`file:///${labPath}`);
  await page.locator("canvas").waitFor({ state: "visible" });

  const box = await page.locator("canvas").boundingBox();
  if (!box || box.width < 300 || box.height < 300) {
    throw new Error("E01 lab canvas is too small or missing.");
  }

  if (!(await canvasHasInk(page))) {
    throw new Error("E01 lab canvas appears blank.");
  }

  await page.click("#cycle");
  const hiddenCount = (await page.locator("#hiddenCount").textContent()).trim();
  if (hiddenCount !== "2") {
    throw new Error(`Expected hidden count to update to 2, got "${hiddenCount}".`);
  }

  await page.locator("#architecture").evaluate((select) => {
    select.value = "four";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.selectOption("#activation", "sigmoid");
  await page.locator("#dataset").evaluate((select) => {
    select.value = "circle";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  const accuracy = (await page.locator("#accuracy").textContent()).trim();
  if (!/%$/.test(accuracy)) {
    throw new Error(`Expected accuracy percentage, got "${accuracy}".`);
  }

  const stateText = (await page.locator(".state-box").textContent()).trim();
  if (stateText.length < 50 || !stateText.includes("center-versus-ring")) {
    throw new Error("E01 lab state text did not update for the circle dataset.");
  }

  await browser.close();
  console.log("Phase 20 browser smoke passed for E01 MLP decision regions lab.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
