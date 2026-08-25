import { readFile } from "node:fs/promises";
import path from "node:path";
import { normalizeBuzzAgentIdentityBindings } from "../core/story-workflow/buzz/agent-identity-binding.mjs";

const LOCAL_BINDING_FILE = path.join(".plotpickle", "operator", "buzz-agent-public-identities.json");

export async function loadLocalBuzzAgentIdentityBindings(root = process.cwd()) {
  const raw = await readFile(path.join(root, LOCAL_BINDING_FILE), "utf8").catch(() => "");
  if (!raw) return {};
  try {
    const document = JSON.parse(raw) as { schemaVersion?: unknown; bindings?: unknown };
    if (document.schemaVersion !== 1) return {};
    return normalizeBuzzAgentIdentityBindings(document.bindings);
  } catch {
    return {};
  }
}
