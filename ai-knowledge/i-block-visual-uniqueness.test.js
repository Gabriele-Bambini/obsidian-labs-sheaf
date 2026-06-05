const fs = require("fs");
const path = require("path");

const labs = [
  ["I01", "i01-quantum-state-measurement.html", "bloch-probability"],
  ["I02", "i02-qubit-bloch-sphere.html", "gate-circuit"],
  ["I03", "i03-quantum-algorithm-interference-lab.html", "interference-spectrum"],
  ["I04", "i04-variational-quantum-circuit-lab.html", "vqlm-landscape"],
  ["I05", "i05-quantum-graph-circuit-lab.html", "qgnn-network"],
  ["I06", "i06-quantum-advantage-boundary-lab.html", "advantage-boundary"]
];

const seenProfiles = new Set();

for (const [code, file, profile] of labs) {
  const html = fs.readFileSync(path.join(__dirname, file), "utf8");

  if (!html.includes(`data-visual-profile="${profile}"`)) {
    throw new Error(`${code} must declare unique visual profile ${profile}.`);
  }
  if (!html.includes(`scene-${profile}`)) {
    throw new Error(`${code} must render a unique scene marker scene-${profile}.`);
  }
  if (seenProfiles.has(profile)) {
    throw new Error(`${code} duplicates visual profile ${profile}.`);
  }
  seenProfiles.add(profile);
}

if (seenProfiles.size !== labs.length) {
  throw new Error(`Expected ${labs.length} unique Block I visual profiles, found ${seenProfiles.size}.`);
}

console.log(`I-block visual uniqueness checks passed for ${labs.length} labs.`);
