import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("#2759 stores Timeline assembly revisions inside existing canonical production authority", async () => {
  const [contract, commands, reducer] = await Promise.all([
    read("core/contracts/previs/index.ts"),
    read("core/contracts/story-command.ts"),
    read("core/project/apply-command.ts"),
  ]);

  assert.match(contract, /interface TimelinePrevisPlacement/u);
  assert.match(contract, /sourceKind: "previs-flip-book"/u);
  assert.match(contract, /readonly sourceKey: string/u);
  assert.match(contract, /readonly shotImages: readonly TimelineShotImageRef\[\]/u);
  assert.match(contract, /interface TimelineAssemblyRevision/u);
  assert.match(contract, /readonly supersedesTimelineId\?: string/u);
  assert.match(contract, /timelineAssemblies\?: readonly TimelineAssemblyRevision\[\]/u);
  assert.match(commands, /"production\.timeline\.store"/u);
  assert.match(reducer, /timelineAssemblies: \[command\.assembly, \.\.\.existing\]/u);
  assert.doesNotMatch(contract, /TimelineStore|TimelineDatabase/u);
});

test("#2759 Timeline sources approved Previs Flip Book snapshots without manual re-import", async () => {
  const workspace = await read("app/_components/timeline/timeline-assembly-workspace.tsx");

  assert.match(workspace, /artifact\.workflow === "storyboard-frame-webp-v2"/u);
  assert.match(workspace, /artifact\.reviewState === "accepted"/u);
  assert.match(workspace, /accepted\.has\(artifact\.id\)/u);
  assert.match(workspace, /Previs Flip Book · ~75 sec/u);
  assert.match(workspace, /no manual re-import/u);
  assert.match(workspace, /Place on Timeline/u);
  assert.match(workspace, /sourceKey/u);
  assert.match(workspace, /sourceRevision/u);
  assert.match(workspace, /shotImages: source\.shotImages/u);
  assert.doesNotMatch(workspace, /upload|file input|accept="video/iu);
});

test("#2759 supports chronological placement, playback, seek, scrub, and adjacent Mini-Block review", async () => {
  const workspace = await read("app/_components/timeline/timeline-assembly-workspace.tsx");

  for (const phrase of [
    "Previous clip",
    "Play",
    "Pause",
    "Next clip",
    "Timeline seek and scrub",
    "Move earlier",
    "Move later",
    "Chronological Mini-Block assembly",
  ]) assert.ok(workspace.includes(phrase), `Missing Timeline control: ${phrase}`);

  assert.match(workspace, /setInterval/u);
  assert.match(workspace, /setPlayheadSeconds/u);
  assert.match(workspace, /placements\.reduce\(\(sum, placement\) => sum \+ placement\.durationSeconds/u);
  assert.match(workspace, /Act \{selectedAct\} · 6 Blocks · 24 Mini-Blocks/u);
  assert.match(workspace, /25 planned Shots · ~3 sec per Shot · ~75 sec planning target/u);
  assert.doesNotMatch(workspace, /applyStoryCommand[\s\S]{0,300}setInterval/u);
});

test("#2759 synchronizes screenplay evidence to the active placed Mini-Block without duplicating the screenplay editor", async () => {
  const workspace = await read("app/_components/timeline/timeline-assembly-workspace.tsx");

  assert.match(workspace, /storyboardAnchorEvidence\(project, activeTargetId, activeAddress\.miniBlockNumber\)/u);
  assert.match(workspace, /Synchronized screenplay source/u);
  assert.match(workspace, /Current Mini-Block evidence/u);
  assert.match(workspace, /activeEvidence\.passages/u);
  assert.match(workspace, /Timeline does not manufacture source text or timestamps/u);
  assert.doesNotMatch(workspace, /textarea|contentEditable|Save screenplay/u);
});

test("#2759 never silently replaces a Human Timeline placement when upstream Previs changes", async () => {
  const workspace = await read("app/_components/timeline/timeline-assembly-workspace.tsx");

  assert.match(workspace, /current\.sourceKey !== placement\.sourceKey/u);
  assert.match(workspace, /STALE · newer upstream source available/u);
  assert.match(workspace, /Update to current Previs source/u);
  assert.match(workspace, /supersedesTimelineId/u);
  assert.match(workspace, /Earlier Timeline revisions remain preserved/u);
  assert.match(workspace, /will not change silently/u);
});

test("#2759 keeps generation upstream and Rough Cut downstream", async () => {
  const [surface, host, workspace] = await Promise.all([
    read("app/skin-v1/preproduction-review-surfaces.tsx"),
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
    read("app/_components/timeline/timeline-assembly-workspace.tsx"),
  ]);

  assert.match(surface, /<TimelineAssemblyWorkspace/u);
  assert.match(surface, /onOpenPrevis=\{onOpenPrevis\}/u);
  assert.match(surface, /onOpenStoryboard=\{onOpenStoryboard\}/u);
  assert.match(host, /<SkinV1TimelineReviewSurface[\s\S]*onOpenPrevis=\{openPrevis\}/u);
  assert.match(workspace, /Open owning Previs Mini-Block/u);
  assert.match(workspace, /Open owning Storyboard Mini-Block/u);
  assert.doesNotMatch(workspace, /generate|regenerate|provider|OpenAI|Ollama|FFramesLocalMediaEngine/iu);
});
