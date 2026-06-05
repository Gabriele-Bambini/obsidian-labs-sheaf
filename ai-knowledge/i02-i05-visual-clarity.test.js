const fs = require("fs");
const path = require("path");

const checks = [
  ["i02-qubit-bloch-sphere.html", ["Bloch vector", "p(0) / p(1)", "selected gate"]],
  ["i03-quantum-algorithm-interference-lab.html", ["amber = marked state", "radius = amplitude", "phase wheel"]],
  ["i04-variational-quantum-circuit-lab.html", ["theta", "phi", "clean gradients", "noisy gradients"]],
  ["i05-quantum-graph-circuit-lab.html", ['text2("q" + i', "entangling layers", "node lift changes"]]
];

const failures = [];
for (const [file, needles] of checks) {
  const source = fs.readFileSync(path.join(__dirname, file), "utf8");
  for (const needle of needles) {
    if (!source.includes(needle)) failures.push(`${file}: missing visual label "${needle}"`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  throw new Error("I02-I05 visual clarity labels are incomplete.");
}

console.log("I02-I05 visual clarity labels passed.");
