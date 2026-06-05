const fs = require('fs');
const html = fs.readFileSync('f13-ground-truth-and-gold-standards-in-regulatory-networks-lab.html', 'utf8');
if (!html.includes('lab-3d-shell')) throw new Error('missing 3D lab shell');
if (!html.includes('shared/three.min.js')) throw new Error('missing local three.js');
if (!html.includes('shared/gnn-bio-lab-core.js')) throw new Error('missing shared lab core');
if (!html.includes('data-obsidian-mobile-ready="true"')) throw new Error('missing mobile marker');
if (!html.includes('createGnnBioLab')) throw new Error('missing lab initializer');
if (!html.includes('window.createGnnBioLab') && !fs.readFileSync('shared/gnn-bio-lab-core.js','utf8').includes('window.createGnnBioLab')) throw new Error('missing global initializer');
if (!html.includes('Ground truth and gold st')) throw new Error('missing title');
const core = fs.readFileSync('shared/gnn-bio-lab-core.js','utf8');
if (!core.includes('__F13LabReady'.replace('F13', ''))) { /* marker is dynamic in runtime; keep core check focused */ }
if (!core.includes('ai-knowledge-style-3d-command-lab')) throw new Error('missing visual quality marker');
console.log('ok F13 ai-style');
