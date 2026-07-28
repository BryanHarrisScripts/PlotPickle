import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #120 exposes the complete Settings navigation", async () => {
  const panel = await source("app/settings-panel.tsx");
  const menu = panel.slice(panel.indexOf("const SETTINGS_GROUPS"), panel.indexOf("const SETTINGS_SECTIONS"));
  const labels = [
    "Workspace", "General", "Appearance / Accessibility", "Project Defaults",
    "Integrations", "AI Providers", "GitHub", "Google Services", "Plugins & Connections",
    "Data Storage", "Storage & Backups",
    "Security", "Privacy & Permissions", "About & Licensing",
  ];
  let previous = -1;
  for (const label of labels) {
    const index = menu.indexOf(`label: "${label}"`);
    assert.ok(index > previous, `Settings is missing or out of order: ${label}`);
    previous = index;
  }
  assert.match(panel, /aria-label="Settings sections"/);
  assert.match(panel, /SETTINGS_GROUPS\.map/);
});

test("issue #120 uses one sanitized connection-status source in Settings Dashboard and Reports", async () => {
  const [status, hook, page, dashboard, reports] = await Promise.all([
    source("lib/connection-status.ts"),
    source("app/use-connection-status.ts"),
    source("app/page.tsx"),
    source("lib/dashboard-command-centre.ts"),
    source("lib/consolidated-reports.ts"),
  ]);
  assert.match(status, /createConnectionStatusSnapshot/);
  assert.match(status, /reportsRuntimeConnections/);
  assert.match(hook, /\/api\/local-connections/);
  assert.match(page, /useConnectionStatus\(project, saveState\)/);
  assert.match(page, /connectionStatus=\{connectionState\.snapshot\}/);
  assert.match(page, /runtimeConnections=\{reportConnections\}/);
  assert.match(dashboard, /connectionStatus: ConnectionStatusSnapshot/);
  assert.match(reports, /ReportsRuntimeConnections/);
  assert.doesNotMatch(status, /apiKey|accessToken|refreshToken|clientSecret|repositoryToken/);
});

test("issue #120 gives every optional integration the shared setup and repair contract", async () => {
  const [status, panel] = await Promise.all([
    source("lib/connection-status.ts"),
    source("app/settings-panel.tsx"),
  ]);
  for (const field of [
    "identity",
    "lastSuccessfulConnection",
    "error",
    "repairGuidance",
    "dataShared",
    "scopes",
    "permissions",
    "optional: true",
  ]) assert.ok(status.includes(field), `Shared connection status is missing: ${field}`);
  for (const action of ["Save key & connect", "Test again", "Remove saved key", "Test connection", "Disconnect and revoke"]) {
    assert.ok(panel.includes(action), `Settings is missing connection action: ${action}`);
  }
  assert.match(panel, /What data is shared/);
  assert.match(panel, /Repair guidance/);
});

test("issue #120 implements minimal Google Calendar and Meet OAuth foundations", async () => {
  const [status, gateway, panel, vite] = await Promise.all([
    source("lib/connection-status.ts"),
    source("build/local-connections-gateway.ts"),
    source("app/settings-panel.tsx"),
    source("vite.config.ts"),
  ]);
  for (const scope of [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/calendar.events.owned",
    "https://www.googleapis.com/auth/meetings.space.created",
  ]) assert.ok(`${status}\n${gateway}`.includes(scope), `Google foundation is missing scope: ${scope}`);
  for (const endpoint of [
    "/api/local-google/connection",
    "/start",
    "/check",
    "/api/local-google/callback",
  ]) assert.ok(gateway.includes(endpoint), `Google gateway is missing endpoint: ${endpoint}`);
  assert.match(gateway, /code_challenge_method: "S256"/);
  assert.match(gateway, /access_type: "offline"/);
  assert.match(gateway, /include_granted_scopes: "false"/);
  assert.match(gateway, /GOOGLE_REVOKE_URL/);
  assert.match(panel, /Sign in with Google/);
  assert.match(panel, /label: "Google Services"[\s\S]*optional Calendar and Meet/);
  assert.match(panel, /eyebrow="Google Services"/);
  assert.match(vite, /localConnectionsGateway\(\)/);
});

test("issue #120 keeps credentials outside projects and authentication failures non-blocking", async () => {
  const [gateway, vault, panel, status, project] = await Promise.all([
    source("build/local-connections-gateway.ts"),
    source("build/local-credentials.ts"),
    source("app/settings-panel.tsx"),
    source("lib/connection-status.ts"),
    source("lib/project.ts"),
  ]);
  assert.match(vault, /PLOTPICKLE_HOME/);
  assert.match(vault, /secrets/);
  assert.match(vault, /0o600/);
  assert.match(gateway, /readCredentialJson/);
  assert.match(gateway, /isLocalRequest/);
  assert.match(gateway, /Local removal still protects this installation and cannot block local work/);
  assert.match(panel, /Failed or declined Calendar or Meet authentication never blocks local project work/);
  assert.match(panel, /excluded from \.ppf projects, reports, exports, logs and GitHub/);
  assert.match(status, /sanitizeMeetingMetadata/);
  assert.doesNotMatch(project, /accessToken|refreshToken|googleToken|oauthToken/);
});

test("issue #120 keeps the application header in one ordered five-zone row", async () => {
  const [header, css] = await Promise.all([
    source("app/application-shell-header.tsx"),
    source("app/premium-ui.css"),
  ]);
  const selectors = [
    "shell-brand",
    "shell-zone-discovery",
    "shell-zone-production",
    "shell-zone-project-actions",
    "shell-zone-configuration",
  ];
  let previous = -1;
  for (const selector of selectors) {
    const index = header.indexOf(selector);
    assert.ok(index > previous, `Header zone is missing or out of order: ${selector}`);
    previous = index;
  }
  assert.match(css, /\.application-shell-header\s*\{\s*grid-template-columns:/);
  assert.match(css, /\.application-shell-header > \*\s*\{[^}]*grid-row: auto/s);
  assert.match(css, /\.application-shell-header \.shell-zone-project-actions\s*\{\s*display: flex/);
  assert.doesNotMatch(header, /shell-zone-discovery"[^>]*>\s*<button[^>]*shell-brand/s);
});

test("issue #120 test is registered", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  assert.match(packageJson.scripts.test, /issue-120-settings-connections\.test\.mjs/);
  assert.equal(packageJson.scripts["test:settings-connections"], "node --test tests/issue-120-settings-connections.test.mjs");
});
