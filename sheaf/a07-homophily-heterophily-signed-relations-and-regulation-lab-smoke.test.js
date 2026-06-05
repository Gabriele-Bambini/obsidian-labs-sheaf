const fs = require("fs");
const vm = require("vm");

const html = fs.readFileSync("book_chapters/A07-homophily-signed-regulation-lab.html", "utf8");
if (!html.includes("window.__A07LabReady")) throw new Error("ready flag missing");
if (!html.includes("h_i' = W_self h_i")) throw new Error("signed formula missing");
if (!html.includes("Compatibility matrix")) throw new Error("topic panels missing");

const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (scripts.length !== 1) throw new Error(`expected one inline script, got ${scripts.length}`);
new vm.Script(scripts[0]);
console.log("A07 lab smoke passed");
