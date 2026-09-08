import type { ExperienceIntent, ExperienceIntentResult } from "../../core/contracts/experience";

export type ExperienceHumanProfile = Readonly<{
  profileId: string;
  displayName: string;
  avatarRef: string | null;
  status: string;
}>;

export type ExperienceAuthSnapshot = Readonly<{
  configured: boolean;
  authenticated: boolean;
  accessMode: "desktop-loopback" | "server-network";
  profiles: readonly ExperienceHumanProfile[];
  profile: ExperienceHumanProfile | null;
  serverReady: boolean;
  readinessReasons: readonly string[];
}>;

export type LogonViewModel = Readonly<{
  surface: "LOGON" | "HOME";
  state: "loading" | "setup" | "locked" | "authenticated" | "unavailable";
  configured: boolean;
  accessMode: ExperienceAuthSnapshot["accessMode"] | null;
  profiles: readonly ExperienceHumanProfile[];
  activeProfile: ExperienceHumanProfile | null;
  requiresBootstrapProof: boolean;
  message: string | null;
}>;

export type FirstProfileRecovery = Readonly<{
  profile: ExperienceHumanProfile;
  recoverySecret: string;
}>;

export interface ExperienceAuthGateway {
  read(): Promise<ExperienceAuthSnapshot>;
  authenticate(locator: string, credential: string): Promise<ExperienceAuthSnapshot>;
  createFirstProfile(input: Readonly<{
    displayName: string;
    credential: string;
    bootstrapProof: string;
  }>): Promise<Readonly<{
    profile: ExperienceHumanProfile;
    recoverySecret: string;
    snapshot: ExperienceAuthSnapshot;
  }>>;
}

function safeText(value: string, maximum = 240) {
  return value.trim().slice(0, maximum);
}

function rejected(intentId: string, reason: string): ExperienceIntentResult {
  return { intentId, outcome: "rejected", revision: null, reason };
}

export function projectLogonViewModel(snapshot: ExperienceAuthSnapshot): LogonViewModel {
  if (!snapshot.serverReady) {
    return {
      surface: "LOGON",
      state: "unavailable",
      configured: snapshot.configured,
      accessMode: snapshot.accessMode,
      profiles: [],
      activeProfile: null,
      requiresBootstrapProof: false,
      message: snapshot.readinessReasons.length
        ? snapshot.readinessReasons.join(", ")
        : "The PlotPickle profile service is not ready.",
    };
  }

  if (snapshot.authenticated && snapshot.profile) {
    return {
      surface: "HOME",
      state: "authenticated",
      configured: snapshot.configured,
      accessMode: snapshot.accessMode,
      profiles: snapshot.profiles,
      activeProfile: snapshot.profile,
      requiresBootstrapProof: false,
      message: null,
    };
  }

  if (!snapshot.configured) {
    return {
      surface: "LOGON",
      state: "setup",
      configured: false,
      accessMode: snapshot.accessMode,
      profiles: [],
      activeProfile: null,
      requiresBootstrapProof: snapshot.accessMode === "server-network",
      message: null,
    };
  }

  return {
    surface: "LOGON",
    state: "locked",
    configured: true,
    accessMode: snapshot.accessMode,
    profiles: snapshot.profiles.filter((profile) => profile.status === "active"),
    activeProfile: null,
    requiresBootstrapProof: false,
    message: null,
  };
}

export async function readLogonViewModel(gateway: ExperienceAuthGateway) {
  return projectLogonViewModel(await gateway.read());
}

