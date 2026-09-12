import { validateCatalogDocument, validateEvidenceRecord, validateOwnershipMap, validateVocabulary } from "./verification-contracts.mjs";

const COST_ORDER = new Map([["fast", 0], ["medium", 1], ["heavy", 2]]);
const EXECUTION_MODES = new Set(["impact", "release", "scheduled", "manual"]);
const uniqueSorted = (items = []) => [...new Set(items)].sort((a, b) => a.localeCompare(b));

export class VerificationConfigurationError extends Error {
  constructor(errors) {
    super(`Verification configuration is invalid:\n${errors.map((error) => `- ${error}`).join("\n")}`);
    this.name = "VerificationConfigurationError";
    this.errors = [...errors];
  }
}

export class VerificationPlanningError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = "VerificationPlanningError";
    this.details = details;
  }
}

function escapeRegex(value) {
  return value.replace(/[.+^${}()|[\]\\]/gu, "\\$&");
}

export function globToRegExp(pattern) {
  const normalized = String(pattern ?? "").replaceAll("\\", "/");
  let output = "";
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    if (char === "*") {
      if (normalized[index + 1] === "*") {
        output += ".*";
        index += 1;
      } else {
        output += "[^/]*";
      }
    } else if (char === "?") {
      output += "[^/]";
    } else {
      output += escapeRegex(char);
    }
  }
  return new RegExp(`^${output}$`, "u");
}

