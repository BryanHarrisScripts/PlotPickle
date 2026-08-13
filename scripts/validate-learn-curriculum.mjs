import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const read = async (path) => readFile(new URL(path, root), "utf8");
const readJson = async (path) => JSON.parse(await read(path));

const failures = [];
const notes = [];

function check(condition, message) {
  if (!condition) failures.push(message);
}

const aliases = new Map([
  ["24-blocks-openstorytelling", "24-blocks"],
  ["24-blocks-openstorystudio", "24-blocks"],
]);

function githubDocumentKey(value) {
  try {
    const url = new URL(value.replace(/[),.;:'"\]]+$/g, ""));
    if (url.hostname.toLowerCase() !== "github.com") return "";
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 5 || parts[2].toLowerCase() !== "blob") return "";
    const repositoryName = parts[1].toLowerCase();
    const repository = aliases.get(repositoryName) ?? repositoryName;
    const path = decodeURIComponent(parts.slice(4).join("/")).replaceAll("\\", "/").toLowerCase();
    return `${parts[0].toLowerCase()}/${repository}/${path}`;
  } catch {
    return "";
  }
}

function sourceLinks(value) {
  const structured = [
    ...[...value.matchAll(/href=["'](https?:\/\/[^"']+)["']/gi)].map((match) => match[1]),
    ...[...value.matchAll(/\]\((https?:\/\/[^)]+)\)/gi)].map((match) => match[1]),
  ];
  const bare = [...value.matchAll(/https?:\/\/[^\s<>"')\]]+/gi)]
    .map((match) => match[0])
    .filter((candidate) => !structured.some((link) => link.startsWith(`${candidate} `)));
  return [...structured, ...bare];
}

const index = await readJson("learn/index.json");
const completion = await readJson("learn/completion-manifest.json");
const catalog = await read("adapters/curriculum/current-catalog.ts");
const curriculumMaterial = await read("modules/learn/ui/curriculum-material.tsx");
const workspace = await read("modules/learn/ui/learn-workspace.tsx");
const guide = await read("modules/creative-room/curriculum-guide.ts");
const retrieval = await read("modules/creative-room/curriculum-retrieval.ts");
const runtime = await read("build/mastra-agent-runtime.ts");

check(index.files.length === 12, `Expected 12 LEARN topic documents, found ${index.files.length}.`);
check(completion.topics.length === index.files.length, "The completion manifest must describe every LEARN topic.");
check(completion.contract.runtimeDelivery === "bundled-local-only", "LEARN must declare bundled-local-only runtime delivery.");
check(completion.contract.externalRepositoryAccessRequired === false, "LEARN must not require external repository access.");
check(completion.contract.studentFacingExternalSourceLinks === false, "LEARN source links must stay inside PlotPickle.");
check(completion.contract.sageRuntime === "mastra-local-ollama", "Sage must use the local Mastra/Ollama runtime.");
check(completion.contract.cannedTeachingResponsesAllowed === false, "Canned Sage teaching responses must remain forbidden.");
check(completion.contract.lessonChangeStartsAtTop === true, "Every opened lesson must start at the top.");
check(completion.contract.lessonTopControlRequired === true, "Every lesson must expose a top control.");
check(completion.contract.planMirrorsCompletedLearnTopics === true, "Completed LEARN topics must have a matching PLAN application path.");
check(completion.contract.planManualCompletionWithoutAi === true, "PLAN must remain fully usable without AI.");
check(completion.contract.aiPlanDraftRequiresExplicitAcceptance === true, "PLAN AI drafts must require explicit writer acceptance.");

const topicDocuments = [];
for (const entry of index.files) {
  const document = await readJson(`learn/${entry.file}`);
  topicDocuments.push(document);
  check(catalog.includes(`../../learn/${entry.file}`), `The runtime catalog does not statically import ${entry.file}.`);
  check(document.topic.id === entry.topic, `${entry.file} has the wrong topic ID.`);
  check(document.lessons.length === entry.lessonCount, `${entry.file} has the wrong archived lesson count.`);
  const sources = document.lessons.flatMap((lesson) => lesson.sources);
  check(sources.length === entry.sourceCount, `${entry.file} has the wrong source count.`);
  for (const source of sources) {
    check(typeof source.content === "string" && source.content.trim().length > 0, `${source.id} has no bundled content.`);
  }
}

const archivedLessons = topicDocuments.flatMap((document) => document.lessons);
const allSources = archivedLessons.flatMap((lesson) => lesson.sources);
const sourceIds = allSources.map((source) => source.id);
check(archivedLessons.length === index.lessonCount && archivedLessons.length === 81, `Expected 81 archived lessons, found ${archivedLessons.length}.`);
check(allSources.length === index.sourceCount && allSources.length === 95, `Expected 95 bundled source documents, found ${allSources.length}.`);
check(new Set(sourceIds).size === sourceIds.length, "Bundled source IDs must be unique.");

const bundledDocuments = new Set(allSources.map((source) => githubDocumentKey(source.url)).filter(Boolean));
for (const topic of completion.topics) {
  const indexEntry = index.files.find((entry) => entry.topic === topic.id);
  check(Boolean(indexEntry), `Completion topic ${topic.id} is not declared in learn/index.json.`);
  if (topic.status !== "complete" || !indexEntry) continue;

  for (const requiredFile of [topic.courseMaterial, topic.conceptCoverage, topic.ragInventory]) {
    check(typeof requiredFile === "string" && requiredFile.length > 0, `${topic.id} is complete but omits a required implementation artifact.`);
    if (typeof requiredFile === "string" && requiredFile) {
      try {
        await access(new URL(requiredFile, root));
      } catch {
        failures.push(`${topic.id} completion artifact is missing: ${requiredFile}.`);
      }
    }
  }

  const document = topicDocuments.find((candidate) => candidate.topic.id === topic.id);
  const linkedTeachingDocuments = new Set(
    document.lessons
      .flatMap((lesson) => lesson.sources)
      .flatMap((source) => sourceLinks(source.content))
      .map(githubDocumentKey)
      .filter(Boolean),
  );
  const unresolved = [...linkedTeachingDocuments].filter((key) => !bundledDocuments.has(key));
  check(unresolved.length === 0, `${topic.id} is complete but ${unresolved.length} linked teaching documents are not bundled locally: ${unresolved.join(", ")}`);
  notes.push(`${topic.id}: complete; ${linkedTeachingDocuments.size} linked teaching documents resolve to bundled local sources.`);
}

check(!/return\s*<a\b|<a\s+href=/i.test(curriculumMaterial), "Imported curriculum must not render anchor elements.");
check(!/target=["']_blank/i.test(curriculumMaterial), "Imported curriculum must not open remote tabs.");
check(!/href=\{source\.url\}/.test(curriculumMaterial), "Source provenance URLs must not become learner navigation.");
check(/data-integrated-curriculum-content/.test(curriculumMaterial), "Imported teaching must render directly in the lesson curriculum.");
check(/data-source-local-link/.test(curriculumMaterial), "Bundled cross-references must support local lesson navigation.");
check(!/<details|<summary|data-source-disclosure|Local archive|View exact archived source text/.test(curriculumMaterial), "Imported teaching must not be hidden behind a READ or archive disclosure.");
check(/activeLesson\.sources\.map/.test(workspace) && /data-integrated-curriculum-section/.test(workspace), "Every attached teaching document must enter the normal lesson flow.");

check(!/source\.repository|source\.path|source\.url/.test(workspace), "Learner search must not depend on repository provenance fields.");
check(/article\.scrollTo\(\{ top: 0/.test(workspace), "Opening a lesson must reset the article to the top.");
check(/activeLesson\?\.id/.test(workspace), "The lesson-top reset must react to the active lesson ID.");
check(/lessonTopButton/.test(workspace) && /Return to the top of this lesson/.test(workspace), "The lesson reader must expose an accessible top chevron.");

for (const requiredField of [
  "lesson.overview",
  "lesson.objectives",
  "lesson.sections",
  "lesson.definitions",
  "lesson.example",
  "lesson.checklist",
  "lesson.mistakes",
  "lesson.exercise",
  "lesson.apply",
  "lesson.sources",
]) {
  check(retrieval.includes(requiredField), `The RAG inventory does not include ${requiredField}.`);
}
check(/MAX_CHUNK_CHARACTERS = 900/.test(retrieval), "RAG blocks must stay inside the verified local chunk boundary.");
check(/retrieveCurriculumContext/.test(guide), "Sage must retrieve from the local curriculum inventory.");
check(/<student_question>/.test(guide) && /<\/student_question>/.test(guide), "Sage must preserve the student's live question in a complete structured block.");
check(!/Repository:|source\.repository|source\.path|source\.url/.test(guide), "Sage's runtime prompt must not expose repository provenance.");
check(/agentId: "curriculum-guide"/.test(guide) && /provider: "ollama"/.test(guide), "Sage must request the local Mastra curriculum agent through Ollama.");
check(/agent\.generate\(prompt/.test(runtime), "Mastra must generate Sage's response through the selected local model.");
check(!/promptStarters|answerBank|fixedResponses|cannedResponses/.test(workspace + guide), "The Sage answer path must not contain canned response banks.");

if (failures.length) {
  console.error("PlotPickle LEARN local curriculum validation failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log(`LEARN local curriculum contract passed: ${archivedLessons.length} archived lessons and ${allSources.length} bundled source documents.`);
  notes.forEach((note) => console.log(note));
  console.log("Sage uses complete local chunk inventory -> Mastra curriculum agent -> local Ollama generation; no canned teaching bank.");
}
