const fs = require("fs");
const path = require("path");

const vaultRoot = path.resolve(__dirname, "..", "..");
const knowledgeRoot = path.join(vaultRoot, "AI Knowledge");
const interactiveRoot = path.join(knowledgeRoot, "_interactive");

const checks = [
  {
    note: "A01- Linear Algebra Fundamentals.md",
    lab: "a01-linear-algebra-foundations-lab.html",
    required: ["<title>", "lab-shell", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "A02 - Vectors, Spaces and Linear Maps.md",
    lab: "a02-linear-map-grid.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "A03- Multivariable Calculus.md",
    lab: "a03-eigen-quadratic-form.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "A04- Real Analysis and Measure Theory.md",
    lab: "a04-measure-convergence-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "A05- Functional Analysis.md",
    lab: "a05-functional-analysis-operator-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "A06- Topology Basics.md",
    lab: "a06-topology-neighborhood-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "A07- Differential Geometry.md",
    lab: "a07-measure-integration.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "A08- Abstract Algebra Fundamentals.md",
    lab: "a08-algebra-structure-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "A09- Category Theory Basics.md",
    lab: "a09-category-theory-diagram-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "A10- Advanced Category Theory.md",
    lab: "a10-category-limits-adjunctions-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "A11- Information Theory.md",
    lab: "a11-information-theory-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "A12- Algebraic Topology.md",
    lab: "a12-algebraic-topology-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "A13- Differential Equations.md",
    lab: "a13-differential-equations-flow-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "A14- Complex Analysis.md",
    lab: "a14-complex-contour-residue-lab.html",
    required: ["<title>", "lab-shell", "stage", "controls", "state-box"]
  },
  {
    note: "A15- Numerical Methods.md",
    lab: "a15-numerical-methods-stability-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "B01- Probability Theory Foundations.md",
    lab: "b01-probability-foundations-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "B02- Multivariate Probability.md",
    lab: "b02-multivariate-probability-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "B03- Statistical Estimation.md",
    lab: "b03-estimator-likelihood-lab.html",
    required: ["<title>", "lab-shell", "stage", "controls", "state-box"]
  },
  {
    note: "B04- Hypothesis Testing.md",
    lab: "b04-hypothesis-testing-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "B05- Bayesian Inference.md",
    lab: "b05-bayesian-updating.html",
    required: ["<title>", "lab-shell", "stage", "controls", "state-box"]
  },
  {
    note: "B06- Stochastic Processes.md",
    lab: "b06-markov-chain-lab.html",
    required: ["<title>", "lab-shell", "stage", "controls", "state-box"]
  },
  {
    note: "B07- Advanced Stochastic Calculus.md",
    lab: "b07-advanced-stochastic-calculus-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "B08- Information Geometry.md",
    lab: "b08-information-geometry-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "B09- Non-parametric Statistics.md",
    lab: "b09-nonparametric-statistics-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "B10- Causal Inference.md",
    lab: "b10-causal-inference-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "C01- Convex Analysis.md",
    lab: "c01-convex-analysis-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "C02- Unconstrained Optimization.md",
    lab: "c02-optimization-landscape.html",
    required: ["<title>", "lab-shell", "stage", "controls", "state-box"]
  },
  {
    note: "C03- Constrained Optimization.md",
    lab: "c03-constrained-optimization.html",
    required: ["<title>", "lab-shell", "stage", "controls", "state-box"]
  },
  {
    note: "C04- Stochastic Optimization.md",
    lab: "c04-stochastic-optimization-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "C05- Calculus of Variations.md",
    lab: "c05-euler-lagrange-action-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "C06- Optimal Control Theory.md",
    lab: "c06-optimal-control-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "C07- Duality Theory.md",
    lab: "c07-duality-theory-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "C08- Proximal Methods.md",
    lab: "c08-proximal-methods-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "C09- Non-convex Optimization.md",
    lab: "c09-nonconvex-optimization-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "C10- Optimal Transport.md",
    lab: "c10-optimal-transport-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "D01- Linear Models.md",
    lab: "d01-linear-models-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "D02- Support Vector Machines.md",
    lab: "d02-svm-margin-kernel-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "D03- Tree-Based Models.md",
    lab: "d03-tree-models-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "D04- Dimensionality Reduction.md",
    lab: "d04-dimensionality-reduction-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "D05- Clustering Algorithms.md",
    lab: "d05-clustering-algorithms-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "D06- Ensemble Methods.md",
    lab: "d06-ensemble-methods-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "D07- Metric Learning.md",
    lab: "d07-metric-learning-lab.html",
    required: ["<title>", "lab-shell", "stage", "controls", "state-box"]
  },
  {
    note: "D08- Learning Theory.md",
    lab: "d08-learning-theory-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "D09- Regularization Techniques.md",
    lab: "d09-regularization-lab.html",
    required: ["<title>", "lab-shell", "stage", "controls", "state-box"]
  },
  {
    note: "D10- Model Selection and Evaluation.md",
    lab: "d10-model-selection-evaluation-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "E03- Convolutional Neural Networks (CNNs).md",
    lab: "e03-convolution-kernel-lab.html",
    required: ["<title>", "lab-shell", "stage", "controls", "state-box"]
  },
  {
    note: "E04- Recurrent Neural Networks (RNNs).md",
    lab: "e04-rnn-hidden-state-lab.html",
    required: ["<title>", "lab-shell", "stage", "controls", "state-box"]
  },
  {
    note: "E07- Variational Autoencoders (VAEs).md",
    lab: "e07-vae-latent-space-lab.html",
    required: ["<title>", "lab-shell", "stage", "controls", "state-box"]
  },
  {
    note: "E08- Generative Adversarial Networks (GANs).md",
    lab: "e08-gan-minimax-game.html",
    required: ["<title>", "lab-shell", "stage", "controls", "state-box"]
  },
  {
    note: "E10- Normalizing Flows.md",
    lab: "e10-normalizing-flow-density.html",
    required: ["<title>", "lab-shell", "stage", "controls", "state-box"]
  },
  {
    note: "E11- Reinforcement Learning Foundations.md",
    lab: "e11-gridworld-bellman-lab.html",
    required: ["<title>", "lab-shell", "stage", "controls", "state-box"]
  },
  {
    note: "E12- Deep Reinforcement Learning.md",
    lab: "e12-dqn-target-update-lab.html",
    required: ["<title>", "lab-shell", "stage", "controls", "state-box"]
  },
  {
    note: "E13- Meta-Learning.md",
    lab: "e13-meta-learning-inner-loop.html",
    required: ["<title>", "lab-shell", "stage", "controls", "state-box"]
  },
  {
    note: "E14- Self-Supervised Learning.md",
    lab: "e14-contrastive-representation-lab.html",
    required: ["<title>", "lab-shell", "stage", "controls", "state-box"]
  },
  {
    note: "E15- Neural ODEs.md",
    lab: "e15-neural-ode-flow.html",
    required: ["<title>", "lab-shell", "stage", "controls", "state-box"]
  },
  {
    note: "E16- Energy-Based Models.md",
    lab: "e16-energy-langevin-lab.html",
    required: ["<title>", "lab-shell", "stage", "controls", "state-box"]
  },
  {
    note: "E18- Physics-Informed Neural Networks (PINNs).md",
    lab: "e18-pinn-residual-lab.html",
    required: ["<title>", "lab-shell", "stage", "controls", "state-box"]
  },
  {
    note: "E01- Neural Network Foundations.md",
    lab: "e01-mlp-decision-regions.html",
    required: ["<title>", "lab-shell", "stage", "controls", "state-box"]
  },
  {
    note: "E02- Backpropagation and Automatic Differentiation.md",
    lab: "e02-backprop-computational-graph.html",
    required: ["<title>", "lab-shell", "stage", "controls", "state-box"]
  },
  {
    note: "E05- Attention Mechanisms and Transformers.md",
    lab: "e05-attention-flow.html",
    required: ["<title>", "lab-shell", "stage", "controls", "state-box"]
  },
  {
    note: "E09- Diffusion Models.md",
    lab: "e09-diffusion-denoising.html",
    required: ["<title>", "lab-shell", "stage", "controls", "state-box"]
  },
  {
    note: "E17- State Space Models (SSMs).md",
    lab: "e17-ssm-scan.html",
    required: ["<title>", "lab-shell", "stage", "controls", "state-box"]
  },
  {
    note: "F01- Graph Theory and Spectral Algebra Fundamentals.md",
    lab: "f01-graph-spectral-algebra-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "F02 - Algebraic Graph Theory.md",
    lab: "f02-algebraic-graph-matrices.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "F03 - Graph Laplacians.md",
    lab: "f03-graph-laplacian-energy.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "F04 - Spectral Graph Theory.md",
    lab: "f04-spectral-embedding.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "F05 - Graph Clustering.md",
    lab: "f05-graph-clustering-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "F07 - Graph Signal Processing (GSP).md",
    lab: "f07-graph-signal-filtering.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "F08 - Network Science.md",
    lab: "f08-network-centrality-communities.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "F09 - Hypergraphs.md",
    lab: "f09-hypergraph-incidence-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "F10 - Topological Data Analysis (TDA).md",
    lab: "f10-persistent-homology-filtration.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "F11 - Discrete Calculus on Graphs.md",
    lab: "f11-discrete-calculus-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "F12 - Graph Limits (Graphons).md",
    lab: "f12-graphon-sampling-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "F06 - Random Graphs.md",
    lab: "f06-random-graph-models-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "G09 - Temporal GNNs.md",
    lab: "g09-temporal-gnn-memory-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "G11 - Geometric Deep Learning.md",
    lab: "g11-geometric-domain-symmetry-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "G12 - GNNs for Molecules.md",
    lab: "g12-molecular-message-passing-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "G13 - GNNs for Knowledge Graphs.md",
    lab: "g13-knowledge-graph-relations-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "G14 - Robustness and Adversarial Attacks on GNNs.md",
    lab: "g14-gnn-adversarial-perturbation-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "G15 - Over-Smoothing and Bottlenecks in GNNs.md",
    lab: "g15-over-smoothing-depth-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "G30- Heterophilic Graph Neural Networks.md",
    lab: "g30-heterophilic-gnn-lab.html",
    required: ["<title>", "lab-shell", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "G32- AI Foundations.md",
    lab: "g32-ai-foundations-lab.html",
    required: ["<title>", "lab-shell", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "H01- Introduction to Sheaf Theory.md",
    lab: "h01-introduction-sheaf-theory-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "H02 - Sheaves on Topological Spaces.md",
    lab: "h02-sheaf-gluing-lab.html",
    required: ["<title>", "lab-shell", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "H04 - Cellular Sheaves on Graphs.md",
    lab: "h04-cellular-sheaf-on-graph-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "H07 - Sheaf Neural Networks.md",
    lab: "h07-sheaf-neural-networks-lab.html",
    required: ["<title>", "lab-shell", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "H08 - Neural Sheaf Diffusion.md",
    lab: "h08-neural-sheaf-diffusion-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "H10 - Sheaves and Heterophily.md",
    lab: "h10-heterophily-restriction-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "H09 - Sheaf GNNs with Connection Laplacians.md",
    lab: "h09-connection-laplacian-transport-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "H11 - Sheaf Theory and Gauge Theory.md",
    lab: "h11-sheaf-gauge-transformation-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "H13 - Directed Sheaves and Sheaves on Hypergraphs.md",
    lab: "h13-directed-hypergraph-sheaf-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "H14 - Sheaves and Persistent Topology.md",
    lab: "h14-persistent-sheaf-topology-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "H15 - Research Frontier in Sheaf GNNs.md",
    lab: "h15-sheaf-research-frontier-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "H12 - Applications of Sheaf GNNs.md",
    lab: "h12-sheaf-applications-domain-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "G01- Introduction to Graph Neural Networks.md",
    lab: "g01-message-passing-playground.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "G02 - Graph Convolutional Networks.md",
    lab: "g02-gcn-message-passing.html",
    required: ["<title>", "lab-shell", "stage", "controls", "state-box"]
  },
  {
    note: "G04 - GraphSAGE and Inductive Learning.md",
    lab: "g04-graphsage-sampling-lab.html",
    required: ["<title>", "lab-shell", "stage", "controls", "state-box"]
  },
  {
    note: "G05 - The Weisfeiler-Leman Test.md",
    lab: "g05-wl-color-refinement-lab.html",
    required: ["<title>", "lab-shell", "stage", "controls", "state-box"]
  },
  {
    note: "G03 - Graph Attention Networks.md",
    lab: "g03-graph-attention-coefficients-lab.html",
    required: ["<title>", "lab-shell", "stage", "controls", "state-box"]
  },
  {
    note: "G06 - Higher-Order GNNs.md",
    lab: "g06-higher-order-gnn-lab.html",
    required: ["<title>", "lab-shell", "stage", "controls", "state-box"]
  },
  {
    note: "G07 - GNNs for Link Prediction and Graph Classification.md",
    lab: "g07-link-graph-readout-lab.html",
    required: ["<title>", "lab-shell", "stage", "controls", "state-box"]
  },
  {
    note: "G08 - Scalable GNNs.md",
    lab: "g08-scalable-gnn-sampling-lab.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "G10 - Equivariance and Invariance in GNNs.md",
    lab: "g10-equivariance-transform-lab.html",
    required: ["<title>", "lab-shell", "stage", "controls", "state-box"]
  },
  {
    note: "H05 - The Sheaf Laplacian.md",
    lab: "h05-sheaf-laplacian-builder.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "H03 - Cellular Sheaves and Cohomology.md",
    lab: "h03-cellular-sheaf-cohomology.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "H06 - Sheaf Diffusion.md",
    lab: "h06-sheaf-diffusion.html",
    required: ["<title>", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "I01- Quantum Mechanics Foundations.md",
    lab: "i01-quantum-state-measurement.html",
    required: ["<title>", "lab-shell", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "I02 - Qubits, Quantum Gates and Circuits.md",
    lab: "i02-qubit-bloch-sphere.html",
    required: ["<title>", "lab-shell", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "I03 - Fundamental Quantum Algorithms.md",
    lab: "i03-quantum-algorithm-interference-lab.html",
    required: ["<title>", "lab-shell", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "I04 - Quantum Machine Learning.md",
    lab: "i04-variational-quantum-circuit-lab.html",
    required: ["<title>", "lab-shell", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "I05 - Quantum Graph Neural Networks.md",
    lab: "i05-quantum-graph-circuit-lab.html",
    required: ["<title>", "lab-shell", "lab-3d-shell", "lab-viewport", "controls", "state-box"]
  },
  {
    note: "I06 - Quantum Advantage and Computational Limits.md",
    lab: "i06-quantum-advantage-boundary-lab.html",
    required: ["<title>", "lab-shell", "stage", "controls", "state-box"]
  },
  {
    note: "E06- Large Language Models (LLMs).md",
    lab: "e06-llm-token-prediction.html",
    required: ["<title>", "lab-shell", "stage", "controls", "state-box"]
  }
];

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasIframeForLab(note, lab) {
  const labPath = escapeRegex(lab);
  const iframeSrcPattern = `(?:(?:\\./)?_interactive/${labPath}|file:[^"'\\s>]*_interactive/${labPath}|https?:\\/\\/127\\.0\\.0\\.1:\\d+\\/${labPath}|https?:\\/\\/localhost:\\d+\\/${labPath})`;
  const iframePattern = new RegExp(
    `<iframe\\b[^>]*\\bsrc\\s*=\\s*(?:"${iframeSrcPattern}"|'${iframeSrcPattern}'|${iframeSrcPattern}(?=\\s|>))[^>]*>`,
    "i"
  );

  return iframePattern.test(note);
}

function hasTitle(lab) {
  return /<title\b[^>]*>[\s\S]*?<\/title>/i.test(lab);
}

function hasClassOrId(lab, token) {
  const attributePattern = /\b(class|id)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  let match;

  while ((match = attributePattern.exec(lab)) !== null) {
    const attribute = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? "";

    if (attribute === "id" && value === token) {
      return true;
    }

    if (attribute === "class" && value.split(/\s+/).includes(token)) {
      return true;
    }
  }

  return false;
}

function hasRequiredLabStructure(lab, token) {
  if (token === "<title>") {
    return hasTitle(lab);
  }

  return hasClassOrId(lab, token);
}

const failures = [];

for (const check of checks) {
  const notePath = path.join(knowledgeRoot, check.note);
  const labPath = path.join(interactiveRoot, check.lab);

  if (!fs.existsSync(notePath)) {
    failures.push(`Missing note: ${check.note}`);
  } else {
    const note = readText(notePath);

    if (!hasIframeForLab(note, check.lab)) {
      failures.push(`Note does not iframe lab: ${check.note} -> ${check.lab}`);
    }
  }

  if (!fs.existsSync(labPath)) {
    failures.push(`Missing lab: ${check.lab}`);
    continue;
  }

  const lab = readText(labPath);

  for (const token of check.required) {
    if (!hasRequiredLabStructure(lab, token)) {
      failures.push(`Lab ${check.lab} is missing structural token: ${token}`);
    }
  }
}

if (failures.length > 0) {
  console.error("Interactive verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Interactive verification passed for ${checks.length} note/lab pairs.`);
