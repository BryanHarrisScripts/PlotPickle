import { readFile } from "node:fs/promises";
import path from "node:path";
import { ASSET_PATH, MAX_ASSET_BYTES, assetsDirectory, safeAssetStem } from "./media-storage-common";

export const PREVIS_GRAPHIC_NOVEL_CANVAS = Object.freeze({ width: 1280, height: 720 });
export const PREVIS_GRAPHIC_NOVEL_MAX_PANELS = 25;
const MAX_INPUT_PIXELS = 40_000_000;
const MAX_INPUT_DIMENSION = 8_192;

type SharpFactory = typeof import("sharp").default;
let cachedSharp: SharpFactory | null = null;

async function sharpEngine(): Promise<SharpFactory> {
  if (cachedSharp) return cachedSharp;
  try {
    const module = await import("sharp");
    const sharp = module.default;
    if (typeof sharp !== "function") throw new Error("Sharp loaded without an image-processing entry point.");
    cachedSharp = sharp;
    return sharp;
  } catch {
    throw new Error("PlotPickle's local image runtime is unavailable. Fully restart PlotPickle so startup can repair Sharp, then try Export Animated WebP again.");
  }
}

export type PrevisGraphicNovelWebpPanel = Readonly<{
  position: number;
  assetUrl: string;
  authoritative: boolean;
  caption: string;
  narration: string;
  shotLabel: string;
  shotContext: string;
}>;

export type PrevisGraphicNovelWebpResult = Readonly<{
  bytes: Buffer;
  fileName: string;
  panelCount: number;
  delayMs: number;
}>;

function cleanText(value: unknown, maximum: number) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/gu, " ").trim().slice(0, maximum);
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function wrapText(value: string, maximumCharacters: number, maximumLines: number) {
  const words = cleanText(value, maximumCharacters * maximumLines * 2).split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maximumCharacters) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word.slice(0, maximumCharacters);
    if (lines.length >= maximumLines - 1) break;
  }
  if (current && lines.length < maximumLines) lines.push(current);
  return lines.slice(0, maximumLines);
}

function localAssetFilePath(value: unknown) {
  if (typeof value !== "string" || !value.startsWith(ASSET_PATH)) {
    throw new Error("Graphic Novel export accepts only saved PlotPickle local image assets.");
  }
  const relative = value.slice(ASSET_PATH.length);
  if (!relative || relative.length > 240 || relative.includes("\\") || relative.includes("%") || relative.includes("?") || relative.includes("#") || relative.includes("\0")) {
    throw new Error("Graphic Novel export received an unsafe local asset path.");
  }
  const segments = relative.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === ".." || !/^[a-z0-9][a-z0-9._-]*$/iu.test(segment))) {
    throw new Error("Graphic Novel export received an unsafe local asset path.");
  }
  const fileName = segments.at(-1) ?? "";
  if (!/\.(png|jpe?g|webp)$/iu.test(fileName)) {
    throw new Error("Graphic Novel export accepts PNG, JPEG or WebP source images only.");
  }
  const root = path.resolve(assetsDirectory());
  const filePath = path.resolve(root, ...segments);
  if (!filePath.startsWith(root + path.sep)) {
    throw new Error("Graphic Novel export received an unsafe local asset path.");
  }
  return filePath;
}

