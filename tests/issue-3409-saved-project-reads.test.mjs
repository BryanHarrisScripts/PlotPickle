import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { build } from "esbuild";
import { createInMemoryAuthStateStore, createPlotPickleAuthService } from "../core/auth/plotpickle-auth-core.mjs";
import { createProfilePrivateStorageService } from "../core/storage/profile-private/profile-private-storage-core.mjs";

const bundled = await build({ entryPoints: ["modules/intent/model/read-saved-project.ts"],
  bundle: true, platform: "node", format: "esm", write: false, logLevel: "silent" });
const { readSavedProject } = await import("data:text/javascript;base64," + Buffer.from(bundled.outputFiles[0].text).toString("base64"));

test("#3409 real encrypted storage permits explicit reads without an active project and isolates profiles", async t => {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-story-read-"));
  const auth = await createPlotPickleAuthService({ nodeId: "node_story_read_fixture",
    accessMode: "desktop-loopback", stateStore: createInMemoryAuthStateStore() });
  const first = await auth.createFirstProfile({ displayName: "Synthetic owner", password: "Synthetic private read fixture passphrase" });
  const second = await auth.createProfile({ displayName: "Synthetic other", password: "Another synthetic private fixture passphrase" }, first.authContext);
  const other = await auth.authenticate({ profileId: second.profile.profileId, password: "Another synthetic private fixture passphrase" });
  const storage = createProfilePrivateStorageService({ root, authService: auth });
  t.after(async () => { storage.close(); auth.close(); await rm(root, { recursive: true, force: true }); });
  const project = { id: "story_read_fixture", title: "Synthetic screenplay", revision: 7,
    sourceEvidence: { screenplay: { sourceFileName: "synthetic.fountain", sourceFormat: "fountain",
      importedAt: "2026-11-06T00:00:00.000Z", analysisStatus: "suggested",
      totalPassageCount: 4, storedPassageCount: 3, passagesTruncated: true,
      passages: [1,2,3].map(n => ({ id: `source-${n}`, type: "action", text: `SYNTHETIC PASSAGE ${n}`,
        blockNumber: 1, miniBlockNumber: 1, sceneNumber: 1, sceneId: null })) } } };
  await storage.saveProject(first.authContext, { project, activate: false });
  const before = await storage.loadProject(first.authContext, project.id);
  assert.equal(await storage.loadActiveProject(first.authContext), null);
  const query = suffix => new URLSearchParams(`storyRead=${suffix}`);
  const selected = suffix => query(`${suffix}&projectId=${project.id}&revision=7`);
  const read = q => readSavedProject(q, first.authContext, storage);

  const listing = await read(query("projects"));
  assert.equal(listing.status, 200);
  assert.equal(listing.body.projects[0].id, project.id);
  assert.equal(listing.body.projects[0].revision, 7);
  assert.equal((await readSavedProject(query("projects"), other.authContext, storage)).body.total, 0);
  assert.equal((await readSavedProject(selected("source"), other.authContext, storage)).status, 404);

  const pageOne = await read(selected("source&limit=2"));
  const pageTwo = await read(selected("source&offset=2&limit=2"));
  assert.deepEqual([...pageOne.body.passages, ...pageTwo.body.passages].map(p => p.id), ["source-1", "source-2", "source-3"]);
  assert.equal(pageOne.body.nextOffset, 2);
  assert.equal(pageTwo.body.nextOffset, null);
  assert.equal(pageOne.body.source.retainedSourceTruncated, true);
  assert.equal(pageOne.body.source.importedPassageCount, 4);
  assert.equal(pageOne.body.scope, "SCREENPLAY_PASSAGES_NOT_SHOT_MAPPING");
  assert.equal(pageOne.body.mediaBytesVerified, false);
  const structure = await read(selected("structure"));
  assert.equal(structure.body.blocks.length, 24);
  assert.equal(structure.body.blocks.reduce((n,b) => n + b.miniBlocks.length, 0), 96);
  const shot = await read(selected("shot&act=1&sequence=1&block=1&mini=1&shot=1"));
  assert.equal(shot.body.observation.shotStatus, "EMPTY");
  assert.equal(shot.body.observation.sourceEvidence.shotSpecificMappingVerified, false);
  assert.equal((await read(selected("status"))).body.observation.state, "OBSERVED");

  for (const suffix of ["source&limit=0", "source&limit=51", "source&offset=-1", "source&offset=1.5",
    "source&limit=1&limit=2", "source&profileId=other", "structure&limit=2",
    "shot&act=4&sequence=1&block=1&mini=1&shot=1", "shot&act=1&sequence=1&block=1&mini=1&shot=26"]) {
    assert.equal((await read(selected(suffix))).body.state, "BLOCKED", suffix);
  }
  assert.equal((await read(query(`source&projectId=${project.id}&revision=6`))).status, 409);
  assert.equal((await read(query("source&projectId=../other&revision=7"))).status, 400);
  for (const corrupt of [{ id: project.id }, { id: "different_project", revision: 7 }]) {
    const badStorage = { listProjects: storage.listProjects, loadProject: async () => corrupt };
    const bad = await readSavedProject(selected("source"), first.authContext, badStorage);
    assert.equal(bad.status, 409);
    assert.equal(bad.body.code, "SAVED_PROJECT_IDENTITY_UNVERIFIABLE");
    assert.equal(bad.body.passages, undefined);
  }
  assert.deepEqual(await storage.loadProject(first.authContext, project.id), before);
  assert.equal(await storage.loadActiveProject(first.authContext), null);
  auth.lock(first.authContext);
  await assert.rejects(read(selected("source")));
});

test("#3409 HTTP authorization precedes story reads and errors retain private response headers", async () => {
  const source = await readFile("app/api/auth/profile-private/route.ts", "utf8");
  const start = source.indexOf("export async function GET");
  assert.ok(source.indexOf("await authorized(request)", start) < source.indexOf("await readSavedProject", start));
  assert.match(source, /readSavedProject\(query, authContext, runtimeState\.privateStorage\)/);
  assert.match(source, /"Cache-Control": "no-store"/);
  assert.match(source, /"Referrer-Policy": "no-referrer"/);
  assert.match(source, /return errorResponse\(error\)/);
});
