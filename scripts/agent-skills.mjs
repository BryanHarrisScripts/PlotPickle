#!/usr/bin/env node

import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { materializeAgentSkillsForRun } from "../lib/agents/agent-skill-materialization.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const registryPath = path.join(repoRoot, "config", "agent-skills.json");
const profileRegistryPath = path.join(repoRoot, "config", "agent-profiles.json");

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
    if (skill.learning) {
      const learning = skill.learning;
      const actions = new Set(["explain", "diagnose", "exercise", "compare", "reader-response"]);
      const visibility = new Set(["learner", "internal"]);
      if (!Array.isArray(learning.domains) || !learning.domains.length || learning.domains.some((value) => typeof value !== "string" || !value.trim())) {
        throw new Error(`Skill ${skill.id} has invalid craft-learning domains.`);
      }
      if (!Array.isArray(learning.actions) || !learning.actions.length || learning.actions.some((value) => !actions.has(value))) {
        throw new Error(`Skill ${skill.id} has invalid craft-learning actions.`);
      }
      if (!visibility.has(learning.visibility)) throw new Error(`Skill ${skill.id} has invalid learner visibility.`);
      if (!Array.isArray(learning.lessonRefs) || learning.lessonRefs.some((value) => typeof value !== "string" || !value.trim())) {
        throw new Error(`Skill ${skill.id} has invalid lesson mappings.`);
      }
      if (!Array.isArray(learning.contextClasses) || learning.contextClasses.some((value) => typeof value !== "string" || !value.trim())) {
        throw new Error(`Skill ${skill.id} has invalid learner context classes.`);
      }
      if (!Array.isArray(learning.runtimeCompatibility) || !learning.runtimeCompatibility.length || learning.runtimeCompatibility.some((value) => typeof value !== "string" || !value.trim())) {
        throw new Error(`Skill ${skill.id} has invalid runtime compatibility.`);
      }
      if (!["covered", "partial", "planned"].includes(learning.evaluationCoverage) || !["built-in", "reviewed-external", "quarantined-external"].includes(learning.provenanceClass)) {
        throw new Error(`Skill ${skill.id} has invalid learning evaluation/provenance metadata.`);
      }
      const forbidden = new Set(["network-egress-by-skill", "credential-read", "provider-selection-by-skill", "ppf-direct-write"]);
      if (learning.contextClasses.some((value) => forbidden.has(value))) throw new Error(`Skill ${skill.id} learning metadata requests forbidden authority.`);
    }
  }
  return registry;
}

export async function listAgentSkills() {
  const registry = await loadAgentSkillRegistry();
  return registry.skills.map((skill) => ({ ...skill }));
}

export async function materializeAgentSkillRunManifest(consumer, requiredSkillIds = []) {
  const registry = await loadAgentSkillRegistry();
  return materializeAgentSkillsForRun(registry, {
    consumer,
    requiredSkillIds,
    entryExists: async (entry) => access(safeEntry(entry)).then(
      () => true,
      () => false,
    ),
  });
}

export async function loadAgentSkill(id) {
  const registry = await loadAgentSkillRegistry();
  const skill = registry.skills.find((entry) => entry.id === id);
  if (!skill) throw new Error(`Unknown PlotPickle agent skill: ${id}`);
  const filePath = safeEntry(skill.entry);
  const content = await readFile(filePath, "utf8");
  if (!content.includes(`name: ${skill.id}`)) throw new Error(`Skill ${skill.id} frontmatter does not match its registry id.`);
  return { ...skill, filePath, content };
}

export async function readAgentSkillProcedure(id) {
  return stripSkillFrontmatter((await loadAgentSkill(id)).content);
}

export async function skillIndexResource() {
  const registry = await loadAgentSkillRegistry();
  return {
    uri: registry.indexUri,
    mimeType: "application/json",
    text: JSON.stringify({
      schemaVersion: registry.schemaVersion,
      discovery: registry.discovery,
      skills: registry.skills.map(({ id, name, description, uri, roles, primaryWorker, mcpReady }) => ({
        id,
        name,
        description,
        uri,
        roles,
        primaryWorker,
        mcpReady,
      })),
    }, null, 2),
  };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--list")) {
    for (const skill of await listAgentSkills()) {
      process.stdout.write(`${skill.id}\t${skill.uri}\t${skill.description}\n`);
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
  const materializeIndex = args.indexOf("--materialize-for");
  if (materializeIndex >= 0) {
    const consumer = args[materializeIndex + 1];
    if (!consumer) throw new Error("--materialize-for requires a consumer id.");
    const requireIndex = args.indexOf("--require");
    const requiredSkillIds = requireIndex >= 0 && args[requireIndex + 1]
      ? args[requireIndex + 1].split(",").map((value) => value.trim()).filter(Boolean)
      : [];
    process.stdout.write(`${JSON.stringify(await materializeAgentSkillRunManifest(consumer, requiredSkillIds), null, 2)}\n`);
    return;
  }
  if (args.includes("--self-test")) {
    const skills = await listAgentSkills();
    for (const skill of skills) await loadAgentSkill(skill.id);
    await materializeAgentSkillRunManifest("pi", ["uat-repair"]);
    if (!skills.some((skill) => skill.id === "uat-repair" && skill.primaryWorker === "pi")) {
      throw new Error("The Pi UAT repair skill is missing from the PlotPickle skill registry.");
    }
    const profileRegistry = JSON.parse(await readFile(profileRegistryPath, "utf8"));
    const registeredUris = new Set(skills.map((skill) => skill.uri));
    for (const profile of profileRegistry?.profiles || []) {
      for (const uri of profile?.skillUris || []) {
        if (!registeredUris.has(uri)) {
          throw new Error(`Agent Profile ${profile.id || "(unknown)"} references unknown Agent Skill ${uri}.`);
        }
      }
    }
    process.stdout.write(`PlotPickle agent skills self-test PASS: ${skills.length} skill(s).\n`);
    return;
  }
  process.stdout.write("Usage: node scripts/agent-skills.mjs --list | --read <id> | --index-json | --materialize-for <consumer> [--require id,id] | --self-test\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}