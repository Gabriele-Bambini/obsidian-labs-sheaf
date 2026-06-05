const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "i04-variational-quantum-circuit-lab.html"), "utf8");
const sharedPath = path.join(__dirname, "shared", "quantum-labs.js");
const shared = fs.existsSync(sharedPath) ? fs.readFileSync(sharedPath, "utf8") : "";
const source = `${html}\n${shared}`;

const requiredLabels = [
  /data encoding -> qubits/,
  /parameterized ansatz/,
  /measurement shots/,
  /classical optimizer/,
  /theta/,
  /phi/,
  /clean gradients/,
  /noisy gradients/,
  /parameter-shift/,
  /quantum kernel matrix/,
  /SVM margin baseline/,
  /barren plateau landscape/
];

for (const pattern of requiredLabels) {
  if (!pattern.test(source)) throw new Error(`I04 concrete visual label missing: ${pattern}`);
}

if (!/createI04VariationalQmlLab\(\)/.test(html)) {
  throw new Error("I04 lab must call its concrete variational QML renderer.");
}

for (const id of ["dataset", "ansatz", "layers", "shots", "noise", "trainStep", "runBatch", "addLayer", "toggleNoise", "showKernel", "resetI04"]) {
  if (!new RegExp(`id="${id}"|getElementById\\("${id}"\\)`).test(source)) {
    throw new Error(`I04 concrete control missing: ${id}`);
  }
}

if (!/parameterShiftGradient/.test(source) || !/drawHybridTrainingLoop/.test(source) || !/drawKernelMatrix/.test(source)) {
  throw new Error("I04 must implement parameter-shift gradients, hybrid loop, and kernel matrix visuals.");
}

if (!/loss: state\.loss/.test(source) || !/layers: state\.layers/.test(source) || !/gradientNorm: state\.gradientNorm/.test(source)) {
  throw new Error("I04 snapshot must expose loss, layers, and gradient norm.");
}

console.log("I04 visual clarity static check passed.");
