import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const text = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("credential registry documents every release credential boundary", async () => {
  const registry = JSON.parse(await text("config/credential-boundary.registry.json"));
  const policy = JSON.parse(await text("config/credential-boundaries.json"));
  const ids = new Set(registry.credentials.map((entry) => entry.id));
  for (const required of [
    "github-app-authorization",
    "github-device-authorization",
    "github-selected-connection",
    "github-project-sync-state",
    "google-desktop-oauth",
    "legacy-ai-connection",
    "writing-assistant-profiles",
    "media-routing-profiles",
    "buzz-connection",
    "buzz-managed-runtime",
    "collaboration-invitation-state",
  ]) assert.ok(ids.has(required), `Missing credential boundary ${required}`);

  assert.equal(registry.encryption_contract.plaintext_fallback_allowed, false);
  assert.equal(registry.encryption_contract.windows, "windows-dpapi-current-user");
  assert.equal(registry.encryption_contract.macos, "macos-keychain-current-user");
  assert.equal(registry.encryption_contract.linux_primary, "linux-systemd-creds-current-user");
  assert.equal(registry.encryption_contract.linux_fallback, "linux-secret-service-current-user");
  const registeredFiles = new Set(registry.credentials.map((entry) => entry.file));
  for (const item of policy.protectedFiles) assert.ok(registeredFiles.has(item.name), `Missing executable registry entry for ${item.name}`);
  assert.ok(policy.publicConfigs.some((item) => item.path === "config/github-app.json"));
  assert.ok(policy.publicConfigs.some((item) => item.path === "config/google-oauth.json"));

  for (const entry of registry.credentials) {
    assert.match(entry.file, /^[a-z0-9][a-z0-9-]*\.json$/);
    assert.ok(entry.contains.length >= 1);
    assert.ok(entry.browser_exposure.length >= 20);
    assert.ok(entry.export_boundary.length >= 20);
    assert.ok(entry.remove_or_revoke.length >= 20);
    assert.ok(entry.owner_follow_up.length >= 10);
  }
});

test("credential storage fails closed and public surfaces remain redacted", async () => {
  const [credentials, github, google, ai, buzz, media, assistant, feedback, workspace] = await Promise.all([
    text("build/local-credentials.ts"),
    text("build/github-app-gateway.ts"),
    text("build/google-desktop-oauth.ts"),
    text("build/local-ai-gateway-base.ts"),
    text("build/buzz-gateway.ts"),
    text("build/media-routing-store.ts"),
    text("build/writing-assistant-store.ts"),
    text("lib/product-feedback.ts"),
    text("app/suggest-report-workspace.tsx"),
  ]);

  for (const marker of ["windows-dpapi-current-user", "macos-keychain-current-user", "linux-secret-service-current-user", "linux-systemd-creds-current-user"]) {
    assert.match(credentials, new RegExp(marker));
  }
  assert.match(credentials, /will not save credentials without Linux user encryption/);
  assert.match(credentials, /open\(temporary, "w", 0o600\)/);
  assert.match(credentials, /legacy credential could not be migrated to encrypted storage/);

  assert.match(github, /function publicAuthorization/);
  assert.doesNotMatch(github.match(/function publicAuthorization[\s\S]*?\n}\n/)?.[0] || "", /accessToken|refreshToken|deviceCode/);
  assert.match(google, /function publicGoogleConnection/);
  assert.match(ai, /function publicConnection/);
  assert.doesNotMatch(ai.match(/function publicConnection[\s\S]*?\n}\n/)?.[0] || "", /apiKey/);
  assert.match(buzz, /function publicConnection/);
  assert.doesNotMatch(buzz.match(/function publicConnection[\s\S]*?\n}\n/)?.[0] || "", /privateKey:/);
  assert.match(media, /export function publicMediaProfile/);
  assert.doesNotMatch(media.match(/export function publicMediaProfile[\s\S]*?\n}/)?.[0] || "", /apiKey/);
  assert.match(assistant, /export function publicProfile/);
  assert.doesNotMatch(assistant.match(/export function publicProfile[\s\S]*?\n}/)?.[0] || "", /apiKey/);

  assert.match(feedback, /redactProductFeedbackText/);
  assert.match(feedback, /Story\/project data: not collected/);
  assert.match(feedback, /Credentials and local paths: redacted/);
  assert.match(workspace, /I removed private material/);
  assert.match(workspace, /does not attach the active story, project title, local paths or credentials/);
});

test("source credential-boundary audit passes and package staging invokes package mode", async () => {
  const packageScript = await text("scripts/package-platform.mjs");
  const workflow = await text(".github/workflows/credential-boundary.yml");
  const settings = JSON.parse(await text("config/public-repository.settings.json"));

  assert.match(packageScript, /credential-boundary-audit\.mjs/);
  assert.match(packageScript, /--mode", "package"/);
  assert.match(workflow, /name: Credential boundary audit/);
  assert.match(workflow, /node scripts\/credential-boundary-audit\.mjs --mode source/);
  assert.match(workflow, /node --test tests\/issue-299-credential-boundary-audit\.test\.mjs/);
  assert.ok(settings.main_branch.required_checks.includes("Credential boundary audit"));

  const output = execFileSync(process.execPath, ["scripts/credential-boundary-audit.mjs", "--mode", "source"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
  });
  assert.match(output, /Credential-boundary audit passed in source mode/);
});

test("owner checklist records the remaining manual release actions", async () => {
  const audit = await text("docs/CREDENTIAL_BOUNDARY_AUDIT.md");
  for (const heading of [
    "## Storage and encryption verdict",
    "## Credential inventory",
    "## Exposure boundaries",
    "## Development material requiring owner action",
    "## Owner release checklist",
  ]) assert.match(audit, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(audit, /revoke any development API keys/i);
  assert.match(audit, /GitHub App/i);
  assert.match(audit, /Google Desktop OAuth/i);
  assert.match(audit, /Buzz/i);
  assert.match(audit, /ComfyUI/i);
  assert.match(audit, /PPF/i);
  assert.match(audit, /release archives/i);
});
