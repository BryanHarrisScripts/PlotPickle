const REQUIRED_ARCHITECTURE_SOURCE = "architecture/plotpickle.architecture.json";
const REQUIRED_UNKNOWN_POLICY = "fail-closed";
const REQUIRED_UNKNOWN_EVIDENCE = "unmapped-production-ownership";

const DEFAULT_TOKEN_BY_LAYER = {
  "experience-skins": "skin",
  "experience-contract": "surface",
  "production-harness": "security",
  "agent-runtime": "agent",
  "story-canon": "canon",
  "provider-runtime": "provider",
  verification: "test-harness",
};

const LEGACY_MODE_MAP = {
  baseline: ["baseline"],
  "baseline-or-impact": ["baseline", "impact"],
  impact: ["impact"],
  "impact-or-release": ["impact", "release"],
  mixed: ["baseline", "impact"],
  release: ["release"],
  scheduled: ["scheduled"],
  manual: ["manual"],
};

const LEGACY_TOKEN_ALIASES = {
  pi: ["agent"],
  "developer-agent": ["agent"],
  "managed-install": ["native"],
  "process-spawn": ["native"],
  whisper: ["voice"],
  "windows-packaging": ["windows", "packaging"],
};

const unique = (items = []) => [...new Set(items)];
const arrayOfStrings = (value) => Array.isArray(value) && value.every((item) => typeof item === "string" && item.length > 0);
const canonicalLayerIds = (architecture) => (architecture?.layers ?? []).map((layer) => layer.id);
const known = (items) => new Set(items ?? []);

function pushUnknown(errors, values, allowed, label) {
  for (const value of values ?? []) {
    if (!allowed.has(value)) errors.push(`${label} contains unknown value: ${value}`);
  }
}

export function validateDisplayChecks({ architecture, phase0Inventory }) {
  const errors = [];
  const layers = architecture?.layers ?? [];
  const checks = phase0Inventory?.displayChecks ?? [];

  if (phase0Inventory?.sourceArchitecture !== REQUIRED_ARCHITECTURE_SOURCE) {
    errors.push(`display checks must point to ${REQUIRED_ARCHITECTURE_SOURCE}`);
  }
  if (checks.length !== 7 || layers.length !== 7) {
    errors.push(`expected exactly seven architecture layers and seven display checks`);
  }

  const names = new Set();
  checks.forEach((check, index) => {
    const layer = layers[index];
    if (!layer) return;
    if (check.layer !== layer.number) errors.push(`display check ${index + 1} has wrong layer number`);
    if (check.id !== layer.id) errors.push(`display check ${index + 1} has wrong architecture id`);
    if (typeof check.name !== "string" || check.name.length === 0) errors.push(`display check ${index + 1} needs a name`);
    if (names.has(check.name)) errors.push(`duplicate display check name: ${check.name}`);
    names.add(check.name);
  });

  return errors;
}

export function validateVocabulary({ architecture, phase0Inventory, vocabulary }) {
  const errors = validateDisplayChecks({ architecture, phase0Inventory });
  if (vocabulary?.sourceArchitecture !== REQUIRED_ARCHITECTURE_SOURCE) {
    errors.push(`vocabulary must point to ${REQUIRED_ARCHITECTURE_SOURCE}`);
  }
  if (vocabulary?.displayChecksSource !== "config/verification/phase-0-inventory.json#displayChecks") {
    errors.push(`display check names must have one configuration source`);
  }

  for (const key of ["riskTokens", "runnerKinds", "costClasses", "modes", "platforms", "evidenceTypes"]) {
    const values = vocabulary?.[key];
    if (!arrayOfStrings(values) || values.length === 0) errors.push(`${key} must be a non-empty string array`);
    if (Array.isArray(values) && unique(values).length !== values.length) errors.push(`${key} contains duplicates`);
  }

  if (vocabulary?.unknownProductionOwnership?.policy !== REQUIRED_UNKNOWN_POLICY) {
    errors.push(`unknown production ownership must fail closed`);
  }
  if (vocabulary?.unknownProductionOwnership?.evidenceCode !== REQUIRED_UNKNOWN_EVIDENCE) {
    errors.push(`unknown production ownership must emit ${REQUIRED_UNKNOWN_EVIDENCE}`);
  }

  return errors;
}

