const WRITE_STATES = new Set(["authorized", "building", "repairing", "verifying"]);

export const DeveloperToolClass = Object.freeze({
  READ: "read-inspect",
  EVIDENCE: "test-evidence",
  SOURCE_MUTATION: "source-mutation",
  DESTRUCTIVE_ADMIN: "destructive-admin",
  SECRET: "secret-credential",
});

function hasToolGrant(task, toolName) {
  const allowed = Array.isArray(task?.allowedTools) ? task.allowedTools : [];
  return allowed.includes("*") || allowed.includes(toolName);
}

export function authorizeDeveloperTool({ toolName, toolClass, task } = {}) {
  if (!toolName || !toolClass) return { allowed: false, reason: "invalid-tool-authorization-request" };
  if (toolClass === DeveloperToolClass.READ || toolClass === DeveloperToolClass.EVIDENCE) {
    return { allowed: true, reason: "non-source developer capability" };
  }
  if (toolClass === DeveloperToolClass.SECRET) {
    return { allowed: false, reason: "secrets-are-not-model-readable" };
  }
  const authorized = Boolean(task?.authorized);
  const state = typeof task?.state === "string" ? task.state : "";
  if (!authorized || !WRITE_STATES.has(state) || !hasToolGrant(task, toolName)) {
    return { allowed: false, reason: "governed-task-authorization-required" };
  }
  if (toolClass === DeveloperToolClass.SOURCE_MUTATION && task?.mutationAuthorized === true) {
    return { allowed: true, reason: "task-scoped-source-mutation" };
  }
  if (toolClass === DeveloperToolClass.DESTRUCTIVE_ADMIN && task?.mutationAuthorized === true && task?.destructiveAuthorized === true) {
    return { allowed: true, reason: "separately-authorized-destructive-admin" };
  }
  return { allowed: false, reason: "insufficient-task-scope" };
}

export function assertDeveloperToolAuthorized(input) {
  const decision = authorizeDeveloperTool(input);
  if (!decision.allowed) {
    const error = new Error(`Developer tool authorization denied: ${decision.reason}`);
    error.code = "PLOTPICKLE_DEVELOPER_TOOL_UNAUTHORIZED";
    throw error;
  }
  return decision;
}
