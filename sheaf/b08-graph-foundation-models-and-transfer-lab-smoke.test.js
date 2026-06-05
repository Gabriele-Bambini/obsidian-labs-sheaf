const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'book_chapters', 'B08-graph-foundation-transfer-lab.html'), 'utf8');
for (const needle of [
  'Graph Foundation Transfer Lab',
  'window.__B08_LAB_READY__',
  'window.__B08LabReady',
  'window.__B08LabSnapshot',
  'single-cell gene graph',
  'masked reconstruction',
  'negative transfer',
  'leakage pressure'
]) {
  if (!html.includes(needle)) throw new Error(`Missing expected lab token: ${needle}`);
}
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (scripts.length !== 1) throw new Error(`Expected one inline script, found ${scripts.length}`);
new Function(scripts[0]);
console.log('B08 graph foundation transfer lab smoke PASS');
