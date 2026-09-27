import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function section(source, from, to) {
  const start = source.indexOf(from);
  const end = source.indexOf(to, start + from.length);
  assert.ok(start >= 0 && end > start, `Missing section ${from}`);
  return source.slice(start, end);
}

test("#2521 live surface headers remain owned by the currently open dashboard surface", async () => {
  const host = await read("app/skin-v1/dashboard-bbs-review-host.tsx");
  assert.match(host, /if \(storyboardOpen\) onSurfaceNameChange\("STORYBOARD"\)/u);
  assert.match(host, /if \(previsOpen\) onSurfaceNameChange\("PREVIS"\)/u);
  assert.match(host, /if \(timelineOpen\) onSurfaceNameChange\("TIMELINE"\)/u);
  assert.match(host, /if \(productionOpen\) onSurfaceNameChange\("ROUGH CUT"\)/u);
  assert.match(host, /soundOpen === "narration" \? "NARRATION" : soundOpen === "music" \? "MUSIC" : "FOLEY"/u);
  assert.match(host, /if \(screeningOpen\) onSurfaceNameChange\("SCREENING"\)/u);

  const previs = section(host, "if (previsOpen)", "if (timelineOpen)");
  assert.match(previs, /<h1>PREVIS<\/h1>/u);
  assert.doesNotMatch(previs, /reviewBadge[^\n]*IN REVIEW|>IN REVIEW</u);
});

test("#2521 shared Story navigation preserves surface identity and reuses Outline readiness evidence", async () => {
  const [map, surfaces] = await Promise.all([
    read("modules/build/ui/progressive-story-map.tsx"),
    read("app/skin-v1/preproduction-review-surfaces.tsx"),
  ]);
  assert.match(map, /surfaceLabel === "Outline" \? "The story is the navigation\." : surfaceLabel/u);
  assert.match(surfaces, /deriveOutlineReadiness/u);
  assert.match(surfaces, /outlineReadiness=\{outlineReadiness\}/u);
  for (const label of ["Storyboard", "Previs", "Timeline", "Rough Cut", "Foley", "Narration", "Music", "Screening"]) {
    assert.ok(map.includes(`"${label}"`), `Missing shared navigation label ${label}`);
  }
});

test("#2521 Storyboard and Previs propagate Mini-Block selection without timer-delayed hierarchy updates", async () => {
  const [storyboard, previs] = await Promise.all([
    read("app/_components/storyboard/storyboard-readiness-workspace.tsx"),
    read("app/_components/previs/previs-readiness-workspace.tsx"),
  ]);
  assert.doesNotMatch(storyboard, /const timer = window\.setTimeout\(\(\) => \{[\s\S]*?setSelectedBlockNumber\(boundedBlockNumber\(initialBlockNumber\)\)/u);
  assert.match(storyboard, /onClick=\{\(\) => selectStoryboardAddress\(selectedNumber, miniNumber\)\}/u);
  assert.match(storyboard, /onAddressChange\?\.\(\{ blockNumber: block, miniBlockNumber: mini \}\)/u);

  assert.doesNotMatch(previs, /const timer = window\.setTimeout\(\(\) => \{[\s\S]*?setSelectedBlockNumber\(address\.blockNumber\)/u);
  assert.match(previs, /aria-pressed=\{selectedMiniBlockNumber === anchor\.miniBlockNumber\}/u);
  assert.match(previs, /onAddressChange\?\.\(\{ blockNumber: selectedBlock\.blockNumber, miniBlockNumber: anchor\.miniBlockNumber \}\)/u);
});

test("#2521 Previs first paint owns the loaded project without a second mount-time hydration", async () => {
  const surfaces = await read("app/skin-v1/preproduction-review-surfaces.tsx");
  const previs = section(surfaces, "export function SkinV1PrevisCompositeSurface", "export function SkinV1TimelineReviewSurface");
  assert.match(previs, /useState<LibraryPPFProject \| null>\(\(\) => \{[\s\S]*?return loadFoundationProject\(\)/u);
  assert.doesNotMatch(previs, /const sync = \(\) => \{[\s\S]*?\};[\s\S]*?sync\(\);[\s\S]*?window\.addEventListener/u);
  assert.doesNotMatch(previs, /window\.setTimeout/u);
});

test("#2521 Graphic Novel live preview recovers the speaker cue immediately before observed dialogue", async () => {
  const presentation = await read("app/_components/previs/previs-graphic-novel-presentation.ts");
  assert.match(presentation, /for \(let index = 0; index < passages\.length; index \+= 1\)/u);
  assert.match(presentation, /for \(let previousIndex = index - 1; previousIndex >= 0; previousIndex -= 1\)/u);
  assert.match(presentation, /previousType === "character"/u);
  assert.match(presentation, /speakerName\(previous\.text\)/u);
  assert.match(presentation, /evidenceIds\.has\(passage\.id\)/u);
});

test("#2521 WebP export is a local presentation derivative and no longer depends on a second route auth runtime", async () => {
  const [workspace, browserExport] = await Promise.all([
    read("app/_components/previs/previs-readiness-workspace.tsx"),
    read("app/_components/previs/previs-graphic-novel-browser-export.ts"),
  ]);
  assert.match(workspace, /buildBrowserGraphicNovelWebp/u);
  assert.doesNotMatch(workspace, /authenticatedProfileFetch/u);
  assert.doesNotMatch(workspace, /\/api\/previs\/graphic-novel\/export/u);
  assert.match(browserExport, /assetUrl\.startsWith\("\/api\/local-ai\/assets\/"\)/u);
  assert.match(browserExport, /credentials: "same-origin"/u);
  assert.match(browserExport, /canvas\.toBlob/u);
  assert.match(browserExport, /"image\/webp", 0\.86/u);
  assert.match(browserExport, /panel\.bubbles\.slice\(0, 2\)/u);
});
