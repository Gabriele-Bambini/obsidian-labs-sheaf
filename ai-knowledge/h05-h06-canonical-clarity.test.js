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
      // Try the next bundled/runtime location.
    }
  }
  throw new Error(`Unable to load Playwright from: ${candidates.join(", ")}`);
}

const { chromium } = loadPlaywright();
const CLARITY_VERSION = "h05-h06-canonical-clarity-v1";

async function loadLab(page, fileName, readyName, snapshotName) {
  const labPath = path.join(__dirname, fileName).replace(/\\/g, "/");
  await page.goto(`file:///${labPath}`, { waitUntil: "domcontentloaded" });
  await page.locator(".lab-viewport canvas#canvas").waitFor({ state: "visible" });
  await page.waitForFunction(
    ([ready, snapshot]) => window[ready] === true && typeof window[snapshot] === "function" && window[snapshot](),
    [readyName, snapshotName]
  );
  await page.waitForTimeout(220);
  return page.evaluate((snapshotName) => {
    const canvas = document.querySelector(".lab-viewport canvas#canvas");
    const command = document.querySelector(".command-bar");
    const stateNode = document.querySelector("#state") || document.querySelector("#stateText") || document.querySelector(".state-box");
    return {
      bytes: canvas.toDataURL("image/png").length,
      snapshot: window[snapshotName](),
      stateText: stateNode.textContent.trim(),
      overflowX: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
      overflowY: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight,
      commandOverflowX: command ? command.scrollWidth - command.clientWidth : 0,
      commandOverflowY: command ? command.scrollHeight - command.clientHeight : 0
    };
  }, snapshotName);
}

