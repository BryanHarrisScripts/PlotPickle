import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROOT = path.resolve(HERE, "..");

export const UPDATES_START = "<!-- PLOTPICKLE:UPDATES:START -->";
export const UPDATES_END = "<!-- PLOTPICKLE:UPDATES:END -->";
export const ARCHITECTURE_START = "<!-- PLOTPICKLE:ARCHITECTURE:START -->";
export const DRIFT_STATUSES = Object.freeze(["CURRENT", "STALE", "MISSING", "CONFLICT", "REVIEW"]);

const PATHS = Object.freeze({
  source: "architecture/plotpickle.architecture.json",
  generator: "architecture/generate-architecture.mjs",
  architectureDocs: "architecture/README.md",
  fullBlueprint: "architecture/plotpickle-architecture.svg",
  overviewBlueprint: "architecture/plotpickle-architecture-overview.svg",
  agentContext: "docs/architecture/agent-context.md",
  drift: "docs/updates/documentation-drift.md",
  c4: "architecture/plotpickle-c4.md",
  history: "docs/updates/README.md",
  archive: "docs/updates/archive",
  readme: "README.md"
});

const absolute = (root, relative) => path.join(root, ...relative.split("/"));
const readIfExists = (file) => fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
const sha256 = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const escapeTable = (value) => String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
const slug = (value) => String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "node";

export function fingerprintArchitecture(architecture) {
  return sha256(JSON.stringify(architecture));
}

