const fs = require('fs');
const html = fs.readFileSync('book_chapters/A13-leakage-audit-lab.html', 'utf8');
const required = [
  'window.__A13LabReady=true',
  'window.__A13LabSnapshot',
  'GRN edge prediction',
  'target edge leaked',
  'prior answer reused',
  'Apparent score',
  'Honest score',
  'False-negative risk'
];
for (const token of required) {
  if (!html.includes(token)) {
    throw new Error('Missing token: ' + token);
  }
}
if ((html.match(/<script/g) || []).length < 1) throw new Error('No script block found');
console.log('A13 lab smoke passed');
