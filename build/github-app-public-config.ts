import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type GitHubAppPublicConfig = {
  schemaVersion: 1;
  product: "PlotPickle";
  registrationStatus: "pending-owner-registration" | "registered";
  clientId: string;
  slug: string;
  installUrl: string;
  homepageUrl: string;
  deviceFlow: true;
  expiringUserTokens: true;
  webhooks: false;
  permissions: {
    metadata: "read";
    contents: "write";
    pullRequests: "write";
    administration: "write";
  };
};

export type ResolvedGitHubAppPublicConfig = GitHubAppPublicConfig & {
  configured: boolean;
  source: "environment" | "packaged" | "pending" | "missing";
  configPath: string;
};

const defaultConfigPath = fileURLToPath(new URL("../config/github-app.json", import.meta.url));
const forbiddenKeys = new Set(["clientSecret", "webhookSecret", "privateKey", "accessToken", "refreshToken", "pem"]);

function configuredPath() {
  const override = process.env.PLOTPICKLE_GITHUB_APP_CONFIG?.trim();
  return override ? path.resolve(process.cwd(), override) : defaultConfigPath;
}

function assertNoSecrets(value: unknown, trail = "configuration") {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (forbiddenKeys.has(key)) throw new Error(`The public GitHub App ${trail} must not contain ${key}.`);
    assertNoSecrets(child, `${trail}.${key}`);
  }
}

function validClientId(value: string) {
  return /^[A-Za-z0-9._-]{8,200}$/.test(value);
}

function validSlug(value: string) {
  return /^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/.test(value) || /^[a-z0-9]$/.test(value);
}

function parseConfig(value: unknown): GitHubAppPublicConfig {
  assertNoSecrets(value);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The public GitHub App configuration must be a JSON object.");
  const item = value as Partial<GitHubAppPublicConfig>;
  if (item.schemaVersion !== 1 || item.product !== "PlotPickle") throw new Error("The public GitHub App configuration version is not supported.");
  if (item.registrationStatus !== "pending-owner-registration" && item.registrationStatus !== "registered") throw new Error("The GitHub App registration status is invalid.");
  if (typeof item.clientId !== "string" || typeof item.slug !== "string" || typeof item.installUrl !== "string" || typeof item.homepageUrl !== "string") throw new Error("The public GitHub App configuration is incomplete.");
  if (item.deviceFlow !== true || item.expiringUserTokens !== true || item.webhooks !== false) throw new Error("The public GitHub App security settings do not match the PlotPickle contract.");
  if (!item.permissions || item.permissions.metadata !== "read" || item.permissions.contents !== "write" || item.permissions.pullRequests !== "write" || item.permissions.administration !== "write") throw new Error("The public GitHub App permissions do not match the PlotPickle contract.");
  if (item.registrationStatus === "registered") {
    if (!validClientId(item.clientId)) throw new Error("The packaged GitHub App client ID is invalid.");
    if (!validSlug(item.slug)) throw new Error("The packaged GitHub App slug is invalid.");
    const expectedInstallUrl = `https://github.com/apps/${item.slug}/installations/new`;
    if (item.installUrl !== expectedInstallUrl) throw new Error("The packaged GitHub App installation URL does not match its slug.");
  }
  return item as GitHubAppPublicConfig;
}

function pendingConfig(): GitHubAppPublicConfig {
  return {
    schemaVersion: 1,
    product: "PlotPickle",
    registrationStatus: "pending-owner-registration",
    clientId: "",
    slug: "",
    installUrl: "",
    homepageUrl: "https://github.com/BryanHarrisScripts/PlotPickle",
    deviceFlow: true,
    expiringUserTokens: true,
    webhooks: false,
    permissions: { metadata: "read", contents: "write", pullRequests: "write", administration: "write" },
  };
}

export function resolveGitHubAppPublicConfig(): ResolvedGitHubAppPublicConfig {
  const configPath = configuredPath();
  const packaged = existsSync(configPath)
    ? parseConfig(JSON.parse(readFileSync(configPath, "utf8")) as unknown)
    : pendingConfig();
  const environmentClientId = process.env.PLOTPICKLE_GITHUB_APP_CLIENT_ID?.trim() || "";
  const environmentSlug = process.env.PLOTPICKLE_GITHUB_APP_SLUG?.trim() || "";
  const environmentInstallUrl = process.env.PLOTPICKLE_GITHUB_APP_INSTALL_URL?.trim() || "";
  const environmentConfigured = Boolean(environmentClientId);
  const clientId = environmentClientId || packaged.clientId;
  const slug = environmentSlug || packaged.slug;
  const installUrl = environmentInstallUrl || packaged.installUrl || (slug ? `https://github.com/apps/${slug}/installations/new` : "");
  const configured = Boolean(clientId && validClientId(clientId));
  return {
    ...packaged,
    registrationStatus: configured ? "registered" : packaged.registrationStatus,
    clientId,
    slug,
    installUrl,
    configured,
    source: environmentConfigured ? "environment" : packaged.registrationStatus === "registered" ? "packaged" : existsSync(configPath) ? "pending" : "missing",
    configPath,
  };
}

export function applyGitHubAppPublicConfig() {
  const config = resolveGitHubAppPublicConfig();
  if (config.clientId) process.env.PLOTPICKLE_GITHUB_APP_CLIENT_ID ??= config.clientId;
  if (config.slug) process.env.PLOTPICKLE_GITHUB_APP_SLUG ??= config.slug;
  if (config.installUrl) process.env.PLOTPICKLE_GITHUB_APP_INSTALL_URL ??= config.installUrl;
  return config;
}
