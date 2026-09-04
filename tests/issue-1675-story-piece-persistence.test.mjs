import assert from "node:assert/strict";
import test from "node:test";

import {
  loadStoryPiece,
  persistStoryPiece,
  validateStoryPieceForPersistence,
} from "../modules/story-the-unwritten/story-piece-persistence.mjs";
import { persistStorySessionSnapshot } from "../modules/story-the-unwritten/project-persistence.mjs";
import { createStoryMechanicalState } from "../modules/story-the-unwritten/resolution.mjs";
import { createFiveSceneStoryRuntime, transitionFiveSceneStoryRuntime } from "../modules/story-the-unwritten/session-machine.mjs";

function projectFixture() {
  return {
    id: "project:piece-proof",
    title: "Piece proof",
    extensions: {
      canonicalRevision: {
        version: 1,
        currentRevision: 4,
        proposals: [],
        history: [],
      },
    },
  };
}

function provenance(overrides = {}) {
  return {
    authorship: "human",
    creatorRef: "profile:creator",
    sourceRefs: ["source:workshop"],
    admittedByRef: null,
    admittedAt: null,
    ...overrides,
  };
}

function piece(overrides = {}) {
  return {
    id: "piece:crossroads",
    schemaVersion: 1,
    type: "location",
    title: "The Crossroads",
    description: "A decision point between two roads.",
    worldId: "world:piece-proof",
    schools: ["world", "plot"],
    tags: ["choice", "road"],
    visibility: "private",
    stateRefs: ["state:crossroads"],
    ruleIds: ["rule:crossroads-choice"],
    relationshipIds: [],
    assetRefs: ["asset:image:crossroads", "asset:audio:wind"],
    agentBinding: null,
    curriculumRefs: ["learn:choice-and-consequence"],
    provenance: provenance(),
    createdAt: "2026-09-04T10:20:00.000Z",
    updatedAt: "2026-09-04T10:20:00.000Z",
    ...overrides,
  };
}

function activeRuntime() {
  const runtime = createFiveSceneStoryRuntime({
    sessionId: "session:piece-proof",
    gameDefinitionId: "game:piece-proof",
    worldId: "world:piece-proof",
    worldRevisionRef: "world:piece-proof@4",
    ppfProjectRef: "ppf:piece-proof",
    sceneDefinitions: Array.from({ length: 5 }, (_, index) => ({
      id: `scene:${index + 1}`,
      locationId: `location:${index + 1}`,
      objectiveRefs: [`objective:${index + 1}`],
      narrativeBudget: 3,
    })),
  });
  return transitionFiveSceneStoryRuntime(runtime, "start-session").runtime;
}

test("#1675 Phase 2 persists Story Pieces with provenance and media references only", () => {
  const result = persistStoryPiece(projectFixture(), piece());
  assert.equal(result.status, "stored");
  assert.deepEqual(result.piece.assetRefs, ["asset:image:crossroads", "asset:audio:wind"]);
  assert.deepEqual(result.piece.provenance, provenance());
  const serialized = JSON.stringify(result.project.extensions.storyTheUnwritten.storyPieces);
  assert.doesNotMatch(serialized, /base64|data:image|pixelData|binaryPayload/iu);

  const loaded = loadStoryPiece(JSON.parse(JSON.stringify(result.project)), "piece:crossroads");
  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.piece, result.piece);
});

test("#1675 Phase 2 unadmitted generated proposals remain distinct from authoritative Story Pieces", () => {
  const proposed = piece({
    id: "piece:generated",
    provenance: provenance({ authorship: "generated-proposal", creatorRef: "agent:creator" }),
  });
  assert.equal(validateStoryPieceForPersistence(proposed, { requireAdmission: false }).ok, true);
  assert.throws(
    () => persistStoryPiece(projectFixture(), proposed),
    /generated-proposal Story Pieces require explicit admission before authoritative persistence/,
  );
  assert.equal(projectFixture().extensions.storyTheUnwritten, undefined);
});

test("#1675 Phase 2 admitted generated Story Pieces retain generated provenance instead of becoming human-authored", () => {
  const admitted = piece({
    id: "piece:admitted-generated",
    provenance: provenance({
      authorship: "generated-proposal",
      creatorRef: "agent:creator",
      admittedByRef: "profile:writer",
      admittedAt: "2026-09-04T10:22:00.000Z",
    }),
  });
  const stored = persistStoryPiece(projectFixture(), admitted);
  assert.equal(stored.status, "stored");
  assert.equal(stored.piece.provenance.authorship, "generated-proposal");
  assert.equal(stored.piece.provenance.admittedByRef, "profile:writer");
  assert.equal(stored.piece.provenance.admittedAt, "2026-09-04T10:22:00.000Z");
});

