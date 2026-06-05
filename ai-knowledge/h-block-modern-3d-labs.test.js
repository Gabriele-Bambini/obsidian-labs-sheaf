const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = __dirname;

const expected = [
  "h01-introduction-sheaf-theory-lab.html",
  "h02-sheaf-gluing-lab.html",
  "h03-cellular-sheaf-cohomology.html",
  "h04-cellular-sheaf-on-graph-lab.html",
  "h05-sheaf-laplacian-builder.html",
  "h06-sheaf-diffusion.html",
  "h07-sheaf-neural-networks-lab.html",
  "h08-neural-sheaf-diffusion-lab.html",
  "h09-connection-laplacian-transport-lab.html",
  "h10-heterophily-restriction-lab.html",
  "h11-sheaf-gauge-transformation-lab.html",
  "h12-sheaf-applications-domain-lab.html",
  "h13-directed-hypergraph-sheaf-lab.html",
  "h14-persistent-sheaf-topology-lab.html",
  "h15-sheaf-research-frontier-lab.html"
];

const lessonTerms = {
  h01: ["Open cover", "Stalks and restrictions", "Global section test", "Gluing score"],
  h02: ["Locality axiom", "Gluing axiom", "Unique global section", "Overlap agreement"],
  h03: ["Cellular Sheaves And Cohomology", "Cochain degree", "Coboundary norm", "Cycle circulation"],
  h04: ["Cellular Sheaves On Graphs", "edge stalk", "Incidence rank", "F_A->AB"],
  h05: ["The Sheaf Laplacian", "Assemble δ", "Dirichlet energy", "L_F = δ^T δ"],
  h06: ["Sheaf Diffusion", "Heat equation", "Spectral damping", "Energy decay"],
  h07: ["Sheaf Neural Networks", "Learn restrictions", "SNN layers", "Compatibility gain"],
  h08: ["Neural Sheaf Diffusion", "Plain diffusion", "Learned sheaf diffusion", "Sheaf energy drop"],
  h09: ["Connection Laplacian Transport", "Parallel transport", "Loop holonomy", "Holonomy angle"],
  h10: ["Sheaves And Heterophily", "Role compatibility", "Signed relations", "Neighbor help"],
  h11: ["Sheaf Theory And Gauge Theory", "Gauge transform", "Invariant energy", "Gauge error"],
  h12: ["Applications Of Sheaf GNNs", "Fraud / abuse", "Weather / traffic", "Domain fit"],
  h13: ["Directed Sheaves And Hypergraphs", "Directed edge sheaf", "Hyperedge stalk", "Asymmetry signal"],
  h14: ["Sheaves And Persistent Topology", "Grow filtration", "Sheaf persistence", "Persistent defect"],
  h15: ["Research Frontier In Sheaf GNNs", "Dynamic sheaves", "Learn topology", "Open-problem pressure"]
};

const visualKinds = {
  h01: "open-cover",
  h02: "locality-cover",
  h03: "cellular-triangle",
  h04: "graph-stalks",
  h05: "laplacian-matrix",
  h06: "diffusion-spectrum",
  h07: "snn-compatibility",
  h08: "neural-diffusion",
  h09: "connection-loop",
  h10: "heterophily-roles",
  h11: "gauge-frames",
  h12: "application-map",
  h13: "directed-hypergraph",
  h14: "persistence-filtration",
  h15: "research-roadmap"
};

const graphStyles = {
  h01: "anchors",
  h02: "anchors",
  h03: "anchors",
  h04: "graph",
  h05: "hidden",
  h06: "reference",
  h07: "hybrid",
  h08: "hybrid",
  h09: "anchors",
  h10: "hybrid",
  h11: "anchors",
  h12: "reference",
  h13: "anchors",
  h14: "anchors",
  h15: "reference"
};

const sceneContracts = {
  h01: ["open patch coverage", "stalk column", "global section"],
  h02: ["local section surface", "overlap band", "unique global surface"],
  h03: ["0-cochain vertex", "1-cochain edge residual", "face circulation defect"],
  h04: ["graph node stalk", "edge comparison plate", "restriction map"],
  h05: ["residual machine", "single edge-stalk comparison plate", "delta x residual rod", "Laplacian block matrix", "kernel harmonic anchor", "intuitive stage floor"],
  h06: ["spectral eigenmode damping", "heat decay trace", "harmonic heat surface"],
  h07: ["neighbor representation space", "edge-stalk comparison chamber", "trusted sheaf message"],
  h08: ["plain diffusion collapse lane", "learned sheaf diffusion lane", "learned restriction gate"],
  h09: ["local transport frame", "holonomy curvature defect", "parallel transport loop"],
  h10: ["role compatibility matrix", "role embedding tower", "translated role signal"],
  h11: ["gauge transform ring", "local gauge frame", "invariant energy orbit"],
  h12: ["domain tile", "central compatibility adapter", "domain-aware task signal"],
  h13: ["directed edge stalk", "hyperedge membrane", "group hyperedge stalk"],
  h14: ["filtration point", "cell birth edge", "sheaf barcode"],
  h15: ["research direction", "coupling constraint", "usable SNN core"]
};

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function hasClass(html, className) {
  return new RegExp(`class=["'][^"']*\\b${className}\\b[^"']*["']`, "i").test(html);
}

