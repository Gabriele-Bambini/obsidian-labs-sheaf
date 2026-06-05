const fs = require("fs");
const path = require("path");
const scanner = require("./scan-vault-quality");

const vaultRoot = path.resolve(__dirname, "..", "..");
const knowledgeRoot = path.join(vaultRoot, "AI Knowledge");
const interactiveRoot = path.join(knowledgeRoot, "_interactive");
const trackerPath = path.join(
  vaultRoot,
  "docs",
  "superpowers",
  "plans",
  "content-quality-expansion-tracker.md"
);
const dataPath = path.join(interactiveRoot, "content-expansion-data.json");
const minimumWords = 3000;
const idealMaximumWords = 4000;

function stripFrontmatter(markdown) {
  return markdown.replace(/^---[\s\S]*?---\s*/m, "");
}

function stripCode(markdown) {
  return markdown.replace(/```[\s\S]*?```/g, " ");
}

function countWords(markdown) {
  const text = stripCode(stripFrontmatter(markdown))
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, " ")
    .replace(/\[\[[^\]|]+\|([^\]]+)\]\]/g, "$1")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\[[^\]]+\]\([^)]+\)/g, " ")
    .replace(/[$\\`*_>#|{}\[\]()]/g, " ")
    .replace(/[^\p{L}\p{N}'-]+/gu, " ");

  const matches = text.match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu);
  return matches ? matches.length : 0;
}

function firstHeading(markdown, fallback) {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : fallback.replace(/\.md$/i, "");
}

function blockOf(file) {
  const match = file.match(/^([A-I])\d{2}/);
  return match ? match[1] : "Other";
}

function parseCompletedOverrides(existingTracker) {
  const completed = new Set();
  const regex = /\|\s*`([^`]+\.md)`\s*\|[^|]*\|\s*(?:Complete|Done)\s*\|/gi;
  let match;
  while ((match = regex.exec(existingTracker)) !== null) {
    completed.add(match[1]);
  }
  return completed;
}

function parseCompletionLog(existingTracker) {
  const marker = "## Completion Log";
  const markerIndex = existingTracker.indexOf(marker);
  if (markerIndex === -1) {
    return "";
  }

  const afterMarker = existingTracker.slice(markerIndex + marker.length);
  const body = afterMarker
    .replace(/^\s*Append entries here after each note\/lab reaches the quality target\.\s*/i, "")
    .trim();

  return body;
}

function buildModel() {
  const verifierSource = fs.readFileSync(
    path.join(interactiveRoot, "verify-interactive-links.js"),
    "utf8"
  );
  const labChecks = scanner.parseVerifierChecks(verifierSource);
  const labsByNote = new Map(labChecks.map((check) => [check.note, check.lab]));
  const existingTracker = fs.existsSync(trackerPath)
    ? fs.readFileSync(trackerPath, "utf8")
    : "";
  const explicitDone = parseCompletedOverrides(existingTracker);

  const records = fs
    .readdirSync(knowledgeRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /^[A-I]\d{2}.*\.md$/i.test(entry.name))
    .map((entry) => {
      const file = entry.name;
      const markdown = fs.readFileSync(path.join(knowledgeRoot, file), "utf8");
      const words = countWords(markdown);
      const hasLab = labsByNote.has(file);
      const needsExpansion = words < minimumWords;
      const status = explicitDone.has(file) || !needsExpansion ? "Complete" : "Needs Rewrite";
      const priorityBand = words < 2000
        ? "P0 under 2000"
        : words < minimumWords
          ? "P1 under 3000"
          : words > idealMaximumWords
            ? "Complete above 4000"
            : "Complete 3000-4000";

      return {
        file,
        title: firstHeading(markdown, file),
        block: blockOf(file),
        words,
        hasLab,
        lab: labsByNote.get(file) || "",
        status,
        priorityBand,
        deficit: Math.max(0, minimumWords - words),
        overIdeal: Math.max(0, words - idealMaximumWords)
      };
    })
    .sort((a, b) => {
      const statusScore = (record) => (record.status === "Complete" ? 1 : 0);
      const byStatus = statusScore(a) - statusScore(b);
      if (byStatus !== 0) return byStatus;
      const byWords = a.words - b.words;
      if (byWords !== 0) return byWords;
      return a.file.localeCompare(b.file);
    });

  const summary = {
    generatedAt: new Date().toISOString(),
    minimumWords,
    idealMaximumWords,
    totalLearningNotes: records.length,
    complete: records.filter((record) => record.status === "Complete").length,
    needsRewrite: records.filter((record) => record.status !== "Complete").length,
    under2000: records.filter((record) => record.words < 2000).length,
    under3000: records.filter((record) => record.words < 3000).length,
    underTarget: records.filter((record) => record.words < minimumWords).length,
    aboveIdeal: records.filter((record) => record.words > idealMaximumWords).length,
    withLabs: records.filter((record) => record.hasLab).length,
    withoutLabs: records.filter((record) => !record.hasLab).length
  };

  return { summary, records, completionLog: parseCompletionLog(existingTracker) };
}

function renderTracker(model) {
  const lines = [];
  const { summary, records } = model;
  const active = records.find((record) => record.status !== "Complete");

  lines.push("# Content Quality Expansion Tracker");
  lines.push("");
  lines.push("> Persistent tracker for the 3000-4000 word note expansion and lab visual-quality pass.");
  lines.push("");
  lines.push("## Rules");
  lines.push("");
  lines.push("- Every future edited learning note should land in the 3000-4000 focused-word band.");
  lines.push("- Prioritize notes under 2000 words first.");
  lines.push("- Prefer notes without labs over already-covered notes when word counts are similar.");
  lines.push("- Content must stay specific to the note topic, with enough prerequisites and links to understand it.");
  lines.push("- Avoid padding, repeated generic prose, filler adverbs, Italian summaries, and mojibake.");
  lines.push("- Improve lab graphics and interaction UX as each note/lab pair is revisited.");
  lines.push("");
  lines.push("## Current State");
  lines.push("");
  lines.push("| Field | Value |");
  lines.push("| --- | --- |");
  lines.push(`| Generated | ${summary.generatedAt} |`);
  lines.push(`| Minimum target | ${summary.minimumWords} words per learning note |`);
  lines.push(`| Ideal maximum | ${summary.idealMaximumWords} words per learning note |`);
  lines.push(`| Learning notes | ${summary.totalLearningNotes} |`);
  lines.push(`| Complete | ${summary.complete} |`);
  lines.push(`| Needs rewrite | ${summary.needsRewrite} |`);
  lines.push(`| Under 2000 words | ${summary.under2000} |`);
  lines.push(`| Under 3000 words | ${summary.underTarget} |`);
  lines.push(`| Above 4000 words | ${summary.aboveIdeal} |`);
  lines.push(`| Notes with labs | ${summary.withLabs} |`);
  lines.push(`| Notes without labs | ${summary.withoutLabs} |`);
  lines.push(`| Active next item | ${active ? `${active.file} (${active.words} words)` : "None"} |`);
  lines.push("");
  lines.push("## Priority Queue");
  lines.push("");
  lines.push("| Rank | Status | Band | Words | Deficit | Over ideal | Lab | Note |");
  lines.push("| ---: | --- | --- | ---: | ---: | ---: | --- | --- |");

  records.forEach((record, index) => {
    const lab = record.hasLab ? record.lab : "missing";
    lines.push(
      `| ${index + 1} | ${record.status} | ${record.priorityBand} | ${record.words} | ${record.deficit} | ${lab} | \`${record.file}\` |`
        .replace(`| ${lab} |`, `| ${record.overIdeal} | ${lab} |`)
    );
  });

  lines.push("");
  lines.push("## Completion Log");
  lines.push("");
  lines.push("Append entries here after each note/lab reaches the quality target.");
  lines.push("");
  if (model.completionLog) {
    lines.push(model.completionLog);
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

if (require.main === module) {
  const model = buildModel();
  fs.writeFileSync(dataPath, `${JSON.stringify(model, null, 2)}\n`, "utf8");
  fs.writeFileSync(trackerPath, renderTracker(model), "utf8");
  console.log(
    `Content audit wrote ${path.relative(vaultRoot, dataPath)} and ${path.relative(
      vaultRoot,
      trackerPath
    )}.`
  );
  console.log(
    `Learning notes: ${model.summary.totalLearningNotes}; complete: ${model.summary.complete}; needs rewrite: ${model.summary.needsRewrite}; under 2000: ${model.summary.under2000}.`
  );
}

module.exports = { buildModel, countWords, renderTracker };
