export type ExperienceSurfaceId =
  | "LOGON"
  | "DASHBOARD"
  | "COMMUNITY"
  | "STORY_WORKSPACE"
  | "STORYBOARD"
  | "SETTINGS";

export type ExperienceCapabilityDecision = Readonly<{
  capability: string;
  allowed: boolean;
  reason: string | null;
}>;

export type ExperienceSurface = Readonly<{
  id: ExperienceSurfaceId;
  active: boolean;
  reason: string | null;
  capabilities: readonly ExperienceCapabilityDecision[];
}>;

export type ExperienceSurfaceTopology = Readonly<{
  activeSurfaces: readonly ExperienceSurfaceId[];
  defaultSurface: ExperienceSurfaceId;
  surfaces: readonly ExperienceSurface[];
}>;

export type ExperienceIntent =
  | Readonly<{
      type: "OpenSurface";
      intentId: string;
      surfaceId: ExperienceSurfaceId;
      baseRevision: number | null;
    }>
  | Readonly<{
      type: "AuthenticateHuman";
      intentId: string;
      locator: string;
      baseRevision: null;
    }>
  | Readonly<{
      type: "CreateFirstHumanProfile";
      intentId: string;
      displayName: string;
      baseRevision: null;
    }>
  | Readonly<{
      type: "CompleteFirstHumanProfileSetup";
      intentId: string;
      profileId: string;
      baseRevision: null;
    }>
  | Readonly<{
      type: "SelectBlock";
      intentId: string;
      blockId: string;
      baseRevision: number;
    }>
  | Readonly<{
      type: "SelectMiniBlock";
      intentId: string;
      blockId: string;
      miniBlockNumber: number;
      baseRevision: number;
    }>;

export type ExperienceIntentOutcome = "accepted" | "rejected" | "stale" | "rebased" | "conflict";

export type ExperienceIntentResult = Readonly<{
  intentId: string;
  outcome: ExperienceIntentOutcome;
  revision: number | null;
  reason: string | null;
}>;

export type ExperienceEvent =
  | Readonly<{
      type: "SurfaceTopologyChanged";
      topology: ExperienceSurfaceTopology;
    }>
  | Readonly<{
      type: "AuthenticationStateChanged";
      authenticated: boolean;
      profileId: string | null;
    }>
  | Readonly<{
      type: "IntentResolved";
      result: ExperienceIntentResult;
    }>;
