import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2630/#2644 keeps one separate project-owned Mind Map notes store with field-scoped notes", async () => {
  const contract = await read("core/storage/library-project.ts");

  assert.match(contract, /export const MIND_MAP_NOTES_VERSION = 1 as const/u);
  assert.match(contract, /export type MindMapNotesState/u);
  assert.match(contract, /readonly topics: Readonly<Record<string, MindMapTopicNote>>/u);
  assert.match(contract, /readonly fields: Readonly<Record<string, MindMapTopicNote>>/u);
  assert.match(contract, /readonly mindMapNotes: MindMapNotesState/u);
  assert.match(contract, /createEmptyMindMapNotesState\(\)/u);
  assert.match(contract, /return \{ version: MIND_MAP_NOTES_VERSION, topics: \{\}, fields: \{\} \}/u);
  assert.match(contract, /export function mindMapFieldNote/u);
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
  assert.match(contract, /topics: normalizeNotes\(source\.topics, 100\)/u);
  assert.match(contract, /fields: normalizeNotes\(source\.fields, 2_000\)/u);
});

test("#2630/#2644/#2646 Human notes use the profile name and can target a selected Character without a second notes store", async () => {
  const surface = await read("app/skin-v1/discovery-surface.tsx");

  assert.match(surface, /canonicalFields\.map\(\(field\) => \[[\s\S]*field\.canonicalId,[\s\S]*mindMapFieldNote\(project\.mindMapNotes, field\.canonicalId\)\.text/u);
  assert.match(surface, /fetch\("\/api\/auth\/profile", \{ credentials: "same-origin", cache: "no-store" \}\)/u);
  assert.match(surface, /status\.profile\?\.displayName\?\.trim\(\)/u);
  assert.match(surface, /humanDisplayName \? `\$\{humanDisplayName\}’s Notes` : "My Notes"/u);
  assert.doesNotMatch(surface, /Bryan’s Notes|Brian’s Notes/u);
  assert.match(surface, /const selectedFieldNoteKey = selectedField[\s\S]*selectedTopic === "character" && selectedCharacter[\s\S]*::character-\$\{selectedCharacter\.id\}/u);
  assert.match(surface, /data-mind-map-human-notes-toggle=\{selectedFieldNoteKey \?\? selectedField\.canonicalId\}/u);
  assert.match(surface, /data-mind-map-human-notes=\{selectedFieldNoteKey \?\? selectedField\.canonicalId\}/u);
  assert.match(surface, /<h3>\{selectedField\.lessonTitle\} · \{notesOwnerLabel\}<\/h3>/u);
});

test("#2630/#2644 Save Notes increments revision and changes only the selected field notes domain", async () => {
  const surface = await read("app/skin-v1/discovery-surface.tsx");
  const start = surface.indexOf("function saveSelectedFieldNotes()");
  const end = surface.indexOf("async function createCanonicalFieldProposal", start);
  const save = surface.slice(start, end);

  assert.match(save, /if \(!project \|\| !selectedField \|\| !selectedFieldNoteKey\) return/u);
  assert.match(save, /revision: project\.revision \+ 1/u);
  assert.match(save, /updatedAt: now/u);
  assert.match(save, /mindMapNotes: \{/u);
  assert.match(save, /fields: \{/u);
  assert.match(save, /\.\.\.project\.mindMapNotes\.fields/u);
  assert.match(save, /\[selectedFieldNoteKey\]: \{ text, updatedAt: now \}/u);
  assert.match(save, /persistCanonicalProject\(next\)/u);
  assert.match(save, /setSavedNoteTexts/u);
  assert.doesNotMatch(save, /storyDevelopment:|foundations:|world:|discovery:/u);
});

test("#2630 notes stay non-canon and outside automatic Agent context", async () => {
  const surface = await read("app/skin-v1/discovery-surface.tsx");
  const contextStart = surface.indexOf("function compactProjectContext");
  const contextEnd = surface.indexOf("export default function DiscoverySurface", contextStart);
  const context = surface.slice(contextStart, contextEnd);

  assert.doesNotMatch(context, /mindMapNotes|selectedFieldNoteDraft|noteDrafts/u);
  assert.match(surface, /HUMAN WORKING NOTES · NON-CANON/u);
  assert.match(surface, /Saving notes does not change Project Value or accept an Agent Suggestion/u);
  assert.match(surface, /"Save Notes"/u);
  assert.match(surface, /UNSAVED CHANGES/u);
});

test("#2630 World Map remains read/review and does not become a notes editor", async () => {
  const worldMap = await read("app/skin-v1/story-bible-surface.tsx");
  assert.doesNotMatch(worldMap, /Save Notes|mindMapNotes|Human Notes/u);
});
