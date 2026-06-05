const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'book_chapters', 'C01-geometric-blueprint-biology-lab.html'), 'utf8');
for (const needle of [
  'Geometric Blueprint Biology Lab',
  'window.__C01_LAB_READY__',
  'window.__C01LabReady',
  'window.__C01LabSnapshot',
  'f(g.x) = rho_out(g) f(x)',
  'Domain',
  'Biology example',
  'Equivariance fit',
  'Overclaim risk'
]) {
  if (!html.includes(needle)) throw new Error(`Missing expected lab token: ${needle}`);
}
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (scripts.length !== 1) throw new Error(`Expected 1 inline script, found ${scripts.length}`);
new Function(scripts[0]);
console.log('C01 geometric blueprint biology lab smoke PASS');
