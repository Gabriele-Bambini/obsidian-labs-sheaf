const fs = require('fs');
const html = fs.readFileSync('book_chapters/B04-gin-injective-lab.html', 'utf8');
const required = [
  'window.__B04LabReady=true',
  'window.__B04LabSnapshot',
  'GIN Multiset Microscope',
  'Neighborhood A',
  'Neighborhood B',
  'Aggregator output',
  'Collision status',
  'Duplicates'
];
const missing = required.filter((item) => !html.includes(item));
if (missing.length) {
  console.error('Missing B04 lab markers:', missing.join(', '));
  process.exit(1);
}
console.log('B04 lab smoke test PASS');
