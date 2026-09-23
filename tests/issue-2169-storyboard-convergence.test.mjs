import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2169 binds Storyboard anchors to #2168 source evidence without creating a new story store", async () => {
  const model = await read("app/_components/storyboard/storyboard-editorial-model.ts");

  assert.match(model, /export function storyboardAnchorEvidence/u);
  assert.match(model, /evidence\.storyMatrix\?\.blocks/u);
  assert.match(model, /responsibility: matrixBlock\?\.responsibility/u);
  assert.match(model, /structuralFinding: matrixBlock\?\.structuralFinding\.state/u);
  assert.match(model, /sourceMappings: \(matrixBlock\?\.sourceMappings/u);
  assert.match(model, /evidence\.storyMatrix\?\.sourceSections/u);
  assert.match(model, /characterEvidenceRefs: matrixBlock\?\.characterEvidenceRefs/u);
  assert.match(model, /storyboardSourceEvidenceForAnchor/u);
  assert.match(model, /passage\.blockNumber === blockNumber && passage\.miniBlockNumber === miniBlockNumber/u);
  assert.doesNotMatch(model, /createEmpty.*Storyboard|storyboardStore|sessionStorage/u);
});

test("#2169 packaged Afterglow visuals follow working-copy provenance rather than fixture project id", async () => {
  const model = await read("app/_components/storyboard/storyboard-editorial-model.ts");

  assert.match(model, /function isAfterglowReferenceProject/u);
  assert.match(model, /referenceFixture\?\.fixtureId === AFTERGLOW_V9_FOUNDATIONS_FIXTURE_ID/u);
  assert.match(model, /referenceFixture\?\.sourceId === AFTERGLOW_V9_REFERENCE_SOURCE_ID/u);
  assert.doesNotMatch(model, /project\.id !== AFTERGLOW_V9_FOUNDATIONS_FIXTURE_ID/u);
  assert.match(model, /sourceKind: "historical-storyboard" \| "replacement-concept"/u);
  assert.match(model, /blockNumber <= afterglowStoryboardCoverage\.sourceBlocks/u);
  assert.match(model, /provenanceRefs/u);
});

test("#2169 keeps accepted visual state in existing PPF artifacts and carries exact story provenance downstream", async () => {
  const [model, build] = await Promise.all([
    read("app/_components/storyboard/storyboard-editorial-model.ts"),
    read("core/contracts/build-progress.ts"),
  ]);

  assert.match(model, /createStoryboardReferenceArtifact/u);
  assert.match(model, /workflow: STORYBOARD_REFERENCE_WORKFLOW/u);
  assert.match(model, /reviewState: "draft"/u);
  assert.match(model, /storyboard-source-kind:\$\{input\.candidate\.sourceKind\}/u);
  assert.match(model, /storyboard-evidence:\$\{ref\}/u);
  assert.match(model, /parentArtifactId: current\?\.id \?\? null/u);
  assert.match(build, /readonly visualArtifacts: readonly FoundationsVisualArtifact\[\]/u);
  assert.match(build, /readonly acceptedVisualArtifactIds: readonly string\[\]/u);
  assert.doesNotMatch(model, /interface .*VisualStore|type .*VisualStore/u);
});

test("#2169 keeps real written evidence available under a collapsed source inspection", async () => {
  const [editorial, readiness, css] = await Promise.all([
    read("app/_components/storyboard/storyboard-editorial-workspace.tsx"),
    read("app/_components/storyboard/storyboard-readiness-workspace.tsx"),
    read("app/_components/storyboard/storyboard-editorial-workspace.module.css"),
  ]);

  assert.match(editorial, /<details className=\{styles\.sourceEvidence\}/u);
  assert.match(editorial, /Source inspection · same canonical address/u);
  assert.match(editorial, /SCREENPLAY EVIDENCE/u);
  assert.match(editorial, /STRUCTURE & PROVENANCE/u);
  assert.match(editorial, /sourceEvidence\.passages/u);
  assert.match(editorial, /sourceEvidence\.sourceMappings/u);
  assert.match(editorial, /sourceEvidence\.sourceSections/u);
  assert.match(editorial, /KEPT VISUAL/u);
  assert.match(editorial, /CANDIDATE \/ REFERENCE/u);
  assert.match(editorial, /No screenplay passage is mapped to this Mini-Block\. PlotPickle does not manufacture written evidence/u);
  assert.match(readiness, /anchorEvidence\.passages\.length/u);
  assert.match(readiness, /historical reference candidate/u);
  assert.match(readiness, /replacement concept candidate/u);
  assert.match(readiness, /no visual candidate/u);
  assert.match(css, /\.sourceEvidence/u);
  assert.match(css, /\.sourceColumns/u);
});

