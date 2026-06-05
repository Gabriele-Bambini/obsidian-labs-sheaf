const fs = require("fs");
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

function registeredLabs() {
  const verifier = fs.readFileSync(path.join(__dirname, "verify-interactive-links.js"), "utf8");
  return [...new Set([...verifier.matchAll(/lab:\s*"([^"]+\.html)"/g)].map((match) => match[1]))].sort();
}

async function inspectControls(page) {
  return page.evaluate(() => {
    const viewport = { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
    const frameSelectors = [".lab-3d-panel", ".control-dock", ".controls", ".control-grid", ".button-row"];
    const frames = frameSelectors.flatMap((selector) =>
      [...document.querySelectorAll(selector)]
        .filter((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return style.display !== "none" && style.visibility !== "hidden" && rect.width > 1 && rect.height > 1;
        })
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            selector,
            className: element.className,
            id: element.id,
            rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
            overflowX: element.scrollWidth - element.clientWidth,
            overflowY: element.scrollHeight - element.clientHeight,
            cssOverflowX: getComputedStyle(element).overflowX,
            cssOverflowY: getComputedStyle(element).overflowY
          };
        })
    );

    const controls = [...document.querySelectorAll("button, select, input, textarea")]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 1 && rect.height > 1;
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const owner = element.closest(".lab-3d-panel, .control-dock, .controls, .control-grid") || document.body;
        const ownerRect = owner.getBoundingClientRect();
        return {
          id: element.id,
          tag: element.tagName.toLowerCase(),
          type: element.getAttribute("type") || "",
          text: element.textContent.trim().replace(/\s+/g, " ").slice(0, 40),
          disabled: element.disabled,
          rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
          owner: owner.className || owner.tagName,
          ownerRect: { left: ownerRect.left, top: ownerRect.top, right: ownerRect.right, bottom: ownerRect.bottom }
        };
      });

    return {
      viewport,
      pageOverflowX: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
      pageOverflowY: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight,
      frames,
      controls
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
  const labs = registeredLabs();
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });

  const failures = [];
  const viewports = [
    { name: "desktop", width: 1280, height: 720 },
    { name: "narrow-iframe", width: 900, height: 720 }
  ];

  for (const lab of labs) {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport: { width: viewport.width, height: viewport.height } });
      try {
        const labPath = path.join(__dirname, lab).replace(/\\/g, "/");
        await page.goto(`file:///${labPath}`, { waitUntil: "domcontentloaded" });
        await page.waitForTimeout(180);
        const report = await inspectControls(page);
        if (report.pageOverflowX > 2 || report.pageOverflowY > 2) {
          failures.push(`${lab} ${viewport.name}: page overflow ${report.pageOverflowX}x${report.pageOverflowY}`);
        }
        for (const frame of report.frames) {
          const overflowXBad = frame.overflowX > 3 && frame.cssOverflowX !== "visible";
          const overflowYBad = frame.overflowY > 3 && frame.cssOverflowY !== "visible";
          if (overflowXBad || overflowYBad) {
            failures.push(`${lab} ${viewport.name}: ${frame.selector} clips content by ${frame.overflowX}x${frame.overflowY}`);
          }
        }
        for (const control of report.controls) {
          const label = `${control.tag}${control.id ? `#${control.id}` : ""}${control.text ? ` "${control.text}"` : ""}`;
          if (control.disabled) failures.push(`${lab} ${viewport.name}: disabled visible control ${label}`);
          const minHeight = control.type === "range" ? 10 : 14;
          if (control.rect.width < 28 || control.rect.height < minHeight) {
            failures.push(`${lab} ${viewport.name}: tiny control ${label} ${Math.round(control.rect.width)}x${Math.round(control.rect.height)}`);
          }
          if (!inside(control.rect, report.viewport, 1)) {
            failures.push(`${lab} ${viewport.name}: control outside viewport ${label} ${JSON.stringify(control.rect)}`);
          }
          if (!inside(control.rect, control.ownerRect, 3)) {
            failures.push(`${lab} ${viewport.name}: control outside command frame ${label} owner=${control.owner}`);
          }
        }
      } catch (error) {
        failures.push(`${lab} ${viewport.name}: ${error.message}`);
      } finally {
        await page.close();
      }
    }
  }

  await browser.close();
  if (failures.length) {
    console.error(failures.slice(0, 120).join("\n"));
    if (failures.length > 120) console.error(`...and ${failures.length - 120} more`);
    throw new Error(`Control frame smoke failed for ${failures.length} issue(s).`);
  }
  console.log(`all-controls-in-frame passed for ${labs.length} labs across ${viewports.length} viewport sizes.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
