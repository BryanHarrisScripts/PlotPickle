import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const binder = await readFile(new URL("../lib/canon-binder.ts", import.meta.url), "utf8");
const folder = await readFile(new URL("../lib/project-folder.ts", import.meta.url), "utf8");
const docs = await readFile(new URL("../docs/PHASE-7-CANON-BINDER.md", import.meta.url), "utf8");

test("Phase 7 defines authoritative canon sections and lifecycle", () => {
  for (const section of ["characters", "world", "timeline", "locations", "research", "references", "continuity", "legal", "voiceprints", "visual-style", "ai-decisions", "meeting-notes", "producer-notes", "director-notes", "actor-notes"]) assert.match(binder, new RegExp(section));
  for (const status of ["draft", "suggested", "imported", "ai-generated", "reviewed", "approved", "locked", "archived"]) assert.match(binder, new RegExp(status));
  assert.match(binder, /policy: "approved-only"/);
});

test("Phase 7 exposes canon query and context packet APIs", () => {
  assert.match(binder, /export function buildCanonBinder/);
  assert.match(binder, /export function queryCanon/);
  assert.match(binder, /export function canonContextPacket/);
  assert.match(binder, /has-voiceprint/);
  assert.match(binder, /appears-in/);
  assert.match(binder, /used-in/);
});

test("Phase 7 persists binder artifacts in project folders", () => {
  assert.match(folder, /PROJECT_FOLDER_VERSION = "2\.3\.0"/);
  assert.match(folder, /canon\/binder\.json/);
  assert.match(folder, /canon\/graph\.json/);
  assert.match(folder, /canon\/health\.json/);
  assert.match(folder, /reports\/canon-health\.json/);
  assert.match(folder, /"2\.2\.0"/);
});

test("Phase 7 documentation states the single-source-of-truth boundary", () => {
  assert.match(docs, /authoritative story knowledge layer/);
  assert.match(docs, /never silently promoted/);
  assert.match(docs, /compact, consistent context/);
});
