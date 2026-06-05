const fs = require("fs");
const vm = require("vm");

const html = fs.readFileSync("book_chapters/A11-wl-expressivity-lab.html", "utf8");
if (!html.includes("window.__A11LabReady")) throw new Error("ready flag missing");
if (!html.includes("c_v' = HASH")) throw new Error("WL formula missing");
if (!html.includes("6-cycle vs two triangles")) throw new Error("WL hard pair missing");
if (!html.includes("GRN cascade vs regulator hub")) throw new Error("biology preset missing");

const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
if (scripts.length !== 1) throw new Error(`expected one inline script, got ${scripts.length}`);
new vm.Script(scripts[0]);
console.log("A11 lab smoke passed");
