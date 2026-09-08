import type {
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
 * The Dashboard menu may preview future business surfaces, but those entries
 * remain presentation-only until their use cases are migrated behind this
 * contract. No Skin owns or hardcodes the authoritative active topology.
 */
export function deriveExperienceSurfaceTopology(
  context: ExperienceSurfaceContext,
): ExperienceSurfaceTopology {
  const defaultSurface: ExperienceSurfaceId = context.authenticated ? "DASHBOARD" : "LOGON";
  const activeSurfaces = [defaultSurface] as const;
  const surfaces = KNOWN_SURFACES.map((id) => surface(
    id,
    id === defaultSurface,
    id === defaultSurface ? null : "NOT_MIGRATED_TO_HEADLESS_EXPERIENCE",
  ));

  return {
    activeSurfaces,
    defaultSurface,
    surfaces,
  };
}
