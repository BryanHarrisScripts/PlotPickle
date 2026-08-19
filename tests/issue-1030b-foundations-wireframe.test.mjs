import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1030B plans no more than 25 meaningful Foundations-only frames without padding", async () => {
  const planner = await read("modules/build/wireframe/foundations-wireframe.ts");
  assert.match(planner, /MAX_FOUNDATIONS_WIREFRAME_FRAMES = 25/);
  assert.match(planner, /if \(!decisions\.length\) return \[\]/);
  assert.match(planner, /decisions\.slice\(0, MAX_FOUNDATIONS_WIREFRAME_FRAMES - 1\)/);
  assert.match(planner, /return plans\.slice\(0, MAX_FOUNDATIONS_WIREFRAME_FRAMES\)/);
  assert.match(planner, /isUsableFoundationAnswer\(value\)/);
  assert.doesNotMatch(planner, /while \(plans\.length|pad|placeholder frame/i);
  assert.doesNotMatch(planner, /project\.world|project\.character|project\.theme|project\.structure/);
});

test("#1030B stores frame provenance, frontier, workflow, review state and parent lineage", async () => {
  const [contract, workspace] = await Promise.all([
    read("core/contracts/build-progress.ts"),
    read("modules/build/ui/foundations-build-workspace.tsx"),
  ]);
  for (const token of ["frameNumber", "narrativeIntention", "curriculumFrontier", "sourceDecisionKeys", "workflow", "reviewState", "parentArtifactId"]) {
    assert.match(contract, new RegExp(token));
  }
  assert.match(workspace, /curriculumFrontier: FOUNDATIONS_WIREFRAME_FRONTIER/);
  assert.match(workspace, /sourceDecisionKeys: frame\.sourceDecisionKeys/);
  assert.match(workspace, /workflow: FOUNDATIONS_WIREFRAME_WORKFLOW/);
  assert.match(workspace, /reviewState: "draft"/);
  assert.match(workspace, /parentArtifactId: parent\?\.id \?\? null/);
});

test("#1030B keeps generation behind the configured provider boundary and makes only one request per frame", async () => {
  const workspace = await read("modules/build/ui/foundations-build-workspace.tsx");
  assert.match(workspace, /fetch\("\/api\/local-ai\/generate\/image"/);
  assert.match(workspace, /for \(const frame of plans\)/);
  assert.match(workspace, /requestCount: 1/);
  assert.match(workspace, /quality: "low"/);
  assert.match(workspace, /cloudRoute && !billingAcknowledged/);
  assert.doesNotMatch(workspace, /127\.0\.0\.1:8188|\/api\/prompt|ComfyUI\/prompt/);
});

test("#1030B rejection preserves history instead of deleting frame metadata", async () => {
  const reducer = await read("core/project/apply-command.ts");
  assert.match(reducer, /case "foundations\.visual\.discard"/);
  assert.match(reducer, /visualArtifacts: project\.build\.foundations\.visualArtifacts\.map/);
  assert.match(reducer, /reviewState: "rejected" as const/);
  const discardBlock = reducer.slice(reducer.indexOf('case "foundations.visual.discard"'), reducer.indexOf('case "foundations.visual.accept"'));
  assert.doesNotMatch(discardBlock, /visualArtifacts:[\s\S]*\.filter\(/);
  assert.match(discardBlock, /acceptedVisualArtifactIds:[\s\S]*\.filter\(/);
});

test("#1030B UI identifies the artifact as a rough Foundations-only living sketchbook", async () => {
  const workspace = await read("modules/build/ui/foundations-build-workspace.tsx");
  assert.match(workspace, /Visual Narrative Wireframe · Foundations only/);
  assert.match(workspace, /Review the living sketchbook/);
  assert.match(workspace, /PlotPickle never pads the sequence to a fixed count/);
  assert.match(workspace, /generation alone does not complete BUILD/);
  assert.match(workspace, /Regenerate frame/);
  assert.match(workspace, /Reject/);
  assert.match(workspace, /provenance stays in history instead of being deleted/);
});
