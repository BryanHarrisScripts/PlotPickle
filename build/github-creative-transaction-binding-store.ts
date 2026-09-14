import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import type {
  GitHubCreativeTransactionBinding,
  GitHubCreativeTransactionBindingStore,
} from "../lib/integrations/github/github-creative-transaction-provider";
import { persistentHome } from "./local-credentials";

const SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,219}$/i;

function safeTransactionId(value: string) {
  if (!SAFE_ID.test(value)) throw new Error("Choose a valid GitHub Creative Transaction ID.");
  return value;
}

function bindingsRoot() {
  return path.join(persistentHome(), "creative-transactions", "github-bindings");
}

function bindingFile(transactionId: string) {
  return path.join(bindingsRoot(), `${safeTransactionId(transactionId)}.json`);
}

function isBinding(value: unknown): value is GitHubCreativeTransactionBinding {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const binding = value as Partial<GitHubCreativeTransactionBinding>;
  return binding.version === 1
    && typeof binding.transactionId === "string"
    && typeof binding.changeSetFingerprint === "string"
    && Number.isInteger(binding.proposalNumber)
    && Number(binding.proposalNumber) > 0
    && typeof binding.baseRevision === "string"
    && typeof binding.headRevision === "string";
}

async function atomicJson(file: string, value: unknown) {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  const handle = await open(temporary, "w", 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temporary, file);
}

export function fileGitHubCreativeTransactionBindingStore(): GitHubCreativeTransactionBindingStore {
  return {
    async load(transactionId) {
      try {
        const value = JSON.parse(await readFile(bindingFile(transactionId), "utf8")) as unknown;
        if (!isBinding(value)) throw new Error("GitHub Creative Transaction binding is malformed.");
        return value;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw error;
      }
    },

    async save(binding) {
      safeTransactionId(binding.transactionId);
      await atomicJson(bindingFile(binding.transactionId), binding);
    },

    async remove(transactionId) {
      await rm(bindingFile(transactionId), { force: true });
    },
  };
}

export const GITHUB_CREATIVE_TRANSACTION_BINDING_STORAGE = {
  root: "creative-transactions/github-bindings",
  containsCredentials: false,
  canonicalAuthority: false,
  networkRequired: false,
  atomicReplacement: true,
} as const;
