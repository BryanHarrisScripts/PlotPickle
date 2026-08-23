import * as core from "./profile-agent-scope-core.mjs";
import type { AuthContext, PlotPickleAuthService } from "../auth/plotpickle-auth";
import type { ProfilePrivateStorageService } from "../storage/profile-private/profile-private-storage";

export type ProfileAgentInstanceInput = Readonly<{
  agentDefinitionId: string;
  projectId?: string | null;
  conversationId: string;
}>;

export type ProfileAgentInstance = Readonly<{
  version: 1;
  scope: "human-profile";
  profileId: string;
  agentDefinitionId: string;
  projectId: string | null;
  conversationId: string;
  instanceId: string;
  authorship: "agent";
  humanCommunityAuthority: false;
}>;

export type AgentBuzzGrant = Readonly<{
  version: 1;
  profileId: string;
  instanceId: string;
  agentDefinitionId: string;
  projectId: string | null;
  conversationId: string;
  roomId: string;
  actions: ReadonlyArray<"read" | "post" | "moderate">;
  authorship: "agent";
  humanSignerSubstitution: false;
  inheritedAcrossRooms: false;
  contentAccess: "room-content-only" | "granted-room-only";
  projectPrivateData: false;
}>;

export type ProfileAgentScopeService = Readonly<{
  resolveInstance(authContext: AuthContext, input: ProfileAgentInstanceInput): ProfileAgentInstance;
  readHumanBuzzIdentity(authContext: AuthContext): Promise<unknown | null>;
  writeHumanBuzzIdentity(authContext: AuthContext, value: unknown): Promise<boolean>;
  writeMemory(authContext: AuthContext, input: ProfileAgentInstanceInput & { readonly value: unknown }): Promise<ProfileAgentInstance & { readonly memoryObjectId: string }>;
  readMemory(authContext: AuthContext, input: ProfileAgentInstanceInput): Promise<unknown | null>;
  grantBuzz(authContext: AuthContext, input: ProfileAgentInstanceInput & { readonly roomId: string; readonly actions: ReadonlyArray<"read" | "post" | "moderate"> }): Promise<AgentBuzzGrant>;
  authorizeBuzz(authContext: AuthContext, input: ProfileAgentInstanceInput & { readonly roomId: string; readonly action: "read" | "post" | "moderate" }): Promise<boolean>;
  describeOperationalAgent(agentDefinitionId: string): Readonly<{
    version: 1;
    scope: "node-operational";
    agentDefinitionId: string;
    humanProfileAccess: false;
    humanVaultAccess: false;
    humanBuzzSignerAccess: false;
    inheritedHumanPermissions: false;
  }>;
}>;

export const PROFILE_AGENT_SCOPE_VERSION = core.PROFILE_AGENT_SCOPE_VERSION as 1;
export const HUMAN_BUZZ_CREDENTIAL = core.HUMAN_BUZZ_CREDENTIAL as "buzz-connection.json";
export const createProfileAgentScopeService = core.createProfileAgentScopeService as (options: {
  readonly authService: Pick<PlotPickleAuthService, "getAuthStatus">;
  readonly privateStorage: Pick<ProfilePrivateStorageService, "readCredential" | "writeCredential" | "readPrivateJson" | "writePrivateJson">;
}) => ProfileAgentScopeService;
