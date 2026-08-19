import { readCredentialJson, writeCredentialJson } from "./local-credentials";

const TARGET_SELECTION_FILE = "extension-targets.json";
const SEGMENT_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CALLBACK_TASK_PATTERN = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001F\u007F]/;
const RECONNECT_POLICIES = ["manual", "on-demand", "always"] as const;

export type ExtensionModuleIdentityInput = {
  owner: string;
  moduleId: string;
  displayName: string;
};

export type ExtensionModuleIdentity = {
  version: 1;
  owner: string;
  moduleId: string;
  displayName: string;
  serviceName: string;
  transportNamespace: string;
  rootPath: string;
  callbackRootPath: string;
  taskRootPath: string;
};

export type ExtensionReconnectPolicy = (typeof RECONNECT_POLICIES)[number];

export type ExtensionTargetDescriptor = {
  endpoint: string;
  authRef?: string;
  displayLabel?: string;
  reconnectPolicy?: ExtensionReconnectPolicy;
};

type PersistedTargetStore = {
  version: 1;
  selected: Record<string, { target: ExtensionTargetDescriptor; updatedAt: string }>;
};

function stableSegment(value: unknown, field: string) {
  const segment = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!segment) throw new Error(`${field} is required.`);
  if (segment.length > 64) throw new Error(`${field} must be 64 characters or fewer.`);
  if (!SEGMENT_PATTERN.test(segment)) throw new Error(`${field} must use lowercase letters, numbers and single hyphens.`);
  return segment;
}

function displayLabel(value: unknown, field: string) {
  const label = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (!label) throw new Error(`${field} is required.`);
  if (label.length > 120) throw new Error(`${field} must be 120 characters or fewer.`);
  if (CONTROL_CHARACTER_PATTERN.test(label)) throw new Error(`${field} contains unsupported control characters.`);
  return label;
}

function identityKey(identity: Pick<ExtensionModuleIdentity, "owner" | "moduleId">) {
  return `${identity.owner}/${identity.moduleId}`;
}

function operationId(value: unknown, field: string) {
  const id = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!id || id.length > 96 || !CALLBACK_TASK_PATTERN.test(id)) {
    throw new Error(`${field} must use lowercase letters, numbers, dots, underscores or hyphens.`);
  }
  return id;
}

export function defineExtensionModuleIdentity(input: ExtensionModuleIdentityInput): ExtensionModuleIdentity {
  const owner = stableSegment(input.owner, "Extension owner");
  const moduleId = stableSegment(input.moduleId, "Extension module id");
  const rootPath = `/extensions/${owner}/${moduleId}`;
  return {
    version: 1,
    owner,
    moduleId,
    displayName: displayLabel(input.displayName, "Extension display name"),
    serviceName: `plotpickle-module-${owner}-${moduleId}`,
    transportNamespace: `plotpickle.modules.${owner}.${moduleId}`,
    rootPath,
    callbackRootPath: `${rootPath}/callbacks`,
    taskRootPath: `${rootPath}/tasks`,
  };
}

export function extensionCallbackIdentity(identity: ExtensionModuleIdentity, callbackId: string) {
  return `${identity.transportNamespace}.callback.${operationId(callbackId, "Callback id")}`;
}

export function extensionTaskIdentity(identity: ExtensionModuleIdentity, taskId: string) {
  return `${identity.transportNamespace}.task.${operationId(taskId, "Task id")}`;
}

export function normalizeExtensionTarget(value: ExtensionTargetDescriptor): ExtensionTargetDescriptor {
  const endpoint = typeof value?.endpoint === "string" ? value.endpoint.trim() : "";
  if (!endpoint) throw new Error("Extension target endpoint is required.");
  if (endpoint.length > 2048 || CONTROL_CHARACTER_PATTERN.test(endpoint)) throw new Error("Extension target endpoint is invalid.");

  const normalized: ExtensionTargetDescriptor = { endpoint };
  if (value.authRef !== undefined) {
    const authRef = typeof value.authRef === "string" ? value.authRef.trim() : "";
    if (!authRef || authRef.length > 256 || CONTROL_CHARACTER_PATTERN.test(authRef)) throw new Error("Extension target auth reference is invalid.");
    normalized.authRef = authRef;
  }
  if (value.displayLabel !== undefined) normalized.displayLabel = displayLabel(value.displayLabel, "Extension target display label");
  if (value.reconnectPolicy !== undefined) {
    if (!RECONNECT_POLICIES.includes(value.reconnectPolicy)) throw new Error("Extension target reconnect policy is invalid.");
    normalized.reconnectPolicy = value.reconnectPolicy;
  }
  return normalized;
}

function validOptionalText(value: unknown, maxLength: number) {
  if (value === undefined) return true;
  if (typeof value !== "string") return false;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maxLength && !CONTROL_CHARACTER_PATTERN.test(normalized);
}

function validTarget(value: unknown): value is ExtensionTargetDescriptor {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const target = value as Partial<ExtensionTargetDescriptor>;
  const endpoint = typeof target.endpoint === "string" ? target.endpoint.trim() : "";
  if (!endpoint || endpoint.length > 2048 || CONTROL_CHARACTER_PATTERN.test(endpoint)) return false;
  if (!validOptionalText(target.authRef, 256) || !validOptionalText(target.displayLabel, 120)) return false;
  return target.reconnectPolicy === undefined || RECONNECT_POLICIES.includes(target.reconnectPolicy);
}

function validTargetStore(value: unknown): value is PersistedTargetStore {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const store = value as Partial<PersistedTargetStore>;
  if (store.version !== 1 || !store.selected || typeof store.selected !== "object" || Array.isArray(store.selected)) return false;
  return Object.values(store.selected).every((entry) => Boolean(entry)
    && typeof entry === "object"
    && typeof entry.updatedAt === "string"
    && validTarget(entry.target));
}

async function readTargetStore(): Promise<PersistedTargetStore> {
  const value = await readCredentialJson<unknown>(TARGET_SELECTION_FILE);
  return validTargetStore(value) ? value : { version: 1, selected: {} };
}

export async function readSelectedExtensionTarget(identity: Pick<ExtensionModuleIdentity, "owner" | "moduleId">) {
  const store = await readTargetStore();
  return store.selected[identityKey(identity)]?.target || null;
}

export async function writeSelectedExtensionTarget(
  identity: Pick<ExtensionModuleIdentity, "owner" | "moduleId">,
  value: ExtensionTargetDescriptor,
  now = new Date(),
) {
  const target = normalizeExtensionTarget(value);
  const store = await readTargetStore();
  store.selected[identityKey(identity)] = { target, updatedAt: now.toISOString() };
  await writeCredentialJson(TARGET_SELECTION_FILE, store);
  return target;
}

export const EXTENSION_TARGET_SELECTION_FILE = TARGET_SELECTION_FILE;
