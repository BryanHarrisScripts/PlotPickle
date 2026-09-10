import { readCredentialJson, writeCredentialJson } from "./local-credentials";
import { isTextProvider, type ActiveTextProvider, type TextProvider } from "./writing-assistant-store";

export type AgentComputeProvider = TextProvider | "active";

export type AgentComputeStore = {
  version: 1;
  defaultProvider: AgentComputeProvider;
  overrides: Record<string, TextProvider>;
};

const STORE_FILE = "plotpickle-agent-compute.json";

function emptyStore(): AgentComputeStore {
  return {
    version: 1,
    defaultProvider: "active",
    overrides: {},
  };
}

function normalizeStore(value: unknown): AgentComputeStore {
  if (!value || typeof value !== "object") return emptyStore();
  const item = value as Partial<AgentComputeStore>;
  const defaultProvider = item.defaultProvider === "active" || isTextProvider(item.defaultProvider)
    ? item.defaultProvider
    : "active";
  const overrides: Record<string, TextProvider> = {};
  if (item.overrides && typeof item.overrides === "object") {
    for (const [agentId, provider] of Object.entries(item.overrides)) {
      if (/^[a-z0-9-]{1,80}$/u.test(agentId) && isTextProvider(provider)) overrides[agentId] = provider;
    }
  }
  return { version: 1, defaultProvider, overrides };
}

export async function readAgentComputeStore() {
  return normalizeStore(await readCredentialJson<unknown>(STORE_FILE));
}

export async function writeAgentComputeStore(store: AgentComputeStore) {
  await writeCredentialJson(STORE_FILE, normalizeStore(store));
}

export function resolveAgentComputeProvider(
  store: AgentComputeStore,
  agentId: string,
  activeProvider: ActiveTextProvider,
): { provider: TextProvider | null; source: "override" | "default" | "active" } {
  const override = store.overrides[agentId];
  if (override) return { provider: override, source: "override" };
  if (store.defaultProvider !== "active") return { provider: store.defaultProvider, source: "default" };
  return {
    provider: isTextProvider(activeProvider) ? activeProvider : null,
    source: "active",
  };
}
