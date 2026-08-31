import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  MastraCompositeStore,
  SchedulesStorage,
  normalizeScheduleTarget,
  type Schedule,
  type ScheduleFilter,
  type ScheduleTrigger,
  type ScheduleTriggerListOptions,
  type ScheduleUpdate,
} from "@mastra/core/storage";
import type { AutonomousGuestAuthority } from "../../core/auth/autonomous-guest/guest-authority";
import { persistentHome } from "../local-credentials";
import { AUTONOMOUS_GUEST_WAKE_WORKFLOW_ID } from "./mastra-task-scheduler";

const FORMAT = "plotpickle-autonomous-guest-mastra-schedules";
const VERSION = 1 as const;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_SCHEDULES = 256;
const MAX_TRIGGERS = 2048;
const SAFE_SCHEDULE_ID = /^[a-z0-9][a-z0-9._:-]{2,511}$/i;
const SAFE_TASK_ID = /^guest-task-[a-f0-9-]{36}$/i;

type ScheduleEnvelope = Readonly<{
  format: typeof FORMAT;
  version: typeof VERSION;
  workspaceId: string;
  autonomousRunId: string;
  savedAt: string;
  schedules: readonly Schedule[];
  triggers: readonly ScheduleTrigger[];
}>;

type WakePayload = Readonly<{
  taskId: string;
  autonomousRunId: string;
  guestWorkspaceId: string;
}>;

type MutableScheduleState = {
  schedules: Schedule[];
  triggers: ScheduleTrigger[];
};

function assertAuthority(authority: AutonomousGuestAuthority) {
  if (
    authority.authorityClass !== "delegated-guest-autonomous-operator" ||
    authority.delegated !== true ||
    authority.humanProfileId !== "" ||
    !/^guest-auto-[a-f0-9]{24}$/i.test(authority.workspaceId)
  ) {
    throw new Error("Autonomous Guest Mastra schedule storage requires delegated non-Human authority.");
  }
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function scheduleDirectory(authority: AutonomousGuestAuthority) {
  assertAuthority(authority);
  return path.join(persistentHome(), "autonomous-guest", authority.workspaceId);
}

function scheduleStatePath(authority: AutonomousGuestAuthority) {
  return path.join(scheduleDirectory(authority), "mastra-schedules.json");
}

function wakePayload(target: Schedule["target"]): WakePayload {
  if (target.type !== "workflow" || target.workflowId !== AUTONOMOUS_GUEST_WAKE_WORKFLOW_ID) {
    throw new Error("Autonomous Guest schedule storage accepts only the PlotPickle wake workflow.");
  }
  const payload = target.inputData;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Autonomous Guest schedule wake payload is invalid.");
  }
  const candidate = payload as Partial<WakePayload>;
  if (!SAFE_TASK_ID.test(String(candidate.taskId || ""))) {
    throw new Error("Autonomous Guest schedule wake task ID is invalid.");
  }
  return Object.freeze({
    taskId: String(candidate.taskId),
    autonomousRunId: String(candidate.autonomousRunId || ""),
    guestWorkspaceId: String(candidate.guestWorkspaceId || ""),
  });
}

function validateSchedule(authority: AutonomousGuestAuthority, value: Schedule): Schedule {
  const schedule = cloneJson(value);
  schedule.target = normalizeScheduleTarget(schedule.target);
  if (!SAFE_SCHEDULE_ID.test(schedule.id) || !schedule.id.startsWith(`plotpickle-guest-wake-${authority.workspaceId}-`)) {
    throw new Error("Autonomous Guest schedule ID is outside this Guest namespace.");
  }
  const payload = wakePayload(schedule.target);
  if (payload.autonomousRunId !== authority.autonomousRunId || payload.guestWorkspaceId !== authority.workspaceId) {
    throw new Error("Autonomous Guest schedule payload is outside this Guest namespace.");
  }
  if (schedule.status !== "active" && schedule.status !== "paused") {
    throw new Error("Autonomous Guest schedule status is invalid.");
  }
  if (!String(schedule.cron || "").trim() || schedule.cron.length > 160) {
    throw new Error("Autonomous Guest schedule cron is invalid.");
  }
  if (schedule.timezone && schedule.timezone.length > 100) {
    throw new Error("Autonomous Guest schedule timezone is invalid.");
  }
  for (const number of [schedule.nextFireAt, schedule.createdAt, schedule.updatedAt]) {
    if (!Number.isFinite(number) || number < 0) throw new Error("Autonomous Guest schedule timestamp is invalid.");
  }
  return schedule;
}

