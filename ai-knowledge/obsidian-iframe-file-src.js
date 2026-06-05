const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const knowledgeRoot = path.resolve(__dirname, "..");
const interactiveRoot = __dirname;
const iframePattern =
  /src=(["'])(?:(?:\.\/)?_interactive\/|file:[^"']*\/_interactive\/)([^"']+)\1/g;

let changed = 0;

for (const entry of fs.readdirSync(knowledgeRoot, { withFileTypes: true })) {
  if (!entry.isFile() || !entry.name.endsWith(".md")) {
    continue;
  }

  const notePath = path.join(knowledgeRoot, entry.name);
  const original = fs.readFileSync(notePath, "utf8");
  const updated = original.replace(iframePattern, (_match, quote, lab) => {
    const labUrl = pathToFileURL(path.join(interactiveRoot, lab)).href;
    return `src=${quote}${labUrl}${quote}`;
  });

  if (updated !== original) {
    fs.writeFileSync(notePath, updated, "utf8");
    changed += 1;
  }
}

console.log(`Updated iframe file URLs in ${changed} notes.`);
