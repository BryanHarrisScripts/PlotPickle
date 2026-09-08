import type {
  ExperienceSurface,
  ExperienceSurfaceId,
  ExperienceSurfaceTopology,
} from "../../core/contracts/experience";

const KNOWN_SURFACES: readonly ExperienceSurfaceId[] = [
  "LOGON",
  "HOME",
  "COMMUNITY",
  "STORY_WORKSPACE",
  "STORYBOARD",
  "SETTINGS",
];

export type BarebonesSurfaceContext = Readonly<{
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
 * The first Business Use Case is deliberately tiny: a locked Human sees only
 * LOGON; an authenticated Human sees only HOME. Future surfaces stay known to
 * the Experience layer but are not exposed until their use cases are migrated
 * behind the same contract.
 */
export function deriveBarebonesSurfaceTopology(
  context: BarebonesSurfaceContext,
): ExperienceSurfaceTopology {
  const defaultSurface: ExperienceSurfaceId = context.authenticated ? "HOME" : "LOGON";
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
