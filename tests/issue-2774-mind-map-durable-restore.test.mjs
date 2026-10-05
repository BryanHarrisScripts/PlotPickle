import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2774 Mind Map does not report a project save before profile-private durability is confirmed", async () => {
  const surface = await read("app/skin-v1/discovery-surface.tsx");

  assert.match(surface, /flushProfilePrivateWrites/);
  assert.match(surface, /persistActiveProfileProject/);
  assert.match(surface, /async function persistCanonicalProject\(next: LibraryPPFProject\)/);

  const helperStart = surface.indexOf("async function persistCanonicalProject");
  const helperEnd = surface.indexOf("async function createCharacter", helperStart);
  const helper = surface.slice(helperStart, helperEnd);
  const librarySave = helper.indexOf("saveActiveLibraryProject(next)");
  const profilePersist = helper.indexOf("await persistActiveProfileProject()");
  const privateFlush = helper.indexOf("await flushProfilePrivateWrites()");

  assert.ok(librarySave >= 0, "Mind Map must write the Library snapshot");
  assert.ok(profilePersist > librarySave, "profile persistence must follow the Library snapshot write");
  assert.ok(privateFlush > profilePersist, "the private-write queue must flush before success is returned");
  assert.match(helper, /catch \(error\)[\s\S]*could not be confirmed in profile storage/);
});

test("#2774 canonical values, notes and accepted Agent Suggestions all await the durable save boundary", async () => {
  const surface = await read("app/skin-v1/discovery-surface.tsx");

  assert.match(surface, /async function saveCanonicalField/);
  assert.match(surface, /const saved = await persistCanonicalProject\(next\)/);
  assert.match(surface, /async function saveSelectedFieldNotes/);
  assert.match(surface, /async function useCanonicalFieldProposal/);
  assert.match(surface, /acceptStoryDevelopmentFieldProposal\(\{ project: withProposal, field, act: selectedAct \}\)/);
  assert.match(surface, /Agent Suggestion is saved durably and ready for Human review/);
  assert.match(surface, /disabled=\{savingMindMap\}/);
  assert.match(surface, /"Saving…"/);
});

test("#2774 Theme, Structure and visual-planning fields share project-owned storyDevelopment persistence", async () => {
  const [model, project, browser] = await Promise.all([
    read("modules/learn/model/story-development-fields.ts"),
    read("core/storage/library-project.ts"),
    read("core/storage/project-library-browser.ts"),
  ]);

  assert.match(model, /if \(topicId === "theme"\)[\s\S]*"story-development"/);
  assert.match(model, /if \(topicId === "structure"\)[\s\S]*"story-development"/);
  assert.match(model, /if \(topicId === "previs"\)[\s\S]*"story-development"/);
  assert.match(project, /readonly storyDevelopment: StoryDevelopmentState/);
  assert.match(project, /readonly mindMapNotes: MindMapNotesState/);
  assert.match(browser, /normalizeStoryDevelopmentState\(incoming\.storyDevelopment\)/);
  assert.match(browser, /normalizeMindMapNotesState\(incoming\.mindMapNotes\)/);
});

test("#2774 Open Example with Your Changes makes the complete saved Afterglow project active before media recovery", async () => {
  const workspace = await read("modules/library/ui/library-workspace.tsx");

  const restoreStart = workspace.indexOf("const openedProject = loadLibraryProjectSnapshot(afterglowLocalState.id)");
  const recoveryStart = workspace.indexOf("setRecovery({ project: restoredProject", restoreStart);
  assert.ok(restoreStart >= 0 && recoveryStart > restoreStart, "restore path must use the saved local Afterglow snapshot");

  const restore = workspace.slice(restoreStart, recoveryStart + 200);
  const selectProject = restore.indexOf("switchActiveLibraryProject(openedProject.id)");
  const markSession = restore.indexOf("markCurrentSessionLibraryProject(restoredProject.id)");
  const inventory = restore.indexOf("inventoryLocalResources(restoredProject, [])");

  assert.ok(selectProject >= 0, "the full saved project must become the Library authority");
  assert.ok(markSession > selectProject, "the saved project must become the current-session story");
  assert.ok(inventory > markSession, "media inventory must be scanned only after the full project is selected");
  assert.match(restore, /storyDevelopment, Mind Map/);
  assert.match(restore, /never rebuilt[\s\S]*local-resource inventory/);
});

test("#2774 dismissing optional media recovery continues with the already-loaded full project", async () => {
  const workspace = await read("modules/library/ui/library-workspace.tsx");
  const start = workspace.indexOf("function cancelRecovery()");
  const end = workspace.indexOf("function selectAllLocalResources", start);
  const cancel = workspace.slice(start, end);

  assert.match(cancel, /const loadedProject = recovery\?\.project \?\? null/);
  assert.match(cancel, /void openActiveProject\(\)/);
  assert.doesNotMatch(cancel, /restoreLocalStoryboardResources|restoreLocalWorldMapPosterResources|restoreLocalWorldMapCharacterResources/);
});

test("#2774 restart hydration preserves complete Library snapshots while fresh startup still requires explicit selection", async () => {
  const [profile, browser] = await Promise.all([
    read("core/storage/profile-private-browser.ts"),
    read("core/storage/project-library-browser.ts"),
  ]);

  assert.match(profile, /hydrateProfileProjectLibrary\(\{ activeProjectId, projects \}\)/);
  assert.match(profile, /window\.sessionStorage\.clear\(\)/);
  assert.match(browser, /export function latestAfterglowExampleProject\(\)[\s\S]*listAfterglowExampleProjects\(\)\[0\]/);
  assert.match(browser, /sort\(\(left, right\) => right\.updatedAt\.localeCompare\(left\.updatedAt\)\)/);
});
