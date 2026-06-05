const fs = require("fs");
const path = require("path");

const vaultRoot = path.resolve(__dirname, "..", "..");
const knowledgeRoot = path.join(vaultRoot, "AI Knowledge");
const interactiveRoot = path.join(knowledgeRoot, "_interactive");

const blockOrder = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];

const qualityPatterns = [
  {
    key: "encoding-artifact",
    label: "Mojibake or replacement character",
    pattern: /[\u00F0\u00C3\u00E2\uFFFD]/
  },
  {
    key: "italian-navigation",
    label: "Italian navigation prose",
    pattern:
      /\b(Benvenuto|Obiettivo|Invece|Clicca|maturit[a\u00E0]|Competenze|Padroneggiare|Ricerca|Focalizzato|Frontiera|Teoria Quantistica)\b/i
  },
  {
    key: "italian-summary",
    label: "Italian summary marker",
    pattern: /Sintesi italiana|Sintesi italiana opzionale/i
  },
  {
    key: "filler-adverb",
    label: "Known filler adverb",
    pattern:
      /\b(identically|natively|cleanly|tracking|unambiguously|securely|definitively|distinctly)\b/i
  },
  {
    key: "repeated-abstraction",
    label: "Dense repeated abstraction wording",
    pattern:
      /\b(mapping|identity|evaluate|explicitly)\b(?:\W+\w+){0,5}\W+\b(mapping|identity|evaluate|explicitly)\b/i
  }
];

const backlogSeeds = [
  {
    note: "C02- Unconstrained Optimization.md",
    labIdea:
      "3D loss landscape with gradient descent, momentum, curvature, and step-size controls.",
    why: "Optimization dynamics are easier to learn when the trajectory and local curvature are visible."
  },
  {
    note: "C03- Constrained Optimization.md",
    labIdea:
      "Constraint surface and Lagrange multiplier explorer with feasible set, normal vectors, and active constraints.",
    why: "Shows why optima occur where objective contours align with constraint geometry."
  },
  {
    note: "B05- Bayesian Inference.md",
    labIdea:
      "Bayesian updating lab showing prior, likelihood, posterior, evidence, and sequential observations.",
    why: "Turns Bayes' rule from a formula into a moving belief update."
  },
  {
    note: "B06- Stochastic Processes.md",
    labIdea:
      "Animated Markov chain and sample-path simulator with transition matrix controls.",
    why: "Connects transition probabilities, long-run behavior, and random trajectories."
  },
  {
    note: "F03 - Graph Laplacians.md",
    labIdea:
      "Graph Laplacian energy visualizer with node signals, smoothing flow, and eigenmode decomposition.",
    why: "Prepares the graph and sheaf diffusion labs with the scalar graph case."
  },
  {
    note: "F04 - Spectral Graph Theory.md",
    labIdea:
      "Spectral embedding explorer that animates eigenvectors, cuts, and clustering geometry.",
    why: "Makes eigenvectors useful before moving into GNNs and graph signal processing."
  },
  {
    note: "G01- Introduction to Graph Neural Networks.md",
    labIdea:
      "Message-passing playground comparing sum, mean, max, and learned aggregation on the same graph.",
    why: "Builds a bridge from generic GNNs to the existing GCN lab."
  },
  {
    note: "H03 - Cellular Sheaves and Cohomology.md",
    labIdea:
      "Cellular sheaf cohomology explorer with assignments, restrictions, coboundaries, and consistency defects.",
    why: "Cohomology is abstract; local-to-global failure needs an interactive diagram."
  },
  {
    note: "H05 - The Sheaf Laplacian.md",
    labIdea:
      "Sheaf Laplacian matrix builder showing stalk dimensions, restriction maps, block matrices, and energy.",
    why: "Explains the operator used by the existing sheaf diffusion lab."
  },
  {
    note: "E03- Convolutional Neural Networks (CNNs).md",
    labIdea:
      "Convolution kernel lab with feature maps, stride, padding, receptive fields, and pooling.",
    why: "CNN mechanics benefit from spatial animation and direct kernel manipulation."
  },
  {
    note: "E04- Recurrent Neural Networks (RNNs).md",
    labIdea:
      "Unrolled recurrent-state lab showing hidden-state updates, vanishing gradients, and gating intuition.",
    why: "Connects sequence recurrence to the later SSM scan lab."
  },
  {
    note: "E07- Variational Autoencoders (VAEs).md",
    labIdea:
      "Latent-space VAE lab with encoder distribution, reparameterization noise, decoder reconstruction, and KL pressure.",
    why: "Generative modeling becomes clearer when latent geometry is visible."
  },
  {
    note: "E10- Normalizing Flows.md",
    labIdea:
      "Invertible transformation lab with density warping, Jacobian determinant, and exact likelihood.",
    why: "Flows are defined by transformation geometry, so visual density transport is central."
  },
  {
    note: "E11- Reinforcement Learning Foundations.md",
    labIdea:
      "Gridworld value-iteration lab with policy, value function, Bellman backup, and reward shaping controls.",
    why: "Turns Bellman equations into an inspectable dynamic process."
  },
  {
    note: "I01- Quantum Mechanics Foundations.md",
    labIdea:
      "State-vector and measurement lab linking amplitudes, probabilities, basis changes, and collapse.",
    why: "Prepares the Bloch sphere lab by grounding the linear-algebra mechanics."
  }
];

