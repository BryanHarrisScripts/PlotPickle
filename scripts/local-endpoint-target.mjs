import { resolveEndpointSnapshot } from "./local-endpoint-runtime.mjs";

function argument(args, name) {
  const index = args.indexOf(name);
  return index >= 0 && index + 1 < args.length ? String(args[index + 1] || "").trim() : "";
}

function endpointContext(env) {
  return {
    endpointId: String(env.PLOTPICKLE_LOCAL_ENDPOINT_ID || "").trim(),
    expectedGeneration: Number(env.PLOTPICKLE_LOCAL_ENDPOINT_GENERATION || 0) || undefined,
    jobId: String(env.PLOTPICKLE_LOCAL_ENDPOINT_JOB || "").trim() || undefined,
    worktreeRef: String(env.PLOTPICKLE_LOCAL_ENDPOINT_WORKTREE || "").trim() || undefined,
    profileRef: String(env.PLOTPICKLE_LOCAL_ENDPOINT_PROFILE || "").trim() || undefined,
  };
}

export async function resolveLocalEndpointTarget({
  args = process.argv.slice(2),
  env = process.env,
  defaultUrl = "http://127.0.0.1:4173",
} = {}) {
  const explicit = argument(args, "--base-url");
  if (explicit) {
    if (!URL.canParse(explicit)) throw new Error("Explicit browser/UAT base URL is invalid.");
    return {
      baseUrl: explicit,
      source: "explicit",
      evidence: null,
      assertCurrent: async () => true,
    };
  }

  const registryPath = String(env.PLOTPICKLE_LOCAL_ENDPOINT_REGISTRY || "").trim();
  const context = endpointContext(env);
  if (registryPath || context.endpointId) {
    if (!registryPath || !context.endpointId || !context.expectedGeneration) {
      throw new Error("Managed endpoint environment is incomplete; registry path, endpoint id and generation must travel together.");
    }
    const record = await resolveEndpointSnapshot(registryPath, context);
    const evidence = {
      endpointId: record.endpointId,
      jobId: record.jobId || "",
      worktreeRef: record.worktreeRef || "",
      commitSha: record.commitSha || "",
      generation: record.generation,
      resolvedUrl: record.url,
      exactInstanceProof: record.readinessEvidence?.kind === "exact-instance" && record.readinessEvidence?.result === "pass" ? "pass" : "not-proven",
    };
    return {
      baseUrl: record.url,
      source: "local-endpoint-registry",
      evidence,
      assertCurrent: async () => {
        await resolveEndpointSnapshot(registryPath, context);
        return true;
      },
    };
  }

  const legacy = String(env.PLOTPICKLE_ACCEPTANCE_URL || defaultUrl).trim();
  if (!URL.canParse(legacy)) throw new Error("Browser/UAT acceptance URL is invalid.");
  return {
    baseUrl: legacy,
    source: env.PLOTPICKLE_ACCEPTANCE_URL ? "legacy-environment" : "legacy-default",
    evidence: null,
    assertCurrent: async () => true,
  };
}
