import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const folder = path.resolve(process.argv[2] ?? "");
assert.ok(folder && existsSync(folder), "Release package folder does not exist.");
const manifest = JSON.parse(readFileSync(path.join(folder, "release-manifest.json"), "utf8"));
assert.equal(manifest.product, "PlotPickle");
assert.equal(manifest.projectFormat, ".ppf");
assert.equal(manifest.localOnly, true);
for (const file of [
  ".openai/hosting.json",
  "package.json",
  "package-lock.json",
  "vite.config.ts",
  "README.md",
  "worker/index.ts",
  "db/index.ts",
  "lib/project-package.ts",
  "build/local-project-gateway.ts",
  "build/github-app-public-config.ts",
  "build/google-oauth-public-config.ts",
  "build/google-desktop-oauth.ts",
  "config/github-app.json",
  "config/google-oauth.json",
  "config/buzz-desktop.json",
  "schema/plotpickle-github-app-public-config.schema.json",
  "schema/plotpickle-google-oauth-public-config.schema.json",
  "scripts/github-app-registration.mjs",
  "scripts/google-oauth-registration.mjs",
  "scripts/install-buzz-desktop.ps1",
  "scripts/install-local-ai-tool.ps1",
  "scripts/windows-runtime.mjs",
  "scripts/windows-server-smoke.mjs",
]) {
  assert.ok(existsSync(path.join(folder, file)), `Missing packaged file: ${file}`);
}
const githubApp = JSON.parse(readFileSync(path.join(folder, "config", "github-app.json"), "utf8"));
assert.equal(githubApp.registrationStatus, "registered", "The official PlotPickle GitHub App has not been registered for this release.");
assert.match(githubApp.clientId, /^[A-Za-z0-9._-]{8,200}$/);
assert.match(githubApp.slug, /^[a-z0-9-]+$/);
assert.equal(githubApp.installUrl, `https://github.com/apps/${githubApp.slug}/installations/new`);
assert.equal(githubApp.deviceFlow, true);
assert.equal(githubApp.expiringUserTokens, true);
assert.equal(githubApp.webhooks, false);
assert.deepEqual(githubApp.permissions, { metadata: "read", contents: "write", pullRequests: "write", administration: "write" });
const serializedConfig = JSON.stringify(githubApp);
for (const forbidden of ["clientSecret", "webhookSecret", "privateKey", "accessToken", "refreshToken", "pem"]) {
  assert.ok(!serializedConfig.includes(`\"${forbidden}\"`), `Public GitHub App config must not contain ${forbidden}.`);
}
assert.equal(manifest.githubApp?.configPath, "config/github-app.json");
assert.equal(manifest.githubApp?.configured, true);
assert.equal(manifest.githubApp?.registrationStatus, "registered");
assert.equal(manifest.githubApp?.slug, githubApp.slug);

const googleOAuth = JSON.parse(readFileSync(path.join(folder, "config", "google-oauth.json"), "utf8"));
assert.ok(
  ["pending-owner-registration", "registered"].includes(googleOAuth.registrationStatus),
  "The packaged Google Desktop OAuth registration state is invalid.",
);
const googleOAuthConfigured = googleOAuth.registrationStatus === "registered";
if (googleOAuthConfigured) assert.match(googleOAuth.clientId, /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/);
else assert.equal(googleOAuth.clientId, "", "An inactive Google OAuth package must not contain a placeholder Client ID.");
assert.equal(googleOAuth.applicationType, "desktop");
assert.equal(googleOAuth.loopbackRedirect, true);
assert.equal(googleOAuth.pkceMethod, "S256");
assert.equal(googleOAuth.clientSecretPackaged, false);
assert.deepEqual(googleOAuth.identityScopes, ["openid", "email", "profile"]);
assert.deepEqual(googleOAuth.optionalScopes, {
  calendar: "https://www.googleapis.com/auth/calendar.events.owned",
  meet: "https://www.googleapis.com/auth/calendar.events.owned",
});
const serializedGoogleConfig = JSON.stringify(googleOAuth);
for (const forbidden of ["clientSecret", "accessToken", "refreshToken", "authorizationCode", "codeVerifier", "idToken", "privateKey"]) {
  assert.ok(!serializedGoogleConfig.includes(`\"${forbidden}\"`), `Public Google OAuth config must not contain ${forbidden}.`);
}
assert.equal(manifest.googleOAuth?.configPath, "config/google-oauth.json");
assert.equal(manifest.googleOAuth?.configured, googleOAuthConfigured);
assert.equal(manifest.googleOAuth?.registrationStatus, googleOAuth.registrationStatus);
assert.equal(manifest.googleOAuth?.applicationType, "desktop");

const buzzDesktop = JSON.parse(readFileSync(path.join(folder, "config", "buzz-desktop.json"), "utf8"));
assert.equal(buzzDesktop.releaseTag, "desktop-v0.5.3");
assert.equal(buzzDesktop.version, "0.5.3");
assert.equal(buzzDesktop.sourceCommit, "3a96ace");
assert.equal(buzzDesktop.windows.asset, "Buzz_0.5.3_x64-setup_alpha-unsigned.exe");
assert.equal(
  buzzDesktop.windows.downloadUrl,
  "https://github.com/block/buzz/releases/download/desktop-v0.5.3/Buzz_0.5.3_x64-setup_alpha-unsigned.exe",
);
assert.equal(buzzDesktop.windows.unsigned, true);

const launcher = manifest.platform === "windows" ? "Start-PlotPickle.bat" : manifest.platform === "macos" ? "Start-PlotPickle.command" : "start-plotpickle.sh";
assert.ok(existsSync(path.join(folder, launcher)), `Missing ${manifest.platform} launcher.`);
const launcherSource = readFileSync(path.join(folder, launcher), "utf8");
assert.match(launcherSource, /127\.0\.0\.1/);
assert.match(launcherSource, /PlotPickle/);
assert.match(launcherSource, /PLOTPICKLE_GITHUB_APP_CONFIG/);
assert.match(launcherSource, /config[\\/]github-app\.json/);
assert.match(launcherSource, /PLOTPICKLE_GOOGLE_OAUTH_CONFIG/);
assert.match(launcherSource, /config[\\/]google-oauth\.json/);
assert.ok(!launcherSource.includes("0.0.0.0"), "Release launcher must remain loopback-only.");
if (manifest.platform === "windows") {
  assert.match(launcherSource, /scripts\\install-buzz-desktop\.ps1/i);
  assert.match(launcherSource, /scripts\\install-local-ai-tool\.ps1/i);
  assert.match(launcherSource, /Install %LOCAL_AI_TOOL% now\? \[Y\/N\]:/);
  assert.match(launcherSource, /Install Buzz Desktop !BUZZ_DESKTOP_VERSION! now\? \[Y\/N\]:/);
  assert.match(launcherSource, /PlotPickle will continue normally/);
}
console.log(`Verified ${manifest.platform} PlotPickle ${manifest.version} package at ${folder}`);
