import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  storyboardFramePrompt,
  storyboardPositionProgression,
} from "../app/_components/storyboard/storyboard-editorial-model.ts";

function promptFor(position) {
  return storyboardFramePrompt({
    title: "Afterglow",
    blockNumber: 1,
    miniBlockNumber: 2,
    position,
    scene: "Mara waits beside the motel walkway — she is deciding whether to leave.",
    beat: "Mara notices the car has returned and her attention shifts toward the parking lot.",
    shot: "",
    previousShot: position > 1 ? "Medium-wide from the walkway, Mara frame left, parking lot frame right." : "",
    nextShot: position < 25 ? "Tighter coverage preserving left-to-right screen direction." : "",
    source: "Mara looks toward the parking lot. The same sedan turns in and slows near the office.",
  });
}

test("#2414 gives every Storyboard position a distinct visual progression function", () => {
  const prompts = Array.from({ length: 25 }, (_, index) => promptFor(index + 1));
  assert.equal(new Set(prompts).size, 25);
  for (let position = 1; position <= 25; position += 1) {
    const progression = storyboardPositionProgression(position);
    const prompt = prompts[position - 1];
    assert.match(prompt, new RegExp(`Storyboard Position ${String(position).padStart(2, "0")}`));
    assert.match(prompt, new RegExp(`Visual progression function: ${progression.label.replace(/[.*+?^${}()|[\\]\\]/g, "\\progression.label.replace(/[.*+?^$()|[\\]\\]/g, "\\$&")")}`));
    assert.match(prompt, /not a Beat assignment/u);
  }
});

test("#2414 establishes explicit entry and exit boundaries without inventing Beat ownership", () => {
  const first = promptFor(1);
  const last = promptFor(25);
  assert.match(first, /Entry boundary/u);
  assert.match(first, /Mini-Block starting state/u);
  assert.match(last, /Exit boundary/u);
  assert.match(last, /Mini-Block ending state/u);
  assert.doesNotMatch(first, /Beat 1/u);
  assert.doesNotMatch(last, /Beat 25/u);
});

test("#2414 produces one clean standalone frame rather than a storyboard grid", () => {
  const prompt = promptFor(12);
  assert.match(prompt, /one clean black-and-white storyboard illustration/u);
  assert.match(prompt, /No collage, contact sheet, storyboard grid, split screen, multiple panels/u);
  assert.match(prompt, /camera position, height, distance, viewing direction and shot size/u);
  assert.match(prompt, /preserve established character identity/u);
});

test("#2414 wires Quillan to Sequence Director and Storyboard Frame Director skills", async () => {
  const profiles = JSON.parse(await readFile(new URL("../config/agent-profiles.json", import.meta.url), "utf8"));
  const quillan = profiles.profiles.find((profile) => profile.id === "quillan-reedcloak");
  assert.ok(quillan);
  assert.deepEqual(quillan.skillUris, [
    "skill://plotpickle/sequence-director",
    "skill://plotpickle/storyboard-frame-director",
  ]);

  const skill = await readFile(new URL("../.agents/skills/storyboard-frame-director/SKILL.md", import.meta.url), "utf8");
  assert.match(skill, /25 positions are visual Shot \/ Frame capacity/u);
  assert.match(skill, /Do not send a 25-frame grid\/contact sheet/u);
  assert.match(skill, /one clean standalone image per position/u);
});
