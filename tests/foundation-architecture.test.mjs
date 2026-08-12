import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
  assert.match(guide, /curriculum\s*\.map/);
  assert.match(guide, /sourceLessonIds/);
  assert.match(workspace, /readonly guide: CurriculumGuide/);
  assert.doesNotMatch(workspace, /modules\/creative-room/);
});

test("LEARN preserves full lessons and uses user-controlled understanding", async () => {
  const [contract, adapter, rawCurriculum, workspace, guide, commands, reducer] = await Promise.all([
    read("core/contracts/curriculum.ts"),
    read("adapters/curriculum/current-catalog.ts"),
    read("learn/foundations.json"),
    read("modules/learn/ui/learn-workspace.tsx"),
    read("modules/creative-room/curriculum-guide.ts"),
    read("core/contracts/story-command.ts"),
    read("core/project/apply-command.ts"),
  ]);

  for (const field of ["definitions", "example", "checklist", "mistakes", "apply", "tags"]) {
    assert.match(contract, new RegExp(field));
    assert.match(rawCurriculum, new RegExp(`"${field}"`));
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


test("LEARN exposes the future PlotPickle workflow navigation", async () => {
  const [workspace, styles] = await Promise.all([
    read("modules/learn/ui/learn-workspace.tsx"),
    read("modules/learn/ui/learn-workspace.module.css"),
  ]);
  for (const label of ["Dashboard", "Learn", "Plan", "Storyboard", "Write", "Edit", "Graphic Novel", "Build", "Feedback", "Refine", "Reports / Export"]) {
    assert.match(workspace, new RegExp(label.replace("/", "\\/")));
  }
  assert.match(workspace, /aria-label="PlotPickle workflow"/);
  assert.match(workspace, /aria-current=\{stage\.id === "learn"/);
  assert.match(workspace, /aria-label="Lesson navigation"/);
  assert.match(workspace, /previousLesson/);
  assert.match(workspace, /nextLesson/);
  assert.match(workspace, /relicPosition/);
  assert.match(workspace, /styles\.stageRelic/);
  assert.match(styles, /workflow-magic-relics\.webp/);
  assert.match(styles, /background-size: 1100% auto/);
  assert.match(styles, /background-color: transparent/);
  assert.match(styles, /drop-shadow/);
});


test("the curriculum guide is an Ollama-backed teaching agent with memory", async () => {
  const [contract, guide, workspace, runtime, gateway] = await Promise.all([
    read("core/contracts/curriculum-guide.ts"),
    read("modules/creative-room/curriculum-guide.ts"),
    read("modules/learn/ui/learn-workspace.tsx"),
    read("build/mastra-agent-runtime.ts"),
    read("build/writing-assistant-gateway.ts"),
  ]);
  assert.match(contract, /conversation/);
  assert.match(contract, /projectMemory/);
  assert.match(contract, /Promise<CurriculumGuideAnswer>/);
  assert.match(guide, /curriculum\s*\.map/);
  assert.match(guide, /<curriculum_context>/);
  assert.match(guide, /<conversation_memory>/);
  assert.match(guide, /<project_memory>/);
  assert.match(guide, /<student_question>/);
  assert.match(guide, /fetch\("\/api\/writing-assistant\/chat"/);
  assert.match(guide, /provider: "ollama"/);
  assert.doesNotMatch(guide, /history: conversation/);
  assert.match(runtime, /"curriculum-guide"/);
  assert.match(runtime, /warm, patient PlotPickle teacher/);
  assert.match(runtime, /plain language/);
  assert.match(runtime, /temperature: 0\.2/);
  assert.match(runtime, /I don't have that in our current curriculum/);
  assert.match(gateway, /body\.provider === "ollama"/);
  assert.match(gateway, /curriculumGuideOllamaProfile/);
  assert.match(gateway, /Connect Ollama and choose an installed model/);
  assert.match(workspace, /const answer = await guide/);
  assert.match(workspace, /projectMemory/);
  assert.match(workspace, /Thinking about your question/);
  assert.match(workspace, /role="alert"/);
  assert.match(workspace, /Curriculum Guide/);
  assert.match(workspace, /Ask in your own words/);
  assert.match(workspace, /Ask the Guide/);
});


test("LEARN and GUIDE share one topic-based JSON curriculum", async () => {
  const [catalogSource, rawIndex, guide, workspace, runtime, gateway] = await Promise.all([
    read("adapters/curriculum/current-catalog.ts"),
    read("learn/index.json"),
    read("modules/creative-room/curriculum-guide.ts"),
    read("modules/learn/ui/learn-workspace.tsx"),
    read("build/mastra-agent-runtime.ts"),
    read("build/writing-assistant-gateway.ts"),
  ]);
  const index = JSON.parse(rawIndex);
  assert.equal(index.schemaVersion, "2.0");
  assert.equal(index.lessonCount, 81);
  assert.equal(index.sourceCount, 95);
  assert.ok(index.files.some((file) => file.file === "industry.json"));
  assert.ok(index.files.some((file) => file.file === "theme.json"));
  const documents = await Promise.all(index.files.map(async (file) => JSON.parse(await read(`learn/${file.file}`))));
  const lessons = documents.flatMap((document) => document.lessons).sort((left, right) => left.number - right.number);
  assert.equal(lessons.length, 81);
  for (const lesson of lessons) {
    for (const field of ["id", "number", "topic", "title", "duration", "overview", "objectives", "sections", "definitions", "example", "checklist", "mistakes", "exercise", "apply", "tags", "original", "sources"]) {
      assert.ok(field in lesson, `${lesson.id || "unknown lesson"} is missing ${field}`);
    }
  }
  assert.match(catalogSource, /learn\/industry\.json/);
  assert.match(catalogSource, /learn\/theme\.json/);
  assert.doesNotMatch(catalogSource, /plotpickle-curriculum|plotpickle-source-library/);
  assert.doesNotMatch(catalogSource, /learning-library|learning-24-blocks/);
  assert.match(runtime, /Stay under 140 words/);
  assert.match(runtime, /begin with Yes, No, or Not necessarily/);
  assert.match(guide, /conversation\.slice\(-6\)/);
  assert.match(guide, /content\.slice\(0, 900\)/);
  assert.match(guide, /\.slice\(0, 2\)/);
  assert.match(guide, /\.slice\(0, 1\)/);
  assert.match(guide, /cleanGuideAnswer/);
  assert.match(gateway, /content\.length <= 2_000/);
  assert.match(workspace, /Start fresh/);
  assert.match(workspace, /THREAD_PREFIX = "plotpickle\.foundation\.thread\.v2\."/);
  assert.match(workspace, /Curriculum:/);
});

test("all audited source records are embedded losslessly in lessons", async () => {
  const [catalogSource, rawIndex, guide, workspace, page, launcher] = await Promise.all([
    read("adapters/curriculum/current-catalog.ts"),
    read("learn/index.json"),
    read("modules/creative-room/curriculum-guide.ts"),
    read("modules/learn/ui/learn-workspace.tsx"),
    read("app/page.tsx"),
    read("Start-PlotPickle.bat"),
  ]);
  const index = JSON.parse(rawIndex);
  const documents = await Promise.all(index.files.map(async (file) => JSON.parse(await read(`learn/${file.file}`))));
  const lessons = documents.flatMap((document) => document.lessons).sort((left, right) => left.number - right.number);
  const sources = lessons.flatMap((lesson) => lesson.sources).sort((left, right) => left.id.localeCompare(right.id));
  assert.equal(sources.length, 95);
  assert.equal(new Set(sources.map((source) => source.id)).size, 95);
  assert.equal(createHash("sha256").update(JSON.stringify(sources)).digest("hex"), index.sourceContentSha256);
  const originalLessons = lessons.map((lesson) => ({
    id: lesson.id,
    number: lesson.original.number,
    path: lesson.original.path,
    title: lesson.title,
    duration: lesson.duration,
    overview: lesson.overview,
    objectives: lesson.objectives,
    sections: lesson.sections,
    definitions: lesson.definitions,
    example: lesson.example,
    checklist: lesson.checklist,
    mistakes: lesson.mistakes,
    exercise: lesson.exercise,
    apply: lesson.apply,
    tags: lesson.tags,
  }));
  assert.equal(createHash("sha256").update(JSON.stringify(originalLessons)).digest("hex"), index.lessonContentSha256);
  const afterglow = sources.filter((source) => source.repository === "Afterglow");
  assert.deepEqual(afterglow.map((source) => source.path).sort(), ["CONTRIBUTING.md", "README.md#instructional-sections"]);
  assert.ok(afterglow.every((source) => !source.path.includes("Storyboard Blocks")));
  assert.match(index.afterglowBoundary, /not an active project or default example/i);
  assert.match(catalogSource, /lesson\.sources/);
  assert.doesNotMatch(page, /knowledgeSources/);
  assert.doesNotMatch(workspace, /Source library/);
  assert.match(workspace, /Search every lesson/);
  assert.match(workspace, /Supporting lesson material/);
  assert.match(workspace, /sourceReferenceIds/);
  assert.match(guide, /selectReferenceSources/);
  assert.match(guide, /curriculum\.flatMap\(\(lesson\) => lesson\.sources\)/);
  assert.match(await read("build/mastra-agent-runtime.ts"), /curriculum_context is the only source of truth/);
  assert.match(launcher, /@mastra\\core\\package\.json/);
  assert.match(launcher, /Mastra !MASTRA_VERSION! is installed and ready for PlotPickle agents/);
});

test("the GUIDE uses a grounded 8K Ollama profile", async () => {
  const [provider, gateway, runtime, guide] = await Promise.all([
    read("build/writing-assistant-provider.ts"),
    read("build/writing-assistant-gateway.ts"),
    read("build/mastra-agent-runtime.ts"),
    read("modules/creative-room/curriculum-guide.ts"),
  ]);
  assert.match(provider, /CURRICULUM_GUIDE_CONTEXT = 8_192/);
  assert.match(provider, /CURRICULUM_GUIDE_TEMPERATURE = 0\.2/);
  assert.match(provider, /\/api\/create/);
  assert.match(provider, /num_ctx: CURRICULUM_GUIDE_CONTEXT/);
  assert.match(gateway, /agentId === "curriculum-guide"/);
  assert.match(runtime, /temperature: 0\.2/);
  assert.match(runtime, /maxOutputTokens: 320/);
  assert.match(guide, /<curriculum_context>/);
  assert.match(guide, /conversation\.slice\(-6\)/);
});
