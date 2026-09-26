import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import { PREVIS_GRAPHIC_NOVEL_INTERVAL_MS } from "../app/_components/previs/previs-graphic-novel-presentation.ts";
import { buildPrevisGraphicNovelWebp } from "../build/previs-graphic-novel-webp.ts";

const read = (relative) => readFile(new URL("../" + relative, import.meta.url), "utf8");

function panel(position, assetUrl, overrides = {}) {
  return {
    position,
    assetUrl,
    authoritative: true,
    caption: `Scene 1 · Position ${position}`,
    narration: `Narration for locked panel ${position}.`,
    shotLabel: `Shot ${String(position).padStart(2, "0")}`,
    shotContext: "Static wide",
    ...overrides,
  };
}

test("#2491 removes Human-facing HTML export and exposes one Animated WebP action", async () => {
  const [workspace, presentation, route] = await Promise.all([
    read("app/_components/previs/previs-readiness-workspace.tsx"),
    read("app/_components/previs/previs-graphic-novel-presentation.ts"),
    read("app/api/previs/graphic-novel/export/route.ts"),
  ]);

  assert.match(workspace, />Export Animated WebP</u);
  assert.match(workspace, /authenticatedProfileFetch\("\/api\/previs\/graphic-novel\/export"/u);
  assert.match(workspace, /graphicNovelPanels\.filter\(\(panel\) => panel\.authoritative && panel\.assetUrl\)/u);
  assert.doesNotMatch(workspace, /buildPrevisGraphicNovelExportHtml|text\/html|>Export Graphic Novel</u);
  assert.doesNotMatch(presentation, /<!doctype html>|buildPrevisGraphicNovelExportHtml|\.html`/u);
  assert.match(presentation, /\.webp`/u);
  assert.match(route, /authorizeRequest\(requestBoundary\(request\), \{ mutation: true \}\)/u);
  assert.match(route, /"Content-Type": "image\/webp"/u);
  assert.match(route, /"Cache-Control": "no-store"/u);
  assert.match(route, /"Referrer-Policy": "no-referrer"/u);
  assert.doesNotMatch(workspace, /format picker|Export HTML|Save as HTML/u);
});

test("#2491 encodes locked local panels as an ordered looping Animated WebP", async () => {
  const originalHome = process.env.PLOTPICKLE_HOME;
  const temporaryHome = await mkdtemp(path.join(os.tmpdir(), "plotpickle-previs-webp-"));
  process.env.PLOTPICKLE_HOME = temporaryHome;
  try {
    const assets = path.join(temporaryHome, "assets");
    await mkdir(assets, { recursive: true });
    await writeFile(path.join(assets, "position-01.png"), await sharp({
      create: { width: 640, height: 360, channels: 3, background: "#1a8f4a" },
    }).png().toBuffer());
    await writeFile(path.join(assets, "position-02.png"), await sharp({
      create: { width: 640, height: 360, channels: 3, background: "#8f241a" },
    }).png().toBuffer());

    const result = await buildPrevisGraphicNovelWebp({
      projectTitle: "Afterglow",
      blockNumber: 1,
      miniBlockNumber: 1,
      panels: [
        panel(2, "/api/local-ai/assets/position-02.png"),
        panel(1, "/api/local-ai/assets/position-01.png"),
      ],
      delayMs: PREVIS_GRAPHIC_NOVEL_INTERVAL_MS,
    });

    assert.equal(result.panelCount, 2);
    assert.equal(result.delayMs, 3000);
    assert.match(result.fileName, /afterglow-previs-graphic-novel-01-1\.webp$/u);
    const metadata = await sharp(result.bytes, { animated: true }).metadata();
    assert.equal(metadata.format, "webp");
    assert.equal(metadata.pages, 2);
    assert.deepEqual(metadata.delay, [3000, 3000]);
    assert.equal(metadata.loop, 0);

    const first = await sharp(result.bytes, { page: 0 }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const pixel = [...first.data.subarray(0, 3)];
    assert.ok(pixel[1] > pixel[0], "position 01 must be first even when request order is reversed");
  } finally {
    if (originalHome === undefined) delete process.env.PLOTPICKLE_HOME;
    else process.env.PLOTPICKLE_HOME = originalHome;
    await rm(temporaryHome, { recursive: true, force: true });
  }
});

test("#2491 keeps one locked frame valid and rejects unsafe or non-authoritative input", async () => {
  const originalHome = process.env.PLOTPICKLE_HOME;
  const temporaryHome = await mkdtemp(path.join(os.tmpdir(), "plotpickle-previs-webp-one-"));
  process.env.PLOTPICKLE_HOME = temporaryHome;
  try {
    const assets = path.join(temporaryHome, "assets");
    await mkdir(assets, { recursive: true });
    await writeFile(path.join(assets, "only.webp"), await sharp({
      create: { width: 320, height: 180, channels: 3, background: "#315b46" },
    }).webp().toBuffer());

    const one = await buildPrevisGraphicNovelWebp({
      projectTitle: "One",
      blockNumber: 2,
      miniBlockNumber: 3,
      panels: [panel(1, "/api/local-ai/assets/only.webp")],
      delayMs: 3000,
    });
    assert.equal((await sharp(one.bytes).metadata()).format, "webp");
    assert.equal(one.panelCount, 1);

    await assert.rejects(() => buildPrevisGraphicNovelWebp({
      projectTitle: "Empty",
      blockNumber: 1,
      miniBlockNumber: 1,
      panels: [],
      delayMs: 3000,
    }), /Keep \/ Lock at least one/u);
    await assert.rejects(() => buildPrevisGraphicNovelWebp({
      projectTitle: "Unsafe",
      blockNumber: 1,
      miniBlockNumber: 1,
      panels: [panel(1, "/api/local-ai/assets/../../secret.png")],
      delayMs: 3000,
    }), /unsafe local asset path/u);
    await assert.rejects(() => buildPrevisGraphicNovelWebp({
      projectTitle: "External",
      blockNumber: 1,
      miniBlockNumber: 1,
      panels: [panel(1, "https://example.com/frame.png")],
      delayMs: 3000,
    }), /saved PlotPickle local image assets/u);
    await assert.rejects(() => buildPrevisGraphicNovelWebp({
      projectTitle: "Draft",
      blockNumber: 1,
      miniBlockNumber: 1,
      panels: [panel(1, "/api/local-ai/assets/only.webp", { authoritative: false })],
      delayMs: 3000,
    }), /Keep \/ Locked Storyboard panels only/u);
  } finally {
    if (originalHome === undefined) delete process.env.PLOTPICKLE_HOME;
    else process.env.PLOTPICKLE_HOME = originalHome;
    await rm(temporaryHome, { recursive: true, force: true });
  }
});
