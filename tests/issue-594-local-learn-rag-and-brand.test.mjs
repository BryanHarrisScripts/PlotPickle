import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, extname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const ts = require("typescript");
const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFile(resolve(root, path), "utf8");
const moduleCache = new Map();

function pngDimensions(path) {
  const png = readFileSync(resolve(root, path));
  assert.equal(png.toString("ascii", 1, 4), "PNG", `${path} is not a PNG`);
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
}

function resolveLocalModule(parentPath, request) {
  const requested = resolve(dirname(parentPath), request);
  for (const candidate of [requested, `${requested}.ts`, `${requested}.json`]) {
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`Could not resolve ${request} from ${parentPath}`);
}

function loadLocalModule(path) {
  const absolute = resolve(path);
  if (moduleCache.has(absolute)) return moduleCache.get(absolute).exports;
  if (extname(absolute) === ".json") return JSON.parse(readFileSync(absolute, "utf8"));

  const module = { exports: {} };
  moduleCache.set(absolute, module);
  const output = ts.transpileModule(readFileSync(absolute, "utf8"), {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: absolute,
  }).outputText;
  const localRequire = (request) => (
    request.startsWith(".")
      ? loadLocalModule(resolveLocalModule(absolute, request))
      : require(request)
  );
  new Function("exports", "module", "require", "__filename", "__dirname", output)(
    module.exports,
    module,
    localRequire,
    absolute,
    dirname(absolute),
  );
  return module.exports;
}

test("the reusable LEARN local-completion validator passes Foundations", async () => {
  const { stdout } = await execFileAsync(process.execPath, ["scripts/validate-learn-curriculum.mjs"], { cwd: root });
  assert.match(stdout, /81 archived lessons and 95 bundled source documents/);
  assert.match(stdout, /foundations: complete; 21 linked teaching documents resolve to bundled local sources/);
  assert.match(stdout, /Mastra curriculum agent -> local Ollama generation; no canned teaching bank/);

  const manifest = JSON.parse(await read("learn/completion-manifest.json"));
  assert.equal(manifest.topics.length, 12);
  assert.equal(manifest.topics.find((topic) => topic.id === "foundations")?.status, "complete");
  assert.ok(manifest.topics.filter((topic) => topic.id !== "foundations").every((topic) => topic.status === "source-imported"));
  assert.equal(manifest.contract.externalRepositoryAccessRequired, false);
  assert.equal(manifest.contract.cannedTeachingResponsesAllowed, false);
});

