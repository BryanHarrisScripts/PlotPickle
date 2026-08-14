"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import styles from "./sage-fast-model-setup.module.css";

type Role = "fast" | "quality" | "deep";
type RuntimeKind = "llama.cpp" | "lm-studio" | "ollama" | "openai-compatible";
type RuntimeChoice = RuntimeKind | "auto";

type RuntimeSettings = {
  preferredRuntime: RuntimeChoice;
  contextTokens: 16384 | 32768;
  modelOverrides: Partial<Record<Role, string>>;
  managedLlama: {
    enabled: boolean;
    executable: string;
    port: number;
    modelPaths: Partial<Record<Role, string>>;
    gpuLayers: Partial<Record<Role, number>>;
  };
};

type ModelRoleStatus = {
  recommended: string;
  selected: string;
  available: boolean;
};

type RuntimeProbe = {
  kind: RuntimeKind;
  label: string;
  reachable: boolean;
  models: string[];
  error: string;
  managed: boolean;
};

type LocalRuntimeStatus = {
  ok: boolean;
  settings: RuntimeSettings;
  activeRuntime: RuntimeProbe;
  runtimes: RuntimeProbe[];
  roles: {
    fast: ModelRoleStatus;
    quality: ModelRoleStatus;
    deep: ModelRoleStatus;
  };
};

function reportedOrConfiguredModel(
  configured: string | undefined,
  role: ModelRoleStatus,
  reportedModels: readonly string[],
) {
  if (configured && reportedModels.includes(configured)) return configured;
  if (role.available && role.selected) return role.selected;
  return configured || "";
}

function friendlySetupError(error: unknown, status: LocalRuntimeStatus | null) {
  const fallback = "PlotPickle could not finish that check. Make sure your local AI is running, then refresh and try again.";
  if (!(error instanceof Error)) return fallback;
  const message = error.message;
  const runtime = status?.activeRuntime;
  if (!runtime?.reachable || /runtime.*(?:unavailable|not ready|not reachable)|no production-ready local model/i.test(message)) {
    return "PlotPickle could not find a ready local AI yet. Start Ollama, LM Studio, or your preferred local runtime, then choose Refresh and try again.";
  }
  if (/model|gguf|selected|detected/i.test(message)) {
    return `PlotPickle found ${runtime.label}, but no matching story model is selected yet. Choose one detected model below and try again.`;
  }
  return message.length <= 220 ? message : fallback;
}

