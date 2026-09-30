import path from "node:path";
import { DeveloperToolClass } from "../../lib/agents/developer-tool-authorization.mjs";
import { deriveCodemodeLoadout } from "../../lib/agents/pi-codemode-governance.mjs";

export const CODEMODE_TASK_ENV = "PLOTPICKLE_CODEMODE_TASK_JSON";

const READ_TOOLS = new Set([
  "read",
  "grep",
  "find",
  "ls",
  "plotpickle_status",
  "plotpickle_hooks",
]);

const EVIDENCE_TOOLS = new Set([
  "plotpickle_uat_findings",
  "plotpickle_focused_uat",
  "plotpickle_build",
  "plotpickle_validate",
]);

const PATH_SCOPED_READ_TOOLS = new Set(["read", "grep", "find", "ls"]);

function parseCurrentTask() {
  const source = process.env[CODEMODE_TASK_ENV];
  if (!source) return null;
  const value = JSON.parse(source);
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function toolClassFor(toolName) {
  if (READ_TOOLS.has(toolName)) return DeveloperToolClass.READ;
  if (EVIDENCE_TOOLS.has(toolName)) return DeveloperToolClass.EVIDENCE;
  return null;
}

function scopeRoot(scope, cwd) {
  const raw = String(scope || "").trim();
  if (!raw) return null;
  const withoutGlob = raw.replace(/[\\/](?:\*\*|\*)$/u, "");
  return path.resolve(cwd, withoutGlob || ".");
}

function pathWithinReadScopes(inputPath, readScopes, cwd) {
  const target = path.resolve(cwd, typeof inputPath === "string" && inputPath.trim() ? inputPath : ".");
  for (const scope of Array.isArray(readScopes) ? readScopes : []) {
    const root = scopeRoot(scope, cwd);
    if (!root) continue;
    if (target === root || target.startsWith(`${root}${path.sep}`)) return true;
  }
  return false;
}

export function evaluateCodemodeNestedToolCall({ event, cwd, task = parseCurrentTask() } = {}) {
  if (!event?.parentToolCallId) return { allowed: true, direct: true, reason: "direct-tool-call-unmodified" };

  const toolName = String(event.toolName || "").trim();
  const toolClass = toolClassFor(toolName);
  if (!toolClass) return { allowed: false, reason: "phase3-codemode-tool-not-approved" };

  const phase = typeof task?.phase === "string" ? task.phase : "";
  const loadout = deriveCodemodeLoadout({
    task,
    phase,
    availableTools: [{ name: toolName, toolClass, exposure: "codemode" }],
    requiredSkillIds: Array.isArray(task?.requiredSkillIds) ? task.requiredSkillIds : [],
    privacyPolicy: task?.privacyPolicy,
  });
  if (!loadout.enabled) return { allowed: false, reason: loadout.reason };
  if (!loadout.toolNames.includes(toolName)) return { allowed: false, reason: "task-scoped-codemode-loadout-denied" };

  if (PATH_SCOPED_READ_TOOLS.has(toolName)) {
    const requestedPath = event?.args?.path;
    if (!pathWithinReadScopes(requestedPath, loadout.readScopes, cwd || process.cwd())) {
      return { allowed: false, reason: "codemode-read-scope-denied" };
    }
  }

  return {
    allowed: true,
    reason: "task-scoped-read-evidence",
    taskId: loadout.taskId,
    phase: loadout.phase,
  };
}

export default function plotpickleCodemodeGovernor(pi) {
  pi.on("tool_call", async (event, ctx) => {
    if (!event?.parentToolCallId) return undefined;
    const decision = evaluateCodemodeNestedToolCall({
      event,
      cwd: ctx?.cwd || process.cwd(),
    });
    if (decision.allowed) return undefined;
    return {
      block: true,
      reason: `PlotPickle Codemode blocked ${String(event.toolName || "unknown")}: ${decision.reason}`,
    };
  });
}
