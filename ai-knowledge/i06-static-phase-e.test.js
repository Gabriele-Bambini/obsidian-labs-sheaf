const fs = require("fs");
const path = require("path");

const root = __dirname;
const lab = fs.readFileSync(path.join(root, "i06-quantum-advantage-boundary-lab.html"), "utf8");
const note = fs.readFileSync(path.join(root, "..", "I06 - Quantum Advantage and Computational Limits.md"), "utf8");
const index = fs.readFileSync(path.join(root, "..", "00_INTERACTIVE_LABS.md"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(/class="lab-shell lab-3d-shell"/.test(lab), "I06 lab must expose shared lab-shell plus lab-3d-shell classes.");
assert(/class="lab-viewport"/.test(lab), "I06 lab must wrap the canvas in a lab-viewport container.");
assert(/id="canvas"/.test(lab), "I06 lab must keep the canonical canvas id.");
assert(/id="problem"/.test(lab) && /id="size"/.test(lab) && /id="noise"/.test(lab), "I06 lab must preserve advantage boundary controls.");
assert(/id="switchProblem"/.test(lab) && /id="addCorrection"/.test(lab) && /id="project"/.test(lab), "I06 lab must preserve problem/QEC/projection actions.");
assert(/__i06LabReady\s*=\s*true/.test(lab), "I06 lab must expose a ready hook for iframe smoke tests.");
assert(/__i06LabSnapshot/.test(lab), "I06 lab must expose a snapshot hook for iframe smoke tests.");
assert(/cameraTheta|orbit|project\(/i.test(lab), "I06 lab must expose orbitable 3D geometry.");
assert(/background:#071015/.test(note), "I06 note iframe must use the dark document-pane background.");
assert(/src="http:\/\/127\.0\.0\.1:8765\/i06-quantum-advantage-boundary-lab\.html"/.test(note), "I06 note must use the local-server iframe URL.");
assert(/height="720"/.test(note), "I06 note iframe must use the 720px document-pane height.");
assert(/\[\[I06 - Quantum Advantage and Computational Limits\|I06 - Quantum Advantage and Computational Limits\]\]/.test(index), "Visible Markdown lab index must include I06.");
assert(/<_interactive\/i06-quantum-advantage-boundary-lab\.html>/.test(index), "Visible Markdown lab index must link to the I06 HTML file.");

console.log("i06 static Phase E check passed.");
