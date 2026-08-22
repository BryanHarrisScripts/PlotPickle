import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1283 normal Community rail is four Human-purpose rooms rather than internal architecture", async () => {
  const workspace = await read("app/community-workspace.tsx");
  for (const pair of [
    ["great-hall", "Great Hall"],
    ["story-council", "Story Workshop"],
    ["wyrmwood-ring", "Wyrmwood"],
    ["marquee", "Marquee"],
  ]) {
    assert.match(workspace, new RegExp(`id: "${pair[0]}"`));
    assert.match(workspace, new RegExp(`label: "${pair[1]}"`));
  }
  for (const hidden of ["gatehouse", "forge", "lantern-watch", "wayfarer-journal", "github-herald"]) {
    assert.doesNotMatch(workspace, new RegExp(`id: "${hidden}"`));
  }
  assert.match(workspace, />Rooms</);
  assert.doesNotMatch(workspace, />Channels</);
  assert.doesNotMatch(workspace, />Forums</);
});

test("#1283 rooms explain their value and show groups of relevant Agents", async () => {
  const social = await read("modules/community/community-buzz-social.tsx");
  assert.match(social, /What this room is for/);
  assert.match(social, /Who helps here/);
  for (const id of ["sage-brinewick", "merrin-bellwarden", "orin-ledgerbark", "tamsin-hearthquill", "quillan-reedcloak", "elowen-mapweaver", "mira-threadmere", "critics-circle", "master-oaken-vague", "rowan-scalequill", "marquee-director"]) {
    assert.match(social, new RegExp(id));
  }
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

test("#1283 Agent and Help presentation uses current lore art and keeps technical detail secondary", async () => {
  const [portrait, roster, help] = await Promise.all([
    read("components/agent-portrait.tsx"),
    read("app/community-agent-roster.tsx"),
    read("app/settings-helper-directory.tsx"),
  ]);
  assert.match(portrait, /data-agent-artwork="current-lore"/);
  assert.match(portrait, /styles\.atlasPortrait/);
  assert.match(roster, /Meet the helpers you can encounter around the Community/);
  assert.match(roster, /Helps in:/);
  assert.match(roster, /<summary>Technical details<\/summary>/);
  assert.doesNotMatch(roster, /ResponsibilityRunActivity/);
  assert.match(help, /<AgentPortrait/);
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
