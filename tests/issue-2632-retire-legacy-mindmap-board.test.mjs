import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2632 canonical Mind Map retires the sticky-note/Living MindMap presentation", async () => {
  const [surface, css] = await Promise.all([
    read("app/skin-v1/discovery-surface.tsx"),
    read("app/skin-v1/discovery-surface.module.css"),
  ]);

  assert.match(surface, /data-discovery-surface="canonical-authoring"/u);
  assert.match(surface, /CANONICAL AUTHORING/u);
  assert.match(surface, /Human Notes support thinking\. Project Value is story truth/u);
  assert.match(surface, /FIELDS <strong>\{selectedCanonicalFields\.length\}/u);
  assert.match(surface, /CONTEXT <strong>\{selectedFieldContextCount\}/u);
  assert.match(surface, /NOTES <strong>/u);

  assert.doesNotMatch(surface, /DISCOVERY_LANES|DiscoveryCard|DiscoveryLaneId|ComposerLane/u);
  assert.doesNotMatch(surface, /Save Human Idea|Human Idea composer|Unsorted Human Ideas|Living MindMap|Assign Lane/u);
  assert.doesNotMatch(surface, /workingCards|selectedActTopicCards|selectedActUnsorted|pendingDeleteId|toggleLock|deleteCard/u);

  for (const selector of [".composer {", ".board {", ".laneGrid {", ".inbox {", ".cardActions {", ".deleteConfirm {"]) {
    assert.equal(css.includes(selector), false, `retired CSS selector should be absent: ${selector}`);
  }
});

test("#2632 historical discovery cards remain in the Library project contract and normalizer", async () => {
  const [library, contract] = await Promise.all([
    read("core/storage/library-project.ts"),
    read("core/contracts/discovery/index.ts"),
  ]);

  assert.match(library, /readonly discovery: DiscoveryState/u);
  assert.match(library, /const discovery = source\.discovery === undefined[\s\S]*createEmptyDiscoveryState\(\)[\s\S]*normalizeDiscoveryState\(source\.discovery\)/u);
  assert.match(library, /return \{ \.\.\.project, structure, sourceEvidence, writing, discovery, worldMap, storyDevelopment, mindMapNotes \}/u);
  assert.match(library, /serializeLibraryBackup\(project: LibraryPPFProject\)[\s\S]*JSON\.stringify\(project/u);

  assert.match(contract, /export type DiscoveryState = \{[\s\S]*readonly cards: readonly DiscoveryCard\[\]/u);
  assert.match(contract, /export function normalizeDiscoveryState/u);
  assert.match(contract, /for \(const raw of cards\.slice\(0, 500\)\)/u);
  assert.match(contract, /return \{ version: DISCOVERY_VERSION, cards: normalized \}/u);
});

test("#2632 canonical Mind Map saves never delete or rewrite discovery cards", async () => {
  const surface = await read("app/skin-v1/discovery-surface.tsx");

  assert.doesNotMatch(surface, /project\.discovery|discovery:\s*\{|\.discovery\.cards/u);

  const saveFieldStart = surface.indexOf("function saveCanonicalField");
  const saveFieldEnd = surface.indexOf("function saveSelectedFieldNotes", saveFieldStart);
  const saveField = surface.slice(saveFieldStart, saveFieldEnd);
  assert.match(saveField, /writeStoryDevelopmentFieldValue/u);
  assert.doesNotMatch(saveField, /discovery/u);

  const notesStart = surface.indexOf("function saveSelectedFieldNotes");
  const notesEnd = surface.indexOf("async function createCanonicalFieldProposal", notesStart);
  const notes = surface.slice(notesStart, notesEnd);
  assert.match(notes, /mindMapNotes:/u);
  assert.doesNotMatch(notes, /discovery/u);
});

test("#2632 Ask Agent cannot silently consume hidden legacy discovery cards", async () => {
  const surface = await read("app/skin-v1/discovery-surface.tsx");
  const contextStart = surface.indexOf("function compactProjectContext");
  const contextEnd = surface.indexOf("export default function DiscoverySurface", contextStart);
  const compact = surface.slice(contextStart, contextEnd);

  assert.doesNotMatch(compact, /mindMap|discovery|cards/u);
  assert.match(surface, /context: compactProjectContext\(project, selectedAct, field\.topicId === "character" \? selectedCharacter\?\.id : null\)/u);
  assert.doesNotMatch(compact, /project\.discovery|discovery:\s*\{|\.discovery\.cards/u);
});

test("#2632 Act rail remains only because field-scoped context can be Act-sensitive", async () => {
  const [surface, context] = await Promise.all([
    read("app/skin-v1/discovery-surface.tsx"),
    read("modules/learn/model/relevant-project-context.ts"),
  ]);

  assert.match(surface, /<StoryDevelopmentSurfaceHeader/u);\n  assert.match(surface, /actChoiceDataAttribute="data-mind-map-act-choice"/u);
  assert.match(surface, /STORY_ACTS/u);
  assert.match(surface, /relevantProjectContextForField\([\s\S]*project,[\s\S]*field,[\s\S]*selectedAct,[\s\S]*field\.topicId === "character" \? selectedCharacter\?\.id : null[\s\S]*\)/u);
  assert.match(context, /case "structure":[\s\S]*structureContext\(project, act\)/u);
  assert.match(context, /case "drafting":[\s\S]*draftingContext\(project, act\)/u);
  assert.match(context, /case "dialogue":[\s\S]*dialogueContext\(project, act\)/u);
});

test("#2632 Skin V1 census tracks the canonical Mind Map selector", async () => {
  const registry = JSON.parse(await read("config/skin-v1-surface-registry.json"));
  const discovery = registry.surfaces.find((surface) => surface.id === "discovery");
  assert.equal(discovery?.runtimeSelector, "[data-discovery-surface='canonical-authoring']");
  assert.equal(discovery?.runtimeReadySelector, "[data-discovery-surface='canonical-authoring']");
});
