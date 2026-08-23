import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Foundations promotes and retains all seven canonical sources without duplicating them", async () => {
  const [catalog, promoted, coverage] = await Promise.all([
    read("adapters/curriculum/current-catalog.ts"),
    read("adapters/curriculum/foundation-reference-lessons.ts"),
    read("adapters/curriculum/foundation-content-coverage.ts"),
  ]);

  const sourceIds = [
    "24-blocks-general-general-the-pitch-md",
    "24-blocks-general-readme-md",
    "24-blocks-loglines-loglines-md",
    "24-blocks-essentials-essential-aspects-1-md",
    "24-blocks-essentials-essential-aspects-2-md",
    "24-blocks-essentials-readme-md",
    "24-blocks-essentials-storytelling-dynamics-md",
  ];
  for (const sourceId of sourceIds) {
    assert.match(promoted, new RegExp(sourceId));
    assert.match(coverage, new RegExp(sourceId));
  }

  assert.match(catalog, /buildDeepFoundationCurriculum/);
  assert.match(catalog, /FOUNDATION_PROMOTED_SOURCE_IDS/);
  assert.match(catalog, /FOUNDATION_SOURCE_COVERAGE/);
  assert.match(catalog, /standaloneFoundations\.length !== 11/);
  assert.match(catalog, /standaloneSourceIds\.length !== 95/);
  assert.match(catalog, /all 95 unique embedded presentation references/);
  assert.match(promoted, /sections: \[\]/);
  assert.match(promoted, /sources: \[source\]/);
  assert.match(promoted, /baseLessons\.map\(\(lesson\) => \(\{ \.\.\.lesson, sources: \[\] \}\)\)/);
});

test("curated lessons re-home useful concepts while imported teaching reads as normal curriculum", async () => {
  const [deep, promoted, coverage, sourceMaterial] = await Promise.all([
    read("adapters/curriculum/foundation-deep-learning.ts"),
    read("adapters/curriculum/foundation-reference-lessons.ts"),
    read("adapters/curriculum/foundation-content-coverage.ts"),
    read("modules/learn/ui/curriculum-material.tsx"),
  ]);

  assert.match(deep, /foundation-course-material/);
  assert.match(deep, /curated material absorbs and deliberately re-homes/);
  assert.doesNotMatch(deep, /\.\.\.lesson\.sections/);
  assert.doesNotMatch(promoted, /sourceContentToSections|cleanInline|markdownHeading|emphasizedHeading/);
  assert.match(coverage, /canonical Markdown stays attached/);
  assert.match(coverage, /taughtIn:/);
  assert.match(coverage, /historicalOnly:/);
  assert.match(coverage, /former four-lesson Foundations path is also re-homed/);

  assert.match(sourceMaterial, /<ol key=\{key\} start=\{block\.start\}>/);
  assert.match(sourceMaterial, /<blockquote key=\{key\}>/);
  assert.match(sourceMaterial, /<table>/);
  assert.match(sourceMaterial, /data-integrated-curriculum-content/);
  assert.match(sourceMaterial, /data-source-local-link/);
  assert.doesNotMatch(sourceMaterial, /href=\{source\.url\}|target="_blank"/);
  assert.doesNotMatch(sourceMaterial, /<details|<summary|data-source-disclosure|View exact archived source text|Local archive/);
  assert.doesNotMatch(sourceMaterial, /<pre>\{source\.content\}<\/pre>/);
});

test("LEARN uses continuous reading typography rather than cards and bullet pills", async () => {
  const [layout, styles, workspace] = await Promise.all([
    read("app/layout.tsx"),
    read("app/learn-lesson-formatting.css"),
    read("modules/learn/ui/learn-workspace.tsx"),
  ]);

  assert.match(layout, /learn-lesson-formatting\.css/);
  assert.match(styles, /article\[aria-label="Active lesson"\] > section/);
  assert.match(styles, /max-width: 74ch/);
  assert.match(styles, /font-size: 17px/);
  assert.match(styles, /> section \{[\s\S]*?border: 0;[\s\S]*?border-radius: 0;[\s\S]*?background: none;[\s\S]*?box-shadow: none;/);
  assert.match(styles, /> section > ul > li,[\s\S]*?border: 0;[\s\S]*?border-radius: 0;[\s\S]*?background: none;/);
  assert.match(workspace, /data-lesson-block="teaching"/);
  assert.match(workspace, /data-lesson-block="exercise"/);
  assert.doesNotMatch(styles, /section:last-of-type:not\(:has\(details\)\)/);
  assert.doesNotMatch(styles, /content: "◆"/);
});
