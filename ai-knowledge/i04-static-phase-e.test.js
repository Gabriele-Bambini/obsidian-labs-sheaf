const fs = require("fs");
const path = require("path");

const root = __dirname;
const lab = fs.readFileSync(path.join(root, "i04-variational-quantum-circuit-lab.html"), "utf8");
const note = fs.readFileSync(path.join(root, "..", "I04 - Quantum Machine Learning.md"), "utf8");
const index = fs.readFileSync(path.join(root, "..", "00_INTERACTIVE_LABS.md"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(/class="lab-shell lab-3d-shell"/.test(lab), "I04 lab must expose shared lab-shell plus lab-3d-shell classes.");
assert(/class="lab-viewport"/.test(lab), "I04 lab must wrap the canvas in a lab-viewport container.");
assert(/id="canvas"/.test(lab), "I04 lab must keep the existing canvas id.");
assert(/id="trainStep"/.test(lab) && /id="runBatch"/.test(lab) && /id="addLayer"/.test(lab), "I04 lab must preserve variational training controls.");
assert(/__i04LabReady/.test(lab), "I04 lab must expose a ready hook for iframe smoke tests.");
assert(/__i04LabSnapshot/.test(lab), "I04 lab must expose a snapshot hook for iframe smoke tests.");
assert(/background:#071015/.test(note), "I04 note iframe must use the dark document-pane background.");
assert(/src="http:\/\/127\.0\.0\.1:8765\/i04-variational-quantum-circuit-lab\.html"/.test(note), "I04 note must use the local-server iframe URL.");
assert(/height="720"/.test(note), "I04 note iframe must use the 720px document-pane height.");
assert(/\[\[I04 - Quantum Machine Learning\|I04 - Quantum Machine Learning\]\]/.test(index), "Visible Markdown lab index must include I04.");
assert(/<_interactive\/i04-variational-quantum-circuit-lab\.html>/.test(index), "Visible Markdown lab index must link to the I04 HTML file.");

console.log("i04 static Phase E check passed.");
