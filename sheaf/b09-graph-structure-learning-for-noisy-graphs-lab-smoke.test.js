const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'book_chapters', 'B09-graph-structure-learning-lab.html'), 'utf8');
for (const needle of [
  'Graph Structure Learning Lab',
  'window.__B09_LAB_READY__',
  'window.__B09LabReady',
  'window.__B09LabSnapshot',
  'GRN co-expression prior',
  'prior-aware GSL',
  'Hallucination risk',
  'score matrix before threshold'
]) {
  if (!html.includes(needle)) throw new Error(`Missing expected lab token: ${needle}`);
}
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (scripts.length !== 1) throw new Error(`Expected one inline script, found ${scripts.length}`);
new Function(scripts[0]);
console.log('B09 graph structure learning lab smoke PASS');
