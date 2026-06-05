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
  ["e01-mlp-decision-regions.html", "__e01LabReady", "__e01LabSnapshot"],
  ["e02-backprop-computational-graph.html", "__e02LabReady", "__e02LabSnapshot"],
  ["e03-convolution-kernel-lab.html", "__e03LabReady", "__e03LabSnapshot"],
  ["e04-rnn-hidden-state-lab.html", "__e04LabReady", "__e04LabSnapshot"],
  ["e05-attention-flow.html", "__e05LabReady", "__e05LabSnapshot"],
  ["e06-llm-token-prediction.html", "__e06LabReady", "__e06LabSnapshot"],
  ["e07-vae-latent-space-lab.html", "__e07LabReady", "__e07LabSnapshot"],
  ["e08-gan-minimax-game.html", "__e08LabReady", "__e08LabSnapshot"],
  ["e09-diffusion-denoising.html", "__e09LabReady", "__e09LabSnapshot"],
  ["e10-normalizing-flow-density.html", "__e10LabReady", "__e10LabSnapshot"],
  ["e11-gridworld-bellman-lab.html", "__e11LabReady", "__e11LabSnapshot"],
  ["e12-dqn-target-update-lab.html", "__e12LabReady", "__e12LabSnapshot"],
  ["e13-meta-learning-inner-loop.html", "__e13LabReady", "__e13LabSnapshot"],
  ["e14-contrastive-representation-lab.html", "__e14LabReady", "__e14LabSnapshot"],
  ["e15-neural-ode-flow.html", "__e15LabReady", "__e15LabSnapshot"],
  ["e16-energy-langevin-lab.html", "__e16LabReady", "__e16LabSnapshot"],
  ["e17-ssm-scan.html", "__e17LabReady", "__e17LabSnapshot"],
  ["e18-pinn-residual-lab.html", "__e18LabReady", "__e18LabSnapshot"]
];

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });

  try {
    for (const [file, readyHook, snapshotHook] of labs) {
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      const labPath = path.join(__dirname, file).replace(/\\/g, "/");
      await page.goto(`file:///${labPath}`);
      await page.locator(".lab-viewport canvas#canvas").waitFor({ state: "visible" });
      await page.waitForFunction(([ready, snapshot]) => window[ready] === true && typeof window[snapshot] === "function", [readyHook, snapshotHook]);
      await page.waitForTimeout(160);

      const result = await page.evaluate((snapshot) => {
        const canvas = document.querySelector("#canvas");
        const root = document.documentElement;
        const body = document.body;
        const copy = document.createElement("canvas");
        copy.width = canvas.width;
        copy.height = canvas.height;
        const ctx = copy.getContext("2d");
        ctx.drawImage(canvas, 0, 0);
        const image = ctx.getImageData(0, 0, copy.width, copy.height).data;
        let minX = canvas.width;
        let minY = canvas.height;
        let maxX = 0;
        let maxY = 0;
        let ink = 0;
        for (let y = Math.floor(canvas.height * 0.18); y < Math.floor(canvas.height * 0.92); y += 4) {
          for (let x = Math.floor(canvas.width * 0.08); x < Math.floor(canvas.width * 0.94); x += 4) {
            const i = (y * canvas.width + x) * 4;
            const r = image[i];
            const g = image[i + 1];
            const b = image[i + 2];
            if (r + g + b > 245 && Math.max(r, g, b) - Math.min(r, g, b) > 18) {
              ink += 1;
              minX = Math.min(minX, x);
              minY = Math.min(minY, y);
              maxX = Math.max(maxX, x);
              maxY = Math.max(maxY, y);
            }
          }
        }
        return {
          bytes: canvas.toDataURL("image/png").length,
          stateText: (document.querySelector("#state") || document.querySelector("#stateBox")).textContent.trim(),
          snapshot: window[snapshot](),
          pageOverflow: Math.max(root.scrollHeight, body.scrollHeight) - window.innerHeight,
          ink,
          inkWidth: maxX - minX,
          inkHeight: maxY - minY
        };
      }, snapshotHook);

      if (result.bytes < 14000) throw new Error(`${file}: weak canvas payload ${result.bytes}.`);
      if (result.stateText.length < 80) throw new Error(`${file}: weak state text.`);
      if (Math.abs(result.snapshot.cameraTheta) < 0.01) throw new Error(`${file}: missing orbit camera state.`);
      if ((result.snapshot.scene || result.snapshot.labId) !== file.slice(0, 3)) throw new Error(`${file}: snapshot scene id is missing or wrong.`);
      if ((file.startsWith("e01") || file.startsWith("e02")) && (result.ink < 500 || result.inkWidth < 360 || result.inkHeight < 220)) {
        throw new Error(`${file}: visual content is too small/sparse: ${JSON.stringify(result)}.`);
      }
      if (result.pageOverflow > 2) throw new Error(`${file}: document-pane overflow ${result.pageOverflow}px.`);

      const firstButton = page.locator("button").first();
      if ((await firstButton.count()) < 1) throw new Error(`${file}: missing controls.`);
      await firstButton.click();
      await page.close();
    }
  } finally {
    await browser.close();
  }

  console.log(`E-block direct smoke passed for ${labs.length} labs.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
