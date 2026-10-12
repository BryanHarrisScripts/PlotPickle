import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (p) => readFile(new URL("../" + p, import.meta.url), "utf8");

test("#2928 renders context alongside every planned Shot and keeps a single image control rail", async () => {
  const [storyboard, styles] = await Promise.all([
    read("app/_components/storyboard/storyboard-readiness-workspace.tsx"),
    read("app/_components/storyboard/storyboard-readiness-workspace.module.css"),
  ]);
  assert.match(storyboard, /Array\.from\(\{ length: 25 \}/u);
  assert.match(storyboard, /data-storyboard-shot-context=\{position\}/u);
  assert.match(storyboard, /className=\{styles\.positionContextColumn\}/u);
  for (const label of ["Storyboard Image Prompt", "Story", "Scene / Beat", "Camera", "Performance / Blocking", "Lighting / Look", "Timing", "Information boundary", "Continuity / Handoff"]) {
    assert.ok(storyboard.includes(label), "Missing always-visible context: " + label);
  }
  assert.match(storyboard, /Original Storyboard Image prompt unavailable for this image\./u);
  assert.match(storyboard, /No Storyboard Image is selected/u);
  assert.match(storyboard, /Authored Mini-Block Beat context \(not assigned to this Shot\)/u);
  assert.match(storyboard, /data-storyboard-narration-prerequisite=\{position\}/u);
  assert.match(storyboard, /!lockedImageHandoffReady \? <>[\s\S]*?<button type="button" disabled/u);
  assert.match(styles, /\.positionRow\s*\{[^}]*grid-template-columns:\s*minmax\(250px, \.82fr\) minmax\(0, 2fr\)/u);
  assert.match(styles, /@media \(max-width: 760px\)\s*\{\s*\.positionRow, \.positionRowLocked\s*\{\s*grid-template-columns:\s*minmax\(0, 1fr\)/u);
});

test("#2928 puts reviewed narration actions under image without moving approval authority", async () => {
  const [storyboard, handoff, styles, proof] = await Promise.all([
    read("app/_components/storyboard/storyboard-readiness-workspace.tsx"),
    read("app/_components/preproduction/storyboard-locked-shot-handoff.tsx"),
    read("app/_components/storyboard/storyboard-readiness-workspace.module.css"),
    read("scripts/developer-diagnostics/product-proof/2821-save-session.mjs"),
  ]);
  assert.match(storyboard, /actionHostId=\{\`storyboard-workflow-actions-/u);
  assert.match(handoff, /createPortal\(/u);
  assert.match(handoff, /setActionHost\(actionHostId \? document\.getElementById\(actionHostId\) : null\)/u);
  assert.match(handoff, /prepareShotBrief\(panel, shotFacts\)/u);
  assert.match(handoff, /generateNarration\(panel, brief\.facts, brief\)/u);
  assert.match(handoff, /Save & Lock/u);
  assert.match(handoff, /reviewedShotBrief/u);
  assert.doesNotMatch(handoff, /<strong>Graphic Novel bubble \/ caption<\/strong>/u);
  assert.match(styles, /\.lockedShotHandoff\[data-embedded="true"\] \.handoffFacts \{ display: none; \}/u);
  assert.match(proof, /shotControls\.getByRole\("button", \{ name: "Prepare Narration Brief"/u);
  assert.match(proof, /shotControls\.getByRole\("button", \{ name: "Create Narration"/u);
});
