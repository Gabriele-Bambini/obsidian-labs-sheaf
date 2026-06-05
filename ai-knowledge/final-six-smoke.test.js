const path = require("path");

function loadPlaywright() {
  try {
    return require("playwright");
  } catch (error) {
    try {
      return require("C:/Users/02gab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
    } catch (fallbackError) {
      try {
        return require("C:/Users/02gab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright");
      } catch (pnpmError) {
        return require("C:/Users/Gabriele/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
      }
    }
  }
}

const { chromium } = loadPlaywright();

const labs = [
  {
    file: "a01-linear-algebra-foundations-lab.html",
    canvas: "#canvas",
    action: "[data-action='pulse']",
    state: "#stateBox"
  },
  {
    file: "a02-linear-map-grid.html",
    canvas: "#canvas",
    action: "[data-action='pulse']",
    state: "#stateBox"
  },
  {
    file: "a03-eigen-quadratic-form.html",
    canvas: "#canvas",
    action: "[data-action='pulse']",
    state: "#stateBox"
  },
  {
    file: "a06-topology-neighborhood-lab.html",
    canvas: "#canvas",
    action: "[data-action='pulse']",
    state: "#stateBox"
  },
  {
    file: "a07-measure-integration.html",
    canvas: "#canvas",
    action: "[data-action='pulse']",
    state: "#stateBox"
  },
  {
    file: "g04-graphsage-sampling-lab.html",
    canvas: "#canvas",
    action: "[data-action='pulse']",
    state: "#stateBox"
  }
];

async function canvasHasInk(page, selector) {
  return page.$eval(selector, (canvas) => {
    if (canvas.toDataURL("image/png").length > 9000) return true;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] !== 0 && (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245)) {
        return true;
      }
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

  for (const lab of labs) {
    const labPath = path.join(__dirname, lab.file).replace(/\\/g, "/");
    await page.goto(`file:///${labPath}`);
    await page.waitForSelector(lab.canvas);
    await page.waitForFunction((selector) => {
      const node = document.querySelector(selector);
      return node && node.textContent && node.textContent.trim().length >= 30;
    }, lab.state, { timeout: 30000 });
    if (await page.locator(lab.action).count()) {
      await page.click(lab.action);
      await page.waitForTimeout(160);
    }
    const stateText = (await page.locator(lab.state).textContent()) || "";
    if (stateText.trim().length < 30) {
      throw new Error(`${lab.file} state text is too short.`);
    }
    if (!(await canvasHasInk(page, lab.canvas))) {
      throw new Error(`${lab.file} canvas appears blank.`);
    }
  }

  await browser.close();
  console.log(`final-six smoke passed: ${labs.length} labs rendered with canvas ink and state text.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
