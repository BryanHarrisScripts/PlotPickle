#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

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
    safeEntry(skill.entry);
  }
  return registry;
}

export async function listAgentSkills() {
  const registry = await loadAgentSkillRegistry();
  return registry.skills.map((skill) => ({ ...skill }));
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
  if (args.includes("--self-test")) {
    const skills = await listAgentSkills();
    for (const skill of skills) await loadAgentSkill(skill.id);
    if (!skills.some((skill) => skill.id === "uat-repair" && skill.primaryWorker === "pi")) {
      throw new Error("The Pi UAT repair skill is missing from the PlotPickle skill registry.");
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
