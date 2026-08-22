import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
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

const INTERNAL_AGENT_IDS = [
  "avery-north",
  "luma-glassfern",
  "bram-gatewick",
  "rook-ironquill",
  "ben",
];

function containsSecretField(value) {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(containsSecretField);
  return Object.entries(value).some(([key, child]) =>
    /^(?:nsec|privateKey|private_key|secret|signingKey|signing_key|credential|token)$/i.test(key)
      || containsSecretField(child));
}

test("#1281 PlotPicklePlayhouse has exactly twelve official public Agent presentations", async () => {
  const publicConfig = await readJson("config/agent-profile-extensions/public.json");
  assert.equal(publicConfig.schemaVersion, 1);
  assert.deepEqual(Object.keys(publicConfig.profiles), PUBLIC_AGENT_IDS);

  for (const id of PUBLIC_AGENT_IDS) {
    const presentation = publicConfig.profiles[id];
    assert.ok(presentation.publicBio.length > 0 && presentation.publicBio.length <= 500, `${id} requires a public bio`);
    assert.equal(presentation.avatarRef, `/assets/helpers/lore/${id}.svg`);
    assert.ok(presentation.executionContexts.includes("public-buzz"), `${id} must be a public BUZZ personality`);
    assert.equal(presentation.officialBuzzIdentity.provisioning, "external-buzz-admin");
    assert.ok(presentation.officialBuzzIdentity.pubkey === null || /^[a-f0-9]{64}$/i.test(presentation.officialBuzzIdentity.pubkey));
    await access(new URL(`../public${presentation.avatarRef}`, import.meta.url));
  }

  assert.equal(containsSecretField(publicConfig), false);
  assert.doesNotMatch(JSON.stringify(publicConfig), /nsec1[a-z0-9]+/i);
});

test("#1281 operational Agents remain internal instead of becoming PlotPicklePlayhouse personalities", async () => {
  const [base, publicConfig] = await Promise.all([
    readJson("config/agent-profiles.json"),
    readJson("config/agent-profile-extensions/public.json"),
  ]);
  const baseIds = new Set(base.profiles.map((profile) => profile.id));
  for (const id of INTERNAL_AGENT_IDS) {
    assert.ok(baseIds.has(id), `${id} remains a valid internal Agent Profile`);
    assert.equal(publicConfig.profiles[id], undefined, `${id} must not have a public Community presentation`);
  }
});

test("#1281 connected BUZZ private key is explicitly Human authority and never an official Agent signer", async () => {
  const [gateway, ui] = await Promise.all([
    read("build/buzz-agent-roster-gateway.ts"),
    read("app/community-agent-roster.tsx"),
  ]);

  assert.match(gateway, /The Human signer authenticates this read-only query\. It is never used to sign as a PlotPickle Agent\./);
  assert.match(gateway, /BUZZ_PRIVATE_KEY: connection\.privateKey/);
  assert.match(gateway, /Human signer authenticates the read only; it never owns or signs as an official PlotPickle Agent/);
  assert.match(gateway, /configured public signer, never by Human ownership/);
  assert.doesNotMatch(gateway, /officialBuzzIdentity\.(?:privateKey|private_key|nsec|secret|signingKey)/);

  assert.match(ui, /Your connected BUZZ account remains your Human identity/);
  assert.match(ui, /The connected Human signer is never an Agent signer/);
});

test("#1281 Community surfaces only canonical public personalities and BUZZ status uses the same contract", async () => {
  const [ui, gateway] = await Promise.all([
    read("app/community-agent-roster.tsx"),
    read("build/buzz-agent-roster-gateway.ts"),
  ]);

  assert.match(ui, /filter\(\(agent\) => Boolean\(agent\.publicBio && agent\.avatarRef\)\)/);
  assert.match(ui, /agent\.publicBio \|\| agent\.summary/);
  assert.doesNotMatch(ui, /PRIVATE_PROJECT_AGENT_IDS/);
  assert.match(gateway, /BUZZ_GUILDHALL_ACTORS\.filter\(\(actor\) => Boolean\(agentProfileById\(actor\.id\)\?\.publicPresentation\)\)/);
});
