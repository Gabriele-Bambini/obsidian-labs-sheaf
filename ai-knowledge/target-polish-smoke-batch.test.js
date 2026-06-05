const { spawnSync } = require("child_process");
const path = require("path");

const tests = [
  "a05-smoke.test.js",
  "a06-smoke.test.js",
  "a07-smoke.test.js",
  "a08-smoke.test.js",
  "a09-smoke.test.js",
  "a11-smoke.test.js",
  "a12-smoke.test.js",
  "a13-smoke.test.js",
  "a14-smoke.test.js",
  "a15-smoke.test.js",
  "b01-smoke.test.js",
  "b02-smoke.test.js",
  "b03-smoke.test.js",
  "b04-smoke.test.js",
  "b07-smoke.test.js",
  "b08-smoke.test.js",
  "b09-smoke.test.js",
  "b10-smoke.test.js",
  "c01-smoke.test.js",
  "c04-smoke.test.js",
  "c07-smoke.test.js",
  "c08-smoke.test.js",
  "d07-smoke.test.js"
];

for (const test of tests) {
  console.log(`RUN ${test}`);
  const result = spawnSync(process.execPath, [path.join(__dirname, test)], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log(`target-polish-smoke-batch passed for ${tests.length} tests.`);
