import { createHash } from "node:crypto";

const SHA = /^[a-f0-9]{40}$/i;
const SAFE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[a-z0-9._@/-]{1,240}$/i;
const MAX_DOMAINS = 32;
const MAX_PATHS_PER_DOMAIN = 16;
const GLOBAL_FRESHNESS_PATHS = Object.freeze([
  "config/repository-architecture-target.json",
  "scripts/repository-architecture-inventory.mjs",
]);

function assertGuestAuthority(authority) {
  if (
    authority?.authorityClass !== "delegated-guest-autonomous-operator"
    || authority.delegated !== true
    || authority.humanProfileId !== ""
    || authority.accessMode !== "desktop-loopback"
  ) {
    throw new Error("Architecture learning requires delegated non-Human desktop-loopback Guest authority.");
  }
}

function exactSha(value, label) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!SHA.test(normalized)) throw new Error(`Architecture learning requires an exact ${label} commit SHA.`);
  return normalized;
}

function safePaths(values, domain) {
  if (!Array.isArray(values) || !values.length || values.length > MAX_PATHS_PER_DOMAIN) {
    throw new Error(`Architecture domain ${domain} requires bounded ownership paths.`);
  }
  const paths = [...new Set(values.map((value) => String(value || "").trim()))].sort();
  if (paths.some((value) => !SAFE_PATH.test(value))) {
    throw new Error(`Architecture domain ${domain} contains an unsafe ownership path.`);
  }
  return Object.freeze(paths);
}

function pathTouches(changedPath, freshnessPath) {
  return changedPath === freshnessPath
    || changedPath.startsWith(`${freshnessPath}/`)
    || freshnessPath.startsWith(`${changedPath}/`);
}

export function createExactHeadArchitectureSnapshot({ authority, exactCommitSha, inventory }) {
  assertGuestAuthority(authority);
  const normalizedSha = exactSha(exactCommitSha, "head");
  if (inventory?.status !== "ratified-plan-ready" || !Array.isArray(inventory.planIssues) || inventory.planIssues.length) {
    throw new Error("Architecture learning requires a valid deterministic repository inventory.");
  }
  const descriptions = inventory.domains;
  const ownership = inventory.domainOwnership;
  if (!descriptions || !ownership || typeof descriptions !== "object" || typeof ownership !== "object") {
    throw new Error("Architecture inventory is missing domain ownership evidence.");
  }
  const domainNames = Object.keys(descriptions).sort();
  if (!domainNames.length || domainNames.length > MAX_DOMAINS) {
    throw new Error("Architecture inventory contains an invalid number of domains.");
  }
  if (Object.keys(ownership).some((domain) => !domainNames.includes(domain))) {
    throw new Error("Architecture inventory contains ownership for an unknown domain.");
  }

  const domains = domainNames.map((domain) => {
    const summary = String(descriptions[domain] || "").replace(/\s+/g, " ").trim();
    if (summary.length < 12 || summary.length > 240) {
      throw new Error(`Architecture domain ${domain} has an invalid bounded summary.`);
    }
    const ownershipPaths = safePaths(ownership[domain], domain);
    return Object.freeze({
      domain,
      summary,
      ownershipPaths,
      sourceRefs: Object.freeze([
        "config/repository-architecture-target.json",
        "artifact:repository-architecture/inventory.json",
      ]),
      changedPathInvalidationInputs: Object.freeze([...GLOBAL_FRESHNESS_PATHS, ...ownershipPaths]),
    });
  });

  const snapshotMaterial = JSON.stringify({ exactCommitSha: normalizedSha, domains });
  return Object.freeze({
    schemaVersion: 1,
    snapshotId: `maintainer-architecture-${createHash("sha256").update(snapshotMaterial).digest("hex").slice(0, 32)}`,
    exactCommitSha: normalizedSha,
    state: "verified",
    inventoryStatus: inventory.status,
    inventorySchemaVersion: inventory.schemaVersion,
    architecturePolicyRef: "config/repository-architecture-target.json",
    inventoryEvidenceRef: "artifact:repository-architecture/inventory.json",
    domains: Object.freeze(domains),
    proposedBy: Object.freeze({
      authorityClass: authority.authorityClass,
      autonomousRunId: authority.autonomousRunId,
      workspaceId: authority.workspaceId,
      operatorId: authority.operatorId,
      humanProfileId: "",
    }),
    harnessApprovalRef: "",
    durableAdmissionAllowed: false,
    sourceMutationAllowed: false,
    skillInstallationAllowed: false,
    skillActivationAllowed: false,
    operationalAuthorityGranted: false,
    aiSelfCertified: false,
  });
}

export function evaluateArchitectureSnapshotFreshness(snapshot, { currentCommitSha, changedPaths = [] }) {
  const normalizedCurrent = exactSha(currentCommitSha, "current");
  if (!Array.isArray(changedPaths) || changedPaths.length > 256) {
    throw new Error("Architecture freshness evaluation requires bounded changed paths.");
  }
  const normalizedPaths = [...new Set(changedPaths.map((value) => String(value || "").trim()))];
  if (normalizedPaths.some((value) => !SAFE_PATH.test(value))) {
    throw new Error("Architecture freshness evaluation contains an unsafe changed path.");
  }
  const commitChanged = snapshot.exactCommitSha !== normalizedCurrent;
  const globalChanged = normalizedPaths.some((changedPath) => GLOBAL_FRESHNESS_PATHS.some((freshnessPath) => pathTouches(changedPath, freshnessPath)));
  const affectedDomains = commitChanged
    ? snapshot.domains
      .filter((item) => !normalizedPaths.length || globalChanged || normalizedPaths.some((changedPath) => item.changedPathInvalidationInputs.some((freshnessPath) => pathTouches(changedPath, freshnessPath))))
      .map((item) => item.domain)
    : [];

  return Object.freeze({
    snapshotId: snapshot.snapshotId,
    evidenceCommitSha: snapshot.exactCommitSha,
    currentCommitSha: normalizedCurrent,
    state: commitChanged ? "stale" : "verified",
    affectedDomains: Object.freeze(affectedDomains),
    requiresHarnessReverification: commitChanged,
    durableAdmissionAllowed: false,
    operationalAuthorityGranted: false,
  });
}
