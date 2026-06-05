const fs = require("fs");
const path = require("path");

const root = __dirname;
const lab = fs.readFileSync(path.join(root, "h07-sheaf-neural-networks-lab.html"), "utf8");
const note = fs.readFileSync(path.join(root, "..", "H07 - Sheaf Neural Networks.md"), "utf8");
const index = fs.readFileSync(path.join(root, "..", "00_INTERACTIVE_LABS.md"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(/class="lab-shell lab-3d-shell"/.test(lab), "H07 lab must expose shared lab-shell plus lab-3d-shell classes.");
assert(lab.includes('class="lab-viewport"'), "H07 lab must use the shared lab-viewport container.");
assert(lab.includes('id="learnMaps"'), "H07 lab must preserve the learnMaps selector.");
assert(lab.includes('id="stepLayer"'), "H07 lab must preserve the stepLayer selector.");
assert(lab.includes('id="stateBox"'), "H07 lab must preserve readable state text.");
assert(lab.includes("__h07LabReady") && lab.includes("__h07LabSnapshot"), "H07 lab must expose ready/snapshot hooks.");
assert(note.includes('src="http://127.0.0.1:8765/h07-sheaf-neural-networks-lab.html"'), "H07 note must use the local lab server iframe URL.");
assert(/height="720"/i.test(note), "H07 iframe must use the 720px document-pane height.");
assert(/background:#071015/i.test(note), "H07 iframe must keep the dark document-pane background.");
assert(index.includes("[[H07 - Sheaf Neural Networks|H07 - Sheaf Neural Networks]]"), "H07 must appear in the visible Markdown lab index.");
assert(index.includes("[Open H07 lab HTML](<_interactive/h07-sheaf-neural-networks-lab.html>)"), "H07 visible index entry must include the lab HTML link.");

console.log("h07 static Phase E check passed.");