function detectBlock(filename) {
  const moduleMatch = filename.match(/^([A-I])\d{2}/);
  if (moduleMatch) {
    return moduleMatch[1];
  }

  const blockMatch = filename.match(/^Block ([A-I])-/);
  if (blockMatch) {
    return blockMatch[1];
  }

  if (filename.startsWith("00_")) {
    return "Structural";
  }

  if (filename.startsWith("Path -")) {
    return "Path";
  }

  return "Other";
}

function noteTitle(filename) {
  return filename.replace(/\.md$/i, "");
}

function obsidianLink(filename, label = noteTitle(filename)) {
  return `[[${noteTitle(filename)}|${label}]]`;
}

function parseVerifierChecks(source) {
  const checks = [];
  const pairPattern =
    /\{\s*note:\s*"([^"]+)"[\s\S]*?lab:\s*"([^"]+)"/g;
  let match;

  while ((match = pairPattern.exec(source)) !== null) {
    checks.push({ note: match[1], lab: match[2] });
  }

  return checks;
}

function listMarkdownNotes() {
  return fs
    .readdirSync(knowledgeRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
}

function detectQualityFlags(filename, text) {
  const lines = text.split(/\r?\n/);
  const flags = [];

  lines.forEach((line, index) => {
    for (const rule of qualityPatterns) {
      if (!rule.pattern.test(line)) {
        continue;
      }

      flags.push({
        key: rule.key,
        label: rule.label,
        line: index + 1,
        sample: line.trim().slice(0, 180)
      });

      break;
    }
  });

  return flags.slice(0, 8);
}

function makeEmptyBlockStats() {
  const stats = {};

  for (const block of blockOrder) {
    stats[block] = {
      total: 0,
      labs: 0,
      missing: 0,
      qualityFlaggedFiles: 0
    };
  }

  return stats;
}

function rankBacklog(noteRecords) {
  const recordsByName = new Map(noteRecords.map((record) => [record.file, record]));
  const selected = [];

  for (const seed of backlogSeeds) {
    const record = recordsByName.get(seed.note);
    if (!record || record.hasLab || !record.isLearningModule) {
      continue;
    }

    selected.push({
      note: seed.note,
      block: record.block,
      labIdea: seed.labIdea,
      why: seed.why,
      qualityFlags: record.flags.length
    });
  }

  const seededNotes = new Set(selected.map((item) => item.note));
  const filler = noteRecords
    .filter(
      (record) =>
        record.isLearningModule && !record.hasLab && !seededNotes.has(record.file)
    )
    .sort((a, b) => {
      const byFlags = b.flags.length - a.flags.length;
      if (byFlags !== 0) {
        return byFlags;
      }

      return a.file.localeCompare(b.file);
    })
    .slice(0, 12)
    .map((record) => ({
      note: record.file,
      block: record.block,
      labIdea:
        "Interactive concept map and process animation for the note's core definitions, examples, and failure modes.",
      why:
        "This note is still uncovered by local interactive learning and should receive an embedded lab in a later slice.",
      qualityFlags: record.flags.length
    }));

  return [...selected, ...filler].slice(0, 24);
}

function buildCoverageModel() {
  const verifierPath = path.join(interactiveRoot, "verify-interactive-links.js");
  const verifierSource = fs.readFileSync(verifierPath, "utf8");
  const verifierChecks = parseVerifierChecks(verifierSource);
  const labsByNote = new Map(
    verifierChecks.map((check) => [check.note, check.lab])
  );
  const noteFiles = listMarkdownNotes();
  const byBlock = makeEmptyBlockStats();

  const noteRecords = noteFiles.map((file) => {
    const filePath = path.join(knowledgeRoot, file);
    const text = fs.readFileSync(filePath, "utf8");
    const block = detectBlock(file);
    const isLearningModule = /^[A-I]\d{2}/.test(file);
    const hasLab = labsByNote.has(file);
    const flags = detectQualityFlags(file, text);

    if (isLearningModule && byBlock[block]) {
      byBlock[block].total += 1;
      if (hasLab) {
        byBlock[block].labs += 1;
      } else {
        byBlock[block].missing += 1;
      }

      if (flags.length > 0) {
        byBlock[block].qualityFlaggedFiles += 1;
      }
    }

    return {
      file,
      block,
      isLearningModule,
      hasLab,
      lab: labsByNote.get(file) || null,
      flags
    };
  });

  const moduleNotes = noteRecords.filter((record) => record.isLearningModule);
  const qualityFlags = noteRecords
    .filter((record) => record.flags.length > 0)
    .map((record) => ({
      file: record.file,
      block: record.block,
      flags: record.flags
    }));
  const existingLabs = verifierChecks.map((check) => ({
    note: check.note,
    block: detectBlock(check.note),
    lab: check.lab
  }));

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalNotes: noteRecords.length,
      learningModuleNotes: moduleNotes.length,
      interactiveLabs: verifierChecks.length,
      uncoveredNotes: moduleNotes.length - verifierChecks.length,
      qualityFlaggedFiles: qualityFlags.length,
      qualityFlagInstances: qualityFlags.reduce(
        (sum, record) => sum + record.flags.length,
        0
      )
    },
    byBlock,
    existingLabs,
    noteRecords,
    qualityFlags,
    prioritizedBacklog: rankBacklog(noteRecords)
  };
}

