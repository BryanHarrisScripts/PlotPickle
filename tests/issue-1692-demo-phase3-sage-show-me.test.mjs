import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createDemoBoundary } from "../core/demo-onboarding/demo-boundary.mjs";
import { createStoryDemoShowMe } from "../modules/story-the-unwritten/demo/show-me.mjs";
import {
  DEMO_STORY_SCENARIO_ID,
  DEMO_STORY_SEED,
  replayStoryDemoWorld,
} from "../modules/story-the-unwritten/demo/world.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const boundary = () => createDemoBoundary({ demoId: DEMO_STORY_SCENARIO_ID, seed: DEMO_STORY_SEED });
const replay = (decisionIds) => replayStoryDemoWorld({ boundary: boundary(), decisionIds });

test("#1692 Phase 3 Show Me is read-only and reports the actual before/after STORY change", () => {
  const before = replay([]);
  const after = replay(["demo:decision:follow-lantern"]);
  const frozenEvidence = JSON.stringify(after);
  const projection = createStoryDemoShowMe(after, { view: "change", previousWorld: before });

  assert.equal(projection.kind, "change");
  assert.match(projection.title, /Follow the lantern/u);
  assert.deepEqual(projection.changes.find((item) => item.label === "Mara location"), {
    label: "Mara location",
    before: "Lantern road",
    after: "The fork",
  });
  assert.equal(JSON.stringify(after), frozenEvidence);
});

test("#1692 Phase 3 knowledge view preserves character-private knowledge partitions", () => {
  const shared = createStoryDemoShowMe(replay([
    "demo:decision:follow-lantern",
    "demo:decision:share-whisper",
  ]), { view: "knowledge" });
  const kept = createStoryDemoShowMe(replay([
    "demo:decision:follow-lantern",
    "demo:decision:keep-whisper",
  ]), { view: "knowledge" });

  const group = (projection, title) => projection.groups.find((item) => item.title === title)?.items || [];
  assert.ok(group(shared, "Shared audience knowledge").includes("Lantern flickers near truth"));
  assert.ok(group(shared, "Rowan only").includes("The gate's name"));
  assert.ok(!group(shared, "Mara only").includes("The gate's name"));
  assert.ok(group(kept, "Mara only").includes("The gate's name"));
  assert.ok(!group(kept, "Rowan only").includes("The gate's name"));
});

test("#1692 Phase 3 relationship view is a projection of current STORY mechanical state, not a second graph", () => {
  const projection = createStoryDemoShowMe(replay([
    "demo:decision:follow-lantern",
    "demo:decision:share-whisper",
    "demo:decision:keep-key",
  ]), { view: "relationships" });

  assert.equal(projection.kind, "relationships");
  assert.ok(projection.edges.some((edge) => edge.from === "Mara" && edge.relation === "is at" && edge.to === "The fork"));
  assert.ok(projection.edges.some((edge) => edge.from === "Brass key" && edge.relation === "is held by" && edge.to === "Mara"));
});

test("#1692 Phase 3 authority view is derived from the executable DEMO capability boundary", () => {
  const projection = createStoryDemoShowMe(replay([]), { view: "authority" });
  const byArea = Object.fromEntries(projection.boundaries.map((item) => [item.area, item.status]));

  assert.equal(byArea["Synthetic STORY world"], "allowed");
  assert.equal(byArea["Sage Show Me"], "read-only");
  assert.equal(byArea["Human profiles and projects"], "blocked");
  assert.equal(byArea["Real PPF canon"], "blocked");
  assert.equal(byArea["BUZZ, providers and connectors"], "blocked");
  assert.equal(byArea["Agent authority"], "blocked");
});

test("#1692 Phase 3 unsupported Show Me views fail closed", () => {
  assert.throws(
    () => createStoryDemoShowMe(replay([]), { view: "raw-system-graph" }),
    (error) => error?.code === "DEMO_SHOW_ME_VIEW_UNSUPPORTED",
  );
});

test("#1692 Phase 3 browser asks the local Node projection route and does not import Sage/STORY authority machinery", async () => {
  const [client, route, showMe] = await Promise.all([
    read("app/profile-access/demo/demo-experience.tsx"),
    read("app/api/demo/story/route.ts"),
    read("modules/story-the-unwritten/demo/show-me.mjs"),
  ]);

  assert.match(client, /Sage Brinewick · Show Me/u);
  assert.match(client, /data-sage-show-me="read-only"/u);
  assert.match(client, /action: "show-me"/u);
  assert.match(client, /Read-only · no model or provider required/u);
  assert.doesNotMatch(client, /modules\/story-the-unwritten|core\/demo-onboarding|sage-context-engine|memory-aware-sage|providerCredentials|node:crypto/u);

  assert.match(route, /createStoryDemoShowMe/u);
  assert.match(route, /action === "show-me"/u);
  assert.match(route, /replayStoryDemoWorld/u);
  assert.match(showMe, /assertDemoCapability\("sage\.explain\.read"\)/u);
  assert.match(showMe, /DEMO_ALLOWED_CAPABILITIES/u);
  assert.match(showMe, /DEMO_FORBIDDEN_CAPABILITIES/u);
  assert.doesNotMatch(showMe, /profile-private|createApprovedDemoHandoff|ppf\.canon\.write\(\)|agent\.grant-authority\(\)|fetch\s*\(/u);
});
