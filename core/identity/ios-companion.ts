import type { PlotPickleAccountSyncState, PortableLearnState } from "./account-learn-sync";
import * as core from "./ios-companion-core.mjs";

export type IosCompanionCommunityId = "scriptorium" | "atelier" | "workshop" | "engine-room" | "great-hall";
export type IosCompanionTopLevelArea = "learn" | "community";
export type IosCompanionEventType =
  | "message"
  | "agent_request"
  | "agent_response"
  | "job_requested"
  | "job_started"
  | "job_completed"
  | "artifact_ready"
  | "approval_required";

export type IosCompanionSession = {
  readonly version: 1;
  readonly sessionId: string;
  readonly personId: string;
  readonly avatarId: string;
  readonly deviceId: string;
  readonly authenticatedAt: string;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
  readonly topLevelAreas: readonly IosCompanionTopLevelArea[];
  readonly directPpfAccess: false;
  readonly buildUi: false;
  readonly providerConfiguration: false;
  readonly nodeManagement: false;
  readonly shellExecution: false;
};

export const createIosCompanionSession = core.createIosCompanionSession as (
  account: PlotPickleAccountSyncState,
  input: unknown,
) => IosCompanionSession;
export const revokeIosCompanionSession = core.revokeIosCompanionSession as (
  session: IosCompanionSession,
  revokedAt: string,
) => IosCompanionSession;
export const assertIosCompanionSessionActive = core.assertIosCompanionSessionActive as (
  account: PlotPickleAccountSyncState,
  session: IosCompanionSession,
  now?: string,
) => IosCompanionSession;
export const projectIosLearnState = core.projectIosLearnState as (
  account: PlotPickleAccountSyncState,
  session: IosCompanionSession,
  state: PortableLearnState,
  now?: string,
) => unknown;
export const createIosCommunityCatalog = core.createIosCommunityCatalog as (
  account: PlotPickleAccountSyncState,
  session: IosCompanionSession,
  now?: string,
) => unknown;
export const createIosAgentDirectory = core.createIosAgentDirectory as (
  account: PlotPickleAccountSyncState,
  session: IosCompanionSession,
  agentProfiles: readonly unknown[],
  completedMilestones: readonly string[],
  now?: string,
) => unknown;
export const normalizeIosBuzzEvent = core.normalizeIosBuzzEvent as (
  account: PlotPickleAccountSyncState,
  session: IosCompanionSession,
  input: unknown,
  now?: string,
) => unknown;
export const createIosAgentRequest = core.createIosAgentRequest as (
  account: PlotPickleAccountSyncState,
  session: IosCompanionSession,
  agentDirectory: unknown,
  input: unknown,
  now?: string,
) => unknown;

export const IOS_COMPANION_TOP_LEVEL = core.IOS_COMPANION_TOP_LEVEL as readonly IosCompanionTopLevelArea[];
export const IOS_COMPANION_EVENT_TYPES = core.IOS_COMPANION_EVENT_TYPES as readonly IosCompanionEventType[];
export const IOS_COMPANION_COMMUNITIES = core.IOS_COMPANION_COMMUNITIES as readonly Readonly<Record<string, unknown>>[];
export const IOS_COMPANION_SESSION_ALLOWLIST = core.IOS_COMPANION_SESSION_ALLOWLIST as readonly string[];
export const IOS_COMPANION_AGENT_ALLOWLIST = core.IOS_COMPANION_AGENT_ALLOWLIST as readonly string[];
export const IOS_COMPANION_EVENT_ALLOWLIST = core.IOS_COMPANION_EVENT_ALLOWLIST as readonly string[];
