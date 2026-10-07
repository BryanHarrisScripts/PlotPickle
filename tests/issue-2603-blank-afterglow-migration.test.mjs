import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const readJson = async (path) => JSON.parse(await read(path));

test("#2603 login Blank is a real empty project shape, not an Afterglow or last-project restore", async () => {
  const [projectSource, libraryProjectSource, browser, profile, host] = await Promise.all([
    read("core/project/project.ts"),
    read("core/storage/library-project.ts"),
    read("core/storage/project-library-browser.ts"),
    read("core/storage/profile-private-browser.ts"),
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
  ]);

  for (const emptyConstructor of [
    "foundations: createEmptyFoundationPlanState()",
    "world: createEmptyWorldPlanState()",
    "build: createEmptyBuildProgressState()",
    "production: createEmptyPrevisProductionState()",
  ]) assert.ok(projectSource.includes(emptyConstructor), `missing blank constructor: ${emptyConstructor}`);

  for (const emptyConstructor of [
    "createEmptyStoryStructureV2()",
    "createEmptyProjectSourceEvidence()",
    "createEmptyBlockWritingState()",
    "createEmptyDiscoveryState()",
    "createEmptyWorldMapState()",
  ]) assert.ok(libraryProjectSource.includes(emptyConstructor), `missing Library blank constructor: ${emptyConstructor}`);

  assert.doesNotMatch(projectSource, /Afterglow|\bRen\b|\bAmy\b|Summer|Isobel/u);
  assert.doesNotMatch(libraryProjectSource, /Afterglow|\bRen\b|\bAmy\b|Summer|Isobel/u);

  assert.match(profile, /clearLibraryProjectSessionCache\(\);[\s\S]*window\.sessionStorage\.clear\(\)/u);
  assert.match(browser, /detachedProjectCache = \{ profileId: activeProfileId, project \}/u);
  assert.match(host, /setDiscoveryProject\(loadActiveLibraryProject\(\)\)/u);
  assert.match(host, /setStoryBibleProject\(loadActiveLibraryProject\(\)\)/u);
  assert.doesNotMatch(host, /Please load a story\./u);
  assert.doesNotMatch(host, /Afterglow|createAfterglow/u);
});

