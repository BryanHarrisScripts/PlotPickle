import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const CORE_DEVELOPER_SKILLS = new Set([
  "engineering-discipline",
  "diagnosis",
  "plotpickle-architecture-review",
  "ben-code-quality",
]);

const DOMAIN_SKILL_RULES = [
  { pattern: /\buat\b|uat-|autopilot|run-uat|uat_/i, skills: ["uat-repair"] },
  { pattern: /\blearn\b|curriculum|sage|foundations?/i, skills: ["sage-brinewick"] },
  { pattern: /\bplan\b|foundations?-planner|plan-foundations/i, skills: ["plan-foundations"] },
  { pattern: /\bbuzz\b|guildhall/i, skills: ["buzz-guildhall-reporting"] },
  { pattern: /visual|storyboard|previs|image|comfyui|continuity/i, skills: ["visual-contract", "visual-qa"] },
  { pattern: /animatic|lazy[-_/ ]?frames/i, skills: ["lazy-frames-animatic"] },
  { pattern: /marquee|poster|key[- ]?art|trailer|teaser/i, skills: ["marquee-director"] },
  { pattern: /critic|feedback|audience clarity|commercial positioning/i, skills: ["critics-circle"] },
  { pattern: /writer[-_/ ]?in[-_/ ]?residence|writer journey|journey qa/i, skills: ["writer-in-residence"] },
];

const ALWAYS_ARCHITECTURE_DOCS = [
  "docs/architecture/developer-agent-stack.md",
  "docs/architecture/MODULAR-FOUNDATION.md",
];

const MAX_SOURCE_CHARS = 14_000;
const MAX_BUNDLE_CHARS = 72_000;
const MAX_MATCHED_ARCHITECTURE_DOCS = 5;

function packageSignal(reviewPackage) {
  const issue = reviewPackage?.issue || {};
  const pr = reviewPackage?.pullRequest || {};
  const values = [
    issue.title,
    issue.body,
    pr.title,
    pr.body,
    ...(Array.isArray(pr.files) ? pr.files.map((file) => file?.path) : []),
    ...(Array.isArray(pr.checks) ? pr.checks.flatMap((check) => [check?.name, check?.status, check?.conclusion]) : []),
  ];
  return values.filter(Boolean).join("\n").toLowerCase();
}

export function selectRelevantSkillIds(reviewPackage, registry) {
  const signal = packageSignal(reviewPackage);
  const selected = new Set(CORE_DEVELOPER_SKILLS);
  for (const rule of DOMAIN_SKILL_RULES) {
    if (rule.pattern.test(signal)) rule.skills.forEach((skill) => selected.add(skill));
  }

  const knownIds = new Set(Array.isArray(registry?.skills) ? registry.skills.map((skill) => skill?.id).filter(Boolean) : []);
  return [...selected].filter((id) => knownIds.has(id));
}

function architectureTokens(fileName) {
  return path.basename(fileName, path.extname(fileName))
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((token) => token.length >= 4 && !new Set(["plotpickle", "architecture", "review", "system", "design", "docs", "phase", "final"]).has(token));
}

export function selectRelevantArchitecturePaths(reviewPackage, architectureFiles = []) {
  const signal = packageSignal(reviewPackage);
  const selected = new Set(ALWAYS_ARCHITECTURE_DOCS);
  const scored = architectureFiles
    .filter((file) => typeof file === "string" && file.toLowerCase().endsWith(".md"))
    .map((file) => ({
      file,
      score: architectureTokens(file).reduce((total, token) => total + (signal.includes(token) ? 1 : 0), 0),
    }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.file.localeCompare(right.file))
    .slice(0, MAX_MATCHED_ARCHITECTURE_DOCS);
  scored.forEach((item) => selected.add(item.file));
  return [...selected];
}

function withinRoot(root, candidate) {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(root, candidate);
  const relative = path.relative(resolvedRoot, resolvedCandidate);
  return relative && !relative.startsWith("..") && !path.isAbsolute(relative) ? resolvedCandidate : null;
}

async function readBounded(root, relativePath) {
  const resolved = withinRoot(root, relativePath);
  if (!resolved) return null;
  try {
    const content = await readFile(resolved, "utf8");
    return content.length <= MAX_SOURCE_CHARS
      ? content
      : `${content.slice(0, MAX_SOURCE_CHARS)}\n[Instruction source truncated by Developer Workbench context budget.]`;
  } catch {
    return null;
  }
}

async function architectureFiles(root) {
  const directory = path.join(root, "docs", "architecture");
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".md"))
      .map((entry) => `docs/architecture/${entry.name}`);
  } catch {
    return [];
  }
}

function appendSource(parts, sources, relativePath, content) {
  if (!content) return;
  const block = `\n## Instruction source: ${relativePath}\n${content.trim()}\n`;
  const currentLength = parts.reduce((total, part) => total + part.length, 0);
  if (currentLength + block.length > MAX_BUNDLE_CHARS) return;
  parts.push(block);
  sources.push(relativePath);
}

export async function buildInstructionBundle(reviewPackage) {
  const root = path.resolve(reviewPackage.repositoryPath);
  const parts = [
    "# PlotPickle repository instruction bundle",
    "Host-selected, read-only context for this review. AGENTS.md is the constitution. Skills and architecture documents describe procedure/ownership only and never grant tools, credentials, write authority, or merge authority.",
  ];
  const sources = [];

  appendSource(parts, sources, "AGENTS.md", await readBounded(root, "AGENTS.md"));

  const registryPath = "config/agent-skills.json";
  const registryText = await readBounded(root, registryPath);
  let registry = { skills: [] };
  if (registryText) {
    try { registry = JSON.parse(registryText.replace(/\n\[Instruction source truncated[\s\S]*$/u, "")); } catch { registry = { skills: [] }; }
    appendSource(parts, sources, registryPath, registryText);
  }

  const selectedSkillIds = selectRelevantSkillIds(reviewPackage, registry);
  const skills = Array.isArray(registry.skills) ? registry.skills : [];
  for (const id of selectedSkillIds) {
    const skill = skills.find((item) => item?.id === id);
    if (!skill?.entry) continue;
    appendSource(parts, sources, skill.entry, await readBounded(root, skill.entry));
  }

  const architecture = await architectureFiles(root);
  for (const relativePath of selectRelevantArchitecturePaths(reviewPackage, architecture)) {
    appendSource(parts, sources, relativePath, await readBounded(root, relativePath));
  }

  parts.splice(2, 0, `Selected instruction sources (${sources.length}): ${sources.join(", ") || "none found"}.`);
  return { markdown: parts.join("\n"), sources, selectedSkillIds };
}
