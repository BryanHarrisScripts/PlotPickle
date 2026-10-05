import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2507 desktop Human profile mutations accept equivalent loopback browser origins", async () => {
  const runtime = await read("core/auth/profile-experience/profile-experience-runtime.ts");
  assert.match(runtime, /function equivalentDesktopLoopbackOrigins\(origin: URL\)/u);
  assert.match(runtime, /127\.0\.0\.1/u);
  assert.match(runtime, /localhost/u);
  assert.match(runtime, /\[::1\]/u);
  assert.match(runtime, /allowedOrigins: loopbackOrigins/u);
  assert.match(runtime, /allowedHosts: loopbackOrigins\.map\(\(origin\) => new URL\(origin\)\.host\)/u);
  assert.match(runtime, /parsed\.protocol.*loopback/u);
});

test("#2763 keeps the legacy server endpoint authenticated while removing Previs export controls", async () => {
  const [route, workspace] = await Promise.all([
    read("app/api/previs/graphic-novel/export/route.ts"),
    read("app/_components/previs/previs-readiness-workspace.tsx"),
  ]);
  assert.match(route, /authorizeRequest\(requestBoundary\(request\), \{ mutation: true \}\)/u);
  assert.match(route, /publicAuthorizationError/u);
  assert.match(workspace, /buildBrowserGraphicNovelWebp/u);
  assert.doesNotMatch(workspace, />Create WebP<|async function exportGraphicNovel/u);
  assert.doesNotMatch(workspace, /authenticatedProfileFetch\("\/api\/previs\/graphic-novel\/export"/u);
  assert.match(workspace, /assetUrl\.startsWith\("\/api\/local-ai\/assets\/"\)/u);
  assert.match(workspace, /fetch\(assetUrl, \{ credentials: "same-origin"/u);
  assert.match(workspace, /canvas\.toBlob/u);
  assert.match(workspace, /"image\/webp"/u);
});

test("#2763 reports narration generation status beside the playback controls", async () => {
  const workspace = await read("app/_components/previs/previs-readiness-workspace.tsx");
  assert.match(workspace, /Creating story narration for the locked image sequence/u);
  assert.match(workspace, /Story narration saved\. Playing locked images with text/u);
  assert.match(workspace, /className=\{styles\.message\} role="status"/u);
  assert.doesNotMatch(workspace, /graphicNovelExportState|graphicNovelExportMessage/u);
});

test("#2507 export remains locked-frame-only static WebP with Graphic Novel bubbles", async () => {
  const [workspace, encoder, presentation] = await Promise.all([
    read("app/_components/previs/previs-readiness-workspace.tsx"),
    read("build/previs-graphic-novel-webp.ts"),
    read("app/_components/previs/previs-graphic-novel-presentation.ts"),
  ]);
  assert.match(workspace, /graphicNovelPanels\.filter\(\(panel\) => panel\.authoritative && panel\.assetUrl\)/u);
  assert.match(encoder, /\.sort\(\(left, right\) => left\.position - right\.position\)/u);
  assert.match(encoder, /speechBubbleSvg/u);
  assert.match(encoder, /\.webp\(\{ quality: 86 \}\)/u);
  assert.match(presentation, /graphicNovelSpeechBubbles/u);
  assert.doesNotMatch(workspace, /Export Animated WebP|Export HTML/u);
});
