import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const configPath = path.join(root, "config", "google-oauth.json");
const clientsUrl = "https://console.cloud.google.com/auth/clients";
const consentUrl = "https://console.cloud.google.com/auth/branding";
const forbiddenKeys = new Set(["clientSecret", "accessToken", "refreshToken", "authorizationCode", "codeVerifier", "idToken", "privateKey"]);

function openUrl(url) {
  const command = process.platform === "win32" ? "cmd" : process.platform === "darwin" ? "open" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  child.unref();
}

function validClientId(value) {
  return /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/.test(value);
}

function assertNoSecrets(value, trail = "configuration") {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenKeys.has(key)) throw new Error(`The public Google OAuth ${trail} must not contain ${key}.`);
    assertNoSecrets(child, `${trail}.${key}`);
  }
}

function readConfig() {
  const value = JSON.parse(readFileSync(configPath, "utf8"));
  assertNoSecrets(value);
  return value;
}

function configure(clientId) {
  if (!validClientId(clientId)) throw new Error("Provide the public Client ID from a Google OAuth Desktop app client.");
  const current = readConfig();
  const next = { ...current, registrationStatus: "registered", clientId };
  assertNoSecrets(next);
  writeFileSync(configPath, `${JSON.stringify(next, null, 2)}\n`);
  console.log("Configured config/google-oauth.json with the public Google Desktop OAuth Client ID.");
  console.log("No client secret, token, authorization code or PKCE verifier was stored.");
}

function verify() {
  const config = readConfig();
  if (config.registrationStatus !== "registered") throw new Error("The official PlotPickle Google Desktop OAuth client still needs owner registration.");
  if (!validClientId(config.clientId)) throw new Error("The packaged Google Desktop OAuth Client ID is invalid.");
  if (config.applicationType !== "desktop" || config.loopbackRedirect !== true || config.pkceMethod !== "S256" || config.clientSecretPackaged !== false) {
    throw new Error("The Google OAuth desktop security settings do not match the PlotPickle release contract.");
  }
  console.log(`Verified PlotPickle Google Desktop OAuth client ${config.clientId}.`);
}

const [command = "help", clientId = ""] = process.argv.slice(2);
if (command === "open") {
  console.log("Opening Google Auth Platform. Configure Branding and Audience, then create an OAuth Client with application type Desktop app.");
  openUrl(consentUrl);
  setTimeout(() => openUrl(clientsUrl), 400);
} else if (command === "clients") {
  console.log(clientsUrl);
} else if (command === "configure") {
  configure(clientId);
} else if (command === "verify") {
  verify();
} else {
  console.log("Use: open, clients, configure <desktop-client-id>, or verify.");
}
