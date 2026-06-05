const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'book_chapters', 'C05-topological-higher-order-biology-lab.html'), 'utf8');
assert(html.includes('window.__C05_LAB_READY__'), 'missing C05 ready flag');
assert(html.includes('window.__C05LabReady'), 'missing C05 LabReady flag');
assert(html.includes('window.__C05LabSnapshot'), 'missing C05 snapshot flag');
assert(html.includes('B1: nodes x edges'), 'missing boundary matrix panel');
assert(html.includes('L1 = B1^T B1 + B2 B2^T'), 'missing Hodge formula');
assert(!html.includes('https://cdn') && !html.includes('http://cdn'), 'must not use CDN assets');
assert(!/<script\s+src=/i.test(html), 'lab must be self-contained for Android srcdoc');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
assert(scripts.length >= 1, 'expected inline script');
for (const script of scripts) new Function(script);
console.log('C05_topological_higher_order_lab_smoke=PASS');
