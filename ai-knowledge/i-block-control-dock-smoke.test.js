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
        const canvas = document.querySelector(".lab-viewport canvas");
        const controls = [...document.querySelectorAll("button, select, input")].map((node) => {
          const rect = node.getBoundingClientRect();
          const panelRect = panel ? panel.getBoundingClientRect() : null;
          return {
            id: node.id || node.getAttribute("data-gate") || node.textContent.trim(),
            width: rect.width,
            height: rect.height,
            insidePanel: panelRect ? rect.left >= panelRect.left - 1 && rect.right <= panelRect.right + 1 && rect.top >= panelRect.top - 1 && rect.bottom <= panelRect.bottom + 1 : false
          };
        });

        return {
          viewport: { width: window.innerWidth, height: window.innerHeight },
          pageOverflowY: Math.max(body.scrollHeight, doc.scrollHeight) - window.innerHeight,
          pageOverflowX: Math.max(body.scrollWidth, doc.scrollWidth) - window.innerWidth,
          shell: shell.getBoundingClientRect(),
          stage: stage.getBoundingClientRect(),
          panel: panel ? panel.getBoundingClientRect() : null,
          hasDock: Boolean(dock),
          panelOverflowY: panel ? panel.scrollHeight - panel.clientHeight : null,
          panelOverflowX: panel ? panel.scrollWidth - panel.clientWidth : null,
          canvasBytes: canvas.toDataURL("image/png").length,
          controls
        };
      });

      if (layout.hasDock) throw new Error(`${code} must not use the custom Block I .control-dock.`);
      if (!layout.panel) throw new Error(`${code} must use the shared .side-panel.lab-3d-panel control format.`);
      if (layout.stage.width < layout.viewport.width * 0.9) {
        throw new Error(`${code} canvas stage is still squeezed horizontally: ${JSON.stringify(layout)}`);
      }
      if (layout.stage.height < 430) {
        throw new Error(`${code} canvas stage is too short in narrow document panes: ${JSON.stringify(layout)}`);
      }
      if (layout.panel.y < layout.stage.y + layout.stage.height - 1) {
        throw new Error(`${code} shared panel overlaps the visual stage: ${JSON.stringify(layout)}`);
      }
      if (layout.pageOverflowY > 2 || layout.pageOverflowX > 2) {
        throw new Error(`${code} page must not scroll: ${JSON.stringify(layout)}`);
      }
      if (layout.panelOverflowY > 2 || layout.panelOverflowX > 2) {
        throw new Error(`${code} shared controls panel must not need its own scrollbar: ${JSON.stringify(layout)}`);
      }
      const badControl = layout.controls.find((control) => !control.insidePanel || control.width < 24 || control.height < 16);
      if (badControl) {
        throw new Error(`${code} has a clipped or misplaced control: ${JSON.stringify({ badControl, layout })}`);
      }
      if (layout.canvasBytes < 12000) {
        throw new Error(`${code} canvas appears too weak or blank: ${layout.canvasBytes} bytes.`);
      }

      await page.close();
    }
  } finally {
    await browser.close();
  }

  console.log(`I-block standard panel smoke passed for ${labs.length} labs.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