export function validateCatalogEntry(entry, { architecture, vocabulary }) {
  const errors = [];
  const layerIds = known(canonicalLayerIds(architecture));
  const riskTokens = known(vocabulary?.riskTokens);
  const runnerKinds = known(vocabulary?.runnerKinds);
  const costClasses = known(vocabulary?.costClasses);
  const modes = known(vocabulary?.modes);
  const platforms = known(vocabulary?.platforms);
  const evidenceTypes = known(vocabulary?.evidenceTypes);

  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return ["catalog entry must be an object"];
  if (!/^[a-z0-9][a-z0-9._-]+$/u.test(entry.id ?? "")) errors.push(`catalog entry has invalid id: ${entry.id ?? "<missing>"}`);
  if (!layerIds.has(entry.ownerLayer)) errors.push(`${entry.id ?? "catalog entry"} has unknown owner layer: ${entry.ownerLayer}`);
  if (!arrayOfStrings(entry.architectureComponents) || entry.architectureComponents.length === 0) errors.push(`${entry.id ?? "catalog entry"} needs architectureComponents`);
  if (!arrayOfStrings(entry.triggerTokens) || entry.triggerTokens.length === 0) errors.push(`${entry.id ?? "catalog entry"} needs triggerTokens`);
  pushUnknown(errors, entry.triggerTokens, riskTokens, `${entry.id ?? "catalog entry"}.triggerTokens`);

  if (!entry.runner || typeof entry.runner !== "object") {
    errors.push(`${entry.id ?? "catalog entry"} needs a typed runner`);
  } else {
    if (!runnerKinds.has(entry.runner.kind)) errors.push(`${entry.id ?? "catalog entry"} has invalid runner kind: ${entry.runner.kind}`);
    if (!arrayOfStrings(entry.runner.targets) || entry.runner.targets.length === 0) {
      errors.push(`${entry.id ?? "catalog entry"} runner needs targets`);
    }
    for (const forbidden of ["run", "shell", "command", "scriptText"]) {
      if (Object.hasOwn(entry.runner, forbidden)) errors.push(`${entry.id ?? "catalog entry"} runner cannot contain ${forbidden}`);
    }
    if (entry.runner.kind !== "legacy-workflow-step") {
      for (const target of entry.runner.targets ?? []) {
        if (/[;&|<>`\r\n]|\$\(/u.test(target)) errors.push(`${entry.id ?? "catalog entry"} runner target looks like shell text`);
      }
    }
  }

  if (!costClasses.has(entry.cost)) errors.push(`${entry.id ?? "catalog entry"} has invalid cost: ${entry.cost}`);
  if (!arrayOfStrings(entry.modes) || entry.modes.length === 0) errors.push(`${entry.id ?? "catalog entry"} needs modes`);
  pushUnknown(errors, entry.modes, modes, `${entry.id ?? "catalog entry"}.modes`);
  if (!arrayOfStrings(entry.platforms) || entry.platforms.length === 0) errors.push(`${entry.id ?? "catalog entry"} needs platforms`);
  pushUnknown(errors, entry.platforms, platforms, `${entry.id ?? "catalog entry"}.platforms`);

  for (const requirement of ["network", "native", "secrets"]) {
    if (typeof entry.requirements?.[requirement] !== "boolean") errors.push(`${entry.id ?? "catalog entry"}.requirements.${requirement} must be boolean`);
  }

  if (!arrayOfStrings(entry.evidence?.types) || entry.evidence.types.length === 0) errors.push(`${entry.id ?? "catalog entry"} needs evidence types`);
  pushUnknown(errors, entry.evidence?.types, evidenceTypes, `${entry.id ?? "catalog entry"}.evidence.types`);
  if (!Array.isArray(entry.evidence?.artifactPaths)) errors.push(`${entry.id ?? "catalog entry"}.evidence.artifactPaths must be an array`);

  return errors;
}

export function validateCatalogDocument({ catalog, architecture, vocabulary }) {
  const errors = [];
  if (catalog?.schemaVersion !== "1.0") errors.push(`catalog schemaVersion must be 1.0`);
  if (catalog?.sourceArchitecture !== REQUIRED_ARCHITECTURE_SOURCE) errors.push(`catalog must point to ${REQUIRED_ARCHITECTURE_SOURCE}`);
  if (catalog?.migrationSource !== "config/verification/phase-0-inventory.json") errors.push(`catalog must preserve the Phase 0 migration source`);
  if (!Array.isArray(catalog?.entries)) return [...errors, `catalog entries must be an array`];

  const seen = new Set();
  for (const entry of catalog.entries) {
    if (seen.has(entry.id)) errors.push(`duplicate catalog id: ${entry.id}`);
    seen.add(entry.id);
    errors.push(...validateCatalogEntry(entry, { architecture, vocabulary }));
  }
  return errors;
}

export function validateOwnershipMap({ ownership, architecture, vocabulary }) {
  const errors = [];
  const layerIds = known(canonicalLayerIds(architecture));
  const riskTokens = known(vocabulary?.riskTokens);
  if (ownership?.schemaVersion !== "1.0") errors.push(`ownership schemaVersion must be 1.0`);
  if (ownership?.sourceArchitecture !== REQUIRED_ARCHITECTURE_SOURCE) errors.push(`ownership must point to ${REQUIRED_ARCHITECTURE_SOURCE}`);
  if (ownership?.unknownProduction?.policy !== REQUIRED_UNKNOWN_POLICY) errors.push(`ownership unknown production policy must fail closed`);
  if (ownership?.unknownProduction?.evidenceCode !== REQUIRED_UNKNOWN_EVIDENCE) errors.push(`ownership unknown production evidence code is invalid`);
  if (!Array.isArray(ownership?.rules)) return [...errors, `ownership rules must be an array`];

  const seen = new Set();
  for (const rule of ownership.rules) {
    if (seen.has(rule.id)) errors.push(`duplicate ownership rule id: ${rule.id}`);
    seen.add(rule.id);
    if (!/^[a-z0-9][a-z0-9._-]+$/u.test(rule.id ?? "")) errors.push(`ownership rule has invalid id: ${rule.id ?? "<missing>"}`);
    if (!new Set(["production", "verification", "test", "docs"]).has(rule.classification)) errors.push(`${rule.id} has invalid classification`);
    if (!arrayOfStrings(rule.include) || rule.include.length === 0) errors.push(`${rule.id} needs include patterns`);
    if (!layerIds.has(rule.ownerLayer)) errors.push(`${rule.id} has unknown owner layer: ${rule.ownerLayer}`);
    if (!Array.isArray(rule.riskTokens)) errors.push(`${rule.id} riskTokens must be an array`);
    pushUnknown(errors, rule.riskTokens, riskTokens, `${rule.id}.riskTokens`);
    if (rule.classification === "production" && (rule.riskTokens?.length ?? 0) === 0) errors.push(`${rule.id} production ownership needs at least one risk token`);
  }
  return errors;
}

export function evaluateOwnershipDecision({ classification, matchedRuleIds = [], ownership }) {
  if (classification === "production" && matchedRuleIds.length === 0) {
    return {
      status: "blocked",
      policy: ownership?.unknownProduction?.policy ?? REQUIRED_UNKNOWN_POLICY,
      evidenceCode: ownership?.unknownProduction?.evidenceCode ?? REQUIRED_UNKNOWN_EVIDENCE,
    };
  }
  return { status: "mapped", matchedRuleIds: [...matchedRuleIds] };
}

export function translatePhase0Entry(entry, vocabulary) {
  const aliases = [];
  for (const token of entry.triggerExamples ?? []) {
    if (vocabulary.riskTokens.includes(token)) aliases.push(token);
    for (const mapped of LEGACY_TOKEN_ALIASES[token] ?? []) aliases.push(mapped);
  }
  const fallback = DEFAULT_TOKEN_BY_LAYER[entry.ownerLayer];
  const triggerTokens = unique([...aliases, ...(fallback ? [fallback] : [])]);
  const modes = LEGACY_MODE_MAP[entry.mode];
  const legacy = {
    workflow: entry.workflow,
    step: entry.step,
  };
  if (typeof entry.measuredSecondsApprox === "number") legacy.measuredSecondsApprox = entry.measuredSecondsApprox;

  return {
    id: entry.id,
    ownerLayer: entry.ownerLayer,
    architectureComponents: [entry.ownerLayer],
    triggerTokens,
    runner: {
      kind: "legacy-workflow-step",
      targets: [`${entry.workflow}::${entry.step}`],
    },
    cost: entry.cost,
    modes: modes ?? [],
    platforms: [entry.platform ?? "any"],
    requirements: {
      network: Boolean(entry.network),
      native: Boolean(entry.native),
      secrets: false,
    },
    evidence: {
      types: ["legacy-gate-result"],
      artifactPaths: [],
    },
    legacy,
  };
}

export function validateEvidenceRecord({ evidence, architecture }) {
  const errors = [];
  const layerIds = known(canonicalLayerIds(architecture));
  if (evidence?.schemaVersion !== "1.0") errors.push(`evidence schemaVersion must be 1.0`);
  if (!/^[0-9a-f]{40}$/u.test(evidence?.commitSha ?? "")) errors.push(`evidence commitSha must be an exact 40-character SHA`);
  if (!layerIds.has(evidence?.layerId)) errors.push(`evidence has unknown layer id: ${evidence?.layerId}`);
  if (!arrayOfStrings(evidence?.architectureComponents) || evidence.architectureComponents.length === 0) errors.push(`evidence needs architectureComponents`);
  if (!Array.isArray(evidence?.triggerReasons)) errors.push(`evidence triggerReasons must be an array`);
  if (!Array.isArray(evidence?.selectedTestIds)) errors.push(`evidence selectedTestIds must be an array`);
  if (!Array.isArray(evidence?.skippedTests)) errors.push(`evidence skippedTests must be an array`);
  if (!evidence?.runtime || typeof evidence.runtime.platform !== "string" || typeof evidence.runtime.runner !== "string") errors.push(`evidence runtime must record platform and runner`);
  if (!new Set(["pass", "fail", "not-impacted-beyond-baseline", "skipped"]).has(evidence?.result)) errors.push(`evidence result is invalid`);
  if (!Number.isInteger(evidence?.durationMs) || evidence.durationMs < 0) errors.push(`evidence durationMs must be a non-negative integer`);
  if (!Array.isArray(evidence?.artifacts)) errors.push(`evidence artifacts must be an array`);
  for (const key of ["networkUsed", "nativeUsed", "secretsAccessed"]) {
    if (typeof evidence?.security?.[key] !== "boolean") errors.push(`evidence security.${key} must be boolean`);
  }
  return errors;
}
