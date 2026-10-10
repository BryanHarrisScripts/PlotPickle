import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

test("#2900 keeps unsupported completion and automatic authority out of native skills", async () => {
  for (const name of ["story-development-craft","story-revision-review"]) {
    const body = (await loadAgentSkill(name)).content;
    assert.match(body, /No PPF write|cannot write/i);
    assert.match(body, /provider selection/i);
    assert.match(body, /Human acceptance|Human review/i);
  }
});
