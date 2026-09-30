import { DeveloperToolClass, authorizeDeveloperTool } from "./developer-tool-authorization.mjs";

const CODEMODE_PHASES = new Set(["inspect", "build", "test", "repair", "verify"]);
const CODEMODE_EXPOSURES = new Set(["direct", "codemode", "deferred"]);
const CODEMODE_CLASSES = new Set([DeveloperToolClass.READ, DeveloperToolClass.EVIDENCE]);
const ACTIVE_TASK_STATES = new Set(["authorized", "building", "repairing", "verifying"]);

function normalizedStrings(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item || "").trim()).filter(Boolean))].sort();
}

function hasTaskGrant(task, toolName) {
  const allowed = normalizedStrings(task?.allowedTools);
  return allowed.includes("*") || allowed.includes(toolName);
}

function boundedEvidenceValue(value) {
  if (!value || typeof value !== "object") return null;
  const source = value.structuredContent && typeof value.structuredContent === "object"
    ? value.structuredContent
    : value;
  const out = {};
  for (const key of ["status", "errorCode", "evidenceRef", "verificationStatus", "headSha", "taskState"]) {
    if (typeof source[key] === "string" || typeof source[key] === "number" || typeof source[key] === "boolean") {
      out[key] = source[key];
    }
  }
  if (Array.isArray(source.changedFiles)) out.changedFiles = source.changedFiles.slice(0, 64).map(String);
  return Object.keys(out).length ? out : null;
}

export function authorizeCodemodeNestedTool({ toolName, toolClass, task } = {}) {
  if (!task?.authorized) return { allowed: false, reason: "governed-task-required" };
  if (!hasTaskGrant(task, toolName)) return { allowed: false, reason: "task-tool-grant-required" };
  if (!CODEMODE_CLASSES.has(toolClass)) {
    return { allowed: false, reason: "phase3-codemode-read-evidence-only" };
  }
  return authorizeDeveloperTool({ toolName, toolClass, task });
}

export function deriveCodemodeLoadout({
  task,
  phase,
  availableTools = [],
  requiredSkillIds = [],
  privacyPolicy = { localOnly: true, cloudAllowed: false },
} = {}) {
  const normalizedPhase = String(phase || "").trim();
  if (!CODEMODE_PHASES.has(normalizedPhase)) {
    return { enabled: false, reason: "unsupported-codemode-phase", phase: normalizedPhase || null, toolNames: [] };
  }
  if (!task?.authorized) {
    return { enabled: false, reason: "governed-task-required", phase: normalizedPhase, toolNames: [] };
  }
  if (!ACTIVE_TASK_STATES.has(String(task?.state || ""))) {
    return { enabled: false, reason: "task-state-not-active", phase: normalizedPhase, toolNames: [] };
  }

  const toolNames = [];
  for (const tool of Array.isArray(availableTools) ? availableTools : []) {
    const name = String(tool?.name || "").trim();
    const toolClass = tool?.toolClass;
    const exposure = String(tool?.exposure || "").trim();
    if (!name || !CODEMODE_EXPOSURES.has(exposure) || !CODEMODE_CLASSES.has(toolClass)) continue;
    const decision = authorizeCodemodeNestedTool({ toolName: name, toolClass, task });
    if (decision.allowed) toolNames.push(name);
  }

  return {
    enabled: true,
    reason: "task-scoped-read-evidence-loadout",
    phase: normalizedPhase,
    taskId: typeof task.id === "string" ? task.id : null,
    toolNames: [...new Set(toolNames)].sort(),
    requiredSkillIds: normalizedStrings(requiredSkillIds),
    readScopes: normalizedStrings(task.readScopes),
    writeScopes: [],
    mutationAuthorized: false,
    destructiveAuthorized: false,
    privacy: {
      localOnly: privacyPolicy?.localOnly !== false,
      cloudAllowed: privacyPolicy?.cloudAllowed === true,
    },
    verificationAuthority: "deterministic-contract-only",
  };
}

export async function runCodemodeReadEvidenceBatch({
  task,
  phase,
  availableTools,
  requiredSkillIds,
  calls,
  executeTool,
} = {}) {
  if (typeof executeTool !== "function") throw new TypeError("executeTool must be a function");
  const loadout = deriveCodemodeLoadout({ task, phase, availableTools, requiredSkillIds });
  if (!loadout.enabled) {
    const error = new Error(`Codemode loadout denied: ${loadout.reason}`);
    error.code = "PLOTPICKLE_CODEMODE_LOADOUT_DENIED";
    throw error;
  }

  const allowed = new Set(loadout.toolNames);
  const work = Array.isArray(calls) ? calls : [];
  for (const call of work) {
    if (!allowed.has(call?.name)) {
      const error = new Error("Codemode nested tool is outside the governed loadout");
      error.code = "PLOTPICKLE_CODEMODE_TOOL_DENIED";
      throw error;
    }
  }

  const results = await Promise.all(work.map(async (call) => {
    try {
      const value = await executeTool(call.name, call.args ?? {});
      return {
        toolName: call.name,
        status: value?.isError === true ? "error" : "ok",
        result: boundedEvidenceValue(value),
      };
    } catch {
      return { toolName: call.name, status: "error", result: null };
    }
  }));

  return {
    status: results.some((item) => item.status === "error") ? "error" : "ok",
    verificationAuthority: loadout.verificationAuthority,
    parallel: work.length > 1,
    results,
  };
}
