import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const readJson = async (path) => JSON.parse(await read(path));

const PUBLIC_AGENT_IDS = [
  "sage-brinewick",
  "tamsin-hearthquill",
  "master-oaken-vague",
  "rowan-scalequill",
  "quillan-reedcloak",
  "elowen-mapweaver",
  "mira-threadmere",
  "marquee-director",
  "critics-circle",
  "merrin-bellwarden",
  "orin-ledgerbark",
  "fen-copperwind",
];

const PUBLIC_ROOMS = [
  ["great-hall", "Great Hall"],
  ["story-council", "Story Workshop"],
  ["wyrmwood-ring", "Wyrmwood"],
  ["marquee", "Marquee"],
];

test("#1283 Community rooms and Agent membership come from a reusable plugin rather than app hard-coding", async () => {
  const [workspace, social, roster, pluginCode, pluginConfig] = await Promise.all([
    read("app/community-workspace.tsx"),
    read("modules/community/community-buzz-social.tsx"),
    read("app/community-agent-roster.tsx"),
    read("plugins/plotpickle-playhouse/index.ts"),
    readJson("plugins/plotpickle-playhouse/community.json"),
  ]);

  assert.equal(pluginConfig.communityId, "plotpickle-playhouse");
  assert.deepEqual(pluginConfig.rooms.map((room) => [room.id, room.label]), PUBLIC_ROOMS);
  assert.deepEqual(pluginConfig.agents.map((agent) => agent.profileId), PUBLIC_AGENT_IDS);
  assert.match(pluginCode, /defineCommunityExtensionPlugin/);
  assert.match(pluginCode, /createCommunityExtensionSnapshot/);
  assert.match(pluginCode, /buzz-agent-provisioner/);

  for (const surface of [workspace, social]) {
    for (const id of PUBLIC_AGENT_IDS) assert.doesNotMatch(surface, new RegExp(`"${id}"`));
  }
  for (const id of PUBLIC_AGENT_IDS.filter((value) => value !== "critics-circle")) {
    assert.doesNotMatch(roster, new RegExp(`"${id}"`));
  }
  assert.match(roster, /const SPECIALISTS = new Set<SpecialistId>\(\["critics-circle"\]\)/, "Critics' Circle remains an explicit private specialist interaction, not a room-membership hard-code");
  assert.match(workspace, /PLOTPICKLE_PLAYHOUSE_PLUGIN\.rooms/);
  assert.match(social, /agentsForCommunityRoom/);
  assert.match(roster, /publicAgentByProfileId/);
});

test("#1283 normal Community rail is Human-purpose rooms rather than internal architecture", async () => {
  const [workspace, pluginConfig] = await Promise.all([
    read("app/community-workspace.tsx"),
    readJson("plugins/plotpickle-playhouse/community.json"),
  ]);
  assert.equal(pluginConfig.rooms.length, 4);
  for (const hidden of ["gatehouse", "forge", "lantern-watch", "wayfarer-journal", "github-herald"]) {
    assert.equal(pluginConfig.rooms.some((room) => room.id === hidden), false);
    assert.doesNotMatch(workspace, new RegExp(`id: "${hidden}"`));
  }
  assert.match(workspace, />Rooms</);
  assert.doesNotMatch(workspace, />Channels</);
  assert.doesNotMatch(workspace, />Forums</);
});

test("#1283 rooms explain their value and show groups of relevant Agents", async () => {
  const [social, pluginConfig] = await Promise.all([
    read("modules/community/community-buzz-social.tsx"),
    readJson("plugins/plotpickle-playhouse/community.json"),
  ]);
  assert.match(social, /What this room is for/);
  assert.match(social, /Who helps here/);
  for (const room of pluginConfig.rooms) {
    assert.ok(room.description.trim());
    assert.ok(room.actionHint.trim());
    assert.ok(pluginConfig.agents.some((agent) => agent.roomIds.includes(room.id)));
  }
});

