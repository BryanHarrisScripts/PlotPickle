import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.join(root, "config", "github-app.json");
const forbiddenKeys = new Set(["clientSecret", "webhookSecret", "privateKey", "accessToken", "refreshToken", "pem"]);

function registrationUrl() {
  const url = new URL("https://github.com/settings/apps/new");
  url.searchParams.set("name", "PlotPickle");
  url.searchParams.set("description", "Local-first story collaboration for PlotPickle projects.");
  url.searchParams.set("url", "https://github.com/BryanHarrisScripts/PlotPickle");
  url.searchParams.set("public", "true");
  url.searchParams.set("webhook_active", "false");
  url.searchParams.set("contents", "write");
  url.searchParams.set("pull_requests", "write");
  url.searchParams.set("administration", "write");
  return url.toString();
}

function openUrl(url) {
  const command = process.platform === "win32" ? "cmd" : process.platform === "darwin" ? "open" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  child.unref();
}

function validClientId(value) {
  return /^[A-Za-z0-9._-]{8,200}$/.test(value);
}

function validSlug(value) {
  return /^[a-z0-9](?:[a-z0-9-]{0,98}[a-z0-9])?$/.test(value) || /^[a-z0-9]$/.test(value);
}

function assertNoSecrets(value, trail = "configuration") {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenKeys.has(key)) throw new Error(`The public GitHub App ${trail} must not contain ${key}.`);
    assertNoSecrets(child, `${trail}.${key}`);
  }
}

function readConfig() {
  const value = JSON.parse(readFileSync(configPath, "utf8"));
  assertNoSecrets(value);
  return value;
}

function configure(clientId, slug) {
  if (!validClientId(clientId)) throw new Error("Provide the public GitHub App client ID shown on the app's General settings page.");
  if (!validSlug(slug)) throw new Error("Provide the GitHub App slug from its public URL.");
  const current = readConfig();
  const next = {
    ...current,
    registrationStatus: "registered",
    clientId,
    slug,
    installUrl: `https://github.com/apps/${slug}/installations/new`,
  };
  assertNoSecrets(next);
  writeFileSync(configPath, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`Configured the public PlotPickle GitHub App at config/github-app.json.`);
  console.log(`Installation URL: ${next.installUrl}`);
  console.log("No client secret, private key, webhook secret or access token was stored.");
}

function verify() {
  const config = readConfig();
  if (config.registrationStatus !== "registered") throw new Error("The official GitHub App still needs owner registration.");
  if (!validClientId(config.clientId)) throw new Error("The packaged client ID is invalid.");
  if (!validSlug(config.slug)) throw new Error("The packaged app slug is invalid.");
  if (config.installUrl !== `https://github.com/apps/${config.slug}/installations/new`) throw new Error("The installation URL does not match the app slug.");
  if (config.deviceFlow !== true || config.expiringUserTokens !== true || config.webhooks !== false) throw new Error("The GitHub App security settings do not match the PlotPickle release contract.");
  if (config.permissions?.metadata !== "read" || config.permissions?.contents !== "write" || config.permissions?.pullRequests !== "write" || config.permissions?.administration !== "write") throw new Error("The GitHub App permissions do not match the PlotPickle release contract.");
  console.log(`Verified PlotPickle GitHub App ${config.slug} (${config.clientId}).`);
}

const [command = "url", clientId = "", slug = ""] = process.argv.slice(2);
if (command === "url") {
  console.log(registrationUrl());
} else if (command === "open") {
  const url = registrationUrl();
  console.log("Opening GitHub's pre-filled PlotPickle App registration page.");
  console.log("After creating the app, enable Device Flow and expiring user authorization tokens in GitHub.");
  openUrl(url);
} else if (command === "configure") {
  configure(clientId, slug);
} else if (command === "verify") {
  verify();
} else {
  throw new Error("Use: url, open, configure <client-id> <app-slug>, or verify.");
}
