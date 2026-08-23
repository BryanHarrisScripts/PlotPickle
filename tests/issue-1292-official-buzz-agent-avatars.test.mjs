import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (pathname) => readFile(new URL(pathname, root));
const readJson = async (pathname) => JSON.parse((await read(pathname)).toString("utf8"));

const OFFICIAL_AVATARS = {
  "sage-brinewick": "d2f6c1397cbe697dd29a1e4e7c8fb9ed3489e61a1033db1ff40affe5ac9baa2d",
  "tamsin-hearthquill": "a68a18217e0b02e2ca124d67d490320d4bf63dae327b6e8854b130cf07ea318b",
  "master-oaken-vague": "86387de575895245e60be1e426980cb4893c3698c835fab1c5588105dc0de151",
  "rowan-scalequill": "9426062a35174ac672985bb2c8d43817deb066e1ea305fc524e83daa601c1576",
  "quillan-reedcloak": "0c72f30d225d9727f4c221578f9d45a82197b19260fbdc103fe77878cf7d10e0",
  "elowen-mapweaver": "46e95d9359536ae9fed781f91d9e30603722fa2a8d23cf90734325982f9625c2",
  "mira-threadmere": "81a9aa5df0661101f1023bf5845b5e5aceee746f7cb95712fa37edb0d2692c14",
  "marquee-director": "38e1977c91d2ed79091a6ee340b2e53d3d0313712d8ca197fba402ba97e0d5a8",
  "critics-circle": "953a528edddb8b0f51add7b41df45664032390e111b93709f0d5488245522d7e",
  "merrin-bellwarden": "fe242eeec1cce7e5739e9dd9ecefbcfd4b94b9dc7792cbca1fa4a105bbecd11e",
  "orin-ledgerbark": "05265239a26a140327a3401b72e00f1b532c422716c120525332ccb224c1b9e1",
  "fen-copperwind": "5c6d206ea4fd672b621676e2f08046a621f7e5b63fad401c360f965fbfbf2c5d",
};

test("#1292 public Agent profiles use the supplied official portrait mapping", async () => {
  const presentations = await readJson("config/agent-profile-extensions/public.json");
  assert.deepEqual(Object.keys(presentations.profiles).sort(), Object.keys(OFFICIAL_AVATARS).sort());

  for (const [profileId, expectedHash] of Object.entries(OFFICIAL_AVATARS)) {
    const expectedRef = `/assets/helpers/official/${profileId}.webp`;
    assert.equal(presentations.profiles[profileId].avatarRef, expectedRef);
    const image = await read(`public${expectedRef}`);
    assert.equal(image.subarray(0, 4).toString("ascii"), "RIFF");
    assert.equal(image.subarray(8, 12).toString("ascii"), "WEBP");
    assert.equal(createHash("sha256").update(image).digest("hex"), expectedHash, profileId);
  }
});

test("#1292 BUZZ team snapshots embed the same canonical official images", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "plotpickle-official-avatars-"));
  const outputPath = path.join(directory, "official.team.json");
  const run = spawnSync(process.execPath, ["scripts/provision-community-agents.mjs", "--prepare-team"], {
    cwd: new URL(".", root),
    env: { ...process.env, PLOTPICKLE_BUZZ_SYNC_PACKAGE_PATH: outputPath },
    encoding: "utf8",
  });
  assert.equal(run.status, 0, run.stderr);

  const [manifest, profiles, communityProfiles] = await Promise.all([
    readFile(outputPath, "utf8").then(JSON.parse),
    readJson("config/agent-profiles.json"),
    readJson("config/agent-profile-extensions/community.json"),
  ]);
  const displayNameById = new Map([...profiles.profiles, ...communityProfiles.profiles].map((profile) => [profile.id, profile.displayName]));
  const memberByName = new Map(manifest.members.map((member) => [member.profile.displayName, member]));

  for (const profileId of Object.keys(OFFICIAL_AVATARS)) {
    const image = await read(`public/assets/helpers/official/${profileId}.webp`);
    const member = memberByName.get(displayNameById.get(profileId));
    assert.ok(member, profileId);
    assert.equal(member.profile.avatarDataUrl, `data:image/webp;base64,${image.toString("base64")}`);
  }
});

test("#1292 existing Agent repair stays in place and warns against duplicate import", async () => {
  const [setup, provisioner, docs] = await Promise.all([
    read("scripts/setup-buzz-community.ps1").then((value) => value.toString("utf8")),
    read("scripts/provision-community-agents.mjs").then((value) => value.toString("utf8")),
    read("docs/buzz-community-one-time-setup.md").then((value) => value.toString("utf8")),
  ]);
  assert.match(setup, /Do not import the team again/);
  assert.match(setup, /edit each matching Persona\/Profile/);
  assert.match(setup, /Invoke-Item -LiteralPath \$agentResult\.avatarRepair\.path/);
  assert.match(provisioner, /preventsDuplicateImport: true/);
  assert.match(provisioner, /requiresDesktopPersonaEdit: true/);
  assert.match(docs, /same identity/);
  assert.match(docs, /does not expose managed Persona avatar edits/);
});

test("#1292 sync plans every Guildhall stream and forum plus each Agent's functional room", async () => {
  const run = spawnSync(process.execPath, ["scripts/provision-community-agents.mjs"], {
    cwd: new URL(".", root),
    env: process.env,
    encoding: "utf8",
  });
  assert.equal(run.status, 0, run.stderr);

  const [plan, guildhall] = await Promise.all([
    Promise.resolve(JSON.parse(run.stdout)),
    readJson("config/buzz-guildhall.json"),
  ]);
  assert.deepEqual(plan.rooms, guildhall.channels.map(({ id, name, type }) => ({ id, name, type })));
  assert.ok(plan.rooms.some((room) => room.type === "forum"));
  assert.ok(plan.rooms.some((room) => room.type === "stream"));

  const actorById = new Map(guildhall.actors.map((actor) => [actor.id, actor]));
  const configuredRoomIds = new Set(guildhall.channels.map((room) => room.id));
  for (const agent of plan.agents) {
    for (const roomId of agent.roomIds) assert.ok(configuredRoomIds.has(roomId), `${agent.profileId}: ${roomId}`);
    const primaryChannel = actorById.get(agent.profileId)?.primaryChannel;
    if (primaryChannel) assert.ok(agent.roomIds.includes(primaryChannel), `${agent.profileId}: ${primaryChannel}`);
  }
});
