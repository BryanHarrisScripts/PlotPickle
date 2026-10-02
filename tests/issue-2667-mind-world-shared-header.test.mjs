import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("#2667 Mind Map and World Map consume one shared surface/header family", async () => {
  const [shared, mind, world, host] = await Promise.all([
    read("app/skin-v1/story-development-surface-header.tsx"),
    read("app/skin-v1/discovery-surface.tsx"),
    read("app/skin-v1/story-bible-surface.tsx"),
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
  ]);
  assert.match(shared, /data-story-development-surface-header="shared"/u);
  assert.match(shared, /data-story-development-family="mind-world"/u);
  assert.match(shared, /STORY_ACTS\.map\(\(act\)/u);
  assert.match(shared, /LEARN_TOPIC_SPINE\.map\(\(topic, index\)/u);
  assert.match(shared, /Back to Dashboard/u);
  assert.match(shared, /pp-skin-v1-return/u);
  assert.match(mind, /surfaceId="mind-map"/u);
  assert.match(mind, /data-story-development-work-region="mind-map"/u);
  assert.match(world, /surfaceId="world-map"/u);
  assert.match(world, /data-story-development-work-region="world-map"/u);
  const mindHost = host.slice(host.indexOf("if (discoveryOpen)"), host.indexOf("if (storyBibleOpen"));
  const worldHost = host.slice(host.indexOf("if (storyBibleOpen"), host.indexOf("if (libraryOpen)"));
  assert.doesNotMatch(mindHost, /pp-skin-v1-bbs-banner/u);
  assert.doesNotMatch(worldHost, /pp-skin-v1-bbs-banner/u);
  assert.match(mindHost, /onBackDashboard=/u);
  assert.match(worldHost, /onBackDashboard=/u);
});

test("#2667 canonical twelve-topic spine and safe Act shortcuts stay shared", async () => {
  const [shared, spine, rail, mind, world] = await Promise.all([
    read("app/skin-v1/story-development-surface-header.tsx"),
    read("modules/learn/model/story-learning-context.ts"),
    read("app/skin-v1/story-act-rail.tsx"),
    read("app/skin-v1/discovery-surface.tsx"),
    read("app/skin-v1/story-bible-surface.tsx"),
  ]);
  for (const label of ["Foundations","World","Character","Theme","Structure","PREVIS","Drafting","Dialogue","Revision","Responsible AI","Industry","Collaboration"]) {
    assert.ok(spine.includes('label: "' + label + '"'), "missing topic label " + label);
  }
  assert.match(shared, /LEARN_TOPIC_SPINE/u);
  assert.match(shared, /aria-keyshortcuts=\{String\(act\)\}/u);
  assert.match(rail, /handleStoryActShortcut/u);
  assert.match(mind, /handleStoryActShortcut\(event, changeAct\)/u);
  assert.match(world, /handleStoryActShortcut\(event, setSelectedAct\)/u);
});

test("#2667 Mind Map preserves one consolidated authoring region and page/action controls", async () => {
  const [mind, styles, model] = await Promise.all([
    read("app/skin-v1/discovery-surface.tsx"),
    read("app/skin-v1/discovery-surface.module.css"),
    read("modules/learn/model/story-development-fields.ts"),
  ]);
  assert.equal((mind.match(/data-story-development-work-region="mind-map"/gu) || []).length, 2);
  assert.match(mind, /data-mind-map-field-page=\{page\}/u);
  assert.match(model, /export const MIND_MAP_FIELD_PAGE_SIZE = 6/u);
  assert.match(mind, />Save Changes<\/button>/u);
  assert.match(mind, /selectedField\.actionLabel/u);
  assert.match(model, /actionLabel: "Ask Agent"/u);
  assert.match(mind, /data-mind-map-human-notes-toggle/u);
  assert.match(mind, />Open in Learn<\/button>/u);
  assert.match(styles, /\.workRegion \{/u);
  assert.doesNotMatch(mind, /className=\{styles\.topicRail\}/u);
});

test("#2667 World Map stays read/review-only inside one compact work region", async () => {
  const [world, styles] = await Promise.all([
    read("app/skin-v1/story-bible-surface.tsx"),
    read("app/skin-v1/story-bible-surface.module.css"),
  ]);
  assert.equal((world.match(/data-story-development-work-region="world-map"/gu) || []).length, 1);
  assert.match(world, /Open Topic in Learn/u);
  assert.match(world, /Edit in Mind Map/u);
  assert.match(world, /World Map does not edit, approve, or generate them\./u);
  assert.match(styles, /\.workRegion \{/u);
  assert.match(styles, /\.topicSupplement \{/u);
  assert.doesNotMatch(world, /Ask World Agent|Generate Poster Visual|Generate Missing Views/u);
});

test("#2667 Outline Storyboard Previs and Library remain outside the Mind World family", async () => {
  const [host, library] = await Promise.all([
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
    read("modules/library/ui/library-workspace.tsx"),
  ]);
  for (const [startLabel, endLabel] of [["if (outlineOpen)","if (buildOpen)"],["if (storyboardOpen)","if (previsOpen)"],["if (previsOpen)","if (timelineOpen)"]]) {
    const slice = host.slice(host.indexOf(startLabel), host.indexOf(endLabel));
    assert.match(slice, /<StoryActRail/u);
    assert.doesNotMatch(slice, /StoryDevelopmentSurfaceHeader/u);
  }
  assert.doesNotMatch(library, /StoryDevelopmentSurfaceHeader|data-story-development-family/u);
});

test("#2667 critical rendered journey is wired into live architecture verification", async () => {
  const [journey, live] = await Promise.all([
    read("core/sidecars/webmcp-acceptance-sidecar.mjs"),
    read("scripts/verification-webmcp-live.mjs"),
  ]);
  assert.match(journey, /"mind-map-world-map-shared-header"/u);
  assert.match(journey, /ensureKnownActiveProject/u);
  assert.match(journey, /EXPECTED_STORY_DEVELOPMENT_TOPICS/u);
  assert.match(journey, /mind-map-actions-preserved/u);
  assert.match(journey, /shared-header-geometry/u);
  assert.match(journey, /journey-active-project-stable/u);
  assert.match(live, /runWebMcpAcceptanceJourney/u);
  assert.match(live, /target: "mind-map-world-map-shared-header"/u);
  assert.match(live, /mode: "exact-head"/u);
});
