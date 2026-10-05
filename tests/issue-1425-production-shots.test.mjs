import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const contractPath = "core/contracts/previs/index.ts";
const projectPath = "core/project/project.ts";
const commandPath = "core/contracts/story-command.ts";
const reducerPath = "core/project/apply-command.ts";
const modelPath = "app/_components/previs/previs-projection-model.ts";
const workspacePath = "app/_components/previs/previs-readiness-workspace.tsx";

test("#1425 keeps legacy Production Shot data in the canonical PPF without exposing it as normal Previs authoring", async () => {
  const [contract, project, command, reducer, workspace, route] = await Promise.all([
    read(contractPath),
    read(projectPath),
    read(commandPath),
    read(reducerPath),
    read(workspacePath),
    read("app/previs/page.tsx"),
  ]);

  assert.match(contract, /interface ProductionShotIntent/);
  assert.match(contract, /anchorRef: string/);
  assert.match(contract, /storyboardArtifactId: string/);
  assert.match(contract, /storyboardDependencyKey: string/);
  assert.match(contract, /durationSeconds: number \| null/);
  assert.doesNotMatch(contract, /screenplay|characterIds|locationIds|storyBeat|dialogue/);

  assert.match(project, /production: PrevisProductionState/);
  assert.match(project, /createEmptyPrevisProductionState/);
  assert.match(project, /normalizePrevisProductionState\(source\.production\)/);
  assert.match(command, /"previs\.shot\.store"/);
  assert.match(command, /"previs\.shot\.remove"/);
  assert.match(reducer, /case "previs\.shot\.store"/);
  assert.match(reducer, /case "previs\.shot\.remove"/);

  assert.doesNotMatch(workspace, /applyStoryCommand|previs\.shot\.store|Add creative shot|Save creative shot/u);
  assert.match(workspace, /saveFoundationProject/);
  assert.match(workspace, /Storyboard owns the 25 planned Shots and their locked Storyboard Images/u);
  assert.match(route, /onProjectChange=\{setProject\}/);
  assert.doesNotMatch(`${contract}\n${workspace}`, /plotpickle\.project\.v1|PlotPickleProject|localStorage/);
});

test("#1425 preserves legacy zero-one-many Production Shot compatibility below the read-only Previs surface", async () => {
  const [contract, model, workspace] = await Promise.all([
    read(contractPath),
    read(modelPath),
    read(workspacePath),
  ]);

  assert.match(contract, /Zero\/one\/many creative shots may share an anchor/);
  assert.match(model, /project\.production\.shots\s*\.filter\(\(shot\) => shot\.anchorRef === anchorId\)/);
  assert.match(model, /nextOrder = anchor\.shots\.reduce/);
  assert.match(model, /durationSeconds: null/);

  assert.match(workspace, /25 planned Shots/u);
  assert.match(workspace, /Previs reads and presents those approved choices/u);
  assert.doesNotMatch(workspace, /Creative shots<\/dt>|Previs timing<\/dt>|Add creative shot|Optional until Human-authored|Save creative shot/u);
  assert.doesNotMatch(`${model}\n${workspace}`, /defaultFrameSeconds|targetMinutes|estimatedSeconds/);
});

test("#1425 retains dependency-staleness logic without making Previs a second Shot editor", async () => {
  const [model, workspace] = await Promise.all([
    read(modelPath),
    read(workspacePath),
  ]);

  assert.match(model, /shot\.storyboardArtifactId !== kept\?\.id/);
  assert.match(model, /shot\.storyboardDependencyKey !== dependencyKey/);
  assert.match(model, /staleShotIds/);
  assert.match(model, /shotNeedsReview/);

  assert.doesNotMatch(workspace, /data-stale=\{anchor\.staleShotIds|This shot needs review because its approved Storyboard dependency changed|storyboardArtifactId: selectedAnchor|storyboardDependencyKey: selectedAnchor/u);
  assert.match(workspace, /Open owning Storyboard Mini-Block/u);
  assert.match(workspace, /If a Storyboard Image is wrong or missing, correct and lock it in Storyboard/u);
});

test("#1425 keeps production intent fields for compatibility while normal Previs stays presentation-only", async () => {
  const [contract, workspace] = await Promise.all([
    read(contractPath),
    read(workspacePath),
  ]);

  for (const field of ["shotSize", "angle", "movement", "lens", "visualIntent", "durationSeconds", "transitionIn", "transitionOut"]) {
    assert.match(contract, new RegExp(`${field}:`));
  }

  assert.match(workspace, /Previs presents the visual story already approved in Storyboard/u);
  assert.match(workspace, /Previs does not create a second Shot or image-authoring layer/u);
  assert.doesNotMatch(workspace, /Shot size<input|Blocking intent|Performance energy|Pacing \/ rhythm intent|Rough motion evidence refs/u);
  assert.doesNotMatch(workspace, /\/api\/.*generate|Render MP4|provider.*generate/i);
});
