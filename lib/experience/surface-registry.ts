import type {
  ExperienceIntent,
  ExperienceIntentResult,
  ExperienceSurface,
  ExperienceSurfaceId,
  ExperienceSurfaceTopology,
} from "../../core/contracts/experience";

const KNOWN_SURFACES: readonly ExperienceSurfaceId[] = [
  "LOGON",
  "DASHBOARD",
  "COMMUNITY",
  "STORY_WORKSPACE",
  "STORYBOARD",
  "SETTINGS",
];

export type ExperienceSurfaceContext = Readonly<{
  authenticated: boolean;
}>;

function surface(id: ExperienceSurfaceId, active: boolean, reason: string | null): ExperienceSurface {
  return {
    id,
    active,
    reason,
    capabilities: [],
  };
}

/**
 * ARCH-01 bootstrap topology.
 *
 * A locked Human sees only LOGON. An authenticated Human enters DASHBOARD.
 * Community reuses its existing capability through an app-owned host. Other entries
 * remain presentation-only until their use cases are migrated behind this
 * contract. No Skin owns or hardcodes the authoritative active topology.
 */
export function deriveExperienceSurfaceTopology(
  context: ExperienceSurfaceContext,
): ExperienceSurfaceTopology {
  const defaultSurface: ExperienceSurfaceId = context.authenticated ? "DASHBOARD" : "LOGON";
  const activeSurfaces: readonly ExperienceSurfaceId[] = context.authenticated
    ? ["DASHBOARD", "COMMUNITY"]
    : ["LOGON"];
  const surfaces = KNOWN_SURFACES.map((id) => surface(
    id,
    activeSurfaces.includes(id),
    activeSurfaces.includes(id) ? null : "NOT_MIGRATED_TO_HEADLESS_EXPERIENCE",
  ));

  return {
    activeSurfaces,
    defaultSurface,
    surfaces,
  };
}

/** Navigation grants no room, publication, or Canon authority. */
export function executeOpenSurfaceIntent(
  intent: Extract<ExperienceIntent, { type: "OpenSurface" }>,
  context: ExperienceSurfaceContext,
): ExperienceIntentResult {
  const target = deriveExperienceSurfaceTopology(context).surfaces.find((item) => item.id === intent.surfaceId);
  return {
    intentId: intent.intentId,
    outcome: target?.active ? "accepted" : "rejected",
    revision: null,
    reason: target?.active ? null : target?.reason ?? "UNKNOWN_SURFACE",
  };
}
