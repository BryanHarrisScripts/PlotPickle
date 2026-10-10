import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { loadAgentSkill, materializeAgentSkillRunManifest } from "../scripts/agent-skills.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const readJson = async (path) => JSON.parse(await read(path));

test("#2900 binds two new native skills to the existing Mastra specialists", async () => {
  const [profiles, registry, trust] = await Promise.all([
    readJson("config/agent-profiles.json"), readJson("config/agent-skills.json"), readJson("config/agent-skill-trust.json"),
  ]);
  for (const [profileId, skillId, consumer] of [
    ["elowen-mapweaver", "story-development-craft", "story-architect"],
    ["mira-threadmere", "story-revision-review", "continuity"],
  ]) {
    const profile = profiles.profiles.find((item) => item.id === profileId);
    assert.equal(profile.execution.kind, "embedded-mastra");
    assert.ok(profile.skillUris.includes(`skill://plotpickle/${skillId}`));
    const manifest = await materializeAgentSkillRunManifest(consumer, [skillId]);
    assert.ok(manifest.skills.some((item) => item.id === skillId));
    assert.equal(registry.skills.find((item) => item.id === skillId).primaryWorker, "mastra");
    assert.ok(trust.records.find((item) => item.uri === `skill://plotpickle/${skillId}`));
    assert.match((await loadAgentSkill(skillId)).content, /Human acceptance|Human review/i);
  }
});

test("#2900 uses Quillan's already-registered Sequence Director for cinematic planning", async () => {
  const content = (await loadAgentSkill("sequence-director")).content;
  assert.match(content, /Creative Focus cinematic-planning procedure/);
  assert.match(content, /narration/);
  assert.match(content, /continuity handoff/);
  assert.match(content, /not as an installed external production skill/);
});

test("#2900 supplies eight unique current-lesson supplements with explicit agent owners", async () => {
  const module = await read("adapters/curriculum/issue-2900-creative-focus.ts");
  const lessonPaths = ["structure", "world", "revision", "dialogue", "visual-storytelling"];
  const lessons = (await Promise.all(lessonPaths.map(async (topic) => readJson(`learn/${topic}.json`)))).flatMap((doc) => doc.lessons);
  const ids = ["24b-reflection","world-building","ai-revision-representation-research","essentials-audit","dialogue-voiceprint","early-visual-development","ai-revision-visual-pageflow","essentials-screen-evidence"];
  assert.equal(new Set(ids).size, 8);
  for (const id of ids) {
    assert.ok(lessons.some((lesson) => lesson.id === id), id);
    assert.ok(module.includes(`"lessonId": "${id}"`), id);
  }
  for (const id of ["story-development-craft", "story-revision-review", "sequence-director"]) {
    assert.ok(module.includes(`"skillId": "${id}"`));
  }
  const presentation = await read("adapters/curriculum/issue-2900-current-presentation.ts");
  assert.match(presentation, /withIssue2900CreativeFocusLessons\(plotPickleCurriculum\)/);
  const audited = await read("adapters/curriculum/current-catalog-integrated.ts");
  assert.doesNotMatch(audited, /issue-2900-creative-focus/);
  for (const route of ["app/api/learn/explore/route.ts", "app/api/learn/journey-courses/route.ts", "app/global-sage-overlay.tsx", "app/page.tsx"]) {
    assert.match(await read(route), /issue-2900-current-presentation/);
  }
  assert.match(module, /if \(found.size !== ISSUE_2900_CREATIVE_FOCUS.length\)/);
  const archive = await readJson("learn/index.json");
  assert.equal(archive.lessonCount, 81);
  assert.equal(archive.sourceCount, 95);
});

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
      assert.ok(target, `Missing curriculum import ${match[1]}`);
      source = source.replace(match[0], `from "${await moduleUrl(target)}"`);
    }
  }
  const url = `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
  moduleUrls.set(absolute, url);
  return url;
}

test("#2900 current teaching projection enriches exactly eight real lessons without mutating certified presentation", async () => {
  const [{ plotPickleCurriculum: baseline }, { creativeFocusPlotPickleCurriculum: current, creativeFocusCanonicalTopicDocuments: topics }] = await Promise.all([
    import(await moduleUrl(resolve(root, "adapters/curriculum/current-catalog.ts"))),
    import(await moduleUrl(resolve(root, "adapters/curriculum/issue-2900-current-presentation.ts"))),
  ]);
  assert.equal(current.length, 96);
  assert.equal(baseline.length, 96);
  assert.equal(topics.length, 12);
  assert.deepEqual(current.map((lesson) => lesson.id), baseline.map((lesson) => lesson.id));
  const touched = current.filter((lesson, i) => lesson.sections.length !== baseline[i].sections.length);
  const ids = [
    "24b-reflection", "world-building", "ai-revision-representation-research", "essentials-audit",
    "dialogue-voiceprint", "early-visual-development", "ai-revision-visual-pageflow", "essentials-screen-evidence",
  ];
  assert.deepEqual(new Set(touched.map((lesson) => lesson.id)), new Set(ids));
  for (const lesson of touched) {
    assert.ok(lesson.sections.some((section) => section.heading.startsWith("Creative Focus:")));
    assert.ok(lesson.sections.some((section) => section.heading === "Apply this to your story"));
    assert.ok(lesson.sections.find((section) => section.heading === "Apply this to your story").points.length);
    assert.ok(!baseline.find((original) => original.id === lesson.id).sections.some((section) => section.heading.startsWith("Creative Focus:")));
  }
});

test("#2900 keeps unsupported completion and automatic authority out of native skills", async () => {
  for (const name of ["story-development-craft","story-revision-review"]) {
    const body = (await loadAgentSkill(name)).content;
    assert.match(body, /No PPF write|cannot write/i);
    assert.match(body, /provider selection/i);
    assert.match(body, /Human acceptance|Human review/i);
  }
});
