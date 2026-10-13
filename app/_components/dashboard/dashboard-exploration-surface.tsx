"use client";

import { lazy, Suspense } from "react";
import { creativeFocusPlotPickleCurriculum } from "../../../adapters/curriculum/issue-2900-current-presentation";

const EditWorkspace = lazy(() => import("../../edit-workspace"));
const ReportsPage = lazy(() => import("../../reports/page"));
const DiagnosticCraftPage = lazy(() => import("../../diagnostics/page"));
const FeedbackPage = lazy(() => import("../../feedback/page"));
const PitchReviewPage = lazy(() => import("../../pitch-review/page"));
const WyrmwoodWorkspace = lazy(() => import("../../../modules/wyrmwood/ui/wyrmwood-workspace"));
const StoryZeroWorkspace = lazy(() => import("../story/story-zero-workspace"));

export type DashboardExplorationWorkspace = "reports" | "edit" | "refine" | "feedback" | "pitch-deck" | "pitch-package" | "wyrmwood" | "story";

/** The Matrix host owns entry/return; these are the retained canonical workspace implementations. */
export function isDashboardExplorationWorkspace(id: string): id is DashboardExplorationWorkspace {
  switch (id) {
    case "reports":
    case "edit":
    case "refine":
    case "feedback":
    case "pitch-deck":
    case "pitch-package":
    case "wyrmwood":
    case "story":
      return true;
    default:
      return false;
  }
}

export default function DashboardExplorationSurface({
  workspace,
  onOpenLearn,
  onOpenOutline,
}: {
  readonly workspace: DashboardExplorationWorkspace;
  readonly onOpenLearn: () => void;
  readonly onOpenOutline: () => void;
}) {
  return <div style={{ minWidth: 0, maxWidth: "100%", overflow: "auto" }}><Suspense fallback={<p role="status">Opening {workspace}…</p>}>
    {workspace === "reports" ? <ReportsPage />
      : workspace === "edit" ? <EditWorkspace />
        : workspace === "refine" ? <DiagnosticCraftPage />
          : workspace === "feedback" ? <FeedbackPage />
            : workspace === "pitch-deck" || workspace === "pitch-package" ? <PitchReviewPage key={workspace} />
              : workspace === "wyrmwood" ? <WyrmwoodWorkspace curriculum={creativeFocusPlotPickleCurriculum} onOpenLearn={onOpenLearn} onOpenPlan={onOpenOutline} />
                : <StoryZeroWorkspace />}
  </Suspense></div>;
}
