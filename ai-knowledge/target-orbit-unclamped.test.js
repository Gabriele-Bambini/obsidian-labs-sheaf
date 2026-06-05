const fs = require("fs");
const path = require("path");

const root = __dirname;
const targetLabs = [
  "a05-functional-analysis-operator-lab.html",
  "a06-topology-neighborhood-lab.html",
  "a07-measure-integration.html",
  "a08-algebra-structure-lab.html",
  "a09-category-theory-diagram-lab.html",
  "a11-information-theory-lab.html",
  "a12-algebraic-topology-lab.html",
  "a13-differential-equations-flow-lab.html",
  "a14-complex-contour-residue-lab.html",
  "a15-numerical-methods-stability-lab.html",
  "b01-probability-foundations-lab.html",
  "b02-multivariate-probability-lab.html",
  "b03-estimator-likelihood-lab.html",
  "b04-hypothesis-testing-lab.html",
  "b07-advanced-stochastic-calculus-lab.html",
  "b08-information-geometry-lab.html",
  "b09-nonparametric-statistics-lab.html",
  "b10-causal-inference-lab.html",
  "c01-convex-analysis-lab.html",
  "c04-stochastic-optimization-lab.html",
  "c07-duality-theory-lab.html",
  "c08-proximal-methods-lab.html",
  "d07-metric-learning-lab.html",
  "e01-mlp-decision-regions.html",
  "e02-backprop-computational-graph.html",
  "e03-convolution-kernel-lab.html",
  "e04-rnn-hidden-state-lab.html",
  "e05-attention-flow.html",
  "e06-llm-token-prediction.html",
  "e07-vae-latent-space-lab.html",
  "e08-gan-minimax-game.html",
  "e09-diffusion-denoising.html"
];

const forbidden = [
  /(?:orbit|view|camera|state)\.phi\s*=\s*clamp\(/,
  /(?:orbit|view|camera|state)\.phi\s*=\s*Math\.(?:min|max)\(/,
  /cameraPhi\s*=\s*clamp\(/,
  /cameraPhi\s*=\s*Math\.(?:min|max)\(/,
  /camera\.phi\s*=\s*Math\.(?:min|max)\(/
];

const failures = [];
for (const lab of targetLabs) {
  const source = fs.readFileSync(path.join(root, lab), "utf8");
  const lines = source.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (forbidden.some((pattern) => pattern.test(line))) {
      failures.push(`${lab}:${index + 1}: ${line.trim()}`);
    }
  });
}

if (failures.length) {
  console.error(failures.join("\n"));
  throw new Error("Target lab vertical orbit is still clamped.");
}

console.log(`target-orbit-unclamped passed for ${targetLabs.length} labs.`);
