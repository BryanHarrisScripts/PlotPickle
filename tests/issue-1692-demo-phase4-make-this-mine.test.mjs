import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createDemoBoundary } from "../core/demo-onboarding/demo-boundary.mjs";
import { createStoryDemoStarterHandoff } from "../modules/story-the-unwritten/demo/handoff.mjs";
import {
  DEMO_STORY_SCENARIO_ID,
  DEMO_STORY_SEED,
} from "../modules/story-the-unwritten/demo/world.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const completedPath = Object.freeze([
  "demo:decision:follow-lantern",
  "demo:decision:share-whisper",
  "demo:decision:return-key",
  "demo:decision:ask-rowan",
  "demo:decision:write-ending",
]);

function boundary() {
  return createDemoBoundary({ demoId: DEMO_STORY_SCENARIO_ID, seed: DEMO_STORY_SEED });
}

test("#1692 Phase 4 converts a completed DEMO path into portable Human-owned starter text only", () => {
  const handoff = createStoryDemoStarterHandoff({
    boundary: boundary(),
    decisionIds: completedPath,
    approved: true,
  });

  assert.equal(handoff.destination, "fresh-human-project");
  assert.deepEqual(Object.keys(handoff.starterContent).sort(), ["foundationsBrief", "title"]);
  assert.equal(handoff.starterContent.title, "The Lantern at the Fork — My Story");
  for (const phrase of [
    "Follow the lantern",
    "Tell Rowan the gate's name",
    "Return the key to Rowan",
    "Ask Rowan to enter together",
    "Write an ending",
  ]) {
    assert.ok(handoff.starterContent.foundationsBrief.includes(phrase));
  }
  assert.doesNotMatch(JSON.stringify(handoff.starterContent), /demo:/u);
});

test("#1692 Phase 4 requires both explicit approval and a complete valid five-scene path", () => {
  assert.throws(
    () => createStoryDemoStarterHandoff({ boundary: boundary(), decisionIds: completedPath.slice(0, 4), approved: true }),
    (error) => error?.code === "DEMO_HANDOFF_INCOMPLETE_PATH",
  );
  assert.throws(
    () => createStoryDemoStarterHandoff({ boundary: boundary(), decisionIds: completedPath, approved: false }),
    (error) => error?.code === "DEMO_HANDOFF_APPROVAL_REQUIRED",
  );
  assert.throws(
    () => createStoryDemoStarterHandoff({
      boundary: boundary(),
      decisionIds: [
        "demo:decision:share-whisper",
        "demo:decision:follow-lantern",
        "demo:decision:return-key",
        "demo:decision:ask-rowan",
        "demo:decision:write-ending",
      ],
      approved: true,
    }),
    (error) => error?.code === "DEMO_DECISION_WRONG_SCENE",
  );
});

test("#1692 Phase 4 endpoint crosses the real authenticated mutation boundary and creates a fresh active PPF project", async () => {
  const route = await read("app/api/demo/handoff/route.ts");

  assert.match(route, /runtimeState\.accessMode !== "desktop-loopback"[\s\S]*DEMO_LOCAL_ONLY/u);
  assert.match(route, /authorizeRequest\(requestBoundary\(request\), \{ mutation: true \}\)/u);
  assert.match(route, /createStoryDemoStarterHandoff/u);
  assert.match(route, /createEmptyProject\(\{ id: projectId, now, title: starter\.title \}\)/u);
  assert.match(route, /foundationsBrief/u);
  assert.match(route, /JSON\.stringify\(project\)\.includes\("demo:"\)/u);
  assert.match(route, /loadProject\(authContext, projectId\)/u);
  assert.match(route, /activateProject\(authContext, projectId\)/u);
  assert.match(route, /saveProject\(authContext, \{ project, activate: true \}\)/u);
  assert.match(route, /DEMO_HANDOFF_ID_CONFLICT/u);
  assert.doesNotMatch(route, /providerCredentials|connectorScopes|BUZZ_AUTH|node:fs|ppf\.canon\.write|agent\.grant-authority/u);
});

test("#1692 Phase 4 browser keeps approved handoff transient, waits for normal Human auth, then uses CSRF and reloads the active project", async () => {
  const [experience, onboarding, profileBoundary] = await Promise.all([
    read("app/profile-access/demo/demo-experience.tsx"),
    read("app/profile-access/demo/demo-onboarding-boundary.tsx"),
    read("app/profile-access/profile-access-boundary.tsx"),
  ]);

  const completedBranch = experience.indexOf("completed ? (");
  const makeThisMine = experience.indexOf("Make This Mine", completedBranch);
  const currentSceneBranch = experience.indexOf(": currentScene ? (", completedBranch);
  assert.ok(completedBranch >= 0 && makeThisMine > completedBranch && currentSceneBranch > makeThisMine);
  assert.match(experience, /onMakeThisMine\(world\.decisionHistory\.map\(\(decision\) => decision\.decisionId\)\)/u);
  assert.match(onboarding, /globalThis\.crypto\.randomUUID\(\)/u);
  assert.match(onboarding, /data-demo-handoff="pending"/u);
  assert.match(onboarding, /fetch\("\/api\/auth\/profile"/u);
  assert.match(onboarding, /!next\.authenticated \|\| !next\.csrfToken/u);
  assert.match(onboarding, /fetch\("\/api\/demo\/handoff"/u);
  assert.match(onboarding, /"X-PlotPickle-CSRF": next\.csrfToken/u);
  assert.match(onboarding, /approved: true/u);
  assert.match(onboarding, /window\.location\.assign\("\/\?workspace=dashboard"\)/u);
  assert.doesNotMatch(onboarding, /localStorage|sessionStorage/u);
  assert.doesNotMatch(onboarding, /create-first-profile|create-profile|action:\s*"login"/u);
  assert.match(profileBoundary, /create-first-profile/u);
  assert.match(profileBoundary, /action = status\?\.configured \? "create-profile" : "create-first-profile"/u);
});

test("#1692 Phase 4 retry id is deterministic per approval and cannot overwrite different existing Human data", async () => {
  const [route, onboarding] = await Promise.all([
    read("app/api/demo/handoff/route.ts"),
    read("app/profile-access/demo/demo-onboarding-boundary.tsx"),
  ]);

  assert.match(route, /function projectIdForHandoff[\s\S]*return handoffId;/u);
  assert.doesNotMatch(route, /demo-import/u);
  assert.match(route, /samePortableStarter/u);
  assert.match(route, /reused: true/u);
  assert.match(onboarding, /pendingHandoff\.handoffId/u);
  assert.match(onboarding, /setHandoffRetry\(\(value\) => value \+ 1\)/u);
});
