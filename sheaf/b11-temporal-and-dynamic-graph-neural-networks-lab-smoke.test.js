const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'book_chapters', 'B11-temporal-dynamic-gnn-lab.html'), 'utf8');
for (const needle of [
  'Temporal Dynamic GNN Evidence Clock Lab',
  'window.__B11_LAB_READY__',
  'window.__B11LabReady',
  'window.__B11LabSnapshot',
  'differentiation',
  'TGN memory',
  'Future leakage risk',
  'timed graph events'
]) {
  if (!html.includes(needle)) throw new Error(`Missing expected lab token: ${needle}`);
}
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (scripts.length !== 1) throw new Error(`Expected one inline script, found ${scripts.length}`);
new Function(scripts[0]);
console.log('B11 temporal dynamic GNN lab smoke PASS');
