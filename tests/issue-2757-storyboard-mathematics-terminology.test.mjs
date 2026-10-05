import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("#2757 Storyboard presents one fixed 25 planned-Shot model", async () => {
  const [workspace, model] = await Promise.all([
    read("app/_components/storyboard/storyboard-readiness-workspace.tsx"),
    read("app/_components/storyboard/storyboard-editorial-model.ts"),
  ]);

  assert.match(workspace, /Act → Sequence → Block → Mini-Block → 25 planned Shots/u);
  assert.match(workspace, /Mini-Block \{selectedNumber\}\.\{selectedMiniBlockNumber\} · 75-second planning target · 25 planned Shots · ~3 seconds per Shot · ~1,800 final video frames at 24 fps/u);
  assert.match(workspace, /<strong>25 Planned Shots<\/strong>/u);
  assert.match(workspace, /Shot \{String\(position\)\.padStart\(2, "0"\)\} of 25/u);
  assert.match(workspace, /Storyboard Image versions for Shot/u);
  assert.match(workspace, /Story evidence · Planned Shot · Storyboard Image/u);
  assert.doesNotMatch(workspace, /Shot \/ Frame capacity|no fixed Shot quota|25 available Shot \/ Frame positions/u);

  assert.match(model, /planned Shot \$\{String\(input\.position\)\.padStart\(2, "0"\)\} of 25/u);
  assert.match(model, /Shot-specific screenplay evidence/u);
  assert.match(model, /Create one WebP Storyboard Image candidate for this planned Shot only/u);
});

test("#2757 keeps Scene and Beat variable-density evidence without changing Shot count", async () => {
  const workspace = await read("app/_components/storyboard/storyboard-readiness-workspace.tsx");
  assert.match(workspace, /Scene and Beat as variable-density story evidence/u);
  assert.match(workspace, /Scene and Beat remain variable-density story evidence/u);
  assert.match(workspace, /they never change the fixed Shot 01–25 count/u);
});

test("#2757 makes the cross-surface mathematics canonical", async () => {
  const [math, settings, skill] = await Promise.all([
    read("docs/architecture/PLOTPICKLE-MATHEMATICAL-MODEL.md"),
    read("app/_components/settings/system-mathematics-card.tsx"),
    read(".agents/skills/storyboard-frame-director/SKILL.md"),
  ]);

  for (const phrase of [
    "25 planned Storyboard Shots per Mini-Block",
    "2,400 planned Shots for the two-hour target feature",
    "172,800 final rendered video frames",
    "A `Storyboard Image` is the selected or locked still image representing one planned Shot",
  ]) assert.ok(math.includes(phrase), `Missing canonical mathematics phrase: ${phrase}`);

  assert.match(settings, /25 shots per Mini-Block, approximately 3 seconds per shot, and 24 final video frames per second/u);
  assert.match(settings, /2,400 storyboard Shots become 172,800 actual video frames/u);
  assert.match(skill, /25 planned Shots are the canonical Storyboard planning grid/u);
  assert.match(skill, /Scene and Beat remain variable-density evidence and do not change that Shot count/u);
});
