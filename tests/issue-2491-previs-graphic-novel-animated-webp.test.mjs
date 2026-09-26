import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relative) => readFile(new URL("../" + relative, import.meta.url), "utf8");

async function sharpRuntime(context) {
  try {
    return (await import("sharp")).default;
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ERR_MODULE_NOT_FOUND" && String(error.message || "").includes("sharp")) {
      context.skip("Sharp is not installed in the lightweight architecture-test image; installed media-runtime verification executes this capability proof.");
      return null;
    }
    throw error;
  }
}

test("#2491 removes Human-facing HTML export and exposes one Animated WebP action", async () => {
  const [workspace, presentation, route, encoder] = await Promise.all([
    read("app/_components/previs/previs-readiness-workspace.tsx"),
    read("app/_components/previs/previs-graphic-novel-presentation.ts"),
    read("app/api/previs/graphic-novel/export/route.ts"),
    read("build/previs-graphic-novel-webp.ts"),
  ]);

  assert.match(workspace, />Export Animated WebP</u);
  assert.match(workspace, /authenticatedProfileFetch\("\/api\/previs\/graphic-novel\/export"/u);
  assert.match(workspace, /graphicNovelPanels\.filter\(\(panel\) => panel\.authoritative && panel\.assetUrl\)/u);
  assert.doesNotMatch(workspace, /buildPrevisGraphicNovelExportHtml|text\/html|>Export Graphic Novel</u);
  assert.doesNotMatch(presentation, /<!doctype html>|buildPrevisGraphicNovelExportHtml|\.html`/u);
  assert.match(presentation, /PREVIS_GRAPHIC_NOVEL_INTERVAL_MS = 3000/u);
  assert.match(presentation, /\.webp`/u);
  assert.match(route, /authorizeRequest\(requestBoundary\(request\), \{ mutation: true \}\)/u);
  assert.match(route, /PREVIS_GRAPHIC_NOVEL_INTERVAL_MS/u);
  assert.match(route, /"Content-Type": "image\/webp"/u);
  assert.match(route, /"Cache-Control": "no-store"/u);
  assert.match(route, /"Referrer-Policy": "no-referrer"/u);
  assert.doesNotMatch(workspace, /format picker|Export HTML|Save as HTML/u);
  assert.match(encoder, /PREVIS_GRAPHIC_NOVEL_MAX_PANELS = 25/u);
  assert.match(encoder, /join: \{ animated: true \}/u);
  assert.match(encoder, /loop: 0, delay: frames\.map\(\(\) => delayMs\)/u);
  assert.match(encoder, /value\.startsWith\(ASSET_PATH\)/u);
  assert.match(encoder, /panel\.authoritative !== true/u);
  assert.match(encoder, /\.sort\(\(left, right\) => left\.position - right\.position\)/u);
  assert.match(encoder, /Graphic Novel export received an unsafe local asset path/u);
  assert.match(encoder, /PNG, JPEG or WebP source images only/u);
  assert.match(encoder, /dimensions exceed the bounded export limit/u);
  assert.doesNotMatch(encoder, /\bfetch\s*\(/u);
});

test("#2491 Sharp runtime supports ordered looping Animated WebP metadata", async (context) => {
  const sharp = await sharpRuntime(context);
  if (!sharp) return;

  const first = await sharp({ create: { width: 320, height: 180, channels: 3, background: "#1a8f4a" } }).png().toBuffer();
  const second = await sharp({ create: { width: 320, height: 180, channels: 3, background: "#8f241a" } }).png().toBuffer();
  const animated = await sharp([{ input: first }, { input: second }], { join: { animated: true } })
    .webp({ quality: 86, loop: 0, delay: [3000, 3000] })
    .toBuffer();

  const metadata = await sharp(animated, { animated: true }).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.pages, 2);
  assert.deepEqual(metadata.delay, [3000, 3000]);
  assert.equal(metadata.loop, 0);

  const firstPage = await sharp(animated, { page: 0 }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const pixel = [...firstPage.data.subarray(0, 3)];
  assert.ok(pixel[1] > pixel[0], "the first supplied frame remains the first animation page");
});

test("#2491 Sharp runtime keeps a one-frame WebP valid", async (context) => {
  const sharp = await sharpRuntime(context);
  if (!sharp) return;

  const source = await sharp({ create: { width: 320, height: 180, channels: 3, background: "#315b46" } }).png().toBuffer();
  const output = await sharp(source).webp({ quality: 86 }).toBuffer();
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.format, "webp");
  assert.equal(metadata.width, 320);
  assert.equal(metadata.height, 180);
});
