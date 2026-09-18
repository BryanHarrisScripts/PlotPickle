import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2180 PageFlow reads the current profile-owned PPF and Write-owned Block/Mini text", async () => {
  const page = await read("app/pageflow/page.tsx");

  assert.match(page, /loadActiveLibraryProject/u);
  assert.match(page, /PROJECT_LIBRARY_CHANGED_EVENT/u);
  assert.match(page, /blockWritingEntry\(project\.writing, address\)/u);
  assert.match(page, /scanPageFlowDraft\(workingText\)/u);
  assert.match(page, /data-pageflow-authority="ppf-block-writing-read-only"/u);
  assert.match(page, /data-pageflow-scan-source="working-screenplay"/u);

  assert.doesNotMatch(page, /plotpickle\.project\.v1/u);
  assert.doesNotMatch(page, /localStorage/u);
  assert.doesNotMatch(page, /normalizePlotPickleProject/u);
  assert.doesNotMatch(page, /createBlankProject/u);
  assert.doesNotMatch(page, /scriptExcerpt/u);
});

test("#2180 PageFlow keeps imported source evidence separate from current working screenplay", async () => {
  const page = await read("app/pageflow/page.tsx");

  assert.match(page, /normalizeProjectSourceEvidence\(project\.sourceEvidence\)/u);
  assert.match(page, /sourcePassages/u);
  assert.match(page, /IMMUTABLE IMPORTED SOURCE/u);
  assert.match(page, /data-pageflow-source-evidence="immutable"/u);
  assert.match(page, /Source-only state:/u);
  assert.match(page, /PageFlow does not diagnose it as current working screenplay/u);
  assert.match(page, /No working screenplay text to diagnose/u);
});

test("#2180 PageFlow remains read-only and keeps deterministic diagnostics plus five-pass guidance", async () => {
  const page = await read("app/pageflow/page.tsx");

  for (const phrase of [
    "Invisible or explanatory",
    "Possible directing language",
    "Weak action phrases",
    "Emotion labels to physicalize",
    "Screen pass",
    "Verb pass",
    "Actor pass",
    "Rhythm pass",
    "Restraint pass",
    "editorial signal, not a grade",
    "Inspect, do not obey blindly.",
  ]) assert.ok(page.includes(phrase), `Missing PageFlow diagnostic contract: ${phrase}`);

  assert.doesNotMatch(page, /saveActiveLibraryProject|updateBlockWritingEntry|applyStoryCommand|markCreativeRevisionDependentsStale/u);
  assert.doesNotMatch(page, /generate.*screenplay|rewrite.*screenplay|auto.*approve/iu);
});

test("#2180 preserves Block/Mini address across Write, Story Map, PageFlow, Outline and LEARN", async () => {
  const [page, write, storyMap] = await Promise.all([
    read("app/pageflow/page.tsx"),
    read("modules/write/ui/block-native-write-workspace.tsx"),
    read("app/skin-v1/matrix-story-map-surface.tsx"),
  ]);

  assert.match(page, /query\.get\("block"\)/u);
  assert.match(page, /query\.get\("mini"\)/u);
  assert.match(page, /return `\/write\?\$\{query\.toString\(\)\}`/u);
  assert.match(page, /block: String\(blockNumber\)/u);
  assert.match(page, /mini: String\(miniBlockNumber\)/u);
  assert.match(page, /storyLearningReturnHref\(normalizedAddress\)/u);
  assert.match(page, /storyLearningHref\(learning\.references\[0\], normalizedAddress\)/u);

  assert.match(write, /function pageFlowHref/u);
  assert.match(write, /PageFlow diagnostic/u);
  assert.match(write, /block: String\(blockNumber\)/u);
  assert.match(write, /mini: String\(miniBlockNumber\)/u);

  assert.match(storyMap, />\s*PAGEFLOW\s*<\/button>/u);
  assert.match(storyMap, /\/pageflow\?block=\$\{address\.blockNumber\}&mini=\$\{address\.miniBlockNumber\}/u);
  assert.match(storyMap, /workspace=dashboard&block=\$\{address\.blockNumber\}&mini=\$\{address\.miniBlockNumber\}/u);
});

test("#2180 character truth remains contextual evidence and never substitutes for audience-visible page proof", async () => {
  const page = await read("app/pageflow/page.tsx");

  assert.match(page, /evidence\.characterTruth\?\.arcCells/u);
  assert.match(page, /Context, not screenplay proof/u);
  assert.match(page, /Profiles never substitute for audience-visible screenplay evidence/u);
  assert.doesNotMatch(page, /characterTruth.*scanPageFlowDraft/su);
});


test("#2180 maps the migrated PageFlow surface into existing pre-production experience ownership", async () => {
  const ownership = JSON.parse(await read("config/verification/ownership-map.json"));
  const experience = ownership.rules.find((rule) => rule.id === "preproduction-connected-experience");

  assert.equal(experience?.ownerLayer, "experience-contract");
  assert.ok(experience?.include.includes("app/pageflow/page.tsx"));
  assert.ok(experience?.include.includes("app/pageflow/layout.tsx"));
});
