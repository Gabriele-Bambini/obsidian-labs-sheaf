const fs = require("fs");
const path = require("path");

const labs = [
  {
    id: "g01",
    file: "g01-message-passing-playground.html",
    kind: "message-passing",
    title: "G01 Message Passing Playground",
    subtitle: "Local neighborhoods become neural computation through visible message waves.",
    keywords: "message aggregation neighborhood",
    modes: [["sum", "Sum aggregator"], ["mean", "Mean aggregator"], ["max", "Max gate"]],
    params: [["depth", "Layer depth", 1, 10, 1, 3], ["mixing", "Message mixing", 0.2, 2.4, 0.05, 1.15], ["noise", "Feature noise", 0, 1.2, 0.02, 0.22], ["budget", "Neighborhood radius", 1, 8, 1, 3], ["residual", "Self residual", 0, 1, 0.02, 0.34]],
    metrics: ["Message norm", "Class separation", "Node coverage", "Update energy"]
  },
  {
    id: "g02",
    file: "g02-gcn-message-passing.html",
    kind: "gcn",
    title: "G02 GCN Spectral Smoothing Lab",
    subtitle: "Normalized graph convolution as learnable diffusion over graph signals.",
    keywords: "laplacian renormalization smoothing",
    modes: [["symmetric", "Symmetric normalization"], ["random-walk", "Random-walk flow"], ["raw", "Unnormalized adjacency"]],
    params: [["depth", "GCN layers", 1, 12, 1, 4], ["mixing", "Filter strength", 0.2, 2.2, 0.05, 1.05], ["noise", "Input roughness", 0, 1.4, 0.02, 0.35], ["budget", "Spectral bandwidth", 1, 8, 1, 4], ["selfLoop", "Self-loop weight", 0, 1.5, 0.05, 0.7]],
    metrics: ["Dirichlet energy", "Node variance", "Spectral band", "Smoothing index"]
  },
  {
    id: "g03",
    file: "g03-graph-attention-coefficients-lab.html",
    kind: "attention",
    title: "G03 Graph Attention Flow",
    subtitle: "A masked softmax turns neighbor scores into directed message weights.",
    keywords: "attention softmax masked",
    modes: [["feature", "Feature-seeking head"], ["self", "Self-preserving head"], ["bridge", "Bridge-seeking head"]],
    params: [["depth", "Attention layers", 1, 8, 1, 3], ["temperature", "Softmax temperature", 0.25, 3.5, 0.05, 1.0], ["noise", "Distractor edge", 0, 1, 0.02, 0.24], ["budget", "Visible neighbors", 1, 9, 1, 5], ["residual", "Self attention", 0, 1, 0.02, 0.38]],
    metrics: ["Attention entropy", "Max coefficient", "Aggregated norm", "Masked degree"]
  },
  {
    id: "g04",
    file: "g04-graphsage-sampling-lab.html",
    kind: "graphsage",
    title: "G04 GraphSAGE Sampling Cone",
    subtitle: "Inductive aggregation depends on how much neighborhood evidence is sampled.",
    keywords: "sampling fanout inductive",
    modes: [["mean", "Mean sample"], ["pool", "Pooling sample"], ["lstm", "Ordered LSTM sample"]],
    params: [["depth", "Sample depth", 1, 5, 1, 2], ["mixing", "Aggregator gain", 0.2, 2.4, 0.05, 1.0], ["noise", "Sample variance", 0, 1.5, 0.02, 0.48], ["fanout", "Fanout", 1, 12, 1, 4], ["residual", "Target carry", 0, 1, 0.02, 0.42]],
    metrics: ["Sampling variance", "Coverage", "Compute cost", "Embedding drift"]
  },
  {
    id: "g05",
    file: "g05-wl-color-refinement-lab.html",
    kind: "wl",
    title: "G05 Weisfeiler-Leman Refinement Lab",
    subtitle: "Color histograms reveal when message-passing can or cannot distinguish graphs.",
    keywords: "weisfeiler color refinement",
    modes: [["regular", "Regular pair"], ["perturbed", "Seed perturbation"], ["stable", "Stable colors"]],
    params: [["depth", "Refinement rounds", 1, 8, 1, 3], ["mixing", "Hash sharpness", 0.2, 2.6, 0.05, 1.2], ["noise", "Initial label noise", 0, 1, 0.02, 0.1], ["budget", "Color capacity", 2, 12, 1, 5], ["residual", "Self color weight", 0, 1, 0.02, 0.5]],
    metrics: ["Color classes", "Histogram gap", "Distinguished score", "Stable round"]
  },
  {
    id: "g06",
    file: "g06-higher-order-gnn-lab.html",
    kind: "higher-order",
    title: "G06 Higher-Order GNN Lift",
    subtitle: "Motifs and tuple states expose structure that node-only messages miss.",
    keywords: "motif subgraph higher-order",
    modes: [["pairs", "2-WL pair states"], ["triangles", "Triangle motifs"], ["subgraphs", "Subgraph lift"]],
    params: [["depth", "Update rounds", 1, 8, 1, 3], ["mixing", "Tuple mixing", 0.2, 2.4, 0.05, 1.05], ["noise", "Sparsification", 0, 1, 0.02, 0.22], ["budget", "Motif budget", 2, 14, 1, 6], ["residual", "Node anchor", 0, 1, 0.02, 0.36]],
    metrics: ["Lifted states", "Memory cost", "Motif signal", "Expressivity gap"]
  },
  {
    id: "g07",
    file: "g07-link-graph-readout-lab.html",
    kind: "link-readout",
    title: "G07 Link Prediction And Graph Readout",
    subtitle: "The same embeddings answer pair questions and whole-graph questions differently.",
    keywords: "link readout pooling",
    modes: [["dot", "Dot decoder"], ["bilinear", "Bilinear decoder"], ["pool", "Attention pooling"]],
    params: [["depth", "Message depth", 1, 8, 1, 3], ["mixing", "Decoder gain", 0.2, 2.4, 0.05, 1.1], ["noise", "Negative sampling noise", 0, 1.4, 0.02, 0.34], ["budget", "Candidate pairs", 1, 12, 1, 5], ["residual", "Readout residual", 0, 1, 0.02, 0.4]],
    metrics: ["Decoder margin", "Precision proxy", "Readout norm", "Pair coverage"]
  },
  {
    id: "g08",
    file: "g08-scalable-gnn-sampling-lab.html",
    kind: "scalable",
    title: "G08 Scalable GNN Budget Simulator",
    subtitle: "Sampling, clustering, and minibatching trade context against memory.",
    keywords: "minibatch cluster sampling",
    modes: [["neighbor", "Neighbor sampling"], ["cluster", "Cluster-GCN"], ["walk", "GraphSAINT walks"]],
    params: [["depth", "Propagation depth", 1, 6, 1, 2], ["mixing", "Gradient mixing", 0.2, 2.2, 0.05, 1.0], ["noise", "Gradient noise", 0, 1.6, 0.02, 0.55], ["budget", "Batch budget", 3, 28, 1, 10], ["residual", "Cache reuse", 0, 1, 0.02, 0.28]],
    metrics: ["Memory budget", "Edges touched", "Gradient variance", "Coverage"]
  },
  {
    id: "g09",
    file: "g09-temporal-gnn-memory-lab.html",
    kind: "temporal",
    title: "G09 Temporal GNN Memory Stream",
    subtitle: "Events update node memories while old context decays through time.",
    keywords: "temporal memory event",
    modes: [["event", "Event memory"], ["window", "Sliding window"], ["attention", "Temporal attention"]],
    params: [["depth", "History depth", 1, 8, 1, 3], ["mixing", "Memory update", 0.2, 2.4, 0.05, 1.1], ["noise", "Event noise", 0, 1.4, 0.02, 0.28], ["budget", "Time window", 1, 12, 1, 5], ["residual", "Memory retention", 0, 1, 0.02, 0.55]],
    metrics: ["Memory age", "Stale nodes", "Causal score", "Event rate"]
  },
  {
    id: "g10",
    file: "g10-equivariance-transform-lab.html",
    kind: "equivariance",
    title: "G10 Equivariance Contract Test",
    subtitle: "Transform the input and inspect whether the output follows the same law.",
    keywords: "equivariance rotation symmetry",
    modes: [["rotation", "Rotation"], ["translation", "Translation"], ["reflection", "Reflection"]],
    params: [["depth", "Operator depth", 1, 8, 1, 3], ["mixing", "Transform scale", 0.2, 2.4, 0.05, 1.0], ["noise", "Coordinate noise", 0, 1.2, 0.02, 0.18], ["budget", "Frame samples", 2, 12, 1, 5], ["residual", "Invariant readout", 0, 1, 0.02, 0.46]],
    metrics: ["Equivariance error", "Invariance error", "Output drift", "Contract score"]
  },
  {
    id: "g11",
    file: "g11-geometric-domain-symmetry-lab.html",
    kind: "geometric",
    title: "G11 Geometric Deep Learning Atlas",
    subtitle: "Domains, symmetries, operators, and readouts must agree.",
    keywords: "domain symmetry operator",
    modes: [["graph", "Graph domain"], ["manifold", "Manifold domain"], ["set", "Set domain"]],
    params: [["depth", "Operator depth", 1, 8, 1, 3], ["mixing", "Locality radius", 0.2, 2.4, 0.05, 1.1], ["noise", "Domain mismatch", 0, 1.3, 0.02, 0.2], ["budget", "Neighborhood size", 2, 12, 1, 5], ["residual", "Symmetry prior", 0, 1, 0.02, 0.58]],
    metrics: ["Symmetry score", "Operator locality", "Domain mismatch", "Readout stability"]
  },
  {
    id: "g12",
    file: "g12-molecular-message-passing-lab.html",
    kind: "molecular",
    title: "G12 Molecular Message Passing",
    subtitle: "Atoms, bonds, distances, and readout choices shape molecular predictions.",
    keywords: "molecule bond atom",
    modes: [["2d", "2D bond graph"], ["3d", "3D conformer"], ["radial", "Radial gates"]],
    params: [["depth", "MPNN layers", 1, 8, 1, 3], ["mixing", "Bond weighting", 0.2, 2.4, 0.05, 1.15], ["noise", "Conformer noise", 0, 1.2, 0.02, 0.2], ["cutoff", "Distance cutoff", 1, 10, 1, 4], ["residual", "Atom identity", 0, 1, 0.02, 0.5]],
    metrics: ["Geometry share", "Active bonds", "Property estimate", "Readout norm"]
  },
  {
    id: "g13",
    file: "g13-knowledge-graph-relations-lab.html",
    kind: "knowledge-graph",
    title: "G13 Knowledge Graph Relation Channels",
    subtitle: "Typed edges transport information through relation-specific paths.",
    keywords: "relation triple typed",
    modes: [["rgcn", "R-GCN channels"], ["transe", "TransE geometry"], ["path", "Path evidence"]],
    params: [["depth", "Reasoning hops", 1, 8, 1, 3], ["mixing", "Relation gain", 0.2, 2.4, 0.05, 1.1], ["noise", "Negative corruption", 0, 1.4, 0.02, 0.32], ["budget", "Relation channels", 2, 12, 1, 5], ["residual", "Entity carry", 0, 1, 0.02, 0.44]],
    metrics: ["Triple score", "Path evidence", "Relation norm", "Rank proxy"]
  },
  {
    id: "g14",
    file: "g14-gnn-adversarial-perturbation-lab.html",
    kind: "robustness",
    title: "G14 GNN Robustness Attack Surface",
    subtitle: "Perturb edges or features and watch message flow bend the decision margin.",
    keywords: "attack robust perturbation",
    modes: [["evasion", "Evasion attack"], ["poison", "Poisoning attack"], ["defense", "Robust aggregation"]],
    params: [["depth", "Attack depth", 1, 8, 1, 3], ["mixing", "Defense strength", 0.2, 2.4, 0.05, 0.9], ["perturbation", "Attack budget", 0, 1.5, 0.02, 0.42], ["budget", "Changed edges", 1, 12, 1, 4], ["residual", "Clean feature anchor", 0, 1, 0.02, 0.52]],
    metrics: ["Robust margin", "Prediction flip", "Changed edges", "Defense cost"]
  },
  {
    id: "g15",
    file: "g15-over-smoothing-depth-lab.html",
    kind: "over-smoothing",
    title: "G15 Depth, Over-Smoothing And Bottlenecks",
    subtitle: "More layers expand reach while diffusion and narrow cuts compress signal.",
    keywords: "oversmoothing oversquashing depth",
    modes: [["plain", "Plain propagation"], ["residual", "Residual propagation"], ["teleport", "Virtual node teleport"]],
    params: [["depth", "Network depth", 1, 16, 1, 6], ["mixing", "Propagation strength", 0.2, 2.4, 0.05, 1.18], ["noise", "Initial signal", 0, 1.2, 0.02, 0.28], ["budget", "Bottleneck width", 1, 10, 1, 3], ["residual", "Residual weight", 0, 1, 0.02, 0.32]],
    metrics: ["Pairwise distance", "Oversmoothing index", "Bottleneck flow", "Accuracy trend"]
  },
  {
    id: "g30",
    file: "g30-heterophilic-gnn-lab.html",
    kind: "heterophily",
    title: "G30 Heterophilic GNN Compatibility Lab",
    subtitle: "Useful neighbors may disagree; compatibility maps decide whether they help.",
    keywords: "heterophily compatibility high-pass",
    modes: [["signed", "Signed compatibility"], ["highpass", "High-pass filter"], ["role", "Role relation"]],
    params: [["depth", "Propagation depth", 1, 10, 1, 4], ["mixing", "High-pass gain", 0.2, 2.6, 0.05, 1.2], ["noise", "Relation noise", 0, 1.4, 0.02, 0.28], ["budget", "Relation types", 2, 10, 1, 4], ["compatibility", "Self/neighbor balance", 0, 1, 0.02, 0.62]],
    metrics: ["Neighbor help", "Homophily ratio", "Compatibility accuracy", "Class separation"]
  },
  {
    id: "g32",
    file: "g32-ai-foundations-lab.html",
    kind: "ai-foundations",
    title: "G32 AI Foundations System Loop",
    subtitle: "Task, representation, inductive bias, objective, optimization, and evaluation interact.",
    keywords: "objective bias evaluation",
    modes: [["supervised", "Supervised task"], ["generative", "Generative task"], ["agentic", "Agentic loop"]],
    params: [["depth", "Train steps", 1, 12, 1, 4], ["mixing", "Model capacity", 0.2, 2.6, 0.05, 1.15], ["noise", "Data noise", 0, 1.5, 0.02, 0.32], ["budget", "Data size", 2, 16, 1, 7], ["residual", "Inductive bias", 0, 1, 0.02, 0.5]],
    metrics: ["Generalization gap", "Train risk", "Test risk", "Compute cost"]
  }
];

