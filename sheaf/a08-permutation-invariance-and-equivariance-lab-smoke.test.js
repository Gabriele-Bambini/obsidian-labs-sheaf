const fs = require("fs");
const vm = require("vm");

const html = fs.readFileSync("book_chapters/A08-permutation-equivariance-lab.html", "utf8");
if (!html.includes("window.__A08LabReady")) throw new Error("ready flag missing");
if (!html.includes("F(P A P^T, P X) = P F(A, X)")) throw new Error("equivariance formula missing");
if (!html.includes("Adjacency transformation")) throw new Error("topic panels missing");

const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (scripts.length !== 1) throw new Error(`expected one inline script, got ${scripts.length}`);
new vm.Script(scripts[0]);
console.log("A08 lab smoke passed");
