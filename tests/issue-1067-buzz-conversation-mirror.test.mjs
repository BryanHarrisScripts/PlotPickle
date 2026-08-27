import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("#1067 defines one BUZZ room history shared by PlotPickle and Buzz Desktop", async () => {
  const config = JSON.parse(await read("config/buzz-guildhall.json"));
  assert.equal(config.conversationMirror.messageAuthority, "buzz");
  assert.deepEqual(config.conversationMirror.clients, ["plotpickle", "buzz-desktop"]);
  assert.equal(config.conversationMirror.historyModel, "one-buzz-room-history");
  assert.equal(config.conversationMirror.deduplicationKey, "event-id");
  assert.equal(config.conversationMirror.offlineShadowHistory, false);
});

test("#1067 keeps PlotPickle Community reads and writes on real BUZZ message/forum routes", async () => {
  const [gateway, communityGateway, workspace, social, storyAccess] = await Promise.all([
    read("build/buzz-gateway.ts"),
    read("build/buzz-community-gateway.ts"),
    read("app/community-workspace.tsx"),
    read("modules/community/community-buzz-social.tsx"),
    read("app/_components/community/community-story-room-access.tsx"),
  ]);
  assert.match(gateway, /runBuzz\(connection, \["messages", "get", "--channel", channel, "--limit", String\(limit\)\]\)/);
  assert.match(gateway, /const args = \["messages", "send", "--channel", channel, "--content", content\]/);
  assert.match(gateway, /return runBuzz\(connection, args, \{ write: true \}\)/);
  assert.match(gateway, /firstString\(item, \["id", "event_id", "eventId"\]\)/);
  assert.match(workspace, /<CommunityBuzzSocial target=\{selectedTarget\}/);
  assert.match(social, /authenticatedProfileFetch\(`\$\{BUZZ_API\}\/messages\?channel=/);
  assert.match(social, /community\/forum-topic/);
  assert.match(social, /await sendMessage\(target, draft\.trim\(\)\)/);
  assert.match(communityGateway, /"messages", "send", "--channel", channel\.id, "--content", content, "--kind", "45001"/);
  assert.match(storyAccess, /One room, two interfaces/);
  assert.match(storyAccess, /same conversation in Buzz Desktop and PlotPickle/);
});

test("#1067 never introduces a second Community message database or automatic PPF mirroring", async () => {
  const [config, gateway, workspace] = await Promise.all([
    read("config/buzz-guildhall.json").then(JSON.parse),
    read("build/buzz-gateway.ts"),
    read("app/community-workspace.tsx"),
  ]);
  assert.equal(config.conversationMirror.explicitShareOnly, true);
  assert.equal(config.privacy.explicitProjectContextApprovalRequired, true);
  assert.equal(config.privacy.automaticPpfWrites, false);
  assert.doesNotMatch(gateway, /community-messages\.json|community-history\.json|sqlite|better-sqlite/i);
  assert.doesNotMatch(workspace, /setItem\([^\n]*(community|message|great-hall)/i);
});

test("#1067 requires real owner-approved BUZZ identities for agent provenance", async () => {
  const [config, rosterGateway, roster] = await Promise.all([
    read("config/buzz-guildhall.json").then(JSON.parse),
    read("build/buzz-agent-roster-gateway.ts"),
    read("app/_components/community/community-agent-roster.tsx"),
  ]);
  assert.equal(config.conversationMirror.agentIdentityPolicy, "own-signed-buzz-identity");
  assert.equal(config.conversationMirror.agentImpersonationFallback, false);
  assert.match(rosterGateway, /"users", "get", "--name", actor\.displayName, "--owner", "me"/);
  assert.match(rosterGateway, /verified: verification === "verified"/);
  assert.match(rosterGateway, /ownedByMe/);
  assert.match(roster, /Official BUZZ identity available/);
  assert.match(roster, /The connected Human signer is never an Agent signer/);
});