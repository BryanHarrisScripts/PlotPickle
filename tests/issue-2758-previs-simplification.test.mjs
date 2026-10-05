import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("#2758 makes normal Previs a read-and-play surface over Storyboard-owned Shots", async () => {
  const workspace = await read("app/_components/previs/previs-readiness-workspace.tsx");

  assert.match(workspace, /Previs · 25 planned Shots → Flip Book \/ Graphic Novel/u);
  assert.match(workspace, /Previs presents the visual story already approved in Storyboard/u);
  assert.match(workspace, /Storyboard owns the 25 planned Shots and their locked Storyboard Images/u);
  assert.match(workspace, /Previs reads and presents those approved choices/u);

  assert.doesNotMatch(workspace, /Add creative shot|Save creative shot|Creative shots<\/dt>|Previs timing<\/dt>/u);
  assert.doesNotMatch(workspace, /Shot size<input|Blocking intent|Performance energy|Pacing \/ rhythm intent|Rough motion evidence refs/u);
  assert.doesNotMatch(workspace, /applyStoryCommand|previs\.shot\.store/u);
});

test("#2758 preserves exact Shot 01-25 identity through Flip Book and Graphic Novel", async () => {
  const workspace = await read("app/_components/previs/previs-readiness-workspace.tsx");

  assert.match(workspace, /Array\.from\(\{ length: 25 \}/u);
  assert.match(workspace, /acceptedVisualIds\.has\(artifact\.id\) && artifact\.reviewState === "accepted"/u);
  assert.match(workspace, /Shot \{String\(selectedFramePosition\)\.padStart\(2, "0"\)\} of 25/u);
  assert.match(workspace, /Locked Storyboard Images are authoritative Previs inputs/u);
  assert.match(workspace, /shotLabel: `Shot \$\{String\(position\)\.padStart\(2, "0"\)\} of 25`/u);
  assert.match(workspace, /Play Flip Book/u);
  assert.match(workspace, /Play with Narration/u);
});

test("#2758 routes visual correction upstream and shows canonical planning math", async () => {
  const workspace = await read("app/_components/previs/previs-readiness-workspace.tsx");

  assert.match(workspace, /Open owning Storyboard Mini-Block/u);
  assert.match(workspace, /If a Storyboard Image is wrong or missing, correct and lock it in Storyboard/u);
  assert.match(workspace, /availableStoryboardImageCount\}\/25 Storyboard Images available · \{lockedFrameCount\}\/25 locked \/ approved/u);
  assert.match(workspace, /1 Mini-Block = 25 planned Shots = approximately 75 seconds = approximately 1,800 final video frames at 24 fps/u);
  assert.doesNotMatch(workspace, /Previs → Render Plan|Creative timing flows onto a fixed generation grid/u);
});
