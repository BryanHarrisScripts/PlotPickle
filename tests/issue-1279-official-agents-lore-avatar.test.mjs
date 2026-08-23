import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const readJson = async (path) => JSON.parse(await read(path));

const OFFICIAL_WIZARDS = [
  "sage-brinewick",
  "tamsin-hearthquill",
  "master-oaken-vague",
  "rowan-scalequill",
  "quillan-reedcloak",
];

function containsSecretField(value) {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(containsSecretField);
  return Object.entries(value).some(([key, child]) =>
    /^(?:nsec|privateKey|private_key|secret|signingKey|signing_key|credential|token)$/i.test(key)
      || containsSecretField(child));
}

test("#1279 canonical five wizards own one public PlotPickle presentation contract", async () => {
  const [base, publicConfig, learnRoster] = await Promise.all([
    readJson("config/agent-profiles.json"),
    readJson("config/agent-profile-extensions/public.json"),
    read("modules/learn/model/learn-agent-roster.ts"),
  ]);
  assert.equal(publicConfig.schemaVersion, 1);
  const publicIds = new Set(Object.keys(publicConfig.profiles));
  for (const id of OFFICIAL_WIZARDS) assert.ok(publicIds.has(id), `Public presentation missing ${id}`);
  const baseIds = new Set(base.profiles.map((profile) => profile.id));
  for (const id of OFFICIAL_WIZARDS) {
    assert.ok(baseIds.has(id), `Host Agent Profile missing ${id}`);
    assert.ok(learnRoster.includes(`"${id}"`), `LEARN roster missing ${id}`);
    const presentation = publicConfig.profiles[id];
    assert.equal(presentation.avatarRef, `/assets/helpers/official/${id}.webp`);
    assert.ok(presentation.publicBio.length >= 1 && presentation.publicBio.length <= 500);
    assert.deepEqual(presentation.executionContexts, ["private-local", "public-buzz"]);
    assert.equal(presentation.officialBuzzIdentity.provisioning, "external-buzz-admin");
    assert.ok(presentation.officialBuzzIdentity.pubkey === null || /^[a-f0-9]{64}$/i.test(presentation.officialBuzzIdentity.pubkey));
  }
});

test("#1279 distributed public Agent metadata contains no official private signing material", async () => {
  const publicConfig = await readJson("config/agent-profile-extensions/public.json");
  assert.equal(containsSecretField(publicConfig), false);
  assert.doesNotMatch(JSON.stringify(publicConfig), /nsec1[a-z0-9]+/i);

  const profiles = await read("lib/agents/agent-profiles.ts");
  assert.match(profiles, /provisioning: "external-buzz-admin"/);
  assert.match(profiles, /pubkey !== null && !\/\^\[a-f0-9\]\{64\}\$\/i/);
  assert.match(profiles, /publicPresentationHasSecretField/);
  assert.match(profiles, /officialAgentPublicIdentity/);
});

test("#1279 Sage remains one routed embedded Agent with private-local and public-BUZZ contexts", async () => {
  const [base, publicConfig, profileRuntime] = await Promise.all([
    readJson("config/agent-profiles.json"),
    readJson("config/agent-profile-extensions/public.json"),
    read("lib/agents/agent-profiles.ts"),
  ]);
  const sage = base.profiles.find((profile) => profile.id === "sage-brinewick");
  assert.ok(sage);
  assert.equal(base.profiles.filter((profile) => profile.id === "sage-brinewick").length, 1);
  assert.equal(sage.execution.kind, "embedded-mastra");
  assert.equal(sage.execution.roleId, "curriculum-guide");
  assert.equal(sage.requestedCapabilityRole, "quality");
  assert.equal("model" in sage, false, "Sage must not be pinned to one tiny model in the Agent Profile");
  assert.deepEqual(publicConfig.profiles["sage-brinewick"].executionContexts, ["private-local", "public-buzz"]);
  assert.match(profileRuntime, /AGENT_PROFILE_EXECUTION_CONTEXTS = \["private-local", "public-buzz"\]/);
});

