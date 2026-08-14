import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFile(resolve(root, path), "utf8");

test("LEARN logo is transparent, larger than glyphs, glowing, and Foundations formatting preserves exact copy", async () => {
  const [layout, polish, workspace, workspaceCss, curriculumMaterial, foundations] = await Promise.all([
    read("app/layout.tsx"),
    read("app/learn-foundations-polish.css"),
    read("modules/learn/ui/learn-workspace.tsx"),
    read("modules/learn/ui/learn-workspace.module.css"),
    read("modules/learn/ui/curriculum-material.tsx"),
    read("learn/foundations.json"),
  ]);

  assert.match(layout, /learn-foundations-polish\.css/);
  assert.doesNotMatch(layout, /LEARN_BRAND_GLYPH_STYLES/);

  assert.match(polish, /img\[alt="PlotPickle"\]/);
  assert.match(polish, /border:\s*0\s*!important/);
  assert.match(polish, /background:\s*transparent\s*!important/);
  assert.match(polish, /background-color:\s*rgba\(0,\s*0,\s*0,\s*0\)\s*!important/);
  assert.match(polish, /clip-path:\s*none\s*!important/);
  assert.match(polish, /box-shadow:\s*none\s*!important/);
  assert.match(polish, /width:\s*76px\s*!important/);
  assert.match(polish, /height:\s*76px\s*!important/);
  assert.match(polish, /filter:[\s\S]*drop-shadow/);
  assert.match(polish, /left:\s*9px\s*!important/);
  assert.match(workspaceCss, /\.stageRelic\s*\{[\s\S]*width:\s*44px/);
  assert.match(workspace, /alt="PlotPickle"[\s\S]*height=\{80\}[\s\S]*width=\{80\}/);

  assert.match(workspace, /activeLesson\.sections\.slice\(0, integratedContentIndex\)\.map/);
  assert.match(workspace, /activeLesson\.sources\.map/);
  assert.match(workspace, /activeLesson\.definitions\.map/);
  assert.match(workspace, /activeLesson\.checklist\.map/);
  assert.match(workspace, /activeLesson\.mistakes\.map/);
  assert.match(workspace, /activeLesson\.exercise/);
  assert.match(workspace, /activeLesson\.apply/);

  assert.match(workspace, /const emphasizeFoundationsLabels = activeLesson\.topic === "foundations"/);
  assert.match(workspace, /function KeyTakeawayText/);
  assert.match(workspace, /keyLabel\.label/);
  assert.match(workspace, /keyLabel\.separator/);
  assert.match(workspace, /keyLabel\.remainder/);
  assert.match(workspace, /emphasizeKeyLabels=\{emphasizeFoundationsLabels\}/);
  assert.match(curriculumMaterial, /readonly emphasizeKeyLabels\?: boolean/);
  assert.match(curriculumMaterial, /data-key-term-label/);
  assert.match(curriculumMaterial, /keyLabel\.label/);
  assert.match(curriculumMaterial, /keyLabel\.separator/);
  assert.match(curriculumMaterial, /keyLabel\.remainder/);
  assert.match(polish, /strong\[data-key-term-label\]/);
  assert.match(polish, /text-decoration-thickness:\s*1px/);
  assert.match(polish, /text-underline-offset:/);

  const authoredFormatter = workspace.match(/function KeyTakeawayText[\s\S]*?\n}\n\nfunction searchableLessonText/)?.[0] ?? "";
  assert.doesNotMatch(authoredFormatter, /\.trim\(|\.replace\(|\.slice\(/);

  const sample = "Escalating Conflict: The conflict gets harder as the story progresses.";
  const match = sample.match(/^([^:\n]{1,96}:)(\s+)([\s\S]+)$/);
  assert.ok(match);
  assert.equal(`${match[1]}${match[2]}${match[3]}`, sample);

  assert.match(foundations, /Escalating Conflict:/);
  assert.match(foundations, /Conflict:/);

  assert.match(polish, /data-lesson-block="teaching"/);
  assert.match(polish, /data-lesson-block="objectives"/);
  assert.match(polish, /data-lesson-block="definitions"/);
  assert.match(polish, /data-lesson-block="example"/);
  assert.match(polish, /data-lesson-block="checklist"/);
  assert.match(polish, /data-lesson-block="mistakes"/);
  assert.match(polish, /data-lesson-block="exercise"/);
});
