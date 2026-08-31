import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AutonomousGuestAuthority } from "../../../core/auth/autonomous-guest/guest-authority";
import { persistentHome } from "../../local-credentials";

const FORMAT = "plotpickle-autonomous-guest-mastra-schedules";
const VERSION = 1 as const;
const MAX_BYTES = 2 * 1024 * 1024;
export const MAX_AUTONOMOUS_GUEST_SCHEDULES = 256;
export const MAX_AUTONOMOUS_GUEST_SCHEDULE_TRIGGERS = 2048;

type ScheduleFileEnvelope = Readonly<{
  format: typeof FORMAT;
  version: typeof VERSION;
  workspaceId: string;
  autonomousRunId: string;
  savedAt: string;
  schedules: readonly unknown[];
  triggers: readonly unknown[];
}>;

export type AutonomousGuestScheduleFileState = {
  schedules: unknown[];
  triggers: unknown[];
};

const mutations = new Map<string, Promise<void>>();

function assertAuthority(authority: AutonomousGuestAuthority) {
  if (
    authority.authorityClass !== "delegated-guest-autonomous-operator" ||
    authority.delegated !== true ||
    authority.humanProfileId !== "" ||
    !/^guest-auto-[a-f0-9]{24}$/i.test(authority.workspaceId)
  ) {
    throw new Error("Autonomous Guest schedule file state requires delegated non-Human authority.");
  }
}

function scheduleDirectory(authority: AutonomousGuestAuthority) {
  assertAuthority(authority);
  return path.join(persistentHome(), "autonomous-guest", authority.workspaceId);
}

function scheduleStatePath(authority: AutonomousGuestAuthority) {
  return path.join(scheduleDirectory(authority), "mastra-schedules.json");
}

export async function readAutonomousGuestScheduleFileState(authority: AutonomousGuestAuthority): Promise<AutonomousGuestScheduleFileState> {
  assertAuthority(authority);
  try {
    const source = await readFile(scheduleStatePath(authority), "utf8");
    if (Buffer.byteLength(source, "utf8") > MAX_BYTES) {
      throw new Error("Autonomous Guest Mastra schedule storage exceeds its bounded size.");
    }
    const parsed: unknown = JSON.parse(source);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Autonomous Guest Mastra schedule storage is invalid.");
    }
    const envelope = parsed as Partial<ScheduleFileEnvelope>;
    if (
      envelope.format !== FORMAT ||
      envelope.version !== VERSION ||
      envelope.workspaceId !== authority.workspaceId ||
      envelope.autonomousRunId !== authority.autonomousRunId ||
      !Array.isArray(envelope.schedules) ||
      !Array.isArray(envelope.triggers)
    ) {
      throw new Error("Autonomous Guest Mastra schedule storage does not match this Guest namespace.");
    }
    if (envelope.schedules.length > MAX_AUTONOMOUS_GUEST_SCHEDULES || envelope.triggers.length > MAX_AUTONOMOUS_GUEST_SCHEDULE_TRIGGERS) {
      throw new Error("Autonomous Guest Mastra schedule storage exceeds its bounded record count.");
    }
    return { schedules: [...envelope.schedules], triggers: [...envelope.triggers] };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { schedules: [], triggers: [] };
    throw error;
  }
}

async function writeAutonomousGuestScheduleFileState(authority: AutonomousGuestAuthority, state: AutonomousGuestScheduleFileState) {
  if (state.schedules.length > MAX_AUTONOMOUS_GUEST_SCHEDULES || state.triggers.length > MAX_AUTONOMOUS_GUEST_SCHEDULE_TRIGGERS) {
    throw new Error("Autonomous Guest Mastra schedule storage exceeds its bounded record count.");
  }
  const directory = scheduleDirectory(authority);
  const target = scheduleStatePath(authority);
  const source = `${JSON.stringify({
    format: FORMAT,
    version: VERSION,
    workspaceId: authority.workspaceId,
    autonomousRunId: authority.autonomousRunId,
    savedAt: new Date().toISOString(),
    schedules: state.schedules,
    triggers: state.triggers,
  } satisfies ScheduleFileEnvelope, null, 2)}\n`;
  if (Buffer.byteLength(source, "utf8") > MAX_BYTES) {
    throw new Error("Autonomous Guest Mastra schedule storage exceeds its bounded size.");
  }
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, source, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, target);
}

export function mutateAutonomousGuestScheduleFileState<T>(
  authority: AutonomousGuestAuthority,
  operation: (state: AutonomousGuestScheduleFileState) => Promise<T> | T,
): Promise<T> {
  assertAuthority(authority);
  const key = `${authority.workspaceId}:${authority.autonomousRunId}`;
  const prior = mutations.get(key) ?? Promise.resolve();
  const result = prior.then(async () => {
    const state = await readAutonomousGuestScheduleFileState(authority);
    const value = await operation(state);
    await writeAutonomousGuestScheduleFileState(authority, state);
    return value;
  });
  mutations.set(key, result.then(() => undefined, () => undefined));
  return result;
}
