import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2581 launch session is detached from the last durable Library active project", async () => {
  const browser = await read("core/storage/project-library-browser.ts");
  const profile = await read("core/storage/profile-private-browser.ts");

  assert.match(browser, /PROJECT_LIBRARY_SESSION_PROJECT_KEY_PREFIX/u);
  assert.match(browser, /export function sessionActiveProjectId\(\)/u);
  assert.match(browser, /let detachedProjectCache/u);
  assert.match(browser, /export function hasActiveLibraryProject\(\)[\s\S]*sessionActiveProjectId\(\)/u);
  assert.match(browser, /export function loadActiveLibraryProject\(\)[\s\S]*const currentProjectId = sessionActiveProjectId\(\)/u);
  assert.match(browser, /detachedProjectCache = \{ profileId: activeProfileId, project \}/u);

  assert.match(profile, /const activeProjectId = sessionActiveProjectId\(\)/u);
  assert.match(profile, /listPersistableLibraryProjects\(\)/u);
  assert.match(profile, /persistedActiveProjectId[\s\S]*activeProjectId[\s\S]*: null/u);
});

test("#2581 empty launch placeholders do not become durable Library stories", async () => {
  const browser = await read("core/storage/project-library-browser.ts");

  assert.match(browser, /function isImplicitStartupPlaceholder/u);
  assert.match(browser, /summary\.title === "Untitled Story"/u);
  assert.match(browser, /summary\.progress === 0/u);
  assert.match(browser, /summary\.createdAt === summary\.updatedAt/u);
  assert.match(browser, /export function listPersistableLibraryProjects\(\)[\s\S]*!isImplicitStartupPlaceholder/u);
  assert.match(browser, /firstMeaningfulSave[\s\S]*sourceId: "first-meaningful-save"/u);
});

test("#2581 explicit Library choices establish the current-session project", async () => {
  const browser = await read("core/storage/project-library-browser.ts");
  const workspace = await read("modules/library/ui/library-workspace.tsx");

  assert.match(browser, /export function switchActiveLibraryProject[\s\S]*markSessionActiveProject\(result\.activeProject\.id\)/u);
  assert.match(browser, /export function createLibraryUserProject[\s\S]*markSessionActiveProject\(result\.activeProject\.id\)/u);
  assert.match(browser, /export function createLibraryWorkingCopy[\s\S]*markSessionActiveProject\(result\.activeProject\.id\)/u);
  assert.match(browser, /export function importLibraryProject[\s\S]*markSessionActiveProject\(result\.activeProject\.id\)/u);

  assert.match(workspace, /Open Example/u);
  assert.match(workspace, /Open Example with Your Changes/u);
  assert.match(workspace, /mode === "defaults"/u);
  assert.match(workspace, /AFTERGLOW_EXAMPLE_DEFAULTS_SOURCE_ID/u);
  assert.match(workspace, /async function continueSavedStoryResume[\s\S]*switchActiveLibraryProject\(recovery\.project\.id\)/u);
});

test("#2581/#2823 packaged Afterglow and saved Afterglow remain separate explicit open modes", async () => {
  const workspace = await read("modules/library/ui/library-workspace.tsx");

  assert.match(workspace, /async function loadPackagedExample\(item: LibraryCatalogItem, mode: "defaults" \| "restore"\)/u);
  assert.match(workspace, /if \(mode === "defaults"\)[\s\S]*createLibraryWorkingCopy\(\{[\s\S]*sourceKind: "example"[\s\S]*sourceId: AFTERGLOW_EXAMPLE_DEFAULTS_SOURCE_ID/u);
  assert.match(workspace, /if \(!afterglowLocalState\)[\s\S]*No local Afterglow changes are available yet/u);
  assert.match(workspace, /loadLibraryProjectSnapshot\(afterglowLocalState\.id\)/u);
  assert.match(workspace, /Resume Saved Afterglow/u);
  assert.match(workspace, /Current PlotPickle controls and methods will be used/u);
});

test("#2581/#2823 saved local media resume is automatic, bounded and separate from recovery", async () => {
  const workspace = await read("modules/library/ui/library-workspace.tsx");

  assert.match(workspace, /inventoryLocalResources\(openedProject, \[\]\)/u);
  assert.match(workspace, /function expectedLocalAssetUrls/u);
  assert.match(workspace, /function resumeInventoryResources/u);
  assert.match(workspace, /expected\.has\(resource\.assetUrl\)/u);
  assert.match(workspace, /restoreLocalStoryboardResources/u);
  assert.match(workspace, /restoreLocalWorldMapPosterResources/u);
  assert.match(workspace, /restoreLocalWorldMapCharacterResources/u);
  assert.match(workspace, /Local media matching is automatic and deterministic/u);
  assert.match(workspace, /Settings → Data Recovery/u);
  assert.doesNotMatch(workspace, /Restore Local Changes|>Select All<\/button>|selectedRecoveryOrigins/u);
});

test("#2581 restart isolation keeps saved work while requiring a fresh session selection", async () => {
  const browser = await read("core/storage/project-library-browser.ts");
  const profile = await read("core/storage/profile-private-browser.ts");

  assert.match(browser, /export function clearSessionActiveProject\(\)/u);
  assert.match(browser, /window\.sessionStorage\.removeItem\(sessionProjectKey\(\)\)/u);
  assert.match(profile, /clearLibraryProjectSessionCache\(\);[\s\S]*window\.sessionStorage\.clear\(\)/u);
  assert.match(profile, /hydrateProfileProjectLibrary\(\{ activeProjectId, projects \}\)/u);
  assert.match(profile, /persistActiveProfileProject[\s\S]*activeProjectId: persistedActiveProjectId/u);
});


test("#2581 Library Load uses a text-first resume-state summary for saved stories", async () => {
  const workspace = await read("modules/library/ui/library-workspace.tsx");
  const styles = await read("modules/library/ui/library-workspace.module.css");

  assert.match(workspace, /Resume your story/u);
  assert.match(workspace, /Last working area/u);
  assert.match(workspace, /Tracked progress/u);
  assert.match(workspace, /Nothing loads into the workspace until you choose it/u);
  assert.match(workspace, /role="progressbar"/u);
  assert.doesNotMatch(workspace, /function SavedStoryLoadCard[\s\S]*item\.thumbnail/u);

  assert.match(styles, /\.savedStoryResumeHeader/u);
  assert.match(styles, /\.savedStoryResumeSummary/u);
  assert.match(styles, /\.savedStoryProgressTrack/u);
});
