const fs = require('fs');
const html = fs.readFileSync('book_chapters/B05-mpnn-edge-messages-lab.html', 'utf8');
const required = [
  'window.__B05LabReady=true',
  'window.__B05LabSnapshot',
  'Edge-aware MPNN Message Lab',
  'Message mode',
  'edge MLP filter',
  'typed basis',
  'Edge feature panel',
  'Evidence loss risk'
];
const missing = required.filter((item) => !html.includes(item));
if (missing.length) {
  console.error('Missing B05 lab markers:', missing.join(', '));
  process.exit(1);
}
console.log('B05 lab smoke test PASS');
