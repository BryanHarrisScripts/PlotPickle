import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const profiles = JSON.parse(await readFile(path.join(repoRoot, "config", "agent-profiles.json"), "utf8"));
const communityProfiles = JSON.parse(await readFile(path.join(repoRoot, "config", "agent-profile-extensions", "community.json"), "utf8"));
const helperDirectory = JSON.parse(await readFile(path.join(repoRoot, "config", "helper-directory.json"), "utf8"));

async function source(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

test("#1028 Settings exposes a discoverable HELP destination that lands on Meet the Helpers", async () => {
  const settings = await source("app/sage-settings-workspace.tsx");
  assert.match(settings, /id: "settings-help", label: "HELP"/);
  assert.match(settings, /href="#settings-help">HELP<\/a>/);
  assert.match(settings, /id="settings-help"/);
  assert.match(settings, /<SettingsHelperDirectory \/>/);
  assert.match(settings, /<AgentObservabilityPanel \/>/, "existing technical Agent Activity view must remain present");
});

test("#1028 helper directory mirrors every host-owned Agent Profile exactly once without duplicating authority", () => {
  const profileIds = [...profiles.profiles, ...communityProfiles.profiles].map((profile) => profile.id).sort();
  const helperIds = helperDirectory.helpers.map((helper) => helper.id).sort();
  assert.equal(new Set(helperIds).size, helperIds.length, "helper ids must be unique");
  assert.deepEqual(helperIds, profileIds, "Help must add/remove helpers with the host-owned Agent Profile roster");

  for (const helper of helperDirectory.helpers) {
    assert.deepEqual(
      Object.keys(helper).sort(),
      ["group", "how", "id"],
      `presentation entry ${helper.id} must not duplicate identity, portrait, responsibility or authority fields`,
    );
  }
});

test("#1028 every helper resolves through the shared local portrait component and supplied atlas", async () => {
  const [component, portraitCss] = await Promise.all([
    source("components/agent-portrait.tsx"),
    source("components/agent-portrait.module.css"),
  ]);
  assert.equal(helperDirectory.portraitSystem, "painterly-fantasy-v1");

  for (const helper of helperDirectory.helpers) {
    assert.match(component, new RegExp(`id: ["']${helper.id}["']`), `${helper.id} is missing from the shared portrait component`);
  }
  assert.match(component, /id: "sage-brinewick"[\s\S]*supplied elder wizard/);
  assert.match(component, /data-agent-artwork="user-supplied"/);
  assert.match(portraitCss, /\/assets\/agent-profile-atlas\.webp/);
  await access(path.join(repoRoot, "public", "assets", "agent-profile-atlas.webp"));
  assert.doesNotMatch(component, /\/assets\/helpers\/16bit\//i);
});

test("#1028 cards use Agent Profiles for identity/authority and provide accessible illustrated portraits", async () => {
  const directory = await source("app/settings-helper-directory.tsx");
  assert.match(directory, /AGENT_PROFILES/);
  assert.match(directory, /profile\.displayName/);
  assert.match(directory, /profile\.title/);
  assert.match(directory, /profile\.responsibility/);
  assert.match(directory, /profile\.verificationContract/);
  assert.match(directory, /<AgentPortrait/);
  assert.ok(directory.includes('alt={`Illustrated fantasy portrait of ${profile.displayName}, ${profile.title}.`}'));
  assert.match(directory, /What they cannot do/);
  assert.match(directory, /Who can help me with this\?/);
});
