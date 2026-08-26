import { readFile } from "node:fs/promises";
import path from "node:path";
import { normalizeBuzzAgentIdentityBindings } from "../core/story-workflow/buzz/agent-identity-binding.mjs";

const LOCAL_BINDING_FILE = path.join(".plotpickle", "operator", "buzz-agent-public-identities.json");
const RUNTIME_BINDING_KEY = "__PLOTPICKLE_BUZZ_AGENT_IDENTITIES_RUNTIME__";

type RuntimeBindingGlobal = typeof globalThis & {
  [RUNTIME_BINDING_KEY]?: Readonly<Record<string, string>>;
};

function publishRuntimeBindings(bindings: Readonly<Record<string, string>>) {
  (globalThis as RuntimeBindingGlobal)[RUNTIME_BINDING_KEY] = bindings;
  return bindings;
}

export async function loadLocalBuzzAgentIdentityBindings(root = process.cwd()) {
  const raw = await readFile(path.join(root, LOCAL_BINDING_FILE), "utf8").catch(() => "");
  if (!raw) return publishRuntimeBindings({});
  try {
    const document = JSON.parse(raw) as { schemaVersion?: unknown; bindings?: unknown };
    if (document.schemaVersion !== 1) return publishRuntimeBindings({});
    return publishRuntimeBindings(normalizeBuzzAgentIdentityBindings(document.bindings));
  } catch {
    return publishRuntimeBindings({});
  }
}
