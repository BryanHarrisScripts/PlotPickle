import { mkdir, open, readFile, readdir, rename } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { CreativeTransactionStore } from "../lib/creative-transactions/local-creative-transaction-provider";
import type { CreativeTransactionRecord } from "../lib/creative-transactions/creative-transaction-contract";

const SAFE_ID = /^[a-z0-9][a-z0-9._-]{0,219}$/i;

function persistentHome() {
  if (process.env.PLOTPICKLE_HOME) return path.resolve(process.env.PLOTPICKLE_HOME);
  if (process.env.LOCALAPPDATA) return path.join(process.env.LOCALAPPDATA, "PlotPickle");
  return path.join(os.homedir(), ".plotpickle");
}

function transactionsRoot() {
  return path.join(persistentHome(), "creative-transactions");
}

function safeTransactionId(value: string) {
  if (!SAFE_ID.test(value)) throw new Error("Choose a valid Creative Transaction ID.");
  return value;
}

function transactionFile(transactionId: string) {
  return path.join(transactionsRoot(), `${safeTransactionId(transactionId)}.json`);
}

function isTransactionRecord(value: unknown): value is CreativeTransactionRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Partial<CreativeTransactionRecord>;
  return record.version === 1
    && typeof record.transactionId === "string"
    && typeof record.providerId === "string"
    && typeof record.state === "string"
    && Boolean(record.changeSet && typeof record.changeSet === "object");
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

async function readRecord(file: string) {
  try {
    const value = JSON.parse(await readFile(file, "utf8")) as unknown;
    if (!isTransactionRecord(value)) throw new Error("Creative Transaction record is malformed.");
    return value;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export function fileCreativeTransactionStore(): CreativeTransactionStore {
  return {
    async load(transactionId) {
      return readRecord(transactionFile(transactionId));
    },

    async save(record) {
      safeTransactionId(record.transactionId);
      await atomicJson(transactionFile(record.transactionId), record);
    },

    async list(projectId) {
      await mkdir(transactionsRoot(), { recursive: true, mode: 0o700 });
      const names = (await readdir(transactionsRoot()))
        .filter((name) => name.endsWith(".json"))
        .sort();
      const records = await Promise.all(names.map((name) => readRecord(path.join(transactionsRoot(), name))));
      return records
        .filter((record): record is CreativeTransactionRecord => Boolean(record))
        .filter((record) => !projectId || record.changeSet.projectId === projectId)
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    },
  };
}

export const LOCAL_CREATIVE_TRANSACTION_STORAGE = {
  rootName: "creative-transactions",
  networkRequired: false,
  atomicReplacement: true,
  canonicalAuthority: false,
} as const;
