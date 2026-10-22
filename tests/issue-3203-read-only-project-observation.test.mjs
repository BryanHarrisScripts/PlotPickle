import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
async function runtime(relativePath) {
  const result = await build({
    entryPoints: [path.join(root, relativePath)],
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node26",
    write: false,
    logLevel: "silent",
  });
  return import("data:text/javascript;base64," + Buffer.from(result.outputFiles[0].text).toString("base64"));
}

const fixtureProfile = "profile_fixture";
const fixtureId = "read_only_test_project";
const scriptText = "PRIVATE_SOURCE_NEVER_EXPOSE_3203";

async function setup() {
  const [api, library] = await Promise.all([
    runtime("modules/intent/model/observe-project-status.ts"),
    runtime("core/storage/library-project.ts"),
  ]);
  const empty = library.normalizeLibraryProject({
    id: fixtureId, title: "SECRET_TITLE_DO_NOT_RENDER",
    revision: 7,
  });
  const project = {
    ...empty,
    id: fixtureId,
    revision: 7,
    sourceEvidence: {
      ...empty.sourceEvidence,
      screenplay: {
        sourceFileName: "private.fountain",
        sourceFormat: "fountain",
        importedAt: "2026-10-21T00:00:00.000Z",
        analysisStatus: "suggested",
        totalPassageCount: 1,
        storedPassageCount: 1,
        passagesTruncated: false,
        passages: [{
          id: "passage-1", type: "action", text: scriptText,
          blockNumber: 1, miniBlockNumber: 1, sceneNumber: 1, sceneId: null,
        }],
      },
    },
  };
  const request = {
    capability: "project-status.observe",
    profileId: fixtureProfile,
    projectId: fixtureId,
    projectRevision: 7,
    providerPolicy: "LOCAL_READ_ONLY",
  };
  const context = { activeProfileId: fixtureProfile, activeProject: project };
  return { api, project, request, context };
}

test("#3203 observes the actual canonical 24/96 projection and source-backed readiness without mutation", async () => {
  const { api, project, request, context } = await setup();
  const before = JSON.stringify(project);
  const result = api.observeProjectStatus(request, context);
  assert.equal(result.state, "OBSERVED");
  assert.equal(result.project.id, fixtureId);
  assert.equal(result.project.revision, 7);
  assert.equal(result.project.blockCount, 24);
  assert.equal(result.project.miniBlockCount, 96);
  assert.equal(result.project.sourcePassageCount, 1);
  assert.ok(result.attention.length > 0);
  assert.equal(result.nextDecision?.actionAuthority, "HUMAN");
  assert.equal(result.independentVerification, false);
  assert.equal(result.canonMutated, false);
  assert.equal(result.modelCalled, false);
  assert.equal(result.paidGenerationPermitted, false);
  assert.deepEqual(JSON.stringify(project), before);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_SOURCE_NEVER_EXPOSE_3203|SECRET_TITLE_DO_NOT_RENDER|private\.fountain|sk-test|authorization/i);
  assert.doesNotMatch(JSON.stringify(result), /"state":"VERIFIED"|"state":"PASS"/);
  assert.ok(Object.isFrozen(result) && Object.isFrozen(result.attention));
});

test("#3203 refuses mistaken identity, stale PPF revision, non-local route, absent source and invalid coordinate", async () => {
  const { api, request, context, project } = await setup();
  const cases = [
    [{ ...request, profileId: "profile_wrong" }, context, "PROFILE_NOT_BOUND"],
    [request, { ...context, activeProfileId: null }, "PROFILE_NOT_BOUND"],
    [{ ...request, projectId: "other_story" }, context, "PROJECT_NOT_BOUND"],
    [request, { ...context, activeProject: null }, "PROJECT_NOT_BOUND"],
    [{ ...request, projectRevision: 6 }, context, "STALE_PROJECT_REVISION"],
    [{ ...request, providerPolicy: "CLOUD" }, context, "POLICY_NOT_ADMITTED"],
    [{ ...request, providerPolicy: "HYBRID" }, context, "POLICY_NOT_ADMITTED"],
    [{ ...request, blockNumber: 25 }, context, "INVALID_COORDINATE"],
    [request, { ...context, activeProject: { ...project, sourceEvidence: { ...project.sourceEvidence, screenplay: null } } }, "SOURCE_EVIDENCE_MISSING"],
    [request, { ...context, activeProject: { ...project, structure: { ...project.structure, blocks: project.structure.blocks.slice(0, 23) } } }, "CANONICAL_STRUCTURE_UNPROVEN"],
  ];
  for (const [r, c, code] of cases) {
    const result = api.observeProjectStatus(r, c);
    assert.equal(result.state, "BLOCKED", code);
    assert.equal(result.code, code);
    assert.equal(result.project, null);
    assert.equal(result.nextDecision, null);
    assert.equal(result.independentVerification, false);
  }
});

