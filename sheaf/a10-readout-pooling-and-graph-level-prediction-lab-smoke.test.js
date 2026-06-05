const fs = require("fs");
const vm = require("vm");

const html = fs.readFileSync("book_chapters/A10-readout-pooling-lab.html", "utf8");
if (!html.includes("window.__A10LabReady")) throw new Error("ready flag missing");
if (!html.includes("z_G = READOUT({h_i})")) throw new Error("readout formula missing");
if (!html.includes("Rare retention")) throw new Error("topic metrics missing");
if (!html.includes("GRN regulatory module")) throw new Error("biology preset missing");

const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (scripts.length !== 1) throw new Error(`expected one inline script, got ${scripts.length}`);
new vm.Script(scripts[0]);
console.log("A10 lab smoke passed");
