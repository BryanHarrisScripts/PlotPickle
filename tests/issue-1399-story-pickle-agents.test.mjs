import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  STORY_PICKLE_PROFILE_IDS,
  buildStoryPickleMintPreparation,
  resolveStoryPickleArtifactState,
  validatePortableStoryPickleConfig,
} from "../lib/buzz/story-pickle-agents-core.mjs";

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8");
const json = async (relativePath) => JSON.parse(await read(relativePath));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const secretField = /^(?:nsec|privateKey|private_key|secret|signingKey|signing_key|credential|token)$/i;

function hasSecretShapedField(value) {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(hasSecretShapedField);
  return Object.entries(value).some(([key, child]) => secretField.test(key) || hasSecretShapedField(child));
}

test("#1399 registers three bounded public-BUZZ Agent Profiles without private PlotPickle authority", async () => {
  const [profiles, presentations] = await Promise.all([
    json("config/agent-profiles.json"),
    json("config/agent-profile-extensions/public.json"),
  ]);
  const expected = new Map([
    ["knot-pickle", ["Knot Pickle", "Story Momentum Guide", "story-momentum-options"]],
    ["thread-pickle", ["Thread Pickle", "Plot & Continuity Repair Guide", "continuity-repair-options"]],
    ["heart-pickle", ["Heart Pickle", "Character & Emotion Guide", "character-development-options"]],
  ]);
  assert.deepEqual(STORY_PICKLE_PROFILE_IDS, [...expected.keys()]);
  for (const [id, [displayName, title, proposalScope]] of expected) {
    const profile = profiles.profiles.find((candidate) => candidate.id === id);
    assert.ok(profile, `missing canonical Agent Profile ${id}`);
    assert.equal(profile.displayName, displayName);
    assert.equal(profile.title, title);
    assert.equal(profile.execution.kind, "buzz-managed");
    assert.equal(profile.buzzBinding.mode, "native");
    assert.equal(profile.requestedCapabilityRole, "quality");
    assert.deepEqual(profile.readScopes, ["current-conversation", "explicitly-supplied-story-material"]);
    assert.ok(profile.proposalScopes.includes(proposalScope));
    assert.equal(profile.creativeAuthority, "proposal-only");
    for (const forbidden of ["private-project-read", "ppf-project-read", "canon-write", "external-publish", "buzz-identity-create"]) {
      assert.ok(profile.forbiddenCapabilities.includes(forbidden), `${id} must forbid ${forbidden}`);
    }
    assert.deepEqual(presentations.profiles[id].executionContexts, ["public-buzz"]);
    assert.equal(presentations.profiles[id].officialBuzzIdentity.pubkey, null);
    assert.equal(presentations.profiles[id].avatarRef, `/assets/helpers/official/${id}.webp`);
  }
});

test("#1399 canonical portable contracts preserve the requested writer problems, response shapes and BUZZ defaults", async () => {
  const portable = validatePortableStoryPickleConfig(await json("config/agent-profile-extensions/portable-story-pickles.json"));
  assert.deepEqual(portable.profileIds, STORY_PICKLE_PROFILE_IDS);
  assert.equal(hasSecretShapedField(portable), false);
  assert.match(portable.contracts["knot-pickle"].writerProblem, /stuck/i);
  assert.match(portable.contracts["thread-pickle"].writerProblem, /make sense/i);
  assert.match(portable.contracts["heart-pickle"].writerProblem, /characters working/i);
  for (const id of STORY_PICKLE_PROFILE_IDS) {
    const contract = portable.contracts[id];
    assert.equal(contract.responseShape.length, 4);
    assert.deepEqual(contract.recommendedBuzzDefaults, {
      agentHarness: "Buzz Agent",
      memory: "none",
      respondToPolicy: "owner-only",
      parallelism: 1,
      locked: false,
      bundledMemories: [],
    });
    const instructions = contract.instructions.join("\n");
    assert.match(instructions, /explicitly supplies|explicitly supplied/i);
    assert.match(instructions, /advisory|proposal-only/i);
    assert.match(instructions, /PPF state/);
    assert.match(instructions, /canon/i);
  }
});

test("#1399 Helpers use the canonical public roster, order the three Story Pickles first and remove inactive Help pills", async () => {
  const [community, presentations, directory] = await Promise.all([
    json("plugins/plotpickle-playhouse/community.json"),
    json("config/agent-profile-extensions/public.json"),
    read("app/settings-helper-directory.tsx"),
  ]);
  assert.deepEqual(community.agents.slice(0, 3).map((agent) => agent.profileId), STORY_PICKLE_PROFILE_IDS);
  assert.deepEqual(
    community.agents.map((agent) => agent.profileId).sort(),
    Object.keys(presentations.profiles).sort(),
    "Helpers must follow the canonical public presentation roster",
  );
  for (const helper of community.agents.slice(0, 3)) {
    assert.equal(helper.helpGroup, "writing-story");
    assert.deepEqual(helper.roomIds, ["story-council"]);
    assert.deepEqual(Object.keys(helper).sort(), ["helpGroup", "helpPrompt", "profileId", "roomIds", "shortBio"]);
  }
  assert.doesNotMatch(directory, /Getting Started · coming later|AI Setup · coming later|Projects & Backups · coming later/);
  assert.match(directory, /directoryHero/);
  assert.match(directory, /aria-current="page">Meet the Helpers/);
  assert.match(directory, /Official BUZZ card awaiting verified mint/);
  assert.match(directory, /cannot read PlotPickle projects, memory or canon/);
  assert.match(directory, /Each BUZZ import creates a fresh community-local Agent identity/);
  assert.match(directory, /No signer, private memory, previous conversation or PlotPickle project authority transfers/);
});

