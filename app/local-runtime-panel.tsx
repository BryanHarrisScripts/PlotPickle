"use client";

import { useCallback, useEffect, useState } from "react";

type RuntimeKind = "llama.cpp" | "lm-studio" | "ollama" | "openai-compatible";
type CapabilityRole = "fast" | "quality" | "deep" | "vision" | "repair";
type ModelPreference = "fastest" | "balanced" | "best-quality" | "lowest-memory";
type Throughput = {
  source: "measured" | "estimated" | "unknown" | string;
  mid: number;
  low: number;
  high: number;
};
type RoleStatus = {
  recommended: string;
  selected: string;
  available: boolean;
  production: boolean;
  automatic: boolean;
  metadataSource: string;
  fit: string;
  parameterSize: string;
  contextTokens: number;
  capabilities: string[];
  recommendationScore: number;
  reasons: string[];
  throughput: Throughput;
  workingSetGb: number;
};
type ModelDescriptor = {
  id: string;
  family: string;
  parameterSize: string;
  quantization: string;
  contextTokens: number;
  capabilities: Record<string, boolean>;
  metadataSource: string;
};
type CatalogModel = ModelDescriptor & {
  fit: { id: string; label: string; workingSetGb: number };
  throughput: Throughput;
  acceleration: { recommended: boolean; reason: string; gainPercent: number; headroomGb: number };
};
type RecommendationProfile = {
  id: ModelPreference;
  label: string;
  description: string;
  roles: Record<CapabilityRole, string>;
  primaryModel: string;
  primaryFit: string;
  workingSetGb: number;
  throughput: Throughput;
};

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
    modelPreference: ModelPreference;
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
  roles: Record<CapabilityRole, RoleStatus>;
  modelInventory: ModelDescriptor[];
  modelCatalog: CatalogModel[];
  recommendationProfiles: RecommendationProfile[];
  benchmarkEvidence: { measuredModels: number; source: string };
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

