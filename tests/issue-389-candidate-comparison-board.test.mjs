import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #389 persists candidate comparison decisions independently from providers", async () => {
  const model = await source("lib/candidate-comparison.ts");
  for (const phrase of [
    "CandidateComparisonRecord",
    "candidateComparison",
    "saveCandidateComparison",
    "comparisonForCandidate",
    "shortlisted",
    "rejected",
    "restoreCandidate",
  ]) assert.ok(model.includes(phrase), `Missing comparison behavior: ${phrase}`);
  assert.doesNotMatch(model, /provider|model|endpoint|workflow|apiKey/i);
});

test("issue #389 records strengths problems reusable qualities and ranking", async () => {
  const model = await source("lib/candidate-comparison.ts");
  assert.match(model, /strengths: string/);
  assert.match(model, /problems: string/);
  assert.match(model, /reusableQualities: string/);
  assert.match(model, /rank: number \| null/);
  assert.match(model, /rankedCandidates/);
});

test("issue #389 exposes keyboard-friendly shortlist reject restore and annotation controls", async () => {
  const board = await source("app/candidate-comparison-board.tsx");
  for (const phrase of [
    "Compare possibilities",
    "Shortlist",
    "Reject",
    "Restore",
    "Strengths",
    "Problems",
    "Reusable qualities",
    'tabIndex={0}',
    'role="group"',
    'aria-pressed',
  ]) assert.ok(board.includes(phrase), `Missing comparison control: ${phrase}`);
});

test("issue #389 remains responsive in structure and never exposes canon mutation", async () => {
  const board = await source("app/candidate-comparison-board.tsx");
  assert.match(board, /candidate-comparison-grid/);
  assert.match(board, /role="list"/);
  assert.match(board, /inputMode="numeric"/);
  assert.match(board, /never changes story canon/);
  assert.doesNotMatch(board, /approveCanon|setCanon|canonStatus\s*=/i);
});

test("issue #389 remains registered after exploration candidates", async () => {
  const registry = await source("config/ai-native-visual-writing-programme.json");
  assert.match(registry, /"issue": 389/);
  assert.match(registry, /"id": "candidate-comparison"/);
  assert.match(registry, /"dependsOn": \["exploration-candidates"\]/);
});
