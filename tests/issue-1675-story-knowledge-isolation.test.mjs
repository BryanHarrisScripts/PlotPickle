import assert from "node:assert/strict";
import test from "node:test";

import {
  projectStoryKnowledgeRefs,
  serializeStoryKnowledgeContext,
  validateStoryKnowledgeReference,
  validateStoryKnowledgeReferenceSet,
} from "../modules/story-the-unwritten/contract-invariants.mjs";

const references = Object.freeze([
  { ref: "knowledge:audience-weather", partition: "audience", subjectRef: "world:proof" },
  { ref: "knowledge:player-map", partition: "player", subjectRef: "player:proof" },
  { ref: "knowledge:character-key", partition: "character", subjectRef: "character:ada" },
  { ref: "knowledge:character-rival", partition: "character", subjectRef: "character:bea" },
  { ref: "knowledge:agent-clue", partition: "agent-visible", subjectRef: "character:ada" },
  { ref: "knowledge:agent-rival", partition: "agent-visible", subjectRef: "character:bea" },
  { ref: "knowledge:world-answer", partition: "world-truth", subjectRef: "world:proof" },
  { ref: "knowledge:creator-ending", partition: "creator-hidden", subjectRef: "creator:proof" },
]);

test("#1675 Phase 2 knowledge records remain reference-only and reject embedded secret payloads", () => {
  assert.deepEqual(validateStoryKnowledgeReference({
    ref: "knowledge:safe",
    partition: "creator-hidden",
    subjectRef: "creator:proof",
  }), { ok: true, errors: [] });

  const payloadBearing = validateStoryKnowledgeReference({
    ref: "knowledge:unsafe",
    partition: "creator-hidden",
    subjectRef: "creator:proof",
    text: "the murderer is Ada",
    prompt: "never reveal this",
  });
  assert.equal(payloadBearing.ok, false);
  assert.match(payloadBearing.errors.join(" "), /unsupported fields/);

  const duplicateSet = validateStoryKnowledgeReferenceSet([
    { ref: "knowledge:duplicate", partition: "audience", subjectRef: "world:proof" },
    { ref: "knowledge:duplicate", partition: "player", subjectRef: "player:proof" },
  ]);
  assert.equal(duplicateSet.ok, false);
  assert.match(duplicateSet.errors.join(" "), /duplicated/);
});

test("#1675 Phase 2 audience and player projections receive only their explicit partition", () => {
  assert.deepEqual(projectStoryKnowledgeRefs({ references, scope: "audience" }), [
    "knowledge:audience-weather",
  ]);

  assert.deepEqual(projectStoryKnowledgeRefs({ references: [...references].reverse(), scope: "player" }), [
    "knowledge:player-map",
  ]);
});

test("#1675 Phase 2 character projection is subject-scoped and preserves dramatic irony", () => {
  assert.deepEqual(projectStoryKnowledgeRefs({
    references,
    scope: "character",
    subjectRef: "character:ada",
  }), [
    "knowledge:character-key",
  ]);

  assert.throws(
    () => projectStoryKnowledgeRefs({ references, scope: "character" }),
    /requires a subjectRef/,
  );
});

test("#1675 Phase 2 agent projection receives only explicitly agent-visible refs for its subject", () => {
  assert.deepEqual(projectStoryKnowledgeRefs({
    references,
    scope: "agent",
    subjectRef: "character:ada",
  }), [
    "knowledge:agent-clue",
  ]);

  const serialized = serializeStoryKnowledgeContext({
    references,
    scope: "agent",
    subjectRef: "character:ada",
  });
  assert.deepEqual(Object.keys(serialized).sort(), ["knowledgeRefs", "scope", "subjectRef"]);
  assert.equal(serialized.scope, "agent");
  assert.equal(serialized.subjectRef, "character:ada");
  assert.deepEqual(serialized.knowledgeRefs, ["knowledge:agent-clue"]);
  for (const forbiddenRef of [
    "creator-ending",
    "world-answer",
    "player-map",
    "audience-weather",
    "character-key",
    "character-rival",
    "agent-rival",
  ]) {
    assert.equal(JSON.stringify(serialized).includes(forbiddenRef), false);
  }
});

test("#1675 Phase 2 broader contexts cannot request creator-hidden or world-truth as a serialization scope", () => {
  assert.throws(
    () => projectStoryKnowledgeRefs({ references, scope: "creator-hidden", subjectRef: "creator:proof" }),
    /Unsupported STORY knowledge context scope/,
  );
  assert.throws(
    () => projectStoryKnowledgeRefs({ references, scope: "world-truth" }),
    /Unsupported STORY knowledge context scope/,
  );
  assert.throws(
    () => projectStoryKnowledgeRefs({ references, scope: "player", subjectRef: "character:ada" }),
    /must not carry a subjectRef/,
  );
});
