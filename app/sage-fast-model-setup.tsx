"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import styles from "./sage-fast-model-setup.module.css";

type Role = "fast" | "quality" | "deep";
type RuntimeKind = "llama.cpp" | "lm-studio" | "ollama" | "openai-compatible";

type RuntimeSettings = {
  preferredRuntime: RuntimeKind | "auto";
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

type SageRuntimeStatus = {
  ok: boolean;
  settings: RuntimeSettings;
  activeRuntime: { label: string; reachable: boolean };
  roles: { fast: { recommended: string; selected: string; available: boolean } };
};

export default function SageFastModelSetup() {
  const [status, setStatus] = useState<SageRuntimeStatus | null>(null);
  const [managed, setManaged] = useState(false);
  const [executable, setExecutable] = useState("llama-server");
  const [fastPath, setFastPath] = useState("");
  const [fastOverride, setFastOverride] = useState("");
  const [gpuLayers, setGpuLayers] = useState(99);
  const [message, setMessage] = useState("Checking Sage readiness…");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/local-ai/runtime", { cache: "no-store" });
      const body = await response.json() as SageRuntimeStatus & { message?: string };
      if (!response.ok || !body.ok) throw new Error(body.message || "Sage runtime status is unavailable.");
      setStatus(body);
      setManaged(body.settings.managedLlama.enabled);
      setExecutable(body.settings.managedLlama.executable || "llama-server");
      setFastPath(body.settings.managedLlama.modelPaths.fast || "");
      setFastOverride(body.settings.modelOverrides.fast || "");
      setGpuLayers(body.settings.managedLlama.gpuLayers.fast ?? 99);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sage runtime status is unavailable.");
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!status || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/local-ai/runtime/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferredRuntime: managed ? "llama.cpp" : status.settings.preferredRuntime,
          modelOverrides: {
            ...status.settings.modelOverrides,
            fast: fastOverride.trim(),
          },
          managedLlama: {
            ...status.settings.managedLlama,
            enabled: managed,
            executable: executable.trim(),
            modelPaths: {
              ...status.settings.managedLlama.modelPaths,
              fast: fastPath.trim(),
            },
            gpuLayers: {
              ...status.settings.managedLlama.gpuLayers,
              fast: Math.max(0, Math.min(999, Math.round(gpuLayers))),
            },
          },
        }),
      });
      const body = await response.json() as SageRuntimeStatus & { message?: string };
      if (!response.ok || !body.ok) throw new Error(body.message || "Sage setup could not be saved.");
      setStatus(body);
      setMessage(body.activeRuntime.reachable && body.roles.fast.available
        ? "Sage is ready. Return to LEARN and ask your question again."
        : "Saved. Start the selected runtime or make the Fast model available, then refresh hardware below.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sage setup could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  const ready = Boolean(status?.activeRuntime.reachable && status.roles.fast.available);

  return (
    <section className={styles.panel} aria-labelledby="sage-fast-model-title">
      <div className={styles.heading}>
        <div>
          <p>Fast local role</p>
          <h2 id="sage-fast-model-title">Sage model setup</h2>
        </div>
        <span className={ready ? styles.ready : styles.needsSetup}>{ready ? "Ready for Sage" : "Setup needed"}</span>
      </div>

      {status ? (
        <p className={styles.statusLine}>
          Runtime: <strong>{status.activeRuntime.label}</strong> · Fast model: <strong>{status.roles.fast.selected || status.roles.fast.recommended}</strong>
        </p>
      ) : null}

      <form onSubmit={save}>
        <label>
          Fast model name override
          <input
            value={fastOverride}
            onChange={(event) => setFastOverride(event.target.value)}
            placeholder="Leave blank to auto-detect Qwen3.5-4B"
          />
          <small>Use this when LM Studio, Ollama, or another compatible server reports the installed Fast model under a different name.</small>
        </label>

        <label className={styles.checkboxRow}>
          <input type="checkbox" checked={managed} onChange={(event) => setManaged(event.target.checked)} />
          <span><strong>Manage llama.cpp for Sage</strong><small>When enabled, PlotPickle starts the configured Fast GGUF automatically when Sage needs it.</small></span>
        </label>

        <div className={styles.grid} aria-disabled={!managed}>
          <label>
            llama.cpp server executable
            <input disabled={!managed} value={executable} onChange={(event) => setExecutable(event.target.value)} placeholder="llama-server" />
          </label>
          <label>
            Fast GGUF model path
            <input disabled={!managed} value={fastPath} onChange={(event) => setFastPath(event.target.value)} placeholder="C:\\...\\Qwen3.5-4B-Q6_K.gguf" />
          </label>
          <label>
            Fast GPU layers
            <input disabled={!managed} min={0} max={999} type="number" value={gpuLayers} onChange={(event) => setGpuLayers(Number(event.target.value) || 0)} />
          </label>
        </div>

        <div className={styles.footer}>
          <button type="submit" disabled={busy || !status}>{busy ? "Saving…" : "Save Sage setup"}</button>
          <button type="button" disabled={busy} onClick={() => void refresh()}>Refresh Sage readiness</button>
        </div>
      </form>

      {message ? <p className={styles.message} role="status">{message}</p> : null}
    </section>
  );
}
