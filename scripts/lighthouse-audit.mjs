#!/usr/bin/env node

console.error([
  "PlotPickle's Lighthouse runner has been retired.",
  "It never provided a trustworthy packaged-runtime release gate and is no longer used by CI or release packaging.",
  "The supported release gate is scripts/windows-interaction-smoke.mjs, which runs against a clean extracted Windows package and exercises the visible safe interface controls.",
].join("\n"));

process.exitCode = 1;
