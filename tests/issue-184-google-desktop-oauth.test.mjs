import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

function forbiddenPublicKeys(value, trail = "config") {
  if (!value || typeof value !== "object") return [];
  const forbidden = new Set(["clientSecret", "accessToken", "refreshToken", "authorizationCode", "codeVerifier", "idToken", "privateKey"]);
  return Object.entries(value).flatMap(([key, child]) => [
    ...(forbidden.has(key) ? [`${trail}.${key}`] : []),
    ...forbiddenPublicKeys(child, `${trail}.${key}`),
  ]);
}

test("issue #184 defines one non-secret public Google Desktop OAuth contract", async () => {
  const [configText, schemaText, loader] = await Promise.all([
    source("config/google-oauth.json"),
    source("schema/plotpickle-google-oauth-public-config.schema.json"),
    source("build/google-oauth-public-config.ts"),
  ]);
  const config = JSON.parse(configText);
  const schema = JSON.parse(schemaText);
  assert.equal(config.schemaVersion, 1);
  assert.equal(config.product, "PlotPickle");
  assert.ok(["pending-owner-registration", "registered"].includes(config.registrationStatus));
  if (config.registrationStatus === "registered") assert.match(config.clientId, /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/);
  else assert.equal(config.clientId, "");
  assert.equal(config.applicationType, "desktop");
  assert.equal(config.loopbackRedirect, true);
  assert.equal(config.pkceMethod, "S256");
  assert.equal(config.clientSecretPackaged, false);
  assert.deepEqual(config.identityScopes, ["openid", "email", "profile"]);
  assert.deepEqual(config.optionalScopes, {
    calendar: "https://www.googleapis.com/auth/calendar.events.owned",
    meet: "https://www.googleapis.com/auth/calendar.events.owned",
  });
  assert.deepEqual(forbiddenPublicKeys(config), []);
  assert.doesNotMatch(configText, /meetings\.space\.created/);
  assert.equal(schema.properties.applicationType.const, "desktop");
  assert.match(loader, /PLOTPICKLE_GOOGLE_OAUTH_CONFIG/);
  assert.match(loader, /PLOTPICKLE_GOOGLE_CLIENT_ID/);
  assert.match(loader, /assertNoSecrets/);
  assert.doesNotMatch(loader, /PLOTPICKLE_GOOGLE_CLIENT_SECRET|clientSecret\s*:/);
});

test("issue #184 applies packaged Google configuration before the local gateway", async () => {
  const vite = await source("vite.config.ts");
  assert.match(vite, /applyGoogleOAuthPublicConfig/);
  assert.ok(vite.indexOf("applyGoogleOAuthPublicConfig();") < vite.indexOf("localConnectionsGateway()"));
});

test("issue #184 uses a one-time random loopback listener with PKCE and state", async () => {
  const google = await source("build/google-desktop-oauth.ts");
  for (const contract of [
    "createServer",
    'host: "127.0.0.1"',
    "port: 0",
    "exclusive: true",
    'LOOPBACK_CALLBACK_PATH = "/oauth2/callback"',
    "randomBytes(64)",
    "randomBytes(32)",
    "code_challenge_method: \"S256\"",
    "attempt.consumed",
    "A Google sign-in is already in progress",
    "AUTHORIZATION_MAX_AGE_MS",
    "cancelGoogleAuthorization",
  ]) assert.ok(google.includes(contract), `Desktop OAuth flow is missing: ${contract}`);
  assert.match(google, /request\.headers\.host !== expectedHost/);
  assert.match(google, /callbackUrl\.searchParams\.get\("state"\) !== attempt\.state/);
  assert.doesNotMatch(google, /client_secret|PLOTPICKLE_GOOGLE_CLIENT_SECRET/);
  assert.doesNotMatch(google, /localhost/);
});

test("issue #184 verifies Google identity issuer audience expiry and account match before saving", async () => {
  const google = await source("build/google-desktop-oauth.ts");
  for (const contract of [
    "tokenInfoUrl",
    'issuer !== "https://accounts.google.com"',
    'issuer !== "accounts.google.com"',
    "audience !== config.clientId",
    "expiresAt * 1000 <= Date.now()",
    "email_verified",
    "userSubject !== subject",
    "userEmail.toLowerCase() !== email.toLowerCase()",
    "await writeCredentialJson(GOOGLE_CONNECTION_FILE, saved)",
  ]) assert.ok(google.includes(contract), `Identity verification is missing: ${contract}`);
  assert.ok(google.indexOf("verifiedIdentity(issued.idToken") < google.indexOf("await writeCredentialJson(GOOGLE_CONNECTION_FILE, saved)"));
});