test("#1283 reusable BUZZ provisioner consumes plugin contributions and fails closed around owner approval", async () => {
  const provisioner = await read("scripts/provision-community-agents.mjs");
  for (const id of PUBLIC_AGENT_IDS) assert.doesNotMatch(provisioner, new RegExp(`"${id}"`));
  assert.match(provisioner, /PLOTPICKLE_COMMUNITY_PLUGIN_CONFIG/);
  assert.match(provisioner, /plugin\.agents\.map/);
  assert.match(provisioner, /plugin\.rooms/);
  assert.match(provisioner, /"users", "get", "--name", agent\.displayName, "--owner", "me"/);
  assert.match(provisioner, /"agents", "draft-create"/);
  assert.match(provisioner, /"channels", "add-member"[\s\S]*"--role", "bot"/);
  assert.match(provisioner, /ambiguous-existing-agent/);
  assert.match(provisioner, /awaiting-owner-approval/);
  assert.match(provisioner, /owner-provisioner-required/);
  assert.match(provisioner, /state\.pendingDrafts/);
  assert.match(provisioner, /publicIdentityUpdates/);
  assert.doesNotMatch(provisioner, /console\.log\([^\n]*(?:humanKey|provisionerKey|provisionerAuthTag)/);
});

test("#1283 Great Hall is normal readable BUZZ conversation and legacy verification dumps are hidden", async () => {
  const [workspace, social] = await Promise.all([
    read("app/community-workspace.tsx"),
    read("modules/community/community-buzz-social.tsx"),
  ]);
  assert.match(workspace, /<CommunityBuzzSocial target=\{selectedTarget\}/);
  assert.doesNotMatch(workspace, /CommunityBackdoorTerminal|createGreatHallActiveRoom/);
  assert.match(social, /isLegacyOperationalDump/);
  assert.match(social, /plotpickle-live-activity:/);
  assert.match(social, /type=\[a-z0-9\.\-\]\+/);
});

test("#1283 internal Agent and verification activity never falls back to the Human BUZZ signer", async () => {
  const [mirror, activity, verifier] = await Promise.all([
    read("build/buzz-agent-activity-mirror.ts"),
    read("scripts/buzz-live-activity.mjs"),
    read("scripts/verify-buzz-live-activity.mjs"),
  ]);
  assert.doesNotMatch(mirror, /postBuzzGuildhallEvent|\/api\/local-buzz\/messages/);
  assert.match(mirror, /connected Human signer is never used as an Agent fallback/);
  assert.match(activity, /reason: "agent-signer-required"/);
  assert.match(activity, /buzzMirrored: false/);
  assert.doesNotMatch(verifier, /postLiveBuzzActivity|\/messages\?channel=/);
  assert.match(verifier, /no Agent\/test event was published through the Human signer/);
});

test("#1283 one Private Story Room replaces the six-Hall presentation without deleting compatibility rooms", async () => {
  const workspace = await read("app/community-workspace.tsx");
  assert.match(workspace, /PRIVATE_STORY_ROOM_ID: BuzzStoryRoomId = "story"/);
  assert.match(workspace, /Private Story Room/);
  assert.match(workspace, /BUZZ_STORY_ROOMS\.map/);
  assert.doesNotMatch(workspace, /COMMUNITY_VISIBLE_STORY_ROOMS/);
  assert.doesNotMatch(workspace, /Open Hall/);
});

test("#1283 Agent and Help presentation uses current lore art and the same plugin directory", async () => {
  const [portrait, roster, help, pluginConfig] = await Promise.all([
    read("components/agent-portrait.tsx"),
    read("app/community-agent-roster.tsx"),
    read("app/settings-helper-directory.tsx"),
    readJson("plugins/plotpickle-playhouse/community.json"),
  ]);
  assert.match(portrait, /data-agent-artwork="current-lore"/);
  assert.match(portrait, /styles\.atlasPortrait/);
  assert.match(roster, /Meet the helpers you can encounter around the Community/);
  assert.match(roster, /Helps in:/);
  assert.match(roster, /<summary>Technical details<\/summary>/);
  assert.doesNotMatch(roster, /ResponsibilityRunActivity/);
  assert.match(help, /PLOTPICKLE_COMMUNITY_EXTENSIONS/);
  assert.match(help, /<AgentPortrait/);
  assert.equal(pluginConfig.agents.length, 12);
  for (const agent of pluginConfig.agents) {
    assert.ok(agent.shortBio.trim());
    assert.ok(agent.helpPrompt.trim());
  }
});

test("#1283 BUZZ Settings normal path is Human + Community readiness with diagnostics collapsed", async () => {
  const settings = await read("app/buzz-settings-panel.tsx");
  assert.match(settings, /<h1>BUZZ Community<\/h1>/);
  assert.match(settings, /<p>Connected as<\/p>/);
  assert.match(settings, /PlotPicklePlayhouse/);
  assert.match(settings, /Test connection/);
  assert.match(settings, /Advanced diagnostics and operator controls/);
  assert.match(settings, /Set up PlotPickle Guildhall/);
  assert.match(settings, /Managed local Buzz/);
});

test("#1283 Connected Studios does not vertically stretch a sparse empty state", async () => {
  const css = await read("app/connected-studios-panel.module.css");
  assert.match(css, /\.wrap\{display:grid;gap:18px;align-content:start\}/);
});
