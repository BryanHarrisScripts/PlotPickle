export type ScreenplayElementKind = "scene-heading" | "character" | "dialogue" | "parenthetical" | "action" | "transition" | "page-break";
export type ImportedScreenplayElement = { id: string; kind: ScreenplayElementKind; text: string; page: number; confidence: number; reviewStatus: "unreviewed"; source: { type: "pdf-import"; file: string; page: number; importedAt: string; confidence: number } };
export type ScreenplayPdfAnalysis = { confidence: number; supported: boolean; scannedLikely: boolean; counts: Record<string, number>; elements: ImportedScreenplayElement[]; preview: ImportedScreenplayElement[]; warnings: string[] };

const sceneHeading = /^(INT\.?|EXT\.?|INT\.\/EXT\.?|I\/E\.?)\s+/i;
const transition = /^(CUT TO:|FADE IN:|FADE OUT\.?|DISSOLVE TO:|SMASH CUT TO:|MATCH CUT TO:)$/i;
const characterCue = /^[A-Z][A-Z0-9 ._'’()\-]{1,38}$/;

export function analyzeScreenplayText(text: string, fileName = "screenplay.pdf", importedAt = new Date().toISOString()): ScreenplayPdfAnalysis {
  const normalized = text.replace(/\r/g, "");
  const pages = normalized.split(/\f|\n\s*---\s*PAGE\s+\d+\s*---\s*\n/i);
  const elements: ImportedScreenplayElement[] = [];
  let previous: ScreenplayElementKind | null = null;
  let id = 0;
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const lines = pages[pageIndex].split("\n").map((line) => line.trimEnd()).filter((line) => line.trim().length > 0);
    for (const raw of lines) {
      const value = raw.trim();
      let kind: ScreenplayElementKind = "action";
      let confidence = 0.62;
      if (sceneHeading.test(value)) { kind = "scene-heading"; confidence = 0.99; }
      else if (transition.test(value)) { kind = "transition"; confidence = 0.98; }
      else if (/^\(.+\)$/.test(value) && previous === "character") { kind = "parenthetical"; confidence = 0.95; }
      else if (characterCue.test(value) && value === value.toUpperCase() && !transition.test(value) && !sceneHeading.test(value)) { kind = "character"; confidence = 0.86; }
      else if (previous === "character" || previous === "parenthetical" || previous === "dialogue") { kind = "dialogue"; confidence = 0.84; }
      id += 1;
      elements.push({ id: `pdf-${id}`, kind, text: value, page: pageIndex + 1, confidence, reviewStatus: "unreviewed", source: { type: "pdf-import", file: fileName, page: pageIndex + 1, importedAt, confidence } });
      previous = kind;
    }
  }
  const counts: Record<string, number> = {};
  for (const element of elements) counts[element.kind] = (counts[element.kind] ?? 0) + 1;
  const structural = (counts["scene-heading"] ?? 0) * 4 + (counts.character ?? 0) * 2 + (counts.dialogue ?? 0) + (counts.parenthetical ?? 0) + (counts.transition ?? 0) * 2;
  const density = elements.length ? structural / elements.length : 0;
  const confidence = Math.max(0, Math.min(1, density / 1.8));
  const scannedLikely = normalized.trim().length < 200;
  const warnings: string[] = [];
  if (scannedLikely) warnings.push("This PDF appears to contain scanned or image-only pages. OCR and manual review are required.");
  if (confidence < 0.65) warnings.push("This PDF does not appear to use a supported screenplay format.");
  return { confidence, supported: confidence >= 0.65 && !scannedLikely, scannedLikely, counts, elements, preview: elements.slice(0, 30), warnings };
}

export function screenplayImportScopes(kind: "complete-project" | "screenplay" | "dialogue" | "character" | "production-breakdown" | "structural-analysis" | "reference-only") {
  const map = {
    "complete-project": ["screenplay", "characters", "world", "production", "reports", "canon", "blocks"],
    screenplay: ["screenplay"], dialogue: ["screenplay", "characters", "reports"], character: ["characters", "reports"],
    "production-breakdown": ["world", "characters", "production", "reports"], "structural-analysis": ["screenplay", "blocks", "reports"], "reference-only": ["research", "canon"],
  } as const;
  return [...map[kind]];
}
