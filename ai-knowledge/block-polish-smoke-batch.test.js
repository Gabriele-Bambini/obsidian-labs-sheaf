const { spawnSync } = require("child_process");
const path = require("path");

const tests = [
  "e-block-smoke.test.js",
  "e-block-controls-smoke.test.js",
  "phase6-smoke.test.js",
  "phase7-smoke.test.js",
  "phase8-smoke.test.js",
  "phase9-smoke.test.js",
  "phase13-smoke.test.js",
  "phase14-smoke.test.js",
  "phase15-smoke.test.js",
  "phase16-smoke.test.js",
  "phase17-smoke.test.js",
  "phase18-smoke.test.js",
  "i02-i05-visual-clarity.test.js",
  "i-block-visual-uniqueness.test.js",
  "i-block-semantic-controls-smoke.test.js",
  "i-block-control-dock-smoke.test.js"
];

for (const test of tests) {
  console.log(`RUN ${test}`);
  const result = spawnSync(process.execPath, [path.join(__dirname, test)], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log(`block-polish-smoke-batch passed for ${tests.length} tests.`);