test("issue #184 encrypts credentials for the current OS user on all desktop platforms", async () => {
  const vault = await source("build/local-credentials.ts");
  for (const contract of [
    "DataProtectionScope]::CurrentUser",
    'command("security", ["find-generic-password"',
    '/usr/bin/security add-generic-password',
    'command("secret-tool", ["lookup"',
    'command("secret-tool", ["store"',
    'createCipheriv("aes-256-gcm"',
    'createDecipheriv("aes-256-gcm"',
    'protection: "macos-keychain-current-user"',
    '"linux-secret-service-current-user"',
    "await writeCredentialJson(safeName, stored)",
    "if (!isProtectedEnvelope(migrated))",
    "will not save credentials",
  ]) assert.ok(vault.includes(contract), `Credential protection is missing: ${contract}`);
  assert.doesNotMatch(vault, /account-file-permissions/);
  assert.doesNotMatch(vault, /process\.platform === "win32"\) await writeCredentialJson/);
});

test("issue #184 uses the system browser and sanitized polling from Settings", async () => {
  const [panel, gateway] = await Promise.all([
    source("app/settings-panel-legacy.tsx"),
    source("build/local-connections-gateway.ts"),
  ]);
  assert.match(panel, /window\.open\("about:blank", "_blank"\)/);
  assert.match(panel, /system browser/);
  assert.match(panel, /pollGoogleAuthorization/);
  assert.match(panel, /Cancel sign-in/);
  assert.match(gateway, /GOOGLE_API}\/authorization/);
  assert.doesNotMatch(panel, /postMessage|popup,width/);
  assert.doesNotMatch(gateway, /api\/local-google\/callback/);
});

test("issue #184 packages and release-validates the same public config on all desktops", async () => {
  const [packager, smoke] = await Promise.all([
    source("scripts/package-platform.mjs"),
    source("scripts/package-smoke.mjs"),
  ]);
  assert.match(packager, /PLOTPICKLE_GOOGLE_OAUTH_CONFIG/);
  assert.match(packager, /config\\google-oauth\.json|config\/google-oauth\.json/);
  assert.match(packager, /googleOAuth:/);
  assert.match(smoke, /config\/google-oauth\.json/);
  assert.match(smoke, /pending-owner-registration/);
  assert.match(smoke, /googleOAuthConfigured/);
  assert.match(smoke, /inactive Google OAuth package must not contain a placeholder Client ID/);
  assert.match(smoke, /clientSecretPackaged, false/);
  assert.match(smoke, /PLOTPICKLE_GOOGLE_OAUTH_CONFIG/);
});

test("issue #184 provides owner registration and keeps Phase 3 out of scope", async () => {
  const [registration, docs] = await Promise.all([
    source("scripts/google-oauth-registration.mjs"),
    source("docs/issue-184-google-desktop-oauth.md"),
  ]);
  assert.match(registration, /console\.cloud\.google\.com\/auth\/clients/);
  assert.match(registration, /configure <desktop-client-id>/);
  assert.doesNotMatch(registration, /client_secret|refresh_token|access_token/);
  assert.match(docs, /Application type: Desktop app/);
  assert.match(docs, /Windows: DPAPI/);
  assert.match(docs, /macOS: AES-256-GCM/);
  assert.match(docs, /Linux: AES-256-GCM/);
  assert.match(docs, /Phase 3, issue #185/);
  assert.match(docs, /inactive foundation/);
  assert.match(docs, /activation gate/);
});

test("issue #184 commands are registered", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  assert.match(packageJson.scripts.test, /issue-184-google-desktop-oauth\.test\.mjs/);
  assert.equal(packageJson.scripts["test:google-desktop-oauth"], "node --test tests/issue-184-google-desktop-oauth.test.mjs");
  assert.equal(packageJson.scripts["google-oauth:register"], "node scripts/google-oauth-registration.mjs open");
  assert.equal(packageJson.scripts["google-oauth:verify"], "node scripts/google-oauth-registration.mjs verify");
});
