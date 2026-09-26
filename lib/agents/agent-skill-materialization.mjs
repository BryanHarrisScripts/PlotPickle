const CANONICAL_URI_PREFIX = "skill://plotpickle/";
const SAFE_ID = /^[a-z0-9][a-z0-9._:-]{1,127}$/i;

function materializationError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  error.details = Object.freeze({ ...details });
  return error;
}

function stableText(value, label) {
  const text = String(value || "").trim();
  if (!text) throw materializationError("INVALID_SKILL_METADATA", `${label} is required.`);
  return text;
}

function normalizedRequiredIds(values) {
  if (!Array.isArray(values)) throw materializationError("INVALID_REQUIRED_SKILLS", "Required skill ids must be an array.");
  const ids = [...new Set(values.map((value) => stableText(value, "Required skill id")))].sort();
  for (const id of ids) {
    if (!SAFE_ID.test(id)) throw materializationError("INVALID_REQUIRED_SKILLS", `Required skill id is invalid: ${id}`, { skillId: id });
  }
  return ids;
}

function normalizeSkill(skill) {
  if (!skill || typeof skill !== "object" || Array.isArray(skill)) {
    throw materializationError("INVALID_SKILL_METADATA", "Agent Skill registry contains a non-object entry.");
  }
  const id = stableText(skill.id, "Skill id");
  if (!SAFE_ID.test(id)) throw materializationError("INVALID_SKILL_METADATA", `Skill id is invalid: ${id}`, { skillId: id });
  const uri = stableText(skill.uri, `Skill ${id} URI`);
  if (uri !== `${CANONICAL_URI_PREFIX}${id}`) {
    throw materializationError("INVALID_SKILL_URI", `Skill ${id} does not use its canonical PlotPickle URI.`, { skillId: id });
  }
  const entry = stableText(skill.entry, `Skill ${id} entry`);
  const consumers = Array.isArray(skill.consumers)
    ? [...new Set(skill.consumers.map((value) => stableText(value, `Skill ${id} consumer`)))].sort()
    : [];
  if (!consumers.length) {
    throw materializationError("INVALID_SKILL_CONSUMERS", `Skill ${id} must declare at least one consumer.`, { skillId: id });
  }
  return {
    id,
    name: stableText(skill.name, `Skill ${id} name`),
    uri,
    entry,
    roles: Array.isArray(skill.roles) ? [...skill.roles].map(String).sort() : [],
    primaryWorker: stableText(skill.primaryWorker, `Skill ${id} primary worker`),
    consumers,
    mcpReady: skill.mcpReady === true,
    localOnly: skill.localOnly === true,
  };
}

export async function materializeAgentSkillsForRun(registry, {
  consumer,
  requiredSkillIds = [],
  entryExists = async () => true,
} = {}) {
  if (!registry || registry.schemaVersion !== 1 || !Array.isArray(registry.skills)) {
    throw materializationError("INVALID_SKILL_REGISTRY", "PlotPickle Agent Skill registry is invalid.");
  }
  const requestedConsumer = stableText(consumer, "Agent Skill consumer");
  const requiredIds = normalizedRequiredIds(requiredSkillIds);
  const normalized = registry.skills.map(normalizeSkill).sort((a, b) => a.id.localeCompare(b.id));
  const byId = new Map();
  for (const skill of normalized) {
    if (byId.has(skill.id)) {
      throw materializationError("DUPLICATE_SKILL_ID", `Duplicate PlotPickle Agent Skill id: ${skill.id}`, { skillId: skill.id });
    }
    byId.set(skill.id, skill);
  }

  const selected = new Map(
    normalized
      .filter((skill) => skill.consumers.includes(requestedConsumer))
      .map((skill) => [skill.id, skill]),
  );

  for (const skillId of requiredIds) {
    const skill = byId.get(skillId);
    if (!skill) {
      throw materializationError("UNKNOWN_REQUIRED_SKILL", `Required PlotPickle Agent Skill is unknown: ${skillId}`, {
        consumer: requestedConsumer,
        skillId,
      });
    }
    if (!skill.consumers.includes(requestedConsumer)) {
      throw materializationError("INELIGIBLE_REQUIRED_SKILL", `Required PlotPickle Agent Skill ${skillId} is not enabled for consumer ${requestedConsumer}.`, {
        consumer: requestedConsumer,
        skillId,
      });
    }
    selected.set(skill.id, skill);
  }

  const skills = [...selected.values()].sort((a, b) => a.id.localeCompare(b.id));
  for (const skill of skills) {
    if (!(await entryExists(skill.entry, skill))) {
      throw materializationError("SKILL_ENTRY_UNAVAILABLE", `PlotPickle Agent Skill ${skill.id} could not be materialized from its registered entry.`, {
        consumer: requestedConsumer,
        skillId: skill.id,
        entry: skill.entry,
      });
    }
  }

  return Object.freeze({
    schemaVersion: 1,
    discovery: String(registry.discovery || "progressive"),
    consumer: requestedConsumer,
    requiredSkillIds: Object.freeze(requiredIds),
    skills: Object.freeze(skills.map((skill) => Object.freeze({ ...skill }))),
  });
}

export const AGENT_SKILL_MATERIALIZATION_URI_PREFIX = CANONICAL_URI_PREFIX;
