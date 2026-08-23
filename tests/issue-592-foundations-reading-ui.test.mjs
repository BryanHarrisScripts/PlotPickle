import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("LEARN navigation stays inside the active topic and search covers the complete lesson body", async () => {
  const [workspace, languageAdapter] = await Promise.all([
    read("modules/learn/ui/learn-workspace.tsx"),
    read("app/writer-facing-collaboration-language.tsx"),
  ]);

  assert.match(workspace, /activeTopicLessons = useMemo/);
  assert.match(workspace, /curriculum\.filter\(\(lesson\) => lesson\.topic === activeLesson\.topic\)/);
  assert.match(workspace, /activeTopicLessons\[activeTopicLessonIndex - 1\]/);
  assert.match(workspace, /activeTopicLessons\[activeTopicLessonIndex \+ 1\]/);
  assert.match(workspace, /activeTopicLessons\.length/);
  assert.match(workspace, /topicLessonNumbers/);

  for (const field of [
    "lesson.objectives",
    "lesson.sections.flatMap",
    "lesson.definitions.flatMap",
    "lesson.example.title",
    "lesson.example.text",
    "lesson.checklist",
    "lesson.mistakes",
    "lesson.exercise",
    "lesson.apply",
    "source.scopeNote",
    "source.content",
  ]) {
    assert.ok(workspace.includes(field), `Search should include ${field}`);
  }

  assert.doesNotMatch(workspace, /\{lesson\.sources\.length\} references/);
  assert.doesNotMatch(workspace, /0 references/);
  assert.doesNotMatch(workspace, /complete without an additional repository reference/);
  assert.match(workspace, /data-preserve-story-language="true"/);
  assert.match(languageAdapter, /\[data-preserve-story-language\]/);
});

test("imported teaching renders directly inside the normal lesson curriculum", async () => {
  const [workspace, sourceMaterial] = await Promise.all([
    read("modules/learn/ui/learn-workspace.tsx"),
    read("modules/learn/ui/curriculum-material.tsx"),
  ]);

  assert.match(workspace, /data-integrated-curriculum-section/);
  assert.match(workspace, /<CurriculumMaterial[\s\S]*?source=\{source\}/);
  assert.match(workspace, /activeLesson\.sources\.map/);
  assert.match(sourceMaterial, /data-integrated-curriculum-content/);
  assert.match(sourceMaterial, /<ol key=\{key\} start=\{block\.start\}>/);
  assert.match(sourceMaterial, /<blockquote key=\{key\}>/);
  assert.match(sourceMaterial, /<table>/);
  assert.match(sourceMaterial, /data-source-local-link/);
  assert.match(sourceMaterial, /curriculumContent\(source\)/);
  assert.match(sourceMaterial, /24-blocks-loglines-loglines-md/);
  assert.match(sourceMaterial, /content\.indexOf\("## Prompt 1"\)/);
  assert.doesNotMatch(sourceMaterial, /href=\{source\.url\}|target="_blank"/);
  assert.doesNotMatch(sourceMaterial, /<details|<summary|data-source-disclosure|View exact archived source text|Local archive/);
  assert.doesNotMatch(workspace, /Bundled teaching material|original source/);
});

test("lesson formatting is continuous reading typography with restrained callouts", async () => {
  const styles = await read("app/learn-lesson-formatting.css");

  assert.match(styles, /max-width: 74ch/);
  assert.match(styles, /font-size: 17px/);
  assert.match(styles, /> section \{[\s\S]*?border: 0;[\s\S]*?border-radius: 0;[\s\S]*?background: none;[\s\S]*?box-shadow: none;/);
  assert.match(styles, /> section > ul,[\s\S]*?padding-inline-start: 1\.45em/);
  assert.match(styles, /\[data-lesson-block="objectives"\]/);
  assert.match(styles, /\[data-lesson-block="example"\]/);
  assert.match(styles, /\[data-lesson-block="exercise"\]/);
  assert.match(styles, /\[data-integrated-curriculum-content\]/);
  assert.doesNotMatch(styles, /section:last-of-type:not\(:has\(details\)\)/);
  assert.doesNotMatch(styles, /content: "◆"/);
});
