const fs = require("fs");
const path = require("path");

const root = __dirname;
const lab = fs.readFileSync(path.join(root, "h02-sheaf-gluing-lab.html"), "utf8");
const note = fs.readFileSync(path.join(root, "..", "H02 - Sheaves on Topological Spaces.md"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(/class="lab-shell lab-3d-shell"/.test(lab), "H02 lab must expose shared lab-shell plus lab-3d-shell classes.");
assert(lab.includes('class="lab-viewport"'), "H02 lab must use the shared lab-viewport container.");
assert(lab.includes('id="glueSections"'), "H02 lab must preserve the glueSections selector.");
assert(lab.includes('id="testGlue"'), "H02 lab must preserve the testGlue selector.");
assert(lab.includes('id="stateBox"'), "H02 lab must preserve readable state text.");
assert(lab.includes("__h02LabReady") && lab.includes("__h02LabSnapshot"), "H02 lab must expose ready/snapshot hooks.");
assert(note.includes('src="http://127.0.0.1:8765/h02-sheaf-gluing-lab.html"'), "H02 note must use the local lab server iframe URL.");
assert(/height="720"/i.test(note), "H02 iframe must use the 720px document-pane height.");
assert(/background:#071015/i.test(note), "H02 iframe must keep the dark document-pane background.");

console.log("h02 static Phase E check passed.");