test("#1675 Phase 2 imported Story Pieces require explicit admission before entering the authoritative store", () => {
  const imported = piece({
    id: "piece:imported",
    provenance: provenance({ authorship: "imported", creatorRef: "package:outside-world" }),
  });
  assert.throws(() => persistStoryPiece(projectFixture(), imported), /imported Story Pieces require explicit admission/);
});

test("#1675 Phase 2 Story Pieces reject embedded media and capability-bearing agent payloads", () => {
  assert.throws(
    () => persistStoryPiece(projectFixture(), { ...piece(), media: { imageBase64: "forbidden" } }),
    /unsupported field media/,
  );
  assert.throws(
    () => persistStoryPiece(projectFixture(), {
      ...piece({ id: "piece:agent-bound" }),
      agentBinding: {
        storyAgentDefinitionId: "story-agent:guide",
        characterId: "character:guide",
        approvedRoleTemplateRef: "role:guide",
        hostAuthorityRef: "authority:host",
        tools: ["shell"],
      },
    }),
    /agentBinding contains unsupported field tools/,
  );
  assert.throws(
    () => persistStoryPiece(projectFixture(), piece({ assetRefs: [{ id: "asset:image:embedded", bytes: "forbidden" }] })),
    /assetRefs must contain reference strings only/,
  );
});

test("#1675 Phase 2 identical Story Piece retries are idempotent while conflicting overwrite fails closed", () => {
  const first = persistStoryPiece(projectFixture(), piece());
  const retry = persistStoryPiece(first.project, piece());
  assert.equal(retry.status, "duplicate");
  assert.deepEqual(retry.project, first.project);

  const before = structuredClone(first.project);
  assert.throws(
    () => persistStoryPiece(first.project, piece({ title: "Changed without an edit transition" })),
    /already exists with different authoritative content/,
  );
  assert.deepEqual(first.project, before);
});

test("#1675 Phase 2 loading one Story Piece does not validate or materialize unrelated corrupted pieces", () => {
  const first = persistStoryPiece(projectFixture(), piece()).project;
  const second = persistStoryPiece(first, piece({ id: "piece:distant", title: "Distant Place" })).project;
  const corrupted = structuredClone(second);
  corrupted.extensions.storyTheUnwritten.storyPieces["piece:distant"].assetRefs = [{ embedded: true }];

  const local = loadStoryPiece(corrupted, "piece:crossroads");
  assert.equal(local.ok, true);
  assert.equal(local.piece.id, "piece:crossroads");

  const distant = loadStoryPiece(corrupted, "piece:distant");
  assert.equal(distant.ok, false);
  assert.equal(distant.reason, "invalid-piece");
});

test("#1675 Phase 2 later session persistence preserves authoritative Story Pieces byte-for-byte", () => {
  const withPiece = persistStoryPiece(projectFixture(), piece()).project;
  const before = structuredClone(withPiece.extensions.storyTheUnwritten.storyPieces);
  const persisted = persistStorySessionSnapshot(withPiece, {
    runtime: activeRuntime(),
    state: createStoryMechanicalState(),
    savedAt: "2026-09-04T10:25:00.000Z",
  });
  assert.deepEqual(persisted.project.extensions.storyTheUnwritten.storyPieces, before);
  assert.deepEqual(persisted.project.extensions.canonicalRevision, withPiece.extensions.canonicalRevision);
});

test("#1675 Phase 2 Story Piece timestamps, provenance admission pairs and schema fields fail closed", () => {
  assert.equal(validateStoryPieceForPersistence(piece({ updatedAt: "not-a-date" })).ok, false);
  assert.equal(validateStoryPieceForPersistence(piece({
    provenance: provenance({ admittedByRef: "profile:writer", admittedAt: null }),
  })).ok, false);
  assert.equal(validateStoryPieceForPersistence(piece({ schemaVersion: 2 })).ok, false);
  assert.equal(validateStoryPieceForPersistence(piece({ updatedAt: "2026-09-04T10:19:00.000Z" })).ok, false);
});
