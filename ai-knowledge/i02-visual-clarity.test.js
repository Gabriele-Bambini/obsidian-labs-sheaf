const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "i02-qubit-bloch-sphere.html");
const html = fs.readFileSync(htmlPath, "utf8");
const sharedPath = path.join(__dirname, "shared", "quantum-labs.js");
const shared = fs.existsSync(sharedPath) ? fs.readFileSync(sharedPath, "utf8") : "";
const source = `${html}\n${shared}`;

const requiredTeachingLabels = [
  /Bloch vector/,
  /p\(0\) \/ p\(1\)/,
  /selected gate/,
  /gate rotation arc/,
  /q0 -- H --/,
  /CNOT control/,
  /Bell pair amplitudes/,
  /tensor-product basis/,
  /measurement histogram/
];

for (const pattern of requiredTeachingLabels) {
  if (!pattern.test(source)) {
    throw new Error(`I02 visual clarity label missing: ${pattern}`);
  }
}

if (!/createI02QuantumGatesCircuitLab\(\)/.test(html)) {
  throw new Error("I02 lab must call its concrete qubit gates and circuit renderer.");
}

for (const id of ["gateSelect", "rotationAngle", "shotCount", "entangleStrength", "data-gate=\"H\"", "stepGate", "bell", "measureCircuit", "resetI02"]) {
  if (!new RegExp(id).test(source)) {
    throw new Error(`I02 concrete control missing: ${id}`);
  }
}

if (!/applyGate\(selectedGate/.test(source) || !/buildBellCircuit/.test(source)) {
  throw new Error("I02 controls must apply real gate rotations and build the Bell/CNOT circuit.");
}

if (!/p0: state\.p0/.test(source) || !/mode: state\.mode/.test(source) || !/selectedGate: state\.selectedGate/.test(source)) {
  throw new Error("I02 snapshot must expose state probabilities, mode, and selected gate.");
}

console.log("I02 visual clarity static check passed.");
