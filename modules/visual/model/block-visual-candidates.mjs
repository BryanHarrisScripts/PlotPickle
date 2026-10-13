/**
 * PP-IMG-RETRY-001 v1.0: one story address owns its own candidate history.
 * Rejected images remain evidence but never become an active first frame.
 * An existing Human-accepted first frame outranks newer draft generations.
 * Pure selection: no provider, storage, approval or source mutation.
 */
function candidatesForAddress(artifacts, anchor, source, workflow) {
  return artifacts.filter((artifact) =>
    artifact.workflow === workflow
    && (artifact.sourceDecisionKeys ?? []).includes(anchor)
    && (artifact.sourceDecisionKeys ?? []).includes(source)
  ).slice().sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt) || right.id.localeCompare(left.id)
  );
}

export function firstImageHistory(artifacts, anchor, source, workflow) {
  return candidatesForAddress(artifacts, anchor, source, workflow)
    .filter((artifact) => (artifact.frameNumber ?? 1) === 1);
}

export function canRejectFirstImage(artifact, acceptedIds) {
  return Boolean(artifact && artifact.reviewState !== "rejected"
    && artifact.reviewState !== "accepted"
    && !acceptedIds.has(artifact.id));
}

export function visualSequenceForAddress(artifacts, anchor, source, workflow, acceptedIds) {
  const matching = candidatesForAddress(artifacts, anchor, source, workflow);
  const firstCandidates = matching.filter((artifact) => (artifact.frameNumber ?? 1) === 1);
  const first = firstCandidates.find((artifact) =>
    artifact.reviewState === "accepted" && acceptedIds.has(artifact.id)
  ) ?? firstCandidates.find((artifact) => artifact.reviewState !== "rejected");
  const byFrame = new Map();
  if (first) byFrame.set(1, first);
  for (const artifact of matching) {
    const frame = artifact.frameNumber ?? 1;
    if (frame === 1 || artifact.reviewState === "rejected" || byFrame.has(frame)) continue;
    byFrame.set(frame, artifact);
  }
  return [...byFrame.values()].sort((left, right) =>
    (left.frameNumber ?? 1) - (right.frameNumber ?? 1)
  );
}
