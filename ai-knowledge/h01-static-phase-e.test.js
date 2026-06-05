const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const labPath = path.join(__dirname, "h01-introduction-sheaf-theory-lab.html");
const notePath = path.join(root, "H01- Introduction to Sheaf Theory.md");
const indexPath = path.join(root, "00_INTERACTIVE_LABS.md");

const lab = fs.readFileSync(labPath, "utf8");
const note = fs.readFileSync(notePath, "utf8");
const index = fs.readFileSync(indexPath, "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(/class="lab-shell lab-3d-shell"/.test(lab), "H01 lab must expose shared lab-shell plus lab-3d-shell classes.");
assert(lab.includes("class=\"lab-viewport\""), "H01 lab must use the shared lab-viewport container.");
assert(lab.includes("class=\"control-grid controls\""), "H01 lab must expose controls for the global verifier.");
assert(lab.includes("__h01LabReady"), "H01 lab must publish a readiness hook.");
assert(lab.includes("__h01LabSnapshot"), "H01 lab must publish a snapshot hook.");
assert(lab.includes("preserveDrawingBuffer"), "H01 WebGL renderer should preserve the drawing buffer for smoke screenshots.");
assert(note.includes('src="http://127.0.0.1:8765/h01-introduction-sheaf-theory-lab.html"'), "H01 note must embed the local-server lab URL.");
assert(note.includes('height="720"'), "H01 iframe must use the 720px document-pane standard.");
assert(note.includes("background:#071015"), "H01 iframe must use a dark background to avoid white-pane flashes.");
assert(index.includes("[[H01- Introduction to Sheaf Theory|H01- Introduction to Sheaf Theory]]"), "Visible Markdown lab index must include H01.");
assert(index.includes("h01-introduction-sheaf-theory-lab.html"), "Visible Markdown lab index must link to H01 lab HTML.");

console.log("H01 static Phase E checks passed.");