function renderCoverageMarkdown(model) {
  const lines = [];

  lines.push("# Interactive Coverage Map");
  lines.push("");
  lines.push(
    `Generated: ${model.generatedAt} by \`scan-vault-quality.js\`.`
  );
  lines.push("");
  lines.push(
    "This file tracks which learning notes already have embedded interactive labs, which notes still need visualizations, and which files should receive quality cleanup."
  );
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| Metric | Count |");
  lines.push("| --- | ---: |");
  lines.push(`| Markdown notes scanned | ${model.summary.totalNotes} |`);
  lines.push(
    `| Learning module notes | ${model.summary.learningModuleNotes} |`
  );
  lines.push(`| Existing interactive labs | ${model.summary.interactiveLabs} |`);
  lines.push(`| Uncovered learning notes | ${model.summary.uncoveredNotes} |`);
  lines.push(
    `| Files with quality flags | ${model.summary.qualityFlaggedFiles} |`
  );
  lines.push(
    `| Quality flag instances | ${model.summary.qualityFlagInstances} |`
  );
  lines.push("");
  lines.push("## Coverage By Block");
  lines.push("");
  lines.push("| Block | Learning Notes | Labs | Missing Labs | Flagged Files |");
  lines.push("| --- | ---: | ---: | ---: | ---: |");

  for (const block of blockOrder) {
    const stats = model.byBlock[block];
    lines.push(
      `| ${block} | ${stats.total} | ${stats.labs} | ${stats.missing} | ${stats.qualityFlaggedFiles} |`
    );
  }

  lines.push("");
  lines.push("## Existing Interactive Labs");
  lines.push("");
  lines.push("| Block | Note | Lab |");
  lines.push("| --- | --- | --- |");

  for (const lab of model.existingLabs) {
    lines.push(
      `| ${lab.block} | ${obsidianLink(lab.note)} | [${lab.lab}](./${lab.lab}) |`
    );
  }

  lines.push("");
  lines.push("## Next Interactive Lab Backlog");
  lines.push("");
  lines.push("| Priority | Block | Note | Proposed Lab | Why It Matters |");
  lines.push("| ---: | --- | --- | --- | --- |");

  model.prioritizedBacklog.forEach((item, index) => {
    lines.push(
      `| ${index + 1} | ${item.block} | ${obsidianLink(item.note)} | ${item.labIdea} | ${item.why} |`
    );
  });

  lines.push("");
  lines.push("## Quality Flags");
  lines.push("");

  if (model.qualityFlags.length === 0) {
    lines.push("No quality flags were found by the current scan rules.");
  } else {
    lines.push(
      "These are automated hints, not final judgments. Review each file before rewriting formulas or technical statements."
    );
    lines.push("");
    lines.push("| File | Block | Issues | First Samples |");
    lines.push("| --- | --- | --- | --- |");

    for (const record of model.qualityFlags) {
      const issueLabels = [...new Set(record.flags.map((flag) => flag.label))].join(
        "; "
      );
      const samples = record.flags
        .slice(0, 3)
        .map((flag) => `L${flag.line}: ${flag.sample.replace(/\|/g, "\\|")}`)
        .join("<br>");

      lines.push(
        `| ${obsidianLink(record.file)} | ${record.block} | ${issueLabels} | ${samples} |`
      );
    }
  }

  lines.push("");
  lines.push("## How To Use This Map");
  lines.push("");
  lines.push(
    "1. Pick the highest-priority missing lab from the backlog when starting the next expansion slice."
  );
  lines.push(
    "2. Clean quality-flagged navigation and high-traffic notes before deep module rewrites."
  );
  lines.push(
    "3. Re-run the scanner after each phase so this map stays current."
  );
  lines.push("");

  return `${lines.join("\n")}\n`;
}

function writeCoverageArtifacts(model) {
  const dataPath = path.join(interactiveRoot, "coverage-data.json");
  const markdownPath = path.join(interactiveRoot, "COVERAGE_MAP.md");

  fs.writeFileSync(dataPath, `${JSON.stringify(model, null, 2)}\n`, "utf8");
  fs.writeFileSync(markdownPath, renderCoverageMarkdown(model), "utf8");

  return { dataPath, markdownPath };
}

if (require.main === module) {
  const model = buildCoverageModel();
  const artifacts = writeCoverageArtifacts(model);

  console.log("Coverage scanner wrote:");
  console.log(`- ${path.relative(vaultRoot, artifacts.dataPath)}`);
  console.log(`- ${path.relative(vaultRoot, artifacts.markdownPath)}`);
  console.log(
    `Notes: ${model.summary.totalNotes}; learning modules: ${model.summary.learningModuleNotes}; labs: ${model.summary.interactiveLabs}; uncovered: ${model.summary.uncoveredNotes}; quality-flagged files: ${model.summary.qualityFlaggedFiles}.`
  );
}

module.exports = {
  detectBlock,
  parseVerifierChecks,
  buildCoverageModel,
  renderCoverageMarkdown,
  writeCoverageArtifacts
};
