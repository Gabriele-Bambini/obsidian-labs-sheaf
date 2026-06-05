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
  ["I01", "i01-quantum-state-measurement.html"],
  ["I02", "i02-qubit-bloch-sphere.html"],
  ["I03", "i03-quantum-algorithm-interference-lab.html"],
  ["I04", "i04-variational-quantum-circuit-lab.html"],
  ["I05", "i05-quantum-graph-circuit-lab.html"],
  ["I06", "i06-quantum-advantage-boundary-lab.html"]
];

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });

  try {
    for (const [code, file] of labs) {
      const page = await browser.newPage({ viewport: { width: 760, height: 720 } });
      const labPath = path.join(__dirname, file).replace(/\\/g, "/");
      await page.goto(`file:///${labPath}`);
      await page.locator(".lab-shell.lab-3d-shell").waitFor({ state: "visible" });
      await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });

      const layout = await page.evaluate(() => {
        const body = document.body;
        const doc = document.documentElement;
        const shell = document.querySelector(".lab-shell");
        const stage = document.querySelector(".stage");
        const panel = document.querySelector(".side-panel.lab-3d-panel");
        const dock = document.querySelector(".control-dock");
        const overflowY = Math.max(body.scrollHeight, doc.scrollHeight) - window.innerHeight;
        const overflowX = Math.max(body.scrollWidth, doc.scrollWidth) - window.innerWidth;
        const shellStyle = getComputedStyle(shell);
        const bodyStyle = getComputedStyle(body);
        return {
          overflowY,
          overflowX,
          bodyOverflowY: bodyStyle.overflowY,
          shellHeight: shell.getBoundingClientRect().height,
          shellColumns: shellStyle.gridTemplateColumns,
          shellRows: shellStyle.gridTemplateRows,
          stage: stage.getBoundingClientRect(),
          panel: panel ? panel.getBoundingClientRect() : null,
          hasDock: Boolean(dock),
          panelOverflowY: panel ? panel.scrollHeight - panel.clientHeight : null,
          panelOverflowX: panel ? panel.scrollWidth - panel.clientWidth : null
        };
      });

      if (layout.overflowY > 2 || layout.overflowX > 2) {
        throw new Error(`${code} lab overflows the iframe viewport: ${JSON.stringify(layout)}`);
      }
      if (layout.bodyOverflowY !== "hidden") {
        throw new Error(`${code} lab body must keep overflow hidden, got ${layout.bodyOverflowY}`);
      }
      if (layout.hasDock) {
        throw new Error(`${code} lab must not use the custom .control-dock.`);
      }
      if (!layout.panel) {
        throw new Error(`${code} lab must expose the shared .side-panel.lab-3d-panel.`);
      }
      if (layout.stage.width < 680 || layout.stage.height < 430 || layout.panel.height < 180) {
        throw new Error(`${code} lab narrow layout is too cramped: ${JSON.stringify(layout)}`);
      }
      if (layout.panel.y < layout.stage.y + layout.stage.height - 1) {
        throw new Error(`${code} shared panel overlaps the visual stage: ${JSON.stringify(layout)}`);
      }
      if (layout.panelOverflowY > 2 || layout.panelOverflowX > 2) {
        throw new Error(`${code} lab controls panel should not need its own scrollbar: ${JSON.stringify(layout)}`);
      }

      await page.close();
    }
  } finally {
    await browser.close();
  }

  console.log(`I-block no-scroll smoke passed for ${labs.length} labs.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
