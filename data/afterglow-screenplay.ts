import type {
  ScreenplayDocument,
  ScreenplayDraftElement,
  ScreenplayDraftElementType,
} from "@/lib/project";
import { parseScreenplay } from "@/lib/screenplay";
import part01 from "./afterglow-screenplay/part-01";
import part02 from "./afterglow-screenplay/part-02";
import part03 from "./afterglow-screenplay/part-03";
import part04 from "./afterglow-screenplay/part-04";
import part05 from "./afterglow-screenplay/part-05";
import part06 from "./afterglow-screenplay/part-06";
import part07 from "./afterglow-screenplay/part-07";
import part08 from "./afterglow-screenplay/part-08";

/*
 * Complete canonical demonstration screenplay transcribed from Bryan Elgin
 * Harris's Afterglow v9 Twitter Rewrite (2023). The original work is titled
 * “Afterglow: Echoes of Sentience” and remains separately licensed under
 * CC BY-SA 4.0. PlotPickle displays the example as
 * “Afterglow: Reflections of Sentience.”
 */
const afterglowV9Fountain = [
  part01,
  part02,
  part03,
  part04,
  part05,
  part06,
  part07,
  part08,
].join("");

const editableTypes: ScreenplayDraftElementType[] = [
  "scene-heading",
  "action",
  "character",
  "parenthetical",
  "dialogue",
  "transition",
];

function sourceDocument(importedAt: string): ScreenplayDocument {
  return {
    fileName: "Afterglow-Reflections-of-Sentience-v9.fountain",
    format: "fountain",
    sourceText: afterglowV9Fountain,
    importedAt,
    analysisStatus: "reviewed",
    analyzedAt: importedAt,
    suggestedFields: [],
    draftElements: [],
  };
}

function createDeterministicDraft(document: ScreenplayDocument, importedAt: string) {
  const parsed = parseScreenplay(document).filter((element) =>
    editableTypes.includes(element.type as ScreenplayDraftElementType),
  );
  const totals = new Map<number, number>();
  const positions = new Map<number, number>();

  parsed.forEach((element) => totals.set(element.blockNumber, (totals.get(element.blockNumber) ?? 0) + 1));

  return parsed.map((element, index): ScreenplayDraftElement => {
    const position = positions.get(element.blockNumber) ?? 0;
    const total = totals.get(element.blockNumber) ?? 1;
    positions.set(element.blockNumber, position + 1);
    return {
      id: `afterglow-v9-${String(index + 1).padStart(4, "0")}`,
      type: element.type as ScreenplayDraftElementType,
      text: element.text,
      blockNumber: element.blockNumber,
      miniBlockNumber: Math.min(4, Math.floor((position / total) * 4) + 1),
      sceneNumber: Math.max(1, element.scene),
      createdAt: importedAt,
      updatedAt: importedAt,
    };
  });
}

export function createAfterglowScreenplay(importedAt: string): ScreenplayDocument {
  const document = sourceDocument(importedAt);
  return {
    ...document,
    draftElements: createDeterministicDraft(document, importedAt),
  };
}

const coverageDocument = sourceDocument("2023-08-01T00:00:00.000Z");
const coverageElements = parseScreenplay(coverageDocument);

export const afterglowScreenplayCoverage = {
  source: "Afterglow v9 Twitter Rewrite (2023) — complete screenplay",
  originalTitle: "Afterglow: Echoes of Sentience",
  displayTitle: "Afterglow: Reflections of Sentience",
  author: "Bryan Elgin Harris",
  license: "CC BY-SA 4.0",
  blocks: 24,
  screenplayPages: 80,
  scenes: Math.max(0, ...coverageElements.map((element) => element.scene)),
  elements: coverageElements.filter((element) => editableTypes.includes(element.type as ScreenplayDraftElementType)).length,
} as const;
