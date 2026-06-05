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
  await page.waitForTimeout(320);
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

async function setRange(page, selector, value) {
  await page.locator(selector).evaluate((input, nextValue) => {
    input.value = String(nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
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
    const b04 = await loadLab(page, "b04-hypothesis-testing-lab.html", "__b04LabReady", "__b04LabSnapshot");
    if (b04.bytes < 15000 || b04.overflowX > 18 || b04.overflowY > 18) {
      throw new Error(`B04 clarity render is weak or does not fit: ${JSON.stringify(b04)}.`);
    }
    if (b04.snapshot.clarityVersion !== "b04-b05-canonical-clarity-v2" || b04.snapshot.legacyClarityVersion !== "b04-b05-canonical-clarity-v1" || b04.snapshot.visualScaffoldCount < 28) {
      throw new Error(`B04 missing canonical hypothesis-testing scaffold: ${JSON.stringify(b04.snapshot)}.`);
    }
    requireIncludes(b04.snapshot.visualRoles, [
      "null distribution H0 bell curve",
      "alternative distribution H1 shifted bell curve",
      "observed test statistic t_obs marker",
      "critical value threshold wall",
      "alpha rejection region tail under H0",
      "p-value observed tail under H0",
      "Type I error alpha gauge",
      "Type II error beta area under H1",
      "power area one minus beta",
      "effect size shift arrow",
      "sample size standard error shrinker",
      "confidence interval test bridge",
      "decision table Type I Type II board",
      "one-sided two-sided tail splitter",
      "coin bias binomial count plate",
      "paired differences D_i strip",
      "permutation null shuffle board",
      "multiple testing family grid",
      "Bonferroni alpha ladder",
      "FDR ordered p-value staircase",
      "practical significance effect ruler"
    ], "B04");
    requireIncludes(b04.snapshot.clarityLabels, [
      "H0", "H1", "T(x)", "t_obs", "alpha", "p-value", "critical value", "reject H0", "fail to reject",
      "Type I", "Type II beta", "Power=1-beta", "effect size", "n", "SE", "CI",
      "D_i", "permutation", "m tests", "Bonferroni", "FDR", "practical delta", "X~Bin(n,.5)"
    ], "B04");
    requireIncludes(b04.rail, ["Null distribution", "Test statistic", "p-value tail", "Alpha decision", "Power / beta", "Multiple testing"], "B04 rail");
    requireIncludes(b04.railAliases, ["null model", "test statistic", "p-value tail", "rejection region", "power curve"], "B04 legacy rail");
    requireIncludes(b04.buttons, ["Read p-value tail", "Shift effect"], "B04 buttons");
    requireFiniteNumbers(b04.snapshot, [
      "pValue", "power", "typeIRisk", "effectSize", "alphaLevel", "criticalValue", "observedStatistic",
      "standardError", "betaRisk", "rejectionWidth", "pTailMass", "sampleSize", "falseDiscoveryRisk",
      "bonferroniAlpha", "fdrThreshold", "confidenceIntervalLow", "confidenceIntervalHigh",
      "practicalSignificanceGap", "permutationPValue", "pairedGain"
    ], "B04 telemetry");
    if (!b04.snapshot.hypothesisSceneHash || !b04.snapshot.pValueTailHash || !b04.snapshot.powerDecisionHash || !b04.snapshot.multipleTestingHash || b04.snapshot.decisionConsistent !== true) {
      throw new Error(`B04 should expose p-value/power/multiple-testing diagnostics, got: ${JSON.stringify(b04.snapshot)}.`);
    }
    const b04HashBefore = b04.snapshot.hypothesisSceneHash;
    await setRange(page, "#b04-focus", "0.82");
    await setRange(page, "#b04-samples", "13");
    await setRange(page, "#b04-strength", "0.9");
    await page.waitForTimeout(160);
    const b04After = await page.evaluate(() => window.__b04LabSnapshot());
    if (b04After.hypothesisSceneHash === b04HashBefore || b04After.power <= b04.snapshot.power || b04After.pValue >= b04.snapshot.pValue) {
      throw new Error(`B04 controls did not visibly alter hypothesis diagnostics: ${JSON.stringify({ before: b04.snapshot, after: b04After })}.`);
    }

    const b05 = await loadLab(page, "b05-bayesian-updating.html", "__b05LabReady", "__b05LabSnapshot");
    if (b05.bytes < 15000 || b05.overflowX > 18 || b05.overflowY > 18) {
      throw new Error(`B05 clarity render is weak or does not fit: ${JSON.stringify(b05)}.`);
    }
    if (b05.snapshot.clarityVersion !== "b04-b05-canonical-clarity-v2" || b05.snapshot.legacyClarityVersion !== "b04-b05-canonical-clarity-v1" || b05.snapshot.visualScaffoldCount < 30) {
      throw new Error(`B05 missing canonical Bayesian scaffold: ${JSON.stringify(b05.snapshot)}.`);
    }
    requireIncludes(b05.snapshot.visualRoles, [
      "Beta prior density p theta curve",
      "Bernoulli likelihood p D given theta curve",
      "posterior density p theta given D curve",
      "evidence normalizer integral tray",
      "prior likelihood multiplication board",
      "Beta alpha beta pseudo-count tanks",
      "observed heads tails data beads",
      "conjugate update alpha plus h beta plus t arrows",
      "posterior mean marker",
      "MAP posterior mode marker",
      "MLE likelihood peak marker",
      "credible interval posterior band",
      "posterior predictive next observation coin",
      "rare disease base-rate tree",
      "sensitivity false-positive likelihood bars",
      "posterior odds Bayes factor scale",
      "MCMC posterior sample trace",
      "variational q_phi approximation curve",
      "ELBO reconstruction KL balance",
      "Laplace Gaussian around MAP",
      "posterior predictive check replica beads"
    ], "B05");
    requireIncludes(b05.snapshot.clarityLabels, [
      "p(theta)", "p(D|theta)", "p(theta|D)", "p(D)", "prior x likelihood", "Beta(alpha,beta)",
      "h", "t", "alpha+h", "beta+t", "theta", "E[theta|D]", "MAP", "MLE", "95% credible",
      "posterior predictive", "base rate", "sensitivity", "false positive", "BF", "MCMC", "q_phi(theta)", "ELBO", "Laplace", "PPC"
    ], "B05");
    requireIncludes(b05.rail, ["Prior", "Likelihood", "Evidence normalizer", "Posterior", "Predictive check", "Approximation"], "B05 rail");
    requireIncludes(b05.railAliases, ["prior belief", "likelihood evidence", "posterior mass", "predictive band", "Bayes update"], "B05 legacy rail");
    requireIncludes(b05.buttons, ["Multiply Bayes", "Predict next"], "B05 buttons");
    requireFiniteNumbers(b05.snapshot, [
      "posteriorMean", "posteriorPrecision", "bayesFactor", "credibleWidth", "priorAlpha", "priorBeta",
      "heads", "tails", "posteriorAlpha", "posteriorBeta", "evidenceNormalizer", "posteriorMode",
      "mleTheta", "credibleLow", "credibleHigh", "predictiveProbability", "priorInfluence",
      "likelihoodInfluence", "mcmcEffectiveSamples", "variationalGap", "laplaceCurvature",
      "posteriorCheckDiscrepancy", "baseRatePosterior"
    ], "B05 telemetry");
    if (!b05.snapshot.bayesianSceneHash || !b05.snapshot.conjugateUpdateHash || !b05.snapshot.predictiveHash || !b05.snapshot.approximationHash || b05.snapshot.posteriorNormalized !== true) {
      throw new Error(`B05 should expose Bayesian update diagnostics, got: ${JSON.stringify(b05.snapshot)}.`);
    }
    const b05HashBefore = b05.snapshot.bayesianSceneHash;
    await setRange(page, "#b05-focus", "0.76");
    await setRange(page, "#b05-samples", "13");
    await setRange(page, "#b05-strength", "0.88");
    await page.waitForTimeout(160);
    const b05After = await page.evaluate(() => window.__b05LabSnapshot());
    if (b05After.bayesianSceneHash === b05HashBefore || b05After.posteriorPrecision <= b05.snapshot.posteriorPrecision || b05After.credibleWidth >= b05.snapshot.credibleWidth) {
      throw new Error(`B05 controls did not visibly alter Bayesian diagnostics: ${JSON.stringify({ before: b05.snapshot, after: b05After })}.`);
    }
  } finally {
    await browser.close();
  }
  console.log("b04-b05 visual clarity passed: hypothesis testing and Bayesian inference expose canonical textbook objects, fitted controls, and live diagnostics.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
