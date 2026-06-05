const assert = require("assert");
const fs = require("fs");
const path = require("path");

const scanner = require("./scan-vault-quality");

const interactiveRoot = __dirname;
const verifierSource = fs.readFileSync(
  path.join(interactiveRoot, "verify-interactive-links.js"),
  "utf8"
);

assert.strictEqual(
  scanner.detectBlock("A02 - Vectors, Spaces and Linear Maps.md"),
  "A"
);
assert.strictEqual(
  scanner.detectBlock("Block C- Optimization and Variational Calculus.md"),
  "C"
);
assert.strictEqual(scanner.detectBlock("00_HOME.md"), "Structural");
assert.strictEqual(scanner.detectBlock("Path - Research.md"), "Path");

const verifierChecks = scanner.parseVerifierChecks(verifierSource);
assert.strictEqual(verifierChecks.length, 113);
assert.ok(
  verifierChecks.some(
    (check) =>
      check.note === "A01- Linear Algebra Fundamentals.md" &&
      check.lab === "a01-linear-algebra-foundations-lab.html"
  )
);
assert.ok(
  verifierChecks.some(
    (check) =>
      check.note === "A04- Real Analysis and Measure Theory.md" &&
      check.lab === "a04-measure-convergence-lab.html"
  )
);
assert.ok(
  verifierChecks.some(
    (check) =>
      check.note === "A05- Functional Analysis.md" &&
      check.lab === "a05-functional-analysis-operator-lab.html"
  )
);
assert.ok(
  verifierChecks.some(
    (check) =>
      check.note === "A06- Topology Basics.md" &&
      check.lab === "a06-topology-neighborhood-lab.html"
  )
);
assert.ok(
  verifierChecks.some(
    (check) =>
      check.note === "A07- Differential Geometry.md" &&
      check.lab === "a07-measure-integration.html"
  )
);
assert.ok(
  verifierChecks.some(
    (check) =>
      check.note === "A09- Category Theory Basics.md" &&
      check.lab === "a09-category-theory-diagram-lab.html"
  )
);
assert.ok(
  verifierChecks.some(
    (check) =>
      check.note === "C05- Calculus of Variations.md" &&
      check.lab === "c05-euler-lagrange-action-lab.html"
  )
);
assert.ok(
  verifierChecks.some(
    (check) =>
      check.note === "F01- Graph Theory and Spectral Algebra Fundamentals.md" &&
      check.lab === "f01-graph-spectral-algebra-lab.html"
  )
);
assert.ok(
  verifierChecks.some(
    (check) =>
      check.note === "F02 - Algebraic Graph Theory.md" &&
      check.lab === "f02-algebraic-graph-matrices.html"
  )
);
assert.ok(
  verifierChecks.some(
    (check) =>
      check.note === "F05 - Graph Clustering.md" &&
      check.lab === "f05-graph-clustering-lab.html"
  )
);
assert.ok(
  verifierChecks.some(
    (check) =>
      check.note === "H01- Introduction to Sheaf Theory.md" &&
      check.lab === "h01-introduction-sheaf-theory-lab.html"
  )
);
assert.ok(
  verifierChecks.some(
    (check) =>
      check.note === "H07 - Sheaf Neural Networks.md" &&
      check.lab === "h07-sheaf-neural-networks-lab.html"
  )
);
assert.ok(
  verifierChecks.some(
    (check) =>
      check.note === "E01- Neural Network Foundations.md" &&
      check.lab === "e01-mlp-decision-regions.html"
  )
);
assert.ok(
  verifierChecks.some(
    (check) =>
      check.note === "A11- Information Theory.md" &&
      check.lab === "a11-information-theory-lab.html"
  )
);
assert.ok(
  verifierChecks.some(
    (check) =>
      check.note === "A12- Algebraic Topology.md" &&
      check.lab === "a12-algebraic-topology-lab.html"
  )
);
assert.ok(
  verifierChecks.some(
    (check) =>
      check.note === "A13- Differential Equations.md" &&
      check.lab === "a13-differential-equations-flow-lab.html"
  )
);
assert.ok(
  verifierChecks.some(
    (check) =>
      check.note === "A15- Numerical Methods.md" &&
      check.lab === "a15-numerical-methods-stability-lab.html"
  )
);
assert.ok(
  verifierChecks.some(
    (check) =>
      check.note === "B01- Probability Theory Foundations.md" &&
      check.lab === "b01-probability-foundations-lab.html"
  )
);
assert.ok(
  verifierChecks.some(
    (check) =>
      check.note === "B02- Multivariate Probability.md" &&
      check.lab === "b02-multivariate-probability-lab.html"
  )
);
assert.ok(
  verifierChecks.some(
    (check) =>
      check.note === "B04- Hypothesis Testing.md" &&
      check.lab === "b04-hypothesis-testing-lab.html"
  )
);
assert.ok(
  verifierChecks.some(
    (check) =>
      check.note === "B07- Advanced Stochastic Calculus.md" &&
      check.lab === "b07-advanced-stochastic-calculus-lab.html"
  )
);
assert.ok(
  verifierChecks.some(
    (check) =>
      check.note === "B08- Information Geometry.md" &&
      check.lab === "b08-information-geometry-lab.html"
  )
);
assert.ok(
  verifierChecks.some(
    (check) =>
      check.note === "B09- Non-parametric Statistics.md" &&
      check.lab === "b09-nonparametric-statistics-lab.html"
  )
);
assert.ok(
  verifierChecks.some(
    (check) =>
      check.note === "B10- Causal Inference.md" &&
      check.lab === "b10-causal-inference-lab.html"
  )
);
assert.ok(
  verifierChecks.some(
    (check) =>
      check.note === "C01- Convex Analysis.md" &&
      check.lab === "c01-convex-analysis-lab.html"
  )
);
assert.ok(
  verifierChecks.some(
    (check) =>
      check.note === "C04- Stochastic Optimization.md" &&
      check.lab === "c04-stochastic-optimization-lab.html"
  )
);
assert.ok(
  verifierChecks.some(
    (check) =>
      check.note === "C06- Optimal Control Theory.md" &&
      check.lab === "c06-optimal-control-lab.html"
  )
);
assert.ok(
  verifierChecks.some(
    (check) =>
      check.note === "C07- Duality Theory.md" &&
      check.lab === "c07-duality-theory-lab.html"
  )
);
assert.ok(
  verifierChecks.some(
    (check) =>
      check.note === "C08- Proximal Methods.md" &&
      check.lab === "c08-proximal-methods-lab.html"
  )
);
assert.ok(
  verifierChecks.some(
    (check) =>
      check.note === "C09- Non-convex Optimization.md" &&
      check.lab === "c09-nonconvex-optimization-lab.html"
  )
);
assert.ok(
  verifierChecks.some(
    (check) =>
      check.note === "C10- Optimal Transport.md" &&
      check.lab === "c10-optimal-transport-lab.html"
  )
);
assert.ok(
  verifierChecks.some(
    (check) =>
      check.note === "D01- Linear Models.md" &&
      check.lab === "d01-linear-models-lab.html"
  )
);
assert.ok(
  verifierChecks.some(
    (check) =>
      check.note === "D02- Support Vector Machines.md" &&
      check.lab === "d02-svm-margin-kernel-lab.html"
  )
);
assert.ok(
  verifierChecks.some(
    (check) =>
      check.note === "D03- Tree-Based Models.md" &&
      check.lab === "d03-tree-models-lab.html"
  )
);
assert.ok(
  verifierChecks.some(
    (check) =>
      check.note === "D04- Dimensionality Reduction.md" &&
      check.lab === "d04-dimensionality-reduction-lab.html"
  )
);
assert.ok(
  verifierChecks.some(
    (check) =>
      check.note === "D05- Clustering Algorithms.md" &&
      check.lab === "d05-clustering-algorithms-lab.html"
  )
);
assert.ok(
  verifierChecks.some(
    (check) =>
      check.note === "D06- Ensemble Methods.md" &&
      check.lab === "d06-ensemble-methods-lab.html"
  )
);
assert.ok(
  verifierChecks.some(
    (check) =>
      check.note === "D07- Metric Learning.md" &&
      check.lab === "d07-metric-learning-lab.html"
  )
);
assert.ok(
  verifierChecks.some(
    (check) =>
      check.note === "D08- Learning Theory.md" &&
      check.lab === "d08-learning-theory-lab.html"
  )
);
assert.ok(
  verifierChecks.some(
    (check) =>
      check.note === "D09- Regularization Techniques.md" &&
      check.lab === "d09-regularization-lab.html"
  )
);
assert.ok(
  verifierChecks.some(
    (check) =>
      check.note === "D10- Model Selection and Evaluation.md" &&
      check.lab === "d10-model-selection-evaluation-lab.html"
  )
);
assert.ok(
  verifierChecks.some(
    (check) =>
      check.note === "G04 - GraphSAGE and Inductive Learning.md" &&
      check.lab === "g04-graphsage-sampling-lab.html"
  )
);
assert.ok(
  verifierChecks.some(
    (check) =>
      check.note === "G30- Heterophilic Graph Neural Networks.md" &&
      check.lab === "g30-heterophilic-gnn-lab.html"
  )
);
assert.ok(
  verifierChecks.some(
    (check) =>
      check.note === "G32- AI Foundations.md" &&
      check.lab === "g32-ai-foundations-lab.html"
  )
);

const model = scanner.buildCoverageModel({ writeFiles: false });
assert.ok(model.summary.totalNotes >= 90);
assert.strictEqual(model.summary.interactiveLabs, verifierChecks.length);
assert.strictEqual(
  model.summary.uncoveredNotes + model.summary.interactiveLabs,
  model.summary.learningModuleNotes
);
assert.ok(model.byBlock.A.total >= 10);
assert.ok(model.byBlock.B.labs >= 2);
assert.ok(model.byBlock.C.labs >= 2);
assert.ok(model.byBlock.E.labs >= 4);
assert.ok(Array.isArray(model.qualityFlags));
assert.strictEqual(model.prioritizedBacklog.length, model.summary.uncoveredNotes);
if (model.prioritizedBacklog.length > 0) {
  assert.ok(model.prioritizedBacklog[0].note.endsWith(".md"));
  assert.ok(model.prioritizedBacklog[0].labIdea.length > 20);
}

const markdown = scanner.renderCoverageMarkdown(model);
assert.ok(markdown.includes("# Interactive Coverage Map"));
assert.ok(markdown.includes("## Existing Interactive Labs"));
assert.ok(markdown.includes("## Next Interactive Lab Backlog"));

console.log("scan-vault-quality tests passed.");
