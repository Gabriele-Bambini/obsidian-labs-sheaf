const fs = require('fs');
const html = fs.readFileSync('book_chapters/C04-gauge-local-frames-biology-lab.html','utf8');
for (const needle of ['__C04_LAB_READY__','__C04LabReady','__C04LabSnapshot','Random gauge','Align transport','Inject context shift']) {
  if (!html.includes(needle)) throw new Error(`missing ${needle}`);
}
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (scripts.length !== 1) throw new Error(`expected 1 inline script, got ${scripts.length}`);
scripts.forEach((script) => new Function(script));
console.log('C04 gauge local frames biology lab smoke PASS');
