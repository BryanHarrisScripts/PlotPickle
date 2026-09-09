"use client";

import { useEffect, useState } from "react";
import H3NativePanel from "../h3-native-panel";
import { deriveH3TextToVideoSetup, h3TextToVideoPrerequisitesReady, type H3SetupStatus } from "./h3-setup-status";

const H3_STATUS_API = "/api/media-routing/comfyui/h3/native/status";
const COMFY_START_API = "/api/media-routing/comfyui/start";

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

const primaryButton: React.CSSProperties = {
  minHeight: 42,
  padding: "9px 16px",
  border: "1px solid #79bd92",
  background: "#123524",
  color: "#f4fff7",
  font: "inherit",
  fontWeight: 700,
  cursor: "pointer",
};

const yellowButton: React.CSSProperties = {
  minHeight: 38,
  padding: "8px 14px",
  border: "1px solid #d8c85d",
  borderRadius: 999,
  background: "#2a2813",
  color: "#fff0a6",
  font: "inherit",
  fontWeight: 700,
  cursor: "pointer",
};

async function request<T>(path: string, method: "GET" | "POST" = "GET", body?: object) {
  const response = await fetch(path, {
    method,
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json", Accept: "application/json" } : { Accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) throw new Error("The local H3 setup gateway is unavailable.");
  const value = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(value.message || "The local H3 setup request failed.");
  return value;
}

export default function LocalH3SetupPanel() {
  const [status, setStatus] = useState<H3SetupStatus | null>(null);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("Checking MiniMax H3 text-to-video setup...");

  async function refresh() {
    try {
      const next = await request<H3SetupStatus>(H3_STATUS_API);
      setStatus(next);
      setNotice(deriveH3TextToVideoSetup(next).detail);
      return next;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "MiniMax H3 setup could not be checked.");
      return null;
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function recover() {
    if (working) return;
    setWorking(true);
    try {
      if (!status?.reachable) await request(COMFY_START_API, "POST", { approved: true });
      const next = await refresh();
      if (next && h3TextToVideoPrerequisitesReady(next)) {
        window.dispatchEvent(new CustomEvent("plotpickle:setup-status-refresh"));
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "PlotPickle could not recover the local H3 setup.");
    } finally {
      setWorking(false);
    }
  }

  const blocker = deriveH3TextToVideoSetup(status);
  const setupReady = h3TextToVideoPrerequisitesReady(status);
  const workflowReady = Boolean(status?.manifestConfigured && status.workflowFamily === "text-to-video");
  const nodesReady = Boolean(status?.manifestConfigured && status.missingNodes.length === 0);

  return (
    <section style={panel} aria-labelledby="local-h3-setup-title">
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 14, flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: 0, color: "#79bd92", fontSize: 12 }}>LOCAL AI / MINIMAX H3</p>
          <h2 id="local-h3-setup-title" style={{ margin: "5px 0 8px" }}>PLOTPICKLE H3 SETUP</h2>
          <p style={{ margin: 0, fontSize: 16 }}><strong>MINIMAX H3 · TEXT TO VIDEO</strong></p>
          <p style={{ margin: "8px 0 0", maxWidth: 850, lineHeight: 1.5, color: "#c6d3ca" }}>
            PlotPickle uses H3 locally only for its constrained text-to-video default. ComfyUI is the managed runtime underneath; other H3 workflow families are advanced options and do not control the VIDEO green light.
          </p>
        </div>
        <span style={{ border: `1px solid ${setupReady ? "#79bd92" : "#6c6632"}`, padding: "5px 9px", color: setupReady ? "#79bd92" : "#d8c85d" }}>
          {setupReady ? "READY" : "SETUP NEEDED"}
        </span>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10, marginTop: 16 }}>
        <div style={card}>
          <strong>ComfyUI Service</strong>
          <p>{status === null ? "CHECKING..." : status.reachable ? "READY" : "STOPPED"}</p>
          <small>127.0.0.1:8188</small>
        </div>
        <div style={card}>
          <strong>GPU Profile</strong>
          <p>{status?.vramGiB ? `${status.vramGiB} GB / ${status.vramProfile.toUpperCase()}` : "CHECKING..."}</p>
          <small>8 GB-class uses constrained local video</small>
        </div>
        <div style={card}>
          <strong>H3 T2V Workflow</strong>
          <p>{workflowReady ? "READY" : "SETUP NEEDED"}</p>
          <small>Text-to-video only for PlotPickle default</small>
        </div>
        <div style={card}>
          <strong>H3 Models</strong>
          <p>{status === null ? "CHECKING..." : status.modelsReady ? "READY" : "SETUP NEEDED"}</p>
          <small>{nodesReady ? "Required workflow nodes detected" : "Waiting for workflow/node readiness"}</small>
        </div>
      </div>

      <div style={{ ...card, marginTop: 12, borderColor: blocker.blocked ? "#746a24" : "#287a4b", background: blocker.blocked ? "#171508" : "#0b180f" }}>
        <p style={{ margin: 0, color: blocker.blocked ? "#d8c85d" : "#79bd92", fontSize: 12, letterSpacing: ".08em" }}>
          {blocker.blocked ? "SETUP BLOCKER" : "SETUP STATUS"}
        </p>
        <h3 style={{ margin: "7px 0" }}>{blocker.title}</h3>
        <p style={{ margin: 0, lineHeight: 1.5, color: "#d7ded8" }}>{blocker.detail}</p>
        <p style={{ margin: "10px 0 0", lineHeight: 1.5, color: blocker.blocked ? "#fff0a6" : "#b7d8c1" }}><strong>NEXT:</strong> {blocker.action}</p>
        <div style={{ marginTop: 12 }}>
          <button type="button" style={status?.reachable ? yellowButton : primaryButton} onClick={() => void recover()} disabled={working}>
            {working ? "CHECKING..." : status?.reachable ? "CHECK AGAIN" : "START COMFYUI"}
          </button>
        </div>
      </div>

      <p role="status" aria-live="polite" style={{ margin: "12px 0 0", color: "#79bd92" }}>{notice}</p>

      <details style={{ marginTop: 16, border: "1px solid #23412e", background: "#060806", padding: 12 }}>
        <summary style={{ cursor: "pointer", color: "#d8c85d", fontWeight: 700 }}>ADVANCED SETUP</summary>
        <p style={{ color: "#b9c6bd", lineHeight: 1.5 }}>
          Manual manifest import, official-source links, detailed model requirements, node inspection and local test controls live here. PlotPickle does not automatically download H3 weights, install custom nodes or execute downloaded setup code.
        </p>
        <H3NativePanel />
      </details>
    </section>
  );
}