test("#1279 official BUZZ Agent lookup matches public signer instead of Human ownership", async () => {
  const gateway = await read("build/buzz-agent-roster-gateway.ts");
  assert.match(gateway, /profileContract\s*\?\s*\["--format", "compact", "users", "get", "--name", actor\.displayName\]/);
  assert.match(gateway, /:\s*\["--format", "compact", "users", "get", "--name", actor\.displayName, "--owner", "me"\]/);
  assert.match(gateway, /pubkey\.toLowerCase\(\) !== expectedPubkey\.toLowerCase\(\)/);
  assert.match(gateway, /Human signer authenticates this read-only query/);
  assert.match(gateway, /BUZZ_PRIVATE_KEY: connection\.privateKey/);
  assert.doesNotMatch(gateway, /officialBuzzIdentity\.(?:privateKey|private_key|nsec|secret|signingKey)/);
});

test("#1279 Community shows official Agent state without requiring ownedByMe", async () => {
  const [ui, roster] = await Promise.all([
    read("app/community-agent-roster.tsx"),
    read("lib/community-agent-roster.ts"),
  ]);
  assert.match(ui, /officialIdentity \|\| identity\.ownedByMe/);
  assert.match(ui, /Official BUZZ identity · Admin provisioning pending/);
  assert.match(ui, /Official PlotPickle Agent private signers stay with PlotPickle Admin outside the distributed app/);
  assert.match(roster, /public-buzz/);
  assert.match(roster, /public or explicitly shared context only/);
  assert.match(roster, /will not substitute the connected Human identity/);
});

test("#1279 Generate Lore Avatar reuses the selected image route and saves only after generation succeeds", async () => {
  const [contract, panel, route] = await Promise.all([
    read("lib/buzz-default-community.ts"),
    read("app/profile-access/profile-identity-panel.tsx"),
    read("app/api/auth/profile-presentation/route.ts"),
  ]);
  assert.match(contract, /PLOTPICKLE LORE AVATAR CONTRACT/);
  assert.match(contract, /\/api\\\/local-ai\\\/assets/);
  assert.match(panel, /buildHumanLoreAvatarPrompt\(description\)/);
  assert.match(panel, /fetch\("\/api\/local-ai\/generate\/image"/);
  assert.match(panel, /assetId: `human-lore-avatar-\$\{profile\.profileId\}`/);
  assert.match(panel, /const saved = await saveLocalPresentation\(next\)/);
  assert.match(panel, /setPresentation\(saved\.profile\)/);
  assert.ok(panel.indexOf("const saved = await saveLocalPresentation(next)") < panel.indexOf("setPresentation(saved.profile)"));
  assert.match(panel, /Your current avatar was not changed/);
  assert.doesNotMatch(panel, /\/api\/(?:auth\/)?(?:generate-)?lore-avatar/);

  assert.match(route, /isPlotPickleGeneratedAvatarRef\(normalized\)/);
  assert.match(route, /runtimeState\.privateStorage\.writePrivateJson\(authContext/);
  assert.match(route, /objectId: PRESENTATION_OBJECT_ID/);
  assert.match(route, /authorized\(request, true\)/);
});

test("#1279 local generated Lore Avatar never impersonates a remotely reachable BUZZ picture", async () => {
  const panel = await read("app/profile-access/profile-identity-panel.tsx");
  const buzzGateway = await read("build/buzz-profile-identity-gateway.ts");
  assert.match(panel, /isPlotPickleGeneratedAvatarRef\(result\.profile\.avatarUrl\)/);
  assert.match(panel, /BUZZ avatar was not replaced/);
  assert.match(panel, /disabled=\{Boolean\(busy\) \|\| localGeneratedAvatar\}/);
  assert.match(buzzGateway, /BUZZ avatar images must use a secure https:\/\/ address without credentials/);
});