async function setRange(page, selector, value) {
  await page.locator(selector).evaluate((input, nextValue) => {
    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

function requireFit(result, label) {
  if (result.overflowX > 18 || result.overflowY > 18 || result.commandOverflowX > 6 || result.commandOverflowY > 6) {
    throw new Error(`${label} is not fitted: ${JSON.stringify({
      overflowX: result.overflowX,
      overflowY: result.overflowY,
      commandOverflowX: result.commandOverflowX,
      commandOverflowY: result.commandOverflowY
    })}`);
  }
}

function requireFields(snapshot, fields, label) {
  for (const field of fields) {
    if (!(field in snapshot)) throw new Error(`${label} missing snapshot field ${field}`);
    if (snapshot[field] == null || snapshot[field] === "") throw new Error(`${label} field ${field} is empty`);
  }
}

function requireMinimums(snapshot, minimums, label) {
  for (const [field, min] of Object.entries(minimums)) {
    if (!(snapshot[field] >= min)) throw new Error(`${label} ${field} too weak: ${snapshot[field]} < ${min}`);
  }
}

function requireIncludes(snapshot, field, values, label) {
  if (!Array.isArray(snapshot[field])) throw new Error(`${label} ${field} is not an array: ${JSON.stringify(snapshot[field])}`);
  for (const value of values) {
    if (!snapshot[field].includes(value)) throw new Error(`${label} ${field} missing ${value}: ${JSON.stringify(snapshot[field])}`);
  }
}

function requireChanged(before, after, fields, label, minChanges = 2) {
  const changed = fields.filter((field) => before[field] !== after[field]);
  if (changed.length < minChanges) {
    throw new Error(`${label} controls changed too little. Changed ${changed.length}/${fields.length}: ${changed.join(", ")}`);
  }
}

async function testH05(page) {
  const result = await loadLab(page, "h05-sheaf-laplacian-builder.html", "__h05LabReady", "__h05LabSnapshot");
  requireFit(result, "H05 desktop");
  const initial = result.snapshot;
  if (result.bytes < 12000 || initial.clarityVersion !== CLARITY_VERSION || initial.labId !== "h05" || initial.has3d !== true) {
    throw new Error(`H05 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    domainGraphObjectCount: 6,
    nodeStalkObjectCount: 3,
    edgeStalkObjectCount: 3,
    restrictionMapObjectCount: 6,
    coboundaryDeltaObjectCount: 3,
    deltaMatrixObjectCount: 9,
    laplacianBlockObjectCount: 9,
    blockContributionObjectCount: 12,
    dirichletEnergyObjectCount: 5,
    spectrumEigenObjectCount: 5,
    kernelGlobalSectionObjectCount: 3,
    diffusionDirectionObjectCount: 6,
    projectionSheafObjectCount: 3,
    connectionFrameObjectCount: 3
  }, "H05");
  requireFields(initial, [
    "domainGraphHash",
    "nodeStalkHash",
    "edgeStalkHash",
    "restrictionMapHash",
    "coboundaryDeltaHash",
    "deltaMatrixHash",
    "laplacianBlockHash",
    "blockContributionHash",
    "dirichletEnergyHash",
    "spectrumEigenHash",
    "kernelGlobalSectionHash",
    "diffusionDirectionHash",
    "projectionSheafHash",
    "connectionFrameHash",
    "canonicalReferences",
    "laplacianObjects",
    "diagnosticMetrics"
  ], "H05");
  requireIncludes(initial, "laplacianObjects", ["domain_graph", "node_stalk", "edge_stalk", "restriction_matrix", "coboundary_delta", "delta_transpose_delta", "dirichlet_energy", "spectrum", "kernel_global_section", "diffusion_direction"], "H05");
  requireIncludes(initial, "diagnosticMetrics", ["sheaf_energy", "max_residual", "kernel_proximity", "stability_margin"], "H05");

  await page.locator("#scenario").selectOption("connection");
  await page.locator("#viewSelect").selectOption("blocks");
  await setRange(page, "#twistAmount", "0.82");
  await setRange(page, "#mapStrength", "1.18");
  await page.locator("#assembleDelta").click();
  await page.waitForFunction(() => window.__h05LabSnapshot().status === "Assembled");
  const assembled = await page.evaluate(() => window.__h05LabSnapshot());
  if (!/delta matrix|block rows|restriction maps/i.test(assembled.stateText) || assembled.energy <= 0) {
    throw new Error(`H05 assemble command is not concrete enough: ${JSON.stringify(assembled)}`);
  }
  requireChanged(initial, assembled, ["restrictionMapHash", "deltaMatrixHash", "laplacianBlockHash", "blockContributionHash", "connectionFrameHash"], "H05 assembled operator", 3);

  const beforeEnergy = assembled.energy;
  await page.locator("#diffuse").click();
  await page.waitForFunction((previous) => window.__h05LabSnapshot().status === "Diffused" && window.__h05LabSnapshot().energy < previous, beforeEnergy);
  const diffused = await page.evaluate(() => window.__h05LabSnapshot());
  if (!/Sheaf diffusion|L_F x|energy/i.test(diffused.stateText)) {
    throw new Error(`H05 diffusion command does not expose -L_F x: ${JSON.stringify(diffused)}`);
  }
  requireChanged(assembled, diffused, ["diffusionDirectionHash", "dirichletEnergyHash", "coboundaryDeltaHash"], "H05 diffusion direction", 2);

  await page.locator("#projectKernel").click();
  await page.waitForFunction(() => window.__h05LabSnapshot().status === "Projected");
  const projected = await page.evaluate(() => window.__h05LabSnapshot());
  if (projected.maxResidual > 0.25 || !/global-section|kernel of delta|kernel of L_F/i.test(projected.stateText)) {
    throw new Error(`H05 kernel projection does not expose global sections: ${JSON.stringify(projected)}`);
  }
  requireChanged(diffused, projected, ["kernelGlobalSectionHash", "projectionSheafHash", "coboundaryDeltaHash"], "H05 kernel projection", 2);

  await page.locator("#twist").click();
  await page.waitForFunction(() => window.__h05LabSnapshot().modeLabel === "Twisted");
  const twisted = await page.evaluate(() => window.__h05LabSnapshot());
  if (!/signed sheaf|opposite signs/i.test(twisted.stateText)) {
    throw new Error(`H05 signed twist is not explicit: ${JSON.stringify(twisted)}`);
  }
  requireChanged(projected, twisted, ["restrictionMapHash", "deltaMatrixHash", "connectionFrameHash"], "H05 signed twist", 1);
}

async function testH06(page) {
  const result = await loadLab(page, "h06-sheaf-diffusion.html", "__h06LabReady", "__h06LabSnapshot");
  requireFit(result, "H06 desktop");
  const initial = result.snapshot;
  if (result.bytes < 12000 || initial.clarityVersion !== CLARITY_VERSION || initial.labId !== "h06" || initial.has3d !== true) {
    throw new Error(`H06 canonical clarity contract failed: ${JSON.stringify(initial)}`);
  }
  requireMinimums(initial, {
    nodeStalkObjectCount: 4,
    edgeResidualObjectCount: 4,
    restrictionTransportObjectCount: 8,
    laplacianFlowObjectCount: 4,
    heatTraceObjectCount: 16,
    spectralModeObjectCount: 7,
    dampingEnvelopeObjectCount: 7,
    globalSectionLimitObjectCount: 4,
    signedEquilibriumObjectCount: 4,
    ordinaryDiffusionComparisonObjectCount: 4,
    stabilityStepObjectCount: 3,
    messagePullbackObjectCount: 4,
    normalizationObjectCount: 3
  }, "H06");
  requireFields(initial, [
    "nodeStalkHash",
    "edgeResidualHash",
    "restrictionTransportHash",
    "laplacianFlowHash",
    "heatTraceHash",
    "spectralModeHash",
    "dampingEnvelopeHash",
    "globalSectionLimitHash",
    "signedEquilibriumHash",
    "ordinaryDiffusionComparisonHash",
    "stabilityStepHash",
    "messagePullbackHash",
    "normalizationHash",
    "canonicalReferences",
    "diffusionObjects",
    "diagnosticMetrics"
  ], "H06");
  requireIncludes(initial, "diffusionObjects", ["sheaf_heat_equation", "edge_residual", "restriction_transport", "pullback_message", "spectral_damping", "global_section_limit", "signed_equilibrium", "stability_condition"], "H06");
  requireIncludes(initial, "diagnosticMetrics", ["energy", "max_residual", "spectral_damping", "visible_modes", "harmonic_mass", "stable_margin"], "H06");

  await page.locator("#sheafPreset").selectOption("signed");
  await page.locator("#viewSelect").selectOption("spectrum");
  await setRange(page, "#diffusionTime", "9");
  await setRange(page, "#spectralGap", "1.5");
  await setRange(page, "#noiseLevel", "0.48");
  await setRange(page, "#visibleModes", "6");
  await setRange(page, "#harmonicWeight", "0.74");
  const changed = await page.evaluate(() => window.__h06LabSnapshot());
  if (changed.visibleModeCount !== 6 || changed.spectralDamping <= initial.spectralDamping || !/signed|spectral/i.test(changed.stateText)) {
    throw new Error(`H06 controls did not expose signed spectral damping: ${JSON.stringify(changed)}`);
  }
  requireChanged(initial, changed, ["restrictionTransportHash", "spectralModeHash", "dampingEnvelopeHash", "signedEquilibriumHash", "ordinaryDiffusionComparisonHash"], "H06 signed spectrum controls", 3);

  const beforeEnergy = changed.energy;
  await page.locator("#runHeat").click();
  await page.waitForFunction((previous) => window.__h06LabSnapshot().status === "Heat step" && window.__h06LabSnapshot().energy < previous, beforeEnergy);
  const diffused = await page.evaluate(() => window.__h06LabSnapshot());
  if (!/-L_F x|exp\(-t L_F\)/i.test(diffused.stateText)) {
    throw new Error(`H06 heat step does not expose the heat semigroup: ${JSON.stringify(diffused)}`);
  }
  requireChanged(changed, diffused, ["laplacianFlowHash", "heatTraceHash", "dampingEnvelopeHash", "messagePullbackHash"], "H06 heat update", 2);

  const beforeResidual = diffused.maxResidual;
  await page.locator("#projectGlobal").click();
  await page.waitForFunction(() => window.__h06LabSnapshot().status === "Projected");
  const projected = await page.evaluate(() => window.__h06LabSnapshot());
  if (projected.maxResidual > beforeResidual || !/global section|ker L_F|edge residual/i.test(projected.stateText)) {
    throw new Error(`H06 projection does not land in the global-section limit: ${JSON.stringify(projected)}`);
  }
  requireChanged(diffused, projected, ["globalSectionLimitHash", "edgeResidualHash", "normalizationHash"], "H06 global projection", 2);
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 700 } });
  try {
    await testH05(page);
    await testH06(page);
    console.log("H05/H06 canonical clarity checks passed");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