export function pathMatches(pattern, filePath) {
  const normalizedPath = String(filePath ?? "").replaceAll("\\", "/").replace(/^\.\//u, "");
  return globToRegExp(pattern).test(normalizedPath);
}

export function validateVerificationConfiguration({ architecture, phase0Inventory, vocabulary, catalog, ownership }) {
  return [
    ...validateVocabulary({ architecture, phase0Inventory, vocabulary }),
    ...validateCatalogDocument({ catalog, architecture, vocabulary }),
    ...validateOwnershipMap({ ownership, architecture, vocabulary }),
  ];
}

export function resolveChangedFile(filePath, ownership) {
  const normalizedPath = String(filePath).replaceAll("\\", "/").replace(/^\.\//u, "");
  const matches = (ownership.rules ?? [])
    .filter((rule) => (rule.include ?? []).some((pattern) => pathMatches(pattern, normalizedPath)))
    .sort((a, b) => a.id.localeCompare(b.id));

  if (matches.length === 0) {
    return {
      path: normalizedPath,
      classification: "production",
      status: "blocked",
      evidenceCode: ownership.unknownProduction.evidenceCode,
      ruleIds: [],
      ownerLayers: [],
      riskTokens: [],
    };
  }

  const classifications = uniqueSorted(matches.map((rule) => rule.classification));
  return {
    path: normalizedPath,
    classification: classifications.includes("production") ? "production" : classifications[0],
    classifications,
    status: "mapped",
    ruleIds: matches.map((rule) => rule.id),
    ownerLayers: uniqueSorted(matches.map((rule) => rule.ownerLayer)),
    riskTokens: uniqueSorted(matches.flatMap((rule) => rule.riskTokens ?? [])),
  };
}

function permissionSkipReason(entry, options) {
  const currentPlatform = options.platform ?? "any";
  if (!(entry.platforms.includes("any") || entry.platforms.includes(currentPlatform))) {
    return { reasonCode: "platform-not-selected", reason: `requires ${entry.platforms.join(", ")}; current platform is ${currentPlatform}` };
  }
  if (entry.cost === "heavy" && !options.allowHeavy) {
    return { reasonCode: "heavy-not-authorized", reason: "heavy verification requires explicit authorization" };
  }
  if (entry.requirements.network && !options.allowNetwork) {
    return { reasonCode: "network-not-authorized", reason: "network activity requires explicit authorization" };
  }
  if (entry.requirements.native && !options.allowNative) {
    return { reasonCode: "native-not-authorized", reason: "native execution requires explicit authorization" };
  }
  if (entry.requirements.secrets && !options.allowSecrets) {
    return { reasonCode: "secrets-not-authorized", reason: "secret access requires explicit authorization" };
  }
  return null;
}

function entrySelection(entry, { mode, riskTokens, options }) {
  const reasons = [];
  if (entry.modes.includes("baseline")) reasons.push({ kind: "baseline", value: "architecture baseline" });

  if (mode && EXECUTION_MODES.has(mode) && entry.modes.includes(mode)) {
    if (mode === "impact") {
      const matchingTokens = entry.triggerTokens.filter((token) => riskTokens.has(token)).sort((a, b) => a.localeCompare(b));
      reasons.push(...matchingTokens.map((token) => ({ kind: "risk-token", value: token })));
    } else {
      reasons.push({ kind: mode, value: `${mode} verification requested` });
    }
  }

  if (reasons.length === 0) return { status: "not-selected", reasons: [] };
  const blocked = permissionSkipReason(entry, options);
  if (blocked) return { status: "skipped", reasons, ...blocked };
  return { status: "selected", reasons };
}

export function planVerification({
  changedFiles = [],
  architecture,
  phase0Inventory,
  vocabulary,
  catalog,
  ownership,
  mode = "impact",
  platform = "any",
  allowHeavy = false,
  allowNetwork = false,
  allowNative = false,
  allowSecrets = false,
} = {}) {
  const configurationErrors = validateVerificationConfiguration({ architecture, phase0Inventory, vocabulary, catalog, ownership });
  if (configurationErrors.length > 0) throw new VerificationConfigurationError(configurationErrors);
  if (!EXECUTION_MODES.has(mode)) throw new VerificationPlanningError(`Unsupported verification mode: ${mode}`);

  const resolvedFiles = uniqueSorted(changedFiles).map((filePath) => resolveChangedFile(filePath, ownership));
  const blockingFindings = resolvedFiles
    .filter((file) => file.status === "blocked")
    .map((file) => ({ path: file.path, evidenceCode: file.evidenceCode, reason: "production ownership is unmapped" }));
  const riskTokens = new Set(resolvedFiles.flatMap((file) => file.riskTokens));
  const impactedLayers = new Set(resolvedFiles.flatMap((file) => file.ownerLayers));
  const layerOrder = new Map((architecture.layers ?? []).map((layer, index) => [layer.id, index]));
  const options = { platform, allowHeavy, allowNetwork, allowNative, allowSecrets };

  const layerPlans = (architecture.layers ?? []).map((layer) => {
    const entries = (catalog.entries ?? [])
      .filter((entry) => entry.ownerLayer === layer.id)
      .sort((a, b) => a.id.localeCompare(b.id));
    const selectedTests = [];
    const skippedTests = [];

    for (const entry of entries) {
      const selection = entrySelection(entry, { mode, riskTokens, options });
      if (selection.status === "selected") {
        selectedTests.push({ id: entry.id, reasons: selection.reasons });
      } else if (selection.status === "skipped") {
        skippedTests.push({ id: entry.id, reasonCode: selection.reasonCode, reason: selection.reason, reasons: selection.reasons });
      }
    }

    return {
      layerId: layer.id,
      layerNumber: layer.number,
      impacted: impactedLayers.has(layer.id),
      changedFiles: resolvedFiles.filter((file) => file.ownerLayers.includes(layer.id)).map((file) => file.path),
      riskTokens: uniqueSorted(resolvedFiles.filter((file) => file.ownerLayers.includes(layer.id)).flatMap((file) => file.riskTokens)),
      selectedTests,
      skippedTests,
    };
  }).sort((a, b) => (layerOrder.get(a.layerId) ?? 999) - (layerOrder.get(b.layerId) ?? 999));

  return {
    schemaVersion: "1.0",
    status: blockingFindings.length > 0 ? "blocked" : "ready",
    mode,
    platform,
    changedFiles: resolvedFiles,
    riskTokens: uniqueSorted([...riskTokens]),
    impactedLayers: uniqueSorted([...impactedLayers]),
    blockingFindings,
    permissions: { heavy: allowHeavy, network: allowNetwork, native: allowNative, secrets: allowSecrets },
    layers: layerPlans,
  };
}

export function explainPlan(plan) {
  const lines = [
    `verification-plan: ${plan.status}`,
    `mode: ${plan.mode}`,
    `platform: ${plan.platform}`,
    `changed-files: ${plan.changedFiles.length}`,
  ];

  for (const file of plan.changedFiles) {
    if (file.status === "blocked") {
      lines.push(`BLOCKED ${file.path} -> ${file.evidenceCode}`);
    } else {
      lines.push(`FILE ${file.path} -> ${file.ownerLayers.join(",")} [${file.riskTokens.join(",")}]`);
    }
  }

  for (const layer of plan.layers) {
    const selected = layer.selectedTests.map((test) => test.id).join(",") || "none";
    const skipped = layer.skippedTests.map((test) => `${test.id}:${test.reasonCode}`).join(",") || "none";
    lines.push(`LAYER ${layer.layerNumber} ${layer.layerId} selected=${selected} skipped=${skipped}`);
  }
  return lines.join("\n");
}

export async function runLayer({ plan, catalog, layerId, runners = {}, context = {} }) {
  if (plan.status !== "ready") throw new VerificationPlanningError("Cannot execute a blocked verification plan", { blockingFindings: plan.blockingFindings });
  const layer = plan.layers.find((candidate) => candidate.layerId === layerId);
  if (!layer) throw new VerificationPlanningError(`Unknown layer in plan: ${layerId}`);
  const byId = new Map((catalog.entries ?? []).map((entry) => [entry.id, entry]));
  const results = [];

  for (const selected of layer.selectedTests) {
    const entry = byId.get(selected.id);
    if (!entry) throw new VerificationPlanningError(`Selected test is missing from catalog: ${selected.id}`);
    const runner = runners[entry.runner.kind];
    if (typeof runner !== "function") throw new VerificationPlanningError(`No typed runner registered for ${entry.runner.kind}`, { testId: entry.id });
    const started = Date.now();
    const outcome = await runner({ entry, selected, context });
    results.push({
      id: entry.id,
      result: outcome?.result === "fail" ? "fail" : "pass",
      durationMs: Number.isInteger(outcome?.durationMs) ? outcome.durationMs : Math.max(0, Date.now() - started),
      artifacts: Array.isArray(outcome?.artifacts) ? outcome.artifacts : [],
      security: {
        networkUsed: Boolean(outcome?.security?.networkUsed),
        nativeUsed: Boolean(outcome?.security?.nativeUsed),
        secretsAccessed: Boolean(outcome?.security?.secretsAccessed),
      },
    });
    if (results.at(-1).result === "fail") break;
  }

  return {
    layerId,
    result: results.some((result) => result.result === "fail") ? "fail" : results.length > 0 ? "pass" : layer.impacted ? "skipped" : "not-impacted-beyond-baseline",
    results,
  };
}

export function emitEvidence({ plan, catalog, architecture, layerId, commitSha, run, runtime, durationMs = 0 }) {
  const layer = plan.layers.find((candidate) => candidate.layerId === layerId);
  if (!layer) throw new VerificationPlanningError(`Unknown layer in plan: ${layerId}`);
  const byId = new Map((catalog.entries ?? []).map((entry) => [entry.id, entry]));
  const selectedIds = layer.selectedTests.map((test) => test.id);
  const selectedEntries = selectedIds.map((id) => byId.get(id)).filter(Boolean);
  const triggerReasons = [];
  for (const file of layer.changedFiles) triggerReasons.push({ kind: "changed-file", value: file });
  for (const token of layer.riskTokens) triggerReasons.push({ kind: "risk-token", value: token });
  if (layer.selectedTests.some((test) => test.reasons.some((reason) => reason.kind === "baseline"))) {
    triggerReasons.push({ kind: "baseline", value: "architecture baseline" });
  }
  if (["manual", "release", "scheduled"].includes(plan.mode)) triggerReasons.push({ kind: plan.mode, value: `${plan.mode} verification requested` });

  const runResults = run?.results ?? [];
  const evidence = {
    schemaVersion: "1.0",
    commitSha,
    layerId,
    architectureComponents: uniqueSorted(selectedEntries.flatMap((entry) => entry.architectureComponents).concat(layerId)),
    triggerReasons: triggerReasons.filter((reason, index, all) => all.findIndex((item) => item.kind === reason.kind && item.value === reason.value) === index),
    selectedTestIds: uniqueSorted(selectedIds),
    skippedTests: layer.skippedTests.map(({ id, reasonCode, reason }) => ({ id, reasonCode, reason })),
    runtime: {
      platform: runtime?.platform ?? plan.platform,
      runner: runtime?.runner ?? "verification-core",
      ...(runtime?.nodeVersion ? { nodeVersion: runtime.nodeVersion } : {}),
    },
    result: run?.result ?? (selectedIds.length > 0 ? "pass" : layer.impacted ? "skipped" : "not-impacted-beyond-baseline"),
    durationMs,
    artifacts: runResults.flatMap((result) => result.artifacts ?? []),
    security: {
      networkUsed: runResults.some((result) => result.security?.networkUsed),
      nativeUsed: runResults.some((result) => result.security?.nativeUsed),
      secretsAccessed: runResults.some((result) => result.security?.secretsAccessed),
    },
  };

  const errors = validateEvidenceRecord({ evidence, architecture });
  if (errors.length > 0) throw new VerificationConfigurationError(errors);
  return evidence;
}

export function compareCost(left, right) {
  return (COST_ORDER.get(left) ?? Number.MAX_SAFE_INTEGER) - (COST_ORDER.get(right) ?? Number.MAX_SAFE_INTEGER);
}
