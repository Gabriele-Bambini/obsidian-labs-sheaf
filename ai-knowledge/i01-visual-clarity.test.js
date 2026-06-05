const fs = require("fs");
const path = require("path");

const htmlPath = path.join(__dirname, "i01-quantum-state-measurement.html");
const html = fs.readFileSync(htmlPath, "utf8");
const sharedPath = path.join(__dirname, "shared", "quantum-labs.js");
const shared = fs.existsSync(sharedPath) ? fs.readFileSync(sharedPath, "utf8") : "";
const source = `${html}\n${shared}`;

const requiredTeachingLabels = [
  /1\. State \|psi>/,
  /2\. Measurement basis/,
  /3\. Born rule -> samples/,
  /Bloch sphere/,
  /density matrix/,
  /basis axis:/,
  /current state vector/,
  /p\(0 in /,
  /p\(1 in /,
  /sample dots: blue=0, amber=1/,
  /zeros \/ /,
  /ones from /
];

for (const pattern of requiredTeachingLabels) {
  if (!pattern.test(source)) {
    throw new Error(`I01 visual clarity label missing: ${pattern}`);
  }
}

if (!/createI01QuantumMeasurementLab\(\)/.test(html)) {
  throw new Error("I01 lab must call its concrete quantum measurement renderer.");
}

if (!/drawBlochShell\(theta, phi, basis, probability, shots, ones\)/.test(source)) {
  throw new Error("I01 visualization must connect theta/phase/basis/probability/shots into one measurement flow.");
}

for (const id of ["theta", "phi", "basis", "shots", "coherence", "hadamard", "measureY", "fireShot", "resetI01"]) {
  if (!new RegExp(`id="${id}"|getElementById\\("${id}"\\)`).test(source)) {
    throw new Error(`I01 concrete control missing: ${id}`);
  }
}

if (!/theta: state\.theta/.test(source) || !/ones: state\.ones/.test(source) || !/coherence: state\.coherence/.test(source)) {
  throw new Error("I01 snapshot must expose visual state fields for smoke checks.");
}

console.log("I01 visual clarity static check passed.");
