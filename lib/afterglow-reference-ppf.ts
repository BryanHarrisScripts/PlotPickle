import archivedV10Source from "@/data/afterglow-v10-screenplay-source.txt?raw";
import { createAfterglowProject } from "@/data/afterglow";
import { packageProject } from "./ppf-exchange";
import {
  createScreenplayRevisionWorkspace,
  withScreenplayRevisionWorkspace,
  type ScreenplayRevisionElement,
  type ScreenplayRevisionSource,
} from "./screenplay-revisions";

export const AFTERGLOW_REFERENCE_PPF_FILENAME = "Afterglow.ppf";
export const AFTERGLOW_V9_SOURCE_SHA = "54b5967644c5a41363fa88f57b02473ea758acc2";
export const AFTERGLOW_V10_SOURCE_SHA = "042427931c4a74a5dbe48e05750aea66f6b2486e";

const V9_SOURCE_ID = "afterglow-v9-complete-baseline";
const V10_SOURCE_ID = "afterglow-v10-partial-rewrite";

type ArchivedV10Element = Omit<ScreenplayRevisionElement, "id">;

export function extractAfterglowV10RevisionElements(source = archivedV10Source): ScreenplayRevisionElement[] {
  const match = source.match(/const sourceElements: SourceElement\[\] = (\[[\s\S]*?\n\]);\n\nfunction fountainLine/);
  if (!match) throw new Error("The archived Afterglow v10 sourceElements fixture could not be read.");
  const elements = JSON.parse(match[1]) as ArchivedV10Element[];
  return elements.map((element, index) => ({
    ...element,
    id: `afterglow-v10-${String(index + 1).padStart(3, "0")}`,
  }));
}

export function createAfterglowRevisionProject() {
  const project = createAfterglowProject();
  const v10Elements = extractAfterglowV10RevisionElements();
  const v9Source: ScreenplayRevisionSource = {
    id: V9_SOURCE_ID,
    label: "Afterglow v9 — Complete 2023 Baseline",
    role: "canonical-baseline",
    immutable: true,
    sourceFileName: "Afterglow v9 Twitter Rewrite Bryan E. Harris 2023.fdx",
    sourceSha: AFTERGLOW_V9_SOURCE_SHA,
    sourceVersion: "v9",
    elementMode: "canonical-project",
    attemptedBlocks: Array.from({ length: 24 }, (_, index) => index + 1),
    notAttemptedBlocks: [],
    elements: [],
    notes: "The canonical project screenplay is the complete v9 baseline through THE END.",
  };
  const v10Source: ScreenplayRevisionSource = {
    id: V10_SOURCE_ID,
    label: "Afterglow v10 — Unfinished Blocks 1–8 Rewrite",
    role: "partial-rewrite",
    immutable: true,
    sourceFileName: "Afterglow v10 X Rewrite Bryan E. Harris 2023.pdf",
    sourceSha: AFTERGLOW_V10_SOURCE_SHA,
    sourceVersion: "v10",
    elementMode: "embedded",
    attemptedBlocks: Array.from({ length: 8 }, (_, index) => index + 1),
    notAttemptedBlocks: Array.from({ length: 16 }, (_, index) => index + 9),
    elements: v10Elements,
    notes: "Blocks 1–8 are a real partial rewrite. Blocks 9–24 were not attempted and must never be interpreted as deletions.",
  };
  const workspace = createScreenplayRevisionWorkspace({
    canonicalSourceId: V9_SOURCE_ID,
    sources: [v9Source, v10Source],
    createdAt: project.metadata.updatedAt,
  });
  return withScreenplayRevisionWorkspace(project, workspace);
}

export function createAfterglowReferencePpf() {
  const project = createAfterglowRevisionProject();
  return packageProject(project, {
    kind: "complete-project",
    rightsConfirmed: true,
    createdAt: project.metadata.updatedAt,
  });
}
