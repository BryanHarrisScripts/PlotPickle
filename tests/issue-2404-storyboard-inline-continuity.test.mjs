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
  assert.match(workspace, /<StoryboardLockedShotHandoff/u);\n  assert.doesNotMatch(workspace, /<VisualStoryWorkspace/u);
  assert.match(visual, /readonly embedded\?: boolean/u);
  assert.match(visual, /data-embedded=\{embedded \? "true" : undefined\}/u);
  assert.match(css, /Storyboard remains one continuous surface/u);
  assert.doesNotMatch(css, /storyboard"\]:has[\s\S]*display:\s*none/u);
});

test("#2404 presents 25 vertical Shot Frame rows with adjacent image navigation", async () => {
  const [workspace, css] = await Promise.all([
    read("app/_components/storyboard/storyboard-readiness-workspace.tsx"),
    read("app/_components/storyboard/storyboard-readiness-workspace.module.css"),
  ]);

  assert.match(workspace, /Array\.from\(\{ length: 25 \}/u);
  assert.match(workspace, /className=\{styles\.positionList\}/u);
  assert.match(workspace, /className=\{styles\.positionRow\}/u);
  assert.match(workspace, /Previous Storyboard Image for Shot/u);
  assert.match(workspace, /Next Storyboard Image for Shot/u);
  assert.match(workspace, /const positionImages = \[\.\.\.generatedPositionImages, \.\.\.linkedPositionImages\]/u);
  assert.match(workspace, /25 Planned Shots/u);
  assert.doesNotMatch(workspace, /Existing visuals at this Mini-Block/u);
  assert.match(css, /\.positionList \{ display: grid/u);
  assert.match(css, /\.positionRow \{[\s\S]*grid-template-columns/u);
  assert.match(css, /\.positionImage img/u);
  assert.match(css, /\.frameChevron \{/u);
  assert.doesNotMatch(css, /\.positionSelector/u);
});

test("#2404 keeps inline Visual Story governed by the Storyboard parent", async () => {
  const [registry, canonicalText, orchestrator, catalogue] = await Promise.all([
    read("lib/verification/webmcp-surface-capture-registry.mjs"),
    read("config/skin-v1-surface-registry.json"),
    read("app/skin-v1/surface-orchestrator.tsx"),
    read("lib/verification/webmcp-standard-surface-catalogue.mjs"),
  ]);
  const start = registry.indexOf('"visual-story": Object.freeze');
  const end = registry.indexOf("profile: Object.freeze", start);
  const contract = registry.slice(start, end);
  const canonical = JSON.parse(canonicalText);
  const storyboard = canonical.surfaces.find((surface) => surface.id === "storyboard");

  assert.match(contract, /Storyboard Dashboard row/u);
  assert.doesNotMatch(contract, /data-storyboard-open-/u);
  assert.match(contract, /surface: "STORYBOARD"/u);
  assert.match(contract, /aliasSurfaceId: "storyboard"/u);
  assert.match(contract, /readySelector: "\[data-visual-story='scene-beat-shot-frame'\]"/u);
  assert.deepEqual(storyboard?.ownsInlineSurfaces, ["story-map", "visual-story"]);
  assert.match(orchestrator, /surface\.ownsInlineSurfaces \?\? \[\]/u);
  assert.match(orchestrator, /ownedInlineSurfaceIds\.has\(surface\.id\)/u);
  assert.doesNotMatch(orchestrator, /storyboardOwnsInlineChildren/u);
  assert.match(catalogue, /const inlineOwner = visibleContracts\.find/u);
  assert.match(catalogue, /contract\.ownsInlineSurfaces/u);
  assert.match(catalogue, /if \(inlineOwner\) return inlineOwner\.contract/u);
});
