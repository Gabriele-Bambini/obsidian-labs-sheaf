const fs = require('fs');
const html = fs.readFileSync('book_chapters/B01-gcn-diffusion-lab.html', 'utf8');
const required = [
  'window.__B01LabReady=true',
  'window.__B01LabSnapshot',
  'GCN Normalized Diffusion Lab',
  'Propagation matrix P',
  'Dirichlet energy',
  'Hub influence',
  'symmetric GCN',
  'raw adjacency',
  'TF program with hub gene'
];
const missing = required.filter((item) => !html.includes(item));
if (missing.length) {
  console.error('Missing B01 lab markers:', missing.join(', '));
  process.exit(1);
}
console.log('B01 lab smoke test PASS');
