import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2630 adds one separate project-owned Mind Map notes store", async () => {
  const contract = await read("core/storage/library-project.ts");

  assert.match(contract, /export const MIND_MAP_NOTES_VERSION = 1 as const/u);
  assert.match(contract, /export type MindMapNotesState/u);
  assert.match(contract, /readonly topics: Readonly<Record<string, MindMapTopicNote>>/u);
  assert.match(contract, /readonly mindMapNotes: MindMapNotesState/u);
  assert.match(contract, /createEmptyMindMapNotesState\(\)/u);
  assert.match(contract, /normalizeMindMapNotesState\(source\.mindMapNotes\)/u);
  assert.doesNotMatch(contract, /StoryDevelopmentState[\s\S]{0,180}notes:/u);
});

test("#2630 Library normalization preserves notes and Blank defaults them empty", async () => {
  const browser = await read("core/storage/project-library-browser.ts");
  const contract = await read("core/storage/library-project.ts");

  assert.match(browser, /const mindMapNotes = "mindMapNotes" in incoming/u);
  assert.match(browser, /normalizeMindMapNotesState\(incoming\.mindMapNotes\)/u);
  assert.match(browser, /initialized\.activeProject\.mindMapNotes/u);
  assert.match(browser, /createEmptyMindMapNotesState\(\)/u);
  assert.match(browser, /projectWithStructure = \{ \.\.\.project,[^\n]*mindMapNotes \}/u);
  assert.match(contract, /source\.mindMapNotes === undefined[\s\S]*createEmptyMindMapNotesState\(\)/u);
});

test("#2630 all Learn topics get independent Human note drafts and profile-named header", async () => {
  const surface = await read("app/skin-v1/discovery-surface.tsx");

  assert.match(surface, /LEARN_TOPIC_SPINE\.map\(\(topic\) => \[[\s\S]*topic\.id,[\s\S]*mindMapTopicNote\(project\.mindMapNotes, topic\.id\)\.text/u);
  assert.match(surface, /fetch\("\/api\/auth\/profile", \{ credentials: "same-origin", cache: "no-store" \}\)/u);
  assert.match(surface, /status\.profile\?\.displayName\?\.trim\(\)/u);
  assert.match(surface, /humanDisplayName \? `\$\{humanDisplayName\}’s Notes` : "My Notes"/u);
  assert.doesNotMatch(surface, /Bryan’s Notes|Brian’s Notes/u);
  assert.match(surface, /data-mind-map-human-notes-toggle=\{selectedTopic\}/u);
  assert.match(surface, /data-mind-map-human-notes=\{selectedTopic\}/u);
});

test("#2630 Save Notes increments revision and changes only the notes domain before normal Library persistence", async () => {
  const surface = await read("app/skin-v1/discovery-surface.tsx");
  const start = surface.indexOf("function saveTopicNotes()");
  const end = surface.indexOf("async function createCanonicalFieldProposal", start);
  const save = surface.slice(start, end);

  assert.match(save, /revision: project\.revision \+ 1/u);
  assert.match(save, /updatedAt: now/u);
  assert.match(save, /mindMapNotes: \{/u);
  assert.match(save, /\[selectedTopic\]: \{ text, updatedAt: now \}/u);
  assert.match(save, /persistCanonicalProject\(next\)/u);
  assert.match(save, /setSavedNoteTexts/u);
  assert.doesNotMatch(save, /storyDevelopment:|foundations:|world:|discovery:/u);
});

test("#2630 notes stay non-canon and outside automatic Agent context", async () => {
  const surface = await read("app/skin-v1/discovery-surface.tsx");
  const contextStart = surface.indexOf("function compactProjectContext");
  const contextEnd = surface.indexOf("function humanPlacement", contextStart);
  const context = surface.slice(contextStart, contextEnd);

  assert.doesNotMatch(context, /mindMapNotes|selectedTopicNoteDraft|noteDrafts/u);
  assert.match(surface, /HUMAN WORKING NOTES · NON-CANON/u);
  assert.match(surface, /Saving notes does not change Project Value or accept an Agent Suggestion/u);
  assert.match(surface, />Save Notes<\/button>/u);
  assert.match(surface, /UNSAVED CHANGES/u);
});

test("#2630 World Map remains read/review and does not become a notes editor", async () => {
  const worldMap = await read("app/skin-v1/story-bible-surface.tsx");
  assert.doesNotMatch(worldMap, /Save Notes|mindMapNotes|Human Notes/u);
});
