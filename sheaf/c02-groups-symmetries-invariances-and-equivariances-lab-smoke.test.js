const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'book_chapters', 'C02-symmetry-equivariance-biology-lab.html'), 'utf8');
for (const needle of [
  'Symmetry Equivariance Biology Lab',
  'window.__C02_LAB_READY__',
  'window.__C02LabReady',
  'window.__C02LabSnapshot',
  'f(g.x) = rho(g) f(x)',
  'Biological domain',
  'Transformation',
  'Output claim',
  'Invalid symmetry risk',
  'direction reversal',
  'type swap'
]) {
  if (!html.includes(needle)) throw new Error(`Missing expected lab token: ${needle}`);
}
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (scripts.length !== 1) throw new Error(`Expected 1 inline script, found ${scripts.length}`);
new Function(scripts[0]);
console.log('C02 symmetry equivariance biology lab smoke PASS');
