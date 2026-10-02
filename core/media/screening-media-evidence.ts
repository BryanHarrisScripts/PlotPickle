import type { PlotPickleMediaEngineEvidence } from "./media-engine-contract";
import type { RoughCutMediaEvidence } from "./timeline-rough-cut-assembly";

export type ScreeningMediaEvidence = Readonly<{
  projectionOnly: true;
  canonical: false;
  roughCutId: string;
  playbackArtifactPaths: readonly string[];
  inspection: Readonly<{
    engineId: string;
    engineVersion: string;
    durationMs: number;
    sourceCount: number;
    sourceRefs: readonly string[];
    diagnosticSummary: readonly string[];
  }> | null;
  stale: boolean;
  state: "ready" | "unavailable" | "failed" | "stale";
  message: string;
}>;

function successfulEvidence(values: readonly PlotPickleMediaEngineEvidence[]) {
  return values.find((evidence) => evidence.state === "succeeded") ?? null;
}

export function projectScreeningMediaEvidence(input: {
  roughCutId: string;
  currentSourceRefs: readonly string[];
  media: RoughCutMediaEvidence | null;
}): ScreeningMediaEvidence {
  if (!input.media || input.media.roughCutId !== input.roughCutId) {
    return { projectionOnly: true, canonical: false, roughCutId: input.roughCutId, playbackArtifactPaths: [], inspection: null, stale: false, state: "unavailable", message: "No optional media-engine evidence is attached to this Rough Cut. Normal Screening remains available." };
  }
  const current = new Set(input.currentSourceRefs);
  const stale = input.media.sourceRefs.some((ref) => !current.has(ref));
  const evidence = successfulEvidence(input.media.engineEvidence);
  if (stale) {
    return { projectionOnly: true, canonical: false, roughCutId: input.roughCutId, playbackArtifactPaths: [], inspection: null, stale: true, state: "stale", message: "Rendered evidence is stale because approved upstream source identity changed. Re-render before relying on it." };
  }
  if (!evidence || input.media.state !== "succeeded") {
    return { projectionOnly: true, canonical: false, roughCutId: input.roughCutId, playbackArtifactPaths: [], inspection: null, stale: false, state: "failed", message: "Optional render evidence is unavailable or failed. Screening observations and Human approval remain valid." };
  }
  return {
    projectionOnly: true,
    canonical: false,
    roughCutId: input.roughCutId,
    playbackArtifactPaths: evidence.artifacts.map((artifact) => artifact.path).filter(Boolean),
    inspection: {
      engineId: evidence.engineId,
      engineVersion: evidence.engineVersion,
      durationMs: evidence.durationMs,
      sourceCount: evidence.sources.length,
      sourceRefs: evidence.sources.flatMap((source) => source.sourceRefs),
      diagnosticSummary: evidence.diagnostics,
    },
    stale: false,
    state: "ready",
    message: "Rendered playback and inspection evidence are available for Human Screening review.",
  };
}

export function screeningRecoveryMessage(state: ScreeningMediaEvidence["state"]) {
  const guidance: Record<ScreeningMediaEvidence["state"], string> = {
    stale: "Retry from the approved Rough Cut after upstream review. Existing project state is unchanged.",
    failed: "Retry or cancel the optional render. Existing project state is unchanged.",
    unavailable: "Continue with normal Screening or install/configure the optional local adapter later.",
    ready: "Review playback and evidence; only explicit Human actions may change project state.",
  };
  return guidance[state];
}
