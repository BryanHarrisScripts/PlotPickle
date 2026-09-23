import { blockWritingEntry } from "../../core/contracts/block-writing";
import { normalizeProjectSourceEvidence } from "../../core/contracts/imported-screenplay-evidence";
import type { LibraryPPFProject } from "../../core/storage/library-project";
import { currentOutlineAssessment } from "./outline-agent-assessment";

export type OutlineReadinessStatus = "ready" | "review" | "needs-support";
export type OutlineBlockReadiness = {
  readonly blockNumber: number;
  readonly status: OutlineReadinessStatus;
  readonly issues: readonly string[];
  readonly unsupportedMiniBlocks: readonly number[];
};

/** Read-only evidence check. Observed script coverage alone never asserts storyboard readiness. */
export function deriveOutlineReadiness(project: LibraryPPFProject): readonly OutlineBlockReadiness[] {
  const evidence = normalizeProjectSourceEvidence(project.sourceEvidence);
  const screenplay = evidence.screenplay;
  return project.structure.blocks.map((block) => {
    const support: string[] = [];
    const review: string[] = [];
    const passages = screenplay?.passages.filter((passage) => passage.blockNumber === block.number) ?? [];
    const saved = block.miniBlocks.map((mini) => blockWritingEntry(project.writing, { blockNumber: block.number, miniBlockNumber: mini.ordinal }));
    const finding = evidence.storyMatrix?.blocks.find((cell) => cell.blockNumber === block.number)?.structuralFinding;
    const assessment = currentOutlineAssessment(project, block.number);
    const stale = screenplay?.projectionReviews?.some((item) => item.blockNumber === block.number && item.state === "needs-review");
    if (!passages.length && !saved.some(Boolean)) support.push("No screenplay text is mapped or saved at this Block.");
    if (stale) support.push("This Block's screenplay placement needs review after a source or planning change.");
    if (finding?.reviewedAt && (finding.state === "gap-underdeveloped" || finding.state === "unresolved")) support.push(`Reviewed structure: ${finding.reason.trim().slice(0, 180) || finding.state}.`);
    if (!finding?.reviewedAt && !assessment) review.push("Story Architect has not assessed this Block's structural responsibility against its script.");
    if (assessment?.structural.state === "gap-underdeveloped") support.push(`Story Architect finds a structural gap: ${assessment.structural.reason.slice(0, 180)}`);
    if (assessment?.structural.state === "unresolved") review.push(`Story Architect cannot confirm structural coverage: ${assessment.structural.reason.slice(0, 180)}`);
    const matrix = evidence.storyMatrix?.blocks.find((cell) => cell.blockNumber === block.number);
    if (matrix?.sourceMappings.some((mapping) => mapping.mappingMethod === "page-progress-fallback" && !mapping.candidateOnly)) review.push("Screenplay placement uses page progress rather than a confirmed structural match.");
    if (finding?.reviewedAt && !finding.reason.trim()) review.push("The reviewed structural finding has no evidence-backed reason.");
    if (matrix && !matrix.responsibility.trim()) support.push("Structural responsibility has no defined purpose.");
    if (passages.length && screenplay?.analysisStatus !== "reviewed") review.push("Imported screenplay placement is still suggested.");
    if (!block.note.trim() && !assessment) review.push("Story Card intent has no Block note or agent assessment yet.");
    const unsupportedMiniBlocks = block.miniBlocks.filter((mini) => {
      const hasSaved = saved[mini.ordinal - 1];
      const hasSource = passages.some((passage) => passage.miniBlockNumber === mini.ordinal);
      return !hasSaved && !hasSource && !mini.note.trim();
    }).map((mini) => mini.ordinal);
    if (unsupportedMiniBlocks.length) support.push(`Mini-Blocks ${unsupportedMiniBlocks.join(", ")} have no script or planned intent.`);
    const unreviewedArc = evidence.characterTruth?.arcCells.some((cell) => cell.blockNumber === block.number && cell.passageIds.length > 0 && cell.reviewState === "unreviewed");
    if (unreviewedArc && !assessment) review.push("Observed character evidence still needs an agent assessment.");
    if (assessment?.characters.some((cell) => cell.state === "unresolved-insufficient-evidence" && cell.passageIds.length)) review.push("Story Architect could not establish the character change from the cited passages.");
    if (assessment?.miniBlocks.some((mini) => mini.state === "unsupported")) support.push(`Story Architect finds Mini-Block support missing at ${assessment.miniBlocks.filter((mini) => mini.state === "unsupported").map((mini) => mini.ordinal).join(", ")}.`);
    if (assessment?.miniBlocks.some((mini) => mini.state === "partial")) review.push(`Story Architect finds partial Mini-Block support at ${assessment.miniBlocks.filter((mini) => mini.state === "partial").map((mini) => mini.ordinal).join(", ")}.`);
    return {
      blockNumber: block.number,
      status: support.length ? "needs-support" : review.length ? "review" : "ready",
      issues: [...support, ...review],
      unsupportedMiniBlocks,
    };
  });
}
