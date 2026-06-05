const fs = require("fs");
const path = require("path");

const cssPath = path.join(__dirname, "shared", "gnn-lab-core.css");
const css = fs.readFileSync(cssPath, "utf8");

function hasClass(html, className) {
  return new RegExp(`class=["'][^"']*\\b${className}\\b[^"']*["']`, "i").test(html);
}

const forbiddenPatterns = [
  [/min-height:\s*(?:6|7|8|9)\d{2}px/i, "large fixed min-height creates vertical scrollbars in Obsidian iframes"],
  [/grid-template-columns:\s*150px\s+repeat\(5,\s*minmax\(116px/i, "fixed wide command bar columns overflow narrow Obsidian panes"],
  [/grid-template-columns:\s*140px\s+repeat\(5,\s*minmax\(92px/i, "tablet command bar still keeps too much minimum width"],
  [/grid-template-rows:\s*minmax\(0,\s*1fr\)\s+300px/i, "narrow Obsidian panes must not reserve most of the height for the readout panel"],
  [/\.command-control:nth-of-type\([^)]+\)\s*\{[\s\S]*display:\s*none/i, "narrow layouts must keep every experimental parameter reachable"],
  [/overflow:\s*auto/i, "lab shell must not introduce dedicated scrollbars"],
  [/overflow-[xy]:\s*auto/i, "lab shell must not introduce axis scrollbars"]
];

for (const [pattern, reason] of forbiddenPatterns) {
  if (pattern.test(css)) {
    throw new Error(`Obsidian fit violation: ${reason}`);
  }
}

const requiredPatterns = [
  [/height:\s*100dvh/i, "dynamic viewport height"],
  [/min-height:\s*0/i, "grid children can shrink inside iframe"],
  [/\.command-bar[\s\S]*grid-template-columns:\s*minmax\(0,\s*1\.05fr\)\s+repeat\(5,\s*minmax\(0,\s*1fr\)\)\s+repeat\(3,\s*minmax\(0,\s*0\.62fr\)\)/i, "fluid command bar tracks"],
  [/\.command-control[\s\S]*overflow:\s*hidden/i, "command controls clip internally instead of expanding"],
  [/\.stage[\s\S]*min-height:\s*0/i, "3D stage can shrink"],
  [/\.side-panel[\s\S]*min-height:\s*0/i, "side panel can shrink"],
  [/@media \(max-width:\s*760px\)[\s\S]*grid-template-rows:\s*minmax\(0,\s*1fr\)\s+126px/i, "compact mobile readout row preserves the 3D viewport"],
  [/@media \(max-width:\s*760px\)[\s\S]*\.command-bar[\s\S]*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/i, "narrow command bar stays horizontal and compact"]
];

for (const [pattern, reason] of requiredPatterns) {
  if (!pattern.test(css)) {
    throw new Error(`Obsidian fit requirement missing: ${reason}`);
  }
}

const htmlFiles = [
  "g01-message-passing-playground.html",
  "g02-gcn-message-passing.html",
  "g03-graph-attention-coefficients-lab.html",
  "g04-graphsage-sampling-lab.html",
  "g05-wl-color-refinement-lab.html",
  "g06-higher-order-gnn-lab.html",
  "g07-link-graph-readout-lab.html",
  "g08-scalable-gnn-sampling-lab.html",
  "g09-temporal-gnn-memory-lab.html",
  "g10-equivariance-transform-lab.html",
  "g11-geometric-domain-symmetry-lab.html",
  "g12-molecular-message-passing-lab.html",
  "g13-knowledge-graph-relations-lab.html",
  "g14-gnn-adversarial-perturbation-lab.html",
  "g15-over-smoothing-depth-lab.html",
  "g30-heterophilic-gnn-lab.html",
  "g32-ai-foundations-lab.html"
];

for (const file of htmlFiles) {
  const html = fs.readFileSync(path.join(__dirname, file), "utf8");
  if (!html.includes("shared/gnn-lab-core.css")) {
    throw new Error(`${file}: must use the shared fitted Obsidian CSS.`);
  }
  if (!hasClass(html, "command-bar")) {
    throw new Error(`${file}: must keep the horizontal command bar in the fitted layout.`);
  }
}

console.log("G block Obsidian iframe fit contract passed.");
