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

test("#1425 persists Production Shots in the canonical PPF command path", async () => {
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
  assert.match(workspace, /applyStoryCommand/);
  assert.match(workspace, /saveFoundationProject/);
  assert.match(route, /onProjectChange=\{setProject\}/);
  assert.doesNotMatch(`${contract}\n${workspace}`, /plotpickle\.project\.v1|PlotPickleProject|localStorage/);
});

test("#1425 allows zero, one or many creative shots beneath one stable Mini-Block anchor", async () => {
  const [contract, model, workspace] = await Promise.all([
    read(contractPath),
    read(modelPath),
    read(workspacePath),
  ]);

  assert.match(contract, /Zero\/one\/many creative shots may share an anchor/);
  assert.match(model, /project\.production\.shots\s*\.filter\(\(shot\) => shot\.anchorRef === anchorId\)/);
  assert.match(model, /nextOrder = anchor\.shots\.reduce/);
  assert.match(model, /durationSeconds: null/);
  assert.match(workspace, /Creative shots<\/dt><dd>\{anchor\.shots\.length\}/);
  assert.match(workspace, /Add creative shot/);
  assert.match(workspace, /Mini-Block total must reach/);
  assert.match(workspace, /Author the creative timing until this Mini-Block totals/);
  assert.doesNotMatch(`${model}\n${workspace}`, /defaultFrameSeconds|targetMinutes|estimatedSeconds/);
});

test("#1425 marks only shots whose Storyboard dependency changed as needing review", async () => {
  const [model, workspace] = await Promise.all([
    read(modelPath),
    read(workspacePath),
  ]);

  assert.match(model, /shot\.storyboardArtifactId !== kept\?\.id/);
  assert.match(model, /shot\.storyboardDependencyKey !== dependencyKey/);
  assert.match(model, /staleShotIds/);
  assert.match(model, /shotNeedsReview/);
  assert.match(workspace, /data-stale=\{anchor\.staleShotIds\.includes\(shot\.id\)/);
  assert.match(workspace, /This shot needs review because its approved Storyboard dependency changed/);
  assert.match(workspace, /Saving below is an explicit Human confirmation/);
  assert.match(workspace, /storyboardArtifactId: selectedAnchor\.storyboardArtifactId/);
  assert.match(workspace, /storyboardDependencyKey: selectedAnchor\.storyboardDependencyKey/);
});

test("#1425 creative Previs shots add execution timing without becoming a second story model", async () => {
  const [contract, workspace] = await Promise.all([
    read(contractPath),
    read(workspacePath),
  ]);

  for (const field of ["shotSize", "angle", "movement", "lens", "visualIntent", "durationSeconds", "transitionIn", "transitionOut"]) {
    assert.match(contract, new RegExp(`${field}:`));
  }
  assert.match(workspace, /Story changes belong upstream/);
  assert.match(workspace, /Story canon remains upstream/);
  assert.match(workspace, /clip grid is production plumbing, not a second storytelling structure/);
  assert.doesNotMatch(workspace, /\/api\/.*generate|Render MP4|provider.*generate/i);
});
