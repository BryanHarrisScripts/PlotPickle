import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const workspacePath = "app/_components/storyboard/storyboard-readiness-workspace.tsx";

test("#1424 re-adopts Storyboard through the canonical PPF readiness contract", async () => {
  const route = await read("app/storyboard/page.tsx");
  const workspace = await read(workspacePath);

  assert.match(route, /loadFoundationProject/);
  assert.match(route, /PPFProject/);
  assert.match(route, /_components\/storyboard\/storyboard-readiness-workspace/);
  assert.doesNotMatch(route, /plotpickle\.project\.v1|PlotPickleProject|localStorage/);

  assert.match(workspace, /deriveVisualReadiness/);
  assert.match(workspace, /target\.storyboardAllowed/);
  assert.match(workspace, /missingPrerequisites/);
  assert.match(workspace, /target\.provenance/);
  assert.match(workspace, /Locked or missing targets stay truthful/);
});

test("#1424 preserves the old Storyboard implementation for bounded adaptation instead of rebuilding it", async () => {
  const workspace = await read(workspacePath);
  const legacyBoard = await read("app/visual-storyboard.tsx");
  const audit = await read("docs/architecture/visual-pipeline-reuse-audit-1423.md");
  const phaseBoundary = await read("docs/architecture/storyboard-readoption-1424.md");

  assert.match(legacyBoard, /storyboardIdentityInputs/);
  assert.match(legacyBoard, /VisualFrame/);
  assert.match(legacyBoard, /VisualMediaVersion/);
  assert.match(legacyBoard, /approvedCharacterReferenceImages/);
  assert.match(audit, /`app\/visual-storyboard\.tsx` \| Adapt in Phase 8/);
  assert.match(workspace, /VisualFrame.*VisualMediaVersion/);
  assert.match(workspace, /Keep\/Change\/Compare/);
  assert.match(phaseBoundary, /profile-owned PPF -> #1423 visual readiness -> Storyboard target availability/);
});

test("#1424 readiness gate remains non-authoritative and generation-free", async () => {
  const route = await read("app/storyboard/page.tsx");
  const workspace = await read(workspacePath);
  const combined = `${route}\n${workspace}`;

  assert.doesNotMatch(combined, /saveFoundationProject|writeFile|database|sqlite/);
  assert.doesNotMatch(combined, /\/api\/local-ai\/generate/);
  assert.match(workspace, /writes no visual canon and triggers no media generation/);
});
