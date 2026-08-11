import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(path, "utf8");

test("PlotPickle Studio exposes Learn as its only visible main workspace", async () => {
  const [page, header] = await Promise.all([read("app/page.tsx"), read("app/application-shell-header.tsx")]);
  assert.match(page, /useState<MainTab>\("learn"\)/);
  assert.match(page, /useState\(false\)/);
  assert.match(header, /const studioLearn/);
  assert.match(header, /81-module visual writing curriculum/);
  assert.doesNotMatch(header, /discovery\.map/);
  assert.doesNotMatch(header, /production\.map/);
});

test("the first Learn screen has curriculum, canvas and persistent guide columns", async () => {
  const [studio, shell, css] = await Promise.all([
    read("app/learning-studio.tsx"),
    read("app/learn-three-column-shell.tsx"),
    read("app/learn-three-column-shell.module.css"),
  ]);
  assert.match(studio, /Welcome to Learn/);
  assert.match(studio, /Learning Paths/);
  assert.match(studio, /Quick Lessons/);
  assert.match(shell, /PlotPickle curriculum/);
  assert.match(shell, /Ask the PlotPickle Curriculum Guide/);
  assert.match(css, /18%\) minmax\(0, 58%\) minmax\(280px, 24%\)/);
});
