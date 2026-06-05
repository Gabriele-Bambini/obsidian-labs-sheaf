const fs = require("fs");
const path = require("path");

const labs = [
  ["g01-message-passing-playground.html", "message-passing", ["message", "aggregation", "neighborhood"]],
  ["g02-gcn-message-passing.html", "gcn", ["laplacian", "renormalization", "smoothing"]],
  ["g03-graph-attention-coefficients-lab.html", "attention", ["attention", "softmax", "masked"]],
  ["g04-graphsage-sampling-lab.html", "graphsage", ["sampling", "fanout", "inductive"]],
  ["g05-wl-color-refinement-lab.html", "wl", ["weisfeiler", "color", "refinement"]],
  ["g06-higher-order-gnn-lab.html", "higher-order", ["motif", "subgraph", "higher-order"]],
  ["g07-link-graph-readout-lab.html", "link-readout", ["link", "readout", "pooling"]],
  ["g08-scalable-gnn-sampling-lab.html", "scalable", ["minibatch", "cluster", "sampling"]],
  ["g09-temporal-gnn-memory-lab.html", "temporal", ["temporal", "memory", "event"]],
  ["g10-equivariance-transform-lab.html", "equivariance", ["equivariance", "rotation", "symmetry"]],
  ["g11-geometric-domain-symmetry-lab.html", "geometric", ["domain", "symmetry", "operator"]],
  ["g12-molecular-message-passing-lab.html", "molecular", ["molecule", "bond", "atom"]],
  ["g13-knowledge-graph-relations-lab.html", "knowledge-graph", ["relation", "triple", "typed"]],
  ["g14-gnn-adversarial-perturbation-lab.html", "robustness", ["attack", "robust", "perturbation"]],
  ["g15-over-smoothing-depth-lab.html", "over-smoothing", ["oversmoothing", "oversquashing", "depth"]],
  ["g30-heterophilic-gnn-lab.html", "heterophily", ["heterophily", "compatibility", "high-pass"]],
  ["g32-ai-foundations-lab.html", "ai-foundations", ["objective", "bias", "evaluation"]]
];

const root = __dirname;
const sharedEngine = path.join(root, "shared", "gnn-lab-core.js");

function hasClass(html, className) {
  return new RegExp(`class=["'][^"']*\\b${className}\\b[^"']*["']`, "i").test(html);
}

if (!fs.existsSync(sharedEngine)) {
  throw new Error("Missing shared GNN lab engine: shared/gnn-lab-core.js");
}

const engine = fs.readFileSync(sharedEngine, "utf8");
for (const required of ["createGnnLab", "drawGraphScene", "computeLabMetrics", "__gLabSnapshot"]) {
  if (!engine.includes(required)) {
    throw new Error(`Shared GNN engine does not expose ${required}.`);
  }
}

const forbiddenEnginePatterns = [
  [/Math\.(?:sin|cos)\([^)]*elapsed/i, "the graph must not animate by itself over time"],
  [/node\.base\.[xyz]\s*\+/i, "node positions must stay anchored to the stable 3D graph"],
  [/messages and metrics move/i, "interaction copy must describe manual rotation, not autonomous motion"]
];

for (const [pattern, reason] of forbiddenEnginePatterns) {
  if (pattern.test(engine)) {
    throw new Error(`Shared GNN engine violation: ${reason}.`);
  }
}

