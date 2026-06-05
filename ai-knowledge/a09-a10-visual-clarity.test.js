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

async function loadLab(page, fileName, readyName, snapshotName) {
  const labPath = path.join(__dirname, fileName).replace(/\\/g, "/");
  await page.goto(`file:///${labPath}?clarity-regression=1`);
  await page.locator(".lab-viewport canvas").waitFor({ state: "visible" });
  await page.waitForFunction(
    ([ready, snapshot]) => window[ready] === true && typeof window[snapshot] === "function" && window[snapshot](),
    [readyName, snapshotName]
  );
  await page.waitForTimeout(280);
  return page.evaluate((snapshotName) => {
    const canvas = document.querySelector(".lab-viewport canvas");
    return {
      bytes: canvas.toDataURL("image/png").length,
      snapshot: window[snapshotName](),
      overlayText: [...document.querySelectorAll("[data-visual-key], .formula-chip, [data-role='insight'], .selected-chip")]
        .map((node) => node.textContent.trim())
        .join(" | "),
      buttons: [...document.querySelectorAll("button")].map((node) => node.textContent.trim()),
      rail: [...document.querySelectorAll(".concept-rail span:not(.rail-alias)")].map((node) => node.textContent.trim()),
      railAliases: [...document.querySelectorAll(".concept-rail span.rail-alias")].map((node) => node.textContent.trim()),
      overflowX: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
      overflowY: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight
    };
  }, snapshotName);
}

function requireIncludes(list, expected, lab) {
  for (const item of expected) {
    if (!list || !list.some((candidate) => String(candidate).toLowerCase().includes(item.toLowerCase()))) {
      throw new Error(`${lab} missing clarity marker "${item}". Found: ${(list || []).join(" | ")}`);
    }
  }
}

function requireFiniteNumbers(object, keys, lab) {
  for (const key of keys) {
    if (!Number.isFinite(object[key])) {
      throw new Error(`${lab} missing finite telemetry "${key}": ${JSON.stringify(object)}.`);
    }
  }
}

