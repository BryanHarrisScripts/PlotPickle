/**
 * PP-COMP-002 — verification belongs to an *exact* execution identity, not
 * to a discovered model name or another automatic local role.
 *
 * Keep this pure and provider-neutral. It does not create route selection,
 * reach into local runtime, or persist another readiness store.
 */
export function sameLocalWritingExecution(profile, execution) {
  return Boolean(
    profile && execution
    && profile.provider === "local"
    && profile.runtime === execution.runtime
    && profile.baseUrl === execution.baseUrl
    && profile.textModel === execution.textModel
    && Number(profile.contextTokens) === Number(execution.contextTokens)
  );
}

export function qualityWritingReadiness(profile, runtime) {
  const quality = runtime?.roles?.quality;
  const model = quality?.selected || "";
  const reachable = runtime?.activeRuntime?.reachable === true;
  const available = quality?.available === true && Boolean(model);
  const execution = {
    runtime: runtime?.activeRuntime?.kind || "",
    baseUrl: runtime?.activeRuntime?.baseUrl || "",
    textModel: model,
    contextTokens: runtime?.settings?.contextTokens || 0,
  };
  const matching = sameLocalWritingExecution(profile, execution);
  const verifiedAt = matching ? profile?.assistantVerifiedAt || "" : "";
  const error = !reachable
    ? runtime?.activeRuntime?.error || "The local writing runtime is not reachable."
    : !available
      ? "No suitable local Quality writing model is installed or selected."
      : !matching && profile?.assistantVerifiedAt
        ? "The selected Quality runtime or model changed. Test Writing again."
        : matching ? profile?.lastError || "" : "";
  return {
    configured: available,
    ready: Boolean(reachable && available && verifiedAt && !error),
    verifiedAt,
    error,
    model,
    runtime: execution.runtime,
    baseUrl: execution.baseUrl,
    role: "quality",
  };
}
