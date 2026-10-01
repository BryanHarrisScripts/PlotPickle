import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2657 every primary Dashboard destination has an explicit continuity mode", async () => {
  const registry = await read("app/skin-v1/dashboard-menu-registry.ts");
  const ids = [...registry.matchAll(/\{ id: "([^"]+)", shortcut:/gu)].map((match) => match[1]);

  assert.ok(ids.length >= 25, "Dashboard primary navigation inventory unexpectedly shrank.");
  assert.equal(new Set(ids).size, ids.length, "Dashboard destination IDs must remain unique.");
  assert.match(registry, /export type MatrixPrimaryNavigationMode = "in-shell" \| "terminal" \| "unavailable"/u);
  assert.match(registry, /MATRIX_TERMINAL_DASHBOARD_ITEM_IDS = new Set\(\["logout", "shutdown"\]\)/u);
  assert.match(registry, /if \(MATRIX_TERMINAL_DASHBOARD_ITEM_IDS\.has\(id\)\) return "terminal"/u);
  assert.match(registry, /if \(!CONNECTED_DASHBOARD_ITEM_IDS\.has\(id\) \|\| DASHBOARD_UNAVAILABLE_ITEM_IDS\.has\(id\)\) return "unavailable"/u);
  assert.match(registry, /return "in-shell"/u);
  assert.match(registry, /DASHBOARD_MENU\.map\(\(item\) => \[item\.id, matrixPrimaryNavigationMode\(item\.id\)\]\)/u);
});

test("#2657 canonical Matrix primary host has no document-navigation fallback for available Dashboard surfaces", async () => {
  const [host, client] = await Promise.all([
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
    read("app/skin-v1/skin-v1-client.tsx"),
  ]);

  assert.doesNotMatch(host, /canonicalRoutes/u);
  assert.doesNotMatch(host, /window\.location\.assign/u);
  assert.match(host, /DASHBOARD_UNAVAILABLE_ITEM_IDS\.has\(item\.id\)/u);
  assert.match(client, /if \(item\.id === "community"\) openSurface\("COMMUNITY"\)/u);
  assert.match(client, /if \(item\.id === "profile"\)[\s\S]*setUserProfileOpen\(true\)/u);
  assert.doesNotMatch(client, /window\.location\.assign/u);
});

test("#2657 Library project mutations return to Matrix Dashboard in-shell and reserve handoff for legacy document navigation", async () => {
  const [library, avery] = await Promise.all([
    read("modules/library/ui/library-workspace.tsx"),
    read("modules/library/ui/avery-session-history/index.tsx"),
  ]);

  assert.match(library, /function returnToMatrixDashboardFromLibrary\(\)/u);
  assert.match(library, /window\.location\.pathname !== "\/skin-v1"/u);
  assert.match(library, /window\.dispatchEvent\(new CustomEvent\("plotpickle:return-dashboard"/u);
  assert.match(library, /if \(returnToMatrixDashboardFromLibrary\(\)\) return;[\s\S]*stageSessionActiveProjectHandoff\(\);[\s\S]*window\.location\.assign\("\/\?workspace=dashboard"\)/u);
  assert.match(library, /if \(!returnToMatrixDashboardFromLibrary\(\)\) window\.location\.assign\("\/\?workspace=dashboard"\)/u);
  assert.match(library, /if \(!returnToMatrixDashboardFromLibrary\(\)\) \{[\s\S]*stageSessionActiveProjectHandoff\(\);[\s\S]*window\.location\.assign/u);

  assert.match(avery, /window\.location\.pathname === "\/skin-v1"[\s\S]*plotpickle:return-dashboard[\s\S]*else \{[\s\S]*stageSessionActiveProjectHandoff/u);
  assert.doesNotMatch(library, /hydrateProfilePrivateBrowser/u);
  assert.doesNotMatch(avery, /hydrateProfilePrivateBrowser/u);
});

test("#2657 World Map and Mind Map open contextual Learn through the Matrix owner without unloading the story", async () => {
  const [host, worldMap, mindMap, panel] = await Promise.all([
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
    read("app/skin-v1/story-bible-surface.tsx"),
    read("app/skin-v1/discovery-surface.tsx"),
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
  ]);

  assert.match(host, /function openContextualLearn/u);
  assert.match(host, /const projectId = loadActiveLibraryProject\(\)\.id/u);
  assert.match(host, /sourceSurface: "world-map" \| "mind-map"/u);
  assert.match(host, /setStoryBibleOpen\(false\)/u);
  assert.match(host, /setDiscoveryOpen\(false\)/u);
  assert.match(host, /setLearnRequest\(\{/u);
  assert.match(host, /onOpenLearn=\{\(topic, lessonId, act\) => openContextualLearn\(topic, lessonId, act, "world-map"\)\}/u);
  assert.match(host, /onOpenLearn=\{\(topic, lessonId, act\) => openContextualLearn\(topic, lessonId, act, "mind-map"\)\}/u);
  assert.doesNotMatch(host, /unloadActiveLibraryProject|switchActiveLibraryProject|hydrateProfilePrivateBrowser|window\.location\.assign/u);

  assert.match(worldMap, /onOpenLearn\(field\.topicId, field\.lessonId, act\)/u);
  assert.match(worldMap, /onOpenLearn\(activeTopic, null, selectedAct\)/u);
  assert.doesNotMatch(worldMap, /learnLessonHref|learnTopicHref|window\.location\.assign|<a href=/u);

  assert.match(mindMap, /onOpenLearn\(selectedField\.topicId, selectedField\.lessonId, selectedAct\)/u);
  assert.doesNotMatch(mindMap, /learnLessonHref|window\.location\.assign/u);

  assert.match(panel, /learnRequest/u);
  assert.match(panel, /setLearnTarget\(\{ topicId: learnRequest\.topicId \?\? null, lessonId: learnRequest\.lessonId \?\? null \}\)/u);
  assert.match(panel, /initialTopicId=\{learnTarget\.topicId \?\? null\}/u);
  assert.match(panel, /initialLessonId=\{learnTarget\.lessonId \?\? null\}/u);
});

test("#2657 contextual Learn lands on the requested topic or exact lesson without rehydrating profile state", async () => {
  const [journey, explore, profile] = await Promise.all([
    read("app/skin-v1/learn-journey-preview.tsx"),
    read("app/skin-v1/learn-explore.tsx"),
    read("core/storage/profile-private-browser.ts"),
  ]);

  assert.match(journey, /initialTopicId=\{initialTopicId\}/u);
  assert.match(journey, /initialLessonId=\{initialLessonId\}/u);
  assert.match(explore, /entry\.lesson\.id === initialLessonId/u);
  assert.match(explore, /entry\.canonicalLessonId === initialLessonId/u);
  assert.match(explore, /entry\.presentationId === initialLessonId/u);
  assert.match(explore, /setTopicFilter\(target\.topic\.id\)/u);
  assert.match(explore, /setOpenEntry\(target\)/u);
  assert.match(explore, /onLessonOpen\(target\.lesson\.id\)/u);

  assert.match(profile, /consumeSessionActiveProjectHandoff\(profileId\)[\s\S]*window\.sessionStorage\.clear\(\)/u);
  for (const source of [journey, explore]) {
    assert.doesNotMatch(source, /hydrateProfilePrivateBrowser|window\.sessionStorage\.clear\(\)|stageSessionActiveProjectHandoff/u);
  }
});
