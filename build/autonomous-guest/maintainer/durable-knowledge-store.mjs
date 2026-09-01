import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export const MAINTAINER_KNOWLEDGE_STORE_FORMAT = "plotpickle-maintainer-knowledge-store";
export const MAINTAINER_KNOWLEDGE_STORE_VERSION = 1;
export const MAINTAINER_KNOWLEDGE_STATES = Object.freeze(["approved", "stale", "retired"]);

const SHA = /^[a-f0-9]{40}$/i;
const SAFE_ID = /^[a-z0-9][a-z0-9._:-]{2,179}$/i;
const SAFE_REF = /^[a-z0-9][a-z0-9._:/@#-]{1,239}$/i;
const SAFE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[a-z0-9._@/-]{1,240}$/i;
const SAFE_SKILL_VERSION_KEY = /^[a-z0-9][a-z0-9._:-]{1,119}@(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9a-z.-]+)?$/i;
const ALLOWED_KINDS = new Set(["architecture-fact", "operational-procedure", "defect-lesson", "skill-proposal"]);
const ALLOWED_DOMAINS = new Set([
  "ai", "auth", "buzz", "story", "storage", "projects", "startup", "runtime",
  "verification", "ui", "developer", "release", "shared-core",
]);
const ALLOWED_EVIDENCE = new Set(["source", "test", "workflow", "artifact", "defect"]);
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_RECORDS = 512;
const MAX_ITEMS = 64;
const MAX_SUMMARY = 600;
const FORBIDDEN_TEXT = /(?:chain[- ]?of[- ]?thought|hidden reasoning|BEGIN [A-Z ]*PRIVATE KEY|password\s*=|passphrase\s*=|credential\s*=|\bnsec1[a-z0-9]{8,}\b|\bBearer\s+[A-Za-z0-9._~+/=-]{8,}\b|\bsk-[A-Za-z0-9_-]{8,}\b)/i;

function checkedText(value, label, pattern, maximum = 240, allowEmpty = false) {
  const normalized = String(value ?? "").trim();
  if (allowEmpty && normalized === "") return "";
  if (normalized.length > maximum || !pattern.test(normalized)) {
    throw new Error(`Maintainer knowledge ${label} is missing or invalid.`);
  }
  return normalized;
}

function checkedSha(value, label) {
  return checkedText(value, label, SHA, 40).toLowerCase();
}

function checkedTimestamp(value, label, allowEmpty = false) {
  const normalized = String(value ?? "").trim();
  if (allowEmpty && normalized === "") return "";
  const parsed = new Date(normalized);
  if (!Number.isFinite(parsed.getTime())) throw new Error(`Maintainer knowledge ${label} timestamp is invalid.`);
  return parsed.toISOString();
}

function checkedList(values, label, pattern, maximum = MAX_ITEMS) {
  if (!Array.isArray(values) || values.length > maximum) {
    throw new Error(`Maintainer knowledge ${label} exceeds its bounded size.`);
  }
  const normalized = [...new Set(values.map((value) => checkedText(value, label, pattern)))];
  return Object.freeze(normalized);
}

function checkedSummary(value) {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  if (normalized.length < 16 || normalized.length > MAX_SUMMARY || FORBIDDEN_TEXT.test(normalized)) {
    throw new Error("Maintainer knowledge summary is unsafe or outside its bounded length.");
  }
  return normalized;
}

function checkedEvidence(values) {
  if (!Array.isArray(values) || !values.length || values.length > MAX_ITEMS) {
    throw new Error("Maintainer knowledge requires bounded provenance evidence.");
  }
  const seen = new Set();
  return Object.freeze(values.map((value) => {
    if (!value || typeof value !== "object" || !ALLOWED_EVIDENCE.has(value.kind)) {
      throw new Error("Maintainer knowledge evidence kind is invalid.");
    }
    const ref = checkedText(value.ref, "evidence reference", SAFE_REF);
    const key = `${value.kind}:${ref}`;
    if (seen.has(key)) throw new Error("Maintainer knowledge evidence must be unique.");
    seen.add(key);
    return Object.freeze({ kind: value.kind, ref });
  }));
}

function checkedState(value) {
  if (!MAINTAINER_KNOWLEDGE_STATES.includes(value)) throw new Error("Maintainer knowledge state is invalid.");
  return value;
}

function checkedRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Maintainer knowledge record is invalid.");
  const kind = String(value.kind || "");
  const domain = String(value.domain || "");
  if (!ALLOWED_KINDS.has(kind)) throw new Error("Maintainer knowledge kind is invalid.");
  if (!ALLOWED_DOMAINS.has(domain)) throw new Error("Maintainer knowledge domain is invalid.");
  const version = Number(value.version);
  if (!Number.isInteger(version) || version < 1 || version > 10_000) throw new Error("Maintainer knowledge version is invalid.");
  const state = checkedState(value.state);
  const staleAt = checkedTimestamp(value.staleAt, "staleAt", true);
  const staleByCommitSha = checkedText(value.staleByCommitSha, "stale commit", SHA, 40, true).toLowerCase();
  if ((state === "stale") !== Boolean(staleAt && staleByCommitSha)) {
    throw new Error("Maintainer stale knowledge requires its exact invalidation commit and timestamp.");
  }
  const skillVersionKey = checkedText(value.skillVersionKey, "skill version key", SAFE_SKILL_VERSION_KEY, 200, true);
  if ((kind === "skill-proposal") !== Boolean(skillVersionKey)) {
    throw new Error("Maintainer skill knowledge requires one approved skill version key only.");
  }
  if (
    value.operationalAuthorityGranted !== false
    || value.skillActivated !== false
    || value.sourceMutationAllowed !== false
    || value.aiSelfCertified !== false
  ) throw new Error("Maintainer knowledge cannot persist operational authority.");

  return Object.freeze({
    schemaVersion: 1,
    knowledgeId: checkedText(value.knowledgeId, "ID", SAFE_ID, 180),
    version,
    dedupeKey: checkedText(value.dedupeKey, "dedupe key", SAFE_ID, 180),
    kind,
    domain,
    summary: checkedSummary(value.summary),
    exactSourceCommitSha: checkedSha(value.exactSourceCommitSha, "source commit"),
    verifiedThroughCommitSha: checkedSha(value.verifiedThroughCommitSha, "verified-through commit"),
    evidence: checkedEvidence(value.evidence),
    freshnessPaths: checkedList(value.freshnessPaths, "freshness path", SAFE_PATH, 64),
    applicabilityRefs: checkedList(value.applicabilityRefs, "applicability reference", SAFE_REF),
    exclusionRefs: checkedList(value.exclusionRefs, "exclusion reference", SAFE_REF),
    skillId: checkedText(value.skillId, "skill ID", SAFE_ID, 180, true),
    skillVersionKey,
    state,
    harnessApprovalRef: checkedText(value.harnessApprovalRef, "harness approval reference", SAFE_REF),
    harnessPolicyId: checkedText(value.harnessPolicyId, "harness policy ID", SAFE_ID, 180),
    harnessPolicyVersion: checkedText(value.harnessPolicyVersion, "harness policy version", SAFE_ID, 80),
    harnessPolicyRef: checkedText(value.harnessPolicyRef, "harness policy reference", SAFE_REF),
    harnessApproverId: checkedText(value.harnessApproverId, "harness approver ID", SAFE_ID, 180),
    createdAt: checkedTimestamp(value.createdAt, "createdAt"),
    approvedAt: checkedTimestamp(value.approvedAt, "approvedAt"),
    lastVerifiedAt: checkedTimestamp(value.lastVerifiedAt, "lastVerifiedAt"),
    staleAt,
    staleByCommitSha,
    operationalAuthorityGranted: false,
    skillActivated: false,
    sourceMutationAllowed: false,
    aiSelfCertified: false,
  });
}

function checkedStore(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Maintainer knowledge store is invalid.");
  if (value.format !== MAINTAINER_KNOWLEDGE_STORE_FORMAT || value.version !== MAINTAINER_KNOWLEDGE_STORE_VERSION) {
    throw new Error("Maintainer knowledge store format or version is invalid.");
  }
  if (!Array.isArray(value.records) || value.records.length > MAX_RECORDS) {
    throw new Error("Maintainer knowledge store record collection is invalid.");
  }
  const records = value.records.map(checkedRecord);
  const versionKeys = new Set();
  const dedupeKeys = new Set();
  for (const record of records) {
    const versionKey = `${record.knowledgeId}@${record.version}`;
    if (versionKeys.has(versionKey) || dedupeKeys.has(record.dedupeKey)) {
      throw new Error("Maintainer knowledge store contains duplicate durable learning.");
    }
    versionKeys.add(versionKey);
    dedupeKeys.add(record.dedupeKey);
  }
  return Object.freeze({
    format: MAINTAINER_KNOWLEDGE_STORE_FORMAT,
    version: MAINTAINER_KNOWLEDGE_STORE_VERSION,
    records: Object.freeze(records),
  });
}

