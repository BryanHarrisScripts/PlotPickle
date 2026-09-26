import { readFile } from "node:fs/promises";
import path from "node:path";
import { ASSET_PATH, MAX_ASSET_BYTES, assetsDirectory, safeAssetStem } from "./media-storage-common";

export const PREVIS_GRAPHIC_NOVEL_PANEL = Object.freeze({ width: 720, height: 405 });
export const PREVIS_GRAPHIC_NOVEL_MAX_PANELS = 25;
export const PREVIS_GRAPHIC_NOVEL_COLUMNS = 2;
const PANEL_GAP = 20;
const SHEET_MARGIN = 20;
const SHEET_HEADER_HEIGHT = 72;
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
    throw new Error("PlotPickle's local image runtime is unavailable. Fully restart PlotPickle so startup can repair Sharp, then try Export WebP again.");
  }
}

export type PrevisGraphicNovelWebpBubble = Readonly<{
  speaker: string;
  text: string;
  style: "speech";
}>;

export type PrevisGraphicNovelWebpPanel = Readonly<{
  position: number;
  assetUrl: string;
  authoritative: boolean;
  caption: string;
  narration: string;
  shotLabel: string;
  shotContext: string;
  bubbles?: readonly PrevisGraphicNovelWebpBubble[];
}>;

export type PrevisGraphicNovelWebpResult = Readonly<{
  bytes: Buffer;
  fileName: string;
  panelCount: number;
  width: number;
  height: number;
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

function speechBubbleSvg(bubble: PrevisGraphicNovelWebpBubble, index: number) {
  const width = 292;
  const x = index % 2 === 0 ? 26 : PREVIS_GRAPHIC_NOVEL_PANEL.width - width - 26;
  const y = index % 2 === 0 ? 24 : 76;
  const height = 112;
  const speaker = escapeXml(cleanText(bubble.speaker, 48));
  const lines = wrapText(bubble.text, 30, 3);
  const text = lines.map((line, lineIndex) => (
    `<tspan x="${x + width / 2}" y="${y + 48 + lineIndex * 21}">${escapeXml(line)}</tspan>`
  )).join("");
  const tailX = index % 2 === 0 ? x + 62 : x + width - 76;
  return `
    <g data-graphic-novel-bubble="speech">
      <rect x="${x}" y="${y}" width="${width}" height="${height}" rx="48" ry="42" fill="#ffffff" stroke="#111111" stroke-width="3"/>
      <polygon points="${tailX},${y + height - 4} ${tailX + 20},${y + height + 24} ${tailX + 38},${y + height - 1}" fill="#ffffff" stroke="#111111" stroke-width="3" stroke-linejoin="round"/>
      <text x="${x + width / 2}" y="${y + 25}" text-anchor="middle" fill="#111111" font-size="13" font-weight="700" font-family="Arial, sans-serif">${speaker}</text>
      <text text-anchor="middle" fill="#111111" font-size="17" font-family="Arial, sans-serif">${text}</text>
    </g>`;
}

function graphicNovelOverlaySvg(panel: PrevisGraphicNovelWebpPanel) {
  const bubbles = (panel.bubbles ?? []).slice(0, 2).map(speechBubbleSvg).join("");
  const caption = wrapText(panel.caption, 52, 1);
  const narration = wrapText(panel.narration, 58, 2);
  const shot = wrapText([panel.shotLabel, panel.shotContext].filter(Boolean).join(" · "), 72, 1);
  const captionText = caption.map((line) => `<tspan x="24" y="326">${escapeXml(line)}</tspan>`).join("");
  const narrationText = narration.map((line, index) => `<tspan x="24" y="${350 + index * 20}">${escapeXml(line)}</tspan>`).join("");
  const shotText = shot.length ? `<text x="24" y="397" fill="#c7d4cc" font-size="12" font-family="monospace">${escapeXml(shot[0])}</text>` : "";
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${PREVIS_GRAPHIC_NOVEL_PANEL.width}" height="${PREVIS_GRAPHIC_NOVEL_PANEL.height}">
    ${bubbles}
    <rect x="0" y="300" width="${PREVIS_GRAPHIC_NOVEL_PANEL.width}" height="105" fill="rgba(5,8,7,0.82)"/>
    <rect x="0" y="300" width="${PREVIS_GRAPHIC_NOVEL_PANEL.width}" height="2" fill="#70d6a1"/>
    <text fill="#70d6a1" font-size="14" font-weight="700" font-family="monospace">${captionText}</text>
    <text fill="#f2f5f3" font-size="14" font-family="Arial, sans-serif">${narrationText}</text>
    ${shotText}
  </svg>`);
}

async function preparedPanel(panel: PrevisGraphicNovelWebpPanel) {
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
    .resize(PREVIS_GRAPHIC_NOVEL_PANEL.width, PREVIS_GRAPHIC_NOVEL_PANEL.height, {
      fit: "cover",
      position: "centre",
    })
    .png()
    .toBuffer();
  return sharp(base)
    .composite([{ input: graphicNovelOverlaySvg(panel), top: 0, left: 0 }])
    .png()
    .toBuffer();
}

function validatedPanels(value: readonly PrevisGraphicNovelWebpPanel[]) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error("Keep / Lock at least one Storyboard frame before exporting WebP.");
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
      bubbles: Array.isArray(panel.bubbles)
        ? panel.bubbles.slice(0, 2).flatMap((bubble) => {
          const speaker = cleanText(bubble?.speaker, 80);
          const text = cleanText(bubble?.text, 180);
          return speaker && text ? [{ speaker, text, style: "speech" as const }] : [];
        })
        : [],
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

function sheetHeaderSvg(title: string, blockNumber: number, miniBlockNumber: number, width: number) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${SHEET_HEADER_HEIGHT}">
    <rect width="${width}" height="${SHEET_HEADER_HEIGHT}" fill="#09100d"/>
    <text x="${SHEET_MARGIN}" y="30" fill="#70d6a1" font-size="18" font-weight="700" font-family="monospace">PREVIS GRAPHIC NOVEL</text>
    <text x="${SHEET_MARGIN}" y="54" fill="#f2f5f3" font-size="16" font-family="Arial, sans-serif">${escapeXml(cleanText(title, 120))} · Block ${String(blockNumber).padStart(2, "0")} · Mini-Block ${miniBlockNumber}</text>
  </svg>`);
}

