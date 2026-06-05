const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, 'book_chapters', 'B06-graph-autoencoder-lab.html'), 'utf8');
for (const needle of [
  'Graph Autoencoder Reconstruction Lab',
  'window.__B06_LAB_READY__',
  'GRN link prediction',
  'reconstructed adjacency',
  'KL / noise',
  'False negatives'
]) {
  if (!html.includes(needle)) throw new Error(`Missing expected lab token: ${needle}`);
}
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (scripts.length !== 1) throw new Error(`Expected one inline script, found ${scripts.length}`);
new Function(scripts[0]);
console.log('B06 graph autoencoder lab smoke PASS');