function validateTrigger(authority: AutonomousGuestAuthority, value: ScheduleTrigger) {
  const trigger = cloneJson(value);
  if (!SAFE_SCHEDULE_ID.test(trigger.scheduleId) || !trigger.scheduleId.startsWith(`plotpickle-guest-wake-${authority.workspaceId}-`)) {
    throw new Error("Autonomous Guest schedule trigger is outside this Guest namespace.");
  }
  if (!Number.isFinite(trigger.scheduledFireAt) || !Number.isFinite(trigger.actualFireAt)) {
    throw new Error("Autonomous Guest schedule trigger timestamp is invalid.");
  }
  return trigger;
}

export class AutonomousGuestFileSchedulesStorage extends SchedulesStorage {
  private mutation: Promise<void> = Promise.resolve();

  constructor(private readonly authority: AutonomousGuestAuthority) {
    super();
    assertAuthority(authority);
  }

  private async readState(): Promise<MutableScheduleState> {
    try {
      const source = await readFile(scheduleStatePath(this.authority), "utf8");
      if (Buffer.byteLength(source, "utf8") > MAX_BYTES) {
        throw new Error("Autonomous Guest Mastra schedule storage exceeds its bounded size.");
      }
      const parsed: unknown = JSON.parse(source);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Autonomous Guest Mastra schedule storage is invalid.");
      }
      const envelope = parsed as Partial<ScheduleEnvelope>;
      if (
        envelope.format !== FORMAT ||
        envelope.version !== VERSION ||
        envelope.workspaceId !== this.authority.workspaceId ||
        envelope.autonomousRunId !== this.authority.autonomousRunId ||
        !Array.isArray(envelope.schedules) ||
        !Array.isArray(envelope.triggers)
      ) {
        throw new Error("Autonomous Guest Mastra schedule storage does not match this Guest namespace.");
      }
      if (envelope.schedules.length > MAX_SCHEDULES || envelope.triggers.length > MAX_TRIGGERS) {
        throw new Error("Autonomous Guest Mastra schedule storage exceeds its bounded record count.");
      }
      return {
        schedules: envelope.schedules.map((item) => validateSchedule(this.authority, item)),
        triggers: envelope.triggers.map((item) => validateTrigger(this.authority, item)),
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return { schedules: [], triggers: [] };
      throw error;
    }
  }