test("every Foundations field and bundled-source passage enters the stable local RAG inventory", () => {
  const { plotPickleCurriculum } = loadLocalModule(resolve(root, "adapters/curriculum/current-catalog.ts"));
  const {
    buildCurriculumRagInventory,
    retrieveCurriculumContext,
  } = loadLocalModule(resolve(root, "modules/creative-room/curriculum-retrieval.ts"));
  const foundations = plotPickleCurriculum.filter((lesson) => lesson.topic === "foundations");
  const inventory = buildCurriculumRagInventory(foundations);

  assert.equal(foundations.length, 11);
  assert.ok(inventory.length > 300, "Foundations should expose granular curriculum chunks");
  assert.ok(inventory.every((chunk) => chunk.id && chunk.text && chunk.text.length <= 900));
  assert.ok(inventory.every((chunk) => !/https?:\/\//i.test(chunk.text)));

  for (const chunk of inventory) {
    const retrieval = retrieveCurriculumContext(foundations, chunk.lessonId, chunk.text);
    const selectedIds = new Set([...retrieval.lessonChunkIds, ...retrieval.sourceChunkIds]);
    assert.ok(selectedIds.has(chunk.id), `${chunk.id} cannot be retrieved from its own local content`);
  }

  for (const lesson of foundations) {
    const lessonChunks = inventory.filter((chunk) => chunk.lessonId === lesson.id);
    const requiredKinds = ["overview", "objective", "teaching", "definition", "example", "checklist", "mistake", "exercise", "apply"];
    for (const kind of requiredKinds) {
      assert.ok(lessonChunks.some((chunk) => chunk.kind === kind), `${lesson.title} is missing ${kind} from RAG`);
    }
    const retrieval = retrieveCurriculumContext(foundations, lesson.id, lesson.title);
    assert.equal(retrieval.lessonIds[0], lesson.id);
    assert.ok(retrieval.lessonChunkIds.length > 1);
    assert.ok(retrieval.context.includes(lesson.overview));
  }

  const foundationsSources = foundations.flatMap((lesson) => lesson.sources);
  assert.equal(foundationsSources.length, 7);
  for (const source of foundationsSources) {
    const sourceChunks = inventory.filter((chunk) => chunk.sourceId === source.id);
    assert.ok(sourceChunks.length > 0, `${source.title} is missing from the RAG inventory`);
    const owner = foundations.find((lesson) => lesson.sources.some((candidate) => candidate.id === source.id));
    const retrieval = retrieveCurriculumContext(foundations, owner.id, source.title);
    assert.ok(retrieval.sourceIds.includes(source.id), `${source.title} cannot be retrieved by title`);
  }
});

test("current Foundations teaching outranks corrected historical wording in realistic questions", () => {
  const { plotPickleCurriculum } = loadLocalModule(resolve(root, "adapters/curriculum/current-catalog.ts"));
  const {
    buildCurriculumRagInventory,
    retrieveCurriculumContext,
  } = loadLocalModule(resolve(root, "modules/creative-room/curriculum-retrieval.ts"));
  const foundations = plotPickleCurriculum.filter((lesson) => lesson.topic === "foundations");
  const inventory = buildCurriculumRagInventory(foundations);

  assert.ok(inventory.some((chunk) => chunk.status === "current" && chunk.authority === "governing-course"));
  assert.ok(inventory.some((chunk) => chunk.status === "adapted" && chunk.authority === "supporting-curriculum"));
  assert.ok(inventory.some((chunk) => chunk.status === "historical" && chunk.authority === "superseded-context"));
  assert.ok(inventory.some((chunk) => chunk.status === "navigation" && chunk.authority === "non-teaching-artifact"));

  const probes = [
    {
      lessonId: foundations.find((lesson) => lesson.title === "Screenplay Essentials: Structure, Dialogue and Visuals").id,
      question: "Is a three-act structure required for every screenplay?",
      correction: "three-act structure is one optional diagnostic map, not a required architecture",
      historical: "typically featuring a three-act setup",
    },
    {
      lessonId: foundations.find((lesson) => lesson.title === "Story Essentials: Theme, Plot, Character and Stakes").id,
      question: "Is theme merely the underlying message or main idea?",
      correction: "theme is not merely an underlying message",
      historical: "theme: the underlying message or main idea",
    },
    {
      lessonId: foundations.find((lesson) => lesson.title === "Pacing and Tone: Storytelling Dynamics").id,
      question: "Are action films always fast and dramas always slow?",
      correction: "action films are not always fast and dramas are not always slow",
      historical: "thrillers or action films tend to have a quick pace",
    },
  ];

  for (const probe of probes) {
    const retrieval = retrieveCurriculumContext(foundations, probe.lessonId, probe.question);
    const context = retrieval.context.toLowerCase();
    const currentIndex = context.indexOf(probe.correction);
    const historicalIndex = context.indexOf(probe.historical);
    assert.ok(currentIndex >= 0, `Missing current correction for: ${probe.question}`);
    assert.ok(historicalIndex >= 0, `Missing paired historical context for: ${probe.question}`);
    assert.ok(currentIndex < historicalIndex, `Historical wording outranked current teaching for: ${probe.question}`);
    assert.match(retrieval.context, /Status: current/);
    assert.match(retrieval.context, /Authority: governing-course/);
    assert.match(retrieval.context, /Status: historical/);
    assert.match(retrieval.context, /Authority: superseded-context/);
    assert.match(retrieval.context, /Material type: teaching/);
    assert.match(retrieval.context, /Curriculum scope: Canonical background teaching for PlotPickle lessons\./);
    assert.doesNotMatch(retrieval.context, /https?:\/\/|Repository:|Remote path:/i);
  }
});

test("Sage sends the student's real question through bounded local RAG without a response bank", async () => {
  const [guide, retrieval, runtime, workspace] = await Promise.all([
    read("modules/creative-room/curriculum-guide.ts"),
    read("modules/creative-room/curriculum-retrieval.ts"),
    read("build/mastra-agent-runtime.ts"),
    read("modules/learn/ui/learn-workspace.tsx"),
  ]);
  assert.match(guide, /xmlText\(studentQuestion\)/);
  assert.match(guide, /<\/student_question>/);
  assert.match(guide, /message\.length > 12_000/);
  assert.match(guide, /agentId: "curriculum-guide"/);
  assert.match(guide, /provider: "ollama"/);
  assert.match(runtime, /agent\.generate\(prompt/);
  assert.match(runtime, /current governing-course teaching outranks adapted supporting curriculum/);
  assert.match(runtime, /historical wording is usable only with its paired current correction/);
  assert.match(runtime, /navigation artifacts are never teaching/);
  assert.match(retrieval, /bundledSourcePlainText/);
  assert.match(retrieval, /sourceKind: source\.kind/);
  assert.match(retrieval, /sourceScope: source\.scopeNote/);
  assert.doesNotMatch(guide + workspace, /promptStarters|answerBank|fixedResponses|cannedResponses/);
  assert.doesNotMatch(guide, /Repository:|source\.repository|source\.path|source\.url/);
});

test("lesson changes reset to the top and expose an accessible top chevron", async () => {
  const [workspace, styles] = await Promise.all([
    read("modules/learn/ui/learn-workspace.tsx"),
    read("modules/learn/ui/learn-workspace.module.css"),
  ]);
  assert.match(workspace, /lessonArticleRef/);
  assert.match(workspace, /article\.scrollTo\(\{ top: 0, left: 0, behavior: "auto" \}\)/);
  assert.match(workspace, /\}, \[activeLesson\?\.id\]\)/);
  assert.match(workspace, /returnToLessonTop/);
  assert.match(workspace, /Return to the top of this lesson/);
  assert.match(workspace, /lessonHeadingRef\.current\?\.focus/);
  assert.match(styles, /\.lessonTopButton/);
  assert.match(styles, /position: sticky/);
});

test("Sage and the PlotPickle v2 identity are local, correctly sized and text-safe", async () => {
  const [workspace, shell, layout, manifest, splash, brandReadme, brandBuilder] = await Promise.all([
    read("modules/learn/ui/learn-workspace.tsx"),
    read("app/application-shell-header.tsx"),
    read("app/layout.tsx"),
    read("public/manifest.webmanifest"),
    read("app/marketing-splash-base.tsx"),
    read("public/brand/README.txt"),
    read("scripts/build-plotpickle-brand-assets.py"),
  ]);
  assert.match(workspace, /\/assets\/sage-brinewick-v2\.png/);
  assert.match(workspace, /alt="Sage Brinewick, PlotPickle Curriculum Guide"/);
  assert.match(workspace, /className=\{styles\.workspaceBrandMark\}[\s\S]*?plotpickle-ouroboros-v2-128\.png/);
  assert.match(workspace, /alt="PlotPickle"/);
  assert.match(shell, /plotpickle-ouroboros-v2-128\.png/);
  assert.match(layout, /plotpickle-ouroboros-v2-(?:32|192|512)\.png/);
  assert.match(manifest, /plotpickle-ouroboros-v2-(?:192|512)\.png/);
  assert.match(splash, /The eternal cycle of narrative twists/);
  assert.match(brandReadme, /dragon-cycle, compass and fountain-pen emblem/);
  assert.match(brandReadme, /16, 32, 48 and 64 pixel files use a deliberately simplified/);
  assert.match(brandBuilder, /SMALL_ICON_SIZES = \(16, 32, 48, 64\)/);
  assert.match(brandBuilder, /def simplified_mark\(size: int\)/);
  assert.match(brandBuilder, /simplified_mark\(256\)\.save/);
  assert.doesNotMatch([workspace, shell, layout, manifest, splash, brandReadme].join("\n"), /cyele|narretive/);

  const pngAssets = [
    "public/assets/sage-brinewick-v2.png",
    "public/brand/plotpickle-ouroboros-v2.png",
    ...[16, 32, 48, 64, 128, 180, 192, 512].map((size) => `public/brand/favicon/plotpickle-ouroboros-v2-${size}.png`),
    "docs/brand-sources/plotpickle-sage-logo-reference-2026-08-13.png",
    "docs/brand-sources/sage-brinewick-v2-master.png",
    "docs/brand-sources/plotpickle-ouroboros-v2-master.png",
  ];
  const binaryAssets = [...pngAssets, "public/brand/favicon/plotpickle-ouroboros-v2.ico"];
  for (const path of binaryAssets) {
    assert.ok(existsSync(resolve(root, path)), `${path} is missing`);
    assert.ok(readFileSync(resolve(root, path)).length > 500, `${path} is empty`);
  }

  assert.deepEqual(pngDimensions("public/assets/sage-brinewick-v2.png"), [768, 768]);
  assert.deepEqual(pngDimensions("public/brand/plotpickle-ouroboros-v2.png"), [800, 800]);
  for (const size of [16, 32, 48, 64, 128, 180, 192, 512]) {
    const path = `public/brand/favicon/plotpickle-ouroboros-v2-${size}.png`;
    assert.deepEqual(pngDimensions(path), [size, size]);
  }
});
