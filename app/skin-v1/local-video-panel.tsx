"use client";

import { useEffect, useState } from "react";

const H3_API = "/api/media-routing/comfyui/h3/native";
const COMFY_START_API = "/api/media-routing/comfyui/start";
const LOCAL_COMFY_URL = "http://127.0.0.1:8188";

const panel: React.CSSProperties = {
  border: "1px solid #287a4b",
  background: "#080b09",
  color: "#e7ece8",
  padding: 18,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
};

const card: React.CSSProperties = {
  border: "1px solid #23412e",
  background: "#0c120e",
  padding: 14,
};

const row: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
};

const primaryButton: React.CSSProperties = {
  minHeight: 44,
  padding: "10px 18px",
  border: "1px solid #79bd92",
  background: "#123524",
  color: "#f4fff7",
  font: "inherit",
  fontWeight: 700,
  cursor: "pointer",
};

const yellowButton: React.CSSProperties = {
  minHeight: 36,
  padding: "8px 14px",
  border: "1px solid #d8c85d",
  borderRadius: 999,
  background: "#2a2813",
  color: "#fff0a6",
  font: "inherit",
  fontWeight: 700,
  cursor: "pointer",
};

type ModelRequirement = {
  label: string;
  found: string;
  ready: boolean;
};

type H3Status = {
  active: boolean;
  allowConstrainedVram: boolean;
  reachable: boolean;
  ready: boolean;
  manifestConfigured: boolean;
  compatibleVersion: boolean;
  modelsReady: boolean;
  missingNodes: string[];
  modelRequirements: ModelRequirement[];
  workflowFamily: string;
  vramGiB: number;
  vramProfile: string;
  vramWarning: string;
  error: string;
};

type StartAttempt = {
  ready: boolean;
  state: string;
  manager: string;
  detail: string;
  message: string;
  attemptedAt: string;
};

type StartResponse = StartAttempt & { installation?: { installed: boolean } };

async function request<T>(path: string, method: "GET" | "POST" = "GET", body?: object) {
  const response = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json", Accept: "application/json" } : { Accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) throw new Error("The local video gateway is unavailable.");
  const value = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(value.message || "The local video request failed.");
  return value;
}

function announceReadyChange() {
  window.dispatchEvent(new CustomEvent("plotpickle:setup-status-refresh"));
}

