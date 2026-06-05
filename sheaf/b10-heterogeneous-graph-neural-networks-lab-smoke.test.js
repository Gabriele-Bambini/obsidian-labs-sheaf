const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'book_chapters', 'B10-heterogeneous-gnn-lab.html'), 'utf8');
for (const needle of [
  'Heterogeneous GNN Relation Routing Lab',
  'window.__B10_LAB_READY__',
  'window.__B10LabReady',
  'window.__B10LabSnapshot',
  'GRN multi-evidence',
  'HGT typed attention',
  'Type fidelity',
  'relation-specific routes'
]) {
  if (!html.includes(needle)) throw new Error(`Missing expected lab token: ${needle}`);
}
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (scripts.length !== 1) throw new Error(`Expected one inline script, found ${scripts.length}`);
new Function(scripts[0]);
console.log('B10 heterogeneous GNN lab smoke PASS');
