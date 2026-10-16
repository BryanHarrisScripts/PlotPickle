import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#3019 poster creation uses selected Library screenplay and preserves project identity", async () => {
  const workspace = await read("app/skin-v1/assets-workspace.tsx");
  for (const token of [
    "sessionActiveProjectId()",
    "loadLibraryProjectSnapshot",
    "project.sourceEvidence.screenplay?.passages",
    "passage.id",
    "deriveMarketingContextV1(project)",
    "buildFoundationsMarketingPosterPrompt(context)",
    "candidate.projectId !== project.id",
    "assertCurrentProject(project.id, project.revision)",
    "billingAcknowledged",
    "verifyPosterMedia",
    "await response.arrayBuffer()",
  ]) assert.ok(workspace.includes(token), `Missing guarded poster source/identity: ${token}`);
  assert.doesNotMatch(workspace, /localStorage\.setItem|sessionStorage\.setItem|window\.location\.assign/u);
});

test("#3019 only explicitly saved and approved posters appear in Library", async () => {
  const [workspace, library] = await Promise.all([
    read("app/skin-v1/assets-workspace.tsx"),
    read("modules/library/ui/library-workspace.tsx"),
  ]);
  for (const token of [
    'type: "foundations.visual.store"',
    'type: "foundations.visual.accept"',
    "saveActiveLibraryProject(next)",
    "await persistActiveProfileProject()",
    "await flushProfilePrivateWrites()",
    "readback.build.foundations.acceptedVisualArtifactIds.includes(artifact.id)",
  ]) assert.ok(workspace.includes(token), `Missing saved/approved gate: ${token}`);
  assert.match(library, /lockedMarketingReference\(snapshot\.build\.foundations\.visualArtifacts, snapshot\.build\.foundations\.acceptedVisualArtifactIds\)/u);
  assert.match(library, /data-library-story-poster=\{item\.id\}/u);
  assert.match(library, /afterglowExamplePosterUrls/u);
  assert.doesNotMatch(workspace, /foundations\.visual\.accept[^\n]*generatePoster/u);
});

test("#3019 current ASSETS category boundaries keep deferred media honest", async () => {
  const [workspace, menu, host] = await Promise.all([
    read("app/skin-v1/assets-workspace.tsx"),
    read("app/skin-v1/dashboard-menu-registry.ts"),
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
  ]);
  assert.match(menu, /id: "assets", shortcut: "A", label: "Assets"/u);
  // The five native buttons now share one accessible, selected-state folder renderer.
  for (const folder of ["sounds", "characters", "collectibles", "posters", "world"]) {
    assert.match(workspace, new RegExp(`"${folder}"`, "u"));
  }
  assert.match(workspace, /aria-label="ASSETS folders"/u);
  assert.match(workspace, /data-selected=\{folder === id \? "true" : "false"\}/u);
  assert.match(workspace, /Collectibles authoring is planned/u);
  assert.match(workspace, /New world-view generation is a later #3019 gate/u);
  assert.match(host, /<AssetsWorkspace/u);
  assert.match(host, /setDiscoveryInitialTopic\("character"\)/u);
  assert.match(host, /setSoundOpen\(kind\)/u);
});
