const fs = require("fs");
const vm = require("vm");

const html = fs.readFileSync("book_chapters/A06-graph-signal-processing-lab.html", "utf8");
if (!html.includes("window.__A06LabReady")) throw new Error("ready flag missing");
if (!html.includes("y = U g(Lambda) U^T x")) throw new Error("formula missing");
if (!html.includes("Graph Fourier coefficients")) throw new Error("topic panels missing");

const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (scripts.length !== 1) throw new Error(`expected one inline script, got ${scripts.length}`);
new vm.Script(scripts[0]);
console.log("A06 lab smoke passed");
