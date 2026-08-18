#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  describeSkillTrust,
  validateSkillTrustCoverage,
} from "./agent-skill-trust.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registryPath = path.join(repoRoot, "config", "agent-skills.json");

function safeEntry(entry) {
  const resolved = path.resolve(repoRoot, String(entry || ""));
  const rootWithSeparator = `${repoRoot}${path.sep}`;
  if (resolved !== repoRoot && !resolved.startsWith(rootWithSeparator)) {
    throw new Error(`Skill entry escapes the PlotPickle repository: ${entry}`);
  }
  return resolved;
}

export function stripSkillFrontmatter(content) {
  const text = String(content || "");
  if (!/^---\r?\n/.test(text)) return text.trim();
  const frontmatter = text.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n/);
  if (!frontmatter) throw new Error("PlotPickle Agent Skill frontmatter is not closed.");
  return text.slice(frontmatter[0].length).trim();
}

export async function loadAgentSkillRegistry() {
  const registry = JSON.parse(await readFile(registryPath, "utf8"));
  if (registry?.schemaVersion !== 1 || !Array.isArray(registry.skills)) {
    throw new Error("PlotPickle agent skill registry is invalid.");
  }
  const ids = new Set();
  for (const skill of registry.skills) {
    if (!skill?.id || ids.has(skill.id)) throw new Error(`Duplicate or missing PlotPickle skill id: ${skill?.id || "(missing)"}`);
    ids.add(skill.id);
    if (!skill.entry || !skill.uri) throw new Error(`Skill ${skill.id} is missing entry or URI metadata.`);
    if (skill.uri !== `skill://plotpickle/${skill.id}`) throw new Error(`Skill ${skill.id} has a non-canonical PlotPickle URI.`);
    safeEntry(skill.entry);
  }
  await validateSkillTrustCoverage(registry);
  return registry;
}

export async function listAgentSkills() {
  const registry = await loadAgentSkillRegistry();
  return Promise.all(registry.skills.map(async (skill) => {
    const trust = await describeSkillTrust(skill.id);
    if (!trust.productionDiscoverable) {
      throw new Error(`Agent Skill ${skill.id} is not approved for production discovery.`);
    }
    return {
      ...skill,
      trustState: trust.trustState,
      sourceKind: trust.sourceKind,
      contentSha256: trust.contentSha256,
    };
  }));
}

export async function loadAgentSkill(id) {
  const registry = await loadAgentSkillRegistry();
  const skill = registry.skills.find((entry) => entry.id === id);
  if (!skill) throw new Error(`Unknown PlotPickle agent skill: ${id}`);
  const trust = await describeSkillTrust(skill.id);
  if (!trust.productionDiscoverable) {
    throw new Error(`Agent Skill ${skill.id} is quarantined or blocked and cannot be loaded by the production registry.`);
  }
  const filePath = safeEntry(skill.entry);
  const content = await readFile(filePath, "utf8");
  if (!content.includes(`name: ${skill.id}`)) throw new Error(`Skill ${skill.id} frontmatter does not match its registry id.`);
  return {
    ...skill,
    trustState: trust.trustState,
    sourceKind: trust.sourceKind,
    contentSha256: trust.contentSha256,
    filePath,
    content,
  };
}

export async function readAgentSkillProcedure(id) {
  return stripSkillFrontmatter((await loadAgentSkill(id)).content);
}

export async function skillIndexResource() {
  const skills = await listAgentSkills();
  const registry = await loadAgentSkillRegistry();
  return {
    uri: registry.indexUri,
    mimeType: "application/json",
    text: JSON.stringify({
      schemaVersion: registry.schemaVersion,
      discovery: registry.discovery,
      skills: skills.map(({ id, name, description, uri, roles, primaryWorker, mcpReady, trustState, sourceKind, contentSha256 }) => ({
        id,
        name,
        description,
        uri,
        roles,
        primaryWorker,
        mcpReady,
        trustState,
        sourceKind,
        contentSha256,
      })),
    }, null, 2),
  };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--list")) {
    for (const skill of await listAgentSkills()) {
      process.stdout.write(`${skill.id}\t${skill.uri}\t${skill.trustState}\t${skill.description}\n`);
    }
    return;
  }
  const readIndex = args.indexOf("--read");
  if (readIndex >= 0) {
    const id = args[readIndex + 1];
    if (!id) throw new Error("--read requires a skill id.");
    process.stdout.write((await loadAgentSkill(id)).content);
    return;
  }
  if (args.includes("--index-json")) {
    process.stdout.write(`${(await skillIndexResource()).text}\n`);
    return;
  }
  if (args.includes("--self-test")) {
    const skills = await listAgentSkills();
    for (const skill of skills) await loadAgentSkill(skill.id);
    if (!skills.some((skill) => skill.id === "uat-repair" && skill.primaryWorker === "pi")) {
      throw new Error("The Pi UAT repair skill is missing from the PlotPickle skill registry.");
    }
    if (skills.some((skill) => skill.trustState !== "trusted-built-in" && skill.trustState !== "approved-external")) {
      throw new Error("A non-approved Agent Skill entered the production registry.");
    }
    process.stdout.write(`PlotPickle agent skills self-test PASS: ${skills.length} skill(s).\n`);
    return;
  }
  process.stdout.write("Usage: node scripts/agent-skills.mjs --list | --read <id> | --index-json | --self-test\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