function esc(text) {
  return String(text).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

function js(value) {
  return JSON.stringify(value);
}

function renderLab(lab) {
  const modeOptions = lab.modes.map(([value, label]) => `<option value="${esc(value)}">${esc(label)}</option>`).join("\n            ");
  const rangeControls = lab.params.map(([key, label, min, max, step, value]) => `
        <div class="command-control">
          <label for="${lab.id}-${key}">${esc(label)} <output data-output="${esc(key)}">${esc(value)}</output></label>
          <input id="${lab.id}-${key}" data-param="${esc(key)}" type="range" min="${min}" max="${max}" step="${step}" value="${value}">
        </div>`).join("");
  const metrics = lab.metrics.map((label) => `
        <div class="metric" data-role="metric" data-metric="${esc(label)}">
          <span>${esc(label)}</span>
          <strong>0.00</strong>
        </div>`).join("");
  const config = {
    id: lab.id,
    kind: lab.kind,
    title: lab.title,
    modes: lab.modes.map(([value, label]) => ({ value, label })),
    parameters: lab.params.map(([key, label, min, max, step, value]) => ({ key, label, min, max, step, value })),
    metrics: lab.metrics
  };
  const alias = `__${lab.id}LabSnapshot`;
  const ready = `__${lab.id}LabReady`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(lab.title)}</title>
  <link rel="stylesheet" href="shared/gnn-lab-core.css">
</head>
<body>
  <main class="gnn-lab lab-shell lab-3d-shell" data-lab-kind="${esc(lab.kind)}" data-lab-id="${esc(lab.id)}" data-keywords="${esc(lab.keywords)}">
    <section class="visual-stack" aria-label="Interactive 3D graph visualization">
      <div class="stage">
        <div class="lab-viewport" title="Drag to orbit / rotate. Use the wheel to zoom. Click nodes to inspect.">
          <canvas id="canvas" aria-label="${esc(lab.title)} 3D interactive graph"></canvas>
        </div>
        <div class="scene-overlay">
          <div class="scene-badge"><span>Live concept</span><strong>${esc(lab.id.toUpperCase())}</strong></div>
          <div class="formula-chip"><span>Model sketch</span>${esc(lab.subtitle)}</div>
        </div>
        <div class="selected-chip" data-role="selected"><span>Selected object</span><strong>Click a node to inspect local structure.</strong></div>
      </div>
      <div class="command-bar controls" aria-label="Horizontal command bar under the 3D visualization">
        <select data-control="mode" aria-label="Concept mode">
            ${modeOptions}
        </select>${rangeControls}
        <button class="primary" data-action="pulse" type="button">Pulse</button>
        <button data-action="step" type="button">Step</button>
        <button data-action="reset" type="button">Reset</button>
      </div>
    </section>
    <aside class="side-panel lab-3d-panel">
      <header>
        <p class="eyebrow">Block G 3D lab</p>
        <h1>${esc(lab.title)}</h1>
        <p class="subtitle">Orbit / rotate / zoom the system, select nodes, then change parameters to experiment with ${esc(lab.keywords)}.</p>
      </header>
      <div class="metric-grid">${metrics}
      </div>
      <div class="insight-card">
        <h2>What to watch</h2>
        <p data-role="insight">Loading the 3D graph system.</p>
        <p id="stateBox" class="state-box">Waiting for the first render.</p>
      </div>
      <p class="hint">Command bar controls are live: every slider changes the graph geometry, message flow, and readouts. The scene uses blue signal paths and warm brown/amber contrast in a 3Blue1Brown-style visual language.</p>
    </aside>
  </main>
  <script src="shared/three.min.js"></script>
  <script src="shared/gnn-lab-core.js"></script>
  <script>
    const labState = createGnnLab(${js(config)});
    window.${alias} = () => window.__gLabSnapshot();
    Object.defineProperty(window, "${ready}", { get: () => window.__gLabReady === true });
  </script>
</body>
</html>
`;
}

for (const lab of labs) {
  fs.writeFileSync(path.join(__dirname, lab.file), renderLab(lab), "utf8");
  console.log(`wrote ${lab.file}`);
}
