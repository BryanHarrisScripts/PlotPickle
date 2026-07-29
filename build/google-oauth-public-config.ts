import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type GoogleOAuthPublicConfig = {
  schemaVersion: 1;
  product: "PlotPickle";
  registrationStatus: "pending-owner-registration" | "registered";
  applicationType: "desktop";
  clientId: string;
  authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth";
  tokenUrl: "https://oauth2.googleapis.com/token";
  revokeUrl: "https://oauth2.googleapis.com/revoke";
  userInfoUrl: "https://www.googleapis.com/oauth2/v3/userinfo";
  tokenInfoUrl: "https://oauth2.googleapis.com/tokeninfo";
  loopbackRedirect: true;
  pkceMethod: "S256";
  clientSecretPackaged: false;
  identityScopes: ["openid", "email", "profile"];
  optionalScopes: {
    calendar: "https://www.googleapis.com/auth/calendar.events.owned";
    meet: "https://www.googleapis.com/auth/meetings.space.created";
  };
};

export type ResolvedGoogleOAuthPublicConfig = GoogleOAuthPublicConfig & {
  configured: boolean;
  source: "environment" | "packaged" | "pending" | "missing";
  configPath: string;
};

const defaultConfigPath = fileURLToPath(new URL("../config/google-oauth.json", import.meta.url));
const forbiddenKeys = new Set([
  "clientSecret",
  "accessToken",
  "refreshToken",
  "authorizationCode",
  "codeVerifier",
  "idToken",
  "privateKey",
]);

function configuredPath() {
  const override = process.env.PLOTPICKLE_GOOGLE_OAUTH_CONFIG?.trim();
  return override ? path.resolve(process.cwd(), override) : defaultConfigPath;
}

export function validGoogleDesktopClientId(value: string) {
  return /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(value);
}

function assertNoSecrets(value: unknown, trail = "configuration") {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (forbiddenKeys.has(key)) throw new Error(`The public Google OAuth ${trail} must not contain ${key}.`);
    assertNoSecrets(child, `${trail}.${key}`);
  }
}

function parseConfig(value: unknown): GoogleOAuthPublicConfig {
  assertNoSecrets(value);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The public Google OAuth configuration must be a JSON object.");
  const item = value as Partial<GoogleOAuthPublicConfig>;
  if (item.schemaVersion !== 1 || item.product !== "PlotPickle") throw new Error("The public Google OAuth configuration version is not supported.");
  if (item.registrationStatus !== "pending-owner-registration" && item.registrationStatus !== "registered") throw new Error("The Google OAuth registration status is invalid.");
  if (item.applicationType !== "desktop" || item.loopbackRedirect !== true || item.pkceMethod !== "S256" || item.clientSecretPackaged !== false) {
    throw new Error("The Google OAuth desktop security settings do not match the PlotPickle contract.");
  }
  if (typeof item.clientId !== "string") throw new Error("The public Google OAuth client ID is missing.");
  if (item.authorizationUrl !== "https://accounts.google.com/o/oauth2/v2/auth"
    || item.tokenUrl !== "https://oauth2.googleapis.com/token"
    || item.revokeUrl !== "https://oauth2.googleapis.com/revoke"
    || item.userInfoUrl !== "https://www.googleapis.com/oauth2/v3/userinfo"
    || item.tokenInfoUrl !== "https://oauth2.googleapis.com/tokeninfo") {
    throw new Error("The Google OAuth endpoints do not match the PlotPickle desktop contract.");
  }
  if (!Array.isArray(item.identityScopes) || item.identityScopes.join(" ") !== "openid email profile") throw new Error("The Google identity scopes do not match the PlotPickle contract.");
  if (item.optionalScopes?.calendar !== "https://www.googleapis.com/auth/calendar.events.owned"
    || item.optionalScopes?.meet !== "https://www.googleapis.com/auth/meetings.space.created") {
    throw new Error("The optional Google scopes do not match the PlotPickle contract.");
  }
  if (item.registrationStatus === "registered" && !validGoogleDesktopClientId(item.clientId)) throw new Error("The packaged Google Desktop OAuth client ID is invalid.");
  return item as GoogleOAuthPublicConfig;
}

function pendingConfig(): GoogleOAuthPublicConfig {
  return {
    schemaVersion: 1,
    product: "PlotPickle",
    registrationStatus: "pending-owner-registration",
    applicationType: "desktop",
    clientId: "",
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    revokeUrl: "https://oauth2.googleapis.com/revoke",
    userInfoUrl: "https://www.googleapis.com/oauth2/v3/userinfo",
    tokenInfoUrl: "https://oauth2.googleapis.com/tokeninfo",
    loopbackRedirect: true,
    pkceMethod: "S256",
    clientSecretPackaged: false,
    identityScopes: ["openid", "email", "profile"],
    optionalScopes: {
      calendar: "https://www.googleapis.com/auth/calendar.events.owned",
      meet: "https://www.googleapis.com/auth/meetings.space.created",
    },
  };
}

export function resolveGoogleOAuthPublicConfig(): ResolvedGoogleOAuthPublicConfig {
  const configPath = configuredPath();
  const packaged = existsSync(configPath)
    ? parseConfig(JSON.parse(readFileSync(configPath, "utf8")) as unknown)
    : pendingConfig();
  const environmentClientId = process.env.PLOTPICKLE_GOOGLE_CLIENT_ID?.trim() || "";
  const clientId = environmentClientId || packaged.clientId;
  const configured = validGoogleDesktopClientId(clientId);
  return {
    ...packaged,
    registrationStatus: configured ? "registered" : packaged.registrationStatus,
    clientId,
    configured,
    source: environmentClientId ? "environment" : packaged.registrationStatus === "registered" ? "packaged" : existsSync(configPath) ? "pending" : "missing",
    configPath,
  };
}

export function applyGoogleOAuthPublicConfig() {
  const config = resolveGoogleOAuthPublicConfig();
  if (config.clientId) process.env.PLOTPICKLE_GOOGLE_CLIENT_ID ??= config.clientId;
  process.env.PLOTPICKLE_GOOGLE_OAUTH_SOURCE ??= config.source;
  return config;
}
