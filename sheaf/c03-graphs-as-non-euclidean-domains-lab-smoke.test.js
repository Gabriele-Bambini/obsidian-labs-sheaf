const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'book_chapters', 'C03-non-euclidean-biology-lab.html'), 'utf8');
for (const needle of [
  'Non Euclidean Biology Graph Lab',
  'window.__C03_LAB_READY__',
  'window.__C03LabReady',
  'window.__C03LabSnapshot',
  'B_k(v) = {u : d_G(u,v) <= k}',
  'Biological graph',
  'Geometry lens',
  'Laplacian diffusion',
  'embedding distortion',
  'Locality fidelity'
]) {
  if (!html.includes(needle)) throw new Error(`Missing expected lab token: ${needle}`);
}
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (scripts.length !== 1) throw new Error(`Expected 1 inline script, found ${scripts.length}`);
new Function(scripts[0]);
console.log('C03 non-Euclidean biology graph lab smoke PASS');
