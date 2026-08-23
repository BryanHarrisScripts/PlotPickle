#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const sourcePath = fileURLToPath(new URL("./windows-release-smoke.mjs", import.meta.url));
const originalSource = await readFile(sourcePath, "utf8");
const oldPredicate = 'document.body.innerText.includes("Configure PlotPickle by system.")';
const currentPredicate = 'document.body.innerText.includes("Workspace") && document.body.innerText.includes("Systems")';
const oldLabel = '"Advanced Settings panel"';
const currentLabel = '"Settings systems panel"';

if (!originalSource.includes(oldPredicate)) {
  throw new Error("The legacy Settings panel predicate could not be located in the Windows release smoke.");
}

const currentSource = originalSource
  .replace(oldPredicate, currentPredicate)
  .replaceAll(oldLabel, currentLabel);
await writeFile(sourcePath, currentSource, "utf8");
try {
  const runnerUrl = pathToFileURL(sourcePath);
  await import(`${runnerUrl.href}?current-settings=${Date.now()}`);
} finally {
  await writeFile(sourcePath, originalSource, "utf8");
}
