import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import * as ts from "typescript";
import { createServer } from "vite";
import { findTokenViolations } from "../scripts/ui-stylelint-gate.mjs";
import { createInMemoryAuthStateStore, createPlotPickleAuthService } from "../core/auth/plotpickle-auth-core.mjs";
import { createProfilePrivateStorageService } from "../core/storage/profile-private/profile-private-storage-core.mjs";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("#1745 root and Library no longer make LEARN the story-entry gate", async () => {
  const [home, library] = await Promise.all([
    source("app/page.tsx"),
    source("modules/library/ui/library-workspace.tsx"),
  ]);

  assert.match(home, /typeof window === "undefined"\) return "library"/u);
  assert.match(home, /requested === "learn"\) return "learn"/u);
  assert.match(home, /useState<Workspace>\("library"\)/u);

  assert.match(library, /window\.location\.assign\("\/story-map"\)/u);
  assert.match(library, /move straight into Block 01/u);
  assert.doesNotMatch(library, /workspace=learn/u);
});

test("#1745 global navigation makes Story Map primary Create and keeps LEARN beside Settings", async () => {
  const shortcuts = await source("app/navigation/global-shortcuts.ts");

  assert.match(shortcuts, /id: "create", label: "Create", detail: "Story Map, plan, build"/u);
  assert.match(shortcuts, /id: "story-map"[\s\S]*label: "Story Map"[\s\S]*area: "create"[\s\S]*href: "\/story-map"/u);
  assert.match(shortcuts, /id: "settings", label: "Settings", detail: "Settings and guides"/u);
  assert.match(shortcuts, /id: "learn"[\s\S]*label: "Learn"[\s\S]*area: "settings"[\s\S]*workspace: "learn"/u);

  const storyMapIndex = shortcuts.indexOf('id: "story-map"');
  const planIndex = shortcuts.indexOf('id: "plan"');
  const buildIndex = shortcuts.indexOf('id: "build"');
  const settingsIndex = shortcuts.indexOf('id: "settings"');
  const learnIndex = shortcuts.indexOf('id: "learn"');
  assert.ok(storyMapIndex < planIndex && planIndex < buildIndex, "Create order must remain Story Map → Plan → Build");
  assert.ok(settingsIndex < learnIndex, "Settings remains the primary utility destination while LEARN stays beside it");
});

test("#1745 Story Map starts at canonical Block 01 and four mini-block anchors without shadow storage", async () => {
  const [page, workspace] = await Promise.all([
    source("app/story-map/page.tsx"),
    source("app/story-map/story-map-workspace.tsx"),
  ]);

  assert.match(page, /activeShortcutId="story-map"/u);
  assert.match(page, /4 Acts · 24 Blocks · 96 Mini-Blocks/u);

  assert.match(workspace, /loadActiveLibraryProject/u);
  assert.match(workspace, /saveActiveLibraryProject/u);
  assert.match(workspace, /storyBlockState/u);
  assert.match(workspace, /storyMiniBlockState/u);
  assert.match(workspace, /"Awakening"/u);
  assert.match(workspace, /ACT_NUMBERS = \[1, 2, 3, 4\]/u);
  assert.match(workspace, /<dt>Blocks<\/dt><dd>24<\/dd>/u);
  assert.match(workspace, /<dt>Mini-Blocks<\/dt><dd>96<\/dd>/u);
  assert.match(workspace, /PLAN → BUILD → STORYBOARD/u);
  assert.match(workspace, /MINI-BLOCK ANCHOR/u);
  assert.match(workspace, /\{activeBlock\.number\}\.\{mini\.ordinal\}/u);
  assert.doesNotMatch(workspace, /localStorage/u);
  assert.doesNotMatch(workspace, /plotpickle\.project\.v1/u);
  assert.doesNotMatch(workspace, /WRITE/u);
  assert.ok(workspace.indexOf('aria-labelledby="active-block-title"') < workspace.indexOf('aria-label="24 Block Story Map"'), "The active Block must be the first working surface");
  assert.match(workspace, /<details className=\{styles\.orientation\}/u);
  assert.match(workspace, /<details className=\{styles\.mapDisclosure\}/u);
  assert.ok(workspace.indexOf("await persistActiveProfileProject()") < workspace.indexOf("router.push(storyStageHref"), "Persist the selected location before leaving");
  assert.match(workspace, /role="alert"/u);
});