const requiredEnginePatterns = [
  [/mesh\.position\.copy\(node\.base\)/i, "nodes remain fixed in 3D space"],
  [/Drag to rotate the stable \$\{objectName\}/i, "manual 3D rotation instruction"],
  [/label\.material\.opacity\s*=\s*\(isSelected\s*\?\s*0\.78/i, "labels are subdued unless focused"],
  [/root\.dataset\.cameraTheta\s*=\s*cameraRig\.theta\.toFixed/i, "manual camera rotation is observable in the DOM"],
  [/SphereGeometry\(config\.kind === "scalable" \? Math\.min\(0\.16,\s*state\.graphStyle\.nodeRadius\) : state\.graphStyle\.nodeRadius/i, "larger readable graph nodes"],
  [/function markCommand\(action\)/i, "command button clicks are observable"],
  [/root\.dataset\.lastAction\s*=\s*action/i, "command action telemetry"],
  [/state\.visualMode\s*=\s*"pulse"/i, "Pulse command changes visual mode"],
  [/state\.visualMode\s*=\s*"step"/i, "Step command changes visual mode"],
  [/root\.dataset\.activeEdges\s*=\s*String\(state\.activeEdgeCount/i, "visual command consequences are measurable"],
  [/Pulse is isolating \$\{visibleChannels\} active channel/i, "Pulse explains the highlighted message channels"],
  [/Step opens a \$\{state\.stepRadius\}-step view around/i, "Step explains the propagation frontier"],
  [/function attentionDistribution\(graph,\s*selected,\s*temperature,\s*noise,\s*residual\)/i, "softmax temperature and distractor controls drive visual attention"],
  [/showParameterEffect\(input\.dataset\.param\)/i, "slider changes immediately alter the visualization mode"],
  [/function setRangeFromClientX\(input,\s*clientX\)/i, "range controls work from pointer position in Obsidian"],
  [/input\.addEventListener\("pointerdown"/i, "range pointer interaction is handled explicitly"],
  [/control\.addEventListener\("pointerdown"/i, "range control hit area is handled explicitly"],
  [/event\.key === "Home"/i, "range keyboard interaction is handled explicitly"],
  [/root\.dataset\.attentionMax\s*=\s*formatValue\(state\.attentionMax/i, "attention temperature effect is measurable"],
  [/root\.dataset\.distractorCount\s*=\s*String\(state\.distractorCount/i, "distractor slider effect is measurable"],
  [/root\.dataset\.selfAttention\s*=\s*formatValue\(state\.selfAttention/i, "self-attention slider effect is measurable"],
  [/function syncVisualTelemetry\(\)/i, "control changes immediately synchronize visual telemetry"],
  [/syncVisualTelemetry\(\);[\s\S]*function labelForMode/i, "panel updates sync the scene before tests or readers inspect the DOM"],
  [/concentrates the strongest response at \$\{formatValue\(attentionNow\.maxAlpha\)\}/i, "temperature effect is explained in the lab readout"],
  [/marks \$\{attentionNow\.distractorCount\} unstable red channel/i, "distractor edge effect is explained in the lab readout"],
  [/stabilizes the selected object/i, "self-attention slider effect is explained in the lab readout"]
];

for (const [pattern, reason] of requiredEnginePatterns) {
  if (!pattern.test(engine)) {
    throw new Error(`Shared GNN engine requirement missing: ${reason}.`);
  }
}

const seenKinds = new Set();
for (const [fileName, kind, keywords] of labs) {
  const filePath = path.join(root, fileName);
  if (!fs.existsSync(filePath)) throw new Error(`Missing GNN lab file ${fileName}.`);

  const html = fs.readFileSync(filePath, "utf8");
  const lower = html.toLowerCase();

  if (!hasClass(html, "gnn-lab") || !hasClass(html, "lab-3d-shell")) throw new Error(`${fileName}: missing 3D .gnn-lab root.`);
  if (!html.includes('data-lab-kind="' + kind + '"')) throw new Error(`${fileName}: wrong or missing data-lab-kind.`);
  if (!html.includes("shared/three.min.js")) throw new Error(`${fileName}: does not load Three.js.`);
  if (!html.includes("shared/gnn-lab-core.css")) throw new Error(`${fileName}: does not load shared 3D CSS.`);
  if (!html.includes("shared/gnn-lab-core.js")) throw new Error(`${fileName}: does not use shared GNN engine.`);
  if (!html.includes("createGnnLab(")) throw new Error(`${fileName}: does not initialize createGnnLab.`);
  if (!html.includes("<canvas")) throw new Error(`${fileName}: missing canvas.`);
  if (!hasClass(html, "command-bar")) throw new Error(`${fileName}: missing horizontal command bar.`);
  if (!html.includes('data-role="insight"')) throw new Error(`${fileName}: missing insight panel.`);
  if ((html.match(/data-role="metric"/g) || []).length < 4) throw new Error(`${fileName}: needs at least four metrics.`);
  if ((html.match(/type="range"/g) || []).length < 4) throw new Error(`${fileName}: needs at least four live numeric parameters.`);
  if ((html.match(/<(button|select)\b/g) || []).length < 4) throw new Error(`${fileName}: needs mode and command controls.`);
  if (!/orbit|rotate|zoom/i.test(html)) throw new Error(`${fileName}: missing explicit orbit/zoom affordance.`);
  if (!/window\.__g[a-z0-9]+labsnapshot\s*=/.test(lower)) throw new Error(`${fileName}: missing legacy per-lab snapshot alias.`);
  for (const keyword of keywords) {
    if (!lower.includes(keyword)) throw new Error(`${fileName}: missing topic keyword ${keyword}.`);
  }
  if (seenKinds.has(kind)) throw new Error(`Duplicate lab kind ${kind}.`);
  seenKinds.add(kind);
}

console.log("G block modern labs static contract passed.");