test("#2603 first explicit Save from Blank requests a name and promotes to a fresh durable identity", async () => {
  const [browser, mindMap, worldMap, policy] = await Promise.all([
    read("core/storage/project-library-browser.ts"),
    read("app/skin-v1/discovery-surface.tsx"),
    read("app/skin-v1/story-bible-surface.tsx"),
    readJson("config/blank-example-project-policy.json"),
  ]);

  assert.match(browser, /export function saveDetachedLibraryProjectAs/u);
  assert.match(browser, /createProfileUserProject\(\{/u);
  assert.match(browser, /id: created\.activeProject\.id/u);
  assert.match(browser, /sourceId: "first-meaningful-save"/u);
  assert.match(browser, /markSessionActiveProject\(result\.activeProject\.id\)/u);

  assert.match(mindMap, /window\.prompt\("Save as New Project", suggested\)/u);
  assert.match(mindMap, /saveDetachedLibraryProjectAs\(next, \{ title, format: "Feature" \}\)/u);
  assert.match(mindMap, /setProposalDrafts\(\(current\) => \(\{ \.\.\.current, \[storageId\]: proposal \}\)\)/u);
  assert.match(mindMap, /if \(hasActiveLibraryProject\(\)\) \{[\s\S]*writeStoryDevelopmentFieldProposal/u);

  assert.match(worldMap, /data-story-bible-read-only="true"/u);
  assert.doesNotMatch(worldMap, /saveWorldMapProject|saveDetachedLibraryProjectAs|window\.prompt\("Save as New Project"/u);

  assert.equal(policy.blankToProject.actionLabel, "Save as New Project");
  assert.equal(policy.blankToProject.createsFreshIdentity, true);
  assert.equal(policy.blankToProject.sourceId, "first-meaningful-save");
});

test("#2603 Library New creates Blank while Afterglow remains an explicit Example action", async () => {
  const [workspace, policy] = await Promise.all([
    read("modules/library/ui/library-workspace.tsx"),
    readJson("config/blank-example-project-policy.json"),
  ]);

  assert.match(workspace, /<h3>New Project<\/h3>/u);
  assert.match(workspace, />Create New Project<\/button>/u);
  assert.match(workspace, /createLibraryUserProject\(\{ title: "Untitled Story", format: "Feature" \}\)/u);
  assert.match(workspace, /window\.location\.assign\("\/\?workspace=dashboard"\)/u);

  assert.match(workspace, /async function loadPackagedExample\(item: LibraryCatalogItem, mode: "defaults" \| "restore"\)/u);
  assert.match(workspace, /if \(mode === "defaults"\)[\s\S]*createAfterglowPackagedCurrentReference/u);
  assert.match(workspace, /sourceKind: "example"/u);
  assert.match(workspace, /sourceId: AFTERGLOW_EXAMPLE_DEFAULTS_SOURCE_ID/u);
  assert.deepEqual(policy.entryStates.map((state) => state.id), ["blank", "example"]);
  assert.deepEqual(policy.notStates, ["local-changes"]);
});

test("#2603 canonical Afterglow package owns approved story truth and repository-backed resources", async () => {
  const [snapshot, manifest, projection, promotion, policy] = await Promise.all([
    readJson("data/afterglow-packaged-current/snapshot.json"),
    readJson("data/afterglow-packaged-current/manifest.json"),
    read("core/project/story-bible-projection.ts"),
    read("scripts/promote-afterglow-packaged-example.mjs"),
    readJson("config/blank-example-project-policy.json"),
  ]);

  assert.equal(snapshot.status, "promoted");
  assert.equal(manifest.status, "promoted");
  const project = snapshot.project;
  assert.equal(project.id, "reference-afterglow-packaged-current");
  assert.match(project.title, /Afterglow/u);

  const foundationValues = Object.values(project.foundations.lessons)
    .flatMap((lesson) => Object.values(lesson.answers ?? {}))
    .filter((value) => typeof value === "string" && value.trim());
  const foundationText = foundationValues.join("\n");
  assert.ok(foundationValues.length > 0);
  assert.match(foundationText, /logline|grieving AI creator|coastal journey/iu);
  assert.match(foundationText, /theme/iu);
  assert.match(foundationText, /tone/iu);
  assert.match(foundationText, /stakes|control costs|failure threatens/iu);
  assert.match(projection, /"Tone \/ mood"/u);

  const principalIds = project.sourceEvidence.characterTruth?.principalCharacterIds ?? [];
  for (const id of ["ren", "amy", "isobel"]) assert.ok(principalIds.includes(id), `missing packaged principal character ${id}`);
  assert.equal(project.structure.blocks.length, 24);
  assert.ok(project.worldMap.characterVisuals.length >= 3);
  assert.ok(project.build.foundations.visualArtifacts.length > 0);

  const serialized = JSON.stringify(project);
  assert.doesNotMatch(serialized, /\/api\/local-ai\/assets\//u);
  assert.doesNotMatch(serialized, /"data:/iu);
  assert.doesNotMatch(serialized, /"file:/iu);
  assert.match(serialized, /\/assets\/library\/examples\/afterglow\/current\//u);
  assert.ok(manifest.assets.every((asset) => asset.publicUrl.startsWith("/assets/library/examples/afterglow/current/")));

  assert.match(promotion, /Base64\/data URLs are forbidden/u);
  assert.match(promotion, /file: URLs are forbidden/u);
  assert.equal(policy.afterglowMigration.assetRoot, "/assets/library/examples/afterglow/current/");
});

test("#2603 does not manufacture missing Afterglow domains merely to make Blank and Example look complete", async () => {
  const [snapshot, policy, parity] = await Promise.all([
    readJson("data/afterglow-packaged-current/snapshot.json"),
    readJson("config/blank-example-project-policy.json"),
    readJson("config/story-learning-surface-parity.json"),
  ]);
  const project = snapshot.project;

  assert.equal(Object.keys(project.world.lessons).length, 0);
  assert.equal(project.world.brief.content, "");
  assert.equal(project.discovery.cards.length, 0);
  assert.equal(project.writing.entries.length, 0);
  assert.match(policy.afterglowMigration.unresolvedRule, /keep .* empty rather than manufacture story content/iu);

  const candidatePaths = new Set(parity.afterglowMigrationCandidates.map((item) => item.storagePath));
  for (const path of [
    "world.lessons.*.answers",
    "world.brief.content",
    "writing.entries",
    "discovery.cards",
    "production",
  ]) assert.ok(candidatePaths.has(path), `missing Phase 1 migration candidate ${path}`);
});

test("#2603/#2823 local-media resume remains bounded and separate from the packaged Example", async () => {
  const [workspace, recovery] = await Promise.all([
    read("modules/library/ui/library-workspace.tsx"),
    read("modules/library/local-resource-recovery.ts"),
  ]);

  assert.match(workspace, /Open Example with Your Changes/u);
  assert.match(workspace, /inventoryLocalResources/u);
  assert.match(workspace, /restoreLocalStoryboardResources/u);
  assert.match(workspace, /restoreLocalWorldMapPosterResources/u);
  assert.match(workspace, /restoreLocalWorldMapCharacterResources/u);
  assert.match(workspace, /Local media matching is automatic and deterministic/u);
  assert.match(workspace, /expected\.has\(resource\.assetUrl\)/u);
  assert.doesNotMatch(workspace, />Select All<\/button>|requires your explicit selection/u);
  assert.doesNotMatch(recovery, /data:image\//iu);
});
