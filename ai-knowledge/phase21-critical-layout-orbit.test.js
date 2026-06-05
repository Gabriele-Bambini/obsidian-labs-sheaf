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
  {
    name: "C01",
    file: "c01-convex-analysis-lab.html",
    ready: "__c01LabReady",
    snapshot: "__c01LabSnapshot",
    canvas: "canvas#convexCanvas"
  },
  {
    name: "C04",
    file: "c04-stochastic-optimization-lab.html",
    ready: "__c04LabReady",
    snapshot: "__c04LabSnapshot",
    canvas: "canvas#stochasticCanvas"
  },
  {
    name: "D07",
    file: "d07-metric-learning-lab.html",
    ready: "__d07LabReady",
    snapshot: "__d07LabSnapshot",
    canvas: "canvas#canvas"
  }
];

async function assertTopStageBottomControls(page, labName) {
  const layout = await page.evaluate(() => {
    const stage = document.querySelector(".stage").getBoundingClientRect();
    const panel = document.querySelector(".lab-3d-panel").getBoundingClientRect();
    const shell = document.querySelector(".lab-3d-shell").getBoundingClientRect();
    const controls = [...document.querySelectorAll("select, input, button")].map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        id: element.id,
        tag: element.tagName,
        type: element.getAttribute("type") || "",
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
        disabled: element.disabled,
        visible: getComputedStyle(element).visibility !== "hidden" && getComputedStyle(element).display !== "none"
      };
    });
    return {
      stage,
      panel,
      shell,
      pageOverflowY: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight,
      panelOverflowY: document.querySelector(".lab-3d-panel").scrollHeight - document.querySelector(".lab-3d-panel").clientHeight,
      controls
    };
  });

  if (layout.pageOverflowY > 2) throw new Error(`${labName}: page overflows vertically by ${layout.pageOverflowY}px.`);
  if (layout.panelOverflowY > 2) throw new Error(`${labName}: control panel clips vertically by ${layout.panelOverflowY}px.`);
  if (layout.stage.bottom > layout.panel.top + 2) {
    throw new Error(`${labName}: controls should be below the visualization, got stage.bottom=${layout.stage.bottom}, panel.top=${layout.panel.top}.`);
  }
  if (layout.stage.height < 390) throw new Error(`${labName}: visualization is too short after bottom-bar layout: ${layout.stage.height}px.`);
  if (layout.panel.height > 320) throw new Error(`${labName}: bottom command bar is too tall: ${layout.panel.height}px.`);

  for (const control of layout.controls) {
    if (!control.visible || control.disabled) throw new Error(`${labName}: inaccessible control ${control.id || control.tag}.`);
    const minHeight = control.type === "range" ? 10 : 18;
    if (control.width < 34 || control.height < minHeight) throw new Error(`${labName}: tiny control ${control.id || control.tag}: ${JSON.stringify(control)}.`);
    if (control.left < layout.panel.left - 2 || control.right > layout.panel.right + 2 || control.top < layout.panel.top - 2 || control.bottom > layout.panel.bottom + 2) {
      throw new Error(`${labName}: control ${control.id || control.tag} is outside the bottom command bar: ${JSON.stringify(control)}.`);
    }
  }
}

async function assertUnclampedPitch(page, lab) {
  const canvas = page.locator(lab.canvas);
  const box = await canvas.boundingBox();
  if (!box) throw new Error(`${lab.name}: missing canvas bounding box.`);

  const before = await page.evaluate((snapshotName) => window[snapshotName](), lab.snapshot);
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.52, box.y + box.height * 0.92, { steps: 14 });
  await page.mouse.up();
  const after = await page.evaluate((snapshotName) => window[snapshotName](), lab.snapshot);
  const beforePitch = Number(before.cameraPhi ?? before.cameraPitch ?? before.pitch);
  const afterPitch = Number(after.cameraPhi ?? after.cameraPitch ?? after.pitch);

  if (!Number.isFinite(beforePitch) || !Number.isFinite(afterPitch)) {
    throw new Error(`${lab.name}: snapshot must expose camera pitch/phi for orbit checks: ${JSON.stringify(after)}.`);
  }
  if (afterPitch < 2.0) {
    throw new Error(`${lab.name}: vertical orbit is still clamped before top view; pitch=${afterPitch}, before=${beforePitch}.`);
  }
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });

  for (const lab of labs) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const labPath = path.join(__dirname, lab.file).replace(/\\/g, "/");
    await page.goto(`file:///${labPath}`);
    await page.waitForFunction((readyName) => window[readyName] === true, lab.ready);
    await page.locator(lab.canvas).waitFor({ state: "visible" });
    await page.waitForTimeout(120);
    await assertTopStageBottomControls(page, lab.name);
    await assertUnclampedPitch(page, lab);
    await page.close();
  }

  await browser.close();
  console.log("phase21 critical layout/orbit smoke passed for C01, C04, and D07.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