export default function LocalVideoPanel({ onOpenH3 }: { onOpenH3: () => void }) {
  const [status, setStatus] = useState<H3Status | null>(null);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("Checking PlotPickle's local video default...");

  async function refresh() {
    try {
      const next = await request<H3Status>(`${H3_API}/status`);
      setStatus(next);
      const activeReady = next.reachable && next.ready && next.active;
      if (activeReady) {
        setNotice("VIDEO ACTIVE — MiniMax H3 is ready locally. ComfyUI is running only as the managed runtime dependency.");
        announceReadyChange();
      } else if (!next.reachable) {
        setNotice("MiniMax H3 is waiting for PlotPickle's managed ComfyUI service.");
      } else if (!next.ready) {
        setNotice(next.error || "MiniMax H3 local setup is incomplete.");
      } else {
        setNotice("MiniMax H3 is ready but not yet active for local video.");
      }
      return next;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Local video status could not be checked.");
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
    setNotice("Starting PlotPickle's local video default...");
    try {
      let next = await request<H3Status>(`${H3_API}/status`);
      if (!next.reachable) {
        await request<StartResponse>(COMFY_START_API, "POST", { approved: true });
        next = await request<H3Status>(`${H3_API}/status`);
      }
      if (!next.reachable) throw new Error(`ComfyUI did not become ready at ${LOCAL_COMFY_URL}.`);
      if (!next.manifestConfigured || !next.compatibleVersion || next.missingNodes.length > 0 || !next.modelsReady) {
        setStatus(next);
        setNotice("ComfyUI is ready. MiniMax H3 still needs its reviewed local workflow and model files before VIDEO can turn green.");
        return;
      }
      next = await request<H3Status>(`${H3_API}/activation`, "POST", {
        active: true,
        allowConstrainedVram: next.vramProfile === "constrained",
      });
      setStatus(next);
      if (!next.active || !next.ready) throw new Error(next.error || "MiniMax H3 did not become active.");
      setNotice("VIDEO ACTIVE — MiniMax H3 is the local video default. ComfyUI remains the managed runtime underneath.");
      announceReadyChange();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "PlotPickle could not start the local video default.");
      await refresh();
    } finally {
      setWorking(false);
    }
  }

  const comfyReady = Boolean(status?.reachable);
  const h3Ready = Boolean(status?.ready);
  const activeReady = Boolean(status?.reachable && status?.ready && status?.active);
  const setupNeeded = Boolean(status && comfyReady && !h3Ready);

  return (
    <section style={panel} aria-labelledby="local-video-title">
      <header style={{ ...row, justifyContent: "space-between", alignItems: "start" }}>
        <div>
          <p style={{ margin: 0, color: "#79bd92", fontSize: 12 }}>LOCAL AI / VIDEO</p>
          <h2 id="local-video-title" style={{ margin: "5px 0 8px" }}>PLOTPICKLE VIDEO DEFAULT</h2>
          <p style={{ margin: 0, fontSize: 16 }}><strong>MINIMAX H3</strong></p>
          <p style={{ margin: "8px 0 0", maxWidth: 850, lineHeight: 1.5, color: "#c6d3ca" }}>
            MiniMax H3 is the local video engine. PlotPickle manages ComfyUI at {LOCAL_COMFY_URL} only as H3&apos;s local runtime dependency.
          </p>
        </div>
        <span style={{ border: `1px solid ${activeReady ? "#79bd92" : "#365342"}`, padding: "5px 9px", color: activeReady ? "#79bd92" : "#9eafa3" }}>
          {activeReady ? "READY" : "NEEDS ATTENTION"}
        </span>
      </header>

      <div style={{ ...card, marginTop: 16, background: "linear-gradient(110deg, #0b180f, #080b09)" }}>
        <div style={{ ...row, justifyContent: "space-between" }}>
          <div>
            <strong>{activeReady ? "LOCAL VIDEO IS ACTIVE" : "RUN PLOTPICKLE LOCAL VIDEO"}</strong>
            <p style={{ margin: "6px 0 0", color: "#c6d3ca", lineHeight: 1.45 }}>
              Default target: short-form, 360p-class black-and-white video. PlotPickle starts the ComfyUI service first, then activates MiniMax H3 when its local workflow is genuinely ready.
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
          <p>{status === null ? "CHECKING..." : comfyReady ? "READY" : "STOPPED"}</p>
          <small>Managed runtime dependency</small>
        </div>
        <div style={card}>
          <strong>MiniMax H3</strong>
          <p>{status === null ? "CHECKING..." : h3Ready ? "READY" : "SETUP NEEDED"}</p>
          <small>Local video engine</small>
        </div>
        <div style={card}>
          <strong>Local Target</strong>
          <p>360P-CLASS / B&amp;W</p>
          <small>Short conservative local preset</small>
        </div>
        <div style={card}>
          <strong>Video</strong>
          <p>{activeReady ? "ACTIVE / GREEN" : "INACTIVE"}</p>
          <small>{activeReady ? "MiniMax H3 is active." : comfyReady ? "Waiting for H3 readiness." : "Waiting for ComfyUI service."}</small>
        </div>
      </div>

      {status ? (
        <div style={{ ...card, marginTop: 12 }}>
          <strong>LOCAL VIDEO STATUS</strong>
          <p style={{ margin: "10px 0 5px" }}>GPU: {status.vramGiB ? `${status.vramGiB} GB / ${status.vramProfile.toUpperCase()}` : "NOT DETECTED"}</p>
          <p style={{ margin: "0 0 5px" }}>WORKFLOW: {status.workflowFamily || "NOT CONFIGURED"}</p>
          <p style={{ margin: 0 }}>H3 FILES: {status.modelsReady ? "FOUND" : "NOT READY"}</p>
          {status.vramWarning ? <p style={{ margin: "10px 0 0", color: "#d8c85d" }}>{status.vramWarning}</p> : null}
          {setupNeeded ? (
            <div style={{ marginTop: 12 }}>
              <button type="button" style={yellowButton} onClick={onOpenH3}>OPEN MINIMAX H3 SETUP</button>
            </div>
          ) : null}
        </div>
      ) : null}

      {notice ? <p role="status" aria-live="polite" style={{ margin: "12px 0 0", color: "#79bd92" }}>{notice}</p> : null}
    </section>
  );
}
