const fs = require("fs");
const vm = require("vm");

const html = fs.readFileSync("book_chapters/A09-message-passing-lab.html", "utf8");
if (!html.includes("window.__A09LabReady")) throw new Error("ready flag missing");
if (!html.includes("h_i' = psi")) throw new Error("message passing formula missing");
if (!html.includes("Message terms")) throw new Error("topic panels missing");

const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (scripts.length !== 1) throw new Error(`expected one inline script, got ${scripts.length}`);
new vm.Script(scripts[0]);
console.log("A09 lab smoke passed");