test("#3203 selected coordinate preserves identity and source-linked block address", async () => {
  const { api, request, context } = await setup();
  const result = api.observeProjectStatus({ ...request, blockNumber: 1 }, context);
  assert.equal(result.state, "OBSERVED");
  assert.ok(result.attention.every(item => item.blockNumber === 1));
  assert.ok(result.attention.every(item => item.blockId && item.source === "canonical-outline-readiness"));
  assert.equal(result.nextDecision?.blockNumber, 1);
});

test("#3203 ten Hollywood stages report retained PPF evidence without film certification", async () => {
  const [{ observeHollywoodProductionReadiness }, { project, request, context }] = await Promise.all([
    runtime("modules/intent/model/hollywood-production-readiness.ts"),
    setup(),
  ]);
  const before = JSON.stringify(project);
  const result = observeHollywoodProductionReadiness(request, context);
  assert.equal(result.state, "OBSERVED");
  assert.equal(result.project.id, fixtureId);
  assert.equal(result.project.revision, 7);
  assert.equal(result.stages.length, 10);
  assert.deepEqual(result.stages.map(stage => stage.id), [
    "concept-script", "planning-budget", "casting-locations", "technical-prep",
    "principal-photography", "picture-editing", "vfx-compositing",
    "sound-music", "final-mastering", "marketing-distribution",
  ]);
  assert.equal(result.stages[0].state, "OBSERVED");
  assert.equal(result.stages[0].evidence[0].count, 1);
  assert.equal(result.stages[4].state, "INSUFFICIENT_EVIDENCE");
  assert.equal(result.stages[4].editorLink, null);
  assert.ok(result.stages.every(stage => stage.filmStageVerified === false));
  assert.equal(result.filmReadyVerified, false);
  assert.equal(result.independentVerification, false);
  assert.equal(result.canonMutated, false);
  assert.equal(result.modelCalled, false);
  assert.equal(result.paidGenerationPermitted, false);
  assert.deepEqual(JSON.stringify(project), before);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_SOURCE_NEVER_EXPOSE_3203|SECRET_TITLE_DO_NOT_RENDER|private\\.fountain|sk-test/i);
});

test("#3203 ten-stage projection rejects stale/cross-profile/cross-story and missing source without fallback", async () => {
  const [{ observeHollywoodProductionReadiness }, { project, request, context }] = await Promise.all([
    runtime("modules/intent/model/hollywood-production-readiness.ts"), setup(),
  ]);
  const scenarios = [
    [{ ...request, profileId: "other_profile" }, context, "PROFILE_NOT_BOUND"],
    [request, { ...context, activeProfileId: null }, "PROFILE_NOT_BOUND"],
    [{ ...request, projectId: "other_story" }, context, "PROJECT_NOT_BOUND"],
    [request, { ...context, activeProject: { ...project, id: "other_story" } }, "PROJECT_NOT_BOUND"],
    [{ ...request, projectRevision: 5 }, context, "STALE_PROJECT_REVISION"],
    [{ ...request, providerPolicy: "HYBRID" }, context, "POLICY_NOT_ADMITTED"],
    [request, { ...context, activeProject: { ...project, sourceEvidence: { ...project.sourceEvidence, screenplay: null } } }, "SOURCE_EVIDENCE_MISSING"],
  ];
  for (const [input, trusted, code] of scenarios) {
    const result = observeHollywoodProductionReadiness(input, trusted);
    assert.equal(result.state, "BLOCKED", code);
    assert.equal(result.code, code);
    assert.equal(result.project, null);
    assert.deepEqual(result.stages, []);
    assert.equal(result.nextDecision, null);
    assert.equal(result.filmReadyVerified, false);
  }
});

test("#3203 real Reports Production GUI invokes the same headless read-only capability from authenticated current session", async () => {
  const { readFile } = await import("node:fs/promises");
  const read = p => readFile(new URL("../" + p, import.meta.url), "utf8");
  const [page, workspace, model] = await Promise.all([
    read("app/reports/page.tsx"), read("app/reports/library-ppf-reports-workspace.tsx"),
    read("modules/intent/model/hollywood-production-readiness.ts"),
  ]);
  assert.match(page, /sessionActiveProjectId\\(\\)/u);
  assert.match(page, /profilePrivateBrowserReadyFor\\(profileId\\)/u);
  assert.match(page, /PROJECT_LIBRARY_ACTIVE_PROFILE_KEY/u);
  assert.match(workspace, /observeHollywoodProductionReadiness\\(\\{/u);
  assert.match(workspace, /projectId: selectedId/u);
  assert.match(workspace, /projectRevision: project\\.revision/u);
  assert.match(workspace, /providerPolicy: "LOCAL_READ_ONLY"/u);
  assert.match(workspace, /data-hollywood-stage-count/u);
  assert.match(workspace, /stage\\.filmStageVerified|stage\\.state/u);
  assert.doesNotMatch(workspace, /saveActiveLibraryProject\\(|Save & Lock.*onClick|authenticatedComputeFetch\\(/u);
  assert.doesNotMatch(model, /fetch\\(|localStorage|sessionStorage|writeFile|spawn\\(|paidGenerationPermitted: true/u);
});
