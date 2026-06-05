const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "i05-quantum-graph-circuit-lab.html"), "utf8");
const sharedPath = path.join(__dirname, "shared", "quantum-labs.js");
const shared = fs.existsSync(sharedPath) ? fs.readFileSync(sharedPath, "utf8") : "";
const source = `${html}\n${shared}`;

const requiredLabels = [
  /node features -> qubits/,
  /edge entanglers = graph wiring/,
  /ZZ cost layer/,
  /RX mixer layer/,
  /measurement readout <Z_v>/,
  /pair readout <Z_uZ_v>/,
  /Max-Cut feature circuit/,
  /Hamiltonian graph model/,
  /edge shuffle ablation/,
  /shots = sampling cost/
];

for (const pattern of requiredLabels) {
  if (!pattern.test(source)) throw new Error(`I05 concrete visual label missing: ${pattern}`);
}

if (!/createI05QuantumGraphCircuitLab\(\)/.test(html)) {
  throw new Error("I05 lab must call its concrete QGNN renderer.");
}

for (const id of ["graphPreset", "encoding", "entangler", "depth", "shots", "noise", "applyLayer", "runDepth", "measure", "toggleEdges", "randomize", "resetI05"]) {
  if (!new RegExp(`id="${id}"|getElementById\\("${id}"\\)`).test(source)) {
    throw new Error(`I05 concrete control missing: ${id}`);
  }
}

if (!/applyQgnnLayer/.test(source) || !/drawGraphQubitCircuit/.test(source) || !/drawMeasurementReadout/.test(source)) {
  throw new Error("I05 must implement graph-qubit circuit, QGNN layer, and measurement readout visuals.");
}

if (!/appliedLayers: state\.appliedLayers/.test(source) || !/nodeCount: state\.nodeCount/.test(source) || !/edgeCount: state\.edges\.length/.test(source)) {
  throw new Error("I05 snapshot must expose applied layers, node count, and edge count.");
}

console.log("I05 visual clarity static check passed.");
