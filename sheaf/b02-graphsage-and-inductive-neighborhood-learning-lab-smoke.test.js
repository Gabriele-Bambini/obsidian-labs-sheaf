const fs = require('fs');
const html = fs.readFileSync('book_chapters/B02-graphsage-sampling-lab.html', 'utf8');
const required = [
  'window.__B02LabReady=true',
  'window.__B02LabSnapshot',
  'GraphSAGE Sampling Lab',
  'Sampled neighborhood',
  'Computation tree',
  'Inductive risk',
  'Fanout 1',
  'Feature shift'
];
const missing = required.filter((item) => !html.includes(item));
if (missing.length) {
  console.error('Missing B02 lab markers:', missing.join(', '));
  process.exit(1);
}
console.log('B02 lab smoke test PASS');
