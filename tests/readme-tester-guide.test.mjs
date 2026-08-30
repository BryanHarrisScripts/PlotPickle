import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("tester-facing public README tells testers what PlotPickle does and how to get the app", async () => {
  const readme = await source("README.md");
  for (const phrase of [
    "## Get PlotPickle",
    "PlotPickleSetup.exe",
    "Start Menu",
    "First launch",
    "## What PlotPickle does",
    "24 Story Blocks",
    "96 Mini-Blocks",
    "2,400 technical 3-second render clips",
    "## Run from source",
  ]) assert.ok(readme.includes(phrase), `Public README is missing: ${phrase}`);
});
