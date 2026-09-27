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

test("#2507 keeps the legacy server endpoint authenticated while the live presentation-only export stays in the local browser", async () => {
  const [route, workspace, browserExport] = await Promise.all([
    read("app/api/previs/graphic-novel/export/route.ts"),
    read("app/_components/previs/previs-readiness-workspace.tsx"),
    read("app/_components/previs/previs-graphic-novel-browser-export.ts"),
  ]);
  assert.match(route, /authorizeRequest\(requestBoundary\(request\), \{ mutation: true \}\)/u);
  assert.match(route, /publicAuthorizationError/u);
  assert.match(workspace, /buildBrowserGraphicNovelWebp/u);
  assert.doesNotMatch(workspace, /authenticatedProfileFetch\("\/api\/previs\/graphic-novel\/export"/u);
  assert.match(browserExport, /assetUrl\.startsWith\("\/api\/local-ai\/assets\/"\)/u);
  assert.match(browserExport, /fetch\(assetUrl, \{ credentials: "same-origin"/u);
  assert.match(browserExport, /canvas\.toBlob/u);
  assert.match(browserExport, /"image\/webp"/u);
});

test("#2507 presents WebP export progress, visible success filename and visible failure next to playback controls", async () => {
  const [workspace, css] = await Promise.all([
    read("app/_components/previs/previs-readiness-workspace.tsx"),
    read("app/_components/previs/previs-readiness-workspace.module.css"),
  ]);
  assert.match(workspace, /graphicNovelExportState/u);
  assert.match(workspace, /graphicNovelExportMessage/u);
  assert.match(workspace, /Exporting WebP…/u);
  assert.match(workspace, /WebP exported successfully as one static Graphic Novel sheet/u);
  assert.match(workspace, /anchor\.download/u);
  assert.match(workspace, /WebP export failed:/u);
  assert.match(workspace, /className=\{styles\.exportStatus\}/u);
  assert.match(workspace, /role=\{graphicNovelExportState === "error" \? "alert" : "status"\}/u);
  assert.match(css, /\.exportStatus\[data-export-state="success"\]/u);
  assert.match(css, /\.exportStatus\[data-export-state="error"\]/u);
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
