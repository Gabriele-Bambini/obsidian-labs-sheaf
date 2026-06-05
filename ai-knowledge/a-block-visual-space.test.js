const fs = require("fs");
const path = require("path");

function loadPlaywright() {
  const candidates = [
    "playwright",
    "C:/Users/02gab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright",
    "C:/Users/02gab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
    "C:/Users/Gabriele/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright",
    "C:/Users/Gabriele/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright"
  ];
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (error) {
      // Try the next known runtime location.
    }
  }
  throw new Error(`Unable to load Playwright from: ${candidates.join(", ")}`);
}

const { chromium } = loadPlaywright();

const labs = [
  "a05-functional-analysis-operator-lab.html",
  "a06-topology-neighborhood-lab.html",
  "a07-measure-integration.html",
  "a08-algebra-structure-lab.html",
  "a09-category-theory-diagram-lab.html",
  "a11-information-theory-lab.html",
  "a12-algebraic-topology-lab.html",
  "a13-differential-equations-flow-lab.html",
  "a14-complex-contour-residue-lab.html",
  "a15-numerical-methods-stability-lab.html"
];

function assertA11SourceGuard() {
  const source = fs.readFileSync(path.join(__dirname, "a11-information-theory-lab.html"), "utf8");
  const forbiddenCanvasTitleLabels = [
    'label("entropy surface"',
    'label("p/q probability towers"',
    'label("channel joint p(x,y)"',
    'label("extra code cost"'
  ];
  for (const needle of forbiddenCanvasTitleLabels) {
    if (source.includes(needle)) {
      throw new Error(`A11 still draws overlapping projected section title: ${needle}`);
    }
  }
}

async function inspectLayout(page) {
  return page.evaluate(() => {
    const rectOf = (element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height
      };
    };
    const stage = document.querySelector(".stage");
    const panel = document.querySelector(".lab-3d-panel");
    const canvas = document.querySelector(".lab-viewport canvas");
    const frames = [...document.querySelectorAll(".lab-3d-panel, .control-grid, .button-row, .metric-strip")]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width > 1 && rect.height > 1 && getComputedStyle(element).display !== "none";
      })
      .map((element) => ({
        className: element.className,
        rect: rectOf(element),
        overflowX: element.scrollWidth - element.clientWidth,
        overflowY: element.scrollHeight - element.clientHeight
      }));
    const controls = [...document.querySelectorAll("button, input, select")]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 1 && rect.height > 1 && style.display !== "none" && style.visibility !== "hidden";
      })
      .map((element) => {
        const owner = element.closest(".lab-3d-panel, .control-grid, .control-dock") || document.body;
        return {
          tag: element.tagName.toLowerCase(),
          id: element.id,
          type: element.getAttribute("type") || "",
          text: element.textContent.trim().replace(/\s+/g, " "),
          rect: rectOf(element),
          ownerRect: rectOf(owner),
          clippedText: element.tagName.toLowerCase() === "button" && (element.scrollWidth - element.clientWidth > 3)
        };
      });
    return {
      stage: rectOf(stage),
      panel: rectOf(panel),
      canvas: rectOf(canvas),
      frames,
      controls,
      pageOverflowX: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
      pageOverflowY: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight,
      snapshot: typeof window.__a11LabSnapshot === "function" ? window.__a11LabSnapshot() : null
    };
  });
}

function inside(inner, outer, tolerance = 2) {
  return (
    inner.left >= outer.left - tolerance &&
    inner.top >= outer.top - tolerance &&
    inner.right <= outer.right + tolerance &&
    inner.bottom <= outer.bottom + tolerance
  );
}

async function main() {
  assertA11SourceGuard();
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });

  const failures = [];
  for (const lab of labs) {
    const page = await browser.newPage({ viewport: { width: 900, height: 720 } });
    try {
      await page.goto(`file:///${path.join(__dirname, lab).replace(/\\/g, "/")}`, { waitUntil: "domcontentloaded" });
      await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
      await page.waitForTimeout(220);
      if (lab === "a11-information-theory-lab.html") {
        await page.waitForFunction(() => window.__a11LabReady === true);
      }
      const report = await inspectLayout(page);
      if (report.pageOverflowX > 2 || report.pageOverflowY > 2) {
        failures.push(`${lab}: page overflow ${report.pageOverflowX}x${report.pageOverflowY}`);
      }
      if (report.stage.height < 350 || report.canvas.height < 350) {
        failures.push(`${lab}: visual stage too compressed (${Math.round(report.stage.width)}x${Math.round(report.stage.height)})`);
      }
      if (report.panel.height > 335) {
        failures.push(`${lab}: command panel consumes too much vertical space (${Math.round(report.panel.height)}px)`);
      }
      for (const frame of report.frames) {
        if (frame.overflowX > 4 || frame.overflowY > 4) {
          failures.push(`${lab}: ${frame.className} clips by ${frame.overflowX}x${frame.overflowY}`);
        }
      }
      for (const control of report.controls) {
        const minWidth = control.type === "range" ? 44 : 36;
        const minHeight = control.type === "range" ? 10 : 24;
        const label = `${control.tag}${control.id ? `#${control.id}` : ""}${control.text ? ` "${control.text}"` : ""}`;
        if (control.rect.width < minWidth || control.rect.height < minHeight) {
          failures.push(`${lab}: inaccessible ${label} ${Math.round(control.rect.width)}x${Math.round(control.rect.height)}`);
        }
        if (!inside(control.rect, control.ownerRect, 3)) {
          failures.push(`${lab}: ${label} sits outside its command frame`);
        }
        if (control.clippedText) {
          failures.push(`${lab}: button text is clipped in ${label}`);
        }
      }
      if (lab === "a11-information-theory-lab.html") {
        const layout = report.snapshot && report.snapshot.visualLayout;
        if (!layout || layout.version !== "a11-separated-lanes-v2" || layout.laneCount !== 3) {
          failures.push(`${lab}: missing separated-lane visual layout metadata`);
        }
      }
    } catch (error) {
      failures.push(`${lab}: ${error.message}`);
    } finally {
      await page.close();
    }
  }

  await browser.close();
  if (failures.length) {
    console.error(failures.join("\n"));
    throw new Error(`A-block visual-space smoke failed for ${failures.length} issue(s).`);
  }
  console.log(`a-block-visual-space passed for ${labs.length} target labs.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
