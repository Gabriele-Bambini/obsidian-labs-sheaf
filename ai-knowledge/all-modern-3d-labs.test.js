const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = __dirname;

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function labId(file) {
  const match = file.match(/^([a-z]\d{2})/i);
  assert(match, `Cannot infer lab id from ${file}`);
  return match[1].toLowerCase();
}

function classPattern(className) {
  return new RegExp(`class=["'][^"']*\\b${className}\\b[^"']*["']`, "i");
}

const labs = fs
  .readdirSync(root)
  .filter((file) => /^[a-i]\d{2}.*\.html$/i.test(file))
  .sort();

assert.strictEqual(labs.length, 113, "Expected all 113 interactive lab HTML files");

for (const file of labs) {
  const html = read(file);
  const id = labId(file);

  assert(html.includes('shared/three.min.js'), `${file}: missing shared Three.js runtime`);
  assert(html.includes('shared/gnn-lab-core.css'), `${file}: missing shared 3D CSS`);
  assert(html.includes('shared/gnn-lab-core.js'), `${file}: missing shared 3D engine`);
  assert(classPattern("gnn-lab").test(html), `${file}: missing gnn-lab root`);
  assert(classPattern("lab-shell").test(html), `${file}: missing lab-shell root`);
  assert(classPattern("lab-3d-shell").test(html), `${file}: missing lab-3d-shell root`);
  assert(classPattern("lab-viewport").test(html), `${file}: missing 3D viewport`);
  assert(/<canvas\b[^>]*\bid=["']canvas["'][^>]*>/i.test(html), `${file}: missing stable canvas`);
  assert(classPattern("command-bar").test(html), `${file}: missing command bar`);
  assert(classPattern("controls").test(html), `${file}: missing controls class`);
  assert(classPattern("state-box").test(html), `${file}: missing state box`);
  assert(/data-role=["']insight["']/i.test(html), `${file}: missing insight role`);
  assert(/data-role=["']selected["']/i.test(html), `${file}: missing selected role`);
  assert(/data-lab-kind=["'][^"']+["']/i.test(html), `${file}: missing semantic lab kind`);
  assert(new RegExp(`window\\.__${id}LabSnapshot\\s*=`, "i").test(html), `${file}: missing legacy snapshot alias`);
  assert(html.includes("createGnnLab("), `${file}: missing shared lab initializer`);

  const ranges = (html.match(/type=["']range["']/gi) || []).length;
  const actions = (html.match(/data-action=["'][^"']+["']/gi) || []).length;
  assert(ranges >= 5, `${file}: expected at least five live parameter ranges`);
  assert(actions >= 3, `${file}: expected Pulse/Step/Reset actions`);
}

console.log(`All ${labs.length} labs use the shared modern 3D Obsidian lab contract.`);
