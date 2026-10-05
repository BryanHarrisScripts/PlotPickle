import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2644 exactly one visible canonical field is the contextual target", async () => {
  const surface = await read("app/skin-v1/discovery-surface.tsx");

  assert.match(surface, /const \[selectedFieldId, setSelectedFieldId\] = useState<string \| null>\(initialFieldId\)/u);
  assert.match(surface, /const selectedField = visibleCanonicalFields\.find\(\(field\) => field\.canonicalId === selectedFieldId\)[\s\S]*\?\? visibleCanonicalFields\[0\][\s\S]*\?\? null/u);
  assert.match(surface, /data-selected-field=\{selectedField\?\.canonicalId === field\.canonicalId \? "true" : "false"\}/u);
  assert.match(surface, /onClick=\{\(\) => setSelectedFieldId\(field\.canonicalId\)\}/u);
  assert.match(surface, /event\.key !== "Enter" && event\.key !== " "/u);
  assert.match(surface, /<strong>SELECTED<\/strong>/u);
});

test("#2644 page and topic navigation pick a deterministic visible target without writing canon", async () => {
  const surface = await read("app/skin-v1/discovery-surface.tsx");

  assert.match(surface, /function changeTopic\(topic: LearnTopicSpineId\) \{[\s\S]*setSelectedFieldPage\(1\);[\s\S]*setSelectedFieldId\(null\);/u);
  assert.match(surface, /setSelectedFieldPage\(page\);[\s\S]*setSelectedFieldId\(null\);/u);
  assert.match(surface, /setSelectedFieldId\(initialFieldId\);[\s\S]*scrollIntoView/u);

  const changeTopicStart = surface.indexOf("function changeTopic");
  const persistStart = surface.indexOf("function persistCanonicalProject", changeTopicStart);
  const navigation = surface.slice(changeTopicStart, persistStart);
  assert.doesNotMatch(navigation, /saveActiveLibraryProject|writeStoryDevelopmentFieldValue|writeStoryDevelopmentFieldProposal/u);
});

test("#2644 one shared action bar targets Save, Agent, Human Notes and exact Learn lesson", async () => {
  const surface = await read("app/skin-v1/discovery-surface.tsx");

  assert.match(surface, /data-mind-map-selected-field-actions=\{selectedField\.canonicalId\}/u);
  assert.match(surface, /<small>SELECTED FIELD<\/small>/u);
  assert.match(surface, /<strong>\{selectedField\.lessonTitle\}<\/strong>/u);
  assert.match(surface, /saveCanonicalField\(selectedField\)/u);
  assert.match(surface, /createCanonicalFieldProposal\(selectedField\)/u);
  assert.match(surface, /data-mind-map-human-notes-toggle=\{selectedFieldNoteKey \?\? selectedField\.canonicalId\}/u);
  assert.match(surface, /onOpenLearn\(selectedField\.topicId, selectedField\.lessonId, selectedAct\)/u);
  assert.doesNotMatch(surface, /learnLessonHref|window\.location\.assign/u);

  const gridStart = surface.indexOf('<div className={styles.fieldGrid}>');
  const gridEnd = surface.indexOf("</section>", gridStart);
  const grid = surface.slice(gridStart, gridEnd);
  assert.doesNotMatch(grid, /saveCanonicalField\(field\)/u);
  assert.doesNotMatch(grid, /createCanonicalFieldProposal\(field\)/u);
});

test("#2644/#2646 Human Notes remain in the same project-owned notes store with selected-field or Character-qualified keys", async () => {
  const [surface, storage] = await Promise.all([
    read("app/skin-v1/discovery-surface.tsx"),
    read("core/storage/library-project.ts"),
  ]);

  assert.match(storage, /readonly topics: Readonly<Record<string, MindMapTopicNote>>/u);
  assert.match(storage, /readonly fields: Readonly<Record<string, MindMapTopicNote>>/u);
  assert.match(storage, /fields: normalizeNotes\(source\.fields, 2_000\)/u);
  assert.match(storage, /mindMapFieldNote\(state: MindMapNotesState, canonicalFieldId: string\)/u);

  assert.match(surface, /const selectedFieldNoteKey = selectedField/u);
  assert.match(surface, /\.\.\.project\.mindMapNotes\.fields/u);
  assert.match(surface, /\[selectedFieldNoteKey\]: \{ text, updatedAt: now \}/u);
  assert.match(surface, /data-mind-map-human-notes=\{selectedFieldNoteKey \?\? selectedField\.canonicalId\}/u);
  assert.match(surface, /Private working notes for the selected field/u);
});

test("#2644 selected-field actions preserve Human authority and Agent provenance", async () => {
  const surface = await read("app/skin-v1/discovery-surface.tsx");

  assert.match(surface, /MIND_MAP_CANONICAL_FIELD_PROPOSAL/u);
  assert.match(surface, /Do not claim the proposal is accepted canon/u);
  assert.match(surface, /acceptStoryDevelopmentFieldProposal/u);
  assert.match(surface, /"Use Suggestion"/u);
  assert.match(surface, /sourceRef: `agent:creative-director:mind-map:\$\{field\.canonicalId\}:act-\$\{selectedAct\}`/u);
});

test("#2644 selected field has a strong token-driven visual state", async () => {
  const css = await read("app/skin-v1/discovery-surface.module.css");
  const start = css.indexOf('.fieldCard[data-selected-field="true"]');
  const end = css.indexOf(".fieldCard > header", start);
  const selected = css.slice(start, end);

  assert.match(selected, /border-color: var\(--pp-skin-accent-bright\)/u);
  assert.match(selected, /box-shadow: inset 0 0 0 var\(--pp-skin-border-thin\) var\(--pp-skin-accent-bright\)/u);
  assert.doesNotMatch(selected, /#[0-9a-f]{3,8}|rgb\(/iu);
  assert.match(css, /\.contextualActions \{/u);
  assert.match(css, /\.contextualActionButtons \{/u);
});