export default function SageFastModelSetup() {
  const [status, setStatus] = useState<LocalRuntimeStatus | null>(null);
  const [managed, setManaged] = useState(false);
  const [preferredRuntime, setPreferredRuntime] = useState<RuntimeChoice>("auto");
  const [executable, setExecutable] = useState("llama-server");
  const [fastPath, setFastPath] = useState("");
  const [qualityPath, setQualityPath] = useState("");
  const [fastOverride, setFastOverride] = useState("");
  const [qualityOverride, setQualityOverride] = useState("");
  const [fastGpuLayers, setFastGpuLayers] = useState(99);
  const [qualityGpuLayers, setQualityGpuLayers] = useState(24);
  const [message, setMessage] = useState("Checking for local AI…");
  const [busy, setBusy] = useState(false);

  const hydrate = useCallback((body: LocalRuntimeStatus) => {
    const reportedModels = body.activeRuntime.models;
    const managedPathsExist = Boolean(
      body.settings.managedLlama.modelPaths.fast
      || body.settings.managedLlama.modelPaths.quality,
    );
    setStatus(body);
    setManaged(body.settings.managedLlama.enabled && (managedPathsExist || body.activeRuntime.managed));
    setPreferredRuntime(
      body.settings.preferredRuntime === "llama.cpp" && !managedPathsExist && body.activeRuntime.kind !== "llama.cpp"
        ? body.activeRuntime.kind
        : body.settings.preferredRuntime,
    );
    setExecutable(body.settings.managedLlama.executable || "llama-server");
    setFastPath(body.settings.managedLlama.modelPaths.fast || "");
    setQualityPath(body.settings.managedLlama.modelPaths.quality || "");
    setFastOverride(reportedOrConfiguredModel(body.settings.modelOverrides.fast, body.roles.fast, reportedModels));
    setQualityOverride(reportedOrConfiguredModel(body.settings.modelOverrides.quality, body.roles.quality, reportedModels));
    setFastGpuLayers(body.settings.managedLlama.gpuLayers.fast ?? 99);
    setQualityGpuLayers(body.settings.managedLlama.gpuLayers.quality ?? 24);
  }, []);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/local-ai/runtime", { cache: "no-store" });
      const body = await response.json() as LocalRuntimeStatus & { message?: string };
      if (!response.ok || !body.ok) throw new Error(body.message || "Local runtime status is unavailable.");
      hydrate(body);
      setMessage("");
    } catch (error) {
      setMessage(friendlySetupError(error, null));
    }
  }, [hydrate]);

  useEffect(() => { void refresh(); }, [refresh]);

  const reportedModels = useMemo(() => status?.activeRuntime.models ?? [], [status]);
  const reachableRuntimes = useMemo(() => status?.runtimes.filter((runtime) => runtime.reachable) ?? [], [status]);

  async function persistSetup() {
    if (!status) throw new Error("Local runtime status is unavailable.");
    const onlyDetectedModel = !managed && reportedModels.length === 1 ? reportedModels[0] : "";
    const selectedFast = fastOverride.trim() || onlyDetectedModel;
    const selectedQuality = qualityOverride.trim() || onlyDetectedModel;
    const response = await fetch("/api/local-ai/runtime/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        preferredRuntime: managed ? "llama.cpp" : preferredRuntime,
        modelOverrides: {
          ...status.settings.modelOverrides,
          fast: selectedFast,
          quality: selectedQuality,
        },
        managedLlama: {
          ...status.settings.managedLlama,
          enabled: managed,
          executable: executable.trim(),
          modelPaths: {
            ...status.settings.managedLlama.modelPaths,
            fast: fastPath.trim(),
            quality: qualityPath.trim(),
          },
          gpuLayers: {
            ...status.settings.managedLlama.gpuLayers,
            fast: Math.max(0, Math.min(999, Math.round(fastGpuLayers))),
            quality: Math.max(0, Math.min(999, Math.round(qualityGpuLayers))),
          },
        },
      }),
    });
    const body = await response.json() as LocalRuntimeStatus & { message?: string };
    if (!response.ok || !body.ok) throw new Error(body.message || "Local AI setup could not be saved.");
    hydrate(body);
    return body;
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!status || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const body = await persistSetup();
      setMessage(managed
        ? "Advanced llama.cpp settings saved. Use Test Sage and Test PLAN to check each role."
        : `${body.activeRuntime.label} is connected. Sage and PLAN are set up; test each one below.`);
    } catch (error) {
      setMessage(friendlySetupError(error, status));
    } finally {
      setBusy(false);
    }
  }

  async function prepareRole(role: "fast" | "quality") {
    if (busy || !status) return;
    setBusy(true);
    setMessage(role === "fast" ? "Testing Sage…" : "Testing PLAN…");
    try {
      await persistSetup();
      const response = await fetch(`/api/local-ai/runtime/model/${role}/load`, {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      const body = await response.json() as LocalRuntimeStatus & { message?: string; availableModels?: string[] };
      if (!response.ok || !body.ok) throw new Error(body.message || `The ${role} model could not be tested.`);
      hydrate(body);
      const ready = body.activeRuntime.reachable && body.roles[role].available;
      setMessage(ready
        ? role === "fast"
          ? `Sage is ready on ${body.activeRuntime.label}. Return to LEARN and ask a question.`
          : `PLAN is ready on ${body.activeRuntime.label}. Return to PLAN and try a local draft.`
        : `PlotPickle found ${body.activeRuntime.label}, but ${role === "fast" ? "Sage" : "PLAN"} still needs a model. Choose one detected model and try again.`);
    } catch (error) {
      setMessage(friendlySetupError(error, status));
    } finally {
      setBusy(false);
    }
  }

  function useOnlyDetectedModelForBoth() {
    const model = reportedModels[0];
    if (!model) return;
    setFastOverride(model);
    setQualityOverride(model);
    setMessage(`Using ${model} for both Sage and PLAN. Choose “Set up Sage and PLAN” to save it.`);
  }

  const runtimeFound = Boolean(status?.activeRuntime.reachable);
  const sageReady = Boolean(runtimeFound && status?.roles.fast.available);
  const planReady = Boolean(runtimeFound && status?.roles.quality.available);
  const allReady = sageReady && planReady;
  const activeRuntimeLabel = status?.activeRuntime.label || "No runtime found";

  return (
    <section className={styles.panel} aria-labelledby="sage-fast-model-title">
      <div className={styles.heading}>
        <div>
          <p>Quick Setup</p>
          <h2 id="sage-fast-model-title">Use my running local AI</h2>
        </div>
        <span className={allReady ? styles.ready : styles.needsSetup}>{allReady ? "Ready" : "Setup needed"}</span>
      </div>

      <div className={styles.statusBadges} aria-label="Local AI setup status">
        <span data-ready={runtimeFound ? "true" : "false"}>Runtime found</span>
        <span data-ready={sageReady ? "true" : "false"}>Sage ready</span>
        <span data-ready={planReady ? "true" : "false"}>PLAN ready</span>
      </div>

      <p className={styles.statusLine}>
        {runtimeFound
          ? <>PlotPickle found <strong>{activeRuntimeLabel}</strong>{reportedModels.length ? ` with ${reportedModels.length} available model${reportedModels.length === 1 ? "" : "s"}.` : ", but it has not reported an available model yet."}</>
          : <>Start Ollama, LM Studio, or another local AI runtime, then refresh this screen.</>}
      </p>

      <form onSubmit={save}>
        {!managed ? (
          <div className={styles.basicSetup}>
            <label>
              Running local AI
              <select value={preferredRuntime} onChange={(event) => setPreferredRuntime(event.target.value as RuntimeChoice)}>
                <option value="auto">Automatic — use what PlotPickle found</option>
                {status?.runtimes.map((runtime) => (
                  <option key={runtime.kind} value={runtime.kind}>{runtime.label}{runtime.reachable ? " — found" : " — not running"}</option>
                ))}
              </select>
              <small>Most people can leave this on Automatic.</small>
            </label>

            <label>
              Sage
              <select aria-label="Sage Fast model" disabled={!reportedModels.length} value={fastOverride} onChange={(event) => setFastOverride(event.target.value)}>
                <option value="">Choose automatically</option>
                {fastOverride && !reportedModels.includes(fastOverride) ? <option value={fastOverride}>Previously selected: {fastOverride}</option> : null}
                {reportedModels.map((model) => <option key={model} value={model}>{model}</option>)}
              </select>
              <small>Choose the model Sage should use for conversation and lesson help.</small>
            </label>

            <label>
              PLAN
              <select aria-label="PLAN Quality model" disabled={!reportedModels.length} value={qualityOverride} onChange={(event) => setQualityOverride(event.target.value)}>
                <option value="">Choose automatically</option>
                {qualityOverride && !reportedModels.includes(qualityOverride) ? <option value={qualityOverride}>Previously selected: {qualityOverride}</option> : null}
                {reportedModels.map((model) => <option key={model} value={model}>{model}</option>)}
              </select>
              <small>You can use the same local model for PLAN until you install a stronger one.</small>
            </label>

            <div className={styles.detectedModels}>
              <strong>Models PlotPickle found</strong>
              {reportedModels.length ? (
                <p>{reportedModels.join(" · ")}</p>
              ) : (
                <p>{runtimeFound
                  ? `${activeRuntimeLabel} is running, but it has not reported an installed model yet.`
                  : "No running local AI has been found yet."}</p>
              )}
              {reportedModels.length === 1 ? (
                <button
                  type="button"
                  data-legacy-label="Use this detected model for both Sage + PLAN"
                  onClick={useOnlyDetectedModelForBoth}
                >
                  Use this model for Sage and PLAN
                </button>
              ) : null}
              {reachableRuntimes.length > 1 ? <small>Also found: {reachableRuntimes.map((runtime) => runtime.label).join(", ")}.</small> : null}
            </div>
          </div>
        ) : (
          <div className={styles.managedNotice}>
            <strong>Advanced llama.cpp setup is active.</strong>
            <span>Open Advanced Setup below to edit GGUF files, executable paths, or GPU layers.</span>
          </div>
        )}

        <details className={styles.advancedSetup}>
          <summary>Advanced Setup</summary>
          <p>Use this only if you want PlotPickle to manage llama.cpp and specific GGUF model files itself.</p>
          <label className={styles.advancedToggle}>
            <input type="checkbox" checked={managed} onChange={(event) => setManaged(event.target.checked)} />
            <span><strong>Use PlotPickle-managed llama.cpp</strong><small>Enables GGUF paths, executable paths, and GPU-layer controls.</small></span>
          </label>
          {managed ? (
            <div className={styles.grid}>
              <label>
                llama.cpp server executable
                <input type="text" value={executable} onChange={(event) => setExecutable(event.target.value)} placeholder="llama-server" />
              </label>
              <label>
                Sage Fast GGUF model path
                <input type="text" value={fastPath} onChange={(event) => setFastPath(event.target.value)} placeholder="C:\\...\\Qwen3.5-4B-Q6_K.gguf" />
              </label>
              <label>
                Fast GPU layers
                <input min={0} max={999} type="number" value={fastGpuLayers} onChange={(event) => setFastGpuLayers(Number(event.target.value) || 0)} />
              </label>
              <label>
                <span aria-hidden="true">&nbsp;</span>
                <small>One managed executable serves both roles.</small>
              </label>
              <label>
                PLAN Quality GGUF model path
                <input type="text" value={qualityPath} onChange={(event) => setQualityPath(event.target.value)} placeholder="C:\\...\\Qwen3.5-9B-Q4_K_M.gguf" />
              </label>
              <label>
                Quality GPU layers
                <input min={0} max={999} type="number" value={qualityGpuLayers} onChange={(event) => setQualityGpuLayers(Number(event.target.value) || 0)} />
              </label>
            </div>
          ) : null}
        </details>

        <div className={styles.footer}>
          <button className={styles.primaryButton} type="submit" disabled={busy || !status}>{busy ? "Working…" : "Set up Sage and PLAN"}</button>
          <button aria-label="Test Sage Fast" type="button" disabled={busy || !status} onClick={() => void prepareRole("fast")}>Test Sage</button>
          <button aria-label="Test PLAN Quality" type="button" disabled={busy || !status} onClick={() => void prepareRole("quality")}>Test PLAN</button>
          <button type="button" disabled={busy} onClick={() => void refresh()}>Refresh</button>
        </div>
      </form>

      {message ? <p className={styles.message} role="status">{message}</p> : null}
    </section>
  );
}
