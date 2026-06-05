const fs = require("fs");
const path = require("path");

const root = __dirname;
const lab = fs.readFileSync(path.join(root, "i03-quantum-algorithm-interference-lab.html"), "utf8");
const note = fs.readFileSync(path.join(root, "..", "I03 - Fundamental Quantum Algorithms.md"), "utf8");
const index = fs.readFileSync(path.join(root, "..", "00_INTERACTIVE_LABS.md"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(/class="lab-shell lab-3d-shell"/.test(lab), "I03 lab must expose shared lab-shell plus lab-3d-shell classes.");
assert(/class="lab-viewport"/.test(lab), "I03 lab must wrap the canvas in a lab-viewport container.");
assert(/id="canvas"/.test(lab), "I03 lab must keep the existing canvas id.");
assert(/id="oracleStep"/.test(lab) && /id="diffuseStep"/.test(lab) && /id="switchAlgorithm"/.test(lab), "I03 lab must preserve Grover/QFT controls.");
assert(/__i03LabReady/.test(lab), "I03 lab must expose a ready hook for iframe smoke tests.");
assert(/__i03LabSnapshot/.test(lab), "I03 lab must expose a snapshot hook for iframe smoke tests.");
assert(/background:#071015/.test(note), "I03 note iframe must use the dark document-pane background.");
assert(/src="http:\/\/127\.0\.0\.1:8765\/i03-quantum-algorithm-interference-lab\.html"/.test(note), "I03 note must use the local-server iframe URL.");
assert(/height="720"/.test(note), "I03 note iframe must use the 720px document-pane height.");
assert(/\[\[I03 - Fundamental Quantum Algorithms\|I03 - Fundamental Quantum Algorithms\]\]/.test(index), "Visible Markdown lab index must include I03.");
assert(/<_interactive\/i03-quantum-algorithm-interference-lab\.html>/.test(index), "Visible Markdown lab index must link to the I03 HTML file.");

console.log("i03 static Phase E check passed.");
