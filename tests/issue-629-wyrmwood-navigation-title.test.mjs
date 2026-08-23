import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const relics = [
  "learn.webp",
  "plan.webp",
  "build.webp",
  "storyboard.webp",
  "graphic-novel.webp",
  "write.webp",
  "edit.webp",
  "feedback.webp",
  "refine.webp",
  "reports.webp",
  "game.webp",
];

test("Wyrmwood replaces legacy star placeholders and old logos with the current relic family", async () => {
  const workspace = await read("modules/wyrmwood/ui/wyrmwood-workspace.tsx");

  for (const relic of relics) {
    assert.match(workspace, new RegExp(`/assets/workflow-relics/${relic.replace(".", "\\.")}`));
  }
  assert.match(workspace, /className=\{styles\.navRelic\}/);
  assert.doesNotMatch(workspace, /className=\{styles\.navRune\}/);
  assert.doesNotMatch(workspace, />✦<\/span>/);
  assert.doesNotMatch(workspace, /plotpickle-ouroboros-v2-128\.png/);
  assert.match(workspace, /alt="Wyrmwood game emblem"[\s\S]*src="\/assets\/workflow-relics\/game\.webp"/);
});

test("WYRMWOOD is a real UI title while the approved game artwork remains wordless", async () => {
  const [entry, workspace] = await Promise.all([
    read("app/wyrmwood-plugin-entry.tsx"),
    read("modules/wyrmwood/ui/wyrmwood-workspace.tsx"),
  ]);

  assert.match(entry, /className=\{styles\.label\}>WYRMWOOD<\/span>/);
  assert.match(entry, /src="\/assets\/workflow-relics\/game\.webp"/);
  assert.match(workspace, /label: "Wyrmwood", detail: "Game"/);
  assert.match(workspace, /className=\{styles\.wyrmwoodTitle\}>WYRMWOOD<\/strong>/);
  assert.match(workspace, /PLAY · THE FOUNDATIONS TRIALS/);
  assert.doesNotMatch(workspace, /PLAY · WYRmWOOD/);
});

test("Wyrmwood current relics and emblem have no CSS backglow", async () => {
  const [workspaceCss, entryCss] = await Promise.all([
    read("modules/wyrmwood/ui/wyrmwood-workspace.module.css"),
    read("app/wyrmwood-plugin-entry.module.css"),
  ]);

  assert.match(workspaceCss, /\.navRelic\s*\{[\s\S]*filter:\s*saturate\(1\.08\) brightness\(1\.04\)/);
  assert.match(workspaceCss, /\.current img\s*\{[\s\S]*filter:\s*saturate\(1\.15\) brightness\(1\.14\)/);
  assert.match(workspaceCss, /\.wyrm img\s*\{[\s\S]*filter:\s*saturate\(1\.18\) brightness\(1\.1\)/);
  assert.doesNotMatch(workspaceCss, /drop-shadow/);
  assert.doesNotMatch(entryCss, /drop-shadow/);
});

test("focused Wyrmwood UAT owns PR 629", async () => {
  const registry = JSON.parse(await read("config/uat-autopilot-registry.json"));
  const wyrmwood = registry.areas.find((area) => area.id === "wyrmwood");
  assert.ok(wyrmwood?.tests.includes("tests/issue-629-wyrmwood-navigation-title.test.mjs"));
});