export async function executeAuthenticateHumanIntent(input: Readonly<{
  intent: Extract<ExperienceIntent, { type: "AuthenticateHuman" }>;
  credential: string;
  gateway: ExperienceAuthGateway;
}>): Promise<Readonly<{ result: ExperienceIntentResult; view: LogonViewModel }>> {
  const locator = safeText(input.intent.locator);
  if (!locator || !input.credential) {
    const view = projectLogonViewModel(await input.gateway.read());
    return {
      result: rejected(input.intent.intentId, !locator ? "PROFILE_LOCATOR_REQUIRED" : "PROFILE_CREDENTIAL_REQUIRED"),
      view,
    };
  }

  try {
    const snapshot = await input.gateway.authenticate(locator, input.credential);
    const view = projectLogonViewModel(snapshot);
    return {
      result: {
        intentId: input.intent.intentId,
        outcome: view.state === "authenticated" ? "accepted" : "rejected",
        revision: null,
        reason: view.state === "authenticated" ? null : "AUTHENTICATION_NOT_ESTABLISHED",
      },
      view,
    };
  } catch (error) {
    const view = projectLogonViewModel(await input.gateway.read());
    return {
      result: rejected(input.intent.intentId, error instanceof Error ? error.message : "AUTHENTICATION_FAILED"),
      view,
    };
  }
}

export async function executeCreateFirstHumanProfileIntent(input: Readonly<{
  intent: Extract<ExperienceIntent, { type: "CreateFirstHumanProfile" }>;
  credential: string;
  confirmation: string;
  bootstrapProof: string;
  gateway: ExperienceAuthGateway;
}>): Promise<Readonly<{
  result: ExperienceIntentResult;
  view: LogonViewModel;
  recovery: FirstProfileRecovery | null;
}>> {
  const displayName = safeText(input.intent.displayName, 120);
  const current = await input.gateway.read();
  const view = projectLogonViewModel(current);

  if (current.configured) return { result: rejected(input.intent.intentId, "PROFILE_ALREADY_CONFIGURED"), view, recovery: null };
  if (!displayName) return { result: rejected(input.intent.intentId, "PROFILE_DISPLAY_NAME_REQUIRED"), view, recovery: null };
  if (input.credential !== input.confirmation) return { result: rejected(input.intent.intentId, "PROFILE_CREDENTIAL_MISMATCH"), view, recovery: null };
  if (input.credential.length < 12 || /^\d+$/u.test(input.credential)) {
    return { result: rejected(input.intent.intentId, "PROFILE_CREDENTIAL_TOO_WEAK"), view, recovery: null };
  }
  if (current.accessMode === "server-network" && !safeText(input.bootstrapProof)) {
    return { result: rejected(input.intent.intentId, "SERVER_BOOTSTRAP_PROOF_REQUIRED"), view, recovery: null };
  }

  try {
    const created = await input.gateway.createFirstProfile({
      displayName,
      credential: input.credential,
      bootstrapProof: safeText(input.bootstrapProof, 400),
    });
    return {
      result: { intentId: input.intent.intentId, outcome: "accepted", revision: null, reason: null },
      view: projectLogonViewModel(created.snapshot),
      recovery: { profile: created.profile, recoverySecret: created.recoverySecret },
    };
  } catch (error) {
    return {
      result: rejected(input.intent.intentId, error instanceof Error ? error.message : "PROFILE_CREATION_FAILED"),
      view: projectLogonViewModel(await input.gateway.read()),
      recovery: null,
    };
  }
}

export async function executeCompleteFirstHumanProfileSetupIntent(input: Readonly<{
  intent: Extract<ExperienceIntent, { type: "CompleteFirstHumanProfileSetup" }>;
  credential: string;
  recoverySaved: boolean;
  gateway: ExperienceAuthGateway;
}>): Promise<Readonly<{ result: ExperienceIntentResult; view: LogonViewModel }>> {
  if (!input.recoverySaved) {
    return {
      result: rejected(input.intent.intentId, "RECOVERY_ACKNOWLEDGEMENT_REQUIRED"),
      view: projectLogonViewModel(await input.gateway.read()),
    };
  }
  return executeAuthenticateHumanIntent({
    intent: {
      type: "AuthenticateHuman",
      intentId: input.intent.intentId,
      locator: safeText(input.intent.profileId),
      baseRevision: null,
    },
    credential: input.credential,
    gateway: input.gateway,
  });
}
