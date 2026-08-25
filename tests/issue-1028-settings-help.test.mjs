import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicProfiles = JSON.parse(await readFile(path.join(repoRoot, "config", "agent-profile-extensions", "public.json"), "utf8"));
const playhouse = JSON.parse(await readFile(path.join(repoRoot, "plugins", "plotpickle-playhouse", "community.json"), "utf8"));

async function source(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

test("#1028 Settings exposes a discoverable Help destination that lands on Meet the Helpers", async () => {
  const settings = await source("app/sage-settings-workspace.tsx");
  assert.match(settings, /label: "START"[\s\S]*\{ id: "help", label: "Help"/);
  assert.match(settings, /LEGACY_HELP_DESTINATION = \{ id: "settings-help", label: "Help" \}/);
  assert.match(settings, /href="#settings-help">HELP<\/a>/);
  assert.match(settings, /id="settings-help"/);
  assert.match(settings, /<SettingsHelperDirectory \/>/);
  assert.match(settings, /<AgentObservabilityPanel \/>/, "existing technical Agent Activity view must remain present");
});

test("#1028 public Help directory is contributed by the Community plugin without duplicating Agent identity authority", () => {
  const publicIds = Object.keys(publicProfiles.profiles).sort();
  const helperIds = playhouse.agents.map((helper) => helper.profileId).sort();
  assert.equal(new Set(helperIds).size, helperIds.length, "public helper ids must be unique");
  assert.deepEqual(helperIds, publicIds, "Help must follow the canonical public Agent roster");
  assert.equal(helperIds.length, 15);

  for (const helper of playhouse.agents) {
    assert.deepEqual(
      Object.keys(helper).sort(),
      ["helpGroup", "helpPrompt", "profileId", "roomIds", "shortBio"],
      `plugin entry ${helper.profileId} must not duplicate display name, title, portrait, public bio or authority fields`,
    );
  }
});

test("#1028 every public helper resolves through the shared current lore portrait component and supplied atlas", async () => {
  const [component, portraitCss] = await Promise.all([
    source("components/agent-portrait.tsx"),
    source("components/agent-portrait.module.css"),
  ]);
  for (const helper of playhouse.agents) {
    assert.match(component, new RegExp(`id: ["']${helper.profileId}["']`), `${helper.profileId} is missing from the shared portrait component`);
  }
  assert.match(component, /id: "sage-brinewick"[\s\S]*supplied elder wizard/);
  assert.match(component, /data-agent-artwork="current-lore"/);
  assert.match(component, /styles\.atlasPortrait/);
  assert.match(portraitCss, /\/assets\/agent-profile-atlas\.webp/);
  await access(path.join(repoRoot, "public", "assets", "agent-profile-atlas.webp"));
  assert.doesNotMatch(component, /\/assets\/helpers\/16bit\//i);
});

test("#1028 cards consume Community plugin presentation while retaining core Agent authority boundaries", async () => {
  const directory = await source("app/settings-helper-directory.tsx");
  assert.match(directory, /PLOTPICKLE_COMMUNITY_EXTENSIONS/);
  assert.match(directory, /agentProfileById/);
  assert.match(directory, /agent\.displayName/);
  assert.match(directory, /agent\.title/);
  assert.match(directory, /agent\.shortBio/);
  assert.match(directory, /agent\.helpPrompt/);
  assert.match(directory, /agent\.publicBio/);
  assert.match(directory, /cannotDo\(profile\)/);
  assert.match(directory, /<AgentPortrait/);
  assert.ok(directory.includes('alt={`Illustrated fantasy portrait of ${agent.displayName}, ${agent.title}.`}'));
  assert.match(directory, /Meet the PlotPickle helpers\./);
});
