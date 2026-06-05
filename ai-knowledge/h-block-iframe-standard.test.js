const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

const targets = [
  {
    note: "H12 - Applications of Sheaf GNNs.md",
    lab: "h12-sheaf-applications-domain-lab.html"
  },
  {
    note: "H13 - Directed Sheaves and Sheaves on Hypergraphs.md",
    lab: "h13-directed-hypergraph-sheaf-lab.html"
  },
  {
    note: "H14 - Sheaves and Persistent Topology.md",
    lab: "h14-persistent-sheaf-topology-lab.html"
  },
  {
    note: "H15 - Research Frontier in Sheaf GNNs.md",
    lab: "h15-sheaf-research-frontier-lab.html"
  }
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const target of targets) {
  const note = fs.readFileSync(path.join(root, target.note), "utf8");
  const expectedSource = `src="http://127.0.0.1:8765/${target.lab}"`;
  assert(note.includes(expectedSource), `${target.note} must use local-server iframe source ${target.lab}.`);
  assert(/<iframe[^>]+height="720"/i.test(note), `${target.note} iframe must use the 720px document-pane height.`);
  assert(/<iframe[^>]+background:#071015/i.test(note), `${target.note} iframe must keep the dark document-pane background.`);
  assert(note.includes(`[[_interactive/${target.lab}]]`), `${target.note} must keep the Obsidian file fallback link.`);
}

console.log("H12-H15 iframe source standard check passed.");
