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
  assert.match(handoff, /imagePrompt: artifact\.prompt\?\.trim\(\)/u);
  assert.match(handoff, /Scene context for this Mini-Block/u);
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
  assert.match(handoff, /Draft · not saved or locked/u);
  assert.match(handoff, /Save & Lock/u);
  assert.doesNotMatch(handoff, />\{savingPosition === position \? "Saving…" : "No Bubble"\}</u);
  assert.match(handoff, /approvalState\.current\?\.noText[\s\S]*?No Bubble · Saved & Locked/u,
    "existing no-text approvals remain visible without offering a new No Bubble choice");
  assert.match(handoff, /Prepare Narration Brief/u);
  assert.match(handoff, /Create Narration/u);
  assert.match(handoff, /Shot brief · review only/u);
  assert.match(handoff, /reviewedShotBrief/u);
  assert.match(handoff, /noText/u);
  assert.match(presentation, /export function graphicNovelTextSourceKey/u);
  assert.match(presentation, /export function approvedGraphicNovelPanel/u);
  assert.match(previs, /graphicNovelTextSourceKey/u);
  assert.match(previs, /approvedGraphicNovelPanel/u);
});

test("#2807 embeds each locked Shot handoff in one vertical Storyboard sequence", async () => {
  const [storyboard, handoff, styles] = await Promise.all([
    read("app/_components/storyboard/storyboard-readiness-workspace.tsx"),
    read("app/_components/preproduction/storyboard-locked-shot-handoff.tsx"),
    read("app/_components/storyboard/storyboard-readiness-workspace.module.css"),
  ]);
  assert.match(storyboard, /data-storyboard-position=\{position\}[\s\S]*?embedded[\s\S]*?position=\{position\}/u);
  assert.equal((storyboard.match(/<StoryboardLockedShotHandoff\b/gu) ?? []).length, 1,
    "the handoff appears once in the selected Shot loop instead of again below all 25 cards");
  assert.match(handoff, /data-embedded=\{embedded \? "true" : "false"\}/u);
  assert.match(styles, /\.positionList\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/u);
  assert.match(styles, /\.lockedShotHandoff\[data-embedded="true"\]\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/u,
    "the handoff and shot-brief review sit on a full-width row after image and prompt controls");
  assert.match(handoff, /className=\{`\$\{styles\.handoffDraft\} \$\{styles\.handoffBriefReview\}`\}[\s\S]*?Reviewed Shot brief/u);
  assert.match(styles, /\.handoffBriefReview\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/u);
  assert.match(styles, /\.handoffBriefFields textarea\s*\{[^}]*width:\s*100%[^}]*min-height:\s*7rem/u);
});

test("#2926 keeps reviewed shot briefs readable below image prompt controls without a new No Bubble choice", async () => {
  const [storyboard, handoff, styles] = await Promise.all([
    read("app/_components/storyboard/storyboard-readiness-workspace.tsx"),
    read("app/_components/preproduction/storyboard-locked-shot-handoff.tsx"),
    read("app/_components/storyboard/storyboard-readiness-workspace.module.css"),
  ]);
  assert.ok(storyboard.indexOf("framePromptButton") < storyboard.indexOf("<StoryboardLockedShotHandoff"),
    "review information follows the image and prompt controls in the same Shot card");
  assert.match(styles, /\.lockedShotHandoff\[data-embedded="true"\]\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/u);
  assert.match(styles, /\.handoffBriefReview\s*\{[^}]*grid-column:\s*1\s*\/\s*-1/u);
  assert.match(styles, /\.handoffBriefFields textarea\s*\{[^}]*width:\s*100%[^}]*min-height:\s*7rem/u);
  assert.doesNotMatch(handoff, />\{savingPosition === position \? "Saving…" : "No Bubble"\}</u,
    "the Storyboard does not offer a new no-text choice");
  assert.match(handoff, /approvalState\.current\?\.noText[\s\S]*?No Bubble · Saved & Locked/u,
    "existing no-text approvals remain displayable");
});

