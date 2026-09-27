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

test("#2523 downstream dashboard surfaces keep exactly one shared story-address owner", async () => {
  const host = await read("app/skin-v1/dashboard-bbs-review-host.tsx");
  const timeline = section(host, "if (timelineOpen)", "if (productionOpen)");
  const roughCut = section(host, "if (productionOpen)", "if (openSourceOpen)");
  const sound = section(host, "if (soundOpen)", "if (screeningOpen)");
  const screening = section(host, "if (screeningOpen)", "if (discoveryOpen)");

  for (const source of [timeline, roughCut, sound, screening]) {
    assert.match(source, /<StoryActRail activeAct=/u);
    assert.match(source, /<SkinV1StoryboardStoryMap/u);
    assert.match(source, /Back to Dashboard/u);
  }
  assert.doesNotMatch(timeline, /<SkinV1TimelineReviewSurface[\s\S]*?onAddressChange=/u);
  assert.doesNotMatch(roughCut, /<SkinV1ProductionReviewSurface[\s\S]*?onAddressChange=/u);
  assert.doesNotMatch(sound, /<SkinV1SoundReviewSurface[\s\S]*?onAddressChange=/u);
});

test("#2523 Timeline Rough Cut Sound and Screening render their current project on first paint", async () => {
  const surfaces = await read("app/skin-v1/preproduction-review-surfaces.tsx");
  const storyMap = section(surfaces, "export function SkinV1StoryboardStoryMap", "export function SkinV1PrevisCompositeSurface");
  const timeline = section(surfaces, "export function SkinV1TimelineReviewSurface", "export function SkinV1ProductionReviewSurface");
  const roughCut = section(surfaces, "export function SkinV1ProductionReviewSurface", "export function SkinV1SoundReviewSurface");
  const sound = section(surfaces, "export function SkinV1SoundReviewSurface", "export function SkinV1ScreeningReviewSurface");
  const screening = section(surfaces, "export function SkinV1ScreeningReviewSurface", "export function SkinV1BuildReviewSurface");

  for (const source of [storyMap, timeline, roughCut, sound, screening]) {
    assert.match(source, /\(\(\) => loadFoundationProject\(\)\)/u);
    assert.match(source, /window\.addEventListener\(FOUNDATION_PROJECT_SAVED_EVENT, sync\)/u);
    assert.match(source, /window\.removeEventListener\(FOUNDATION_PROJECT_SAVED_EVENT, sync\)/u);
    assert.doesNotMatch(source, /\n\s*sync\(\);\n/u);
  }
});

test("#2523 duplicate inner Mini-Block rails are absent", async () => {
  const surfaces = await read("app/skin-v1/preproduction-review-surfaces.tsx");
  const timeline = section(surfaces, "export function SkinV1TimelineReviewSurface", "export function SkinV1ProductionReviewSurface");
  const roughCut = section(surfaces, "export function SkinV1ProductionReviewSurface", "export function SkinV1SoundReviewSurface");
  const sound = section(surfaces, "export function SkinV1SoundReviewSurface", "export function SkinV1ScreeningReviewSurface");

  assert.doesNotMatch(timeline, /pp-skin-v1-preproduction-address-rail|Timeline Mini-Block address/u);
  assert.doesNotMatch(roughCut, /pp-skin-v1-production-addresses|Rough Cut Mini-Block address/u);
  assert.doesNotMatch(sound, /pp-skin-v1-preproduction-address-rail|Mini-Block address/u);
});

test("#2523 downstream identity remains exact", async () => {
  const host = await read("app/skin-v1/dashboard-bbs-review-host.tsx");
  for (const label of ["TIMELINE", "ROUGH CUT", "FOLEY", "NARRATION", "MUSIC", "SCREENING"]) {
    assert.ok(host.includes(label), `Missing downstream header identity ${label}`);
  }
});
