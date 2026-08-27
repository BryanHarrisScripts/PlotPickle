export type VisualStoryDecisionSource = {
  readonly decisionId: string;
  readonly baseRevision: string;
  readonly status: string;
  readonly severity: "low" | "medium" | "high";
  readonly question: string;
  readonly targetRefs: readonly string[];
};

export type VisualStoryDecisionMarker = {
  readonly decisionId: string;
  readonly blockId: string;
  readonly status: string;
  readonly severity: "low" | "medium" | "high";
  readonly question: string;
  readonly stale: boolean;
  readonly needsWorkbench: boolean;
};

const HIDDEN_STATUSES = new Set(["superseded", "withdrawn"]);

function canonicalBlockId(targetRef: string) {
  const ppfMatch = /^ppf:build:block:(\d{1,2})(?::|$)/.exec(targetRef);
  const blockMatch = /^block-(\d{1,2})(?::|$)/.exec(targetRef);
  const raw = ppfMatch?.[1] ?? blockMatch?.[1] ?? "";
  const number = Number(raw);
  return Number.isInteger(number) && number >= 1 && number <= 24
    ? `block-${String(number).padStart(2, "0")}`
    : "";
}

/**
 * Story Decisions remain non-canon review records. This adapter only projects
 * explicit Block target refs onto the existing visual story map.
 */
export function deriveVisualStoryDecisionMarkers(
  decisions: readonly VisualStoryDecisionSource[],
  currentRevision: number,
): readonly VisualStoryDecisionMarker[] {
  const markers: VisualStoryDecisionMarker[] = [];
  for (const decision of decisions) {
    if (!decision?.decisionId || HIDDEN_STATUSES.has(decision.status)) continue;
    const blockIds = [...new Set(decision.targetRefs.map(canonicalBlockId).filter(Boolean))];
    for (const blockId of blockIds) {
      markers.push({
        decisionId: decision.decisionId,
        blockId,
        status: decision.status,
        severity: decision.severity,
        question: decision.question,
        stale: decision.status === "stale" || decision.baseRevision !== String(currentRevision),
        needsWorkbench: decision.status === "answered",
      });
    }
  }
  return markers;
}
