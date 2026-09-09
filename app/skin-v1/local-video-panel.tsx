"use client";

import { useEffect, useState } from "react";
import { deriveH3TextToVideoSetup, h3TextToVideoPrerequisitesReady, type H3SetupStatus } from "./h3-setup-status";

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
  const [status, setStatus] = useState<H3SetupStatus | null>(null);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("Checking PlotPickle's local text-to-video default...");

  async function refresh() {
    try {
      const next = await request<H3SetupStatus>(`${H3_API}/status`);
      setStatus(next);
      const setupReady = h3TextToVideoPrerequisitesReady(next);
      const activeReady = setupReady && next.ready && next.active;
      const blocker = deriveH3TextToVideoSetup(next);
      if (activeReady) {
        setNotice("VIDEO ACTIVE — MiniMax H3 text-to-video is ready locally. ComfyUI is running only as the managed runtime dependency.");
        announceReadyChange();
      } else if (!setupReady) {
        setNotice(`${blocker.title} — ${blocker.detail}`);
      } else {
        setNotice("MiniMax H3 text-to-video setup is ready but not yet active for local video.");
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
    setNotice("Starting PlotPickle's local text-to-video default...");
    try {
      let next = await request<H3SetupStatus>(`${H3_API}/status`);
      if (!next.reachable) {
        await request<StartResponse>(COMFY_START_API, "POST", { approved: true });
        next = await request<H3SetupStatus>(`${H3_API}/status`);
      }
      if (!next.reachable) throw new Error(`ComfyUI did not become ready at ${LOCAL_COMFY_URL}.`);
      if (!h3TextToVideoPrerequisitesReady(next)) {
        setStatus(next);
        const blocker = deriveH3TextToVideoSetup(next);
        setNotice(`${blocker.title} — ${blocker.detail} NEXT: ${blocker.action}`);
        return;
      }
      next = await request<H3SetupStatus>(`${H3_API}/activation`, "POST", {
        active: true,
        allowConstrainedVram: next.vramProfile === "constrained",
      });
      setStatus(next);
      if (!next.active || !next.ready || next.workflowFamily !== "text-to-video") {
        throw new Error(next.error || "MiniMax H3 text-to-video did not become active.");
      }
      setNotice("VIDEO ACTIVE — MiniMax H3 text-to-video is the local video default. ComfyUI remains the managed runtime underneath.");
      announceReadyChange();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "PlotPickle could not start the local text-to-video default.");
      await refresh();
    } finally {
      setWorking(false);
    }
  }

  const comfyReady = Boolean(status?.reachable);
  const h3Ready = h3TextToVideoPrerequisitesReady(status);
  const activeReady = Boolean(h3Ready && status?.ready && status?.active);
  const setupNeeded = Boolean(status && comfyReady && !h3Ready);
  const blocker = deriveH3TextToVideoSetup(status);

  return (
    <section style={panel} aria-labelledby="local-video-title">
      <header style={{ ...row, justifyContent: "space-between", alignItems: "start" }}>
        <div>
          <p style={{ margin: 0, color: "#79bd92", fontSize: 12 }}>LOCAL AI / VIDEO</p>
          <h2 id="local-video-title" style={{ margin: "5px 0 8px" }}>PLOTPICKLE VIDEO DEFAULT</h2>
          <p style={{ margin: 0, fontSize: 16 }}><strong>MINIMAX H3 · TEXT TO VIDEO</strong></p>
          <p style={{ margin: "8px 0 0", maxWidth: 850, lineHeight: 1.5, color: "#c6d3ca" }}>
            MiniMax H3 is the local text-to-video engine. PlotPickle manages ComfyUI at {LOCAL_COMFY_URL} only as H3&apos;s local runtime dependency.
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
              Default: text-to-video, short-form, 360p-class black-and-white video. PlotPickle starts ComfyUI first, then activates the MiniMax H3 text-to-video workflow.
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
          <strong>MiniMax H3 T2V</strong>
          <p>{status === null ? "CHECKING..." : h3Ready ? "READY" : "SETUP NEEDED"}</p>
          <small>Text-to-video engine</small>
        </div>
        <div style={card}>
          <strong>Local Target</strong>
          <p>TEXT→VIDEO / 360P / B&amp;W</p>
          <small>Short conservative local preset</small>
        </div>
        <div style={card}>
          <strong>Video</strong>
          <p>{activeReady ? "ACTIVE / GREEN" : "INACTIVE"}</p>
          <small>{activeReady ? "MiniMax H3 text-to-video is active." : comfyReady ? "Waiting for H3 text-to-video readiness." : "Waiting for ComfyUI service."}</small>
        </div>
      </div>

      {status ? (
        <div style={{ ...card, marginTop: 12 }}>
          <strong>LOCAL VIDEO STATUS</strong>
          <p style={{ margin: "10px 0 5px" }}>GPU PROFILE: {status.vramGiB ? `${status.vramGiB} GB / ${status.vramProfile.toUpperCase()}` : "NOT DETECTED"}</p>
          <p style={{ margin: "0 0 5px" }}>WORKFLOW: {status.workflowFamily === "text-to-video" ? "TEXT-TO-VIDEO" : "TEXT-TO-VIDEO REQUIRED"}</p>
          <p style={{ margin: 0 }}>H3 FILES: {status.modelsReady ? "FOUND" : "NOT READY"}</p>
          {setupNeeded ? (
            <div style={{ marginTop: 12, borderTop: "1px solid #4d471c", paddingTop: 12 }}>
              <p style={{ margin: "0 0 5px", color: "#d8c85d" }}><strong>SETUP BLOCKER: {blocker.title}</strong></p>
              <p style={{ margin: "0 0 9px", color: "#fff0a6", lineHeight: 1.45 }}>{blocker.detail}</p>
              <button type="button" style={yellowButton} onClick={onOpenH3}>SETUP H3</button>
            </div>
          ) : null}
        </div>
      ) : null}

      {notice ? <p role="status" aria-live="polite" style={{ margin: "12px 0 0", color: "#79bd92" }}>{notice}</p> : null}
    </section>
  );
}
