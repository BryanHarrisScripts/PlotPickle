"use client";

import { useEffect, useState } from "react";

const VIDEO_PLUGIN_API = "/api/local-ai/plugins/video";
const COMFY_START_API = "/api/media-routing/comfyui/start";
const LOCAL_COMFY_URL = "http://127.0.0.1:8188";

const panel: React.CSSProperties = {
  border: "var(--pp-skin-border-thin) solid var(--pp-skin-accent)",
  background: "var(--pp-skin-surface-1)",
  color: "var(--pp-skin-ink)",
  padding: 18,
  fontFamily: "var(--pp-skin-font-ui)",
  boxShadow: "var(--pp-skin-shadow-control)",
};

const card: React.CSSProperties = {
  border: "var(--pp-skin-border-thin) solid var(--pp-skin-line)",
  background: "var(--pp-skin-surface-2)",
  padding: 14,
};

const row: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
};

const primaryButton: React.CSSProperties = {
  minHeight: "var(--pp-skin-touch-target)",
  padding: "10px 18px",
  border: "var(--pp-skin-border-thin) solid var(--pp-skin-accent-bright)",
  borderRadius: "var(--pp-skin-radius)",
  background: "var(--pp-skin-accent-deep)",
  color: "var(--pp-skin-ink)",
  font: "inherit",
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "var(--pp-skin-shadow-control)",
};

type LocalPlugin = {
  id: string;
  label: string;
  description: string;
  runtimeProviderId: string;
  adapterId: string;
  modes: string[];
  advanced: boolean;
  preset: string;
  hardwarePriority: number;
};

type VideoRecommendation = {
  capability: "video";
  automatic: boolean;
  hardwareProfileId: string;
  selected: LocalPlugin | null;
  candidates: LocalPlugin[];
  ready: boolean;
  active: boolean;
  configured?: boolean;
  runtimeReady?: boolean;
  error: string;
  details?: Record<string, unknown>;
};

type VideoPluginResponse = {
  ok: boolean;
  hardware: {
    profileId: string;
    profileLabel: string;
    gpuName: string;
    gpuGeneration: string;
    vramGb: number;
    ramGb: number;
  };
  recommendation: VideoRecommendation;
};

type StartResponse = {
  ready: boolean;
  state: string;
  message: string;
};

