const fs = require("fs");
const path = require("path");

const root = __dirname;
const lab = fs.readFileSync(path.join(root, "i02-qubit-bloch-sphere.html"), "utf8");
const note = fs.readFileSync(path.join(root, "..", "I02 - Qubits, Quantum Gates and Circuits.md"), "utf8");
const index = fs.readFileSync(path.join(root, "..", "00_INTERACTIVE_LABS.md"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(/class="lab-shell lab-3d-shell"/.test(lab), "I02 lab must expose shared lab-shell plus lab-3d-shell classes.");
assert(/class="lab-viewport"/.test(lab), "I02 lab must wrap the canvas in a lab-viewport container.");
assert(/id="canvas"/.test(lab), "I02 lab must keep the existing canvas id.");
assert(/data-gate="H"/.test(lab) && /id="bell"/.test(lab), "I02 lab must preserve gate and Bell controls.");
assert(/__i02LabReady/.test(lab), "I02 lab must expose a ready hook for iframe smoke tests.");
assert(/__i02LabSnapshot/.test(lab), "I02 lab must expose a snapshot hook for iframe smoke tests.");
assert(/background:#071015/.test(note), "I02 note iframe must use the dark document-pane background.");
assert(/src="http:\/\/127\.0\.0\.1:8765\/i02-qubit-bloch-sphere\.html"/.test(note), "I02 note must use the local-server iframe URL.");
assert(/height="720"/.test(note), "I02 note iframe must use the 720px document-pane height.");
assert(/\[\[I02 - Qubits, Quantum Gates and Circuits\|I02 - Qubits, Quantum Gates and Circuits\]\]/.test(index), "Visible Markdown lab index must include I02.");
assert(/<_interactive\/i02-qubit-bloch-sphere\.html>/.test(index), "Visible Markdown lab index must link to the I02 HTML file.");

console.log("i02 static Phase E check passed.");