function graphicNovelCaptionSvg(panel: PrevisGraphicNovelWebpPanel) {
  const caption = wrapText(panel.caption, 62, 2);
  const narration = wrapText(panel.narration, 78, 3);
  const shot = wrapText([panel.shotLabel, panel.shotContext].filter(Boolean).join(" · "), 90, 1);
  const captionText = caption.map((line, index) => `<tspan x="48" y="${538 + index * 28}">${escapeXml(line)}</tspan>`).join("");
  const narrationStart = 598;
  const narrationText = narration.map((line, index) => `<tspan x="48" y="${narrationStart + index * 25}">${escapeXml(line)}</tspan>`).join("");
  const shotText = shot.length ? `<text x="48" y="698" fill="#b7c4bc" font-size="15" font-family="monospace">${escapeXml(shot[0])}</text>` : "";
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${PREVIS_GRAPHIC_NOVEL_CANVAS.width}" height="${PREVIS_GRAPHIC_NOVEL_CANVAS.height}">
    <rect x="0" y="492" width="1280" height="228" fill="rgba(5,8,7,0.82)"/>
    <rect x="0" y="492" width="1280" height="2" fill="#70d6a1"/>
    <text fill="#70d6a1" font-size="20" font-weight="700" font-family="monospace">${captionText}</text>
    <text fill="#f2f5f3" font-size="18" font-family="sans-serif">${narrationText}</text>
    ${shotText}
  </svg>`);
}

async function preparedFrame(panel: PrevisGraphicNovelWebpPanel) {
  const sharp = await sharpEngine();
  const filePath = localAssetFilePath(panel.assetUrl);
  const bytes = await readFile(filePath);
  if (!bytes.length || bytes.length > MAX_ASSET_BYTES) {
    throw new Error("Graphic Novel source image was empty or exceeded the local image size limit.");
  }
  const metadata = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  if (!metadata.width || !metadata.height || metadata.width > MAX_INPUT_DIMENSION || metadata.height > MAX_INPUT_DIMENSION) {
    throw new Error("Graphic Novel source image dimensions exceed the bounded export limit.");
  }
  if (!["png", "jpeg", "webp"].includes(metadata.format ?? "")) {
    throw new Error("Graphic Novel export received an unsupported source image.");
  }
  if ((metadata.pages ?? 1) > 1) {
    throw new Error("Animated source images are not accepted as Graphic Novel panels.");
  }
  const base = await sharp(bytes, { limitInputPixels: MAX_INPUT_PIXELS })
    .rotate()
    .resize(PREVIS_GRAPHIC_NOVEL_CANVAS.width, PREVIS_GRAPHIC_NOVEL_CANVAS.height, {
      fit: "cover",
      position: "centre",
    })
    .png()
    .toBuffer();
  return sharp(base)
    .composite([{ input: graphicNovelCaptionSvg(panel), top: 0, left: 0 }])
    .png()
    .toBuffer();
}

function validatedPanels(value: readonly PrevisGraphicNovelWebpPanel[]) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("Keep / Lock at least one Storyboard frame before exporting Animated WebP.");
  }
  if (value.length > PREVIS_GRAPHIC_NOVEL_MAX_PANELS) {
    throw new Error("Graphic Novel export is limited to 25 Storyboard positions.");
  }
  const panels = value.map((panel) => {
    if (!panel || panel.authoritative !== true) {
      throw new Error("Graphic Novel export accepts Keep / Locked Storyboard panels only.");
    }
    if (!Number.isInteger(panel.position) || panel.position < 1 || panel.position > 25) {
      throw new Error("Graphic Novel export received an invalid Storyboard position.");
    }
    localAssetFilePath(panel.assetUrl);
    return {
      position: panel.position,
      assetUrl: panel.assetUrl,
      authoritative: true,
      caption: cleanText(panel.caption, 240),
      narration: cleanText(panel.narration, 640),
      shotLabel: cleanText(panel.shotLabel, 180),
      shotContext: cleanText(panel.shotContext, 320),
    } satisfies PrevisGraphicNovelWebpPanel;
  }).sort((left, right) => left.position - right.position);
  if (new Set(panels.map((panel) => panel.position)).size !== panels.length) {
    throw new Error("Graphic Novel export received duplicate Storyboard positions.");
  }
  return panels;
}

export function graphicNovelWebpFileName(projectTitle: string, blockNumber: number, miniBlockNumber: number) {
  const slug = safeAssetStem(projectTitle || "plotpickle");
  return `${slug}-previs-graphic-novel-${String(blockNumber).padStart(2, "0")}-${miniBlockNumber}.webp`;
}

export async function buildPrevisGraphicNovelWebp(input: Readonly<{
  projectTitle: string;
  blockNumber: number;
  miniBlockNumber: number;
  panels: readonly PrevisGraphicNovelWebpPanel[];
  delayMs: number;
}>): Promise<PrevisGraphicNovelWebpResult> {
  const panels = validatedPanels(input.panels);
  const sharp = await sharpEngine();
  const delayMs = Number.isInteger(input.delayMs) && input.delayMs >= 250 && input.delayMs <= 60_000 ? input.delayMs : 3_000;
  const frames: Buffer[] = [];
  for (const panel of panels) frames.push(await preparedFrame(panel));

  const bytes = frames.length === 1
    ? await sharp(frames[0]).webp({ quality: 86 }).toBuffer()
    : await sharp(frames.map((frame) => ({ input: frame })), { join: { animated: true } })
      .webp({ quality: 86, loop: 0, delay: frames.map(() => delayMs) })
      .toBuffer();

  if (!bytes.length || bytes.length > MAX_ASSET_BYTES) {
    throw new Error("Animated WebP export was empty or exceeded the local image size limit.");
  }
  return {
    bytes,
    fileName: graphicNovelWebpFileName(input.projectTitle, input.blockNumber, input.miniBlockNumber),
    panelCount: panels.length,
    delayMs,
  };
}
