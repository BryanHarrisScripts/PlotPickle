import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workspace = await readFile(new URL("../app/_components/storyboard/storyboard-readiness-workspace.tsx", import.meta.url), "utf8");

test("#3004 imported screenplay can ground a saved draft while approval stays separate", () => {
  assert.match(workspace, /const draftCreationAllowed = !qaOnlyAccess \|\| Boolean\(activeAnchorEvidence\?\.passages\.length\)/u);
  assert.match(workspace, /if \(!draftCreationAllowed\)[\s\S]*?saving a Storyboard draft/u);
  assert.match(workspace, /disabled=\{!selectedArtifact \|\| !draftCreationAllowed \|\| frameBusy \|\| frameSaving\}/u);
  assert.match(workspace, /disabled=\{!selectedArtifact \|\| qaOnlyAccess \|\| frameBusy \|\| frameSaving \|\| \(!accepted && !savedLocally\)\}/u);
  assert.match(workspace, /if \(qaOnlyAccess\) \{ setFrameNotice\("This QA preview cannot change story approval\."\); return; \}/u);
  assert.match(workspace, /workflow: "storyboard-frame-webp-v2", reviewState: "draft"/u);
  assert.match(workspace, /sourceDecisionKeys: \[[\s\S]*?"ppf-revision:" \+ latest\.revision/u);
});
