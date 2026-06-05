const fs = require("fs");
const path = require("path");

const root = __dirname;
const lab = fs.readFileSync(path.join(root, "i01-quantum-state-measurement.html"), "utf8");
const note = fs.readFileSync(path.join(root, "..", "I01- Quantum Mechanics Foundations.md"), "utf8");
const index = fs.readFileSync(path.join(root, "..", "00_INTERACTIVE_LABS.md"), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(/class="lab-shell lab-3d-shell"/.test(lab), "I01 lab must expose shared lab-shell plus lab-3d-shell classes.");
assert(lab.includes('class="lab-viewport"'), "I01 lab must use the shared lab-viewport container.");
assert(lab.includes('id="measure"'), "I01 lab must preserve the Measure Z action.");
assert(lab.includes('id="hadamard"'), "I01 lab must preserve the X-basis action.");
assert(lab.includes('id="measureY"'), "I01 lab must preserve the Y-basis action.");
assert(lab.includes('id="state"'), "I01 lab must preserve readable state text.");
assert(lab.includes("__i01LabReady") && lab.includes("__i01LabSnapshot"), "I01 lab must expose ready/snapshot hooks.");
assert(note.includes('src="http://127.0.0.1:8765/i01-quantum-state-measurement.html"'), "I01 note must use the local lab server iframe URL.");
assert(/height="720"/i.test(note), "I01 iframe must use the 720px document-pane height.");
assert(/background:#071015/i.test(note), "I01 iframe must keep the dark document-pane background.");
assert(index.includes("[[I01- Quantum Mechanics Foundations|I01- Quantum Mechanics Foundations]]"), "I01 must appear in the visible Markdown lab index.");
assert(index.includes("[Open I01 lab HTML](<_interactive/i01-quantum-state-measurement.html>)"), "I01 visible index entry must include the lab HTML link.");

console.log("i01 static Phase E check passed.");
