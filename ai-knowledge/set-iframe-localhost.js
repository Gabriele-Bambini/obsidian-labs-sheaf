const fs = require("fs");
const path = require("path");

const knowledgeRoot = path.resolve(__dirname, "..");
const portArgIndex = process.argv.indexOf("--port");
const port =
  portArgIndex >= 0 && process.argv[portArgIndex + 1]
    ? Number(process.argv[portArgIndex + 1])
    : 8765;
const base = `http://127.0.0.1:${port}/`;
const iframePattern =
  /src=(["'])(?:(?:\.\/)?_interactive\/|file:[^"']*\/_interactive\/|https?:\/\/(?:127\.0\.0\.1|localhost):\d+\/)([^"']+)\1/g;

let changed = 0;

for (const entry of fs.readdirSync(knowledgeRoot, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith(".md")) {
    continue;
  }

  const notePath = path.join(knowledgeRoot, entry.name);
  const original = fs.readFileSync(notePath, "utf8");
  const updated = original.replace(
    iframePattern,
    (_match, quote, lab) => `src=${quote}${base}${lab}${quote}`
  );

  if (updated !== original) {
    fs.writeFileSync(notePath, updated, "utf8");
    changed += 1;
  }
}

console.log(`Updated iframe localhost URLs in ${changed} notes.`);