test("#1399 portraits exist as canonical public assets and resolve through AgentPortrait", async () => {
  const portrait = await read("components/agent-portrait.tsx");
  for (const id of STORY_PICKLE_PROFILE_IDS) {
    assert.match(portrait, new RegExp(`id: ["']${id}["'][^\\n]+source: ["']canonical-asset["']`));
    const assetPath = path.join(root, "public", "assets", "helpers", "official", `${id}.webp`);
    await access(assetPath);
    const bytes = await readFile(assetPath);
    assert.equal(bytes.subarray(0, 4).toString("ascii"), "RIFF");
    assert.equal(bytes.subarray(8, 12).toString("ascii"), "WEBP");
    assert.ok(bytes.byteLength > 50_000, `${id} portrait must be a substantial canonical asset`);
  }
  assert.match(portrait, /className=\{styles\.canonicalPortrait\}/);
  assert.match(portrait, /data-public-avatar-ref=\{canonicalAvatarRef \|\| undefined\}/);
});

test("#1399 public artifacts remain unavailable until every genuine card is present, non-empty and checksum verified", async () => {
  const portable = await json("config/agent-profile-extensions/portable-story-pickles.json");
  const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const fakeCards = Object.fromEntries(STORY_PICKLE_PROFILE_IDS.map((id) => [id, Buffer.concat([pngSignature, Buffer.from(`genuine-test-card:${id}`)])]));
  const awaiting = resolveStoryPickleArtifactState(portable, fakeCards, sha256);
  assert.ok(awaiting.individuals.every((artifact) => artifact.available === false && artifact.status === "awaiting-official-mint"));
  assert.equal(awaiting.bundle.available, false);

  const verifiedConfig = structuredClone(portable);
  for (const id of STORY_PICKLE_PROFILE_IDS) verifiedConfig.contracts[id].distribution.sha256 = sha256(fakeCards[id]);
  const verified = resolveStoryPickleArtifactState(verifiedConfig, fakeCards, sha256);
  assert.ok(verified.individuals.every((artifact) => artifact.available && artifact.status === "verified"));
  assert.deepEqual(verified.bundle.profileIds, STORY_PICKLE_PROFILE_IDS);
  assert.equal(verified.bundle.available, true);

  const tampered = { ...fakeCards, "thread-pickle": Buffer.concat([pngSignature, Buffer.from("tampered")]) };
  const rejected = resolveStoryPickleArtifactState(verifiedConfig, tampered, sha256);
  assert.equal(rejected.individuals.find((artifact) => artifact.profileId === "thread-pickle").status, "checksum-mismatch");
  assert.equal(rejected.bundle.available, false);

  const invalid = resolveStoryPickleArtifactState(verifiedConfig, { ...fakeCards, "thread-pickle": Buffer.from("not-a-png") }, sha256);
  assert.equal(invalid.individuals.find((artifact) => artifact.profileId === "thread-pickle").status, "invalid-agent-card");
});

test("#1399 all-three download is assembled from the same verified individual cards without identity gating", async () => {
  const route = await read("app/api/story-pickle-downloads/route.ts");
  assert.match(route, /createStoreZip\(entries\)/);
  assert.match(route, /entries\[artifact\.fileName\] = artifacts\[artifact\.profileId/);
  assert.match(route, /Each import creates a fresh community-local Agent identity/);
  assert.match(route, /No PlotPickle project authority, private memory, conversation history, signer or credential is transferred/);
  assert.doesNotMatch(route, /authorized\(|requireAuth|sessionCookie/);
  assert.match(route, /artifact\.available \? .*downloadUrl/s);
  assert.match(route, /awaiting its official verified mint/);
});

test("#1399 owner mint preparation generates exactly three inspectable memory-free contracts and no private fields", async () => {
  const [portableConfig, profiles, presentations, community] = await Promise.all([
    json("config/agent-profile-extensions/portable-story-pickles.json"),
    json("config/agent-profiles.json"),
    json("config/agent-profile-extensions/public.json"),
    json("plugins/plotpickle-playhouse/community.json"),
  ]);
  const preparation = buildStoryPickleMintPreparation({
    portableConfig,
    agentProfiles: profiles.profiles,
    publicProfiles: presentations.profiles,
    communityAgents: community.agents,
  });
  assert.deepEqual(preparation.profiles.map((profile) => profile.profileId), STORY_PICKLE_PROFILE_IDS);
  assert.equal(hasSecretShapedField(preparation), false);
  assert.ok(preparation.profiles.every((profile) => profile.recommendedBuzzDefaults.memory === "none"));
  assert.ok(preparation.profiles.every((profile) => profile.recommendedBuzzDefaults.bundledMemories.length === 0));
  assert.match(preparation.warning, /not a minted or importable BUZZ Agent card/);

  const output = await mkdtemp(path.join(tmpdir(), "plotpickle-story-pickles-"));
  try {
    await execFileAsync(process.execPath, [
      path.join(root, "scripts", "prepare-story-pickle-mint-package.mjs"),
      `--output=${output}`,
    ], { cwd: root });
    const generated = JSON.parse(await readFile(path.join(output, "story-pickle-mint-preparation.json"), "utf8"));
    assert.deepEqual(generated, preparation);
    assert.equal(hasSecretShapedField(generated), false);
  } finally {
    await rm(output, { recursive: true, force: true });
  }
});
