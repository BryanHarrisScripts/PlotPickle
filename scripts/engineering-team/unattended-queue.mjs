#!/usr/bin/env node
// Fail-closed unattended queue supervisor foundation. It never executes issue prose.
import { readFile, writeFile, mkdir, open } from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const sha = /^[a-f0-9]{40}$/;
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const root = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), ".local", "share"), "PlotPickle", "engineering-team", "queue");
const digest = x => createHash("sha256").update(x).digest("hex");
const valid = x => x && typeof x === "object" && Number.isSafeInteger(x.issue) && x.issue > 0
  && sha.test(x.head) && x.approved === true && x.sourceMutationGrant === true
  && x.providerGrant === true && x.localExecutionGrant === true
  && x.mergeGrant === true && typeof x.grantRef === "string" && /^[a-z0-9-]{8,80}$/.test(x.grantRef);
export function admitQueueTicket(ticket) {
  if (!valid(ticket)) return Object.freeze({ admitted: false, reason: "EXPLICIT_GRANTS_REQUIRED" });
  return Object.freeze({ admitted: true, issue: ticket.issue, head: ticket.head, grantRef: ticket.grantRef });
}
export async function inspectQueue({ read = readFile, queuePath = path.join(root, "approved.json") } = {}) {
  let tickets;
  try { tickets = JSON.parse(await read(queuePath, "utf8")); } catch { return Object.freeze({ state: "WAITING_FOR_APPROVED_QUEUE", eligible: 0 }); }
  if (!Array.isArray(tickets) || tickets.length > 100) return Object.freeze({ state: "BLOCKED_INVALID_QUEUE", eligible: 0 });
  const admitted = tickets.map(admitQueueTicket).filter(x => x.admitted);
  const unique = new Set(admitted.map(x => x.issue));
  if (unique.size !== admitted.length) return Object.freeze({ state: "BLOCKED_DUPLICATE_ISSUE", eligible: 0 });
  return Object.freeze({ state: admitted.length ? "ADMITTED_NOT_EXECUTED" : "WAITING_FOR_APPROVED_QUEUE", eligible: admitted.length,
    nextIssue: admitted[0]?.issue ?? null, queueDigest: digest(JSON.stringify(tickets)) });
}
export async function runSupervisorOnce(options = {}) {
  const status = await inspectQueue(options);
  // This first slice is deliberately observational: no shell, agent or paid dispatch.
  if (options.writeStatus !== false) {
    await mkdir(root, { recursive: true });
    const file = path.join(root, "status.json");
    await writeFile(file, JSON.stringify({ ...status, checkedAt: new Date().toISOString(),
      workerExecutionProven: false, autonomousPrLifecycleProven: false }) + "\n", { mode: 0o600 });
  }
  return status;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3 || process.argv[2] !== "--inspect-once") {
    process.stderr.write("Usage: node scripts/engineering-team/unattended-queue.mjs --inspect-once\n");
    process.exitCode = 2;
  } else {
    runSupervisorOnce().then(x => process.stdout.write(JSON.stringify(x) + "\n"),
      () => { process.stderr.write("QUEUE_INSPECTION_FAILED\n"); process.exitCode = 1; });
  }
}
