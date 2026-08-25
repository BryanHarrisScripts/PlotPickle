import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as ts from "typescript";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

async function storyboardModule() {
  const typescript = await source("lib/storyboard-exploration.ts");
  const compiled = ts.transpileModule(typescript, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const runnable = compiled.replace(
    /import \{ buildVisualWritingSession \} from "\.\/visual-writing-session";?/,
    "const buildVisualWritingSession = (...args) => globalThis.__plotpickleBuildVisualWritingSession(...args);",
  );
  assert.notEqual(runnable, compiled, "Expected the runtime Storyboard dependency to be replaced for isolated advisory tests");
  globalThis.__plotpickleBuildVisualWritingSession = () => ({ context: { continuityLocks: [] } });
  return import(`data:text/javascript;base64,${Buffer.from(runnable).toString("base64")}#${Date.now()}-${Math.random()}`);
}

function blocking(subjectId, overrides = {}) {
  return {
    subjectId,
    startPosition: "foreground",
    facing: "toward partner",
    eyelineTargetId: subjectId === "A" ? "B" : "A",
    movement: "",
    endPosition: "foreground",
    screenDirection: "left-to-right",
    axisState: "side-a",
    ...overrides,
  };
}

function frame(id, shotId, overrides = {}) {
  const structuredShot = {
    shotId,
    narrativePurpose: "Conversation beat",
    shotSize: "medium",
    cameraAngle: "eye level",
    cameraMovement: "",
    lensIntent: "",
    lightingIntent: "",
    continuityLockReferences: [],
    notes: "",
    blocking: [blocking("A"), blocking("B")],
    advisoryOverrides: [],
    ...(overrides.structuredShot ?? {}),
  };
  return {
    id,
    target: { kind: "mini-block", id, label: id },
    sourceKind: "manual-import",
    sourceLabel: "Manual image",
    assetRef: "",
    direction: {
      target: { kind: "mini-block", id, label: id },
      storyPurpose: "Conversation beat",
      action: "",
      emotionalTurn: "",
      characterIds: ["A", "B"],
      locationIds: ["room-1"],
      shot: "",
      staging: "",
      composition: "",
      camera: "",
      movement: "",
      structuredShot,
      continuityNotes: [],
      approvedCanonItemIds: [],
    },
    status: "candidate",
    supersedesCandidateId: "",
    supersededByCandidateId: "",
    createdAt: "2026-08-25T00:00:00.000Z",
    updatedAt: "2026-08-25T00:00:00.000Z",
    ...overrides.frame,
  };
}

test("#1166 stores semantic blocking in the existing structured shot without 3D scope", async () => {
  const model = await source("lib/storyboard-exploration.ts");
  for (const field of ["subjectId", "startPosition", "facing", "eyelineTargetId", "movement", "endPosition", "screenDirection", "axisState"]) {
    assert.match(model, new RegExp(`\\b${field}\\b`), `Missing blocking field ${field}`);
  }
  assert.match(model, /blocking: StoryboardSubjectBlocking\[\]/);
  assert.match(model, /advisoryOverrides: StoryboardAdvisoryOverride\[\]/);
  assert.match(model, /const EXTENSION_KEY = "storyboardExploration"/);
  assert.doesNotMatch(model, /cameraCoordinates|floorPlan|blockingCanvas|occlusionSimulation|normalizedSceneCoordinates/i);
});

test("#1166 allows a consistent two-character axis and eyeline sequence", async () => {
  const { evaluateStoryboardAdvisories } = await storyboardModule();
  const findings = evaluateStoryboardAdvisories([
    frame("frame-1", "shot-1"),
    frame("frame-2", "shot-2"),
  ]);
  assert.deepEqual(findings, []);
});

test("#1166 warns on a clear axis crossing and permits an intentional reasoned override", async () => {
  const { evaluateStoryboardAdvisories } = await storyboardModule();
  const crossed = frame("frame-2", "shot-2");
  crossed.direction.structuredShot.blocking[0].axisState = "side-b";
  let findings = evaluateStoryboardAdvisories([frame("frame-1", "shot-1"), crossed]);
  const crossing = findings.find((finding) => finding.code === "axis-crossing");
  assert.ok(crossing, "Expected an axis-crossing advisory");
  assert.equal(crossing.shotId, "shot-2");
  assert.equal(crossing.relatedShotId, "shot-1");
  assert.equal(crossing.overridden, false);

  crossed.direction.structuredShot.advisoryOverrides = [{ findingId: crossing.id, reason: "Deliberate reveal across the line" }];
  findings = evaluateStoryboardAdvisories([frame("frame-1", "shot-1"), crossed]);
  const acknowledged = findings.find((finding) => finding.code === "axis-crossing");
  assert.equal(acknowledged?.overridden, true);
  assert.equal(acknowledged?.overrideReason, "Deliberate reveal across the line");
});

test("#1166 warns on explicit eyeline or screen-direction mismatch", async () => {
  const { evaluateStoryboardAdvisories } = await storyboardModule();
  const mismatched = frame("frame-2", "shot-2");
  mismatched.direction.structuredShot.blocking[0].eyelineTargetId = "C";
  mismatched.direction.structuredShot.blocking[1].screenDirection = "right-to-left";
  const codes = new Set(evaluateStoryboardAdvisories([frame("frame-1", "shot-1"), mismatched]).map((finding) => finding.code));
  assert.equal(codes.has("eyeline-mismatch"), true);
  assert.equal(codes.has("screen-direction-mismatch"), true);
});

test("#1166 reports referenced continuity conflicts without mutating the shot", async () => {
  const { evaluateStoryboardAdvisories } = await storyboardModule();
  const candidate = frame("frame-1", "shot-1");
  candidate.direction.structuredShot.continuityLockReferences = ["camera-lock-1"];
  const before = structuredClone(candidate);
  const findings = evaluateStoryboardAdvisories([candidate], {
    "shot-1": [{ lockId: "camera-lock-1", message: "Inherited camera lock conflicts with its explicit scene override." }],
  });
  assert.equal(findings.some((finding) => finding.code === "continuity-lock-conflict"), true);
  assert.deepEqual(candidate, before);
  assert.equal(candidate.status, "candidate");
});

test("#1166 does not over-warn one action plus one camera move but flags overloaded short motion", async () => {
  const { evaluateStoryboardAdvisories } = await storyboardModule();
  const simple = frame("frame-1", "shot-1");
  simple.direction.structuredShot.cameraMovement = "pan left";
  simple.direction.structuredShot.blocking[0].movement = "crosses to doorway";
  assert.equal(evaluateStoryboardAdvisories([simple]).some((finding) => finding.code === "generative-complexity"), false);

  const overloaded = frame("frame-2", "shot-2");
  overloaded.direction.structuredShot.cameraMovement = "pan left, tilt up";
  overloaded.direction.structuredShot.blocking[0].movement = "crosses to doorway";
  const complexity = evaluateStoryboardAdvisories([overloaded]).find((finding) => finding.code === "generative-complexity");
  assert.ok(complexity);
  assert.match(complexity.message, /short beat/i);
});

test("#1166 acknowledgement records only advisory intent and leaves canon and approval untouched", async () => {
  const { acknowledgeStoryboardAdvisory } = await storyboardModule();
  const candidate = frame("frame-2", "shot-2");
  const project = {
    id: "project-1",
    story: { premise: "Keep me" },
    extensions: {
      visualCanon: { version: 1, items: [{ id: "canon-1", status: "approved" }] },
      storyboardExploration: { version: 1, frames: [candidate] },
    },
  };
  const updated = acknowledgeStoryboardAdvisory(
    project,
    "frame-2",
    "axis-crossing:shot-2:shot-1:A",
    "Intentional reveal",
    "2026-08-25T00:01:00.000Z",
  );
  const stored = updated.extensions.storyboardExploration.frames[0];
  assert.equal(stored.status, "candidate");
  assert.deepEqual(updated.extensions.visualCanon, project.extensions.visualCanon);
  assert.deepEqual(updated.story, project.story);
  assert.deepEqual(stored.direction.structuredShot.advisoryOverrides, [
    { findingId: "axis-crossing:shot-2:shot-1:A", reason: "Intentional reveal" },
  ]);
});

test("#1166 presents advisories as non-blocking and gives the Human an intentional override action", async () => {
  const view = await source("app/storyboard-exploration.tsx");
  assert.match(view, /Shot advisories are non-blocking/);
  assert.match(view, /Advisory checks/);
  assert.match(view, /Acknowledge intentionally/);
  assert.match(view, /Intentional exception:/);
  assert.match(view, /onAcknowledgeAdvisory/);
  assert.match(view, /disabled=\{warnings\.length > 0\}/);
  assert.doesNotMatch(view, /disabled=\{[^}]*advis/i);
});
