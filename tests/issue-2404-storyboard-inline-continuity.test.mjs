import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2404 keeps Storyboard identified as Storyboard from the Dashboard shell", async () => {
  const [client, host] = await Promise.all([
    read("app/skin-v1/skin-v1-client.tsx"),
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
  ]);

  assert.match(client, /\["plan", "storyboard", "previs", "timeline", "production"\]\.includes\(item\.id\)/u);
  assert.match(client, /setDashboardSurfaceName\(item\.label\.toUpperCase\(\)\)/u);
  assert.match(host, /if \(storyboardOpen\)[\s\S]*?<h1>STORYBOARD<\/h1>/u);
  assert.match(host, /if \(storyboardOpen\)[\s\S]*?onSurfaceNameChange\("STORYBOARD"\)/u);
});

test("#2404 keeps Scenes Beats and Beat Shot Frame on one continuous Storyboard page", async () => {
  const [workspace, visual, css] = await Promise.all([
    read("app/_components/storyboard/storyboard-readiness-workspace.tsx"),
    read("app/_components/storyboard/visual-story-workspace.tsx"),
    read("app/skin-v1/preproduction-review-flow.css"),
  ]);

  assert.doesNotMatch(workspace, /sceneBeatOpen|visualStoryOpen/u);
  assert.doesNotMatch(workspace, /View Scenes & Beats|Open Beat, Shot & Frame/u);
  assert.match(workspace, /data-storyboard-scene-beat-detail="inline"/u);
  assert.match(workspace, /<VisualStoryWorkspace[\s\S]*?embedded/u);
  assert.match(visual, /readonly embedded\?: boolean/u);
  assert.match(visual, /data-embedded=\{embedded \? "true" : undefined\}/u);
  assert.match(css, /Storyboard remains one continuous surface/u);
  assert.doesNotMatch(css, /storyboard"\]:has[\s\S]*display:\s*none/u);
});

test("#2404 presents 25 vertical Scene Beat rows with adjacent image selection", async () => {
  const [workspace, css] = await Promise.all([
    read("app/_components/storyboard/storyboard-readiness-workspace.tsx"),
    read("app/_components/storyboard/storyboard-readiness-workspace.module.css"),
  ]);

  assert.match(workspace, /Array\.from\(\{ length: 25 \}/u);
  assert.match(workspace, /className=\{styles\.positionList\}/u);
  assert.match(workspace, /className=\{styles\.positionRow\}/u);
  assert.match(workspace, /Select image for Scene and Beat position/u);
  assert.match(workspace, /availablePositionImages\.map/u);
  assert.doesNotMatch(workspace, /Existing visuals at this Mini-Block/u);
  assert.match(css, /\.positionList \{ display: grid/u);
  assert.match(css, /\.positionRow \{[\s\S]*grid-template-columns/u);
  assert.match(css, /\.positionImage img/u);
  assert.match(css, /\.positionSelector select/u);
});

test("#2404 WebMCP reaches inline Visual Story directly from Storyboard", async () => {
  const registry = await read("lib/verification/webmcp-surface-capture-registry.mjs");
  const start = registry.indexOf('"visual-story": Object.freeze');
  const end = registry.indexOf("profile: Object.freeze", start);
  const contract = registry.slice(start, end);

  assert.match(contract, /Storyboard Dashboard row/u);
  assert.doesNotMatch(contract, /data-storyboard-open-/u);
  assert.match(contract, /readySelector: "\[data-visual-story='scene-beat-shot-frame'\]"/u);
});
