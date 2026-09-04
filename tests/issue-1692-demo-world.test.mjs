import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import { createDemoBoundary } from "../modules/demo-onboarding/demo-boundary.mjs";
import {
  DEMO_STORY_SCENARIO,
  DEMO_STORY_SCENARIO_ID,
  DEMO_STORY_SEED,
  applyStoryDemoDecision,
  assertStoryDemoSyntheticRefs,
  createStoryDemoWorld,
  demoStorySceneCount,
  listStoryDemoDecisions,
  projectStoryDemoKnowledge,
  replayStoryDemoWorld,
  resetStoryDemoWorld,
} from "../modules/story-the-unwritten/demo-world.mjs";

const root = process.cwd();

function boundary() {
  return createDemoBoundary({ demoId: DEMO_STORY_SCENARIO_ID, seed: DEMO_STORY_SEED });
}

const primaryPath = Object.freeze([
  "demo:decision:follow-lantern",
  "demo:decision:share-whisper",
  "demo:decision:return-key",
  "demo:decision:ask-rowan",
  "demo:decision:write-ending",
]);

const privatePath = Object.freeze([
  "demo:decision:take-high-road",
  "demo:decision:keep-whisper",
  "demo:decision:keep-key",
  "demo:decision:enter-alone",
  "demo:decision:leave-door-open",
]);

function play(decisions, prefix = "2026-09-04T00:00:") {
  let world = createStoryDemoWorld({ boundary: boundary() });
  decisions.forEach((decisionId, index) => {
    world = applyStoryDemoDecision(world, decisionId, {
      proposedAt: `${prefix}${String(index).padStart(2, "0")}.000Z`,
    });
  });
  return world;
}

test("#1692 Phase 1 bundles exactly one five-scene synthetic STORY world", () => {
  const world = createStoryDemoWorld({ boundary: boundary() });
  assert.equal(DEMO_STORY_SCENARIO.synthetic, true);
  assert.equal(DEMO_STORY_SCENARIO.scenes.length, 5);
  assert.equal(demoStorySceneCount(), 5);
  assert.equal(world.runtime.session.status, "active");
  assert.equal(world.runtime.session.currentSceneId, "demo:scene:1");
  assert.equal(world.runtime.session.ppfProjectRef, "demo:ppf-projection:lantern-at-the-fork");
  assert.equal(world.state.revision, 0);
  assert.equal(world.state.values["demo:value:turns"], 0);
  assert.equal(assertStoryDemoSyntheticRefs(world), true);
  assert.deepEqual(listStoryDemoDecisions(world).map(({ id }) => id), [
    "demo:decision:follow-lantern",
    "demo:decision:take-high-road",
  ]);
});

test("#1692 Phase 1 resolves decisions through production STORY mechanics and completes deterministically", () => {
  const world = play(primaryPath);
  assert.equal(world.runtime.session.status, "completed");
  assert.equal(world.runtime.session.currentSceneId, null);
  assert.deepEqual(world.runtime.scenes.map(({ status }) => status), ["resolved", "resolved", "resolved", "resolved", "resolved"]);
  assert.equal(world.state.revision, 15);
  assert.equal(world.runtime.session.stateRevision, 15);
  assert.equal(world.state.values["demo:value:turns"], 5);
  assert.equal(world.state.characterLocations["demo:character:mara"], "demo:location:fork");
  assert.deepEqual(world.state.knowledgeByCharacter["demo:character:rowan"], ["demo:knowledge:gate-name"]);
  assert.deepEqual(world.state.knowledgeByCharacter["demo:character:mara"], []);
  assert.equal(world.state.relationships["demo:relationship:mara-rowan"], 2);
  assert.equal(world.state.objectCustody["demo:object:brass-key"], "demo:location:key-stone");
  assert.deepEqual(world.state.openThreads, []);
  assert.equal(world.decisionHistory.length, 5);
  assert.ok(world.decisionHistory.every(({ matchedRuleIds }) => matchedRuleIds.length === 1));
  assert.ok(world.decisionHistory.every(({ consequenceKinds }) => consequenceKinds.includes("adjust-number")));
});

