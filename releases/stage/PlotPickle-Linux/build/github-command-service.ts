import { randomUUID } from "node:crypto";
import { chmod, mkdir, open, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import {
  cancelGitHubCommand,
  classifyGitHubCommandFailure,
  emptyGitHubCommandOutbox,
  enqueueGitHubCommand,
  markGitHubCommandCompleted,
  markGitHubCommandSending,
  normalizeGitHubCommandOutbox,
  publicGitHubCommandEntry,
  recordGitHubCommandFailure,
  recoverInterruptedGitHubCommands,
  retryGitHubCommand,
  type GitHubCommandDraft,
  type GitHubCommandEntry,
  type GitHubCommandOutbox,
  type PublicGitHubCommandEntry,
} from "../lib/github-command-outbox";
import { persistentHome } from "./local-credentials";

export const GITHUB_COMMAND_OUTBOX_DIRECTORY = "github";
export const GITHUB_COMMAND_OUTBOX_FILE = "outbox.json";

export type GitHubCommandExecutionContext = {
  command: GitHubCommandEntry;
  idempotencyKey: string;
};

export type GitHubCommandRunResult<T> =
  | {
      ok: true;
      status: "completed";
      deduplicated: boolean;
      command: PublicGitHubCommandEntry;
      result: T | null;
    }
  | {
      ok: false;
      status: "active" | "blocked" | "failed";
      command: PublicGitHubCommandEntry;
      failure: ReturnType<typeof classifyGitHubCommandFailure> | null;
    };

type GitHubCommandClaim =
  | { status: "completed"; entry: GitHubCommandEntry }
  | { status: "active"; entry: GitHubCommandEntry }
  | { status: "blocked"; entry: GitHubCommandEntry }
  | { status: "claimed"; entry: GitHubCommandEntry };

let mutationTail: Promise<void> = Promise.resolve();

export function githubCommandOutboxDirectory() {
  return path.join(persistentHome(), GITHUB_COMMAND_OUTBOX_DIRECTORY);
}

export function githubCommandOutboxFilePath() {
  return path.join(githubCommandOutboxDirectory(), GITHUB_COMMAND_OUTBOX_FILE);
}

async function atomicWriteOutbox(outbox: GitHubCommandOutbox) {
  const filePath = githubCommandOutboxFilePath();
  await mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  const temporary = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  try {
    const handle = await open(temporary, "w", 0o600);
    try {
      await handle.writeFile(`${JSON.stringify(outbox, null, 2)}\n`, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporary, filePath);
    try { await chmod(filePath, 0o600); } catch { /* Windows uses current-account ACLs. */ }
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
}

export async function readGitHubCommandOutbox(nowValue = new Date().toISOString()) {
  try {
    const source = await readFile(githubCommandOutboxFilePath(), "utf8");
    return recoverInterruptedGitHubCommands(normalizeGitHubCommandOutbox(JSON.parse(source), nowValue), nowValue).outbox;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyGitHubCommandOutbox(nowValue);
    throw error;
  }
}

async function mutateGitHubCommandOutbox<T>(mutation: (outbox: GitHubCommandOutbox) => Promise<{ outbox: GitHubCommandOutbox; result: T }> | { outbox: GitHubCommandOutbox; result: T }) {
  const run = mutationTail.then(async () => {
    const current = await readGitHubCommandOutbox();
    const changed = await mutation(current);
    await atomicWriteOutbox(changed.outbox);
    return changed.result;
  });
  mutationTail = run.then(() => undefined, () => undefined);
  return run;
}

export async function enqueuePersistentGitHubCommand(command: GitHubCommandDraft, nowValue = new Date().toISOString()) {
  return mutateGitHubCommandOutbox((outbox) => {
    const queued = enqueueGitHubCommand(outbox, command, nowValue);
    return { outbox: queued.outbox, result: { ...queued, entry: publicGitHubCommandEntry(queued.entry) } };
  });
}

export async function beginPersistentGitHubCommand(id: string, nowValue = new Date().toISOString()) {
  return mutateGitHubCommandOutbox((outbox) => {
    const changed = markGitHubCommandSending(outbox, id, nowValue);
    return { outbox: changed.outbox, result: publicGitHubCommandEntry(changed.entry) };
  });
}

export async function completePersistentGitHubCommand(id: string, nowValue = new Date().toISOString()) {
  return mutateGitHubCommandOutbox((outbox) => {
    const changed = markGitHubCommandCompleted(outbox, id, nowValue);
    return { outbox: changed.outbox, result: publicGitHubCommandEntry(changed.entry) };
  });
}

export async function failPersistentGitHubCommand(id: string, failure: unknown, nowValue = new Date().toISOString()) {
  return mutateGitHubCommandOutbox((outbox) => {
    const changed = recordGitHubCommandFailure(outbox, id, failure, nowValue);
    return { outbox: changed.outbox, result: publicGitHubCommandEntry(changed.entry) };
  });
}

export async function retryPersistentGitHubCommand(
  id: string,
  nowValue = new Date().toISOString(),
  options: { authenticationReady?: boolean } = {},
) {
  return mutateGitHubCommandOutbox((outbox) => {
    const changed = retryGitHubCommand(outbox, id, nowValue, options);
    return { outbox: changed.outbox, result: publicGitHubCommandEntry(changed.entry) };
  });
}

export async function cancelPersistentGitHubCommand(id: string, nowValue = new Date().toISOString()) {
  return mutateGitHubCommandOutbox((outbox) => {
    const changed = cancelGitHubCommand(outbox, id, nowValue);
    return { outbox: changed.outbox, result: publicGitHubCommandEntry(changed.entry) };
  });
}

function failureFromError(error: unknown) {
  if (!error || typeof error !== "object") return { status: 0, message: String(error || "GitHub command failed.") };
  const item = error as { status?: unknown; message?: unknown; retryAfterMs?: unknown };
  return {
    status: Number(item.status) || 0,
    message: typeof item.message === "string" ? item.message : "GitHub command failed.",
    retryAfterMs: Number(item.retryAfterMs) || 0,
  };
}

async function claimPersistentGitHubCommand(commandValue: GitHubCommandDraft) {
  return mutateGitHubCommandOutbox<GitHubCommandClaim>((outbox) => {
    const recovered = recoverInterruptedGitHubCommands(outbox);
    const queued = enqueueGitHubCommand(recovered.outbox, commandValue);
    const current = queued.entry;
    if (!queued.created) {
      if (current.state === "completed") return { outbox: queued.outbox, result: { status: "completed" as const, entry: current } };
      if (current.state === "sending") return { outbox: queued.outbox, result: { status: "active" as const, entry: current } };
      if (["needs-authentication", "needs-review", "cancelled"].includes(current.state)) {
        return { outbox: queued.outbox, result: { status: "blocked" as const, entry: current } };
      }
    }
    const sending = markGitHubCommandSending(queued.outbox, current.id);
    return { outbox: sending.outbox, result: { status: "claimed" as const, entry: sending.entry } };
  });
}

export async function runGitHubCommand<T>(
  commandValue: GitHubCommandDraft,
  executor: (context: GitHubCommandExecutionContext) => Promise<T>,
): Promise<GitHubCommandRunResult<T>> {
  const claimed = await claimPersistentGitHubCommand(commandValue);
  if (claimed.status === "completed") {
    return { ok: true, status: "completed", deduplicated: true, command: publicGitHubCommandEntry(claimed.entry), result: null };
  }
  if (claimed.status === "active") {
    return { ok: false, status: "active", command: publicGitHubCommandEntry(claimed.entry), failure: null };
  }
  if (claimed.status === "blocked") {
    return { ok: false, status: "blocked", command: publicGitHubCommandEntry(claimed.entry), failure: null };
  }

  const full = claimed.entry;
  try {
    const result = await executor({ command: full, idempotencyKey: full.idempotencyKey });
    const completed = await completePersistentGitHubCommand(full.id);
    return { ok: true, status: "completed", deduplicated: false, command: completed, result };
  } catch (error) {
    const failure = classifyGitHubCommandFailure(failureFromError(error));
    const failed = await failPersistentGitHubCommand(full.id, failure);
    return { ok: false, status: "failed", command: failed, failure };
  }
}
