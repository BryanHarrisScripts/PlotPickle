import type { PlotPickleProject } from "./project";

export type AfterglowLegacyVisualKind = "overview" | "plot" | "theme" | "block-cover" | "placeholder" | "unmapped";
export type AfterglowMappingStatus = "confirmed" | "proposed" | "unmapped" | "placeholder" | "retired";

export type AfterglowLegacyVisual = {
  id: string;
  title: string;
  kind: AfterglowLegacyVisualKind;
  summary: string;
  images: { thumb: string; card: string; full: string; width: number; height: number };
  proposedBlockNumbers: number[];
  mappingStatus: AfterglowMappingStatus;
  mappingNote: string;
  characterIds: string[];
  locationIds: string[];
  tags: string[];
  source: {
    repository: string;
    path: string;
    originalFilename: string;
    originalSha: string;
    prompt: string;
    creator: string;
    generated: boolean | "unknown";
    rightsNote: string;
  };
};

export type AfterglowVisualDecision = {
  referenceId: string;
  title: string;
  action: "pin-reference" | "approve-block-cover" | "pitch-reference" | "retire";
  scope: "project" | "pitch" | "block";
  target: string;
  writerNote: string;
};

export function isAfterglowProject(project: PlotPickleProject) {
  return /afterglow/i.test(project.metadata.title) || /afterglow/i.test(project.collaboration.sourceRepositoryUrl);
}

export function visibleAfterglowVisuals(visuals: AfterglowLegacyVisual[]) {
  return visuals.filter((visual) => visual.kind !== "placeholder" && visual.mappingStatus !== "retired");
}

export function afterglowVisualsForBlock(visuals: AfterglowLegacyVisual[], blockNumber: number) {
  return visibleAfterglowVisuals(visuals).filter((visual) => visual.proposedBlockNumbers.includes(blockNumber));
}

export function afterglowOverviewVisuals(visuals: AfterglowLegacyVisual[]) {
  return visibleAfterglowVisuals(visuals).filter((visual) => ["overview", "plot", "theme"].includes(visual.kind));
}

export function afterglowMappingSummary(visuals: AfterglowLegacyVisual[]) {
  const visible = visibleAfterglowVisuals(visuals);
  return {
    total: visuals.length,
    retained: visible.length,
    mappedStoryVisuals: visible.filter((visual) => visual.kind === "block-cover" && visual.proposedBlockNumbers.length).length,
    proposed: visible.filter((visual) => visual.mappingStatus === "proposed").length,
    unresolved: visible.filter((visual) => visual.mappingStatus === "unmapped").length,
    placeholders: visuals.filter((visual) => visual.kind === "placeholder").length,
    missingUniqueBlockCoverage: Array.from({ length: 8 }, (_, index) => index + 17),
  };
}

export function legacyVisualProposalText(visual: AfterglowLegacyVisual, decision: AfterglowVisualDecision) {
  return [
    `Legacy Afterglow visual: ${visual.title}`,
    `Action: ${decision.action}`,
    `Scope: ${decision.scope}`,
    `Target: ${decision.target}`,
    `Mapping status: ${visual.mappingStatus}`,
    `Proposed Blocks: ${visual.proposedBlockNumbers.join(", ") || "none"}`,
    `Source filename: ${visual.source.originalFilename}`,
    `Source SHA: ${visual.source.originalSha}`,
    `Writer note: ${decision.writerNote || "No added note."}`,
    "This decision references a bundled legacy source visual. It does not duplicate the image into project data. It does not classify it as a new AI generation event.",
  ].join("\n");
}
