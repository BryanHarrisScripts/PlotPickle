"use client";

import { useCallback, useEffect, useState } from "react";

type RuntimeKind = "llama.cpp" | "lm-studio" | "ollama" | "openai-compatible";
type RoleStatus = { recommended: string; selected: string; available: boolean; production: true };

type RuntimeStatus = {
  ok: boolean;
  hardware: {
    cpuModel: string;
    cpuThreads: number;
    ramGb: number;
    gpuName: string;
    vramGb: number;
    gpuGeneration: string;
    profile: { id: string; label: string };
    compatibility: {
      pytorchCuda: string;
      prohibitCuda13PyTorch: boolean;
      preferLlamaCppCuda12: boolean;
      allowVulkanFallback: boolean;
      cpuGpuSplit: boolean;
    };
  };
  settings: {
    preferredRuntime: RuntimeKind | "auto";
    contextTokens: 16384 | 32768;
  };
  runtimes: Array<{
    kind: RuntimeKind;
    label: string;
    baseUrl: string;
    reachable: boolean;
    models: string[];
    error: string;
  }>;
  activeRuntime: { kind: RuntimeKind; label: string; baseUrl: string; reachable: boolean; error: string };
  roles: { fast: RoleStatus; quality: RoleStatus; deep: RoleStatus };
  retrieval: { embedding: string; reranker: string; cpuResident: true };
  image: { workflow: string; experimental: string };
  video: { workflow: string };
  healthCheckModel: { model: string; productionEligible: false };
  scheduler: { activeTask: string; lastAction: string; lastWarning: string };
};

const panel: React.CSSProperties = {
  border: "1px solid #23443f",
  borderRadius: 14,
  background: "#10211f",
  color: "#e9f4f1",
  padding: 20,
  margin: "18px 22px",
  fontFamily: "system-ui, sans-serif",
};

const card: React.CSSProperties = {
  border: "1px solid #315b54",
  borderRadius: 10,
  padding: 14,
  background: "#142a27",
};

function badge(ok: boolean) {
  return {
    display: "inline-block",
    border: "1px solid currentColor",
    borderRadius: 999,
    padding: "2px 8px",
    fontSize: 12,
    opacity: ok ? 1 : 0.72,
  } as React.CSSProperties;
}