const ROLE_LABELS: Record<CapabilityRole, string> = {
  fast: "Fast",
  quality: "Quality",
  deep: "Deep reasoning",
  vision: "Vision / Visual QA",
  repair: "Pi / Repair",
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

function capabilityList(model: ModelDescriptor) {
  return Object.entries(model.capabilities).flatMap(([name, enabled]) => enabled ? [name] : []);
}

function speedLabel(throughput: Throughput) {
  if (!throughput?.mid) return "Speed estimate unavailable";
  if (throughput.source === "measured") return `${throughput.mid} tok/s measured on this computer`;
  return `${throughput.low}–${throughput.high} tok/s estimated`;
}

export default function LocalRuntimePanel() {
  const [status, setStatus] = useState<RuntimeStatus | null>(null);
  const [message, setMessage] = useState("Detecting local compute...");
  const [busy, setBusy] = useState(false);
  const [installPlan, setInstallPlan] = useState<Record<string, unknown> | null>(null);

  const refresh = useCallback(async (announce = false) => {
    try {
      const response = await fetch("/api/local-ai/runtime", { cache: "no-store" });
      const body = await response.json() as RuntimeStatus & { message?: string };
      if (!response.ok || !body.ok) throw new Error(body.message || "Local runtime detection failed.");
      setStatus(body);
      setMessage(announce ? `Hardware and model inventory refreshed at ${new Date().toLocaleTimeString()}.` : "");
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
      setMessage("Local AI preference saved and model slots recalculated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The local runtime setting could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function reviewInstallPlan() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/local-ai/runtime/install-plan", { cache: "no-store" });
      const body = await response.json() as Record<string, unknown> & { message?: string };
      if (!response.ok) throw new Error(body.message || "The installation plan could not be created.");
      setInstallPlan(body);
      setMessage("Missing-runtime and model plan is ready below.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The installation plan could not be created.");
    } finally {
      setBusy(false);
    }
  }

  const roles = status ? (["fast", "quality", "deep", "vision", "repair"] as const) : [];

  return (
    <section style={panel} aria-label="Hardware-aware local AI runtime">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "start", flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: 0, opacity: 0.72, fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase" }}>Local Compute Router</p>
          <h1 style={{ margin: "5px 0 8px", fontSize: 24 }}>Hardware-Aware Local AI</h1>
          <p style={{ margin: 0, maxWidth: 800, lineHeight: 1.5, color: "#b9d2cd" }}>
            PlotPickle detects this computer, checks the models already available through your local runtime, estimates what will fit and how quickly it should run, then assigns capable models to Fast, Quality, Deep, Vision and Pi/Repair work.
          </p>
        </div>
        <button type="button" disabled={busy} onClick={() => void refresh(true)} style={{ padding: "8px 12px" }}>Refresh hardware and models</button>
      </div>

      {message ? <p role="status" aria-live="polite" style={{ marginTop: 16 }}>{message}</p> : null}

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
              <strong>Speed evidence</strong>
              <p style={{ margin: "8px 0 0", lineHeight: 1.45, color: "#b9d2cd" }}>
                {status.benchmarkEvidence.measuredModels
                  ? `${status.benchmarkEvidence.measuredModels} model(s) have local measured speed evidence.`
                  : "No benchmark is required. PlotPickle is using conservative estimates until local measured evidence exists."}
              </p>
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <h2 style={{ fontSize: 18, marginBottom: 5 }}>Choose what matters most</h2>
            <p style={{ margin: "0 0 12px", color: "#b9d2cd", lineHeight: 1.5 }}>
              This changes how PlotPickle ranks the models you already have. It does not install another runtime, switch to paid cloud AI, or remove the capability checks for each job.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 10 }}>
              {status.recommendationProfiles.map((profile) => {
                const selected = status.settings.modelPreference === profile.id;
                return (
                  <button
                    type="button"
                    key={profile.id}
                    disabled={busy || selected}
                    aria-pressed={selected}
                    onClick={() => void saveSetting({ modelPreference: profile.id })}
                    style={{
                      ...card,
                      color: "inherit",
                      textAlign: "left",
                      cursor: selected ? "default" : "pointer",
                      border: selected ? "2px solid #8ee0d5" : card.border,
                    }}
                  >
                    <strong>{profile.label}</strong>{" "}{selected ? <span style={badge(true)}>selected</span> : null}
                    <p style={{ margin: "8px 0 0", color: "#b9d2cd", lineHeight: 1.45 }}>{profile.description}</p>
                    <p style={{ margin: "8px 0 0", fontWeight: 700 }}>{profile.primaryModel || "No suitable installed model yet"}</p>
                    {profile.primaryModel ? (
                      <p style={{ margin: "5px 0 0", color: "#b9d2cd", lineHeight: 1.45 }}>
                        {speedLabel(profile.throughput)}<br />
                        {profile.workingSetGb ? `${profile.workingSetGb.toFixed(1)} GB estimated working set` : "Memory estimate unavailable"}
                        {profile.primaryFit ? ` · ${profile.primaryFit}` : ""}
                      </p>
                    ) : null}
                  </button>
                );
              })}
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
            <h2 style={{ fontSize: 18, marginBottom: 5 }}>Automatic model slots</h2>
            <p style={{ margin: "0 0 12px", color: "#b9d2cd", lineHeight: 1.5 }}>
              The simple preference above changes ranking, but every slot still requires the right capabilities. Vision still needs visual understanding; Pi/Repair still needs coding or tool capability.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(235px, 1fr))", gap: 10 }}>
              {roles.map((roleName) => {
                const role = status.roles[roleName];
                return (
                  <div style={card} key={roleName}>
                    <strong>{ROLE_LABELS[roleName]}</strong>{" "}
                    <span style={badge(role.available)}>{role.available ? role.automatic ? "auto" : "override" : "no match"}</span>
                    <p style={{ margin: "8px 0 0", fontWeight: 700 }}>{role.selected || "No suitable installed model"}</p>
                    <p style={{ margin: "5px 0 0", color: "#b9d2cd", lineHeight: 1.45 }}>
                      Recommended: {role.recommended}<br />
                      {role.parameterSize ? `Size: ${role.parameterSize}` : "Size: unknown"}{role.fit ? ` · ${role.fit}` : ""}<br />
                      {role.workingSetGb ? `Working set: ${role.workingSetGb.toFixed(1)} GB` : "Working set: unknown"}<br />
                      {speedLabel(role.throughput)}<br />
                      {role.contextTokens ? `Model context: ${Math.round(role.contextTokens / 1024)}K` : "Model context: not reported"}
                    </p>
                    {role.capabilities.length ? (
                      <p style={{ margin: "7px 0 0", color: "#8ee0d5", fontSize: 12 }}>Capabilities: {role.capabilities.join(", ")}</p>
                    ) : null}
                    {role.reasons.length ? (
                      <p style={{ margin: "6px 0 0", color: "#a7beb9", fontSize: 11, lineHeight: 1.45 }}>{role.reasons.join(" · ")}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <h2 style={{ fontSize: 18, marginBottom: 5 }}>Detected model capabilities</h2>
            <p style={{ margin: "0 0 12px", color: "#b9d2cd", lineHeight: 1.5 }}>
              This is the technical catalog behind the simple choices. Speed is estimated before any benchmark. If PlotPickle later has measured evidence for a model, the measured value replaces the estimate automatically.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 10 }}>
              {status.modelCatalog.length ? status.modelCatalog.map((model) => (
                <div style={card} key={model.id}>
                  <strong style={{ wordBreak: "break-word" }}>{model.id}</strong>
                  <p style={{ margin: "7px 0 0", color: "#b9d2cd", lineHeight: 1.45 }}>
                    {model.parameterSize || "size unknown"}{model.quantization ? ` · ${model.quantization}` : ""}<br />
                    {model.fit.label || "hardware fit unknown"}{model.fit.workingSetGb ? ` · ${model.fit.workingSetGb.toFixed(1)} GB working set` : ""}<br />
                    {speedLabel(model.throughput)}<br />
                    {model.contextTokens ? `${Math.round(model.contextTokens / 1024)}K max context` : "context not reported"}<br />
                    Metadata: {model.metadataSource}
                  </p>
                  <p style={{ margin: "7px 0 0", color: "#8ee0d5", fontSize: 12 }}>
                    {capabilityList(model).length ? capabilityList(model).join(", ") : "No special capability metadata detected"}
                  </p>
                  <p style={{ margin: "7px 0 0", color: model.acceleration.recommended ? "#8ee0d5" : "#a7beb9", fontSize: 11, lineHeight: 1.45 }}>
                    Speculative decoding: {model.acceleration.recommended ? "recommended from measured evidence" : "off"}. {model.acceleration.reason}
                  </p>
                </div>
              )) : <div style={card}>No models were reported by the active local runtime.</div>}
            </div>
          </div>

          <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
            <div style={card}>
              <strong>Curriculum retrieval</strong>
              <p style={{ margin: "7px 0 0" }}>{status.retrieval.embedding}<br />{status.retrieval.reranker}</p>
              <p style={{ margin: "5px 0 0", color: "#b9d2cd" }}>CPU-resident; retrieved and reranked curriculum only enters the active LLM context.</p>
            </div>
            <div style={card}>
              <strong>Local image generation</strong>
              <p style={{ margin: "7px 0 0" }}>{status.image.workflow}</p>
              <p style={{ margin: "5px 0 0", color: "#b9d2cd" }}>Separate from the Vision / Visual QA understanding slot. ComfyUI remains the image-generation runtime.</p>
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

          <div style={{ marginTop: 18, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" disabled={busy} onClick={() => void reviewInstallPlan()} style={{ padding: "9px 13px" }}>Review missing-runtime and model plan</button>
            <span style={{ color: "#b9d2cd" }}>Advanced overrides remain available, but automatic capability matching is the default.</span>
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