const actual = fs.readdirSync(root).filter((file) => /^h\d{2}.*\.html$/i.test(file)).sort();
assert.deepStrictEqual(actual, expected, "Unexpected H block lab set");

const engine = read("shared/gnn-lab-core.js");
for (const forbidden of ["softmax temperature", "distractor edge", "self attention", "attention layers"]) {
  assert(!engine.includes(forbidden), `shared engine still has hard-coded GNN readout phrase "${forbidden}"`);
}
assert.strictEqual(new Set(Object.values(visualKinds)).size, expected.length, "Each H lesson must have its own primary visual kind");
assert(Object.values(graphStyles).filter((style) => style === "graph").length <= 1, "Only the graph-sheaf lesson should use a full graph layer");
for (const [id, terms] of Object.entries(sceneContracts)) {
  for (const term of terms) {
    assert(engine.includes(term), `${id}: shared renderer missing independent scene primitive "${term}"`);
  }
}
assert(engine.includes("concept-rail"), "H05 needs an in-viewport operator rail for readability");

const titles = new Set();
const graphSignatures = new Set();

for (const file of expected) {
  const html = read(file);
  const id = file.match(/^(h\d{2})/i)[1].toLowerCase();
  assert(html.includes(`data-lab-id="${id}"`), `${file}: missing stable lab id`);
  assert(html.includes('data-lab-kind="sheaf"'), `${file}: H block must use sheaf scene family`);
  assert(hasClass(html, "gnn-lab"), `${file}: missing gnn-lab root`);
  assert(hasClass(html, "math-3d-lab"), `${file}: missing general math lab class`);
  assert(hasClass(html, "lab-shell"), `${file}: missing lab-shell root`);
  assert(hasClass(html, "lab-3d-shell"), `${file}: missing lab-3d-shell root`);
  assert(hasClass(html, "lab-viewport"), `${file}: missing viewport`);
  assert(hasClass(html, "command-bar"), `${file}: missing command bar`);
  assert(hasClass(html, "controls"), `${file}: missing controls class`);
  assert(html.includes("shared/three.min.js"), `${file}: missing Three runtime`);
  assert(html.includes("shared/gnn-lab-core.js"), `${file}: missing shared 3D engine`);
  assert(html.includes("h05-intuitive-v11"), `${file}: missing intuitive H05 scene cache bust`);
  for (const term of lessonTerms[id]) {
    assert(html.includes(term), `${file}: missing lesson-specific term "${term}"`);
  }
  assert(html.includes('"graph":'), `${file}: missing explicit lesson graph blueprint`);
  assert(html.includes('"profile":'), `${file}: missing explicit lesson profile`);
  assert(html.includes(`"visual":{"kind":"${visualKinds[id]}","graphStyle":"${graphStyles[id]}"}`), `${file}: missing lesson-specific visual kind/style`);
  assert((html.match(/type="range"/g) || []).length >= 5, `${file}: expected five live ranges`);
  assert((html.match(/data-action="/g) || []).length >= 3, `${file}: expected Pulse/Step/Reset`);
  assert(new RegExp(`window\\.__${id}LabSnapshot\\s*=`, "i").test(html), `${file}: missing legacy snapshot alias`);

  const title = (html.match(/<title>([^<]+)<\/title>/i) || [])[1];
  assert(title, `${file}: missing title`);
  assert(!titles.has(title), `${file}: duplicate title ${title}`);
  titles.add(title);

  const signature = (html.match(/"graph":\{"nodes":\[([\s\S]*?)\],"edges":\[/) || [])[1];
  assert(signature, `${file}: could not read graph signature`);
  assert(!graphSignatures.has(signature), `${file}: duplicate graph blueprint`);
  graphSignatures.add(signature);
}

console.log(`H block modern 3D contract passed for ${expected.length} labs.`);
