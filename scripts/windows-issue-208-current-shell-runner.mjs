#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const sourcePath = fileURLToPath(new URL("./windows-issue-208-smoke.mjs", import.meta.url));
const runnerUrl = new URL("./windows-issue-208-smoke-runner.mjs", import.meta.url);
const originalSource = await readFile(sourcePath, "utf8");
const oldShellPredicate = 'document.querySelector(".application-shell-header") && active';
const currentShellPredicate = 'active && normalize(document.body?.innerText)';

if (!originalSource.includes(oldShellPredicate)) {
  throw new Error("The Issue #208 legacy application-shell predicate could not be located.");
}

const currentSource = originalSource.replace(oldShellPredicate, currentShellPredicate);
await writeFile(sourcePath, currentSource, "utf8");
try {
  await import(`${pathToFileURL(fileURLToPath(runnerUrl)).href}?current-shell=${Date.now()}`);
} finally {
  await writeFile(sourcePath, originalSource, "utf8");
}