  private async writeState(state: MutableScheduleState) {
    if (state.schedules.length > MAX_SCHEDULES || state.triggers.length > MAX_TRIGGERS) {
      throw new Error("Autonomous Guest Mastra schedule storage exceeds its bounded record count.");
    }
    const directory = scheduleDirectory(this.authority);
    const target = scheduleStatePath(this.authority);
    const source = `${JSON.stringify({
      format: FORMAT,
      version: VERSION,
      workspaceId: this.authority.workspaceId,
      autonomousRunId: this.authority.autonomousRunId,
      savedAt: new Date().toISOString(),
      schedules: state.schedules,
      triggers: state.triggers,
    } satisfies ScheduleEnvelope, null, 2)}\n`;
    if (Buffer.byteLength(source, "utf8") > MAX_BYTES) {
      throw new Error("Autonomous Guest Mastra schedule storage exceeds its bounded size.");
    }
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporary, source, { encoding: "utf8", mode: 0o600 });
    await rename(temporary, target);
  }

  private mutate<T>(operation: (state: MutableScheduleState) => Promise<T> | T): Promise<T> {
    const result = this.mutation.then(async () => {
      const state = await this.readState();
      const value = await operation(state);
      await this.writeState(state);
      return value;
    });
    this.mutation = result.then(() => undefined, () => undefined);
    return result;
  }

  async dangerouslyClearAll(): Promise<void> {
    await this.mutate((state) => {
      state.schedules = [];
      state.triggers = [];
    });
  }

  async createSchedule(schedule: Schedule): Promise<Schedule> {
    const validated = validateSchedule(this.authority, schedule);
    return this.mutate((state) => {
      if (state.schedules.some((item) => item.id === validated.id)) {
        throw new Error(`Schedule ${validated.id} already exists`);
      }
      state.schedules.push(validated);
      return cloneJson(validated);
    });
  }

  async getSchedule(id: string): Promise<Schedule | null> {
    const state = await this.readState();
    const found = state.schedules.find((item) => item.id === id);
    return found ? cloneJson(found) : null;
  }

  async listSchedules(filter?: ScheduleFilter): Promise<Schedule[]> {
    const state = await this.readState();
    let schedules = state.schedules;
    if (filter?.status) schedules = schedules.filter((item) => item.status === filter.status);
    if (filter?.workflowId) schedules = schedules.filter((item) => item.target.type === "workflow" && item.target.workflowId === filter.workflowId);
    if (filter?.ownerType !== undefined) schedules = schedules.filter((item) => (item.ownerType ?? null) === filter.ownerType);
    if (filter?.ownerId !== undefined) schedules = schedules.filter((item) => (item.ownerId ?? null) === filter.ownerId);
    return schedules.sort((a, b) => a.createdAt - b.createdAt).map(cloneJson);
  }

  async listDueSchedules(now: number, limit?: number): Promise<Schedule[]> {
    const state = await this.readState();
    const due = state.schedules
      .filter((item) => item.status === "active" && item.nextFireAt <= now)
      .sort((a, b) => a.nextFireAt - b.nextFireAt);
    return due.slice(0, limit ?? due.length).map(cloneJson);
  }

  async updateSchedule(id: string, patch: ScheduleUpdate): Promise<Schedule> {
    return this.mutate((state) => {
      const index = state.schedules.findIndex((item) => item.id === id);
      if (index < 0) throw new Error(`Schedule ${id} not found`);
      const existing = state.schedules[index]!;
      const updated = validateSchedule(this.authority, {
        ...existing,
        ...patch,
        target: patch.target ?? existing.target,
        metadata: patch.metadata ?? existing.metadata,
        updatedAt: Date.now(),
      });
      state.schedules[index] = updated;
      return cloneJson(updated);
    });
  }

  async updateScheduleNextFire(
    id: string,
    expectedNextFireAt: number,
    newNextFireAt: number,
    lastFireAt: number,
    lastRunId: string,
  ): Promise<boolean> {
    return this.mutate((state) => {
      const index = state.schedules.findIndex((item) => item.id === id);
      if (index < 0) return false;
      const existing = state.schedules[index]!;
      if (existing.status !== "active" || existing.nextFireAt !== expectedNextFireAt) return false;
      state.schedules[index] = validateSchedule(this.authority, {
        ...existing,
        nextFireAt: newNextFireAt,
        lastFireAt,
        lastRunId,
        updatedAt: Date.now(),
      });
      return true;
    });
  }

  async deleteSchedule(id: string): Promise<void> {
    await this.mutate((state) => {
      state.schedules = state.schedules.filter((item) => item.id !== id);
      state.triggers = state.triggers.filter((item) => item.scheduleId !== id);
    });
  }

  async recordTrigger(trigger: ScheduleTrigger): Promise<void> {
    const validated = validateTrigger(this.authority, {
      ...trigger,
      id: trigger.id ?? randomUUID(),
      triggerKind: trigger.triggerKind ?? "schedule-fire",
    });
    await this.mutate((state) => {
      state.triggers.push(validated);
      if (state.triggers.length > MAX_TRIGGERS) {
        state.triggers = state.triggers
          .sort((a, b) => b.actualFireAt - a.actualFireAt)
          .slice(0, MAX_TRIGGERS);
      }
    });
  }

  async listTriggers(scheduleId: string, options?: ScheduleTriggerListOptions): Promise<ScheduleTrigger[]> {
    const state = await this.readState();
    let triggers = state.triggers.filter((item) => item.scheduleId === scheduleId);
    if (options?.fromActualFireAt != null) triggers = triggers.filter((item) => item.actualFireAt >= options.fromActualFireAt!);
    if (options?.toActualFireAt != null) triggers = triggers.filter((item) => item.actualFireAt < options.toActualFireAt!);
    triggers = triggers.sort((a, b) => b.actualFireAt - a.actualFireAt);
    if (options?.limit != null) triggers = triggers.slice(0, options.limit);
    return triggers.map(cloneJson);
  }
}

export function createAutonomousGuestMastraScheduleStorage(authority: AutonomousGuestAuthority) {
  const schedules = new AutonomousGuestFileSchedulesStorage(authority);
  const storage = new MastraCompositeStore({
    id: `plotpickle-autonomous-guest-${authority.workspaceId}`,
    domains: { schedules },
  });
  return Object.freeze({ storage, schedules });
}
