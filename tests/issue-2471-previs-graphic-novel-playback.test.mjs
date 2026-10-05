import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("#2471 slows Flip Book playback and adds mutually exclusive Graphic Novel playback", async () => {
  const [workspace, model] = await Promise.all([
    read("app/_components/previs/previs-readiness-workspace.tsx"),
    read("app/_components/previs/previs-graphic-novel-presentation.ts"),
  ]);

  assert.match(model, /PREVIS_FLIP_BOOK_INTERVAL_MS = 900/u);
  assert.match(model, /PREVIS_GRAPHIC_NOVEL_INTERVAL_MS = 3000/u);
  assert.match(workspace, /PREVIS_FLIP_BOOK_INTERVAL_MS/u);
  assert.match(workspace, /PREVIS_GRAPHIC_NOVEL_INTERVAL_MS/u);
  assert.ok(!workspace.includes("}, 220)"));
  assert.match(workspace, /Play Flip Book/u);
  assert.match(workspace, /Play with Narration/u);
  assert.match(workspace, /setGraphicNovelPlaying\(false\)/u);
  assert.match(workspace, /setFlipBookPlaying\(false\)/u);
});

test("#2471 derives Graphic Novel narration without provider or canon mutation", async () => {
  const [workspace, model] = await Promise.all([
    read("app/_components/previs/previs-readiness-workspace.tsx"),
    read("app/_components/previs/previs-graphic-novel-presentation.ts"),
  ]);

  assert.match(model, /narrativeIntention \|\| beatDirection \|\| shotContext/u);
  assert.match(model, /excluded from the authoritative Graphic Novel/u);
  assert.match(workspace, /storyboardPositionProgression/u);
  assert.doesNotMatch(workspace, />Review Text</u);
  assert.doesNotMatch(model, /fetch\(|OpenAI|Ollama|provider|applyStoryCommand|saveFoundationProject/u);
  assert.doesNotMatch(model, /acceptedVisualArtifactIds.*=/u);
});

test("#2763 removes Previs export controls while retaining local compatibility renderer", async () => {
 const workspace = await read("app/_components/previs/previs-readiness-workspace.tsx");
 assert.doesNotMatch(workspace, />Create WebP<|async function exportGraphicNovel/u);
 assert.match(workspace, /lockedGraphicNovelPanels/u);
});

test("#2471 keeps the Graphic Novel inside the canonical 25 planned-Shot Previs authority", async () => {
  const [workspace, css] = await Promise.all([
    read("app/_components/previs/previs-readiness-workspace.tsx"),
    read("app/_components/previs/previs-readiness-workspace.module.css"),
  ]);

  assert.match(workspace, /data-previs-flipbook="25-positions"/u);
  assert.match(workspace, /acceptedVisualIds\.has\(artifact\.id\) && artifact\.reviewState === "accepted"/u);
  assert.match(workspace, /Locked Storyboard Images are authoritative Previs inputs/u);
  assert.match(css, /\.graphicNovelCaption/u);
  assert.match(css, /\.flipBookControls/u);
});
