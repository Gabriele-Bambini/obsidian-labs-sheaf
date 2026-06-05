const fs = require('fs');
const html = fs.readFileSync('book_chapters/A14-metrics-cockpit-lab.html', 'utf8');
const required = [
  'window.__A14LabReady=true',
  'window.__A14LabSnapshot',
  'Precision',
  'Recall',
  'F1 score',
  'Hits@K',
  'Precision-Recall curve',
  'ROC curve',
  'Confusion matrix'
];
for (const token of required) {
  if (!html.includes(token)) {
    throw new Error('Missing token: ' + token);
  }
}
console.log('A14 lab smoke passed');
