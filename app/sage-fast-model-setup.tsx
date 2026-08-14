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
  const [message, setMessage] = useState("Checking local AI readiness…");
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
      setMessage(error instanceof Error ? error.message : "Local runtime status is unavailable.");
    }
  }, [hydrate]);

  useEffect(() => { void refresh(); }, [refresh]);

  const reportedModels = useMemo(() => status?.activeRuntime.models ?? [], [status]);
  const reachableRuntimes = useMemo(() => status?.runtimes.filter((runtime) => runtime.reachable) ?? [], [status]);

  async function persistSetup() {
    if (!status) throw new Error("Local runtime status is unavailable.");
    const response = await fetch("/api/local-ai/runtime/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        preferredRuntime: managed ? "llama.cpp" : preferredRuntime,
        modelOverrides: {
          ...status.settings.modelOverrides,
          fast: fastOverride.trim(),
          quality: qualityOverride.trim(),
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
        ? "Saved managed llama.cpp settings. Load/test Sage Fast or PLAN Quality to verify each GGUF path."
        : `${body.activeRuntime.label} settings saved. Test Sage Fast and PLAN Quality using the exact model IDs reported by the runtime.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Local AI setup could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function prepareRole(role: "fast" | "quality") {
    if (busy || !status) return;
    setBusy(true);
    setMessage(role === "fast" ? "Testing Sage's Fast model…" : "Testing PLAN's Quality model…");
    try {
      await persistSetup();
      const response = await fetch(`/api/local-ai/runtime/model/${role}/load`, {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      const body = await response.json() as LocalRuntimeStatus & { message?: string; availableModels?: string[] };
      if (!response.ok || !body.ok) {
        const detected = body.availableModels?.length ? ` Detected models: ${body.availableModels.join(", ")}.` : "";
        throw new Error(`${body.message || `The ${role} model could not be tested.`}${detected}`);
      }
      hydrate(body);
      const ready = body.activeRuntime.reachable && body.roles[role].available;
      setMessage(ready
        ? role === "fast"
          ? `Sage is ready on ${body.activeRuntime.label} with ${body.roles.fast.selected}. Return to LEARN and ask your question again.`
          : `PLAN local drafting is ready on ${body.activeRuntime.label} with ${body.roles.quality.selected}. Return to PLAN and use Draft with local AI.`
        : `The ${role === "fast" ? "Fast" : "Quality"} role is still not assigned to a model reported by the active runtime.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `The ${role} model could not be tested.`);
    } finally {
      setBusy(false);
    }
  }

  function useOnlyDetectedModelForBoth() {
    const model = reportedModels[0];
    if (!model) return;
    setFastOverride(model);
    setQualityOverride(model);
    setMessage(`Assigned ${model} to both Sage and PLAN. Save and test each role. You can replace PLAN with a stronger Quality model later.`);
  }

  const sageReady = Boolean(status?.activeRuntime.reachable && status.roles.fast.available);
  const planReady = Boolean(status?.activeRuntime.reachable && status.roles.quality.available);
  const allReady = sageReady && planReady;
  const activeRuntimeLabel = status?.activeRuntime.label || "No runtime";

  return (
    <section className={styles.panel} aria-labelledby="sage-fast-model-title">
      <div className={styles.heading}>
        <div>
          <p>Local story roles</p>
          <h2 id="sage-fast-model-title">Sage + PLAN model setup</h2>
        </div>
        <span className={allReady ? styles.ready : styles.needsSetup}>{allReady ? "Ready for Sage + PLAN" : "Setup needed"}</span>
      </div>

      {status ? (
        <p className={styles.statusLine}>
          Active runtime: <strong>{activeRuntimeLabel}</strong> · {reportedModels.length} model{reportedModels.length === 1 ? "" : "s"} reported<br />
          Sage / Fast: <strong>{status.roles.fast.selected || status.roles.fast.recommended}</strong> — {sageReady ? "ready" : "not ready"}<br />
          PLAN / Quality: <strong>{status.roles.quality.selected || status.roles.quality.recommended}</strong> — {planReady ? "ready" : "not ready"}
        </p>
      ) : null}

      <form onSubmit={save}>
        <fieldset className={styles.runtimeMode}>
          <legend>Choose how PlotPickle should use local text models</legend>
          <label>
            <input type="radio" checked={!managed} onChange={() => setManaged(false)} name="local-runtime-mode" />
            <span><strong>Use my running local runtime</strong><small>Recommended when PlotPickle already detects Ollama, LM Studio, llama.cpp, or another OpenAI-compatible server.</small></span>
          </label>
          <label>
            <input type="radio" checked={managed} onChange={() => setManaged(true)} name="local-runtime-mode" />
            <span><strong>Let PlotPickle manage llama.cpp GGUF files</strong><small>Use this only when you have local GGUF file paths and want PlotPickle to switch Fast and Quality models automatically.</small></span>
          </label>
        </fieldset>

        {!managed ? (
          <>
            <div className={styles.grid}>
              <label>
                Preferred runtime
                <select value={preferredRuntime} onChange={(event) => setPreferredRuntime(event.target.value as RuntimeChoice)}>
                  <option value="auto">Automatic hardware-aware choice</option>
                  {status?.runtimes.map((runtime) => (
                    <option key={runtime.kind} value={runtime.kind}>{runtime.label}{runtime.reachable ? " — detected" : " — not running"}</option>
                  ))}
                </select>
                <small>Current detection: {activeRuntimeLabel}. Save after changing this choice, then refresh readiness.</small>
              </label>
              <label>
                Sage Fast model
                <select disabled={!reportedModels.length} value={fastOverride} onChange={(event) => setFastOverride(event.target.value)}>
                  <option value="">Auto-detect the recommended Fast model</option>
                  {fastOverride && !reportedModels.includes(fastOverride) ? <option value={fastOverride}>Configured but not reported: {fastOverride}</option> : null}
                  {reportedModels.map((model) => <option key={model} value={model}>{model}</option>)}
                </select>
                <small>Select the exact model ID reported by {activeRuntimeLabel}. Sage can use any explicitly assigned local model.</small>
              </label>
              <label>
                PLAN Quality model
                <select disabled={!reportedModels.length} value={qualityOverride} onChange={(event) => setQualityOverride(event.target.value)}>
                  <option value="">Auto-detect the recommended Quality model</option>
                  {qualityOverride && !reportedModels.includes(qualityOverride) ? <option value={qualityOverride}>Configured but not reported: {qualityOverride}</option> : null}
                  {reportedModels.map((model) => <option key={model} value={model}>{model}</option>)}
                </select>
                <small>PLAN can temporarily use the same detected model as Sage if you do not yet have a separate Quality model.</small>
              </label>
            </div>

            <div className={styles.detectedModels}>
              <strong>{activeRuntimeLabel} detected models</strong>
              {reportedModels.length ? (
                <p>{reportedModels.join(" · ")}</p>
              ) : (
                <p>{status?.activeRuntime.reachable
                  ? `${activeRuntimeLabel} is running, but it did not report an installed model. Load/install a model in that runtime and press Refresh readiness.`
                  : "No local runtime is currently reachable."}</p>
              )}
              {reportedModels.length === 1 ? (
                <button type="button" onClick={useOnlyDetectedModelForBoth}>Use this detected model for both Sage + PLAN</button>
              ) : null}
              {reachableRuntimes.length > 1 ? <small>Also detected: {reachableRuntimes.map((runtime) => runtime.label).join(", ")}.</small> : null}
            </div>
          </>
        ) : (
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
        )}

        <div className={styles.footer}>
          <button type="submit" disabled={busy || !status}>{busy ? "Working…" : "Save local AI setup"}</button>
          <button type="button" disabled={busy || !status} onClick={() => void prepareRole("fast")}>{managed ? "Load/test Sage Fast" : "Test Sage Fast"}</button>
          <button type="button" disabled={busy || !status} onClick={() => void prepareRole("quality")}>{managed ? "Load/test PLAN Quality" : "Test PLAN Quality"}</button>
          <button type="button" disabled={busy} onClick={() => void refresh()}>Refresh readiness</button>
        </div>
      </form>

      {message ? <p className={styles.message} role="status">{message}</p> : null}
    </section>
  );
}