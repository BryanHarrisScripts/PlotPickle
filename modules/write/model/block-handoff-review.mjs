/**
 * #2977. Read-only selected-PPF handoff census, not an Outline acceptance
 * command, Storyboard readiness certification or execution scheduler.
 * Keep accepted Plans separate from advisory Story Architect assessments.
 */
export function reviewBlockHandoff(project, blockNumber, { currentAssessment = false } = {}) {
  if (!project || typeof project.id !== "string" || !project.id.trim()) {
    throw new Error("Load the owning Library PPF before preparing a Block handoff.");
  }
  if (!Number.isInteger(blockNumber) || blockNumber < 1 || blockNumber > 24) {
    throw new RangeError("A Block handoff must address one of the canonical 24 Blocks.");
  }
  const block = project.structure?.blocks?.find((candidate) => candidate.number === blockNumber);
  if (!block || block.miniBlocks?.length !== 4
      || new Set(block.miniBlocks.map((mini) => mini.ordinal)).size !== 4
      || block.miniBlocks.some((mini) => !Number.isInteger(mini.ordinal) || mini.ordinal < 1 || mini.ordinal > 4)) {
    throw new Error("The selected PPF does not have four valid Mini-Block addresses for this Block.");
  }

  const screenplay = project.sourceEvidence?.screenplay;
  const passages = Array.isArray(screenplay?.passages) ? screenplay.passages : [];
  const writing = Array.isArray(project.writing?.entries) ? project.writing.entries : [];
  const miniBlocks = [...block.miniBlocks].sort((a, b) => a.ordinal - b.ordinal).map((mini) => {
    const plan = mini.stages?.plan;
    const planAccepted = plan?.state === "accepted"
      && typeof plan?.acceptedAt === "string" && Boolean(plan.acceptedAt.trim())
      && typeof plan?.content === "string" && Boolean(plan.content.trim());
    const importedPassages = passages.filter((p) => p.blockNumber === blockNumber && p.miniBlockNumber === mini.ordinal).length;
    const savedWriting = writing.some((entry) => entry.blockNumber === blockNumber
      && entry.miniBlockNumber === mini.ordinal && typeof entry.text === "string" && Boolean(entry.text.trim()));
    return Object.freeze({
      ordinal: mini.ordinal,
      address: String(blockNumber) + "." + mini.ordinal,
      planAccepted,
      planState: plan?.state || "unavailable",
      importedPassages,
      savedWriting,
    });
  });

  const title = typeof project.title === "string" ? project.title.trim() : "";
  const titleNeedsReview = !title || !/[a-z0-9]/iu.test(title);
  const acceptedCount = miniBlocks.filter((mini) => mini.planAccepted).length;
  return Object.freeze({
    projectId: project.id,
    revision: project.revision,
    title,
    titleNeedsReview,
    blockNumber,
    blockId: block.id,
    miniBlocks: Object.freeze(miniBlocks),
    acceptedCount,
    allPlansAccepted: acceptedCount === 4,
    mappedSourcePassages: miniBlocks.reduce((sum, mini) => sum + mini.importedPassages, 0),
    savedWritingCount: miniBlocks.filter((mini) => mini.savedWriting).length,
    currentAssessment: Boolean(currentAssessment), // advisory, never approval
    sourceIsPartial: screenplay?.passagesTruncated === true,
    status: acceptedCount === 4 ? "ready-for-proposal-preparation" : "requires-human-outline-review",
  });
}