async function request<T>(path: string, method: "GET" | "POST" = "GET", body?: object) {
  const response = await fetch(path, {
    method,
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json", Accept: "application/json" } : { Accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) throw new Error("The local video plug-in gateway is unavailable.");
  const value = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(value.message || "The local video plug-in request failed.");
  return value;
}

function announceReadyChange() {
  window.dispatchEvent(new CustomEvent("plotpickle:setup-status-refresh"));
}

function detailList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export default function LocalVideoPanel() {
  const [status, setStatus] = useState<VideoPluginResponse | null>(null);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("Checking PlotPickle's hardware-optimized local video plug-in...");

  async function refresh() {
    try {
      const next = await request<VideoPluginResponse>(VIDEO_PLUGIN_API);
      setStatus(next);
      const recommendation = next.recommendation;
      if (!recommendation.selected) {
        setNotice(recommendation.error || "No reviewed local video plug-in matches this hardware profile.");
      } else if (recommendation.ready && recommendation.active) {
        setNotice(`VIDEO READY — ${recommendation.selected.label} is the hardware-optimized local video plug-in.`);
        announceReadyChange();
      } else {
        setNotice(recommendation.error || `${recommendation.selected.label} needs local setup before VIDEO can turn green.`);
      }
      return next;
    } catch (error) {
      setStatus(null);
      setNotice(error instanceof Error ? error.message : "Local video plug-in status could not be checked.");
      return null;
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function runDefault() {
    if (working) return;
    setWorking(true);
    setNotice("Starting PlotPickle's hardware-optimized local video path...");
    try {
      let next = await request<VideoPluginResponse>(VIDEO_PLUGIN_API);
      if (!next.recommendation.runtimeReady) {
        await request<StartResponse>(COMFY_START_API, "POST", { approved: true });
        next = await request<VideoPluginResponse>(VIDEO_PLUGIN_API);
      }
      setStatus(next);
      if (!next.recommendation.runtimeReady) {
        throw new Error(`ComfyUI did not become ready at ${LOCAL_COMFY_URL}.`);
      }
      if (!next.recommendation.selected) {
        throw new Error(next.recommendation.error || "No reviewed local video plug-in matches this hardware profile.");
      }
      if (!next.recommendation.ready || !next.recommendation.active) {
        setNotice(next.recommendation.error || `${next.recommendation.selected.label} still needs its reviewed workflow and local model files.`);
        return;
      }
      setNotice(`VIDEO READY — ${next.recommendation.selected.label} is active locally through ComfyUI.`);
      announceReadyChange();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "PlotPickle could not start the local video default.");
      await refresh();
    } finally {
      setWorking(false);
    }
  }

  const recommendation = status?.recommendation ?? null;
  const selected = recommendation?.selected ?? null;
  const runtimeReady = Boolean(recommendation?.runtimeReady);
  const activeReady = Boolean(selected && recommendation?.ready && recommendation?.active);
  const configured = Boolean(recommendation?.configured);
  const missingNodes = detailList(recommendation?.details?.missingNodes);
  const missingModels = detailList(recommendation?.details?.missingModels);

  return (
    <section style={panel} aria-labelledby="local-video-title">
      <header style={{ ...row, justifyContent: "space-between", alignItems: "start" }}>
        <div>
          <p style={{ margin: 0, color: "var(--pp-skin-accent-bright)", fontSize: 12 }}>LOCAL AI / VIDEO</p>
          <h2 id="local-video-title" style={{ margin: "5px 0 8px" }}>PLOTPICKLE VIDEO DEFAULT</h2>
          <p style={{ margin: 0, fontSize: 16 }}><strong>{selected?.label?.toUpperCase() || "AUTOMATIC / HARDWARE OPTIMIZED"}</strong></p>
          <p style={{ margin: "8px 0 0", maxWidth: 850, lineHeight: 1.5, color: "var(--pp-skin-ink-soft)" }}>
            PlotPickle selects the best reviewed local video plug-in for this computer. ComfyUI at {LOCAL_COMFY_URL} remains the managed runtime underneath the selected model and workflow.
          </p>
        </div>
        <span style={{ border: `var(--pp-skin-border-thin) solid ${activeReady ? "var(--pp-skin-accent-bright)" : "var(--pp-skin-line)"}`, padding: "5px 9px", color: activeReady ? "var(--pp-skin-accent-bright)" : "var(--pp-skin-ink-muted)" }}>
          {activeReady ? "READY" : "NEEDS ATTENTION"}
        </span>
      </header>

      <div style={{ ...card, marginTop: 16, background: "var(--pp-skin-surface-2)" }}>
        <div style={{ ...row, justifyContent: "space-between" }}>
          <div>
            <strong>{activeReady ? "LOCAL VIDEO IS ACTIVE" : "RUN PLOTPICKLE LOCAL VIDEO"}</strong>
            <p style={{ margin: "6px 0 0", color: "var(--pp-skin-ink-soft)", lineHeight: 1.45 }}>
              {selected ? `Selected automatically: ${selected.label}. ${selected.preset}.` : "PlotPickle is checking this computer for a compatible local video plug-in."}
            </p>
          </div>
          <button type="button" style={primaryButton} onClick={() => void runDefault()} disabled={working || activeReady}>
            {activeReady ? "READY" : working ? "RUNNING..." : "RUN"}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10, marginTop: 12 }}>
        <div style={card}>
          <strong>ComfyUI Service</strong>
          <p>{status === null ? "CHECKING..." : runtimeReady ? "READY" : "STOPPED"}</p>
          <small>Managed runtime dependency</small>
        </div>
        <div style={card}>
          <strong>Video Plug-in</strong>
          <p>{selected?.label || "CHECKING..."}</p>
          <small>{selected ? (recommendation?.ready ? "READY" : "SETUP NEEDED") : "Hardware selection pending"}</small>
        </div>
        <div style={card}>
          <strong>Hardware Profile</strong>
          <p>{status?.hardware.profileLabel || "CHECKING..."}</p>
          <small>{status ? `${status.hardware.gpuName || "CPU"} / ${status.hardware.vramGb} GB VRAM` : "Detecting local hardware"}</small>
        </div>
        <div style={card}>
          <strong>Video</strong>
          <p>{activeReady ? "ACTIVE / GREEN" : "INACTIVE"}</p>
          <small>{activeReady ? `${selected?.label} is ready.` : selected ? `Waiting for ${selected.label} readiness.` : "Waiting for hardware selection."}</small>
        </div>
      </div>

      {status ? (
        <div style={{ ...card, marginTop: 12 }}>
          <strong>LOCAL VIDEO STATUS</strong>
          <p style={{ margin: "10px 0 5px" }}>SELECTION: AUTOMATIC / HARDWARE OPTIMIZED</p>
          <p style={{ margin: "0 0 5px" }}>PLUGIN: {selected?.id || "NONE"}</p>
          <p style={{ margin: "0 0 5px" }}>RUNTIME: {selected?.runtimeProviderId?.toUpperCase() || "NONE"}</p>
          <p style={{ margin: 0 }}>MODE: {selected?.modes?.join(", ").toUpperCase() || "NONE"}</p>
          {!activeReady && selected ? (
            <div style={{ marginTop: 12, borderTop: "var(--pp-skin-border-thin) solid var(--pp-skin-warning-line)", paddingTop: 12 }}>
              <p style={{ margin: "0 0 5px", color: "var(--pp-skin-warning)" }}><strong>SETUP BLOCKER</strong></p>
              <p style={{ margin: "0 0 6px", color: "var(--pp-skin-warning-ink)", lineHeight: 1.45 }}>
                {recommendation?.error || `${selected.label} is not ready yet.`}
              </p>
              {!configured ? <p style={{ margin: "0 0 5px", color: "var(--pp-skin-warning-ink)" }}>REVIEWED WORKFLOW: SETUP NEEDED</p> : null}
              {missingNodes.length ? <p style={{ margin: "0 0 5px", color: "var(--pp-skin-warning-ink)" }}>MISSING NODES: {missingNodes.join(", ")}</p> : null}
              {missingModels.length ? <p style={{ margin: 0, color: "var(--pp-skin-warning-ink)" }}>MISSING MODELS: {missingModels.join(", ")}</p> : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {typeof recommendation?.details?.setupTarget === "string" ? (
        <button type="button" style={primaryButton} onClick={() => window.dispatchEvent(new CustomEvent("plotpickle:settings-section", { detail: recommendation.details?.setupTarget }))}>
          SET UP / TEST {selected?.label.toUpperCase()}
        </button>
      ) : null}

      {notice ? <p role="status" aria-live="polite" style={{ margin: "12px 0 0", color: "var(--pp-skin-accent-bright)" }}>{notice}</p> : null}
    </section>
  );
}
