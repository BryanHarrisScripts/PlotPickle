import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const SKILLS_ROOT = path.join(ROOT_DIR, ".agents", "skills");
const REGISTRY_PATH = path.join(ROOT_DIR, "config", "agent-skills.json");
const TRUST_PATH = path.join(ROOT_DIR, "config", "agent-skill-trust.json");
const QUARANTINE_FIXTURE = path.join(ROOT_DIR, "tests", "fixtures", "agent-skills", "quarantined-external");

const TRUST_STATES = new Set(["trusted-built-in", "approved-external", "quarantined", "blocked"]);
const SOURCE_KINDS = new Set(["plotpickle-built-in", "external-github", "buzz-community", "local-user"]);
const REVIEW_STATES = new Set(["approved", "pending", "rejected"]);
const PRODUCTION_TRUST = new Set(["trusted-built-in", "approved-external"]);
const MAX_FILES = 256;
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_BYTES = 8 * 1024 * 1024;
const SAFE_RELATIVE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[a-zA-Z0-9._/-]+$/;
const STATIC_RISK_RULES = [
  { id: "credential-access", severity: "critical", pattern: /api[_ -]?key|credential|private[_ -]?key|password|authorization|bearer|nsec/i },
  { id: "network-egress", severity: "high", pattern: /https?:\/\/|curl\b|wget\b|fetch\s*\(|requests\.|invoke-webrequest/i },
  { id: "direct-canon-mutation", severity: "critical", pattern: /ppf.{0,30}(?:direct|write|mutat|overwrite)|write.{0,30}ppf|canon.{0,30}(?:without|bypass).{0,30}(?:writer|approval)/i },
  { id: "developer-authority", severity: "high", pattern: /github.{0,30}(?:write|push|merge)|git\s+(?:push|commit)|developer[-_ ]shell|execSync|spawnSync|child_process/i },
  { id: "script-execution-request", severity: "high", pattern: /run (?:the )?(?:bundled )?(?:shell|python|powershell|script)|chmod \+x|\.\/scripts\//i },
];

function cleanText(value, maximum = 500) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function strings(value, maximum = 128, itemMaximum = 240) {
  return Array.isArray(value)
    ? [...new Set(value.filter((item) => typeof item === "string").map((item) => cleanText(item, itemMaximum)).filter(Boolean))].slice(0, maximum)
    : [];
}

function parseFrontmatter(source) {
  if (!source.startsWith("---\n")) return { frontmatter: {}, body: source };
  const end = source.indexOf("\n---\n", 4);
  if (end === -1) return { frontmatter: {}, body: source };
  const block = source.slice(4, end);
  const frontmatter = {};
  for (const line of block.split("\n")) {
    const match = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (match) frontmatter[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
  }
  return { frontmatter, body: source.slice(end + 5).trim() };
}

async function json(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

export async function loadAgentSkillTrustPolicy() {
  return json(TRUST_PATH);
}

export async function loadAgentSkillRegistry() {
  return json(REGISTRY_PATH);
}

async function walkSkillFiles(root) {
  const files = [];
  let totalBytes = 0;

  async function visit(directory, prefix = "") {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (!SAFE_RELATIVE_PATH.test(relative)) throw new Error(`Unsafe Agent Skill path: ${relative}`);
      const absolute = path.join(directory, entry.name);
      const info = await lstat(absolute);
      if (info.isSymbolicLink()) throw new Error(`Agent Skill packages cannot contain symbolic links: ${relative}`);
      if (info.isDirectory()) {
        await visit(absolute, relative);
        continue;
      }
      if (!info.isFile()) continue;
      if (info.size > MAX_FILE_BYTES) throw new Error(`Agent Skill file exceeds ${MAX_FILE_BYTES} bytes: ${relative}`);
      totalBytes += info.size;
      if (totalBytes > MAX_TOTAL_BYTES) throw new Error(`Agent Skill package exceeds ${MAX_TOTAL_BYTES} bytes.`);
      files.push({ relative, absolute, bytes: info.size });
      if (files.length > MAX_FILES) throw new Error(`Agent Skill package exceeds ${MAX_FILES} files.`);
    }
  }

  await visit(root);
  return files;
}

export async function hashAgentSkillDirectory(root) {
  const files = await walkSkillFiles(root);
  const hash = createHash("sha256");
  const fileHashes = [];
  for (const file of files) {
    const content = await readFile(file.absolute);
    const contentHash = createHash("sha256").update(content).digest("hex");
    fileHashes.push({ path: file.relative, bytes: file.bytes, sha256: contentHash });
    hash.update(file.relative, "utf8");
    hash.update("\0");
    hash.update(String(file.bytes), "utf8");
    hash.update("\0");
    hash.update(contentHash, "utf8");
    hash.update("\n");
  }
  return {
    algorithm: "sha256-tree-v1",
    contentSha256: hash.digest("hex"),
    files: fileHashes,
    fileCount: fileHashes.length,
    totalBytes: fileHashes.reduce((total, file) => total + file.bytes, 0),
  };
}

async function staticRiskInspection(root, files) {
  const findings = [];
  for (const file of files) {
    if (file.bytes > 512 * 1024) continue;
    let source;
    try { source = await readFile(path.join(root, file.path), "utf8"); } catch { continue; }
    for (const rule of STATIC_RISK_RULES) {
      if (rule.pattern.test(source)) findings.push({ ruleId: rule.id, severity: rule.severity, path: file.path });
    }
  }
  return [...new Map(findings.map((finding) => [`${finding.ruleId}:${finding.path}`, finding])).values()];
}

function requestedCapabilitiesFromText(source) {
  const requested = [];
  if (/curriculum|lesson|learn/i.test(source)) requested.push("curriculum-read");
  if (/project context|story context|project fields|foundations/i.test(source)) requested.push("bounded-project-context");
  if (/proposal|draft candidate|suggest/i.test(source)) requested.push("proposal-draft");
  if (/browser|rendered|screenshot|visual/i.test(source)) requested.push("rendered-ui-observation");
  if (/repair|fix|patch/i.test(source)) requested.push("developer-repair-procedure");
  if (/buzz|guildhall/i.test(source)) requested.push("buzz-event-reporting");
  return [...new Set(requested)];
}

export async function inspectAgentSkillPackage(input) {
  const root = path.resolve(input.root);
  const hash = await hashAgentSkillDirectory(root);
  const skillFile = hash.files.find((file) => file.path === "SKILL.md");
  if (!skillFile) throw new Error(`Agent Skill package is missing SKILL.md: ${root}`);
  const source = await readFile(path.join(root, "SKILL.md"), "utf8");
  const parsed = parseFrontmatter(source);
  const name = cleanText(parsed.frontmatter.name, 160);
  const description = cleanText(parsed.frontmatter.description, 500);
  if (!name || !description) throw new Error(`Agent Skill SKILL.md requires name and description frontmatter: ${root}`);
  const scripts = hash.files.filter((file) => file.path.startsWith("scripts/"));
  const references = hash.files.filter((file) => file.path.startsWith("references/") || file.path.startsWith("reference/"));
  const assets = hash.files.filter((file) => file.path.startsWith("assets/") || file.path.startsWith("asset/"));
  const riskFindings = await staticRiskInspection(root, hash.files);
  return {
    root,
    name,
    description,
    body: parsed.body,
    contentSha256: hash.contentSha256,
    hashAlgorithm: hash.algorithm,
    fileCount: hash.fileCount,
    totalBytes: hash.totalBytes,
    files: hash.files,
    executableScriptsPresent: scripts.length > 0,
    scriptPaths: scripts.map((file) => file.path),
    referencesPresent: references.length > 0,
    referencePaths: references.map((file) => file.path),
    assetsPresent: assets.length > 0,
    assetPaths: assets.map((file) => file.path),
    staticRiskFindings: riskFindings,
    inferredRequestedCapabilityClasses: requestedCapabilitiesFromText(source),
    executedScripts: false,
  };
}

function safeTrustRecord(record) {
  return {
    skillId: cleanText(record.skillId, 180),
    uri: cleanText(record.uri, 240),
    displayName: cleanText(record.displayName, 180),
    description: cleanText(record.description, 500),
    sourceKind: cleanText(record.sourceKind, 80),
    source: cleanText(record.source, 500),
    pinnedRevision: cleanText(record.pinnedRevision, 240),
    contentSha256: cleanText(record.contentSha256, 64),
    hashAlgorithm: cleanText(record.hashAlgorithm, 80),
    license: cleanText(record.license, 120),
    author: cleanText(record.author, 180),
    publisher: cleanText(record.publisher, 180),
    trustState: cleanText(record.trustState, 80),
    reviewStatus: cleanText(record.reviewStatus, 80),
    reviewedAt: cleanText(record.reviewedAt, 80),
    executableScriptsPresent: record.executableScriptsPresent === true,
    referencesPresent: record.referencesPresent === true,
    assetsPresent: record.assetsPresent === true,
    requestedCapabilityClasses: strings(record.requestedCapabilityClasses),
    forbiddenCapabilityClasses: strings(record.forbiddenCapabilityClasses),
    evalStatus: cleanText(record.evalStatus, 80),
    lastEvaluatedRevision: cleanText(record.lastEvaluatedRevision, 240),
    supersedes: cleanText(record.supersedes, 240),
    replacedBy: cleanText(record.replacedBy, 240),
    staticRiskFindings: Array.isArray(record.staticRiskFindings) ? record.staticRiskFindings.slice(0, 128) : [],
    contentHashMatchesApproval: record.contentHashMatchesApproval !== false,
    productionDiscoverable: record.productionDiscoverable === true,
    executionAllowed: record.executionAllowed === true,
    capabilitiesGranted: false,
  };
}

function validateTrustRecord(record) {
  const errors = [];
  if (!record.skillId) errors.push("stable skillId is required");
  if (!record.uri) errors.push("canonical Skill URI is required");
  if (!record.displayName || !record.description) errors.push("display name and description are required");
  if (!SOURCE_KINDS.has(record.sourceKind)) errors.push(`unsupported source kind ${record.sourceKind}`);
  if (!record.source) errors.push("source provenance is required");
  if (!record.pinnedRevision) errors.push("pinned source revision is required");
  if (!/^[a-f0-9]{64}$/.test(record.contentSha256)) errors.push("content SHA-256 is invalid");
  if (record.hashAlgorithm !== "sha256-tree-v1") errors.push("hash algorithm must be sha256-tree-v1");
  if (!record.license) errors.push("license/status is required");
  if (!record.author && !record.publisher) errors.push("author or publisher is required");
  if (!TRUST_STATES.has(record.trustState)) errors.push(`unsupported trust state ${record.trustState}`);
  if (!REVIEW_STATES.has(record.reviewStatus)) errors.push(`unsupported review status ${record.reviewStatus}`);
  if (!record.reviewedAt && record.reviewStatus === "approved") errors.push("reviewedAt is required for approved Skills");
  if (!Array.isArray(record.requestedCapabilityClasses) || !Array.isArray(record.forbiddenCapabilityClasses)) errors.push("capability class lists are required");
  if (!record.evalStatus || !record.lastEvaluatedRevision) errors.push("eval status and last evaluated revision are required");
  if (record.productionDiscoverable && !PRODUCTION_TRUST.has(record.trustState)) errors.push("quarantined/blocked Skills cannot be production discoverable");
  if (record.executionAllowed && !PRODUCTION_TRUST.has(record.trustState)) errors.push("quarantined/blocked Skills cannot be execution allowed");
  if (record.capabilitiesGranted !== false) errors.push("Skill trust record must never grant capabilities");
  return errors;
}

export async function builtInAgentSkillTrustRecords() {
  const [registry, policy] = await Promise.all([loadAgentSkillRegistry(), loadAgentSkillTrustPolicy()]);
  if (policy.schemaVersion !== 1) throw new Error(`Unsupported Agent Skill trust schema ${policy.schemaVersion}.`);
  const metadataByUri = new Map((policy.records || []).map((record) => [record.uri, record]));
  const records = [];
  for (const entry of registry.skills || []) {
    const metadata = metadataByUri.get(entry.uri);
    if (!metadata) throw new Error(`Missing Agent Skill trust metadata for ${entry.uri}.`);
    const inspected = await inspectAgentSkillPackage({ root: path.join(ROOT_DIR, entry.path) });
    const record = safeTrustRecord({
      skillId: entry.id,
      uri: entry.uri,
      displayName: metadata.displayName || inspected.name,
      description: inspected.description,
      sourceKind: policy.builtInSource.kind,
      source: policy.builtInSource.source,
      pinnedRevision: policy.builtInSource.pinnedRevision,
      contentSha256: inspected.contentSha256,
      hashAlgorithm: inspected.hashAlgorithm,
      license: policy.builtInSource.license,
      author: policy.builtInSource.author,
      publisher: "PlotPickle",
      trustState: policy.builtInSource.trustState,
      reviewStatus: policy.builtInSource.reviewStatus,
      reviewedAt: policy.builtInSource.reviewedAt,
      executableScriptsPresent: inspected.executableScriptsPresent,
      referencesPresent: inspected.referencesPresent,
      assetsPresent: inspected.assetsPresent,
      requestedCapabilityClasses: metadata.requestedCapabilityClasses,
      forbiddenCapabilityClasses: policy.universalForbiddenCapabilityClasses,
      evalStatus: metadata.evalStatus,
      lastEvaluatedRevision: metadata.lastEvaluatedRevision,
      supersedes: metadata.supersedes || "",
      replacedBy: metadata.replacedBy || "",
      staticRiskFindings: inspected.staticRiskFindings,
      contentHashMatchesApproval: true,
      productionDiscoverable: true,
      executionAllowed: true,
      capabilitiesGranted: false,
    });
    const errors = validateTrustRecord(record);
    if (errors.length) throw new Error(`Invalid Agent Skill trust record ${entry.uri}: ${errors.join("; ")}`);
    records.push(record);
  }
  const registryUris = new Set((registry.skills || []).map((entry) => entry.uri));
  const extraMetadata = [...metadataByUri.keys()].filter((uri) => !registryUris.has(uri));
  if (extraMetadata.length) throw new Error(`Agent Skill trust metadata references unknown built-ins: ${extraMetadata.join(", ")}`);
  return records;
}

export function externalSkillTrustState(input) {
  const approved = input.reviewStatus === "approved" && input.requestedTrustState === "approved-external";
  const hashMatches = Boolean(input.approvedContentSha256) && input.approvedContentSha256 === input.currentContentSha256;
  const revisionMatches = Boolean(input.approvedPinnedRevision) && input.approvedPinnedRevision === input.currentPinnedRevision;
  if (input.requestedTrustState === "blocked" || input.reviewStatus === "rejected") return { trustState: "blocked", contentHashMatchesApproval: hashMatches && revisionMatches };
  if (approved && hashMatches && revisionMatches) return { trustState: "approved-external", contentHashMatchesApproval: true };
  return { trustState: "quarantined", contentHashMatchesApproval: hashMatches && revisionMatches };
}

export async function inspectQuarantinedExternalSkill(input = {}) {
  const root = path.resolve(input.root || QUARANTINE_FIXTURE);
  const inspected = await inspectAgentSkillPackage({ root });
  const requestedTrustState = input.requestedTrustState || "quarantined";
  const state = externalSkillTrustState({
    requestedTrustState,
    reviewStatus: input.reviewStatus || "pending",
    approvedContentSha256: input.approvedContentSha256 || "",
    approvedPinnedRevision: input.approvedPinnedRevision || "",
    currentContentSha256: inspected.contentSha256,
    currentPinnedRevision: input.pinnedRevision || "fixture-external@1",
  });
  const record = safeTrustRecord({
    skillId: input.skillId || "unsafe-community-helper",
    uri: input.uri || "skill://external/unsafe-community-helper",
    displayName: inspected.name,
    description: inspected.description,
    sourceKind: input.sourceKind || "external-github",
    source: input.source || "tests/fixtures/agent-skills/quarantined-external",
    pinnedRevision: input.pinnedRevision || "fixture-external@1",
    contentSha256: inspected.contentSha256,
    hashAlgorithm: inspected.hashAlgorithm,
    license: input.license || "unknown-review-required",
    author: input.author || "unreviewed fixture publisher",
    publisher: input.publisher || "unverified fixture publisher",
    trustState: state.trustState,
    reviewStatus: input.reviewStatus || "pending",
    reviewedAt: input.reviewedAt || "",
    executableScriptsPresent: inspected.executableScriptsPresent,
    referencesPresent: inspected.referencesPresent,
    assetsPresent: inspected.assetsPresent,
    requestedCapabilityClasses: [...inspected.inferredRequestedCapabilityClasses, "credential-read", "network-egress-by-skill", "ppf-direct-write"],
    forbiddenCapabilityClasses: ["authority-escalation", "credential-read", "network-egress-by-skill", "provider-selection-by-skill", "ppf-direct-write", "github-write-by-product-agent"],
    evalStatus: input.evalStatus || "not-evaluated",
    lastEvaluatedRevision: input.lastEvaluatedRevision || "quarantine-fixture-v1",
    staticRiskFindings: inspected.staticRiskFindings,
    contentHashMatchesApproval: state.contentHashMatchesApproval,
    productionDiscoverable: false,
    executionAllowed: false,
    capabilitiesGranted: false,
  });
  const errors = validateTrustRecord(record).filter((error) => !/reviewedAt is required/.test(error));
  if (errors.length) throw new Error(`Invalid quarantined Agent Skill trust record: ${errors.join("; ")}`);
  return { record, inspected };
}

export async function trustedAgentSkillIndex() {
  const records = await builtInAgentSkillTrustRecords();
  return records.filter((record) => record.productionDiscoverable && PRODUCTION_TRUST.has(record.trustState)).map((record) => ({
    id: record.skillId,
    uri: record.uri,
    name: record.displayName,
    description: record.description,
    sourceKind: record.sourceKind,
    pinnedRevision: record.pinnedRevision,
    contentSha256: record.contentSha256,
    trustState: record.trustState,
    reviewStatus: record.reviewStatus,
    executableScriptsPresent: record.executableScriptsPresent,
    referencesPresent: record.referencesPresent,
    assetsPresent: record.assetsPresent,
    requestedCapabilityClasses: record.requestedCapabilityClasses,
    forbiddenCapabilityClasses: record.forbiddenCapabilityClasses,
    evalStatus: record.evalStatus,
    lastEvaluatedRevision: record.lastEvaluatedRevision,
    capabilitiesGranted: false,
  }));
}

export async function validateAgentSkillTrust() {
  const records = await builtInAgentSkillTrustRecords();
  const quarantine = await inspectQuarantinedExternalSkill();
  const errors = [];
  if (!records.length) errors.push("No trusted built-in Agent Skill records were generated.");
  for (const record of records) errors.push(...validateTrustRecord(record).map((error) => `${record.uri}: ${error}`));
  if (quarantine.record.trustState !== "quarantined") errors.push("External fixture must remain quarantined by default.");
  if (quarantine.record.productionDiscoverable) errors.push("Quarantined external fixture must not be production discoverable.");
  if (quarantine.record.executionAllowed) errors.push("Quarantined external fixture must not be executable.");
  if (!quarantine.record.executableScriptsPresent) errors.push("Quarantine fixture must prove that a package can contain scripts without executing them.");
  if (!quarantine.inspected.staticRiskFindings.length) errors.push("Quarantine fixture must produce static risk findings.");
  return { ok: errors.length === 0, errors, records, quarantine: quarantine.record };
}

export async function selfTestAgentSkillTrust() {
  const result = await validateAgentSkillTrust();
  if (!result.ok) throw new Error(`Agent Skill trust validation failed:\n- ${result.errors.join("\n- ")}`);
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await selfTestAgentSkillTrust();
  console.log(`Agent Skill trust PASS · ${result.records.length} trusted built-ins · quarantined fixture ${result.quarantine.contentSha256.slice(0, 12)}`);
}
