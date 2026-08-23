import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const panel = await readFile(new URL("../app/profile-access/profile-identity-panel.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("../app/profile-access/profile-identity-panel.module.css", import.meta.url), "utf8");

const motto = "The agents are the workshop. Stories—and better storytellers—are the product.";

test("issue #1320 makes the Profile a complete identity surface", () => {
  assert.equal(panel.split(motto).length - 1, 1, "the Profile motto should appear exactly once");
  assert.match(panel, />Identity Token</);
  assert.match(panel, />BUZZ Setup</);
  assert.match(panel, />Agent name</);
  assert.match(panel, /label="BUZZ Identity"/);
  assert.match(panel, /label="Community BBS"/);
  assert.match(panel, /label="Local Model"/);
  assert.match(panel, /label="ComfyUI"/);
  assert.match(panel, /label="Cloud Compute"/);
  assert.match(panel, />Agent mandate</);
  assert.match(panel, />Identity token</);
});

test("issue #1320 uses live readiness authorities for the status rail", () => {
  assert.match(panel, /\/api\/local-buzz\/human-identity/);
  assert.match(panel, /\/api\/local-buzz\/guildhall\/status/);
  assert.match(panel, /\/api\/writing-assistant\/status/);
  assert.match(panel, /\/api\/local-connections/);
  assert.match(panel, /guildhallStatus\?\.operational/);
  assert.match(panel, /activeProvider/);
  assert.match(panel, /connectionsStatus\?\.comfyui\?\.state === "connected"/);
  assert.match(panel, /data-ready=/);
});

test("issue #1320 readiness labels open their real configuration targets", () => {
  assert.match(panel, /SETTINGS_SECTION_KEY = "plotpickle\.settings\.section"/);
  assert.match(panel, /plotpickle:navigate-workspace/);
  assert.match(panel, /plotpickle:settings-section/);
  assert.match(panel, /settingsTarget="buzz"/);
  assert.match(panel, /settingsTarget="ollama"/);
  assert.match(panel, /settingsTarget="comfyui"/);
  assert.match(panel, /cloudSettingsTarget/);
  assert.match(styles, /\.statusLink\s*\{/);
  assert.match(styles, /\.statusItem i\[data-ready="true"\][\s\S]*background:\s*#4ee8d7/);
  assert.match(styles, /\.statusItem i\[data-ready="false"\][\s\S]*background:\s*#ff5f68/);
});

test("issue #1320 simplifies the Profile editor without changing the avatar generation path", () => {
  assert.match(panel, />Display name \(agent name\)</);
  assert.match(panel, />Display Description</);
  assert.match(panel, />Lore Avatar prompt</);
  assert.match(panel, />Generate Lore Avatar</);
  assert.match(panel, />Save Profile</);
  assert.doesNotMatch(panel, /<span>Avatar<\/span><input/);
  assert.doesNotMatch(panel, />Public bio \/ description</);
  assert.match(panel, /\/api\/local-ai\/generate\/image/);
  assert.match(panel, /saveLocalPresentation\(next\)/);
});

test("issue #1320 keeps the layout responsive and gives the identity artifacts real space", () => {
  assert.match(styles, /\.identitySummary\s*\{/);
  assert.match(styles, /\.statusRail\s*\{/);
  assert.match(styles, /\.artifactGrid\s*\{/);
  assert.match(styles, /grid-template-columns:\s*minmax\(0,\s*1\.35fr\)\s+minmax\(220px,\s*0\.65fr\)/);
  assert.match(styles, /@media \(max-width:\s*820px\)/);
  assert.match(styles, /\.artifactGrid\s*\{[\s\S]*?grid-template-columns:\s*1fr;/);
});