const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'book_chapters', 'B12-hypergraph-incidence-lab.html'), 'utf8');
for (const needle of [
  'Hypergraph Incidence Biology Lab',
  'window.__B12_LAB_READY__',
  'window.__B12LabReady',
  'window.__B12LabSnapshot',
  'incidence matrix',
  'pairwise edges if expanded',
  'pathway gene set',
  'AllSet message flow'
]) {
  if (!html.includes(needle)) throw new Error(`Missing expected lab token: ${needle}`);
}
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (scripts.length !== 1) throw new Error(`Expected one inline script, found ${scripts.length}`);
new Function(scripts[0]);
console.log('B12 hypergraph incidence biology lab smoke PASS');
