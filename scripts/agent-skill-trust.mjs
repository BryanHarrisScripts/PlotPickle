#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const trustRegistryPath = path.join(repoRoot, "config", "agent-skill-trust.json");

function safeRepositoryPath(entry) {
  const resolved = path.resolve(repoRoot, String(entry || ""));
  const rootWithSeparator = `${repoRoot}${path.sep}`;
  if (resolved !== repoRoot && !resolved.startsWith(rootWithSeparator)) {
    throw new Error(`Skill trust entry escapes the PlotPickle repository: ${entry}`);
  }
  return resolved;
}

async function exists(candidate) {
  try {
    await stat(candidate);
    return true;
  } catch {
    return false;
  }
}

export function hashSkillContent(content) {
  return createHash("sha256").update(String(content || ""), "utf8").digest("hex");
}

export function isProductionTrustState(state, registry) {
  return Array.isArray(registry?.productionTrustStates) && registry.productionTrustStates.includes(state);
}

export async function loadAgentSkillTrustRegistry() {
  const registry = JSON.parse(await readFile(trustRegistryPath, "utf8"));
  if (registry?.schemaVersion !== 1 || !Array.isArray(registry.records)) {
    throw new Error("PlotPickle Agent Skill trust registry is invalid.");
  }
  if (!Array.isArray(registry.productionTrustStates) || !registry.productionTrustStates.length) {
    throw new Error("PlotPickle Agent Skill trust registry has no production trust states.");
  }

  const ids = new Set();
  for (const record of registry.records) {
    if (!record?.id || ids.has(record.id)) throw new Error(`Duplicate or missing Skill Trust Record id: ${record?.id || "(missing)"}`);
    ids.add(record.id);
    if (!record.entry || !record.sourceKind || !record.trustState || !record.reviewStatus) {
      throw new Error(`Skill Trust Record ${record.id} is missing required provenance/trust metadata.`);
    }
    if (!Array.isArray(record.requestedCapabilities) || !Array.isArray(record.forbiddenCapabilities)) {
      throw new Error(`Skill Trust Record ${record.id} must declare requested and forbidden capability lists.`);
    }
    if (record.trustState === "approved-external") {
      if (!record.sourceRevision || !/^[a-f0-9]{64}$/.test(String(record.approvedContentSha256 || ""))) {
        throw new Error(`Approved external Skill ${record.id} must pin a source revision and approved SHA-256.`);
      }
    }
    safeRepositoryPath(record.entry);
  }
  return registry;
}

export async function describeSkillTrust(id) {
  const registry = await loadAgentSkillTrustRegistry();
  const record = registry.records.find((candidate) => candidate.id === id);
  if (!record) throw new Error(`Unknown PlotPickle Skill Trust Record: ${id}`);

  const filePath = safeRepositoryPath(record.entry);
  const content = await readFile(filePath, "utf8");
  const contentSha256 = hashSkillContent(content);
  const packageRoot = path.dirname(filePath);
  const packageInspection = {
    hasScripts: await exists(path.join(packageRoot, "scripts")),
    hasReferences: await exists(path.join(packageRoot, "references")),
    hasAssets: await exists(path.join(packageRoot, "assets")),
  };
  const approvalHashMatches = record.trustState !== "approved-external"
    || record.approvedContentSha256 === contentSha256;

  return {
    ...record,
    productionDiscoverable: isProductionTrustState(record.trustState, registry) && approvalHashMatches,
    contentSha256,
    approvalHashMatches,
    packageInspection,
  };
}

export async function validateSkillTrustCoverage(skillRegistry) {
  const trustRegistry = await loadAgentSkillTrustRegistry();
  const trustById = new Map(trustRegistry.records.map((record) => [record.id, record]));
  for (const skill of skillRegistry?.skills || []) {
    const record = trustById.get(skill.id);
    if (!record) throw new Error(`Production Agent Skill ${skill.id} is missing a Skill Trust Record.`);
    if (record.entry !== skill.entry) throw new Error(`Skill Trust Record ${skill.id} does not match the production registry entry.`);
    if (!isProductionTrustState(record.trustState, trustRegistry)) {
      throw new Error(`Production Agent Skill ${skill.id} is not approved for production discovery (${record.trustState}).`);
    }
    const inspection = await describeSkillTrust(skill.id);
    if (!inspection.productionDiscoverable) {
      throw new Error(`Production Agent Skill ${skill.id} failed its trust/hash approval gate.`);
    }
  }
  return trustRegistry;
}

export async function listSkillTrustRecords() {
  const registry = await loadAgentSkillTrustRegistry();
  return Promise.all(registry.records.map((record) => describeSkillTrust(record.id)));
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--list")) {
    for (const record of await listSkillTrustRecords()) {
      process.stdout.write(`${record.id}\t${record.trustState}\t${record.contentSha256}\t${record.sourceKind}\n`);
    }
    return;
  }

  const inspectIndex = args.indexOf("--inspect");
  if (inspectIndex >= 0) {
    const id = args[inspectIndex + 1];
    if (!id) throw new Error("--inspect requires a Skill Trust Record id.");
    process.stdout.write(`${JSON.stringify(await describeSkillTrust(id), null, 2)}\n`);
    return;
  }

  if (args.includes("--self-test")) {
    const records = await listSkillTrustRecords();
    const quarantined = records.filter((record) => record.trustState === "quarantined");
    if (!quarantined.length) throw new Error("Agent Skill trust self-test requires at least one quarantined fixture.");
    if (quarantined.some((record) => record.productionDiscoverable)) {
      throw new Error("A quarantined Agent Skill was incorrectly production-discoverable.");
    }
    process.stdout.write(`PlotPickle Agent Skill trust self-test PASS: ${records.length} record(s), ${quarantined.length} quarantined.\n`);
    return;
  }

  process.stdout.write("Usage: node scripts/agent-skill-trust.mjs --list | --inspect <id> | --self-test\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