function storeFile(root) {
  if (typeof root !== "string" || !path.isAbsolute(root)) throw new Error("Maintainer knowledge store requires an absolute host-owned data root.");
  return path.join(root, "maintainer", "evidence-learning-memory.json");
}

async function readStore(root) {
  const target = storeFile(root);
  try {
    const source = await readFile(target, "utf8");
    if (Buffer.byteLength(source, "utf8") > MAX_BYTES) throw new Error("Maintainer knowledge store exceeds its bounded size.");
    return checkedStore(JSON.parse(source));
  } catch (error) {
    if (error?.code === "ENOENT") {
      return checkedStore({ format: MAINTAINER_KNOWLEDGE_STORE_FORMAT, version: MAINTAINER_KNOWLEDGE_STORE_VERSION, records: [] });
    }
    throw error;
  }
}

async function replaceStore(root, records) {
  const checked = checkedStore({
    format: MAINTAINER_KNOWLEDGE_STORE_FORMAT,
    version: MAINTAINER_KNOWLEDGE_STORE_VERSION,
    records,
  });
  const target = storeFile(root);
  const source = `${JSON.stringify(checked, null, 2)}\n`;
  if (Buffer.byteLength(source, "utf8") > MAX_BYTES) throw new Error("Maintainer knowledge store exceeds its bounded size.");
  const directory = path.dirname(target);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, source, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, target);
  return checked;
}

function pathsTouch(left, right) {
  const a = String(left || "").replaceAll("\\", "/").replace(/\/+$/, "");
  const b = String(right || "").replaceAll("\\", "/").replace(/\/+$/, "");
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}

function assertApprovalForProposal(proposal, approval, skillProposal) {
  if (!proposal || proposal.state !== "observed") throw new Error("Maintainer durable admission requires an observed learning proposal.");
  if (
    !approval
    || approval.state !== "approved"
    || approval.durableAdmissionEligible !== true
    || approval.durablyAdmitted !== false
    || approval.operationalAuthorityGranted !== false
    || approval.aiSelfCertified !== false
  ) throw new Error("Maintainer durable admission requires an unused harness approval without operational authority.");
  if (
    approval.learningProposalId !== proposal.proposalId
    || approval.learningDedupeKey !== proposal.dedupeKey
    || approval.exactCommitSha !== String(proposal.exactCommitSha || "").toLowerCase()
    || approval.domain !== proposal.domain
    || approval.kind !== proposal.kind
  ) throw new Error("Maintainer durable admission approval provenance does not match the proposal.");
  if (approval.approvedBy?.authorityClass !== "plotpickle-maintainer-harness-approver" || approval.approvedBy?.serverOwned !== true) {
    throw new Error("Maintainer durable admission requires server-owned harness approval.");
  }
  if (proposal.kind === "skill-proposal") {
    if (
      approval.action !== "skill-version-promotion"
      || approval.skillVersionPromotionEligible !== true
      || !skillProposal
      || skillProposal.skillProposalId !== approval.skillProposalId
      || skillProposal.learningProposalId !== proposal.proposalId
      || skillProposal.exactCommitSha !== proposal.exactCommitSha
      || skillProposal.versionKey !== approval.skillVersionKey
      || skillProposal.state !== "observed"
      || skillProposal.skillActivationAllowed !== false
      || skillProposal.operationalAuthorityGranted !== false
    ) throw new Error("Maintainer skill knowledge requires the exact governed skill proposal and harness promotion approval.");
  } else if (approval.action !== "durable-knowledge-admission" || skillProposal) {
    throw new Error("Maintainer non-skill knowledge requires a durable-knowledge admission approval only.");
  }
}

