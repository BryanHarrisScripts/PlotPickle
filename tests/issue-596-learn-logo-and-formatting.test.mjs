import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFile(resolve(root, path), "utf8");

test("LEARN logo is image-only and Foundations formatting preserves curriculum rendering", async () => {
  const [layout, polish, workspace] = await Promise.all([
    read("app/layout.tsx"),
    read("app/learn-foundations-polish.css"),
    read("modules/learn/ui/learn-workspace.tsx"),
  ]);

  assert.match(layout, /learn-foundations-polish\.css/);
  assert.doesNotMatch(layout, /LEARN_BRAND_GLYPH_STYLES/);

  assert.match(polish, /img\[alt="PlotPickle"\]/);
  assert.match(polish, /border:\s*0\s*!important/);
  assert.match(polish, /background:\s*transparent\s*!important/);
  assert.match(polish, /clip-path:\s*none\s*!important/);
  assert.match(polish, /filter:\s*none\s*!important/);
  assert.match(polish, /left:\s*18px\s*!important/);

  assert.match(workspace, /activeLesson\.sections\.slice\(0, integratedContentIndex\)\.map/);
  assert.match(workspace, /activeLesson\.sources\.map/);
  assert.match(workspace, /activeLesson\.definitions\.map/);
  assert.match(workspace, /activeLesson\.checklist\.map/);
  assert.match(workspace, /activeLesson\.mistakes\.map/);
  assert.match(workspace, /activeLesson\.exercise/);
  assert.match(workspace, /activeLesson\.apply/);

  assert.match(polish, /data-lesson-block="teaching"/);
  assert.match(polish, /data-lesson-block="objectives"/);
  assert.match(polish, /data-lesson-block="definitions"/);
  assert.match(polish, /data-lesson-block="example"/);
  assert.match(polish, /data-lesson-block="checklist"/);
  assert.match(polish, /data-lesson-block="mistakes"/);
  assert.match(polish, /data-lesson-block="exercise"/);
});