export default function LocalRuntimePanel() {
  const [status, setStatus] = useState<RuntimeStatus | null>(null);
  const [message, setMessage] = useState("Detecting local compute...");
  const [busy, setBusy] = useState(false);
  const [installPlan, setInstallPlan] = useState<Record<string, unknown> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/local-ai/runtime", { cache: "no-store" });
      const body = await response.json() as RuntimeStatus & { message?: string };
      if (!response.ok || !body.ok) throw new Error(body.message || "Local runtime detection failed.");
      setStatus(body);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Local runtime detection failed.");
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function saveSetting(patch: Record<string, unknown>) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/local-ai/runtime/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = await response.json() as RuntimeStatus & { message?: string };
      if (!response.ok || !body.ok) throw new Error(body.message || "The local runtime setting could not be saved.");
      setStatus(body);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The local runtime setting could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function reviewInstallPlan() {
    setBusy(true);
    try {
      const response = await fetch("/api/local-ai/runtime/install-plan", { cache: "no-store" });
      const body = await response.json() as Record<string, unknown> & { message?: string };
      if (!response.ok) throw new Error(body.message || "The installation plan could not be created.");
      setInstallPlan(body);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The installation plan could not be created.");
    } finally {
      setBusy(false);
    }
  }

  const roles = status ? (["fast", "quality", "deep"] as const) : [];

  return (
    <section style={panel} aria-label="Hardware-aware local AI runtime">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "start", flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: 0, opacity: 0.72, fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase" }}>Local Compute Router</p>
          <h1 style={{ margin: "5px 0 8px", fontSize: 24 }}>Hardware-Aware Local AI</h1>
          <p style={{ margin: 0, maxWidth: 760, lineHeight: 1.5, color: "#b9d2cd" }}>
            PlotPickle uses one OpenAI-compatible local interface. llama.cpp is preferred; LM Studio, Ollama and future compatible servers remain interchangeable runtimes underneath it.
          </p>
        </div>
        <button type="button" disabled={busy} onClick={() => void refresh()} style={{ padding: "8px 12px" }}>Refresh hardware</button>
      </div>

      {message ? <p role="alert" style={{ marginTop: 16 }}>{message}</p> : null}

      {status ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 12, marginTop: 18 }}>
            <div style={card}>
              <strong>{status.hardware.profile.label}</strong>
              <p style={{ margin: "8px 0 0", lineHeight: 1.45, color: "#b9d2cd" }}>
                {status.hardware.cpuModel} · {status.hardware.cpuThreads} threads<br />
                {status.hardware.ramGb} GB RAM<br />
                {status.hardware.gpuName || "No NVIDIA GPU detected"} · {status.hardware.vramGb} GB VRAM
              </p>
            </div>
            <div style={card}>
              <strong>Compatibility policy</strong>
              <p style={{ margin: "8px 0 0", lineHeight: 1.45, color: "#b9d2cd" }}>
                GPU generation: {status.hardware.gpuGeneration}<br />
                PyTorch/CUDA: {status.hardware.compatibility.pytorchCuda}<br />
                CPU/GPU splitting: {status.hardware.compatibility.cpuGpuSplit ? "enabled" : "not required"}<br />
                Vulkan fallback: {status.hardware.compatibility.allowVulkanFallback ? "available" : "off"}
              </p>
              {status.hardware.compatibility.prohibitCuda13PyTorch ? (
                <p style={{ margin: "8px 0 0" }}>Pascal guard is active: CUDA 13-targeted PyTorch packages will not be selected automatically.</p>
              ) : null}
            </div>
            <div style={card}>
              <strong>GPU scheduler</strong>
              <p style={{ margin: "8px 0 0", lineHeight: 1.45, color: "#b9d2cd" }}>
                Active task: {status.scheduler.activeTask}<br />
                {status.scheduler.lastAction}
              </p>
              {status.scheduler.lastWarning ? <p style={{ margin: "8px 0 0" }}>{status.scheduler.lastWarning}</p> : null}
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <h2 style={{ fontSize: 18, marginBottom: 10 }}>Runtime</h2>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <label>
                Preferred engine{" "}
                <select
                  value={status.settings.preferredRuntime}
                  disabled={busy}
                  onChange={(event) => void saveSetting({ preferredRuntime: event.target.value })}
                >
                  <option value="auto">Automatic: prefer llama.cpp</option>
                  <option value="llama.cpp">llama.cpp</option>
                  <option value="lm-studio">LM Studio</option>
                  <option value="ollama">Ollama</option>
                  <option value="openai-compatible">Other OpenAI-compatible</option>
                </select>
              </label>
              <label>
                Context{" "}
                <select
                  value={status.settings.contextTokens}
                  disabled={busy}
                  onChange={(event) => void saveSetting({ contextTokens: Number(event.target.value) })}
                >
                  <option value={16384}>16K default</option>
                  <option value={32768}>32K extended</option>
                </select>
              </label>
              <span style={badge(status.activeRuntime.reachable)}>{status.activeRuntime.reachable ? "Ready" : "Not running"}: {status.activeRuntime.label}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10, marginTop: 12 }}>
              {status.runtimes.map((runtime) => (
                <div style={card} key={runtime.kind}>
                  <strong>{runtime.label}</strong>{" "}<span style={badge(runtime.reachable)}>{runtime.reachable ? "detected" : "available option"}</span>
                  <p style={{ margin: "7px 0 0", color: "#b9d2cd", wordBreak: "break-word" }}>{runtime.baseUrl}</p>
                  <p style={{ margin: "5px 0 0", color: "#b9d2cd" }}>{runtime.models.length} model(s) reported</p>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <h2 style={{ fontSize: 18, marginBottom: 10 }}>Model roles</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
              {roles.map((roleName) => {
                const role = status.roles[roleName];
                return (
                  <div style={card} key={roleName}>
                    <strong style={{ textTransform: "capitalize" }}>{roleName}</strong>{" "}<span style={badge(role.available)}>{role.available ? "installed" : "recommended"}</span>
                    <p style={{ margin: "7px 0 0" }}>{role.recommended}</p>
                    <p style={{ margin: "5px 0 0", color: "#b9d2cd" }}>Selected: {role.selected || "not installed/detected"}</p>
                  </div>
                );
              })}
              <div style={card}>
                <strong>Curriculum retrieval</strong>
                <p style={{ margin: "7px 0 0" }}>{status.retrieval.embedding}<br />{status.retrieval.reranker}</p>
                <p style={{ margin: "5px 0 0", color: "#b9d2cd" }}>CPU-resident; retrieved and reranked curriculum only enters the active LLM context.</p>
              </div>
              <div style={card}>
                <strong>Local images</strong>
                <p style={{ margin: "7px 0 0" }}>{status.image.workflow}</p>
                <p style={{ margin: "5px 0 0", color: "#b9d2cd" }}>ComfyUI default. {status.image.experimental} remains experimental on 8 GB.</p>
              </div>
              <div style={card}>
                <strong>Local video</strong>
                <p style={{ margin: "7px 0 0" }}>{status.video.workflow}</p>
                <p style={{ margin: "5px 0 0", color: "#b9d2cd" }}>ComfyUI lightweight profile. Larger video models unlock through higher-memory hardware profiles.</p>
              </div>
              <div style={card}>
                <strong>Diagnostics only</strong>
                <p style={{ margin: "7px 0 0" }}>{status.healthCheckModel.model}</p>
                <p style={{ margin: "5px 0 0", color: "#b9d2cd" }}>Installer and runtime health checks only; never eligible for Creative Room or production story routing.</p>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 18, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" disabled={busy} onClick={() => void reviewInstallPlan()} style={{ padding: "9px 13px" }}>Review missing-runtime and model plan</button>
            <span style={{ color: "#b9d2cd" }}>Advanced users can override runtime, 32K context, endpoints, model names, llama.cpp paths and GPU-layer splits.</span>
          </div>
          {installPlan ? (
            <pre style={{ marginTop: 12, maxHeight: 280, overflow: "auto", whiteSpace: "pre-wrap", background: "#0b1816", padding: 12, borderRadius: 8 }}>
              {JSON.stringify(installPlan, null, 2)}
            </pre>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
