import {
  createBlankProductionDraftState,
  type ScreenplayDocument,
} from "../project";
import {
  createPortableProjectFile,
  portableProjectFileName,
  serializePortableProjectFile,
} from "../persistence/project-package";
import { createProjectFromScreenplay } from "./screenplay-import";
import { screenplayFormatForFile } from "./screenplay";
import { analyzeScreenplayText } from "./pdf-screenplay-import";

export type ScreenplayToPpfInput = {
  readonly fileName: string;
  readonly sourceText: string;
  readonly importedAt?: string;
  readonly applicationVersion?: string;
};

export type ScreenplayToPpfResult = {
  readonly fileName: string;
  readonly serializedPpf: string;
  readonly projectId: string;
  readonly projectTitle: string;
  readonly sourceFileName: string;
  readonly sourcePassageCount: number;
  readonly sourceSceneCount: number;
  readonly pdfWarnings: readonly string[];
};

function requireSourceText(sourceText: string) {
  const normalized = sourceText.replace(/\u0000/g, "").trim();
  if (normalized.length < 40) {
    throw new Error("The screenplay source did not contain enough readable text to convert into a PlotPickle PPF.");
  }
  return normalized;
}

/**
 * Compose the existing screenplay parser, rich importer and portable PPF package.
 * This is intentionally a thin conversion seam: it does not create another
 * screenplay model, PPF format, or story database.
 */
export function convertScreenplayTextToPpf(input: ScreenplayToPpfInput): ScreenplayToPpfResult {
  const importedAt = input.importedAt || new Date().toISOString();
  const sourceText = requireSourceText(input.sourceText);
  const pdfAnalysis = input.fileName.toLowerCase().endsWith(".pdf")
    ? analyzeScreenplayText(sourceText, input.fileName, importedAt)
    : null;

  if (pdfAnalysis?.scannedLikely) {
    throw new Error("This PDF appears to contain scanned or image-only pages. PlotPickle does not run hidden OCR; use a text-based PDF, Final Draft, Fountain, or plain screenplay file.");
  }
  if (pdfAnalysis && !pdfAnalysis.supported) {
    throw new Error(pdfAnalysis.warnings[0] || "This PDF does not contain enough screenplay structure to convert safely.");
  }

  const screenplay: ScreenplayDocument = {
    fileName: input.fileName,
    format: screenplayFormatForFile(input.fileName),
    sourceText,
    importedAt,
    analysisStatus: "none",
    analyzedAt: "",
    suggestedFields: [],
    draftElements: [],
    productionDraft: createBlankProductionDraftState(),
  };
  const project = createProjectFromScreenplay(screenplay);
  const portable = createPortableProjectFile(
    project,
    input.applicationVersion || "1.0.0-rc.3",
    [],
    importedAt,
  );

  return {
    fileName: portableProjectFileName(project),
    serializedPpf: serializePortableProjectFile(portable),
    projectId: project.id,
    projectTitle: project.metadata.title,
    sourceFileName: project.screenplay.fileName,
    sourcePassageCount: project.screenplay.draftElements.length,
    sourceSceneCount: new Set(project.screenplay.draftElements.map((element) => element.sceneNumber)).size,
    pdfWarnings: pdfAnalysis?.warnings ?? [],
  };
}