async function typescriptModule(path) {
  const compiled = ts.transpileModule(await source(path), {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
}

test("#1745 reopening a mini-block and visiting its map preserve the selected stage without changing story evidence", async () => {
  const { createEmptyStoryStructureV2, normalizeStoryStructureV2 } = await typescriptModule("core/project/story-structure-v2.ts");
  const { selectStoryMapLocation, storyStageHref } = await typescriptModule("app/story-map/story-map-navigation.ts");
  const structure = createEmptyStoryStructureV2();
  structure.activeMiniBlockNumber = 3;
  structure.activeStage = "build";
  structure.blocks[0].miniBlocks[2].stages.plan = { state: "accepted", content: "Opening pressure", updatedAt: "2026-09-07", acceptedAt: "2026-09-07" };
  structure.blocks[0].miniBlocks[2].stages.build.state = "available";
  const reopened = normalizeStoryStructureV2(JSON.parse(JSON.stringify(structure)));
  const selected = selectStoryMapLocation(reopened, 1);
  assert.deepEqual(selected, reopened, "Opening the active Block does not reset its mini-block or stage");
  assert.equal(storyStageHref(selected), "/?workspace=build&block=1&mini=3");
  assert.strictEqual(selected.blocks, reopened.blocks, "Navigation cannot rewrite stage evidence or acceptance");
  assert.equal(selectStoryMapLocation(reopened, 2), null, "Navigation cannot unlock the next Block");
  assert.equal(selectStoryMapLocation(reopened, 1, 9), null, "A mini-block must belong to the requested Block");
  const first = selectStoryMapLocation(reopened, 1, 1);
  assert.equal(storyStageHref(first), "/?workspace=plan&block=1&mini=1");
  assert.equal(reopened.activeMiniBlockNumber, 3, "Selecting another anchor does not mutate the source");
  assert.equal(storyStageHref({ ...selected, activeStage: "storyboard" }), "/storyboard?block=1&mini=3");
});

test("#1745 Story Map consumes the shared tokens and exposes visible state and focus", async () => {
  const css = await source("app/story-map/story-map-workspace.module.css");
  assert.deepEqual(findTokenViolations("app/story-map/story-map-workspace.module.css", css), []);
  assert.doesNotMatch(css, /#[\da-f]{3,8}\b|\brgba?\(/iu);
  assert.match(css, /:focus-visible/u);
  assert.match(css, /var\(--pp-touch-target\)/u);
});

test("#1745 LEARN references remain in support and return to the active story", async () => {
  const { STATIC_SITEMAP_SHELL_TARGETS } = await typescriptModule("app/navigation/sitemap-route-context.ts");
  const support = Object.entries(STATIC_SITEMAP_SHELL_TARGETS).filter(([, target]) => target.rootContext === "learn");
  assert.equal(support.length, 6);
  const registry = JSON.parse(await source("config/ui-continuity-agent-registry.json"));
  for (const [path, target] of support) {
    assert.equal(target.area, "settings", path);
    assert.equal(registry.screens.find((screen) => screen.path === path)?.expectedArea, "settings", path);
  }
  assert.equal(registry.screens.find((screen) => screen.id === "learn").expectedArea, "settings");
  const shell = await source("app/plotpickle-workspace-shell.tsx");
  assert.match(shell, /activeWorkspace === "learn" \? shortcutForId\("story-map"\)/u);
  assert.match(shell, /"Return to story"/u);
});

test("#1745 Refine validation and old deep links reach the existing diagnostics owner", async () => {
  const [registry, home, captures, visual] = await Promise.all([
    source("config/uat-autopilot-registry.json"), source("app/page.tsx"),
    source("config/visual-audit-captures.json"), source("config/visual-capture-registry.json"),
  ]);
  assert.match(registry, /"id": "refine"[\s\S]*?"route": "\/diagnostics"/u);
  assert.match(home, /get\("workspace"\) === "refine"[\s\S]*?router\.replace\("\/diagnostics"\)/u);
  assert.doesNotMatch(captures + visual, /workspace=refine/u);
});

test("#1745 the real server normalizer preserves 24/96 location and evidence through encrypted save and reopen", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "plotpickle-v2-reopen-"));
  const loader = await createServer({ root: fileURLToPath(root), configFile: false, logLevel: "error", appType: "custom", server: { middlewareMode: true, hmr: false } });
  let auth;
  let storage;
  try {
    const { createEmptyProject, normalizeFoundationProject } = await loader.ssrLoadModule("/core/project/project.ts");
    const { createEmptyStoryStructureV2 } = await typescriptModule("core/project/story-structure-v2.ts");
    const stamp = "2026-09-07T21:00:00.000Z";
    auth = await createPlotPickleAuthService({ nodeId: "v2-reopen-test", accessMode: "desktop-loopback", stateStore: createInMemoryAuthStateStore() });
    const { authContext } = await auth.createFirstProfile({ displayName: "V2 Reopen Test", password: "Synthetic V2 reopen passphrase 2026", avatarRef: null });
    const options = { root: directory, authService: auth, normalizeProject: normalizeFoundationProject };
    storage = createProfilePrivateStorageService(options);
    const project = { ...createEmptyProject({ id: "v2-reopen-story", now: stamp, title: "Reopen test" }), structure: createEmptyStoryStructureV2() };
    project.structure.activeMiniBlockNumber = 3;
    project.structure.activeStage = "build";
    project.structure.blocks[0].miniBlocks[2].stages.plan = { state: "accepted", content: "A signal interrupts the opening scene.", updatedAt: stamp, acceptedAt: stamp };
    project.structure.blocks[0].miniBlocks[2].stages.build = { state: "incomplete", content: "Keep this unfinished visual decision.", updatedAt: stamp, acceptedAt: null };
    // The HTTP handler and storage service both use this production normalizer.
    await storage.saveProject(authContext, { project: normalizeFoundationProject(project) });
    storage.close();
    storage = createProfilePrivateStorageService(options);
    await storage.activateProject(authContext, project.id);
    const reopened = await storage.loadActiveProject(authContext);
    assert.deepEqual(reopened.structure, project.structure);
    assert.equal(reopened.learning.completedLessonIds.length, 0, "Story location must not require LEARN completion");
    assert.equal(reopened.structure.blocks[1].miniBlocks[0].stages.plan.state, "locked");
    const [api, runtime] = await Promise.all([source("app/api/auth/profile-private/route.ts"), source("core/auth/profile-experience/profile-experience-runtime.ts")]);
    assert.match(api, /normalizeFoundationProject\(input\.project\)/u);
    assert.match(runtime, /normalizeProject: normalizeFoundationProject/u);
  } finally {
    storage?.close();
    auth?.close();
    await loader.close();
    await rm(directory, { recursive: true, force: true });
  }
});
