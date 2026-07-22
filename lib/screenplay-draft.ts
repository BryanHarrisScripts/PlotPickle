import type {
  PlotPickleProject,
  ScreenplayDocument,
  ScreenplayDraftElement,
  ScreenplayDraftElementType,
} from "./project";
import { parseScreenplay } from "./screenplay";

const editableTypes: ScreenplayDraftElementType[] = [
  "scene-heading",
  "action",
  "character",
  "parenthetical",
  "dialogue",
  "transition",
];

function id() {
  return globalThis.crypto?.randomUUID?.() ?? `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createDraftElement(
  type: ScreenplayDraftElementType,
  blockNumber: number,
  miniBlockNumber: number,
  sceneNumber: number,
  text = "",
  sceneId = "",
): ScreenplayDraftElement {
  const now = new Date().toISOString();
  return { id: id(), type, text, blockNumber, miniBlockNumber, sceneNumber, sceneId, createdAt: now, updatedAt: now };
}

function fountainLine(element: ScreenplayDraftElement) {
  const text = element.text.trim();
  if (element.type === "scene-heading") return /^(?:INT\.?|EXT\.?|INT\.\/EXT\.?|EXT\.\/INT\.?|I\/E\.?)/i.test(text) ? text.toUpperCase() : `.${text.toUpperCase()}`;
  if (element.type === "character") return `@${text.toUpperCase()}`;
  if (element.type === "parenthetical") return text.startsWith("(") ? text : `(${text})`;
  if (element.type === "transition") return `> ${text.toUpperCase()}`;
  if (element.type === "action") return `!${text}`;
  return text;
}

export function screenplayToFountain(document: ScreenplayDocument) {
  if (!document.draftElements.length) return document.sourceText;
  return document.draftElements.map(fountainLine).join("\n\n").trim();
}

function xml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

const finalDraftTypes: Record<ScreenplayDraftElementType, string> = {
  "scene-heading": "Scene Heading",
  action: "Action",
  character: "Character",
  parenthetical: "Parenthetical",
  dialogue: "Dialogue",
  transition: "Transition",
};

export function screenplayToFinalDraft(project: PlotPickleProject) {
  const paragraphs = project.screenplay.draftElements
    .map((element) => `      <Paragraph Type="${finalDraftTypes[element.type]}"><Text>${xml(element.text)}</Text></Paragraph>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n<FinalDraft DocumentType="Script" Template="No" Version="5">\n  <Content>\n${paragraphs}\n  </Content>\n  <TitlePage><Content><Paragraph Type="Action"><Text>${xml(project.metadata.title)}</Text></Paragraph></Content></TitlePage>\n</FinalDraft>\n`;
}

export function syncDraft(document: ScreenplayDocument, draftElements: ScreenplayDraftElement[]): ScreenplayDocument {
  const next = { ...document, format: "fountain" as const, draftElements };
  return {
    ...next,
    fileName: document.fileName || "untitled-screenplay.fountain",
    sourceText: screenplayToFountain(next),
    importedAt: document.importedAt || new Date().toISOString(),
  };
}

export function draftFromScreenplay(document: ScreenplayDocument) {
  if (document.draftElements.length) return document.draftElements;
  const parsed = parseScreenplay(document).filter((element) => editableTypes.includes(element.type as ScreenplayDraftElementType));
  const blockCounts = new Map<number, number>();
  return parsed.map((element) => {
    const position = blockCounts.get(element.blockNumber) ?? 0;
    const inBlock = parsed.filter((item) => item.blockNumber === element.blockNumber).length;
    blockCounts.set(element.blockNumber, position + 1);
    const miniBlockNumber = Math.min(4, Math.floor((position / Math.max(1, inBlock)) * 4) + 1);
    return createDraftElement(
      element.type as ScreenplayDraftElementType,
      element.blockNumber,
      miniBlockNumber,
      Math.max(1, element.scene),
      element.text,
    );
  });
}

export function nextElementType(type: ScreenplayDraftElementType): ScreenplayDraftElementType {
  if (type === "scene-heading") return "action";
  if (type === "character") return "dialogue";
  if (type === "parenthetical") return "dialogue";
  if (type === "dialogue") return "action";
  if (type === "transition") return "scene-heading";
  return "action";
}

export function estimatedScreenplayPages(elements: ScreenplayDraftElement[]) {
  const lines = elements.reduce((total, element) => {
    const width = element.type === "dialogue" ? 34 : element.type === "action" ? 58 : 45;
    return total + Math.max(1, Math.ceil(element.text.length / width)) + 1;
  }, 0);
  return elements.length ? Math.max(1, Math.ceil(lines / 55)) : 0;
}
