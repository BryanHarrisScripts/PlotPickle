export type RetentionKind = "responsibility-run" | "verification" | "trace-log" | "backup";

export type RetentionRule = {
  maxAgeDays: number;
  maxCount: number;
  minimumKeep: number;
};

export type RetentionPolicy = {
  version: 1;
  responsibilityRuns: RetentionRule;
  verification: RetentionRule;
  traceLogs: RetentionRule;
  backups: RetentionRule;
  canonicalProjectHistory: "never-auto-prune";
};

export const DEFAULT_RETENTION_POLICY: RetentionPolicy = {
  version: 1,
  responsibilityRuns: { maxAgeDays: 30, maxCount: 100, minimumKeep: 10 },
  verification: { maxAgeDays: 90, maxCount: 100, minimumKeep: 10 },
  traceLogs: { maxAgeDays: 14, maxCount: 50, minimumKeep: 5 },
  backups: { maxAgeDays: 180, maxCount: 20, minimumKeep: 5 },
  canonicalProjectHistory: "never-auto-prune",
};

export type RetentionRecord = {
  id: string;
  kind: RetentionKind;
  createdAt: string;
  bytes: number;
  pinned: boolean;
  exported: boolean;
};

export type RetentionDecision = RetentionRecord & {
  action: "keep" | "delete";
  reason: "pinned" | "minimum-keep" | "within-policy" | "age-limit" | "count-limit";
};

function timestamp(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function boundedRule(rule: RetentionRule): RetentionRule {
  const integer = (value: unknown, fallback: number, minimum: number, maximum: number) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(minimum, Math.min(maximum, Math.floor(number))) : fallback;
  };
  return {
    maxAgeDays: integer(rule.maxAgeDays, 30, 1, 3650),
    maxCount: integer(rule.maxCount, 100, 1, 10_000),
    minimumKeep: integer(rule.minimumKeep, 10, 0, 1_000),
  };
}

export function retentionRule(policy: RetentionPolicy, kind: RetentionKind) {
  if (kind === "responsibility-run") return boundedRule(policy.responsibilityRuns);
  if (kind === "verification") return boundedRule(policy.verification);
  if (kind === "trace-log") return boundedRule(policy.traceLogs);
  return boundedRule(policy.backups);
}

export function planRetention(records: readonly RetentionRecord[], policy: RetentionPolicy = DEFAULT_RETENTION_POLICY, now = new Date().toISOString()): RetentionDecision[] {
  const nowMs = Date.parse(now);
  const safeNow = Number.isFinite(nowMs) ? nowMs : Date.now();
  const byKind = new Map<RetentionKind, RetentionRecord[]>();
  for (const record of records) byKind.set(record.kind, [...(byKind.get(record.kind) || []), record]);
  const decisions: RetentionDecision[] = [];
  for (const [kind, values] of byKind) {
    const rule = retentionRule(policy, kind);
    const ordered = [...values].sort((left, right) => timestamp(right.createdAt) - timestamp(left.createdAt));
    const unpinnedKept = new Set(ordered.filter((record) => !record.pinned).slice(0, Math.max(rule.minimumKeep, 0)).map((record) => record.id));
    let retainedByCount = 0;
    for (const record of ordered) {
      if (record.pinned) {
        decisions.push({ ...record, action: "keep", reason: "pinned" });
        continue;
      }
      if (unpinnedKept.has(record.id)) {
        retainedByCount += 1;
        decisions.push({ ...record, action: "keep", reason: "minimum-keep" });
        continue;
      }
      const ageDays = Math.max(0, (safeNow - timestamp(record.createdAt)) / 86_400_000);
      if (ageDays > rule.maxAgeDays) {
        decisions.push({ ...record, action: "delete", reason: "age-limit" });
        continue;
      }
      if (retainedByCount >= rule.maxCount) {
        decisions.push({ ...record, action: "delete", reason: "count-limit" });
        continue;
      }
      retainedByCount += 1;
      decisions.push({ ...record, action: "keep", reason: "within-policy" });
    }
  }
  return decisions;
}

export function retentionStorageSummary(records: readonly RetentionRecord[], policy: RetentionPolicy = DEFAULT_RETENTION_POLICY) {
  const planned = planRetention(records, policy);
  const totalBytes = records.reduce((total, record) => total + Math.max(0, Number(record.bytes) || 0), 0);
  const reclaimableBytes = planned.filter((record) => record.action === "delete").reduce((total, record) => total + Math.max(0, Number(record.bytes) || 0), 0);
  const counts = Object.fromEntries(["responsibility-run", "verification", "trace-log", "backup"].map((kind) => [kind, records.filter((record) => record.kind === kind).length]));
  return { totalBytes, reclaimableBytes, counts, plannedDeleteCount: planned.filter((record) => record.action === "delete").length };
}

export function pinRetentionRecord(records: readonly RetentionRecord[], id: string, pinned: boolean) {
  return records.map((record) => record.id === id ? { ...record, pinned } : record);
}

export function canonicalHistoryRetentionBoundary() {
  return {
    ppfCanonicalRevisionHistory: "never-auto-prune",
    acceptedCreativeMutations: "never-auto-prune",
    candidateAndAssetProvenanceInsidePpf: "never-auto-prune",
    evidenceRetentionAppliesOnlyTo: ["responsibility-run", "verification", "trace-log", "backup"],
  } as const;
}
