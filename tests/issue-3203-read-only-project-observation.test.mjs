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
