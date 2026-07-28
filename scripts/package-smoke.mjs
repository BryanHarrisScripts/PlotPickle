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
  "config/github-app.json",
  "schema/plotpickle-github-app-public-config.schema.json",
  "scripts/github-app-registration.mjs",
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
const launcher = manifest.platform === "windows" ? "Start-PlotPickle.bat" : manifest.platform === "macos" ? "Start-PlotPickle.command" : "start-plotpickle.sh";
assert.ok(existsSync(path.join(folder, launcher)), `Missing ${manifest.platform} launcher.`);
const launcherSource = readFileSync(path.join(folder, launcher), "utf8");
assert.match(launcherSource, /127\.0\.0\.1/);
assert.match(launcherSource, /PlotPickle/);
assert.match(launcherSource, /PLOTPICKLE_GITHUB_APP_CONFIG/);
assert.match(launcherSource, /config[\\/]github-app\.json/);
assert.ok(!launcherSource.includes("0.0.0.0"), "Release launcher must remain loopback-only.");
console.log(`Verified ${manifest.platform} PlotPickle ${manifest.version} package at ${folder}`);
