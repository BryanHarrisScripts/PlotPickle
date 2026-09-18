import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2215 Semantic Review is built in, same-screen and has no opt-in switch", async () => {
  const [panel, settings, dashboard, route] = await Promise.all([
    read("app/skin-v1/uat-guide-panel.tsx"),
    read("app/skin-v1/settings-workspace-panel.tsx"),
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
    read("app/api/auth/uat-guide/route.ts"),
  ]);

  assert.match(panel, /data-uat-semantic-review="built-in"/u);
  assert.match(panel, /QUALITY \/ UAT SEMANTIC TESTING/u);
  assert.match(panel, /START UAT REVIEW/u);
  assert.match(panel, /In-page command window/u);
  assert.match(panel, /role="log"/u);
  assert.match(settings, /<UatGuidePanel \/>/u);
  assert.doesNotMatch(dashboard, /UatGuidePanel/u);
  assert.doesNotMatch(panel, /Show Start UAT Guide|setEnabled|mirrorWindows|canMirrorWindows/u);
  assert.doesNotMatch(route, /PREFERENCE_OBJECT_ID|set-enabled|UAT_GUIDE_OPT_IN_REQUIRED|mirrorWindows/u);
});

test("#2215 starting UAT creates or reuses the Human Afterglow working copy and persists it first", async () => {
  const panel = await read("app/skin-v1/uat-guide-panel.tsx");

  assert.match(panel, /AFTERGLOW_UAT_SOURCE_ID = "afterglow-v9"/u);
  assert.match(panel, /listLibraryProjects\(\)\.find/u);
  assert.match(panel, /item\.sourceKind === "example"/u);
  assert.match(panel, /item\.sourceId === AFTERGLOW_UAT_SOURCE_ID/u);
  assert.match(panel, /switchActiveLibraryProject\(existing\.id\)/u);
  assert.match(panel, /createAfterglowV9FoundationsReference\(\)/u);
  assert.match(panel, /createLibraryWorkingCopy\(\{/u);
  assert.match(panel, /await persistActiveProfileProject\(csrf\)/u);
  assert.match(panel, /const csrf = await csrfToken\(\)/u);

  const authIndex = panel.indexOf("const csrf = await csrfToken()");
  const persistIndex = panel.indexOf("await ensureAfterglowWorkingCopy(csrf)");
  const startRequestIndex = panel.indexOf('action: "start"');
  assert.ok(authIndex >= 0 && persistIndex > authIndex, "UAT must verify Human profile authority before persisting Afterglow.");
  assert.ok(startRequestIndex > persistIndex, "Afterglow must be prepared and persisted before the UAT runner starts.");
});

test("#2215 complete Writer-to-Screen Library PPF state survives encrypted profile persistence", async () => {
  const [normalizer, runtime, route, privateBrowser] = await Promise.all([
    read("core/storage/library-project.ts"),
    read("core/auth/profile-experience/profile-experience-runtime.ts"),
    read("app/api/auth/profile-private/route.ts"),
    read("core/storage/profile-private-browser.ts"),
  ]);

  assert.match(normalizer, /normalizeStoryStructureV2\(source\.structure\)/u);
  assert.match(normalizer, /normalizeProjectSourceEvidence\(source\.sourceEvidence\)/u);
  assert.match(normalizer, /normalizeBlockWritingState\(source\.writing\)/u);
  assert.match(normalizer, /return \{ \.\.\.project, structure, sourceEvidence, writing \}/u);
  assert.match(runtime, /normalizeProject: normalizeLibraryProject/u);
  assert.match(route, /const project = normalizeLibraryProject\(input\.project\)/u);
  assert.match(privateBrowser, /persistActiveProfileProject\(explicitToken = ""\)/u);
  assert.match(privateBrowser, /queueWrite\("save-project", \{ project: loadFoundationProject\(\) \}, explicitToken\)/u);
});

test("#2215 ongoing Human edits keep using the profile-private encrypted-on-disk save boundary", async () => {
  const [profileBoundary, privateStorage] = await Promise.all([
    read("app/profile-access/profile-access-boundary.tsx"),
    read("core/storage/profile-private/profile-private-storage-core.mjs"),
  ]);

  assert.match(profileBoundary, /window\.addEventListener\(PROJECT_LIBRARY_CHANGED_EVENT, persist\)/u);
  assert.match(profileBoundary, /screen === "ready"\) void persistActiveProfileProject\(\)/u);
  assert.match(privateStorage, /await access\.capability\.wrapSecret/u);
  assert.match(privateStorage, /await writeObject\(access, "projects", summary\.projectId, project\)/u);
});

test("#2215 Afterglow source provenance survives hydration so later UAT runs reuse local Human work", async () => {
  const browser = await read("core/storage/project-library-browser.ts");

  assert.match(browser, /referenceFixture\.sourceId === "afterglow-v9-complete-baseline"/u);
  assert.match(browser, /sourceKind: "example", sourceId: "afterglow-v9"/u);
  assert.match(browser, /normalizeLibraryProject/u);
});

test("#2215 the packaged v9 source truth is 21 explicit titled sections", async () => {
  const [identity, fixture, ...parts] = await Promise.all([
    read("data/afterglow-reference-identity.ts"),
    read("modules/library/reference/afterglow-golden-story-fixture.ts"),
    ...Array.from({ length: 8 }, (_, index) => read(`data/afterglow-screenplay/part-${String(index + 1).padStart(2, "0")}.ts`)),
  ]);
  const screenplaySource = parts.map((part) => {
    const first = part.indexOf("`");
    const last = part.lastIndexOf("`");
    return first >= 0 && last > first ? part.slice(first + 1, last) : "";
  }).join("");
  const sectionCount = screenplaySource
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((line) => /^#{1,6}\s*/u.test(line.trim()))
    .length;

  assert.equal(sectionCount, 21);
  assert.match(identity, /AFTERGLOW_V9_EXPLICIT_SECTION_COUNT = 21/u);
  assert.match(fixture, /sections\.length !== AFTERGLOW_V9_EXPLICIT_SECTION_COUNT/u);
});

test("#2215 tested-surface navigation keeps every Library runtime dependency defined", async () => {
  const browser = await read("core/storage/project-library-browser.ts");

  assert.match(browser, /createEmptyStoryStructureV2,[\s\S]*normalizeStoryStructureV2/u);
  assert.match(browser, /createEmptyBlockWritingState,[\s\S]*normalizeBlockWritingState/u);
  assert.match(browser, /const structure = hasStructure[\s\S]*normalizeStoryStructureV2\(incoming\.structure\)/u);
  assert.match(browser, /const writing = "writing" in incoming[\s\S]*normalizeBlockWritingState\(incoming\.writing\)/u);
});

test("#2215 Human review annotations are durable steering evidence and cannot override PASS or FAIL", async () => {
  const [route, panel] = await Promise.all([
    read("app/api/auth/uat-guide/route.ts"),
    read("app/skin-v1/uat-guide-panel.tsx"),
  ]);

  assert.match(route, /const REVIEW_DECISIONS = new Set\(\["acknowledge", "needs-review", "continue"\]\)/u);
  assert.match(route, /input\.action === "review-event"/u);
  assert.match(route, /domain: "cache", objectId: REVIEW_OBJECT_ID/u);
  assert.match(route, /deterministicResultUnchanged: true/u);
  assert.match(panel, />Acknowledge</u);
  assert.match(panel, />Needs review</u);
  assert.match(panel, />Continue</u);
  assert.match(panel, /This annotation does not alter deterministic PASS\/FAIL/u);
});

test("#2215 tested-surface handoffs keep Afterglow at Block 17 Mini-Block 1", async () => {
  const panel = await read("app/skin-v1/uat-guide-panel.tsx");

  for (const contract of [
    '/?workspace=dashboard&block=17&mini=1',
    '/write?block=17&mini=1',
    '/storyboard?block=17&mini=1',
    '/previs?block=17&mini=1',
    '/storyboard?block=17&mini=1&view=timeline',
  ]) assert.ok(panel.includes(contract), `Missing tested surface route: ${contract}`);

  assert.match(panel, /The working copy remains active after UAT/u);
  assert.match(panel, /normal visual actions where available/u);
});

test("#2215 runner retains isolated zero-spend deterministic authority", async () => {
  const runner = await read("scripts/run-uat-guide.mjs");

  assert.match(runner, /await forceLocalStoryMode\(\)/u);
  assert.match(runner, /prepareVerificationSyntheticHome\(syntheticHome\)/u);
  assert.match(runner, /providerSpendAllowed: false/u);
  assert.match(runner, /privateStoryRead: false/u);
  assert.match(runner, /hiddenReasoningRecorded: false/u);
  assert.match(runner, /UAT Semantic Review complete/u);
  assert.match(runner, /tests\/issue-2174-afterglow-story-to-screen-acceptance\.test\.mjs/u);
});
