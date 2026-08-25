export const STORY_PICKLE_PROFILE_IDS = Object.freeze(["knot-pickle", "thread-pickle", "heart-pickle"]);

const SECRET_FIELD = /^(?:nsec|privateKey|private_key|secret|signingKey|signing_key|credential|token)$/i;
const CARD_FILE = /^(?:Knot|Thread|Heart)-Pickle\.agent\.png$/;
const SHA256 = /^[a-f0-9]{64}$/i;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function hasSecretShapedField(value) {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(hasSecretShapedField);
  return Object.entries(value).some(([key, child]) => SECRET_FIELD.test(key) || hasSecretShapedField(child));
}

function requireText(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function profileContracts(config) {
  const ids = Array.isArray(config?.profileIds) ? config.profileIds : [];
  if (config?.schemaVersion !== 1) throw new Error("Unsupported portable Story Pickle schema.");
  if (ids.length !== STORY_PICKLE_PROFILE_IDS.length || ids.some((id, index) => id !== STORY_PICKLE_PROFILE_IDS[index])) {
    throw new Error("Portable Story Pickles must contain Knot, Thread and Heart in canonical order.");
  }
  if (hasSecretShapedField(config)) throw new Error("Portable Story Pickle configuration contains a forbidden private field.");

  return ids.map((profileId) => {
    const contract = config.contracts?.[profileId];
    if (!contract) throw new Error(`Portable Story Pickle contract is missing ${profileId}.`);
    requireText(contract.writerProblem, `${profileId} writer problem`);
    requireText(contract.valueStatement, `${profileId} value statement`);
    if (!Array.isArray(contract.instructions) || contract.instructions.length < 4 || contract.instructions.some((line) => !requireText(line, `${profileId} instruction`))) {
      throw new Error(`${profileId} requires bounded instructions.`);
    }
    if (!Array.isArray(contract.responseShape) || contract.responseShape.length !== 4) throw new Error(`${profileId} requires a four-part response shape.`);
    const defaults = contract.recommendedBuzzDefaults;
    if (defaults?.agentHarness !== "Buzz Agent" || defaults?.memory !== "none" || defaults?.respondToPolicy !== "owner-only") {
      throw new Error(`${profileId} must use the approved BUZZ defaults.`);
    }
    if (defaults.parallelism !== 1 || defaults.locked !== false || !Array.isArray(defaults.bundledMemories) || defaults.bundledMemories.length) {
      throw new Error(`${profileId} must be unlocked, memory-free and single-turn parallel.`);
    }
    const distribution = contract.distribution;
    if (!CARD_FILE.test(distribution?.fileName || "")) throw new Error(`${profileId} has an invalid BUZZ card filename.`);
    if (distribution.artifactPath !== `public/downloads/story-pickles/${distribution.fileName}`) {
      throw new Error(`${profileId} has an invalid public artifact path.`);
    }
    if (distribution.sha256 !== null && !SHA256.test(distribution.sha256 || "")) {
      throw new Error(`${profileId} has an invalid recorded checksum.`);
    }
    return { profileId, contract };
  });
}

export function validatePortableStoryPickleConfig(config) {
  profileContracts(config);
  if (config.bundle?.fileName !== "All-Three-Story-Pickles.zip") throw new Error("Portable Story Pickles require the canonical all-three bundle filename.");
  return config;
}

export function buildStoryPickleMintPreparation({ portableConfig, agentProfiles, publicProfiles, communityAgents }) {
  const contracts = profileContracts(portableConfig);
  const profileById = new Map(agentProfiles.map((profile) => [profile.id, profile]));
  const helperById = new Map(communityAgents.map((helper) => [helper.profileId, helper]));
  const prepared = contracts.map(({ profileId, contract }) => {
    const profile = profileById.get(profileId);
    const presentation = publicProfiles[profileId];
    const helper = helperById.get(profileId);
    if (!profile || !presentation || !helper) throw new Error(`Mint preparation cannot resolve canonical owners for ${profileId}.`);
    return {
      profileId,
      displayName: profile.displayName,
      title: profile.title,
      writerProblem: contract.writerProblem,
      valueStatement: contract.valueStatement,
      publicBio: presentation.publicBio,
      portraitRef: presentation.avatarRef,
      instructions: contract.instructions,
      responseShape: contract.responseShape,
      recommendedBuzzDefaults: contract.recommendedBuzzDefaults,
      checklist: [
        "Create or import the Agent in BUZZ using the canonical display name, portrait and instructions.",
        "Inspect the complete prompt, confirm memory is none and confirm no previous conversation is bundled.",
        "Keep Respond to owner-only for the mint; the receiving community owner may deliberately broaden it later.",
        "Mint the genuine unlocked BUZZ card only after the prompt and portrait are approved.",
        `Supply the minted card as ${contract.distribution.fileName} and record its SHA-256 checksum before enabling public download.`,
      ],
    };
  });
  const result = {
    schemaVersion: 1,
    packageKind: "plotpickle-owner-mint-preparation",
    warning: "Owner preparation only. This JSON is not a minted or importable BUZZ Agent card.",
    profiles: prepared,
  };
  if (hasSecretShapedField(result)) throw new Error("Mint preparation contains a forbidden private field.");
  return result;
}

export function resolveStoryPickleArtifactState(portableConfig, artifactBytesByProfileId, sha256) {
  const contracts = profileContracts(portableConfig);
  const individuals = contracts.map(({ profileId, contract }) => {
    const bytes = artifactBytesByProfileId[profileId] ?? null;
    const expected = contract.distribution.sha256;
    let status = "awaiting-official-mint";
    if (expected) {
      if (!bytes || bytes.byteLength === 0) status = "minted-artifact-missing";
      else if (PNG_SIGNATURE.some((byte, index) => bytes[index] !== byte)) status = "invalid-agent-card";
      else status = sha256(bytes) === expected.toLowerCase() ? "verified" : "checksum-mismatch";
    }
    return {
      profileId,
      fileName: contract.distribution.fileName,
      sha256: expected,
      available: status === "verified",
      status,
    };
  });
  const available = individuals.every((artifact) => artifact.available);
  return {
    individuals,
    bundle: {
      fileName: portableConfig.bundle.fileName,
      available,
      status: available ? "verified" : "awaiting-all-official-mints",
      profileIds: STORY_PICKLE_PROFILE_IDS,
    },
  };
}
