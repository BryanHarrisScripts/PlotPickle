import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("source ledger preserves current and legacy titles with explicit statuses", async () => {
  const data = await source("data/afterglow-reconciliation.ts");
  assert.match(data, /Afterglow: Reflections of Sentience/);
  assert.match(data, /Afterglow: Echoes of Sentience/);
  for (const status of ["confirmed", "candidate", "historical", "superseded", "conflict", "unresolved", "reference-only"]) assert.ok(data.includes(`"${status}"`), `Missing status ${status}`);
  for (const conflict of ["Summer and Isobel", "Amy and Claire", "Claire and Sarah", "route chronology", "Blocks 22–24"]) assert.ok(data.includes(conflict), `Missing conflict ${conflict}`);
});

test("v9 remains complete, v10 remains partial and current draft stays complete through baseline fallback", async () => {
  const data = await source("data/afterglow-reconciliation.ts");
  assert.match(data, /Afterglow v9 — Complete 2023 Baseline/);
  assert.match(data, /complete-baseline/);
  assert.match(data, /Afterglow v10 — Unfinished Blocks 1–8 Rewrite/);
  assert.match(data, /partial-alternate/);
  assert.match(data, /Blocks 1–8 only; Blocks 9–24 not attempted/);
  assert.match(data, /v11 Working Rewrite/);
  assert.match(data, /baseline-not-yet-rewritten/);
  assert.match(data, /Not attempted in v10/);
  assert.match(data, /54b5967644c5a41363fa88f57b02473ea758acc2/);
  assert.match(data, /042427931c4a74a5dbe48e05750aea66f6b2486e/);
});

test("version bridge offers all writer-controlled reconciliation actions", async () => {
  const page = await source("app/afterglow-reconciliation/page.tsx");
  for (const label of ["Keep v9", "Use v10 as starting point", "Combine selected material", "Write a new version", "Defer decision"]) assert.ok(page.includes(label), `Missing action ${label}`);
  assert.match(page, /does not rewrite screenplay text or save canon by itself/);
  assert.match(page, /before\/proposed\/accepted text/);
});

test("poster is labelled legacy draft and keeps source provenance and derivative paths", async () => {
  const data = await source("data/afterglow-reconciliation.ts");
  assert.match(data, /Afterglow 2023 Draft Poster/);
  assert.match(data, /legacy-draft/);
  assert.match(data, /8b5b69545b0753edecd7a7fe9cc5526b91d3ff64/);
  assert.match(data, /afterglow\/poster\/full\/afterglow-draft-poster-2023\.webp/);
  assert.match(data, /afterglow\/poster\/cards\/afterglow-draft-poster-2023\.webp/);
  assert.match(data, /afterglow\/poster\/thumbs\/afterglow-draft-poster-2023\.webp/);
  assert.match(data, /not approved as a final poster/i);
  assert.match(data, /rights review required/i);
});

test("Afterglow attribution separates creator credit from historical AI provenance", async () => {
  const data = await source("data/afterglow-reconciliation.ts");
  for (const phrase of ["Bryan Elgin Harris", "CC BY-SA 4.0", "creativecommons.org/licenses/by-sa/4.0", "Original work", "Original source", "Changes:", "No endorsement"]) assert.ok(data.includes(phrase), `Missing attribution field ${phrase}`);
  assert.match(data, /Historical 2023 materials record editing\/rewrite assistance from OpenAI's ChatGPT-4/);
  assert.match(data, /Later retained AI-assisted changes.*identified separately/i);
});

test("built-in Afterglow project overrides blank rights and uses current display title", async () => {
  const afterglow = await source("data/afterglow.ts");
  assert.match(afterglow, /title: "Afterglow: Reflections of Sentience"/);
  assert.match(afterglow, /defaultCreativeLicence: "CC BY-SA 4.0"/);
  assert.match(afterglow, /sourceWorkTitle: "Afterglow: Echoes of Sentience"/);
  assert.match(afterglow, /sourceWorkAuthor: "Bryan Elgin Harris"/);
  assert.match(afterglow, /adaptationStatus: "adaptation"/);
  assert.match(afterglow, /afterglow-original-work/);
  assert.match(afterglow, /historical-chatgpt4-v9-v10/);
});

test("user projects keep All rights reserved defaults", async () => {
  const project = await source("lib/project-phase-one.ts");
  assert.match(project, /defaultCreativeLicence: "All rights reserved"/);
});

test("overview and permanent suite expose the reconciliation workspace", async () => {
  const overview = await source("app/project-overview.tsx");
  const pkg = await source("package.json");
  assert.match(overview, /Afterglow Source Reconciliation/);
  assert.match(overview, /\/afterglow-reconciliation/);
  assert.match(pkg, /issues-60-62-afterglow-reconciliation\.test\.mjs/);
});
