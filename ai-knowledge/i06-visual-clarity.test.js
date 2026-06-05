const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "i06-quantum-advantage-boundary-lab.html"), "utf8");
const sharedPath = path.join(__dirname, "shared", "quantum-labs.js");
const shared = fs.existsSync(sharedPath) ? fs.readFileSync(sharedPath, "utf8") : "";
const source = `${html}\n${shared}`;

const requiredLabels = [
  /theoretical speedup/,
  /useful advantage boundary/,
  /BPP \/ BQP \/ NP map/,
  /query count vs wall-clock/,
  /NISQ noise wall/,
  /error correction overhead stack/,
  /data loading bottleneck/,
  /measurement shot bottleneck/,
  /classical baseline moving target/,
  /output bandwidth limit/
];

for (const pattern of requiredLabels) {
  if (!pattern.test(source)) throw new Error(`I06 concrete visual label missing: ${pattern}`);
}

if (!/createI06QuantumAdvantageBoundaryLab\(\)/.test(html)) {
  throw new Error("I06 lab must call its concrete quantum advantage renderer.");
}

for (const id of ["problem", "size", "noise", "qecOverhead", "baseline", "loadingCost", "shots", "switchProblem", "addCorrection", "project", "resetI06"]) {
  if (!new RegExp(`id="${id}"|getElementById\\("${id}"\\)`).test(source)) {
    throw new Error(`I06 concrete control missing: ${id}`);
  }
}

if (!/drawScalingCurves/.test(source) || !/drawComplexityClassMap/.test(source) || !/drawAdvantageStack/.test(source)) {
  throw new Error("I06 must implement scaling curves, complexity class map, and advantage stack visuals.");
}

if (!/problem: state\.problem/.test(source) || !/size: state\.size/.test(source) || !/corrected: state\.corrected/.test(source) || !/advantageScore: state\.advantageScore/.test(source)) {
  throw new Error("I06 snapshot must expose problem, size, QEC correction, and advantage score.");
}

console.log("I06 visual clarity static check passed.");
