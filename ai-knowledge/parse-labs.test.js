const fs = require("fs");
const path = require("path");
const { parseVerifierChecks } = require("./scan-vault-quality");

const verifierSource = fs.readFileSync(
  path.join(__dirname, "verify-interactive-links.js"),
  "utf8"
);
const checks = parseVerifierChecks(verifierSource);
const failures = [];

for (const check of checks) {
  const htmlPath = path.join(__dirname, check.lab);
  const html = fs.readFileSync(htmlPath, "utf8");
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)];

  if (scripts.length === 0) {
    failures.push(`${check.lab}: no inline script blocks found`);
    continue;
  }

  scripts.forEach((match, index) => {
    try {
      new Function(match[1]);
    } catch (error) {
      failures.push(`${check.lab} script ${index + 1}: ${error.message}`);
    }
  });
}

if (failures.length > 0) {
  console.error("Lab script parse failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`Lab script parse passed for ${checks.length} labs.`);
