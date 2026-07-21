import type { ScreenplayDocument, ScreenplayFormat } from "./project";

export type ScreenplayElementType =
  | "section"
  | "scene-heading"
  | "action"
  | "character"
  | "parenthetical"
  | "dialogue"
  | "transition"
  | "note";

export type ScreenplayElement = {
  id: string;
  type: ScreenplayElementType;
  text: string;
  sourceLine: number;
  page: number;
  scene: number;
  blockNumber: number;
};

export const screenplayLegend: Array<{ type: ScreenplayElementType; label: string }> = [
  { type: "section", label: "Section" },
  { type: "scene-heading", label: "Scene heading" },
  { type: "action", label: "Action" },
  { type: "character", label: "Character" },
  { type: "parenthetical", label: "Parenthetical" },
  { type: "dialogue", label: "Dialogue" },
  { type: "transition", label: "Transition" },
  { type: "note", label: "Note" },
];

type ParsedLine = Pick<ScreenplayElement, "type" | "text" | "sourceLine" | "scene">;

export function screenplayFormatForFile(fileName: string): ScreenplayFormat {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".fdx")) return "final-draft";
  if (lower.endsWith(".fountain") || lower.endsWith(".spmd")) return "fountain";
  return "plain-text";
}

function decodeXml(value: string) {
  return value
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .trim();
}

function finalDraftType(value: string): ScreenplayElementType {
  const normalized = value.toLowerCase().replace(/\s+/g, "-");
  if (normalized === "scene-heading") return "scene-heading";
  if (normalized === "character") return "character";
  if (normalized === "dialogue") return "dialogue";
  if (normalized === "parenthetical") return "parenthetical";
  if (normalized === "transition") return "transition";
  if (normalized === "shot" || normalized === "general") return "note";
  return "action";
}

function parseFinalDraft(source: string): ParsedLine[] {
  const parsed: ParsedLine[] = [];
  const paragraphPattern = /<Paragraph\b([^>]*)>([\s\S]*?)<\/Paragraph>/gi;
  let match: RegExpExecArray | null;
  let sourceLine = 0;
  let scene = 0;
  while ((match = paragraphPattern.exec(source))) {
    sourceLine += 1;
    const typeMatch = match[1].match(/\bType=(?:"([^"]+)"|'([^']+)')/i);
    const type = finalDraftType(typeMatch?.[1] ?? typeMatch?.[2] ?? "Action");
    const textParts = [...match[2].matchAll(/<Text\b[^>]*>([\s\S]*?)<\/Text>/gi)].map((item) => decodeXml(item[1]));
    const text = (textParts.length ? textParts.join("") : decodeXml(match[2])).trim();
    if (!text) continue;
    if (type === "scene-heading") scene += 1;
    parsed.push({ type, text, sourceLine, scene });
  }
  return parsed;
}

function isSceneHeading(value: string) {
  return /^(?:\.?)(?:INT\.?|EXT\.?|INT\.\/EXT\.?|EXT\.\/INT\.?|I\/E\.?)(?:\s|$)/i.test(value);
}

function isTransition(value: string) {
  return /^(?:FADE IN:|FADE OUT\.?|CUT TO:|DISSOLVE TO:|SMASH CUT TO:|MATCH CUT TO:|WIPE TO:)$|\bTO:$/i.test(value);
}

function isCharacter(value: string) {
  const withoutExtension = value.replace(/\s*\([^)]*\)\s*\^?$/, "").trim();
  const letters = withoutExtension.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, "");
  return value.length <= 48 && letters.length > 0 && withoutExtension === withoutExtension.toUpperCase();
}

function cleanFountain(value: string, type: ScreenplayElementType) {
  if (type === "section") return value.replace(/^#+\s*/, "");
  if (type === "note") return value.replace(/^=\s*/, "").replace(/^\[\[|\]\]$/g, "");
  if (type === "scene-heading") return value.replace(/^\./, "");
  if (type === "character") return value.replace(/^@/, "").replace(/\^$/, "").trim();
  if (type === "transition") return value.replace(/^>/, "").trim();
  if (type === "action") return value.replace(/^!/, "");
  return value;
}

function parseText(source: string): ParsedLine[] {
  const parsed: ParsedLine[] = [];
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  let scene = 0;
  let previousType: ScreenplayElementType | "blank" = "blank";

  lines.forEach((raw, index) => {
    const value = raw.trim();
    if (!value) {
      previousType = "blank";
      return;
    }

    let type: ScreenplayElementType;
    if (/^#{1,6}\s*/.test(value)) type = "section";
    else if (/^=\s*/.test(value) || /^\[\[[\s\S]*\]\]$/.test(value)) type = "note";
    else if (isSceneHeading(value)) type = "scene-heading";
    else if (/^>/.test(value) || isTransition(value)) type = "transition";
    else if (/^\([^)]*\)$/.test(value) && (previousType === "character" || previousType === "dialogue")) type = "parenthetical";
    else if (/^@/.test(value) || (previousType === "blank" && isCharacter(value) && !isTransition(value))) type = "character";
    else if (previousType === "character" || previousType === "parenthetical" || previousType === "dialogue") type = "dialogue";
    else type = "action";

    if (type === "scene-heading") scene += 1;
    parsed.push({ type, text: cleanFountain(value, type), sourceLine: index + 1, scene });
    previousType = type;
  });
  return parsed;
}

export function parseScreenplay(document: ScreenplayDocument): ScreenplayElement[] {
  if (!document.sourceText.trim()) return [];
  const parsed = document.format === "final-draft" ? parseFinalDraft(document.sourceText) : parseText(document.sourceText);
  if (!parsed.length) return [];

  const totalSourceLines = Math.max(...parsed.map((item) => item.sourceLine), 1);
  const totalPages = Math.max(1, Math.ceil(totalSourceLines / 55));
  return parsed.map((item, index) => {
    const page = Math.min(totalPages, Math.floor((item.sourceLine - 1) / 55) + 1);
    const progress = totalPages === 1 ? index / Math.max(parsed.length, 1) : (page - 1) / totalPages;
    return {
      ...item,
      id: `screenplay-${index + 1}`,
      page,
      blockNumber: Math.min(24, Math.floor(progress * 24) + 1),
    };
  });
}

export function screenplayStats(elements: ScreenplayElement[]) {
  const pages = elements.length ? Math.max(...elements.map((item) => item.page)) : 0;
  const scenes = elements.length ? Math.max(...elements.map((item) => item.scene)) : 0;
  const dialogue = elements.filter((item) => item.type === "dialogue").length;
  return { pages, scenes, dialogue, elements: elements.length };
}
