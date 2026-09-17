import { readCredentialJson, writeCredentialJson } from "./local-credentials";
import type { ImageStoryJobClass } from "./media-provider-common";

export type StoryModeJobPreference = "auto" | "local-first" | "cloud-first";
export type StoryModeJobRouteLocality = "local" | "cloud";

export type StoryModeJobRoutingStore = {
  readonly version: 1;
  readonly jobs: Readonly<Record<ImageStoryJobClass, StoryModeJobPreference>>;
  readonly updatedAt: string;
};

export type StoryModeJobRouteCandidate = {
  readonly routeId: string;
  readonly locality: StoryModeJobRouteLocality;
  readonly ready: boolean;
  readonly selected: boolean;
};

export type StoryModeJobRouteResolution = {
  readonly routeId: string;
  readonly locality: StoryModeJobRouteLocality;
  readonly preference: StoryModeJobPreference;
};

const JOB_ROUTING_FILE = "story-mode-job-routing.json";
const IMAGE_JOB_CLASSES: readonly ImageStoryJobClass[] = [
  "image-fast-draft",
  "image-precision-edit",
];

function defaultJobs(): Record<ImageStoryJobClass, StoryModeJobPreference> {
  return {
    "image-fast-draft": "auto",
    "image-precision-edit": "auto",
  };
}

export function isStoryModeImageJobClass(value: unknown): value is ImageStoryJobClass {
  return value === "image-fast-draft" || value === "image-precision-edit";
}

export function isStoryModeJobPreference(value: unknown): value is StoryModeJobPreference {
  return value === "auto" || value === "local-first" || value === "cloud-first";
}

export async function readStoryModeJobRouting(): Promise<StoryModeJobRoutingStore> {
  const stored = await readCredentialJson<unknown>(JOB_ROUTING_FILE);
  const jobs = defaultJobs();
  let updatedAt = "";
  if (stored && typeof stored === "object" && !Array.isArray(stored)) {
    const source = stored as { jobs?: unknown; updatedAt?: unknown };
    if (source.jobs && typeof source.jobs === "object" && !Array.isArray(source.jobs)) {
      const sourceJobs = source.jobs as Record<string, unknown>;
      for (const jobClass of IMAGE_JOB_CLASSES) {
        const preference = sourceJobs[jobClass];
        if (isStoryModeJobPreference(preference)) jobs[jobClass] = preference;
      }
    }
    if (typeof source.updatedAt === "string") updatedAt = source.updatedAt;
  }
  return { version: 1, jobs, updatedAt };
}

export async function writeStoryModeJobRoutingPreference(
  jobClass: ImageStoryJobClass,
  preference: StoryModeJobPreference,
): Promise<StoryModeJobRoutingStore> {
  const current = await readStoryModeJobRouting();
  const next: StoryModeJobRoutingStore = {
    version: 1,
    jobs: { ...current.jobs, [jobClass]: preference },
    updatedAt: new Date().toISOString(),
  };
  await writeCredentialJson(JOB_ROUTING_FILE, next);
  return next;
}

function allowedByPolicy(policy: "local" | "cloud" | "hybrid", locality: StoryModeJobRouteLocality) {
  return policy === "hybrid" || policy === locality;
}

function firstCandidate(
  candidates: readonly StoryModeJobRouteCandidate[],
  locality?: StoryModeJobRouteLocality,
) {
  const matching = locality ? candidates.filter((candidate) => candidate.locality === locality) : candidates;
  return matching.find((candidate) => candidate.selected) ?? matching[0] ?? null;
}

/**
 * Resolve one already-known Story job against ready routes from the existing
 * provider/runtime stores. This is request-specific routing only: it does not
 * mutate provider selection, consent state or creative/canon authority.
 */
export function resolveStoryModeJobRoute(
  policy: "local" | "cloud" | "hybrid",
  preference: StoryModeJobPreference,
  candidates: readonly StoryModeJobRouteCandidate[],
): StoryModeJobRouteResolution {
  const eligible = candidates.filter((candidate) => candidate.ready && allowedByPolicy(policy, candidate.locality));
  if (!eligible.length) {
    throw new Error(`No ready image route satisfies Story Mode ${policy.toUpperCase()}.`);
  }

  let selected: StoryModeJobRouteCandidate | null = null;
  if (preference === "auto") {
    selected = eligible.find((candidate) => candidate.selected) ?? null;
    if (!selected) {
      throw new Error("AUTO Job Routing keeps the currently selected ready image route; choose a route or an explicit locality preference.");
    }
  } else {
    const preferredLocality: StoryModeJobRouteLocality = preference === "local-first" ? "local" : "cloud";
    selected = firstCandidate(eligible, preferredLocality);
    if (!selected && policy === "hybrid") {
      selected = firstCandidate(eligible, preferredLocality === "local" ? "cloud" : "local");
    }
    if (!selected) selected = firstCandidate(eligible);
  }

  if (!selected) throw new Error("No ready image route matches the Job Routing preference.");
  return {
    routeId: selected.routeId,
    locality: selected.locality,
    preference,
  };
}
