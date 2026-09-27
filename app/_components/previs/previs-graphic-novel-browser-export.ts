import type { PrevisGraphicNovelPanel } from "./previs-graphic-novel-presentation";

const PANEL_WIDTH = 720;
const PANEL_HEIGHT = 405;
const COLUMNS = 2;
const GAP = 20;
const MARGIN = 20;
const HEADER_HEIGHT = 72;
const MAX_PANELS = 25;

function clean(value: string, maximum: number) {
  return value.replace(/\s+/gu, " ").trim().slice(0, maximum);
}

function wrapText(
  context: CanvasRenderingContext2D,
  value: string,
  maximumWidth: number,
  maximumLines: number,
) {
  const words = clean(value, 1200).split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (context.measureText(candidate).width <= maximumWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    if (lines.length >= maximumLines - 1) break;
  }
  if (current && lines.length < maximumLines) lines.push(current);
  return lines.slice(0, maximumLines);
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const bounded = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + bounded, y);
  context.lineTo(x + width - bounded, y);
  context.quadraticCurveTo(x + width, y, x + width, y + bounded);
  context.lineTo(x + width, y + height - bounded);
  context.quadraticCurveTo(x + width, y + height, x + width - bounded, y + height);
  context.lineTo(x + bounded, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - bounded);
  context.lineTo(x, y + bounded);
  context.quadraticCurveTo(x, y, x + bounded, y);
  context.closePath();
}

async function localImage(assetUrl: string) {
  if (!assetUrl.startsWith("/api/local-ai/assets/")) {
    throw new Error("Graphic Novel export accepts saved PlotPickle local images only.");
  }
  const response = await fetch(assetUrl, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error(`Graphic Novel source image could not be read (${response.status}).`);
  const blob = await response.blob();
  if (!["image/png", "image/jpeg", "image/webp"].includes(blob.type)) {
    throw new Error("Graphic Novel export received an unsupported source image.");
  }
  return createImageBitmap(blob);
}

function drawCover(
  context: CanvasRenderingContext2D,
  image: ImageBitmap,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scale = Math.max(width / image.width, height / image.height);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = Math.max(0, (image.width - sourceWidth) / 2);
  const sourceY = Math.max(0, (image.height - sourceHeight) / 2);
  context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function drawBubble(
  context: CanvasRenderingContext2D,
  panelX: number,
  panelY: number,
  speaker: string,
  text: string,
  index: number,
) {
  const width = 292;
  const height = 112;
  const x = panelX + (index % 2 === 0 ? 26 : PANEL_WIDTH - width - 26);
  const y = panelY + (index % 2 === 0 ? 24 : 76);

  context.save();
  roundedRect(context, x, y, width, height, 42);
  context.fillStyle = "#ffffff";
  context.strokeStyle = "#111111";
  context.lineWidth = 3;
  context.fill();
  context.stroke();

  const tailX = index % 2 === 0 ? x + 62 : x + width - 76;
  context.beginPath();
  context.moveTo(tailX, y + height - 4);
  context.lineTo(tailX + 20, y + height + 24);
  context.lineTo(tailX + 38, y + height - 1);
  context.closePath();
  context.fill();
  context.stroke();

  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#111111";
  context.font = "700 13px Arial, sans-serif";
  context.fillText(clean(speaker, 48), x + width / 2, y + 25);

  context.font = "17px Arial, sans-serif";
  const lines = wrapText(context, text, width - 34, 3);
  lines.forEach((line, lineIndex) => {
    context.fillText(line, x + width / 2, y + 51 + lineIndex * 21);
  });
  context.restore();
}

function drawPanelOverlay(
  context: CanvasRenderingContext2D,
  panel: PrevisGraphicNovelPanel,
  x: number,
  y: number,
) {
  panel.bubbles.slice(0, 2).forEach((bubble, index) => {
    drawBubble(context, x, y, bubble.speaker, bubble.text, index);
  });

  context.save();
  context.fillStyle = "rgba(5, 8, 7, 0.84)";
  context.fillRect(x, y + 300, PANEL_WIDTH, 105);
  context.fillStyle = "#70d6a1";
  context.fillRect(x, y + 300, PANEL_WIDTH, 2);

  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.font = "700 14px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillStyle = "#70d6a1";
  const caption = wrapText(context, panel.caption, PANEL_WIDTH - 48, 1);
  caption.forEach((line, index) => context.fillText(line, x + 24, y + 326 + index * 18));

  context.font = "14px Arial, sans-serif";
  context.fillStyle = "#f2f5f3";
  const narration = wrapText(context, panel.narration, PANEL_WIDTH - 48, 2);
  narration.forEach((line, index) => context.fillText(line, x + 24, y + 350 + index * 20));

  context.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillStyle = "#c7d4cc";
  const shot = clean([panel.shotLabel, panel.shotContext].filter(Boolean).join(" · "), 180);
  const shotLine = wrapText(context, shot, PANEL_WIDTH - 48, 1)[0];
  if (shotLine) context.fillText(shotLine, x + 24, y + 397);
  context.restore();
}

function webpBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob || blob.type !== "image/webp") {
        reject(new Error("This PlotPickle browser session could not encode a WebP image."));
        return;
      }
      resolve(blob);
    }, "image/webp", 0.86);
  });
}

export async function buildBrowserGraphicNovelWebp(input: Readonly<{
  projectTitle: string;
  blockNumber: number;
  miniBlockNumber: number;
  panels: readonly PrevisGraphicNovelPanel[];
}>) {
  const panels = input.panels
    .filter((panel) => panel.authoritative && panel.assetUrl)
    .slice(0, MAX_PANELS)
    .sort((left, right) => left.position - right.position);

  if (!panels.length) throw new Error("Keep / Lock at least one Storyboard frame before exporting WebP.");

  const rows = Math.ceil(panels.length / COLUMNS);
  const width = MARGIN * 2 + COLUMNS * PANEL_WIDTH + (COLUMNS - 1) * GAP;
  const height = HEADER_HEIGHT + MARGIN + rows * PANEL_HEIGHT + Math.max(0, rows - 1) * GAP + MARGIN;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The browser canvas needed for WebP export is unavailable.");

  context.fillStyle = "#050807";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#09100d";
  context.fillRect(0, 0, width, HEADER_HEIGHT);
  context.textAlign = "left";
  context.textBaseline = "alphabetic";
  context.font = "700 18px ui-monospace, SFMono-Regular, Menlo, monospace";
  context.fillStyle = "#70d6a1";
  context.fillText("PREVIS GRAPHIC NOVEL", MARGIN, 30);
  context.font = "16px Arial, sans-serif";
  context.fillStyle = "#f2f5f3";
  context.fillText(
    `${clean(input.projectTitle || "Untitled Story", 120)} · Block ${String(input.blockNumber).padStart(2, "0")} · Mini-Block ${input.miniBlockNumber}`,
    MARGIN,
    54,
  );

  for (let index = 0; index < panels.length; index += 1) {
    const panel = panels[index];
    const row = Math.floor(index / COLUMNS);
    const column = index % COLUMNS;
    const x = MARGIN + column * (PANEL_WIDTH + GAP);
    const y = HEADER_HEIGHT + MARGIN + row * (PANEL_HEIGHT + GAP);
    const image = await localImage(panel.assetUrl);
    try {
      drawCover(context, image, x, y, PANEL_WIDTH, PANEL_HEIGHT);
      drawPanelOverlay(context, panel, x, y);
    } finally {
      image.close();
    }
  }

  const blob = await webpBlob(canvas);
  return Object.freeze({ blob, panelCount: panels.length, width, height });
}
