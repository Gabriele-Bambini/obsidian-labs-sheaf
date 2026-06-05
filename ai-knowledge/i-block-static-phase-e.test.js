const fs = require("fs");
const path = require("path");

const root = __dirname;

const labs = [
  ["I01- Quantum Mechanics Foundations.md", "i01-quantum-state-measurement.html", "__i01LabReady", "__i01LabSnapshot", ["statePreset", "basis", "measure"]],
  ["I02 - Qubits, Quantum Gates and Circuits.md", "i02-qubit-bloch-sphere.html", "__i02LabReady", "__i02LabSnapshot", ["theta", "phi", "gate", "measure"]],
  ["I03 - Fundamental Quantum Algorithms.md", "i03-quantum-algorithm-interference-lab.html", "__i03LabReady", "__i03LabSnapshot", ["algorithm", "oracle", "step"]],
  ["I04 - Quantum Machine Learning.md", "i04-variational-quantum-circuit-lab.html", "__i04LabReady", "__i04LabSnapshot", ["dataset", "ansatz", "train"]],
  ["I05 - Quantum Graph Neural Networks.md", "i05-quantum-graph-circuit-lab.html", "__i05LabReady", "__i05LabSnapshot", ["graph", "applyLayer", "measure"]],
  ["I06 - Quantum Advantage and Computational Limits.md", "i06-quantum-advantage-boundary-lab.html", "__i06LabReady", "__i06LabSnapshot", ["problem", "noise", "size"]]
];

function mustMatch(text, pattern, message) {
  if (!pattern.test(text)) throw new Error(message);
}

for (const [noteName, labName, readyHook, snapshotHook, controls] of labs) {
  const labPath = path.join(root, labName);
  const notePath = path.join(root, "..", noteName);
  const lab = fs.readFileSync(labPath, "utf8");
  const note = fs.readFileSync(notePath, "utf8");
  const prefix = labName.replace(/\.html$/, "");

  mustMatch(lab, /lab-shell\s+lab-3d-shell/, `${prefix}: missing dark Phase E 3D shell.`);
  mustMatch(lab, /class="[^"]*lab-viewport[^"]*"/, `${prefix}: missing lab viewport.`);
  mustMatch(lab, /class="[^"]*side-panel[^"]*lab-3d-panel[^"]*"/, `${prefix}: missing shared side-panel/lab-3d-panel controls.`);
  mustMatch(lab, /<canvas[^>]+id="canvas"/, `${prefix}: missing canonical canvas#canvas.`);
  mustMatch(lab, new RegExp(`${readyHook}\\s*=\\s*true`), `${prefix}: missing ready hook ${readyHook}.`);
  mustMatch(lab, new RegExp(snapshotHook), `${prefix}: missing snapshot hook ${snapshotHook}.`);
  mustMatch(lab, /cameraTheta|orbit|project\(/i, `${prefix}: missing orbitable 3D camera state.`);
  mustMatch(lab, /id="state"|state-box/i, `${prefix}: missing explanatory state text.`);
  if (/class="[^"]*control-dock[^"]*"/.test(lab)) throw new Error(`${prefix}: must not use the custom Block I control dock.`);
  mustMatch(lab, /overflow:hidden/, `${prefix}: lab must keep document-pane overflow hidden.`);
  mustMatch(lab, /quantum|qubit|amplitude|measurement|circuit|advantage/i, `${prefix}: lab text does not teach the Block I topic.`);
  for (const control of controls) {
    mustMatch(lab, new RegExp(`id="${control}"`), `${prefix}: missing expected control #${control}.`);
  }

  const escapedLab = labName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const iframeMatch = note.match(new RegExp(`<iframe[^>]+src="([^"]+${escapedLab})"[^>]*>`, "i"));
  if (!iframeMatch) throw new Error(`${noteName}: missing iframe for ${labName}.`);
  if (iframeMatch[1] !== `http://127.0.0.1:8765/${labName}`) {
    throw new Error(`${noteName}: iframe must use local-server URL for ${labName}, found ${iframeMatch[1]}.`);
  }
  mustMatch(iframeMatch[0], /height="720"/i, `${noteName}: iframe must use 720px height.`);
  mustMatch(iframeMatch[0], /background:#071015/i, `${noteName}: iframe must declare dark document-pane background.`);
  mustMatch(note, new RegExp(`<_interactive/${escapedLab}>`), `${noteName}: missing direct Obsidian fallback link for ${labName}.`);
}

console.log(`I-block static Phase E checks passed for ${labs.length} labs.`);
