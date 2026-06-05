const fs = require("fs");
const path = require("path");

const notesRoot = path.join(__dirname, "..");
const noteFiles = fs
  .readdirSync(notesRoot)
  .filter((name) => name.endsWith(".md"))
  .sort();

const failures = [];
const iframePattern = /<iframe\b[^>]*>/gi;

for (const fileName of noteFiles) {
  const filePath = path.join(notesRoot, fileName);
  const source = fs.readFileSync(filePath, "utf8");
  const iframes = source.match(iframePattern) || [];

  for (const iframe of iframes) {
    const srcMatch = iframe.match(/\bsrc="([^"]+)"/i);
    const heightMatch = iframe.match(/\bheight="([^"]+)"/i);
    const src = srcMatch && srcMatch[1];
    const height = heightMatch && heightMatch[1];

    if (!src || !/^http:\/\/127\.0\.0\.1:8765\/[^"]+\.html$/.test(src)) {
      failures.push(`${fileName}: iframe must use local-server HTML src, found ${src || "<missing>"}`);
    }

    if (height !== "720") {
      failures.push(`${fileName}: iframe must use height="720", found ${height || "<missing>"}`);
    }
  }
}

if (failures.length) {
  throw new Error(`Iframe standard failures:\n${failures.join("\n")}`);
}

console.log("All markdown iframe embeds use local-server HTML src and height 720.");
