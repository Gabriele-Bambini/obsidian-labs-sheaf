const fs = require('fs');
const html = fs.readFileSync('book_chapters/B03-gat-attention-lab.html', 'utf8');
const required = [
  'window.__B03LabReady=true',
  'window.__B03LabSnapshot',
  'GAT Attention Microscope',
  'Attention on a sparse biological neighborhood',
  'Softmax over neighbors',
  'Multi-head agreement',
  'Biology caution',
  'Temperature'
];
const missing = required.filter((item) => !html.includes(item));
if (missing.length) {
  console.error('Missing B03 lab markers:', missing.join(', '));
  process.exit(1);
}
console.log('B03 lab smoke test PASS');
