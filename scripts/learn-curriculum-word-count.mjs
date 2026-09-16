import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const moduleUrls = new Map();

async function moduleUrl(path) {
  const absolute = resolve(path);
  if (moduleUrls.has(absolute)) return moduleUrls.get(absolute);
  let source = extname(absolute) === ".json"
    ? `export default ${readFileSync(absolute, "utf8")};`
    : stripTypeScriptTypes(readFileSync(absolute, "utf8"));
  if (extname(absolute) !== ".json") {
    for (const match of [...source.matchAll(/from\s*["'](\.[^"']+)["']/gu)]) {
      const requested = resolve(dirname(absolute), match[1]);
      const target = [requested, `${requested}.ts`, `${requested}.json`, resolve(requested, "index.ts")]
        .find((candidate) => existsSync(candidate) && /\.(ts|json)$/u.test(candidate));
      if (!target) throw new Error(`Missing curriculum import ${match[1]}`);
      source = source.replace(match[0], `from "${await moduleUrl(target)}"`);
    }
  }
  const url = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
  moduleUrls.set(absolute, url);
  return url;
}

const loadLocalModule = async (path) => import(await moduleUrl(path));
const { plotPickleCurriculum: lessons } = await loadLocalModule(
  resolve(root, "adapters/curriculum/current-catalog.ts"),
);

const WORD_PATTERN = /[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu;
const words = (value) => String(value ?? "").match(WORD_PATTERN)?.length ?? 0;
const sumWords = (values) => values.reduce((total, value) => total + words(value), 0);

function learnerStrings(lesson) {
  return [
    lesson.title,
    lesson.overview,
    ...lesson.objectives,
    ...lesson.sections.flatMap((section) => [
      section.heading,
      ...section.paragraphs,
      ...(section.points ?? []),
    ]),
    ...lesson.definitions.flatMap((definition) => [definition.term, definition.meaning]),
    lesson.example?.title,
    lesson.example?.text,
    ...lesson.checklist,
    ...lesson.mistakes,
    lesson.exercise,
    lesson.apply,
  ].filter((value) => typeof value === "string");
}

const learnerByLesson = lessons.map((lesson, index) => ({
  presentationOrder: index + 1,
  lessonId: lesson.id,
  title: lesson.title,
  topic: lesson.topic,
  words: sumWords(learnerStrings(lesson)),
  sourceIds: lesson.sources.map((source) => source.id),
}));

const uniqueSources = new Map();
for (const lesson of lessons) {
  for (const source of lesson.sources) uniqueSources.set(source.id, source);
}

const sourceById = [...uniqueSources.values()]
  .map((source) => ({
    sourceId: source.id,
    repository: source.repository,
    title: source.title,
    words: words(source.content),
  }))
  .sort((a, b) => a.sourceId.localeCompare(b.sourceId));

const report = {
  schemaVersion: "1.0",
  issue: 2094,
  purpose: "Before/after fidelity and formatting comparison for the 96 learner-facing lessons.",
  commitSha: process.env.GITHUB_SHA ?? null,
  wordCountContract: {
    tokenizer: "Unicode letter/number words; internal apostrophes and hyphens stay within a word.",
    learnerIncludes: [
      "lesson title",
      "overview",
      "objectives",
      "section headings, paragraphs and points",
      "definition terms and meanings",
      "example title and text",
      "checklist",
      "common mistakes",
      "exercise",
      "Apply in PlotPickle value",
    ],
    learnerExcludes: [
      "bundled source content",
      "source titles and scope notes",
      "duration",
      "tags",
      "source/provenance metadata",
      "static UI labels",
    ],
    sourceCount: "Counts raw source.content for each unique bundled source exactly once.",
  },
  lessonCount: lessons.length,
  uniqueSourceCount: uniqueSources.size,
  learnerWordCount: learnerByLesson.reduce((total, lesson) => total + lesson.words, 0),
  rawBundledSourceWordCount: sourceById.reduce((total, source) => total + source.words, 0),
  learnerByLesson,
  sourceById,
};

if (report.lessonCount !== 96) throw new Error(`Expected 96 presentation lessons, found ${report.lessonCount}.`);
if (report.uniqueSourceCount !== 95) throw new Error(`Expected 95 unique bundled sources, found ${report.uniqueSourceCount}.`);

const outputPath = resolve(root, ".artifacts/learn-fidelity/word-count.json");
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(`LEARN learner-facing words: ${report.learnerWordCount}`);
console.log(`LEARN raw bundled-source words: ${report.rawBundledSourceWordCount}`);
console.log(`LEARN lessons: ${report.lessonCount}; unique bundled sources: ${report.uniqueSourceCount}`);
console.log(`LEARN_FIDELITY_WORD_COUNT=${JSON.stringify(report)}`);