async function main() {
  const browser = await chromium.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: true
  });
  const page = await browser.newPage({ viewport: { width: 1180, height: 700 } });
  try {
    const a09 = await loadLab(page, "a09-category-theory-diagram-lab.html", "__a09LabReady", "__a09LabSnapshot");
    if (a09.bytes < 15500 || a09.overflowX > 18 || a09.overflowY > 18) {
      throw new Error(`A09 clarity render is weak or does not fit: ${JSON.stringify(a09)}.`);
    }
    if (a09.snapshot.clarityVersion !== "a09-a10-canonical-clarity-v1" || a09.snapshot.legacyClarityVersion !== "a09-a10-category-clarity-v2" || a09.snapshot.visualScaffoldCount < 16) {
      throw new Error(`A09 missing concrete category-theory scaffold: ${JSON.stringify(a09.snapshot)}.`);
    }
    requireIncludes(a09.snapshot.visualRoles, [
      "source category object layer",
      "identity loop on object",
      "composable arrows f and g",
      "composite arrow g o f",
      "associativity witness path",
      "hom-set shelf Hom(A,B)",
      "isomorphism inverse pair",
      "functor source-to-target copy beams",
      "target category image layer",
      "functor composition preservation tile",
      "naturality square eta components",
      "naturality route equality tracks",
      "poset Hasse diagram",
      "one-object monoid endomorphism wheel",
      "equivariance commuting square",
      "contravariant pullback arrow reversal",
      "sheaf restriction composition ladder"
    ], "A09");
    requireIncludes(a09.snapshot.clarityLabels, [
      "A",
      "B",
      "C",
      "1_A",
      "f",
      "g",
      "g o f",
      "Hom(A,B)",
      "F",
      "F(f)",
      "eta_A",
      "eta_B",
      "poset",
      "monoid",
      "iso",
      "equivariance",
      "restrict"
    ], "A09");
    requireIncludes(a09.rail, ["Objects/arrows", "Identity/composition", "Functor copy", "Naturality square", "Poset/monoid", "Equivariance/sheaf"], "A09 rail");
    requireIncludes(a09.railAliases, ["objects", "arrows", "composition", "functor image", "naturality square"], "A09 legacy rail");
    requireIncludes(a09.buttons, ["Show diagram laws", "Compose path"], "A09 buttons");
    if (!/Objects\/arrows|Identity\/composition|Functor copy|Naturality square|Poset\/monoid|Equivariance\/sheaf/i.test(a09.overlayText)) {
      throw new Error(`A09 overlay should name concrete category-theory objects, got: ${a09.overlayText}`);
    }
    requireFiniteNumbers(a09.snapshot, [
      "associativityResidual",
      "functorLawResidual",
      "naturalityGap",
      "homSetCount",
      "objectLayerCount",
      "posetThinness",
      "monoidEndomorphismCount",
      "equivarianceSquareGap",
      "restrictionCompositionGap"
    ], "A09 telemetry");
    if (
      a09.snapshot.identityLawCheck !== true ||
      !a09.snapshot.categoryDiagramHash ||
      !a09.snapshot.compositionEquationHash ||
      a09.snapshot.contravariantReversal !== true
    ) {
      throw new Error(`A09 should expose category-law diagnostics, got: ${JSON.stringify(a09.snapshot)}.`);
    }

    const a10 = await loadLab(page, "a10-category-limits-adjunctions-lab.html", "__a10LabReady", "__a10LabSnapshot");
    if (a10.bytes < 15500 || a10.overflowX > 18 || a10.overflowY > 18) {
      throw new Error(`A10 clarity render is weak or does not fit: ${JSON.stringify(a10)}.`);
    }
    if (a10.snapshot.clarityVersion !== "a09-a10-canonical-clarity-v1" || a10.snapshot.legacyClarityVersion !== "a09-a10-category-clarity-v2" || a10.snapshot.visualScaffoldCount < 20) {
      throw new Error(`A10 missing concrete advanced-category scaffold: ${JSON.stringify(a10.snapshot)}.`);
    }
    requireIncludes(a10.snapshot.visualRoles, [
      "product universal cone apex",
      "projection arrows pi_A pi_B",
      "mediating arrow unique factorization",
      "pullback compatible-pairs square",
      "equalizer agreement gate",
      "colimit cocone pushout gluing",
      "coproduct injection alternatives",
      "coequalizer quotient rail",
      "adjunction hom-set bijection bridge",
      "unit natural transformation eta",
      "counit evaluation epsilon",
      "triangular identity witness",
      "monad unit eta insert",
      "monad multiplication mu flatten",
      "free-forgetful construction pair",
      "Kan extension envelope along K",
      "left Kan colimit aggregation tray",
      "right Kan limit constraint tray",
      "sheaf local-to-global gluing cover",
      "universal defect gauge"
    ], "A10");
    requireIncludes(a10.snapshot.clarityLabels, [
      "L",
      "X",
      "A",
      "B",
      "pi_A",
      "pi_B",
      "<f,g>",
      "pullback",
      "equalizer",
      "pushout",
      "coproduct",
      "coeq",
      "F-|U",
      "eta",
      "epsilon",
      "T=UF",
      "mu:T^2->T",
      "Lan_K",
      "Ran_K",
      "sheaf glue",
      "unique"
    ], "A10");
    requireIncludes(a10.rail, ["Limit cone", "Colimit glue", "Adjunction bridge", "Monad flatten", "Kan extension", "Sheaf gluing"], "A10 rail");
    requireIncludes(a10.railAliases, ["limit cone", "universal arrow", "adjunction", "monad", "Kan extension"], "A10 legacy rail");
    requireIncludes(a10.buttons, ["Show universal role", "Factor/flatten"], "A10 buttons");
    if (!/Limit cone|Colimit glue|Adjunction bridge|Monad flatten|Kan extension|Sheaf gluing/i.test(a10.overlayText)) {
      throw new Error(`A10 overlay should name concrete advanced-category objects, got: ${a10.overlayText}`);
    }
    requireFiniteNumbers(a10.snapshot, [
      "coneDefect",
      "pullbackAgreement",
      "equalizerResidual",
      "homSetBijectionResidual",
      "unitCounitTriangleGap",
      "monadFlattenDepth",
      "monadCoherence",
      "kanExtensionCost",
      "sheafGlueCoherence",
      "universalDefect"
    ], "A10 telemetry");
    if (
      a10.snapshot.uniqueFactorization !== true ||
      !a10.snapshot.universalConeHash ||
      !a10.snapshot.pushoutGlueHash ||
      !a10.snapshot.leftRightKanModeHash
    ) {
      throw new Error(`A10 should expose universal-property diagnostics, got: ${JSON.stringify(a10.snapshot)}.`);
    }
  } finally {
    await browser.close();
  }
  console.log("a09-a10 visual clarity passed: category theory labs expose concrete diagrams, universal constructions, and fitted controls.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
