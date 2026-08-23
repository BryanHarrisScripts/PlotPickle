import { generateKeyPairSync, randomBytes } from "node:crypto";
import { readCredentialJson, writeCredentialJson } from "./local-credentials";

const FILE = "studio-identity.json";
const SUFFIX = "PlotPickle Studio";
export const STUDIO_RENAME_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

type Rename = { prefix: string; displayName: string; changedAt: string };
export type StudioIdentity = {
  version: 1; studioId: string; prefix: string; displayName: string; shortCode: string;
  createdAt: string; renamedAt: string; renameHistory: Rename[];
  signing: { algorithm: "Ed25519"; publicKeyPem: string; privateKeyPem: string };
};

function code(length = 8) {
  const bytes = randomBytes(length);
  return Array.from(bytes, (byte) => ALPHABET[byte % ALPHABET.length]).join("");
}

export function normalizeStudioPrefix(value: unknown) {
  const prefix = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (!prefix) throw new Error("Enter a Studio name prefix.");
  if (prefix.length > 60) throw new Error("Keep the Studio name prefix to 60 characters or fewer.");
  if (/[\u0000-\u001F\u007F]/.test(prefix)) throw new Error("The Studio name prefix contains unsupported control characters.");
  if (prefix.toLowerCase().includes(SUFFIX.toLowerCase())) throw new Error(`Enter only the prefix. PlotPickle adds “${SUFFIX}” automatically.`);
  return prefix;
}

export const studioDisplayName = (prefix: string) => `${prefix} ${SUFFIX}`;

function valid(value: unknown): value is StudioIdentity {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Partial<StudioIdentity>;
  return item.version === 1 && /^pp_studio_[2-9A-HJ-NP-Z]{8}$/.test(item.studioId || "")
    && typeof item.prefix === "string" && typeof item.displayName === "string" && typeof item.shortCode === "string"
    && typeof item.createdAt === "string" && typeof item.renamedAt === "string" && Array.isArray(item.renameHistory)
    && item.signing?.algorithm === "Ed25519" && typeof item.signing.publicKeyPem === "string" && typeof item.signing.privateKeyPem === "string";
}

function publicIdentity(identity: StudioIdentity, now = new Date()) {
  const renamed = identity.renamedAt ? new Date(identity.renamedAt).getTime() : 0;
  const next = renamed ? new Date(renamed + STUDIO_RENAME_COOLDOWN_MS) : null;
  return {
    configured: true as const, studioId: identity.studioId, prefix: identity.prefix, displayName: identity.displayName,
    shortCode: identity.shortCode, createdAt: identity.createdAt, renamedAt: identity.renamedAt,
    nextRenameAt: next?.toISOString() || "", canRename: !next || next <= now, renameHistory: identity.renameHistory,
    signing: { algorithm: identity.signing.algorithm, publicKeyPem: identity.signing.publicKeyPem },
  };
}

export async function readStudioIdentity() {
  const value = await readCredentialJson<unknown>(FILE);
  return valid(value) ? value : null;
}

export async function readPublicStudioIdentity(now = new Date()) {
  const identity = await readStudioIdentity();
  return identity ? publicIdentity(identity, now) : { configured: false as const };
}

export async function createStudioIdentity(value: unknown, now = new Date()) {
  const existing = await readStudioIdentity();
  if (existing) return publicIdentity(existing, now);
  const prefix = normalizeStudioPrefix(value);
  const idCode = code();
  const pair = generateKeyPairSync("ed25519");
  const identity: StudioIdentity = {
    version: 1, studioId: `pp_studio_${idCode}`, prefix, displayName: studioDisplayName(prefix), shortCode: idCode.slice(0, 4),
    createdAt: now.toISOString(), renamedAt: "", renameHistory: [],
    signing: {
      algorithm: "Ed25519",
      publicKeyPem: pair.publicKey.export({ type: "spki", format: "pem" }).toString(),
      privateKeyPem: pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    },
  };
  await writeCredentialJson(FILE, identity);
  return publicIdentity(identity, now);
}

export async function renameStudioIdentity(value: unknown, now = new Date()) {
  const identity = await readStudioIdentity();
  if (!identity) throw new Error("Create this PlotPickle Studio identity before renaming it.");
  const prefix = normalizeStudioPrefix(value);
  if (prefix === identity.prefix) return publicIdentity(identity, now);
  const state = publicIdentity(identity, now);
  if (!state.canRename) throw new Error(`This Studio can be renamed again after ${state.nextRenameAt}.`);
  identity.renameHistory.push({ prefix: identity.prefix, displayName: identity.displayName, changedAt: now.toISOString() });
  identity.prefix = prefix; identity.displayName = studioDisplayName(prefix); identity.renamedAt = now.toISOString();
  await writeCredentialJson(FILE, identity);
  return publicIdentity(identity, now);
}

export async function readStudioSigningIdentity() {
  const identity = await readStudioIdentity();
  return identity ? { studioId: identity.studioId, ...identity.signing } : null;
}

export const STUDIO_IDENTITY_SUFFIX = SUFFIX;
