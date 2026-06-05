const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'book_chapters', 'B07-graph-transformer-attention-lab.html'), 'utf8');
for (const needle of [
  'Graph Transformer Global Attention Lab',
  'window.__B07_LAB_READY__',
  'window.__B07LabReady',
  'window.__B07LabSnapshot',
  'GRN long-range regulation',
  'Graphormer bias',
  'GPS local+global',
  'structural bias audit'
]) {
  if (!html.includes(needle)) throw new Error(`Missing expected lab token: ${needle}`);
}
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (scripts.length !== 1) throw new Error(`Expected one inline script, found ${scripts.length}`);
new Function(scripts[0]);
console.log('B07 graph transformer lab smoke PASS');
