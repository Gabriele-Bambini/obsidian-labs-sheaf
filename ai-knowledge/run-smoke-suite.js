const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const requested = process.argv.slice(2);
const allSmokeTests = fs
  .readdirSync(root)
  .filter((name) => name.endsWith("-smoke.test.js") || name === "catalog-smoke.test.js")
  .sort((a, b) => {
    if (a === "catalog-smoke.test.js") return 1;
    if (b === "catalog-smoke.test.js") return -1;
    const pa = Number((a.match(/phase(\d+)/) || [0, 999])[1]);
    const pb = Number((b.match(/phase(\d+)/) || [0, 999])[1]);
    return pa - pb;
  });

const selected = requested.length === 0 || requested.includes("all")
  ? allSmokeTests
  : allSmokeTests.filter((name) => requested.includes(name) || requested.includes(name.replace(".test.js", "")));

if (selected.length === 0) {
  console.error(`No smoke tests matched: ${requested.join(", ")}`);
  process.exit(1);
}

for (const testFile of selected) {
  const fullPath = path.join(root, testFile);
  console.log(`\n[smoke] ${testFile}`);
  const result = spawnSync(process.execPath, [fullPath], {
    cwd: root,
    stdio: "inherit",
    env: process.env
  });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

console.log(`\nSmoke suite passed for ${selected.length} test file(s).`);