export async function buildPrevisGraphicNovelWebp(input: Readonly<{
  projectTitle: string;
  blockNumber: number;
  miniBlockNumber: number;
  panels: readonly PrevisGraphicNovelWebpPanel[];
}>): Promise<PrevisGraphicNovelWebpResult> {
  const panels = validatedPanels(input.panels);
  const sharp = await sharpEngine();
  const prepared: Buffer[] = [];
  for (const panel of panels) prepared.push(await preparedPanel(panel));

  const rows = Math.ceil(prepared.length / PREVIS_GRAPHIC_NOVEL_COLUMNS);
  const width = SHEET_MARGIN * 2
    + PREVIS_GRAPHIC_NOVEL_COLUMNS * PREVIS_GRAPHIC_NOVEL_PANEL.width
    + (PREVIS_GRAPHIC_NOVEL_COLUMNS - 1) * PANEL_GAP;
  const height = SHEET_HEADER_HEIGHT
    + SHEET_MARGIN
    + rows * PREVIS_GRAPHIC_NOVEL_PANEL.height
    + Math.max(0, rows - 1) * PANEL_GAP
    + SHEET_MARGIN;

  const composites = prepared.map((inputBuffer, index) => {
    const row = Math.floor(index / PREVIS_GRAPHIC_NOVEL_COLUMNS);
    const column = index % PREVIS_GRAPHIC_NOVEL_COLUMNS;
    return {
      input: inputBuffer,
      left: SHEET_MARGIN + column * (PREVIS_GRAPHIC_NOVEL_PANEL.width + PANEL_GAP),
      top: SHEET_HEADER_HEIGHT + SHEET_MARGIN + row * (PREVIS_GRAPHIC_NOVEL_PANEL.height + PANEL_GAP),
    };
  });

  const bytes = await sharp({
    create: { width, height, channels: 3, background: "#050807" },
  })
    .composite([
      { input: sheetHeaderSvg(input.projectTitle, input.blockNumber, input.miniBlockNumber, width), left: 0, top: 0 },
      ...composites,
    ])
    .webp({ quality: 86 })
    .toBuffer();

  if (!bytes.length || bytes.length > MAX_ASSET_BYTES) {
    throw new Error("WebP export was empty or exceeded the local image size limit.");
  }
  return {
    bytes,
    fileName: graphicNovelWebpFileName(input.projectTitle, input.blockNumber, input.miniBlockNumber),
    panelCount: panels.length,
    width,
    height,
  };
}
