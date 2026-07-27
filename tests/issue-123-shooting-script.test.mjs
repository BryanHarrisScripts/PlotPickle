import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("issue #123 extends the canonical screenplay instead of creating a duplicate Shooting Script engine", async () => {
  const [project, model, panel] = await Promise.all([
    source("lib/project.ts"),
    source("lib/production-draft.ts"),
    source("app/production-draft-panel.tsx"),
  ]);
  assert.match(project, /productionDraft: ProductionDraftState/);
  assert.match(model, /project\.screenplay\.productionDraft/);
  assert.match(panel, /Shooting Script/);
  assert.doesNotMatch(model, /shootingScriptDatabase|localStorage|sessionStorage|indexedDB/);
});

test("issue #123 explicitly converts a writer draft and preserves a recoverable baseline", async () => {
  const model = await source("lib/production-draft.ts");
  for (const contract of [
    "convertToProductionDraft",
    "createRevisionSnapshot",
    "Writer draft before production conversion",
    "writerBaselineRevisionId",
    'mode: "production"',
    'approval("converted"',
  ]) assert.ok(model.includes(contract), `Missing production conversion contract: ${contract}`);
});

test("issue #123 locks pages and preserves A/B scene and page numbering", async () => {
  const [model, project] = await Promise.all([source("lib/production-draft.ts"), source("lib/project.ts")]);
  for (const contract of [
    "lockProductionPagination",
    "pageAssignments",
    "paginationLockedAt",
    "nextLetterSuffix",
    "nextSceneNumber",
    "removedScenes",
    "omitted: true",
  ]) assert.ok(model.includes(contract), `Missing locked-numbering contract: ${contract}`);
  assert.match(project, /ProductionDraftSceneNumber/);
  assert.match(project, /ProductionDraftPageAssignment/);
});

test("issue #123 tracks revision colours dates marks changed pages and approval history", async () => {
  const [model, project] = await Promise.all([source("lib/production-draft.ts"), source("lib/project.ts")]);
  for (const contract of [
    "startProductionRevision",
    "closeProductionRevision",
    "changedElementIds",
    "changedPageLabels",
    "authorizedBy",
    "revisionColour",
    "approvalHistory",
    "direct-edit",
  ]) assert.ok(model.includes(contract) || project.includes(contract), `Missing revision contract: ${contract}`);
});

test("issue #123 exports full and changed production pages with production print rules", async () => {
  const [model, panel] = await Promise.all([source("lib/production-draft.ts"), source("app/production-draft-panel.tsx")]);
  for (const contract of [
    "productionDraftHtml",
    "changedOnly",
    "@page{size:letter",
    "page-break-after:always",
    "PRODUCTION DRAFT",
    "Export production draft",
    "Export changed pages",
    "Print / PDF production draft",
  ]) assert.ok(model.includes(contract) || panel.includes(contract), `Missing production output contract: ${contract}`);
});

test("issue #123 integrates production numbers and revision state into Writer and Production Reports", async () => {
  const [writer, reports, reportUi] = await Promise.all([
    source("app/script-workspace.tsx"),
    source("lib/production-reports.ts"),
    source("app/production-reports-workspace.tsx"),
  ]);
  assert.match(writer, /reconcileProductionDraft/);
  assert.match(writer, /productionSceneLabel/);
  assert.match(writer, /productionPageLabel/);
  assert.match(reports, /productionDraftReport/);
  assert.match(reports, /productionNumber/);
  assert.match(reportUi, /Locked production pages/);
  assert.match(reportUi, /Changed pages/);
});

test("issue #123 keeps production annotations local, targeted and credential-free", async () => {
  const [model, project] = await Promise.all([source("lib/production-draft.ts"), source("lib/project.ts")]);
  assert.match(model, /addProductionAnnotation/);
  assert.match(project, /targetType: "screenplay-element" \| "scene" \| "page"/);
  assert.match(project, /department: string/);
  assert.match(project, /author: string/);
  assert.doesNotMatch(model, /apiKey|accessToken|refreshToken|clientSecret|recordingData/);
});

test("issue #123 production state is normalized and registered in both canonical schemas", async () => {
  const [project, currentSchema, frozenSchema, packageText] = await Promise.all([
    source("lib/project.ts"),
    source("schema/plotpickle-project.schema.json"),
    source("schema/plotpickle-project-v1.7.schema.json"),
    source("package.json"),
  ]);
  assert.match(project, /createBlankProductionDraftState/);
  assert.match(project, /productionCandidate/);
  for (const schema of [currentSchema, frozenSchema]) {
    const parsed = JSON.parse(schema);
    assert.ok(parsed.$defs.productionDraft);
    assert.equal(parsed.$defs.screenplay.properties.productionDraft.$ref, "#/$defs/productionDraft");
  }
  const packageJson = JSON.parse(packageText);
  assert.match(packageJson.scripts.test, /issue-123-shooting-script\.test\.mjs/);
  assert.equal(packageJson.scripts["test:shooting-script"], "node --test tests/issue-123-shooting-script.test.mjs");
});
