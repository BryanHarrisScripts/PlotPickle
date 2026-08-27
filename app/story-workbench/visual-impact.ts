export type WorkbenchProjectionImpact = Readonly<{
  id: string;
  label: string;
  href: string;
  state: "will-update" | "needs-review" | "may-stale";
  ref: string;
  explanation: string;
}>;

function unique(values: readonly string[]) {
  return values.filter((value, index, all) => Boolean(value) && all.indexOf(value) === index);
}

export function deriveWorkbenchProjectionImpacts(input: {
  readonly selectedTargetRef: string;
  readonly explainableRefs: readonly string[];
  readonly requiresCanonApply: boolean;
}): readonly WorkbenchProjectionImpact[] {
  if (!input.requiresCanonApply) return [];

  const refs = unique([input.selectedTargetRef, ...input.explainableRefs]);
  const impacts: WorkbenchProjectionImpact[] = [];
  const add = (impact: WorkbenchProjectionImpact) => {
    if (!impacts.some((candidate) => candidate.id === impact.id && candidate.ref === impact.ref)) impacts.push(impact);
  };

  for (const ref of refs) {
    if (/^ppf:(?:foundations|world|structure|block|scene)|block|sequence|story-map/i.test(ref)) {
      add({
        id: "visual-story",
        label: "Visual story state",
        href: "/?workspace=build",
        state: "will-update",
        ref,
        explanation: "The canonical story target changes first. BUILD re-derives its visible state from that same PPF rather than copying it into a second model.",
      });
    }
    if (/screenplay|script|draft|text/i.test(ref)) {
      add({
        id: "background-text",
        label: "Background story text",
        href: "/screenplay-readiness",
        state: "needs-review",
        ref,
        explanation: "Affected text stays provenance-bound. PlotPickle marks the projection for review instead of silently rewriting source or Human-authored screenplay text.",
      });
    }
    if (/visual|storyboard|frame|character-visual|location-visual/i.test(ref)) {
      add({
        id: "storyboard",
        label: "Storyboard / visual identity",
        href: "/storyboard",
        state: "may-stale",
        ref,
        explanation: "Only dependency-backed visual targets may become stale. Existing kept visuals remain Human-approved until their own upstream evidence changes.",
      });
    }
    if (/shot|previs|animatic|production/i.test(ref)) {
      add({
        id: "previs",
        label: "Production Shot / Previs",
        href: "/previs",
        state: "may-stale",
        ref,
        explanation: "Only Production Shots or timed segments linked to this exact dependency may become stale; unrelated timing and approved assets stay current.",
      });
    }
  }

  if (!impacts.length && input.selectedTargetRef) {
    impacts.push({
      id: "canonical-target",
      label: "Canonical story target",
      href: "/?workspace=build",
      state: "will-update",
      ref: input.selectedTargetRef,
      explanation: "This change applies to one canonical PPF target. No downstream visual or script projection is claimed affected without dependency evidence.",
    });
  }

  return impacts;
}
