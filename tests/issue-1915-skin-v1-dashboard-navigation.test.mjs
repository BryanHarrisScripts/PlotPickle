import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { stripTypeScriptTypes } from "node:module";

const root = process.cwd();
const read = (relative) => readFile(path.join(root, relative), "utf8");

test("#1915 Dashboard naming, Log Off and first Writer's Craft submenu follow the approved hierarchy", async () => {
  const [skin, dashboard, profile] = await Promise.all([
    read("app/skin-v1/skin-v1-client.tsx"),
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
    read("app/skin-v1/profile-skin-panel.tsx"),
  ]);

  assert.match(dashboard, /PLOTPICKLE DASHBOARD/u);
  assert.match(dashboard, /\*\*\* PLOTPICKLE BBS \*\*\*/u);
  assert.match(skin, /id: "logout", shortcut: "X", label: "Log Off"/u);
  assert.match(skin, /type: "LogoutHuman"/u);
  assert.match(skin, /executeLogoutHumanIntent/u);
  assert.match(skin, /item\.id === "profile"[\s\S]*setUserProfileOpen\(true\)/u);
  assert.match(profile, />Back to Dashboard<\/button>/u);

  const collections = [
    "Screenwriting Foundations",
    "Visual Writing & PlotPickle",
    "The 24 Blocks Method",
    "AI-Assisted Revision",
    "Characters in Motion",
    "Dialogue in Motion",
    "Story Craft Essentials",
    "Working Together",
    "Collaboration, Formats & Ownership",
  ];
  let previous = -1;
  for (const collection of collections) {
    const index = dashboard.indexOf(`label: "${collection}"`);
    assert.ok(index > previous, `${collection} must remain in the approved first submenu order`);
    previous = index;
  }
  assert.match(dashboard, /FIRST SUBMENU ONLY/u);
  assert.match(dashboard, /COLLECTION PREVIEW ONLY\. LESSON LEVEL IS NOT OPENED IN THIS BUILD/u);
  assert.match(dashboard, /data-skin-menu="writer-craft"/u);
  assert.match(dashboard, /data-skin-menu-connected="false"/u);
});

test("#1915 Local Story Mode and Node Info are Settings destinations, while User Profile is direct", async () => {
  const [skin, dashboard, local] = await Promise.all([
    read("app/skin-v1/skin-v1-client.tsx"),
    read("app/skin-v1/dashboard-bbs-panel.tsx"),
    read("app/skin-v1/local-ai-skin-host.tsx"),
  ]);

  assert.match(dashboard, /id: "local-story-mode"[\s\S]*label: "Local Story Mode"/u);
  assert.match(dashboard, /id: "node-info"[\s\S]*label: "Node Info"/u);
  assert.match(dashboard, /CONNECTED_SETTINGS_ITEMS = new Set\(\["local-story-mode", "node-info", "cloud", "agents"\]\)/u);
  assert.match(dashboard, /setLocalStoryModeOpen\(true\)/u);
  assert.match(dashboard, /setNodeInfoOpen\(true\)/u);
  assert.match(dashboard, /<LocalAiSkinHost \/>/u);
  assert.match(dashboard, /<NodeSkinPanel \/>/u);
  assert.match(local, /SETTINGS \/ LOCAL STORY MODE/u);
  assert.match(skin, /<ProfileSkinPanel onBack=\{\(\) => setUserProfileOpen\(false\)\}/u);
});

test("#1915 Log Off ends only the Human browser session and returns a locked LOGON projection", async () => {
  const [contract, useCaseSource, gatewaySource] = await Promise.all([
    read("core/contracts/experience.ts"),
    read("lib/experience/logon-use-case.ts"),
    read("adapters/experience/browser-profile-auth-gateway.ts"),
  ]);

  assert.match(contract, /type: "LogoutHuman"/u);
  assert.match(gatewaySource, /JSON\.stringify\(\{ action: "logout" \}\)/u);
  assert.match(gatewaySource, /X-PlotPickle-CSRF/u);
  assert.match(gatewaySource, /flushProfilePrivateWrites/u);
  assert.match(gatewaySource, /clearProfilePrivateBrowser/u);
  assert.doesNotMatch(gatewaySource, /node-control|begin-shutdown|complete-shutdown|stop node|stop-node/iu);

  const logon = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(useCaseSource)).toString("base64")}`);
  const profile = { profileId: "human-1", displayName: "Human", avatarRef: null, status: "active" };
  const locked = { configured: true, authenticated: false, accessMode: "desktop-loopback", profiles: [profile], profile: null, serverReady: true, readinessReasons: [] };
  const gateway = {
    read: async () => locked,
    authenticate: async () => ({ ...locked, authenticated: true, profile }),
    createFirstProfile: async () => { throw new Error("not used"); },
    logout: async () => locked,
  };
  const result = await logon.executeLogoutHumanIntent({
    intent: { type: "LogoutHuman", intentId: "logout-1", baseRevision: null },
    gateway,
  });
  assert.equal(result.result.outcome, "accepted");
  assert.equal(result.view.surface, "LOGON");
  assert.equal(result.view.state, "locked");
});

test("#1915 restores green wired indicators for Cloud and Local Story Mode and audits the new hierarchy", async () => {
  const [cloud, local, audit] = await Promise.all([
    read("app/skin-v1/cloud-story-mode-host.tsx"),
    read("app/skin-v1/local-ai-skin-host.tsx"),
    read("lib/verification/skin-v1-menu-contract-audit.mjs"),
  ]);

  for (const source of [cloud, local]) {
    assert.match(source, /pp-skin-v1-dashboard-status-box is-active/u);
    assert.match(source, /data-skin-menu-indicator=\{"connected"\}/u);
    assert.match(source, /data-skin-menu-connected="true"/u);
  }
  assert.match(audit, /inspectMenu\(page, "cloud-story-mode", failures\)/u);
  assert.match(audit, /inspectMenu\(page, "local-story-mode", failures\)/u);
  assert.match(audit, /inspectMenu\(page, "writer-craft", failures\)/u);
  assert.match(audit, /section\[aria-label='User Profile'\]/u);
  assert.match(audit, /data-settings-secondary-item='general'[\s\S]*keyboard\.press\("L"\)/u);
  assert.match(audit, /keyboard\.press\("I"\)[\s\S]*section\[aria-label='Node information'\]/u);
});