function durableRecord(proposal, approval, skillProposal, version) {
  return checkedRecord({
    schemaVersion: 1,
    knowledgeId: proposal.proposalId,
    version,
    dedupeKey: proposal.dedupeKey,
    kind: proposal.kind,
    domain: proposal.domain,
    summary: proposal.summary,
    exactSourceCommitSha: proposal.exactCommitSha,
    verifiedThroughCommitSha: proposal.exactCommitSha,
    evidence: proposal.evidence,
    freshnessPaths: approval.freshnessPaths,
    applicabilityRefs: proposal.applicabilityRefs || [],
    exclusionRefs: proposal.exclusionRefs || [],
    skillId: proposal.skillId || "",
    skillVersionKey: skillProposal?.versionKey || "",
    state: "approved",
    harnessApprovalRef: approval.harnessApprovalRef,
    harnessPolicyId: approval.policy?.policyId,
    harnessPolicyVersion: approval.policy?.policyVersion,
    harnessPolicyRef: approval.policy?.policyRef,
    harnessApproverId: approval.approvedBy?.approverId,
    createdAt: proposal.createdAt,
    approvedAt: approval.approvedAt,
    lastVerifiedAt: approval.approvedAt,
    staleAt: "",
    staleByCommitSha: "",
    operationalAuthorityGranted: false,
    skillActivated: false,
    sourceMutationAllowed: false,
    aiSelfCertified: false,
  });
}

export function createMaintainerKnowledgeStore({ root }) {
  storeFile(root);
  return Object.freeze({
    async list() {
      return (await readStore(root)).records;
    },
    async admit({ proposal, approval, skillProposal = null }) {
      assertApprovalForProposal(proposal, approval, skillProposal);
      const store = await readStore(root);
      const duplicate = store.records.find((record) => record.dedupeKey === proposal.dedupeKey);
      if (duplicate) return duplicate;
      if (store.records.length >= MAX_RECORDS) throw new Error("Maintainer knowledge store reached its bounded record count.");
      const versions = store.records.filter((record) => record.knowledgeId === proposal.proposalId).map((record) => record.version);
      const record = durableRecord(proposal, approval, skillProposal, versions.length ? Math.max(...versions) + 1 : 1);
      await replaceStore(root, [...store.records, record]);
      return record;
    },
    async verifyFreshness({ fromCommitSha, toCommitSha, changedPaths, verifiedAt }) {
      const from = checkedSha(fromCommitSha, "freshness source commit");
      const to = checkedSha(toCommitSha, "freshness target commit");
      const paths = checkedList(changedPaths, "changed path", SAFE_PATH, 256);
      const at = checkedTimestamp(verifiedAt, "freshness verification");
      const store = await readStore(root);
      let changed = false;
      const records = store.records.map((record) => {
        if (record.state !== "approved" || record.verifiedThroughCommitSha !== from) return record;
        changed = true;
        if (record.freshnessPaths.some((freshnessPath) => paths.some((changedPath) => pathsTouch(freshnessPath, changedPath)))) {
          return checkedRecord({
            ...record,
            state: "stale",
            staleAt: at,
            staleByCommitSha: to,
          });
        }
        return checkedRecord({
          ...record,
          verifiedThroughCommitSha: to,
          lastVerifiedAt: at,
        });
      });
      if (changed) await replaceStore(root, records);
      return Object.freeze(records);
    },
    async retrieveForTask(task) {
      if (!task || typeof task !== "object") throw new Error("Maintainer knowledge retrieval requires a bounded task contract.");
      const exactCommitSha = checkedSha(task.exactCommitSha, "task commit");
      const domains = checkedList(task.domains, "task domain", SAFE_ID, 16);
      if (!domains.length || domains.some((domain) => !ALLOWED_DOMAINS.has(domain))) throw new Error("Maintainer knowledge retrieval requires valid bounded task domains.");
      const contextRefs = checkedList(task.contextRefs || [], "task context reference", SAFE_REF);
      const allowedSkills = new Set(checkedList(task.allowedSkillVersionKeys || [], "allowed skill version", SAFE_SKILL_VERSION_KEY));
      const maximumItems = Number(task.maximumItems ?? 16);
      if (!Number.isInteger(maximumItems) || maximumItems < 1 || maximumItems > 32) throw new Error("Maintainer knowledge retrieval maximum must be between 1 and 32.");
      const store = await readStore(root);
      const applicable = store.records.filter((record) => {
        if (record.state !== "approved" || record.verifiedThroughCommitSha !== exactCommitSha || !domains.includes(record.domain)) return false;
        if (record.exclusionRefs.some((ref) => contextRefs.includes(ref))) return false;
        if (record.applicabilityRefs.length && !record.applicabilityRefs.some((ref) => contextRefs.includes(ref))) return false;
        if (record.kind === "skill-proposal" && !allowedSkills.has(record.skillVersionKey)) return false;
        return true;
      });
      applicable.sort((left, right) => right.lastVerifiedAt.localeCompare(left.lastVerifiedAt) || right.version - left.version || left.knowledgeId.localeCompare(right.knowledgeId));
      return Object.freeze(applicable.slice(0, maximumItems));
    },
  });
}
