import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const readJson = async (path) => JSON.parse(await read(path));

const TOPICS = [
  ["foundations", "foundations"],
  ["world", "world"],
  ["character", "character"],
  ["theme", "theme"],
  ["structure", "structure"],
  ["previs", "visual-storytelling"],
  ["drafting", "drafting"],
  ["dialogue", "dialogue"],
  ["revision", "revision"],
  ["responsible-ai", "responsible-ai"],
  ["industry", "industry"],
  ["collaboration", "collaboration"],
];

function applicationPromptCount(lesson) {
  const application = [...lesson.sections].reverse().find(
    (section) => section.heading.trim().toLowerCase() === "apply this to your story",
  );
  const prompts = application?.points?.filter((point) => point.trim()) ?? [];
  return prompts.length || 1;
}

test("#2645 every canonical Learn application field has one deterministic scope audit row", async () => {
  const audit = await readJson("config/mind-map-field-scope-audit.json");
  const expectedIds = [];

  for (const [topicId, learnTopicId] of TOPICS) {
    const document = await readJson(`learn/${learnTopicId}.json`);
    for (const lesson of document.lessons) {
      const count = applicationPromptCount(lesson);
      for (let index = 1; index <= count; index += 1) {
        expectedIds.push(`${topicId}:${lesson.id}:output-${index}`);
      }
    }
  }

  const auditedIds = audit.rows.map((row) => row.canonicalFieldId);
  assert.equal(audit.schemaVersion, "1.0");
  assert.equal(audit.issue, 2645);
  assert.equal(audit.canonicalFieldCount, expectedIds.length);
  assert.equal(new Set(auditedIds).size, auditedIds.length, "scope audit must not duplicate canonical field IDs");
  assert.deepEqual([...auditedIds].sort(), [...expectedIds].sort());

  for (const row of audit.rows) {
    assert.ok(["project-wide", "act-specific", "repeatable-by-act"].includes(row.scope));
    assert.ok(Array.isArray(row.validActs) && row.validActs.length > 0);
    assert.ok(row.validActs.every((act) => [1, 2, 3, 4].includes(act)));
    assert.equal(typeof row.storageOwner, "string");
    assert.ok(row.storageOwner.length > 0);
    assert.equal(typeof row.rationale, "string");
    assert.ok(row.rationale.length > 0);
    assert.equal(typeof row.application, "string");
  }
});

test("#2645 scope rules explicitly distinguish project-wide, Act-specific and repeatable fields", async () => {
  const [model, audit] = await Promise.all([
    read("modules/learn/model/story-development-fields.ts"),
    readJson("config/mind-map-field-scope-audit.json"),
  ]);

  assert.match(model, /export type StoryDevelopmentFieldScope =[sS]*"project-wide"[sS]*"act-specific"[sS]*"repeatable-by-act"/u);
  assert.match(model, /export function storyDevelopmentFieldScopeDecision/u);
  assert.match(model, /export function storyDevelopmentFieldAppliesToAct/u);
  assert.match(model, /export function storyDevelopmentFieldsForAct/u);
  assert.match(model, /return `${field\.canonicalId}::act-${act}`/u);

  const byId = new Map(audit.rows.map((row) => [row.canonicalFieldId, row]));
  assert.deepEqual(byId.get("foundations:pitch:output-1")?.validActs, [1]);
  assert.equal(byId.get("foundations:pitch:output-1")?.scope, "project-wide");
  assert.equal(byId.get("world:genres:output-1")?.scope, "project-wide");
  assert.equal(byId.get("world:world-building:output-1")?.scope, "repeatable-by-act");
  assert.equal(byId.get("structure:24b-dramatic-question:output-1")?.scope, "act-specific");
  assert.deepEqual(byId.get("structure:24b-dramatic-question:output-1")?.validActs, [1]);
  assert.equal(byId.get("structure:24b-reflection:output-1")?.scope, "act-specific");
  assert.deepEqual(byId.get("structure:24b-reflection:output-1")?.validActs, [4]);
  assert.equal(byId.get("character:characters-choice-proof:output-1")?.scope, "act-specific");
  assert.deepEqual(byId.get("character:characters-choice-proof:output-1")?.validActs, [4]);
});

