const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "i03-quantum-algorithm-interference-lab.html"), "utf8");
const sharedPath = path.join(__dirname, "shared", "quantum-labs.js");
const shared = fs.existsSync(sharedPath) ? fs.readFileSync(sharedPath, "utf8") : "";
const source = `${html}\n${shared}`;

const requiredLabels = [
  /amber = marked state/,
  /radius = amplitude/,
  /phase wheel/,
  /oracle phase flip/,
  /diffuser reflection about mean/,
  /Grover rotation plane \|w> \/ \|r>/,
  /QFT periodic comb -> frequency peaks/,
  /phase estimation: controlled U powers/,
  /Shor N=15 period -> gcd/
];

for (const pattern of requiredLabels) {
  if (!pattern.test(source)) throw new Error(`I03 concrete visual label missing: ${pattern}`);
}

if (!/createI03QuantumAlgorithmLab\(\)/.test(html)) {
  throw new Error("I03 lab must call its concrete quantum algorithm renderer.");
}

for (const id of ["algorithm", "markedState", "stateCount", "period", "oracleStep", "diffuseStep", "switchAlgorithm", "runOptimal", "resetI03"]) {
  if (!new RegExp(`id="${id}"|getElementById\\("${id}"\\)`).test(source)) {
    throw new Error(`I03 concrete control missing: ${id}`);
  }
}

if (!/applyOraclePhaseFlip/.test(source) || !/applyDiffuserReflection/.test(source) || !/drawQftPeriodComb/.test(source)) {
  throw new Error("I03 controls must implement oracle phase flip, diffuser reflection, and QFT period comb.");
}

if (!/targetProbability: state\.targetProbability/.test(source) || !/algorithm: state\.algorithm/.test(source) || !/iteration: state\.iteration/.test(source)) {
  throw new Error("I03 snapshot must expose algorithm, iteration, and marked-state probability.");
}

console.log("I03 visual clarity static check passed.");
