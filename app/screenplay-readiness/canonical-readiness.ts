import type { PPFProject } from "@/core/project/project";
import { deriveProgressiveStoryMap, type BuildStoryEvidenceState } from "@/modules/build/progressive-story-map";

export type CanonicalReadinessState = BuildStoryEvidenceState | "current" | "needs-review";

export type CanonicalReadinessItem = {
  readonly id: string;
  readonly label: string;
  readonly state: CanonicalReadinessState;
  readonly evidence: string;
  readonly href: string;
  readonly action: string;
};

export type CanonicalScreenplayReadiness = {
  readonly projectTitle: string;
  readonly revision: number;
  readonly frontier: string;
  readonly items: readonly CanonicalReadinessItem[];
};

function countBlocks(states: readonly BuildStoryEvidenceState[], state: BuildStoryEvidenceState) {
  return states.filter((candidate) => candidate === state).length;
}

export function deriveCanonicalScreenplayReadiness(project: PPFProject): CanonicalScreenplayReadiness {
  const storyMap = deriveProgressiveStoryMap(project);
  const blockStates = storyMap.blocks.map((block) => block.state);
  const defined = countBlocks(blockStates, "defined");
  const observed = countBlocks(blockStates, "observed");
  const emerging = countBlocks(blockStates, "emerging");
  const missing = countBlocks(blockStates, "missing");
  const locked = countBlocks(blockStates, "locked");
  const textNeedsReview = storyMap.blocks.filter((block) => block.backgroundText.reviewState === "needs-review").length;
  const shots = project.production.shots;
  const timedShots = shots.filter((shot) => shot.durationSeconds !== null).length;
  const approvedShots = shots.filter((shot) => shot.reviewState === "approved").length;
  const sourceState: CanonicalReadinessState = textNeedsReview
    ? "needs-review"
    : storyMap.importedSourceFileName
      ? emerging > 0 ? "emerging" : "observed"
      : "missing";

  return {
    projectTitle: project.title,
    revision: project.revision,
    frontier: storyMap.frontier,
    items: [
      {
        id: "canonical-project",
        label: "Canonical story project",
        state: "current",
        evidence: `${project.title} · PPF revision ${project.revision}. This page reads the active PPF rather than a second browser story store.`,
        href: "/?workspace=build",
        action: "Open BUILD",
      },
      {
        id: "visual-story-coverage",
        label: "Visual story coverage",
        state: missing === 0 ? (emerging > 0 ? "emerging" : "defined") : "missing",
        evidence: `24 Blocks: ${defined} defined · ${observed} observed · ${emerging} emerging · ${missing} missing · ${locked} locked. Coverage is not a movie-complete percentage.`,
        href: "/?workspace=build",
        action: "Inspect story map",
      },
      {
        id: "background-story-text",
        label: "Background story text",
        state: sourceState,
        evidence: storyMap.importedSourceFileName
          ? textNeedsReview
            ? `${textNeedsReview} Block text projection${textNeedsReview === 1 ? " needs" : "s need"} Human review after a dependency-backed PPF change. The observed source screenplay text remains unchanged.`
            : `${storyMap.observedPassageCount} bounded source passage${storyMap.observedPassageCount === 1 ? "" : "s"} from ${storyMap.importedSourceFileName}. ${emerging > 0 ? "Some Block placement still requires Human review." : "Current imported placement is reviewed."}`
          : "No imported screenplay evidence is attached to the active PPF. PlotPickle does not infer a finished screenplay from visual progress.",
        href: "/?workspace=build",
        action: "Inspect source text",
      },
      {
        id: "production-timing",
        label: "Storyboard and Previs timing",
        state: shots.length ? (timedShots === shots.length ? "defined" : "emerging") : "locked",
        evidence: `${shots.length} canonical Production Shot${shots.length === 1 ? "" : "s"} · ${timedShots} timed · ${approvedShots} approved. Timing remains Human-authored and zero/one/many shots may share a story anchor.`,
        href: shots.length ? "/previs" : "/storyboard",
        action: shots.length ? "Open Previs" : "Open Storyboard",
      },
    ],
  };
}
