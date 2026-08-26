const SECRET_FIELD = /^(?:nsec|privateKey|private_key|secret|signingKey|signing_key|credential|token|authTag|auth_tag)$/i;

function assert(condition, message) {
  if (!condition) throw new Error(`PlotPickle recommended BUZZ configuration is invalid: ${message}`);
}

function hasSecretField(value) {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(hasSecretField);
  return Object.entries(value).some(([key, child]) => SECRET_FIELD.test(key) || hasSecretField(child));
}

function nonEmptyStrings(value) {
  return Array.isArray(value) && value.length > 0 && value.every((entry) => typeof entry === "string" && entry.trim().length > 0);
}

export function validatePlotPickleRecommendedBuzzConfig(value) {
  assert(value && typeof value === "object" && !Array.isArray(value), "a configuration object is required.");
  assert(value.schemaVersion === 1, `unsupported schema version ${String(value.schemaVersion)}.`);
  assert(value.configurationVersion === "PlotPickle Recommended v1", "the configuration version must be PlotPickle Recommended v1.");
  assert(value.globalDefaults?.runtime?.id === "buzz-agent", "the runtime must be buzz-agent.");
  assert(value.globalDefaults?.provider?.id === "openai", "the provider must be OpenAI.");
  assert(value.globalDefaults?.model === "gpt-5.6-luna", "the default model must be gpt-5.6-luna.");
  assert(value.globalDefaults?.reasoningEffort === null, "reasoning effort must remain unset so the model default applies.");
  assert(value.globalDefaults?.memory === "none", "BUZZ memory must remain disabled by default.");
  assert(value.globalDefaults?.autoRestartOnConfigChange === true, "automatic restart on configuration change must be enabled.");
  assert(value.agentDefaults?.agentType === "local-managed", "official interactive Helpers must use the local-managed Agent type.");
  assert(value.agentDefaults?.parallelism === 1, "Agent parallelism must be 1.");
  assert(value.agentDefaults?.activation === "explicit-mentions", "Agent activation must require explicit mentions or assigned work.");
  assert(value.agentDefaults?.privateStoryRooms === "automatic", "private Story Rooms must be assigned automatically and temporarily.");
  assert(value.agentDefaults?.startOnBuzzLaunch === true, "interactive official Helpers must start with BUZZ.");
  assert(value.agentDefaults?.autoRestartOnConfigChange === true, "per-Agent automatic restart must be enabled.");
  assert(nonEmptyStrings(value.commonInstructions), "common Agent instructions are required.");
  assert(value.commonInstructions.length === 7, "the seven PlotPickle authority and safety rules are required.");
  assert(nonEmptyStrings(value.syncSupport?.readableFromBuzz), "the supported BUZZ read-back fields are required.");
  assert(nonEmptyStrings(value.syncSupport?.unavailableFields), "unsupported BUZZ fields must be explicit.");
  assert(value.syncSupport?.noSecretOwnerReviewedSyncAvailable === false, "complete sync must remain unavailable until BUZZ exposes a no-secret owner-reviewed contract.");
  assert(!hasSecretField(value), "private signing or credential fields are forbidden.");
  return value;
}

export function buildPlotPickleBuzzAgentInstructions({ configuration, profile, publicBio }) {
  validatePlotPickleRecommendedBuzzConfig(configuration);
  assert(profile && typeof profile === "object", "an Agent Profile is required.");
  for (const [label, value] of Object.entries({
    displayName: profile.displayName,
    title: profile.title,
    responsibility: profile.responsibility,
    creativeAuthority: profile.creativeAuthority,
    verificationContract: profile.verificationContract,
    publicBio,
  })) {
    assert(typeof value === "string" && value.trim().length > 0, `${label} is required to build Agent instructions.`);
  }
  return [
    `You are ${profile.displayName}, ${profile.title}, an official public Agent for this PlotPickle Community.`,
    publicBio.trim(),
    `Responsibility: ${profile.responsibility}`,
    `Authority: ${profile.creativeAuthority}.`,
    `Verification boundary: ${profile.verificationContract}`,
    ...configuration.commonInstructions,
  ].join("\n\n");
}
