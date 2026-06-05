const fs = require("fs");
const vm = require("vm");

const html = fs.readFileSync("book_chapters/A12-smoothing-squashing-lab.html", "utf8");
if (!html.includes("window.__A12LabReady")) throw new Error("ready flag missing");
if (!html.includes("H_L approx A_hat^L X")) throw new Error("propagation formula missing");
if (!html.includes("two GRN modules with bridge")) throw new Error("biology scenario missing");
if (!html.includes("Bottleneck pressure")) throw new Error("topic metrics missing");

const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (scripts.length !== 1) throw new Error(`expected one inline script, got ${scripts.length}`);
new vm.Script(scripts[0]);
console.log("A12 lab smoke passed");
