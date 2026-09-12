import { readFile } from "node:fs/promises";
import { LEARN_PROGRAM_MAP } from "../learn/program-map.mjs";
import { assertLearnCurriculumIntegrity } from "./learn-curriculum-integrity.mjs";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const readJson = async (path) => JSON.parse(await read(path));

const [baseline, index, presentationAdapterSource, foundationReferenceSource] = await Promise.all([
  readJson("learn/journey-baseline.json"),
  readJson("learn/index.json"),
  read("adapters/curriculum/current-catalog.ts"),
  read("adapters/curriculum/foundation-reference-lessons.ts"),
]);
const topicDocuments = await Promise.all(index.files.map((entry) => readJson(`learn/${entry.file}`)));

const result = assertLearnCurriculumIntegrity({
  baseline,
  index,
  topicDocuments,
  programMap: LEARN_PROGRAM_MAP,
  presentationAdapterSource,
  foundationReferenceSource,
});

console.log(
  `LEARN #1918 Phase 2 curriculum integrity valid: ${result.summary.archivedLessonCount}/81 archived lessons, ${result.summary.bundledSourceCount}/95 bundled sources, ${result.summary.presentationLessonCount}/88 presentation lessons, ${result.summary.courseCount}/24 courses, ${result.summary.referencePresentationCoverageCount} promoted Foundations reference lessons, hashes preserved, no orphaned or duplicate lesson ownership, all prerequisites resolved.`,
);
