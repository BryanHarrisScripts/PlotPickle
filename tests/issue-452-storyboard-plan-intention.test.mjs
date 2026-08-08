import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("#452 selected Storyboard moment shows same-PPF identity, Plan intention and story purpose", async () => {
  const host = await source("app/storyboard-plan-intention-host.tsx");

  assert.match(host, /Same PPF story moment/);
  assert.match(host, /Plan intention/);
  assert.match(host, /Story purpose/);
  assert.match(host, /#visual-language article/);
  assert.match(host, /pitch visual statement/i);
  assert.match(host, /world visual language/i);
  assert.match(host, /storyPurpose/);
});

test("#452 Plan intention context reads the selected canonical Block and mini-block without writing state", async () => {
  const host = await source("app/storyboard-plan-intention-host.tsx");

  assert.match(host, /params\.get\("block"\)/);
  assert.match(host, /params\.get\("mini"\)/);
  assert.match(host, /Block\\s\+\(\\d\+\)\\\.\(\\d\+\)/);
  assert.match(host, /#storyboard-decisions/);
  assert.match(host, /createPortal/);
  assert.match(host, /MutationObserver/);
  assert.doesNotMatch(host, /setProject|commit\(|approvedImageVersionId|approvedVideoVersionId|localStorage|sessionStorage|indexedDB/i);
});

test("#452 Plan intention context stays out of dedicated decision review", async () => {
  const host = await source("app/storyboard-plan-intention-host.tsx");

  assert.match(host, /params\.get\("decision"\) === "review"/);
  assert.match(host, /visualSection\) !== "frames"/);
  assert.doesNotMatch(host, /Ollama|ComfyUI|MiniMax|checkpoint|endpoint|apiKey/i);
});

test("#452 Plan intention context is mounted beside the proven Write continuation, not instead of it", async () => {
  const layout = await source("app/layout.tsx");

  assert.match(layout, /import StoryboardPlanIntentionHost/);
  assert.match(layout, /<StoryboardPlanIntentionHost \/>/);
  assert.match(layout, /<StoryboardWriteHandoff \/>/);
  assert.match(layout, /<StoryboardNavigationGroupsHost \/>/);
  assert.match(layout, /<StoryboardStudioHost \/>/);
});

test("#452 Plan intention strip says visual context informs later work without overwriting canon", async () => {
  const host = await source("app/storyboard-plan-intention-host.tsx");

  assert.match(host, /informs Storyboard and Write without overwriting screenplay or approval state/);
  assert.match(host, /Add the project visual intention in Plan/);
});
