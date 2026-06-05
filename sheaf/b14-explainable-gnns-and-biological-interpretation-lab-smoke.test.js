const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'book_chapters', 'B14-explainable-gnn-biology-lab.html'), 'utf8');
for (const needle of [
  'Explainable GNN Biology Lab',
  'window.__B14_LAB_READY__',
  'window.__B14LabReady',
  'window.__B14LabSnapshot',
  'GNNExplainer',
  'PGExplainer',
  'GraphMask',
  'SubgraphX',
  'Faithfulness',
  'Overclaim risk'
]) {
  if (!html.includes(needle)) throw new Error(`Missing expected lab token: ${needle}`);
}
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (scripts.length !== 1) throw new Error(`Expected 1 inline script, found ${scripts.length}`);
new Function(scripts[0]);
console.log('B14 explainable GNN biology lab smoke PASS');
