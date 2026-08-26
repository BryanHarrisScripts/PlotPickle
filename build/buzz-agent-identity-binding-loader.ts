import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizeBuzzAgentIdentityBindings } from "../core/story-workflow/buzz/agent-identity-binding.mjs";

const LOCAL_BINDING_FILE = path.join(".plotpickle", "operator", "buzz-agent-public-identities.json");
const RUNTIME_BINDING_KEY = "__PLOTPICKLE_BUZZ_AGENT_IDENTITIES_RUNTIME__";
const NOSTR_PUBLIC_KEY = /^[a-f0-9]{64}$/i;

type RuntimeBindingGlobal = typeof globalThis & {
  [RUNTIME_BINDING_KEY]?: Readonly<Record<string, string>>;
};

type LocalBindingDocument = {
  schemaVersion?: unknown;
  communityId?: unknown;
  relayUrl?: unknown;
  verifiedAt?: unknown;
  bindings?: unknown;
};

function publishRuntimeBindings(bindings: Readonly<Record<string, string>>) {
  (globalThis as RuntimeBindingGlobal)[RUNTIME_BINDING_KEY] = bindings;
  return bindings;
}

async function readLocalBindingDocument(root: string) {
  const raw = await readFile(path.join(root, LOCAL_BINDING_FILE), "utf8").catch(() => "");
  if (!raw) return {} as LocalBindingDocument;
  try {
    const document = JSON.parse(raw) as LocalBindingDocument;
    return document.schemaVersion === 1 ? document : {};
  } catch {
    return {};
  }
}

export async function loadLocalBuzzAgentIdentityBindings(root = process.cwd()) {
  const document = await readLocalBindingDocument(root);
  return publishRuntimeBindings(normalizeBuzzAgentIdentityBindings(document.bindings));
}

export async function saveLocalBuzzAgentIdentityBinding(
  profileId: string,
  pubkey: string,
  root = process.cwd(),
) {
  const normalizedProfileId = profileId.trim();
  const normalizedPubkey = pubkey.trim().toLowerCase();
  if (!normalizedProfileId) throw new Error("A PlotPickle Agent Profile is required.");
  if (normalizedPubkey && !NOSTR_PUBLIC_KEY.test(normalizedPubkey)) {
    throw new Error("BUZZ public keys must be exactly 64 hexadecimal characters.");
  }

  const document = await readLocalBindingDocument(root);
  const next = { ...normalizeBuzzAgentIdentityBindings(document.bindings) };
  if (normalizedPubkey) next[normalizedProfileId] = normalizedPubkey;
  else delete next[normalizedProfileId];
  const bindings = normalizeBuzzAgentIdentityBindings(next);

  const output: Record<string, unknown> = { schemaVersion: 1 };
  if (typeof document.communityId === "string" && document.communityId.trim()) output.communityId = document.communityId;
  if (typeof document.relayUrl === "string" && document.relayUrl.trim()) output.relayUrl = document.relayUrl;
  if (typeof document.verifiedAt === "string" && document.verifiedAt.trim()) output.verifiedAt = document.verifiedAt;
  output.bindings = bindings;

  const target = path.join(root, LOCAL_BINDING_FILE);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  return publishRuntimeBindings(bindings);
}
