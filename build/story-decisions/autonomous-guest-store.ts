import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AutonomousGuestAuthority } from "../../core/auth/autonomous-guest/guest-authority";
import { persistentHome } from "../local-credentials";

const FORMAT = "plotpickle-autonomous-guest-story-decisions";
const VERSION = 1 as const;
const MAX_BYTES = 512 * 1024;

function workspaceDirectory(authority: AutonomousGuestAuthority) {
  if (authority.authorityClass !== "delegated-guest-autonomous-operator" || authority.delegated !== true || authority.humanProfileId !== "") {
    throw new Error("Autonomous Guest Story Decision storage requires delegated non-Human authority.");
  }
  if (!/^guest-auto-[a-f0-9]{24}$/i.test(authority.workspaceId)) {
    throw new Error("Autonomous Guest Story Decision workspace identity is invalid.");
  }
  return path.join(persistentHome(), "autonomous-guest", authority.workspaceId);
}

function storePath(authority: AutonomousGuestAuthority) {
  return path.join(workspaceDirectory(authority), "story-decisions.json");
}

export async function readAutonomousGuestDecisionStore(authority: AutonomousGuestAuthority): Promise<unknown | null> {
  try {
    const source = await readFile(storePath(authority), "utf8");
    if (Buffer.byteLength(source, "utf8") > MAX_BYTES) throw new Error("Autonomous Guest Story Decision store is unexpectedly large.");
    const parsed: unknown = JSON.parse(source);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Autonomous Guest Story Decision store is invalid.");
    const envelope = parsed as { readonly format?: unknown; readonly version?: unknown; readonly workspaceId?: unknown; readonly value?: unknown };
    if (envelope.format !== FORMAT || envelope.version !== VERSION || envelope.workspaceId !== authority.workspaceId) {
      throw new Error("Autonomous Guest Story Decision store does not match this workspace.");
    }
    return envelope.value ?? null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function writeAutonomousGuestDecisionStore(authority: AutonomousGuestAuthority, value: unknown) {
  const directory = workspaceDirectory(authority);
  const target = storePath(authority);
  const source = `${JSON.stringify({
    format: FORMAT,
    version: VERSION,
    workspaceId: authority.workspaceId,
    autonomousRunId: authority.autonomousRunId,
    operatorId: authority.operatorId,
    savedAt: new Date().toISOString(),
    value,
  }, null, 2)}\n`;
  if (Buffer.byteLength(source, "utf8") > MAX_BYTES) throw new Error("Autonomous Guest Story Decision store exceeds its bounded size.");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, source, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, target);
}
