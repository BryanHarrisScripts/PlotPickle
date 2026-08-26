"use client";

import { useCallback, useEffect, useState } from "react";

type RuntimeKind = "llama.cpp" | "lm-studio" | "ollama" | "openai-compatible";
type ReadinessState = "recommended-ready" | "recommended-missing" | "recommended-stopped" | "recommended-unhealthy" | "fallback-selected" | "user-override";
type Readiness = {
  schemaVersion: 1;
  checkedAt: string;
  state: ReadinessState;
  hardware: { profile: string; label: string; ramGb: number; gpuName: string; vramGb: number };
  recommended: { runtime: RuntimeKind; model: string; runtimeInstalled: boolean; runtimeRunning: boolean; modelConfigured: boolean };
  actual: { runtime: RuntimeKind; model: string; reachable: boolean };
  override: { active: boolean; runtime: RuntimeKind | "" };
  managedStart: { attempted: boolean; started: boolean; error: string };
  inference: { attempted: boolean; ready: boolean; latencyMs: number; error: string };
  fallbackReason: string;
  action: "none" | "install-repair" | "start-restart" | "review-settings";
  message: string;
};

type Props = { readonly onOpenAdvanced: () => void };

const shell: React.CSSProperties = {
  display: "grid",
  gap: 12,
  margin: "16px 0",
  padding: 16,
  border: "1px solid rgba(124, 241, 223, 0.24)",
  borderRadius: 12,
  background: "rgba(12, 31, 28, 0.8)",
};

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
  gap: 10,
};

const cell: React.CSSProperties = {
  minWidth: 0,
  padding: 10,
  border: "1px solid rgba(241, 232, 199, 0.12)",
  borderRadius: 9,
  background: "rgba(255,255,255,0.025)",
};

function stateLabel(value: ReadinessState) {
  if (value === "recommended-ready") return "Recommended and ready";
  if (value === "recommended-missing") return "Recommended but missing";
  if (value === "recommended-stopped") return "Installed but stopped";
  if (value === "recommended-unhealthy") return "Installed but unhealthy";
  if (value === "user-override") return "Human override";
  return "Fallback selected";
}

async function requestReadiness(start = false) {
  const response = await fetch(start ? "/api/local-ai/runtime/readiness/startup" : "/api/local-ai/runtime/readiness", {
    method: start ? "POST" : "GET",
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  const body = await response.json() as { ok?: boolean; readiness?: Readiness; message?: string };
  if (!response.ok || !body.ok || !body.readiness) throw new Error(body.message || "Local AI readiness could not be verified.");
  return body.readiness;
}

export default function LocalAiReadinessSummary({ onOpenAdvanced }: Props) {
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Verifying recommended local AI...");

  const refresh = useCallback(async (start = false) => {
    setBusy(true);
    try {
      const next = await requestReadiness(start);
      setReadiness(next);
      setMessage(next.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Local AI readiness could not be verified.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { void refresh(false); }, [refresh]);

  return <section style={shell} aria-label="Local AI compute readiness">
    <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", flexWrap: "wrap" }}>
      <div>
        <p style={{ margin: 0, opacity: 0.7, fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase" }}>AI Compute verification</p>
        <h3 style={{ margin: "5px 0" }}>{readiness ? stateLabel(readiness.state) : "Checking this computer"}</h3>
        <p style={{ margin: 0, maxWidth: 820, lineHeight: 1.5, opacity: 0.82 }}>{message}</p>
      </div>
      <button type="button" disabled={busy} onClick={() => void refresh(false)}>{busy ? "Checking..." : "Re-detect hardware"}</button>
    </header>

    {readiness ? <>
      <div style={grid}>
        <div style={cell}><small>Hardware</small><strong style={{ display: "block", marginTop: 4 }}>{readiness.hardware.label}</strong><span>{readiness.hardware.ramGb} GB RAM · {readiness.hardware.gpuName || "No NVIDIA GPU"} · {readiness.hardware.vramGb} GB VRAM</span></div>
        <div style={cell}><small>Recommended</small><strong style={{ display: "block", marginTop: 4 }}>{readiness.recommended.runtime}</strong><span>{readiness.recommended.model}</span><br /><span>{readiness.recommended.runtimeInstalled ? "installed" : "missing"} · {readiness.recommended.runtimeRunning ? "running" : "stopped"} · model {readiness.recommended.modelConfigured ? "configured" : "missing"}</span></div>
        <div style={cell}><small>Actually active</small><strong style={{ display: "block", marginTop: 4 }}>{readiness.actual.runtime}</strong><span>{readiness.actual.model || "No active Fast model"}</span><br /><span>{readiness.actual.reachable ? "runtime reachable" : "runtime unavailable"}</span></div>
        <div style={cell}><small>Inference proof</small><strong style={{ display: "block", marginTop: 4 }}>{readiness.inference.ready ? "READY" : readiness.inference.attempted ? "FAILED" : "NOT CHECKED"}</strong><span>{readiness.inference.ready ? `${readiness.inference.latencyMs} ms bounded probe` : readiness.inference.error}</span></div>
      </div>

      {readiness.fallbackReason ? <p style={{ margin: 0, lineHeight: 1.5 }}><strong>Why they differ:</strong> {readiness.fallbackReason}</p> : null}
      {readiness.override.active ? <p style={{ margin: 0 }}><strong>Human override:</strong> {readiness.override.runtime}</p> : null}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" disabled={busy} onClick={() => void refresh(true)}>Start / restart recommended local AI</button>
        {readiness.action === "install-repair" || readiness.action === "review-settings" ? <button type="button" onClick={onOpenAdvanced}>Install / repair recommended configuration</button> : null}
      </div>
      <p style={{ margin: 0, opacity: 0.72, fontSize: 13 }}>PlotPickle never turns a failed local route into a paid cloud request. Missing runtimes or models stay explicit until you choose a reviewed setup action.</p>
    </> : null}
  </section>;
}
