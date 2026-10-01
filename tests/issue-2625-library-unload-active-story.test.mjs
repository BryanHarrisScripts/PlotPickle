import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2625 Load marks the active Afterglow or Human story and exposes one Unload action", async () => {
  const source = await read("modules/library/ui/library-workspace.tsx");

  assert.match(source, /Currently loaded/u);
  assert.match(source, /data-library-currently-loaded=\{active \? "true" : "false"\}/u);
  assert.match(source, /className=\{styles\.unloadButton\}/u);
  assert.match(source, /disabled=\{unloading\}/u);

  const loadStart = source.indexOf('if (destination === "load")');
  const loadEnd = source.indexOf('if (destination === "examples"', loadStart);
  const load = source.slice(loadStart, loadEnd);
  assert.match(load, /activeProjectSummary\?\.sourceKind === "example"/u);
  assert.match(load, /activeProjectSummary\.sourceId === AFTERGLOW_EXAMPLE_DEFAULTS_SOURCE_ID/u);
  assert.match(load, /activeProjectSummary\.sourceId === AFTERGLOW_EXAMPLE_SOURCE_ID/u);
  assert.match(load, /active=\{afterglowCurrentlyLoaded\}/u);
  assert.match(load, /active=\{activeProjectSummary\?\.id === entry\.item\.id\}/u);
  assert.match(load, /onUnload=\{\(\) => void unloadCurrentStory\(\)\}/u);
});

test("#2625 unload saves before detach, persists no active story, and returns to Blank without a handoff", async () => {
  const source = await read("modules/library/ui/library-workspace.tsx");
  const start = source.indexOf("async function unloadCurrentStory()");
  const end = source.indexOf("async function createNewStory()", start);
  const unload = source.slice(start, end);

  const firstPersist = unload.indexOf("await persistActiveProfileProject()");
  const firstFlush = unload.indexOf("await flushProfilePrivateWrites()", firstPersist);
  const detach = unload.indexOf("unloadActiveLibraryProject()", firstFlush);
  const secondPersist = unload.indexOf("await persistActiveProfileProject()", detach);
  const secondFlush = unload.indexOf("await flushProfilePrivateWrites()", secondPersist);
  const navigate = unload.indexOf('window.location.assign("/?workspace=dashboard")', secondFlush);

  assert.ok(firstPersist >= 0);
  assert.ok(firstPersist < firstFlush);
  assert.ok(firstFlush < detach);
  assert.ok(detach < secondPersist);
  assert.ok(secondPersist < secondFlush);
  assert.ok(secondFlush < navigate);
  assert.doesNotMatch(unload, /stageSessionActiveProjectHandoff/u);
  assert.doesNotMatch(unload, /logout|lock|switch-profile|archive|delete/i);
});

test("#2625 detach is reversible if the durable null-active write fails", async () => {
  const source = await read("modules/library/ui/library-workspace.tsx");
  const start = source.indexOf("async function unloadCurrentStory()");
  const end = source.indexOf("async function createNewStory()", start);
  const unload = source.slice(start, end);

  assert.match(unload, /let detached = false/u);
  assert.match(unload, /detached = true/u);
  assert.match(unload, /if \(detached\)[\s\S]*switchActiveLibraryProject\(projectId\)/u);
  assert.match(unload, /could not restore the prior active-story selection/u);
});

test("#2625 Project Library unload clears only current-session selection and keeps the project snapshot", async () => {
  const browser = await read("core/storage/project-library-browser.ts");
  const start = browser.indexOf("export function unloadActiveLibraryProject()");
  const end = browser.indexOf("function coreInput()", start);
  const unload = browser.slice(start, end);

  assert.match(unload, /const projectId = sessionActiveProjectId\(\)/u);
  assert.match(unload, /clearSessionActiveProject\(\)/u);
  assert.match(unload, /announceChange\(\)/u);
  assert.match(unload, /return projectId/u);
  assert.doesNotMatch(unload, /removeItem\(projectLibraryProjectKey|archive|delete|saveProfileActiveProject/u);
});

test("#2625 profile persistence records activeProjectId null once the session marker is cleared", async () => {
  const profile = await read("core/storage/profile-private-browser.ts");
  assert.match(profile, /const activeProjectId = sessionActiveProjectId\(\)/u);
  assert.match(profile, /const persistedActiveProjectId = activeProjectId[\s\S]*: null/u);
  assert.match(profile, /privateMutation\("sync-library-index"[\s\S]*activeProjectId: persistedActiveProjectId/u);
});

test("#2625 keeps explicit Open Example handoff separate from unload", async () => {
  const source = await read("modules/library/ui/library-workspace.tsx");
  const openStart = source.indexOf("async function openActiveProject()");
  const openEnd = source.indexOf("function ExampleGatewayCard", openStart);
  const open = source.slice(openStart, openEnd);
  const unloadStart = source.indexOf("async function unloadCurrentStory()");
  const unloadEnd = source.indexOf("async function createNewStory()", unloadStart);
  const unload = source.slice(unloadStart, unloadEnd);

  assert.match(open, /stageSessionActiveProjectHandoff\(\)/u);
  assert.doesNotMatch(unload, /stageSessionActiveProjectHandoff/u);
});

test("#2625 Currently loaded badge and Unload action are compact, explicit Load-card controls", async () => {
  const css = await read("modules/library/ui/library-workspace.module.css");
  assert.match(css, /\.loadCardStatusRow \{/u);
  assert.match(css, /\.currentlyLoadedBadge \{/u);
  assert.match(css, /text-transform: uppercase/u);
  assert.match(css, /\.unloadButton \{/u);
  assert.match(css, /\.savedStoryOpenButton \{/u);
});
