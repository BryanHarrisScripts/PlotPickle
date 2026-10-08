import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("#2807 replaces the embedded duplicate Visual Story gallery with a locked Shot handoff", async () => {
  const [storyboard, handoff, visualStory] = await Promise.all([
    read("app/_components/storyboard/storyboard-readiness-workspace.tsx"),
    read("app/_components/preproduction/storyboard-locked-shot-handoff.tsx"),
    read("app/_components/storyboard/visual-story-workspace.tsx"),
  ]);

  assert.match(storyboard, /<StoryboardLockedShotHandoff/u);
  assert.doesNotMatch(storyboard, /<VisualStoryWorkspace/u);
  assert.match(handoff, /Locked Shot handoff to Previs/u);
  assert.match(handoff, /data-storyboard-locked-shot-handoff="previs"/u);
  assert.match(handoff, /lockedArtifacts\.length\} of 25 Shots locked/u);
  assert.match(handoff, /candidate\.reviewState === "accepted"/u);
  assert.match(handoff, /acceptedIds\.has\(candidate\.id\)/u);
  assert.match(handoff, /data-storyboard-handoff-shot=\{position\}/u);
  assert.match(visualStory, /data-visual-story="scene-beat-shot-frame"/u);
});

test("#2807 keeps candidate browsing in the 25 Shot cards instead of the handoff", async () => {
  const [storyboard, handoff] = await Promise.all([
    read("app/_components/storyboard/storyboard-readiness-workspace.tsx"),
    read("app/_components/preproduction/storyboard-locked-shot-handoff.tsx"),
  ]);

  assert.match(storyboard, /Previous Storyboard Image for Shot/u);
  assert.match(storyboard, /Next Storyboard Image for Shot/u);
  assert.doesNotMatch(handoff, /Previous Storyboard Image for Shot|Next Storyboard Image for Shot/u);
  assert.doesNotMatch(handoff, /generatedPositionImages|linkedPositionImages|positionImages/u);
});

test("#2807 projects current Shot production information without inventing another store", async () => {
  const handoff = await read("app/_components/preproduction/storyboard-locked-shot-handoff.tsx");

  for (const label of [
    "Story",
    "Scene / Beat",
    "Camera",
    "Performance / Blocking",
    "Lighting / Look",
    "Timing",
    "Information boundary",
    "Continuity / Handoff",
  ]) assert.ok(handoff.includes(label), `Missing locked Shot handoff field: ${label}`);

  assert.match(handoff, /projectVisualStory\(/u);
  assert.match(handoff, /project\.production\.shots/u);
  assert.match(handoff, /storyboardAnchorEvidence\(/u);
  assert.match(handoff, /"~3s Storyboard planning target"/u);
  assert.doesNotMatch(handoff, /localStorage|sessionStorage|createEmpty.*Store/u);
});

test("#2807 authors Graphic Novel text through the existing Previs approval authority", async () => {
  const [handoff, presentation, previs] = await Promise.all([
    read("app/_components/preproduction/storyboard-locked-shot-handoff.tsx"),
    read("app/_components/previs/previs-graphic-novel-presentation.ts"),
    read("app/_components/previs/previs-readiness-workspace.tsx"),
  ]);

  assert.match(handoff, /fetch\("\/api\/previs\/narration"/u);
  assert.match(handoff, /PrevisGraphicNovelTextApproval/u);
  assert.match(handoff, /graphicNovelTextApprovals/u);
  assert.match(handoff, /Draft · review before approval/u);
  assert.match(handoff, /Save &amp; Lock/u);
  assert.match(handoff, /No Bubble/u);
  assert.match(handoff, /noText/u);
  assert.match(presentation, /export function graphicNovelTextSourceKey/u);
  assert.match(presentation, /export function approvedGraphicNovelPanel/u);
  assert.match(previs, /graphicNovelTextSourceKey/u);
  assert.match(previs, /approvedGraphicNovelPanel/u);
});

test("#2807 Storyboard and Previs share the same narration staleness source-key inputs", async () => {
  const [handoff, previs] = await Promise.all([
    read("app/_components/preproduction/storyboard-locked-shot-handoff.tsx"),
    read("app/_components/previs/previs-readiness-workspace.tsx"),
  ]);

  assert.match(handoff, /shotContext: "~3-second planning target"/u);
  assert.match(previs, /shotContext: "~3-second planning target"/u);
  assert.match(handoff, /graphicNovelTextSourceKey\(panel, evidence\.passages, storyContext\)/u);
  assert.match(previs, /approval\.sourceKey === graphicNovelTextSourceKey\(panel, selectedFrameEvidence\?\.passages, storyContext\)/u);
});

test("#2807 Previs fills only missing narration and preserves current Storyboard approvals", async () => {
  const previs = await read("app/_components/previs/previs-readiness-workspace.tsx");

  assert.match(previs, /const missing = lockedGraphicNovelPanels\.filter\(\(panel\) => !currentTextApprovalFor\(panel\)\)/u);
  assert.match(previs, /Playing approved text only/u);
  assert.doesNotMatch(previs, /lockedImageContactSheet|fetch\("\/api\/previs\/narration"|graphicNovelTextApprovals: \[/u,
    "Previs must not create or silently approve missing Bubble text");
});
