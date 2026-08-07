import type { PlotPickleProject } from "./project";

export type ContinuityLockKind = "identity" | "wardrobe" | "prop" | "architecture" | "palette" | "time" | "weather" | "camera";
export type ContinuityLockScopeKind = "project" | "sequence" | "block" | "scene";

export type ContinuityLockScope = {
  kind: ContinuityLockScopeKind;
  id: string;
  label: string;
};

export type ContinuityLock = {
  id: string;
  kind: ContinuityLockKind;
  value: string;
  scope: ContinuityLockScope;
  canonItemId: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ContinuityOverride = {
  id: string;
  lockId: string;
  scope: ContinuityLockScope;
  value: string;
  reason: string;
  createdAt: string;
};

export type ContinuityLockStore = {
  version: 1;
  locks: ContinuityLock[];
  overrides: ContinuityOverride[];
};

export type ContinuityTarget = {
  sequenceId?: string;
  blockId?: string;
  sceneId?: string;
};

export type EffectiveContinuityLock = ContinuityLock & {
  effectiveValue: string;
  override?: ContinuityOverride;
  warning: string;
};

const EXTENSION_KEY = "continuityLocks";
const KINDS: ContinuityLockKind[] = ["identity", "wardrobe", "prop", "architecture", "palette", "time", "weather", "camera"];
const SCOPES: ContinuityLockScopeKind[] = ["project", "sequence", "block", "scene"];
const PRECEDENCE: Record<ContinuityLockScopeKind, number> = { project: 0, sequence: 1, block: 2, scene: 3 };

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalizeScope(value: unknown): ContinuityLockScope {
  const candidate = record(value);
  const kind = SCOPES.includes(candidate.kind as ContinuityLockScopeKind) ? candidate.kind as ContinuityLockScopeKind : "project";
  return { kind, id: text(candidate.id) || "project", label: text(candidate.label) || "Whole project" };
}

export function readContinuityLockStore(project: PlotPickleProject): ContinuityLockStore {
  const extensions = record(project.extensions);
  const raw = record(extensions[EXTENSION_KEY]);
  const locks = Array.isArray(raw.locks) ? raw.locks.flatMap((entry, index) => {
    const candidate = record(entry);
    if (!Object.keys(candidate).length) return [];
    const kind = KINDS.includes(candidate.kind as ContinuityLockKind) ? candidate.kind as ContinuityLockKind : "identity";
    const createdAt = text(candidate.createdAt) || new Date().toISOString();
    return [{
      id: text(candidate.id) || `continuity-lock-${index + 1}`,
      kind,
      value: text(candidate.value),
      scope: normalizeScope(candidate.scope),
      canonItemId: text(candidate.canonItemId),
      active: candidate.active !== false,
      createdAt,
      updatedAt: text(candidate.updatedAt) || createdAt,
    }];
  }) : [];
  const overrides = Array.isArray(raw.overrides) ? raw.overrides.flatMap((entry, index) => {
    const candidate = record(entry);
    if (!Object.keys(candidate).length) return [];
    return [{
      id: text(candidate.id) || `continuity-override-${index + 1}`,
      lockId: text(candidate.lockId),
      scope: normalizeScope(candidate.scope),
      value: text(candidate.value),
      reason: text(candidate.reason),
      createdAt: text(candidate.createdAt) || new Date().toISOString(),
    }];
  }) : [];
  return { version: 1, locks, overrides };
}

function writeStore(project: PlotPickleProject, store: ContinuityLockStore): PlotPickleProject {
  return {
    ...project,
    extensions: {
      ...record(project.extensions),
      [EXTENSION_KEY]: store,
    },
  };
}

export function addContinuityLock(project: PlotPickleProject, lock: ContinuityLock) {
  const store = readContinuityLockStore(project);
  return writeStore(project, { version: 1, locks: [...store.locks, lock], overrides: store.overrides });
}

export function setContinuityLockActive(project: PlotPickleProject, lockId: string, active: boolean, updatedAt = new Date().toISOString()) {
  const store = readContinuityLockStore(project);
  return writeStore(project, {
    version: 1,
    locks: store.locks.map((lock) => lock.id === lockId ? { ...lock, active, updatedAt } : lock),
    overrides: store.overrides,
  });
}

export function addContinuityOverride(project: PlotPickleProject, override: ContinuityOverride) {
  const store = readContinuityLockStore(project);
  return writeStore(project, { version: 1, locks: store.locks, overrides: [...store.overrides, override] });
}

function applies(scope: ContinuityLockScope, target: ContinuityTarget) {
  if (scope.kind === "project") return true;
  if (scope.kind === "sequence") return scope.id === target.sequenceId;
  if (scope.kind === "block") return scope.id === target.blockId;
  return scope.id === target.sceneId;
}

export function effectiveContinuityLocks(project: PlotPickleProject, target: ContinuityTarget): EffectiveContinuityLock[] {
  const store = readContinuityLockStore(project);
  const applicable = store.locks
    .filter((lock) => lock.active && applies(lock.scope, target))
    .sort((left, right) => PRECEDENCE[left.scope.kind] - PRECEDENCE[right.scope.kind] || left.id.localeCompare(right.id));

  const byKind = new Map<ContinuityLockKind, ContinuityLock>();
  for (const lock of applicable) byKind.set(lock.kind, lock);

  return [...byKind.values()].map((lock) => {
    const override = store.overrides
      .filter((entry) => entry.lockId === lock.id && applies(entry.scope, target))
      .sort((left, right) => PRECEDENCE[right.scope.kind] - PRECEDENCE[left.scope.kind])[0];
    return {
      ...lock,
      effectiveValue: override?.value || lock.value,
      override,
      warning: override && override.value !== lock.value
        ? `Override conflicts with inherited ${lock.kind} lock from ${lock.scope.label}. Reason: ${override.reason || "No reason recorded."}`
        : "",
    };
  });
}

export function continuityWarnings(project: PlotPickleProject, target: ContinuityTarget) {
  return effectiveContinuityLocks(project, target).map((lock) => lock.warning).filter(Boolean);
}
