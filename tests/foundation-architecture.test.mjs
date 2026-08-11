import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the reset locks the LEARN-first three-column product entry", async () => {
  const architecture = await read("docs/architecture/MODULAR-FOUNDATION.md");
  assert.match(architecture, /Left: curriculum only/);
  assert.match(architecture, /Centre: the active lesson/);
  assert.match(architecture, /Right: a persistent Creative Room/);
  assert.match(architecture, /new installation opens empty/i);
});

test("foundation modules declare small public contracts", async () => {
  const [contract, learn, room] = await Promise.all([
    read("core/contracts/module.ts"),
    read("modules/learn/manifest.ts"),
    read("modules/creative-room/manifest.ts"),
  ]);
  assert.match(contract, /FoundationModuleId = "learn" \| "creative-room"/);
  assert.match(learn, /id: "learn"/);
  assert.match(room, /id: "creative-room"/);
  assert.match(learn, /dependencies: \[\]/);
  assert.match(room, /dependencies: \[\]/);
});

test("modules import only public core contracts", async () => {
  for (const path of ["modules/learn/manifest.ts", "modules/creative-room/manifest.ts"]) {
    const source = await read(path);
    const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);
    assert.ok(imports.length > 0, `${path} should use a public contract`);
    assert.ok(imports.every((specifier) => specifier.startsWith("../../core/contracts/")));
  }
});

test("one canonical project carries lesson and Creative Room state", async () => {
  const [project, commands, reducer, storage] = await Promise.all([
    read("core/project/project.ts"),
    read("core/contracts/story-command.ts"),
    read("core/project/apply-command.ts"),
    read("core/storage/project-store.ts"),
  ]);
  assert.match(project, /activeLessonId/);
  assert.match(project, /threadId/);
  assert.match(commands, /lesson\.complete/);
  assert.match(reducer, /revision: project\.revision \+ 1/);
  assert.match(storage, /expectedRevision/);
});

test("the application composition root opens only the modular LEARN workspace", async () => {
  const page = await read("app/page.tsx");
  assert.match(page, /LearnWorkspace/);
  assert.match(page, /plotPickleCurriculum/);
  assert.doesNotMatch(page, /MarketingSplash|DashboardCommandCentre|createAfterglowProject/);
});

test("the curriculum migration adapter exposes all 81 modules", async () => {
  const adapter = await read("adapters/curriculum/current-catalog.ts");
  assert.match(adapter, /plotPickleCurriculum\.length !== 81/);
  assert.match(adapter, /CurriculumLesson/);
});

test("the LEARN module owns the interaction without importing legacy app code", async () => {
  const workspace = await read("modules/learn/ui/learn-workspace.tsx");
  assert.match(workspace, /aria-label="PlotPickle curriculum"/);
  assert.match(workspace, /aria-label="Active lesson"/);
  assert.match(workspace, /aria-label="Persistent Creative Room"/);
  assert.match(workspace, /applyStoryCommand/);
  assert.match(workspace, /localStorage/);
  assert.doesNotMatch(workspace, /from ["'](?:@\/)?app\//);
});

test("Creative Room retrieval is injected and searches the complete curriculum", async () => {
  const [page, guide, workspace] = await Promise.all([
    read("app/page.tsx"),
    read("modules/creative-room/curriculum-guide.ts"),
    read("modules/learn/ui/learn-workspace.tsx"),
  ]);
  assert.match(page, /guide=\{answerFromCurriculum\}/);
  assert.match(guide, /curriculum\.map/);
  assert.match(guide, /sourceLessonIds/);
  assert.match(workspace, /readonly guide: CurriculumGuide/);
  assert.doesNotMatch(workspace, /modules\/creative-room/);
});

test("LEARN preserves full lessons and uses user-controlled understanding", async () => {
  const [contract, adapter, workspace, guide, commands, reducer] = await Promise.all([
    read("core/contracts/curriculum.ts"),
    read("adapters/curriculum/current-catalog.ts"),
    read("modules/learn/ui/learn-workspace.tsx"),
    read("modules/creative-room/curriculum-guide.ts"),
    read("core/contracts/story-command.ts"),
    read("core/project/apply-command.ts"),
  ]);

  for (const field of ["definitions", "example", "checklist", "mistakes", "apply", "tags"]) {
    assert.match(contract, new RegExp(field));
    assert.match(adapter, new RegExp(field));
  }
  assert.match(workspace, /I understand this module/);
  assert.match(workspace, /type="checkbox"/);
  assert.match(workspace, /Key terms/);
  assert.match(workspace, /Lesson checklist/);
  assert.match(workspace, /Common mistakes/);
  assert.doesNotMatch(workspace, /Apply this lesson|We are working in/);
  assert.match(guide, /lesson\.definitions/);
  assert.match(guide, /lesson\.tags/);
  assert.match(commands, /lesson\.uncomplete/);
  assert.match(reducer, /case "lesson\.uncomplete"/);
});


test("LEARN presents the Master Storyteller curriculum guide", async () => {
  const workspace = await read("modules/learn/ui/learn-workspace.tsx");
  assert.match(workspace, /curriculum-guide-master-storyteller\.png/);
  assert.match(workspace, /alt="Master Storyteller, PlotPickle Curriculum Guide"/);
  assert.match(workspace, /styles\.guidePortrait/);
});