test("#2169 makes 96 anchors addresses, not a sequential four-image progression gate", async () => {
  const [map, readiness, oldRegression] = await Promise.all([
    read("modules/build/progressive-story-map.ts"),
    read("app/_components/storyboard/storyboard-readiness-workspace.tsx"),
    read("tests/issue-1745-story-map-primary-workspace.test.mjs"),
  ]);

  assert.match(map, /acceptance is descriptive evidence at a stable address/u);
  assert.match(map, /acceptedMiniBlockCount === 4/u);
  assert.match(map, /coverage evidence, not a required Storyboard quota/u);
  assert.match(map, /Visual candidates may remain zero, one or many at each anchor/u);
  assert.match(map, /available without requiring visual acceptance in an earlier Block/u);
  assert.doesNotMatch(map, /const unlocked = number === 1 \|\| completedBlockIds\.has/u);
  assert.doesNotMatch(map, /unlocks after Block/u);
  assert.match(readiness, /does not gate later Blocks or require one kept image per Mini-Block/u);
  assert.match(oldRegression, /#1745\/#2169 keeps all canonical story addresses available/u);
});

test("#2169 projects real Shot/Frame intent at an anchor even when no Scene relationship exists", async () => {
  const [projection, workspace] = await Promise.all([
    read("lib/preproduction/visual-story-projection.ts"),
    read("app/_components/storyboard/visual-story-workspace.tsx"),
  ]);

  assert.match(projection, /if \(!selectedScene\)[\s\S]*sequenceDirectorAnchorRef\(input\.blockNumber, input\.miniBlockNumber\)/u);
  assert.match(projection, /projectShots\(input\.project, anchorRef, frames, editorialShots\)/u);
  assert.match(projection, /anchors: \[anchor\]/u);
  assert.match(workspace, /data-anchor-only-projection="true"/u);
  assert.match(workspace, /No creative Shot exists at this anchor\. PlotPickle does not create one to satisfy the 24\/96 grid/u);
  assert.match(workspace, /AUDIENCE LEARNS NOW/u);
  assert.match(workspace, /AUDIENCE MUST NOT KNOW YET/u);
  assert.match(workspace, /Reveal\/withhold intent is not inferred from prose or visual references/u);
  assert.match(workspace, /Lighting<\/dt>/u);
});

test("#2169 preserves the exact Block/Mini address across Storyboard and BUILD navigation", async () => {
  const [workspace, page] = await Promise.all([
    read("app/_components/storyboard/storyboard-readiness-workspace.tsx"),
    read("app/storyboard/page.tsx"),
  ]);

  assert.match(workspace, /function preserveStoryboardAddress/u);
  assert.match(workspace, /url\.searchParams\.set\("block", String\(block\)\)/u);
  assert.match(workspace, /url\.searchParams\.set\("mini", String\(mini\)\)/u);
  assert.match(workspace, /preserveStoryboardAddress\(selectedNumber, miniNumber\)/u);
  assert.match(workspace, /onOpenBuild\(selectedNumber, selectedMiniBlockNumber\)/u);
  assert.match(page, /workspace=build&block=\$\{blockNumber\}&mini=\$\{miniBlockNumber\}/u);
});

test("#2169 keeps #2107 reveal/withhold intent on real Editorial Shots, separate from visual acceptance", async () => {
  const [editorial, shotContract, visualStory] = await Promise.all([
    read("app/_components/storyboard/storyboard-editorial-workspace.tsx"),
    read("core/contracts/storyboard/editorial-shot.ts"),
    read("app/_components/storyboard/visual-story-workspace.tsx"),
  ]);

  assert.match(editorial, /SHOW_NOW \/ WITHHOLD_NOW reveal timing belongs only to real Storyboard Editorial Shots/u);
  assert.match(editorial, /selecting a visual never invents those directives/u);
  assert.match(shotContract, /SHOT_INFORMATION_MODES = \["SHOW_NOW", "WITHHOLD_NOW"\]/u);
  assert.match(shotContract, /informationDirectives/u);
  assert.match(visualStory, /directive\.mode === "SHOW_NOW"/u);
  assert.match(visualStory, /directive\.mode === "WITHHOLD_NOW"/u);
});
