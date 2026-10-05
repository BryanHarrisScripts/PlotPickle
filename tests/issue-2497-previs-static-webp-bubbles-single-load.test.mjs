import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

test("#2763 removes the Previs WebP action but retains the legacy static renderer", async () => {
  const [workspace, route, encoder] = await Promise.all([
    read("app/_components/previs/previs-readiness-workspace.tsx"),
    read("app/api/previs/graphic-novel/export/route.ts"),
    read("build/previs-graphic-novel-webp.ts"),
  ]);

  assert.doesNotMatch(workspace, />Create WebP|Export HTML|Export Animated WebP</u);
  assert.match(workspace, /Play with Narration/u);
  assert.doesNotMatch(workspace, /Export Animated WebP|Export HTML/u);
  assert.match(workspace, /buildBrowserGraphicNovelWebp/u);
  assert.match(route, /"Content-Type": "image\/webp"/u);
  assert.doesNotMatch(route, /PREVIS_GRAPHIC_NOVEL_INTERVAL_MS|delayMs|Animated WebP/u);
  assert.match(encoder, /PREVIS_GRAPHIC_NOVEL_COLUMNS = 2/u);
  assert.match(encoder, /const rows = Math\.ceil\(prepared\.length \/ PREVIS_GRAPHIC_NOVEL_COLUMNS\)/u);
  assert.match(encoder, /\.sort\(\(left, right\) => left\.position - right\.position\)/u);
  assert.match(encoder, /\.webp\(\{ quality: 86 \}\)/u);
  assert.doesNotMatch(encoder, /join: \{ animated: true \}|loop: 0|delay:/u);
});

test("#2497 derives speech bubbles from observed screenplay character and dialogue passages only", async () => {
  const [presentation, workspace, encoder, styles, editorial] = await Promise.all([
    read("app/_components/previs/previs-graphic-novel-presentation.ts"),
    read("app/_components/previs/previs-readiness-workspace.tsx"),
    read("build/previs-graphic-novel-webp.ts"),
    read("app/_components/previs/previs-readiness-workspace.module.css"),
    read("app/_components/storyboard/storyboard-editorial-model.ts"),
  ]);

  assert.match(editorial, /export const storyboardPassageWindowForPosition = passageWindow/u);
  assert.match(presentation, /storyboardPassageWindowForPosition\(passages, position\)/u);
  assert.match(presentation, /previousType === "character"/u);
  assert.match(presentation, /type !== "dialogue" && type !== "dual-dialogue"/u);
  assert.match(presentation, /if \(speaker && text\) bubbles\.push/u);
  assert.match(presentation, /bubbles\.length >= 2/u);
  assert.match(presentation, /speakerName\(previous\.text\)/u);
  assert.doesNotMatch(presentation, /OpenAI|Ollama|fetch\(/u);

  assert.match(workspace, /className=\{styles\.graphicNovelBubbles\}/u);
  assert.match(workspace, /className=\{styles\.graphicNovelBubble\}/u);
  assert.match(workspace, /bubble\.speaker/u);
  assert.match(workspace, /bubble\.text/u);
  assert.match(styles, /\.graphicNovelBubble::after/u);
  assert.match(encoder, /function speechBubbleSvg/u);
  assert.match(encoder, /data-graphic-novel-bubble="speech"/u);
  assert.match(encoder, /polygon points=/u);
});

test("#2497 single-load Previs shares one canonical project between Story Map and readiness", async () => {
  const [surfaces, dashboard] = await Promise.all([
    read("app/skin-v1/preproduction-review-surfaces.tsx"),
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
  ]);

  assert.match(surfaces, /export function SkinV1PrevisCompositeSurface/u);
  assert.doesNotMatch(surfaces, /export function SkinV1PrevisStoryMap/u);
  assert.doesNotMatch(surfaces, /export function SkinV1PrevisReviewSurface/u);

  const start = surfaces.indexOf("export function SkinV1PrevisCompositeSurface");
  const end = surfaces.indexOf("export function SkinV1TimelineReviewSurface", start);
  const composite = surfaces.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(composite, /useState<LibraryPPFProject \| null>\(\(\) => loadFoundationProject\(\)\)/u);
  assert.equal((composite.match(/FOUNDATION_PROJECT_SAVED_EVENT/gu) ?? []).length, 2);
  assert.doesNotMatch(composite, /setTimeout/u);
  assert.doesNotMatch(composite, /const sync = \(\) => \{[\s\S]*?\};[\s\S]*?sync\(\);[\s\S]*?window\.addEventListener/u);
  assert.doesNotMatch(composite, /Opening Previs Story Map|Opening canonical Previs projection/u);
  assert.match(composite, /<ProgressiveStoryMap/u);
  assert.match(composite, /<PrevisReadinessWorkspace/u);
  assert.match(composite, /project=\{project\}/u);

  assert.match(dashboard, /<SkinV1PrevisCompositeSurface/u);
  assert.doesNotMatch(dashboard, /<SkinV1PrevisStoryMap|<SkinV1PrevisReviewSurface/u);
});

test("#2497 preserves Graphic Novel presentation-only authority", async () => {
  const [workspace, presentation] = await Promise.all([
    read("app/_components/previs/previs-readiness-workspace.tsx"),
    read("app/_components/previs/previs-graphic-novel-presentation.ts"),
  ]);

  assert.match(workspace, /production: \{ \.\.\.project\.production, graphicNovelTextApprovals:/u);
  assert.doesNotMatch(workspace, /applyStoryCommand|acceptedVisualArtifactIds\s*=/u);
  assert.match(workspace, /graphicNovelPanels\.filter\(\(panel\) => panel\.authoritative && panel\.assetUrl\)/u);
  assert.match(presentation, /input\.authoritative \? graphicNovelSpeechBubbles/u);
  assert.doesNotMatch(presentation, /applyStoryCommand|saveFoundationProject|acceptedVisualArtifactIds.*=/u);
});
