import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../lib/collaboration-mode.ts", import.meta.url), "utf8");

test("defines the three canonical project collaboration modes", () => {
  assert.match(source, /"local-story"/);
  assert.match(source, /"writers-room"/);
  assert.match(source, /"repository-collaboration"/);
  assert.match(source, /export type CollaborationMode/);
});

test("defaults missing and unknown mode values to Local Story Mode", () => {
  assert.match(source, /return isCollaborationMode\(value\) \? value : "local-story"/);
});

test("keeps the PPF and local backups required in every mode", () => {
  const localPpfCount = source.match(/localPpf: true/g)?.length ?? 0;
  const localBackupCount = source.match(/localBackups: true/g)?.length ?? 0;
  assert.equal(localPpfCount, 3);
  assert.equal(localBackupCount, 3);
});

test("mode transitions preserve existing collaboration configuration", () => {
  assert.match(source, /return \{\s*\.\.\.collaboration,\s*mode: normalizeCollaborationMode\(mode\)/s);
  assert.doesNotMatch(source, /delete\s+collaboration/);
  assert.doesNotMatch(source, /repositoryUrl:\s*""/);
  assert.doesNotMatch(source, /provider:\s*"none"/);
});

test("describes Buzz and GitHub as mode requirements without changing providers", () => {
  assert.match(source, /buzz: "optional" \| "required"/);
  assert.match(source, /github: "optional" \| "required"/);
  assert.match(source, /human approval remains required before canon changes/i);
});