export function extractManagedBlock(readme, start = UPDATES_START, end = UPDATES_END) {
  const starts = readme.match(new RegExp(start.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? [];
  const ends = readme.match(new RegExp(end.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) ?? [];
  if (starts.length === 0 && ends.length === 0) return null;
  if (starts.length !== 1 || ends.length !== 1) throw new Error("UPDATES_MANAGED_BLOCK_CONFLICT");
  const startIndex = readme.indexOf(start);
  const endIndex = readme.indexOf(end);
  if (endIndex < startIndex) throw new Error("UPDATES_MANAGED_BLOCK_CONFLICT");
  return readme.slice(startIndex, endIndex + end.length);
}

export function replaceManagedUpdates(readme, section) {
  const existing = extractManagedBlock(readme);
  if (existing) return readme.replace(existing, section);
  const anchor = readme.indexOf(ARCHITECTURE_START);
  if (anchor < 0) throw new Error("UPDATES_INSERTION_ANCHOR_MISSING");
  return `${readme.slice(0, anchor)}${section}\n\n${readme.slice(anchor)}`;
}

function fingerprintsIn(content) {
  if (!content) return [];
  return [...content.matchAll(/sha256:[a-f0-9]{64}/g)].map((match) => match[0]);
}

export function classifyDocumentationEvidence({
  exists = true,
  content = "",
  expectedContent = null,
  expectedFingerprint = null,
  requiresFingerprint = false,
  semanticReviewRequired = false
} = {}) {
  if (!exists) return "MISSING";
  const declared = [...new Set(fingerprintsIn(content))];
  if (declared.length > 1) return "CONFLICT";
  if (requiresFingerprint && declared.length === 0) return "CONFLICT";
  if (expectedFingerprint && declared.length === 1 && declared[0] !== expectedFingerprint) return "STALE";
  if (expectedContent !== null && content !== expectedContent) return "STALE";
  if (semanticReviewRequired) return "REVIEW";
  return "CURRENT";
}

export function renderAgentContext(architecture, fingerprint) {
  const rows = architecture.layers.map((layer) => `| ${layer.number} | ${escapeTable(layer.label)} | ${escapeTable(layer.summary)} |`).join("\n");
  return `# PlotPickle Agent Context\n\nGenerated architecture context for repository-aware developer agents. This file is a compact projection, not an authority source.\n\nSource: \`${architecture.blueprint.source}\`  \nSource fingerprint: \`${fingerprint}\`  \nArchitecture version: \`${architecture.blueprint.version}\`  \nArchitecture status: \`${String(architecture.blueprint.status).toUpperCase()}\`\n\n## Authority order\n\n1. \`AGENTS.md\` remains the repository development constitution.\n2. Repository source and canonical contracts remain implementation truth.\n3. \`${architecture.blueprint.source}\` is the canonical Architecture Knowledge Map.\n4. This generated context is navigation aid only and grants no permission.\n\n## Architecture layers\n\n| Layer | Boundary | Responsibility |\n|---:|---|---|\n${rows}\n\n## Durable boundaries\n\n- Human authority remains explicit.\n- PPF Canon remains the sole durable story-canon authority.\n- Skins are replaceable presentation and do not own core behavior.\n- Provider/runtime choice is explicit; no silent paid-cloud fallback.\n- Community material remains non-canonical until it passes the governed candidate/evidence/Human-approval path.\n- PR Gate and Product Gate are verification clients outside the production dependency path.\n\n## Exact evidence pointers\n\n- Architecture Knowledge Map: \`architecture/plotpickle.architecture.json\`\n- Architecture generation owner: \`architecture/generate-architecture.mjs\`\n- Full blueprint: \`architecture/plotpickle-architecture.svg\`\n- README overview: \`architecture/plotpickle-architecture-overview.svg\`\n- Documentation drift evidence: \`docs/updates/documentation-drift.md\`\n- C4 projections: \`architecture/plotpickle-c4.md\`\n- Development constitution: \`AGENTS.md\`\n\nInspect canonical files before making a source change. This projection contains no project story data and no authority grant.\n`;
}

export function renderC4(architecture, fingerprint) {
  const layerNodes = architecture.layers.map((layer) => `  ${slug(layer.id)}["${layer.label.replaceAll('"', "'")}"]`).join("\n");
  const externalNodes = `  human["Human author"]\n  community["${architecture.community.title.replaceAll('"', "'")}"]\n  bridge["${architecture.bridge.title.replaceAll('"', "'")}"]`;
  const flowLines = architecture.flows.map((flow) => `  ${slug(flow.from)} -->|${flow.label.replaceAll("|", "/")}| ${slug(flow.to)}`).join("\n");
  const componentGroups = architecture.layers.map((layer) => {
    const components = layer.components.map((component, index) => `    ${slug(layer.id)}_${index + 1}["${component.title.replaceAll('"', "'")}"]`).join("\n");
    return `  subgraph ${slug(layer.id)}_components["${layer.label.replaceAll('"', "'")}"]\n${components}\n  end`;
  }).join("\n");
  return `# PlotPickle C4-style Architecture Views\n\nGenerated projection of \`${architecture.blueprint.source}\`. C4 is a view of the canonical map, not a separate model.\n\nSource fingerprint: \`${fingerprint}\`\n\n## System Context\n\n\`\`\`mermaid\nflowchart LR\n  human["Human author"] --> plotpickle["PlotPickle"]\n  plotpickle --> canon["PPF Canon"]\n  plotpickle <--> community["${architecture.community.title.replaceAll('"', "'")}"]\n  plotpickle --> providers["${architecture.layers.find((layer) => layer.id === "provider-runtime")?.label ?? "AI / PROVIDER RUNTIME"}"]\n  community -. candidate material .-> plotpickle\n\`\`\`\n\n## Container view\n\n\`\`\`mermaid\nflowchart TB\n${externalNodes}\n${layerNodes}\n${flowLines}\n\`\`\`\n\n## Component view\n\n\`\`\`mermaid\nflowchart TB\n${componentGroups}\n\`\`\`\n\nFor exact authority, component detail and migration state, inspect the canonical Architecture Knowledge Map and full architecture blueprint.\n`;
}

export function renderDocumentationDrift(architecture, fingerprint, evidence) {
  const rows = evidence.map((item) => `| ${escapeTable(item.surface)} | ${item.status} | ${escapeTable(item.evidence)} |`).join("\n");
  const blocking = evidence.filter((item) => ["STALE", "MISSING", "CONFLICT"].includes(item.status));
  const reviews = evidence.filter((item) => item.status === "REVIEW");
  const overall = blocking.length ? blocking[0].status : reviews.length ? "REVIEW" : "CURRENT";
  return `# PlotPickle Documentation Drift Detection\n\nDeterministic repository-native freshness evidence. Detection is separate from modification; this report never rewrites Human-authored documentation.\n\nSource: \`${architecture.blueprint.source}\`  \nSource fingerprint: \`${fingerprint}\`  \nOverall status: **${overall}**\n\n## Status model\n\n| Status | Meaning |\n|---|---|\n| CURRENT | Deterministic evidence matches the declared current source. |\n| STALE | A governed dependency or generated projection changed underneath the committed output. |\n| MISSING | A required/current owner or generated output is absent. |\n| CONFLICT | Deterministic evidence proves contradictory or malformed ownership/managed-block state. |\n| REVIEW | Deterministic evidence cannot establish semantic correctness; Human review remains appropriate. |\n\n## Current evidence\n\n| Surface | Status | Evidence |\n|---|---|---|\n${rows}\n\nBlocking drift is limited to STALE, MISSING and CONFLICT. REVIEW is advisory and must not become automatic document rewriting or merge authority.\n`;
}

export function renderCurrentUpdate(architecture, fingerprint, evidence) {
  const bySurface = Object.fromEntries(evidence.map((item) => [item.surface, item.status]));
  const blocking = evidence.filter((item) => ["STALE", "MISSING", "CONFLICT"].includes(item.status));
  const freshness = blocking.length ? blocking.map((item) => `${item.surface} ${item.status}`).join("; ") : "CURRENT generated surfaces; Human architecture prose remains REVIEW-owned";
  return `${UPDATES_START}\n## UPDATES\n\nCurrent living architecture: **v${architecture.blueprint.version} · ${String(architecture.blueprint.status).toUpperCase()} · source updated ${architecture.blueprint.updated}**  \nFingerprint: \`${fingerprint}\`\n\n- Architecture status: **${String(architecture.blueprint.status).toUpperCase()}** — ${architecture.layers.length} canonical layers from one machine-readable map.\n- Documentation freshness: **${freshness}**.\n- Agent Context: **${bySurface["Agent Context"] ?? "MISSING"}**.\n- C4 freshness: **${bySurface["C4 projections"] ?? "MISSING"}**.\n- Current map summary: ${architecture.migration}\n\nInspect the living evidence: [Architecture Knowledge Map](architecture/plotpickle.architecture.json) · [Architecture Documentation](architecture/README.md) · [Documentation Drift Detection](docs/updates/documentation-drift.md) · [Agent Context](docs/architecture/agent-context.md) · [C4 Diagrams](architecture/plotpickle-c4.md).\n\nPrevious current entries are preserved in [UPDATES history](docs/updates/README.md), not accumulated in this README.\n${UPDATES_END}`;
}

export function stableArchiveFilename(block) {
  const date = block.match(/source updated (\d{4}-\d{2}-\d{2})/)?.[1] ?? "undated";
  return `${date}-${sha256(block).slice(7, 19)}.md`;
}

export function archiveCurrentUpdate(root, block) {
  if (!block) return null;
  const directory = absolute(root, PATHS.archive);
  fs.mkdirSync(directory, { recursive: true });
  const filename = stableArchiveFilename(block);
  const target = path.join(directory, filename);
  const content = `# Archived PlotPickle UPDATES entry\n\nImmutable copy of the previous root README current-update block.\n\n${block}\n`;
  if (fs.existsSync(target)) {
    if (fs.readFileSync(target, "utf8") !== content) throw new Error(`ARCHIVE_IDENTITY_CONFLICT:${filename}`);
    return filename;
  }
  fs.writeFileSync(target, content, "utf8");
  return filename;
}

export function renderHistoryIndex(root) {
  const directory = absolute(root, PATHS.archive);
  const files = fs.existsSync(directory) ? fs.readdirSync(directory).filter((name) => /^\d{4}-\d{2}-\d{2}-[a-f0-9]{12}\.md$/.test(name)).sort().reverse() : [];
  const entries = files.length ? files.map((name) => `- [${name.replace(/\.md$/, "")}](archive/${name})`) : ["- No archived UPDATES entries yet."];
  return `# PlotPickle UPDATES history\n\nThe root README is the only current Human-facing UPDATES surface. This index points only to immutable prior current entries.\n\n${entries.join("\n")}\n`;
}

export function validateArchiveHistory(root) {
  const directory = absolute(root, PATHS.archive);
  if (!fs.existsSync(directory)) return [];
  const errors = [];
  for (const name of fs.readdirSync(directory).filter((item) => item.endsWith(".md"))) {
    const content = fs.readFileSync(path.join(directory, name), "utf8");
    const block = extractManagedBlock(content);
    if (!block) { errors.push(`${name}: missing managed UPDATES block`); continue; }
    const expected = stableArchiveFilename(block);
    if (name !== expected) errors.push(`${name}: deterministic archive identity should be ${expected}`);
  }
  return errors;
}

function architectureBundleStatus(root) {
  const required = [PATHS.generator, PATHS.fullBlueprint, PATHS.overviewBlueprint, PATHS.readme];
  if (required.some((relative) => !fs.existsSync(absolute(root, relative)))) return { status: "MISSING", evidence: "Existing architecture generator/full/overview/README owner is incomplete." };
  const readme = fs.readFileSync(absolute(root, PATHS.readme), "utf8");
  const starts = (readme.match(/PLOTPICKLE:ARCHITECTURE:START/g) ?? []).length;
  const ends = (readme.match(/PLOTPICKLE:ARCHITECTURE:END/g) ?? []).length;
  if (starts !== 1 || ends !== 1) return { status: "CONFLICT", evidence: "README ARCHITECTURE managed markers are malformed." };
  const run = spawnSync(process.execPath, [PATHS.generator, "--check"], { cwd: root, encoding: "utf8" });
  return run.status === 0
    ? { status: "CURRENT", evidence: "Existing architecture generator check is synchronized." }
    : { status: "STALE", evidence: (run.stderr || run.stdout || "Existing architecture generator check failed.").trim().split("\n")[0] };
}

function generatedStatus(root, relative, expected, fingerprint) {
  const content = readIfExists(absolute(root, relative));
  const status = classifyDocumentationEvidence({ exists: content !== null, content: content ?? "", expectedContent: expected, expectedFingerprint: fingerprint, requiresFingerprint: true });
  return { status, evidence: status === "CURRENT" ? `Generated from ${PATHS.source} at ${fingerprint}.` : `${relative} does not match the current canonical projection.` };
}

function evidenceFor(root, architecture, fingerprint, expectedAgentContext, expectedC4) {
  const bundle = architectureBundleStatus(root);
  const agent = generatedStatus(root, PATHS.agentContext, expectedAgentContext, fingerprint);
  const c4 = generatedStatus(root, PATHS.c4, expectedC4, fingerprint);
  return [
    { surface: "Architecture Knowledge Map", status: "CURRENT", evidence: `${PATHS.source} is the canonical machine-readable owner (${fingerprint}).` },
    { surface: "Architecture Documentation", status: fs.existsSync(absolute(root, PATHS.architectureDocs)) ? "REVIEW" : "MISSING", evidence: "architecture/README.md is Human-authored guidance; deterministic generation does not rewrite its semantics." },
    { surface: "Generated architecture bundle", status: bundle.status, evidence: bundle.evidence },
    { surface: "Agent Context", status: agent.status, evidence: agent.evidence },
    { surface: "C4 projections", status: c4.status, evidence: c4.evidence }
  ];
}

function ensureParent(file) { fs.mkdirSync(path.dirname(file), { recursive: true }); }
function writeText(root, relative, content) { const file = absolute(root, relative); ensureParent(file); fs.writeFileSync(file, content, "utf8"); }

export function refreshLivingArchitecture(root = DEFAULT_ROOT) {
  const sourceText = fs.readFileSync(absolute(root, PATHS.source), "utf8");
  const architecture = JSON.parse(sourceText);
  const fingerprint = fingerprintArchitecture(architecture);
  const generation = spawnSync(process.execPath, [PATHS.generator], { cwd: root, encoding: "utf8" });
  if (generation.status !== 0) throw new Error(`ARCHITECTURE_GENERATION_FAILED:${(generation.stderr || generation.stdout).trim()}`);

  const expectedAgentContext = renderAgentContext(architecture, fingerprint);
  const expectedC4 = renderC4(architecture, fingerprint);
  writeText(root, PATHS.agentContext, expectedAgentContext);
  writeText(root, PATHS.c4, expectedC4);

  const evidence = evidenceFor(root, architecture, fingerprint, expectedAgentContext, expectedC4);
  const drift = renderDocumentationDrift(architecture, fingerprint, evidence);
  writeText(root, PATHS.drift, drift);

  const readmePath = absolute(root, PATHS.readme);
  const readme = fs.readFileSync(readmePath, "utf8");
  const current = extractManagedBlock(readme);
  const next = renderCurrentUpdate(architecture, fingerprint, evidence);
  if (current && current !== next) archiveCurrentUpdate(root, current);
  fs.writeFileSync(readmePath, replaceManagedUpdates(readme, next), "utf8");
  writeText(root, PATHS.history, renderHistoryIndex(root));

  return { fingerprint, evidence, update: next };
}

export function checkLivingArchitecture(root = DEFAULT_ROOT) {
  const architecture = JSON.parse(fs.readFileSync(absolute(root, PATHS.source), "utf8"));
  const fingerprint = fingerprintArchitecture(architecture);
  const expectedAgentContext = renderAgentContext(architecture, fingerprint);
  const expectedC4 = renderC4(architecture, fingerprint);
  const evidence = evidenceFor(root, architecture, fingerprint, expectedAgentContext, expectedC4);
  const expectedDrift = renderDocumentationDrift(architecture, fingerprint, evidence);
  const expectedUpdate = renderCurrentUpdate(architecture, fingerprint, evidence);
  const expectedHistory = renderHistoryIndex(root);
  const errors = [];

  const compare = (relative, expected) => {
    const actual = readIfExists(absolute(root, relative));
    if (actual === null) errors.push(`${relative} is missing`);
    else if (actual !== expected) errors.push(`${relative} is stale`);
  };
  compare(PATHS.agentContext, expectedAgentContext);
  compare(PATHS.c4, expectedC4);
  compare(PATHS.drift, expectedDrift);
  compare(PATHS.history, expectedHistory);

  const readme = fs.readFileSync(absolute(root, PATHS.readme), "utf8");
  let current = null;
  try { current = extractManagedBlock(readme); } catch (error) { errors.push(error.message); }
  if (!current) errors.push("README.md UPDATES managed block is missing");
  else if (current !== expectedUpdate) errors.push("README.md UPDATES managed block is stale");

  errors.push(...validateArchiveHistory(root));
  for (const item of evidence) if (["STALE", "MISSING", "CONFLICT"].includes(item.status)) errors.push(`${item.surface}: ${item.status}`);
  return { ok: errors.length === 0, errors, fingerprint, evidence };
}

function parseRoot(argv) {
  const index = argv.indexOf("--root");
  return index >= 0 && argv[index + 1] ? path.resolve(argv[index + 1]) : DEFAULT_ROOT;
}

async function main() {
  const argv = process.argv.slice(2);
  const root = parseRoot(argv);
  if (argv.includes("--check")) {
    const result = checkLivingArchitecture(root);
    if (!result.ok) { console.error(result.errors.join("\n")); process.exitCode = 1; }
    else console.log(`Living architecture is synchronized at ${result.fingerprint}.`);
    return;
  }
  if (argv.includes("--refresh-update")) {
    const result = refreshLivingArchitecture(root);
    console.log(`Refreshed README UPDATES and living architecture views at ${result.fingerprint}.`);
    return;
  }
  console.error("Use --refresh-update to write living architecture outputs or --check to validate them.");
  process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await main();
