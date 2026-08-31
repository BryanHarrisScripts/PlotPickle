import { Mastra } from "@mastra/core/mastra";
import type { PublicSchema } from "@mastra/core/schema";
import { createStep, createWorkflow } from "@mastra/core/workflows/evented";
import {
  getAutonomousGuestAuthority,
  type AutonomousGuestAuthority,
} from "../../core/auth/autonomous-guest/guest-authority";
import { createAutonomousGuestMastraScheduleStorage } from "./mastra-file-schedules-storage";
import {
  AUTONOMOUS_GUEST_WAKE_WORKFLOW_ID,
  wakeAutonomousGuestTask,
  type AutonomousGuestTaskPolicyResolver,
  type AutonomousGuestWakePayload,
} from "./mastra-task-scheduler";

export type AutonomousGuestWakeResult = Readonly<{
  taskId: string;
  state: string;
  failureClass: string;
  eligible: boolean;
}>;

const wakePayloadSchema: PublicSchema<AutonomousGuestWakePayload> = {
  type: "object",
  properties: {
    taskId: { type: "string", pattern: "^guest-task-[a-fA-F0-9-]{36}$" },
    autonomousRunId: { type: "string", minLength: 1, maxLength: 240 },
    guestWorkspaceId: { type: "string", pattern: "^guest-auto-[a-fA-F0-9]{24}$" },
  },
  required: ["taskId", "autonomousRunId", "guestWorkspaceId"],
  additionalProperties: false,
};

const wakeResultSchema: PublicSchema<AutonomousGuestWakeResult> = {
  type: "object",
  properties: {
    taskId: { type: "string" },
    state: { type: "string" },
    failureClass: { type: "string" },
    eligible: { type: "boolean" },
  },
  required: ["taskId", "state", "failureClass", "eligible"],
  additionalProperties: false,
};

function parseWakePayload(value: unknown): AutonomousGuestWakePayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Autonomous Guest wake workflow payload is invalid.");
  }
  const payload = value as Partial<AutonomousGuestWakePayload>;
  const taskId = String(payload.taskId || "");
  const autonomousRunId = String(payload.autonomousRunId || "");
  const guestWorkspaceId = String(payload.guestWorkspaceId || "");
  if (!/^guest-task-[a-f0-9-]{36}$/i.test(taskId) || !autonomousRunId || !/^guest-auto-[a-f0-9]{24}$/i.test(guestWorkspaceId)) {
    throw new Error("Autonomous Guest wake workflow references are invalid.");
  }
  return Object.freeze({ taskId, autonomousRunId, guestWorkspaceId });
}

function currentAutonomousGuestAuthority() {
  const authority = getAutonomousGuestAuthority("http://127.0.0.1", "desktop-loopback");
  if (!authority) throw new Error("Autonomous Guest wake denied because delegated Guest authority is disabled or invalid.");
  return authority;
}

function assertWakeNamespace(authority: AutonomousGuestAuthority, payload: AutonomousGuestWakePayload) {
  if (payload.autonomousRunId !== authority.autonomousRunId || payload.guestWorkspaceId !== authority.workspaceId) {
    throw new Error("Autonomous Guest wake payload does not match the current delegated Guest authority.");
  }
}

export function createAutonomousGuestWakeWorkflow(resolvePolicy: AutonomousGuestTaskPolicyResolver) {
  const wakeStep = createStep({
    id: "revalidate-plotpickle-guest-task",
    inputSchema: wakePayloadSchema,
    outputSchema: wakeResultSchema,
    execute: async ({ inputData }) => {
      const payload = parseWakePayload(inputData);
      const authority = currentAutonomousGuestAuthority();
      assertWakeNamespace(authority, payload);
      return wakeAutonomousGuestTask({ authority, payload, resolvePolicy });
    },
  });

  return createWorkflow({
    id: AUTONOMOUS_GUEST_WAKE_WORKFLOW_ID,
    inputSchema: wakePayloadSchema,
    outputSchema: wakeResultSchema,
  })
    .then(wakeStep)
    .commit();
}

export function createAutonomousGuestSchedulerRuntime(resolvePolicy: AutonomousGuestTaskPolicyResolver) {
  const authority = currentAutonomousGuestAuthority();
  const { storage, schedules } = createAutonomousGuestMastraScheduleStorage(authority);
  const wakeWorkflow = createAutonomousGuestWakeWorkflow(resolvePolicy);
  const mastra = new Mastra({
    workflows: { [AUTONOMOUS_GUEST_WAKE_WORKFLOW_ID]: wakeWorkflow },
    storage,
    logger: false,
  });
  return Object.freeze({
    authority,
    mastra,
    schedules,
    wakeWorkflow,
  });
}

export async function startAutonomousGuestSchedulerRuntime(resolvePolicy: AutonomousGuestTaskPolicyResolver) {
  const runtime = createAutonomousGuestSchedulerRuntime(resolvePolicy);
  await runtime.mastra.startWorkers();
  return runtime;
}
