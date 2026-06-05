const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'book_chapters', 'B13-graph-ssl-biology-lab.html'), 'utf8');
for (const needle of [
  'Graph SSL Biology Lab',
  'window.__B13_LAB_READY__',
  'window.__B13LabReady',
  'window.__B13LabSnapshot',
  'contrastive InfoNCE',
  'masked feature reconstruction',
  'Biology graph',
  'Leakage risk',
  'safe views'
]) {
  if (!html.includes(needle)) throw new Error(`Missing expected lab token: ${needle}`);
}
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (scripts.length !== 1) throw new Error(`Expected 1 inline script, found ${scripts.length}`);
new Function(scripts[0]);
console.log('B13 graph SSL biology lab smoke PASS');
