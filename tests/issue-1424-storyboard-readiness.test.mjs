import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const workspacePath = "app/_components/storyboard/storyboard-readiness-workspace.tsx";

test("#1424 re-adopts Storyboard through the canonical PPF readiness contract", async () => {
  const [route, workspace, readiness] = await Promise.all([
    read("app/storyboard/page.tsx"),
    read(workspacePath),
    read("modules/build/visual-readiness.ts"),
  ]);

  assert.match(route, /loadFoundationProject/);
  assert.match(route, /PPFProject/);
  assert.match(route, /_components\/storyboard\/storyboard-readiness-workspace/);
  assert.doesNotMatch(route, /plotpickle\.project\.v1|PlotPickleProject|localStorage/);

  assert.match(workspace, /deriveVisualReadiness/);
  assert.match(workspace, /readiness\.targets/);
  assert.match(workspace, /target\.storyboardAllowed/);
  assert.match(workspace, /missingPrerequisites/);
  assert.match(workspace, /A tab is always inspectable; only earned targets become authorable/);
  assert.match(readiness, /readonly provenance: readonly VisualReadinessProvenance\[\]/);
  assert.match(readiness, /provenance: block\.observedPassageCount/);
});

test("#1424 preserves reusable Storyboard identity and editorial behavior instead of restoring legacy authority", async () => {
  const [workspace, editorial, legacyBoard, audit, phaseBoundary] = await Promise.all([
    read(workspacePath),
    read("app/_components/storyboard/storyboard-editorial-workspace.tsx"),
    read("app/visual-storyboard.tsx"),
    read("docs/architecture/visual-pipeline-reuse-audit-1423.md"),
    read("docs/architecture/storyboard-readoption-1424.md"),
  ]);

  assert.match(legacyBoard, /storyboardIdentityInputs/);
  assert.match(legacyBoard, /VisualFrame/);
  assert.match(legacyBoard, /VisualMediaVersion/);
  assert.match(legacyBoard, /approvedCharacterReferenceImages/);
  assert.match(audit, /`app\/visual-storyboard\.tsx` \| Adapt in Phase 8/);
  assert.match(workspace, /StoryboardEditorialWorkspace/);
  assert.match(workspace, /storyboardReferenceCandidates/);
  assert.match(editorial, />Keep</);
  assert.match(editorial, />Change \/ Try</);
  assert.match(editorial, />Compare</);
  assert.match(editorial, /same Mini-Block anchor/);
  assert.match(phaseBoundary, /profile-owned PPF -> #1423 visual readiness -> Storyboard target availability/);
  assert.doesNotMatch(workspace, /PlotPickleProject|storyboardExploration|plotpickle\.project\.v1/);
});

test("#1424 tab inspection remains non-canonical while explicit Human Keep owns visual approval", async () => {
  const [route, workspace, editorial, model] = await Promise.all([
    read("app/storyboard/page.tsx"),
    read(workspacePath),
    read("app/_components/storyboard/storyboard-editorial-workspace.tsx"),
    read("app/_components/storyboard/storyboard-editorial-model.ts"),
  ]);
  const inspectionSurface = `${route}\n${workspace}`;

  assert.doesNotMatch(inspectionSurface, /saveFoundationProject|writeFile|database|sqlite/);
  assert.doesNotMatch(inspectionSurface, /\/api\/local-ai\/generate/);
  assert.match(workspace, /The final image count is intentionally flexible/);
  assert.match(editorial, /saveFoundationProject\(next\)/);
  assert.match(model, /Human Keep decision/);
  assert.doesNotMatch(editorial, /\/api\/local-ai\/generate/);
});
