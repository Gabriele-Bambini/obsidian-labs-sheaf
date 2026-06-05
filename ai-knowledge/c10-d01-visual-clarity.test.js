const path = require("path");

function loadPlaywright() {
  try {
    return require("playwright");
  } catch (error) {
    try {
      return require("C:/Users/02gab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
    } catch (fallbackError) {
      return require("C:/Users/02gab/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright");
    }
  }
}

const { chromium } = loadPlaywright();

async function setRange(page, selector, value) {
  await page.locator(selector).evaluate((input, nextValue) => {
    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
  await page.waitForTimeout(140);
}

async function openLab(page, file, readyName, snapshotName) {
  const labPath = path.join(__dirname, file).replace(/\\/g, "/");
  await page.goto(`file:///${labPath}?visual-clarity=c10-d01`);
  await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
  await page.waitForFunction(
    ([ready, snapshot]) => window[ready] === true && typeof window[snapshot] === "function" && window[snapshot](),
    [readyName, snapshotName]
  );
  await page.waitForTimeout(220);
}

function roleIncludes(snapshot, pattern) {
  return (snapshot.visualRoles || []).some((role) => pattern.test(role));
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 700 }, deviceScaleFactor: 1 });
  try {
    await openLab(page, "c10-optimal-transport-lab.html", "__c10LabReady", "__c10LabSnapshot");
    const c10Initial = await page.evaluate(() => window.__c10LabSnapshot());
    for (const role of [
      /coupling matrix heatmap cells/i,
      /ground cost matrix cells/i,
      /Sinkhorn row scale meters/i,
      /Sinkhorn column scale meters/i,
      /displacement interpolation mass particles/i
    ]) {
      if (!roleIncludes(c10Initial, role)) {
        throw new Error(`C10 missing canonical optimal-transport object ${role}. Roles: ${(c10Initial.visualRoles || []).join(" | ")}`);
      }
    }
    if (c10Initial.clarityVersion !== "c10-d01-canonical-clarity-v2" || c10Initial.legacyClarityVersion !== "c10-d01-canonical-clarity-v1") {
      throw new Error(`C10 missing canonical clarity snapshot: ${JSON.stringify(c10Initial)}`);
    }
    if (c10Initial.transportPlanCellCount < 16 || c10Initial.costMatrixCellCount < 16 || c10Initial.rowScaleMeterCount < 4 || c10Initial.columnScaleMeterCount < 4) {
      throw new Error(`C10 matrix/Sinkhorn scaffold is too sparse: ${JSON.stringify(c10Initial)}`);
    }
    if (!/plan|cost|sinkhorn|dual|geodesic/i.test(c10Initial.optimalTransportHash || "")) {
      throw new Error(`C10 hash does not identify the canonical OT system: ${JSON.stringify(c10Initial)}`);
    }
    await setRange(page, "#c10-regularization", "0.1");
    const c10Sharp = await page.evaluate(() => window.__c10LabSnapshot());
    await setRange(page, "#c10-regularization", "0.9");
    const c10Blur = await page.evaluate(() => window.__c10LabSnapshot());
    if (!(c10Blur.sinkhornBlurRadius > c10Sharp.sinkhornBlurRadius && c10Blur.maxPlanCellOpacity < c10Sharp.maxPlanCellOpacity)) {
      throw new Error(`C10 entropy epsilon does not visibly diffuse the coupling matrix: sharp=${JSON.stringify(c10Sharp)} blur=${JSON.stringify(c10Blur)}`);
    }

    await openLab(page, "d01-linear-models-lab.html", "__d01LabReady", "__d01LabSnapshot");
    const d01Initial = await page.evaluate(() => window.__d01LabSnapshot());
    for (const role of [
      /design matrix row glyphs/i,
      /intercept feature column blocks/i,
      /column-space projection target board/i,
      /normal equation orthogonality gauge/i,
      /gradient vector arrow/i
    ]) {
      if (!roleIncludes(d01Initial, role)) {
        throw new Error(`D01 missing canonical linear-model object ${role}. Roles: ${(d01Initial.visualRoles || []).join(" | ")}`);
      }
    }
    if (d01Initial.visualQuality !== "d01-d02-ml-specific-v2" || d01Initial.designRows < 12 || d01Initial.designMatrixCellCount < 36 || d01Initial.featureColumns < 3) {
      throw new Error(`D01 design-matrix scaffold is too weak: ${JSON.stringify(d01Initial)}`);
    }
    if (d01Initial.projectionOrthogonality > 0.05 || d01Initial.residualRodCount < d01Initial.designRows) {
      throw new Error(`D01 does not expose least-squares orthogonal projection geometry: ${JSON.stringify(d01Initial)}`);
    }
    await page.locator("#model").selectOption("ridge");
    await page.locator("#viewMode").selectOption("regularization");
    await setRange(page, "#lambda", "1.8");
    await page.locator("#fitClosedForm").click();
    await page.waitForFunction(() => window.__d01LabSnapshot().model === "ridge" && window.__d01LabSnapshot().lambda > 1.7);
    const d01Ridge = await page.evaluate(() => window.__d01LabSnapshot());
    if (!(d01Ridge.ridgeNorm < d01Ridge.olsNorm && d01Ridge.ridgePlaneHash !== d01Initial.ridgePlaneHash)) {
      throw new Error(`D01 ridge lambda does not change coefficient geometry: initial=${JSON.stringify(d01Initial)} ridge=${JSON.stringify(d01Ridge)}`);
    }
    await page.locator("#model").selectOption("logistic");
    await page.locator("#viewMode").selectOption("classification");
    await setRange(page, "#overlap", "0.05");
    await page.locator("#fitClosedForm").click();
    const separated = await page.evaluate(() => window.__d01LabSnapshot());
    await setRange(page, "#overlap", "0.9");
    await page.locator("#fitClosedForm").click();
    const overlapped = await page.evaluate(() => window.__d01LabSnapshot());
    if (separated.boundaryHash === overlapped.boundaryHash || Math.abs(separated.logLoss - overlapped.logLoss) < 0.02) {
      throw new Error(`D01 logistic fit is not responding to class overlap: separated=${JSON.stringify(separated)} overlapped=${JSON.stringify(overlapped)}`);
    }
  } finally {
    await browser.close();
  }
  console.log("c10-d01 visual clarity passed: C10 and D01 expose canonical objects, telemetry, and parameter-causal geometry.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
