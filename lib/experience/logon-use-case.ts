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
  state: "loading" | "locked" | "authenticated" | "unavailable";
  configured: boolean;
  accessMode: ExperienceAuthSnapshot["accessMode"] | null;
  profiles: readonly ExperienceHumanProfile[];
  activeProfile: ExperienceHumanProfile | null;
  message: string | null;
}>;

export interface ExperienceAuthGateway {
  read(): Promise<ExperienceAuthSnapshot>;
  authenticate(locator: string, credential: string): Promise<ExperienceAuthSnapshot>;
}

function safeLocator(value: string) {
  return value.trim().slice(0, 240);
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
      message: null,
    };
  }

  return {
    surface: "LOGON",
    state: "locked",
    configured: snapshot.configured,
    accessMode: snapshot.accessMode,
    profiles: snapshot.profiles.filter((profile) => profile.status === "active"),
    activeProfile: null,
    message: snapshot.configured ? null : "No Human profile is configured on this PlotPickle Node.",
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
  const locator = safeLocator(input.intent.locator);
  if (!locator || !input.credential) {
    const view = projectLogonViewModel(await input.gateway.read());
    return {
      result: {
        intentId: input.intent.intentId,
        outcome: "rejected",
        revision: null,
        reason: !locator ? "PROFILE_LOCATOR_REQUIRED" : "PROFILE_CREDENTIAL_REQUIRED",
      },
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
      result: {
        intentId: input.intent.intentId,
        outcome: "rejected",
        revision: null,
        reason: error instanceof Error ? error.message : "AUTHENTICATION_FAILED",
      },
      view,
    };
  }
}
