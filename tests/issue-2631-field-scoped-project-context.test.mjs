import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2631 field context is a deterministic projection with exact field provenance first", async () => {
  const projection = await read("modules/learn/model/relevant-project-context.ts");

  assert.match(projection, /function exactReferenceFixtureContext/u);
  assert.match(projection, /item\.lessonId === field\.lessonId && item\.fieldId === field\.fieldId/u);
  assert.match(projection, /evidenceRefs: evidence\.sourceRefs\.slice\(0, 8\)/u);
  assert.match(projection, /const exact = exactReferenceFixtureContext\(project, field\)/u);
  assert.match(projection, /if \(exact\.length\) return exact/u);
  assert.doesNotMatch(projection, /fetch\(|agent|classifier|embedding|similarity/iu);
});

test("#2631 explicit topic mappings never fall back to generic Act Blocks for Theme", async () => {
  const projection = await read("modules/learn/model/relevant-project-context.ts");

  assert.match(projection, /case "foundations":[\s\S]*return foundationsContext\(project\)/u);
  assert.match(projection, /case "world":[\s\S]*return worldContext\(project\)/u);
  assert.match(projection, /case "character":[\s\S]*return characterContext\(project, characterId\)/u);
  assert.match(projection, /case "structure":[\s\S]*return structureContext\(project, act\)/u);
  assert.match(projection, /case "drafting":[\s\S]*return draftingContext\(project, act\)/u);
  assert.match(projection, /case "dialogue":[\s\S]*return dialogueContext\(project, act\)/u);
  assert.match(projection, /case "previs":[\s\S]*return previsContext\(project\)/u);
  assert.match(projection, /case "theme":[\s\S]*case "revision":[\s\S]*case "responsible-ai":[\s\S]*case "industry":[\s\S]*case "collaboration":[\s\S]*return \[\]/u);
});

test("#2631 structure context is bounded to authored Blocks in the selected Act with source refs", async () => {
  const projection = await read("modules/learn/model/relevant-project-context.ts");
  const start = projection.indexOf("function structureContext");
  const end = projection.indexOf("function draftingContext", start);
  const structure = projection.slice(start, end);

  assert.match(structure, /block\.actNumber === act/u);
  assert.match(structure, /block\.note\.trim\(\)/u);
  assert.match(structure, /\.slice\(0, 3\)/u);
  assert.match(structure, /evidenceRefs: \[block\.id\]/u);
  assert.match(structure, /selected Act/u);
});

test("#2631 Character, Dialogue and PREVIS context use existing reviewed/read-only evidence", async () => {
  const projection = await read("modules/learn/model/relevant-project-context.ts");

  assert.match(projection, /claim\.reviewState !== "rejected"/u);
  assert.match(projection, /claim\.handling === "writer-reference"/u);
  assert.match(projection, /claim\.kind !== "sensitive-source"/u);
  assert.match(projection, /passage\.type\.toLowerCase\(\)\.includes\("dialog"\)/u);
  assert.match(projection, /item\.lockedVersionId/u);
  assert.match(projection, /reference\.reviewState === "approved"/u);
});

test("#2631 Mind Map renders context inside each canonical field and removes the generic context dump", async () => {
  const surface = await read("app/skin-v1/discovery-surface.tsx");

  assert.match(surface, /const relevantContext = relevantProjectContextForField\([\s\S]*field\.topicId === "character" \? selectedCharacter\?\.id : null[\s\S]*\);/u);
  assert.match(surface, /data-relevant-project-context=\{field\.canonicalId\}/u);
  assert.match(surface, /RELEVANT PROJECT CONTEXT/u);
  assert.match(surface, /data-relevant-context-item=\{item\.id\}/u);
  assert.match(surface, /item\.evidenceRefs\.map\(\(ref\) => <code key=\{ref\}>\{ref\}<\/code>\)/u);

  assert.doesNotMatch(surface, /projectDiscoveryPins/u);
  assert.doesNotMatch(surface, /selectedActProjectCards/u);
  assert.doesNotMatch(surface, /PROJECT CONTEXT · DETERMINISTIC FROM PLOTPICKLE/u);
  assert.doesNotMatch(surface, /className=\{styles\.projectContext\}/u);
});

test("#2631 field context is read-only and cannot mutate source project domains", async () => {
  const [surface, projection] = await Promise.all([
    read("app/skin-v1/discovery-surface.tsx"),
    read("modules/learn/model/relevant-project-context.ts"),
  ]);
  const start = surface.indexOf('{relevantContext.length ? (');
  const end = surface.indexOf(') : null}', start) + ') : null}'.length;
  const contextUi = surface.slice(start, end);

  assert.match(contextUi, /READ ONLY/u);
  assert.match(contextUi, /It does not change Project Value/u);
  assert.doesNotMatch(contextUi, /onClick|Save|Lock|Delete|Use Suggestion/u);
  assert.doesNotMatch(projection, /saveActiveLibraryProject|writeStoryDevelopment|updateBlockWriting|upsertWorldMap|persist/u);
});