test("#1692 Phase 1 alternate choices produce a different but valid deterministic consequence path", () => {
  const world = play(privatePath);
  assert.equal(world.runtime.session.status, "completed");
  assert.equal(world.state.values["demo:value:turns"], 5);
  assert.equal(world.state.characterLocations["demo:character:mara"], "demo:location:archive");
  assert.deepEqual(world.state.knowledgeByCharacter["demo:character:mara"], ["demo:knowledge:gate-name"]);
  assert.deepEqual(world.state.knowledgeByCharacter["demo:character:rowan"], []);
  assert.equal(world.state.objectCustody["demo:object:brass-key"], "demo:character:mara");
  assert.equal(world.state.relationships["demo:relationship:mara-rowan"], 0);
  assert.deepEqual(world.state.openThreads, ["demo:thread:second-journey", "demo:thread:unwritten-door"]);
});

test("#1692 Phase 1 hidden knowledge projection never leaks one character's private knowledge to another or the audience", () => {
  let world = createStoryDemoWorld({ boundary: boundary() });
  world = applyStoryDemoDecision(world, "demo:decision:follow-lantern");
  world = applyStoryDemoDecision(world, "demo:decision:keep-whisper");

  const publicKnowledge = "demo:knowledge:lantern-flickers-near-truth";
  const secret = "demo:knowledge:gate-name";
  assert.deepEqual(projectStoryDemoKnowledge(world), [publicKnowledge]);
  assert.deepEqual(projectStoryDemoKnowledge(world, "demo:character:rowan"), [publicKnowledge]);
  assert.deepEqual(projectStoryDemoKnowledge(world, "demo:character:mara"), [publicKnowledge, secret]);
});

test("#1692 Phase 1 rejects decisions from a future scene and requires the exact prepared seed", () => {
  const world = createStoryDemoWorld({ boundary: boundary() });
  assert.throws(
    () => applyStoryDemoDecision(world, "demo:decision:share-whisper"),
    (error) => error?.code === "DEMO_DECISION_WRONG_SCENE",
  );
  const wrongSeed = createDemoBoundary({ demoId: DEMO_STORY_SCENARIO_ID, seed: "other-seed" });
  assert.throws(
    () => createStoryDemoWorld({ boundary: wrongSeed }),
    (error) => error?.code === "DEMO_SCENARIO_SEED_MISMATCH",
  );
});

test("#1692 Phase 1 reset deletes demo-owned mutation and recreates the known clean seed state", () => {
  let world = createStoryDemoWorld({ boundary: boundary() });
  const clean = structuredClone(world);
  world = applyStoryDemoDecision(world, "demo:decision:take-high-road");
  world = applyStoryDemoDecision(world, "demo:decision:keep-whisper");
  assert.notDeepEqual(world.state, clean.state);
  assert.deepEqual(resetStoryDemoWorld(world), clean);
});

test("#1692 Phase 1 replay is independent of action timestamps and needs no model or provider", () => {
  const first = play(primaryPath, "2026-09-04T12:00:");
  const replay = replayStoryDemoWorld({
    boundary: boundary(),
    decisionIds: primaryPath,
    proposedAtPrefix: "2099-12-31T23:59:",
  });
  assert.deepEqual(replay.runtime, first.runtime);
  assert.deepEqual(replay.state, first.state);
  assert.deepEqual(replay.decisionHistory, first.decisionHistory);
});

test("#1692 Phase 1 ownership keeps public DEMO authority in core and STORY mechanics inside STORY", async () => {
  const source = await readFile(path.join(root, "modules/story-the-unwritten/demo-world.mjs"), "utf8");
  const bridge = await readFile(path.join(root, "modules/demo-onboarding/demo-boundary.mjs"), "utf8");
  const coreBoundary = await readFile(path.join(root, "core/demo-onboarding/demo-boundary.mjs"), "utf8");

  assert.match(source, /from "\.\/actions\.mjs"/u);
  assert.match(source, /from "\.\/resolution\.mjs"/u);
  assert.match(source, /from "\.\/session-machine\.mjs"/u);
  assert.match(source, /core\/demo-onboarding\/demo-boundary\.mjs/u);
  assert.equal(bridge.trim(), 'export * from "../../core/demo-onboarding/demo-boundary.mjs";');
  assert.match(coreBoundary, /synthetic-demo-runtime/u);

  for (const forbidden of [
    /profile-private/u,
    /profile-experience/u,
    /\/api\/auth/u,
    /providerCredentials/u,
    /github connector/iu,
    /google connector/iu,
    /from ["']node:fs/iu,
    /canon-admission/u,
    /persistStoryProject/u,
    /persistProfile/u,
    /buzz.*private/iu,
  ]) {
    assert.doesNotMatch(source, forbidden);
  }
  assert.match(source, /demo:ppf-projection:lantern-at-the-fork/u);
  assert.doesNotMatch(source, /profile:[^"'\s]+/u);
});
