import { readFile } from "node:fs/promises";
import path from "node:path";

export const DEFAULT_REGISTRY_PATH = "config/developer-diagnostics.json";

export function normalizeRepositoryPath(value) {
  return String(value || "")
    .replaceAll("\\", "/")
    .replace(/^\.\/+/, "")
    .replace(/\/+/g, "/");
}

export function globToRegExp(pattern) {
  const normalized = normalizeRepositoryPath(pattern);
  let source = "^";
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];
    if (char === "*" && next === "*") {
      const after = normalized[index + 2];
      if (after === "/") {
        source += "(?:.*/)?";
        index += 2;
      } else {
        source += ".*";
        index += 1;
      }
    } else if (char === "*") {
      source += "[^/]*";
    } else if (char === "?") {
      source += "[^/]";
    } else {
      source += char.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
    }
  }
  source += "$";
  return new RegExp(source);
}

export function matchesPattern(file, pattern) {
  return globToRegExp(pattern).test(normalizeRepositoryPath(file));
}

export function matchesAnyPattern(file, patterns = []) {
  return patterns.some((pattern) => matchesPattern(file, pattern));
}

export async function loadDiagnosticsRegistry(root = process.cwd(), registryPath = DEFAULT_REGISTRY_PATH) {
  const absolute = path.resolve(root, registryPath);
  const registry = JSON.parse(await readFile(absolute, "utf8"));
  const validation = validateDiagnosticsRegistry(registry);
  if (!validation.valid) {
    throw new Error(`Invalid developer diagnostics registry:\n- ${validation.errors.join("\n- ")}`);
  }
  return registry;
}

export function validateDiagnosticsRegistry(registry) {
  const errors = [];
  if (!registry || typeof registry !== "object") errors.push("Registry must be an object.");
  if (!Number.isInteger(registry?.version) || registry.version < 1) errors.push("Registry version must be a positive integer.");
  if (!Array.isArray(registry?.areas) || registry.areas.length === 0) errors.push("Registry must define at least one area.");
  if (!registry?.contracts || typeof registry.contracts !== "object") errors.push("Registry must define contracts.");
  if (!registry?.agentPolicy || typeof registry.agentPolicy !== "object") errors.push("Registry must define an agent policy.");

  const areaIds = new Set();
  for (const [index, area] of (registry?.areas || []).entries()) {
    const prefix = `areas[${index}]`;
    if (!area?.id || typeof area.id !== "string") errors.push(`${prefix}.id is required.`);
    if (areaIds.has(area?.id)) errors.push(`Duplicate area id: ${area.id}.`);
    areaIds.add(area?.id);
    if (!Array.isArray(area?.patterns) || area.patterns.length === 0) errors.push(`${prefix}.patterns must not be empty.`);
    if (!Array.isArray(area?.suites) || area.suites.length === 0) errors.push(`${prefix}.suites must not be empty.`);
    if (!Array.isArray(area?.allowedPaths) || area.allowedPaths.length === 0) errors.push(`${prefix}.allowedPaths must not be empty.`);
    for (const contract of area?.contracts || []) {
      if (!registry?.contracts?.[contract]) errors.push(`${prefix} references unknown contract ${contract}.`);
    }
  }

  for (const [id, contract] of Object.entries(registry?.contracts || {})) {
    if (!Array.isArray(contract?.owners) || contract.owners.length === 0) errors.push(`contracts.${id}.owners must not be empty.`);
    if (!Array.isArray(contract?.tests) || contract.tests.length === 0) errors.push(`contracts.${id}.tests must not be empty.`);
    for (const owner of contract?.owners || []) {
      if (!owner?.path || typeof owner.path !== "string") errors.push(`contracts.${id} has an owner without a path.`);
    }
  }

  const allowedStates = new Set(registry?.agentPolicy?.allowedStates || []);
  for (const required of ["observe", "classify", "propose", "verify", "stop"]) {
    if (!allowedStates.has(required)) errors.push(`agentPolicy.allowedStates must include ${required}.`);
  }

  return { valid: errors.length === 0, errors };
}

export function contractsForTest(testFile, registry) {
  const normalized = normalizeRepositoryPath(testFile);
  return Object.entries(registry.contracts || {})
    .filter(([, contract]) => (contract.tests || []).some((test) => normalizeRepositoryPath(test) === normalized))
    .map(([id, contract]) => ({
      id,
      owners: contract.owners.map((owner) => ({ ...owner, path: normalizeRepositoryPath(owner.path) })),
    }));
}

export function ownersForContract(contractId, registry) {
  const contract = registry.contracts?.[contractId];
  return (contract?.owners || []).map((owner) => ({ ...owner, path: normalizeRepositoryPath(owner.path) }));
}
