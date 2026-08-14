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

type ModelRoleStatus = {
  recommended: string;
  selected: string;
  available: boolean;
};

type LocalRuntimeStatus = {
  ok: boolean;
  settings: RuntimeSettings;
  activeRuntime: { label: string; reachable: boolean };
  roles: {
    fast: ModelRoleStatus;
    quality: ModelRoleStatus;
    deep: ModelRoleStatus;
  };
};

export default function SageFastModelSetup() {
  const [status, setStatus] = useState<LocalRuntimeStatus | null>(null);
  const [managed, setManaged] = useState(false);
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
    setStatus(body);
    setManaged(body.settings.managedLlama.enabled);
    setExecutable(body.settings.managedLlama.executable || "llama-server");
    setFastPath(body.settings.managedLlama.modelPaths.fast || "");
    setQualityPath(body.settings.managedLlama.modelPaths.quality || "");
    setFastOverride(body.settings.modelOverrides.fast || "");
    setQualityOverride(body.settings.modelOverrides.quality || "");
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
      setMessage("Saved. Use the readiness buttons below to load/test the Fast role for Sage and the Quality role for PLAN.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Local AI setup could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function prepareRole(role: "fast" | "quality") {
    if (busy) return;
    setBusy(true);
    setMessage(role === "fast" ? "Preparing Sage's Fast model…" : "Preparing PLAN's Quality model…");
    try {
      const response = await fetch(`/api/local-ai/runtime/model/${role}/load`, {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      const body = await response.json() as LocalRuntimeStatus & { message?: string };
      if (!response.ok || !body.ok) throw new Error(body.message || `The ${role} model could not be prepared.`);
      hydrate(body);
      const ready = body.activeRuntime.reachable && body.roles[role].available;
      setMessage(ready
        ? role === "fast"
          ? "Sage is ready. Return to LEARN and ask your question again."
          : "PLAN local drafting is ready. Return to PLAN and use Draft with local AI."
        : `The ${role === "fast" ? "Fast" : "Quality"} role is still not reported by the selected runtime. Check the model name/path and runtime below.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `The ${role} model could not be prepared.`);
    } finally {
      setBusy(false);
    }
  }

  const sageReady = Boolean(status?.activeRuntime.reachable && status.roles.fast.available);
  const planReady = Boolean(status?.activeRuntime.reachable && status.roles.quality.available);
  const allReady = sageReady && planReady;

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
          Runtime: <strong>{status.activeRuntime.label}</strong><br />
          Sage / Fast: <strong>{status.roles.fast.selected || status.roles.fast.recommended}</strong> — {sageReady ? "ready" : "not ready"}<br />
          PLAN / Quality: <strong>{status.roles.quality.selected || status.roles.quality.recommended}</strong> — {planReady ? "ready" : "not ready"}
        </p>
      ) : null}

      <form onSubmit={save}>
        <div className={styles.grid}>
          <label>
            Sage Fast model name override
            <input
              type="text"
              value={fastOverride}
              onChange={(event) => setFastOverride(event.target.value)}
              placeholder="Leave blank to auto-detect Qwen3.5-4B"
            />
            <small>For LM Studio, Ollama, or another compatible server when its reported model ID differs from PlotPickle&apos;s recommendation.</small>
          </label>
          <label>
            PLAN Quality model name override
            <input
              type="text"
              value={qualityOverride}
              onChange={(event) => setQualityOverride(event.target.value)}
              placeholder="Leave blank to auto-detect Qwen3.5-9B"
            />
            <small>PLAN&apos;s draft proposals use the Quality role, so this must be available as well as Sage&apos;s Fast role.</small>
          </label>
          <div />
        </div>

        <label className={styles.checkboxRow}>
          <input type="checkbox" checked={managed} onChange={(event) => setManaged(event.target.checked)} />
          <span><strong>Let PlotPickle manage llama.cpp role switching</strong><small>When enabled, PlotPickle loads the configured Fast or Quality GGUF on demand, so an 8 GB GPU does not keep both text models resident.</small></span>
        </label>

        <div className={styles.grid} aria-disabled={!managed}>
          <label>
            llama.cpp server executable
            <input type="text" disabled={!managed} value={executable} onChange={(event) => setExecutable(event.target.value)} placeholder="llama-server" />
          </label>
          <label>
            Sage Fast GGUF model path
            <input type="text" disabled={!managed} value={fastPath} onChange={(event) => setFastPath(event.target.value)} placeholder="C:\\...\\Qwen3.5-4B-Q6_K.gguf" />
          </label>
          <label>
            Fast GPU layers
            <input disabled={!managed} min={0} max={999} type="number" value={fastGpuLayers} onChange={(event) => setFastGpuLayers(Number(event.target.value) || 0)} />
          </label>
          <label>
            <span aria-hidden="true">&nbsp;</span>
            <small>One managed executable serves both roles.</small>
          </label>
          <label>
            PLAN Quality GGUF model path
            <input type="text" disabled={!managed} value={qualityPath} onChange={(event) => setQualityPath(event.target.value)} placeholder="C:\\...\\Qwen3.5-9B-Q4_K_M.gguf" />
          </label>
          <label>
            Quality GPU layers
            <input disabled={!managed} min={0} max={999} type="number" value={qualityGpuLayers} onChange={(event) => setQualityGpuLayers(Number(event.target.value) || 0)} />
          </label>
        </div>

        <div className={styles.footer}>
          <button type="submit" disabled={busy || !status}>{busy ? "Working…" : "Save local AI setup"}</button>
          <button type="button" disabled={busy || !status} onClick={() => void prepareRole("fast")}>Load/test Sage Fast</button>
          <button type="button" disabled={busy || !status} onClick={() => void prepareRole("quality")}>Load/test PLAN Quality</button>
          <button type="button" disabled={busy} onClick={() => void refresh()}>Refresh readiness</button>
        </div>
      </form>

      {message ? <p className={styles.message} role="status">{message}</p> : null}
    </section>
  );
}
