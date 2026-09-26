import { readFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { assetsDirectory, MAX_ASSET_BYTES } from "./media-provider-common";

export const PREVIS_GRAPHIC_NOVEL_EXPORT_WIDTH = 1024;
export const PREVIS_GRAPHIC_NOVEL_EXPORT_HEIGHT = 768;
export const PREVIS_GRAPHIC_NOVEL_IMAGE_HEIGHT = 576;
export const PREVIS_GRAPHIC_NOVEL_EXPORT_DELAY_MS = 3000;

export type AnimatedGraphicNovelPanel = Readonly<{
  position: number;
  assetUrl: string;
  authoritative: boolean;
  caption: string;
  narration: string;
  shotLabel: string;
  shotContext: string;
}>;

function clean(value: unknown, maximum: number) {
  return typeof value === "string" ? value.replace(/\s+/gu, " ").trim().slice(0, maximum) : "";
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function lines(value: string, width = 72, maximum = 4) {
  const words = value.split(/\s+/u).filter(Boolean);
  const output: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= width || !current) {
      current = next;
      continue;
    }
    output.push(current);
    current = word;
    if (output.length >= maximum - 1) break;
  }
  if (current && output.length < maximum) output.push(current);
  return output;
}

function textSpans(values: readonly string[], y: number, size: number, fill: string, lineHeight: number) {
  return values.map((value, index) =>
    `<text x="40" y="${y + index * lineHeight}" font-family="monospace" font-size="${size}" fill="${fill}">${escapeXml(value)}</text>`
  ).join("");
}

function safeLocalAssetFile(assetUrl: string) {
  const prefix = "/api/local-ai/assets/";
  if (!assetUrl.startsWith(prefix)) throw new Error("Graphic Novel export accepts only local PlotPickle frame assets.");
  const fileName = assetUrl.slice(prefix.length);
  if (!/^[a-z0-9][a-z0-9._-]*\.(?:png|jpe?g|webp)$/iu.test(fileName)) {
    throw new Error("Graphic Novel export received an unsafe local frame path.");
  }
  return fileName;
}

async function renderPanel(panel: AnimatedGraphicNovelPanel) {
  const fileName = safeLocalAssetFile(panel.assetUrl);
  const bytes = await readFile(path.join(assetsDirectory(), fileName));
  if (!bytes.length || bytes.length > MAX_ASSET_BYTES) throw new Error("Graphic Novel frame is empty or too large.");

  const image = await sharp(bytes, { failOn: "warning" })
    .rotate()
    .resize(PREVIS_GRAPHIC_NOVEL_EXPORT_WIDTH, PREVIS_GRAPHIC_NOVEL_IMAGE_HEIGHT, {
      fit: "contain",
      background: "#050705",
      withoutEnlargement: false,
    })
    .png()
    .toBuffer();

  const caption = clean(panel.caption, 160) || `Frame ${String(panel.position).padStart(2, "0")}`;
  const narration = clean(panel.narration, 420) || "Derived Previs narration remains open.";
  const shot = [clean(panel.shotLabel, 120), clean(panel.shotContext, 180)].filter(Boolean).join(" · ");
  const captionLines = lines(caption, 70, 2);
  const narrationLines = lines(narration, 86, 3);
  const shotLines = lines(shot, 100, 1);
  const svg = `<svg width="${PREVIS_GRAPHIC_NOVEL_EXPORT_WIDTH}" height="${PREVIS_GRAPHIC_NOVEL_EXPORT_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="${PREVIS_GRAPHIC_NOVEL_IMAGE_HEIGHT}" width="${PREVIS_GRAPHIC_NOVEL_EXPORT_WIDTH}" height="${PREVIS_GRAPHIC_NOVEL_EXPORT_HEIGHT - PREVIS_GRAPHIC_NOVEL_IMAGE_HEIGHT}" fill="#08100c"/>
    <rect x="24" y="${PREVIS_GRAPHIC_NOVEL_IMAGE_HEIGHT + 18}" width="${PREVIS_GRAPHIC_NOVEL_EXPORT_WIDTH - 48}" height="${PREVIS_GRAPHIC_NOVEL_EXPORT_HEIGHT - PREVIS_GRAPHIC_NOVEL_IMAGE_HEIGHT - 36}" rx="4" fill="#101a14" stroke="#70d6a1" stroke-width="2"/>
    ${textSpans(captionLines, 616, 20, "#70d6a1", 24)}
    ${textSpans(narrationLines, 665, 18, "#eef5ef", 23)}
    ${textSpans(shotLines, 746, 13, "#a9b7ad", 16)}
  </svg>`;

  return sharp({
    create: {
      width: PREVIS_GRAPHIC_NOVEL_EXPORT_WIDTH,
      height: PREVIS_GRAPHIC_NOVEL_EXPORT_HEIGHT,
      channels: 4,
      background: "#050705",
    },
  })
    .composite([
      { input: image, left: 0, top: 0 },
      { input: Buffer.from(svg), left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
}

export function graphicNovelAnimatedWebpFileName(projectTitle: string, blockNumber: number, miniBlockNumber: number) {
  const slug = clean(projectTitle, 160).toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "") || "plotpickle";
  return `${slug}-previs-graphic-novel-${String(blockNumber).padStart(2, "0")}-${miniBlockNumber}.webp`;
}

export async function buildAnimatedPrevisGraphicNovel(input: Readonly<{
  panels: readonly AnimatedGraphicNovelPanel[];
}>) {
  if (!Array.isArray(input.panels) || input.panels.length > 25) throw new Error("Graphic Novel export accepts at most 25 panels.");
  const authoritative = input.panels.filter((panel) => panel.authoritative && panel.assetUrl);
  if (!authoritative.length) throw new Error("Keep / Lock at least one Storyboard frame before exporting the Graphic Novel.");

  const frames = await Promise.all(authoritative.map(renderPanel));
  const { data, info } = await sharp(frames, { join: { animated: true } })
    .webp({
      quality: 85,
      effort: 4,
      loop: 0,
      delay: PREVIS_GRAPHIC_NOVEL_EXPORT_DELAY_MS,
      keepDuplicateFrames: true,
    })
    .toBuffer({ resolveWithObject: true });

  if (info.format !== "webp") throw new Error("Graphic Novel export did not produce WebP output.");
  return {
    bytes: data,
    frameCount: authoritative.length,
    width: info.width,
    height: info.pageHeight ?? info.height,
  };
}