test("#2807 Storyboard and Previs share the same narration staleness source-key inputs", async () => {
  const [handoff, previs] = await Promise.all([
    read("app/_components/preproduction/storyboard-locked-shot-handoff.tsx"),
    read("app/_components/previs/previs-readiness-workspace.tsx"),
  ]);

  assert.match(handoff, /shotContext: "~3-second planning target"/u);
  assert.match(previs, /shotContext: "~3-second planning target"/u);
  assert.match(handoff, /graphicNovelTextSourceSnapshot\(project, anchorRef, panel\.position, artifact(?:, [^)]+)?\)/u);
  assert.match(previs, /graphicNovelTextSourceSnapshot\(project, selectedAddressAnchor\?\.id \?\? "", panel\.position, artifact(?:, [^)]+)?\)/u);
});

test("#2807 Previs fills only missing narration and preserves current Storyboard approvals", async () => {
  const previs = await read("app/_components/previs/previs-readiness-workspace.tsx");

  assert.match(previs, /const missing = lockedGraphicNovelPanels\.filter\(\(panel\) => !currentTextApprovalFor\(panel\)\)/u);
  assert.match(previs, /Playing approved text only/u);
  assert.doesNotMatch(previs, /lockedImageContactSheet|fetch\("\/api\/previs\/narration"|graphicNovelTextApprovals: \[/u,
    "Previs must not create or silently approve missing Bubble text");
});

test("#2927 Visual Story readiness is the always-rendered 25 Shot sequence, not conditional locked-shot narration", async () => {
  const [workspace, registryText, canonicalText, declarationsText, manifestText, windowsProof] = await Promise.all([
    read("app/_components/storyboard/storyboard-readiness-workspace.tsx"),
    read("lib/verification/webmcp-surface-capture-registry.mjs"),
    read("config/skin-v1-surface-registry.json"),
    read("config/skin-v1-surface-declarations/standard-surfaces.json"),
    read("tests/visual-baselines/skin-v1/manifest.json"),
    read("scripts/developer-diagnostics/product-proof/2821-save-session.mjs"),
  ]);
  const selector = "[data-storyboard-scene-beat-detail='inline']";
  const registrySection = registryText.slice(registryText.indexOf('"visual-story": Object.freeze({'), registryText.indexOf("profile: Object.freeze", registryText.indexOf('"visual-story": Object.freeze({')));
  const canonical = JSON.parse(canonicalText).surfaces.find((surface) => surface.id === "visual-story");
  const declaration = JSON.parse(declarationsText).surfaces["visual-story"];
  const manifest = JSON.parse(manifestText).surfaces["visual-story"];
  assert.match(workspace, /data-storyboard-scene-beat-detail="inline"/u);
  assert.match(workspace, /Array\.from\(\{ length: 25 \}/u);
  assert.match(workspace, /lockedImageHandoffReady \? <StoryboardLockedShotHandoff/u);
  assert.match(workspace, /const lockedImageHandoffReady = accepted && Boolean\(selectedArtifact && storyboardArtifactSavedLocally\(selectedArtifact\)\)/u,
    "locked Shot handoff stays mounted during unrelated profile-private narration saves");
  assert.match(workspace, /const savedLocally = Boolean\(selectedArtifact && storyboardArtifactSavedLocally\(selectedArtifact\) && privateSaveState.state === "saved"\)/u,
    "initial image save still requires the private vault acknowledgement");
  assert.ok(registrySection.includes('rootSelector: "' + selector + '"'));
  assert.ok(registrySection.includes('readySelector: "' + selector + '"'));
  assert.equal(canonical.runtimeSelector, selector);
  assert.equal(canonical.runtimeReadySelector, selector);
  assert.equal(declaration.runtimeSelector, selector);
  assert.equal(manifest.selector, selector);
  assert.match(windowsProof, /Prepare Narration Brief/u);
  assert.match(windowsProof, /Create Narration/u);
  assert.match(windowsProof, /payload\.shotAnalysis, reviewedAnalysis/u);
});