test("#2645 Act-qualified values stay inside the existing storyDevelopment owner and fall back to project truth", async () => {
  const adapter = await read("core/project/story-development.ts");

  assert.match(adapter, /storyDevelopmentFieldStorageId\(field, act\)/u);
  assert.match(adapter, /if \(field\.scope === "project-wide" \|\| act === undefined/u);
  assert.match(adapter, /if \(!hasScopedActivity\(scopedState\)\) return \{ \.\.\.baseState, value \}/u);
  assert.match(adapter, /hasAcceptedScopedValue \? scopedState\.value : value/u);
  assert.match(adapter, /usesActStorage = input\.act !== undefined && input\.field\.scope !== "project-wide"/u);
  assert.match(adapter, /if \(input\.act !== undefined && !storyDevelopmentFieldAppliesToAct\(input\.field, input\.act\)\) \{[sS]*return input\.project/u);
  assert.match(adapter, /project\.foundations\.lessons\[field\.lessonId\]\?\.answers\[field\.fieldId\]/u);
  assert.match(adapter, /project\.world\.lessons\[field\.lessonId\]\?\.answers\[field\.fieldId\]/u);
  assert.doesNotMatch(adapter, /readonly actValues|mindMapActValues|actFieldStore/u);
});

test("#2645 Mind Map filters by Act before pagination and Act navigation never writes canon", async () => {
  const surface = await read("app/skin-v1/discovery-surface.tsx");

  assert.match(surface, /const selectedTopicFields = canonicalFields\.filter\(\(field\) => field\.topicId === selectedTopic\)/u);
  assert.match(surface, /const selectedCanonicalFields = storyDevelopmentFieldsForAct\(selectedTopicFields, selectedAct\)/u);
  assert.match(surface, /storyDevelopmentFieldPageCount\(selectedCanonicalFields\)/u);
  assert.match(surface, /storyDevelopmentFieldsForPage\(selectedCanonicalFields, selectedFieldPage\)/u);
  assert.match(surface, /const storageId = storyDevelopmentFieldStorageId\(field, selectedAct\)/u);
  assert.match(surface, /data-field-scope=\{field\.scope\}/u);
  assert.match(surface, /data-field-storage-id=\{storageId\}/u);
  assert.match(surface, /data-field-valid-acts=\{field\.validActs\.join\(","\)\}/u);
  assert.match(surface, /No \{selectedTopicLabel\} fields require separate Act \{selectedAct\} input/u);

  const start = surface.indexOf("function changeAct");
  const end = surface.indexOf("function changeTopic", start);
  const changeAct = surface.slice(start, end);
  assert.match(changeAct, /setSelectedAct\(act\)/u);
  assert.match(changeAct, /setSelectedFieldPage\(1\)/u);
  assert.match(changeAct, /setSelectedFieldId\(null\)/u);
  assert.doesNotMatch(changeAct, /saveActiveLibraryProject|persistCanonicalProject|writeStoryDevelopment/u);
});

test("#2645 Mind Map saves and Agent suggestions target the selected Act without silently changing project-wide identity", async () => {
  const surface = await read("app/skin-v1/discovery-surface.tsx");

  assert.match(surface, /writeStoryDevelopmentFieldValue\(\{[sS]*act: selectedAct/u);
  assert.match(surface, /currentValue: fieldDrafts\[storyDevelopmentFieldStorageId\(field, selectedAct\)\]/u);
  assert.match(surface, /writeStoryDevelopmentFieldProposal\(\{[sS]*act: selectedAct/u);
  assert.match(surface, /acceptStoryDevelopmentFieldProposal\(\{ project: withProposal, field, act: selectedAct \}\)/u);
  assert.match(surface, /sourceRef: `agent:creative-director:mind-map:${field\.canonicalId}:act-${selectedAct}`/u);
});

test("#2645 World Map reads the same Act-scoped owner and preserves Act when returning to Mind Map", async () => {
  const [worldMap, host] = await Promise.all([
    read("app/skin-v1/story-bible-surface.tsx"),
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
  ]);

  assert.match(worldMap, /storyDevelopmentFieldsForAct\([\s\S]*selectedAct/u);
  assert.match(worldMap, /storyDevelopmentFieldView\(project, field, act\)/u);
  assert.match(worldMap, /data-world-map-field-scope=\{field\.scope\}/u);
  assert.match(worldMap, /onEditField\(field\.topicId, field\.canonicalId, act\)/u);
  assert.match(worldMap, /No \{activeTopicEntry\.label\} fields require separate Act \{selectedAct\} input/u);

  assert.match(host, /const \[discoveryInitialAct, setDiscoveryInitialAct\] = useState<StoryDevelopmentAct>\(1\)/u);
  assert.match(host, /function openMindMapField\(topic: LearnTopicSpineId, canonicalFieldId: string, act: StoryDevelopmentAct\)/u);
  assert.match(host, /setDiscoveryInitialAct\(act\)/u);
  assert.match(host, /initialAct=\{discoveryInitialAct\}/u);
});

test("#2645 packaged Afterglow remains backward compatible and does not require fabricated Act copies", async () => {
  const snapshot = await readJson("data/afterglow-packaged-current/snapshot.json");
  const project = snapshot.project;
  const storyFields = Object.keys(project.storyDevelopment?.fields ?? {});

  assert.equal(storyFields.some((key) => key.includes("::act-")), false);
  const foundationValues = Object.values(project.foundations.lessons)
    .flatMap((lesson) => Object.values(lesson.answers ?? {}))
    .filter((value) => typeof value === "string" && value.trim());
  assert.ok(foundationValues.length > 0);
});
