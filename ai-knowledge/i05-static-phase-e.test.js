const fs = require("fs");
const path = require("path");

const root = __dirname;
const lab = fs.readFileSync(path.join(root, "i05-quantum-graph-circuit-lab.html"), "utf8");
const note = fs.readFileSync(path.join(root, "..", "I05 - Quantum Graph Neural Networks.md"), "utf8");
const index = fs.readFileSync(path.join(root, "..", "00_INTERACTIVE_LABS.md"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(/class="lab-shell lab-3d-shell"/.test(lab), "I05 lab must expose shared lab-shell plus lab-3d-shell classes.");
assert(/class="lab-viewport"/.test(lab), "I05 lab must wrap the canvas in a lab-viewport container.");
assert(/id="canvas"/.test(lab), "I05 lab must keep the existing canvas id.");
assert(/id="applyLayer"/.test(lab) && /id="runDepth"/.test(lab) && /id="measure"/.test(lab), "I05 lab must preserve quantum graph circuit controls.");
assert(/id="toggleEdges"/.test(lab) && /id="randomize"/.test(lab), "I05 lab must preserve graph ablation controls.");
assert(/__i05LabReady/.test(lab), "I05 lab must expose a ready hook for iframe smoke tests.");
assert(/__i05LabSnapshot/.test(lab), "I05 lab must expose a snapshot hook for iframe smoke tests.");
assert(/background:#071015/.test(note), "I05 note iframe must use the dark document-pane background.");
assert(/src="http:\/\/127\.0\.0\.1:8765\/i05-quantum-graph-circuit-lab\.html"/.test(note), "I05 note must use the local-server iframe URL.");
assert(/height="720"/.test(note), "I05 note iframe must use the 720px document-pane height.");
assert(/\[\[I05 - Quantum Graph Neural Networks\|I05 - Quantum Graph Neural Networks\]\]/.test(index), "Visible Markdown lab index must include I05.");
assert(/<_interactive\/i05-quantum-graph-circuit-lab\.html>/.test(index), "Visible Markdown lab index must link to the I05 HTML file.");

console.log("i05 static Phase E check passed.");
