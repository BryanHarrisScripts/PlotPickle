"use client";

import { useEffect, useState } from "react";

const MEDIA_API = "/api/media-routing";
const DIAGNOSTICS_API = "/api/provider-diagnostics/comfyui";
const COMFY_START_API = `${MEDIA_API}/comfyui/start`;
const SDXL_STARTER_API = `${MEDIA_API}/comfyui/sdxl-starter`;

type ComfyStatus = {
  reachable: boolean;
  baseUrl: string;
  version: string;
  checkpoints: string[];
  imageNodesReady: boolean;
  missingImageNodes: string[];
  checkpoint: string;
  imageVerifiedAt: string;
  latencyMs?: number;
  error: string;
  capabilityError?: string;
};

type MediaStatus = {
  imageRoute: string;
  comfyui: ComfyStatus;
};

type DiagnosticResponse = {
  comfyui: Partial<ComfyStatus> & Pick<ComfyStatus, "reachable" | "baseUrl" | "checkpoints" | "imageNodesReady" | "missingImageNodes" | "error">;
};

type InstallationStatus = {
  installed: boolean;
  running: boolean;
  canStart: boolean;
  state: string;
  detail: string;
  location: string;
  officialDownloadUrl: string;
};

type StarterStatus = {
  state: string;
  message: string;
  destination: string;
  fileName: string;
  sizeLabel: string;
  sha256: string;
  license: string;
  sourceLabel: string;
  task?: { state?: string; message?: string };
};

type ImageTestResult = {
  assetUrl: string;
  assetLocation?: string;
  route: string;
};

const panel: React.CSSProperties = {
  border: "1px solid #287a4b",
  background: "#080b09",
  color: "#e7ece8",
  padding: 18,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
};

const row: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
};

const card: React.CSSProperties = {
  border: "1px solid #23412e",
  background: "#0c120e",
  padding: 14,
};

async function request<T>(path: string, method: "GET" | "POST" = "GET", body?: object) {
  const response = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json", Accept: "application/json" } : { Accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) throw new Error("The local ComfyUI gateway is unavailable.");
  const value = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(value.message || "The local ComfyUI request failed.");
  return value;
}

function mergeDiagnostic(status: MediaStatus, diagnostic: DiagnosticResponse | null) {
  if (!diagnostic) return status;
  return { ...status, comfyui: { ...status.comfyui, ...diagnostic.comfyui } };
}

function timeLabel(value: string) {
  if (!value) return "Not tested";
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? value : parsed.toLocaleString();
}

export default function LocalComfyUiPanel() {
  const [status, setStatus] = useState<MediaStatus | null>(null);
  const [installation, setInstallation] = useState<InstallationStatus | null>(null);
  const [baseUrl, setBaseUrl] = useState("http://127.0.0.1:8188");
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("Checking local ComfyUI...");
  const [imageResult, setImageResult] = useState<ImageTestResult | null>(null);

  async function refresh(announce = false) {
    try {
      const next = await request<MediaStatus>(`${MEDIA_API}/status`);
      const [diagnostic, install] = await Promise.all([
        request<DiagnosticResponse>(DIAGNOSTICS_API, "POST", { baseUrl: next.comfyui.baseUrl || baseUrl }).catch(() => null),
        request<{ installation: InstallationStatus }>(COMFY_START_API).catch(() => null),
      ]);
      const merged = mergeDiagnostic(next, diagnostic);
      setStatus(merged);
      setInstallation(install?.installation ?? null);
      setBaseUrl(merged.comfyui.baseUrl || "http://127.0.0.1:8188");
      setNotice(announce ? "Local ComfyUI status refreshed." : "");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Local ComfyUI status could not be checked.");
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function openInstaller() {
    const destination = installation?.officialDownloadUrl || "https://comfy.org/download";
    window.open(destination, "_blank", "noopener,noreferrer");
    setNotice("Opened the official ComfyUI Desktop download page. Installation needs internet access; generation can remain local afterward.");
  }

  async function startComfyUi() {
    const approved = window.confirm("Start the detected local ComfyUI engine on this computer? This does not enable or contact a cloud AI provider.");
    if (!approved) return;
    setWorking("start");
    setNotice("");
    try {
      await request<{ ready: boolean; state: string; detail?: string }>(COMFY_START_API, "POST", { approved: true });
      await refresh();
      setNotice("ComfyUI start requested. The live local status is shown below.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "ComfyUI could not be started.");
    } finally {
      setWorking("");
    }
  }

  async function runDiagnostic() {
    setWorking("diagnostic");
    setNotice("");
    try {
      const diagnostic = await request<DiagnosticResponse>(DIAGNOSTICS_API, "POST", { baseUrl });
      const next = await request<MediaStatus>(`${MEDIA_API}/status`);
      const merged = mergeDiagnostic(next, diagnostic);
      setStatus(merged);
      setBaseUrl(merged.comfyui.baseUrl || baseUrl);
      setNotice(merged.comfyui.reachable
        ? `Local ComfyUI ${merged.comfyui.version || "service"} responded${merged.comfyui.latencyMs !== undefined ? ` in ${merged.comfyui.latencyMs} ms` : ""}.`
        : merged.comfyui.error || "ComfyUI did not respond locally.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The local ComfyUI diagnostic failed.");
    } finally {
      setWorking("");
    }
  }

  async function installStarter() {
    setWorking("starter");
    setNotice("");
    try {
      const starter = await request<StarterStatus>(SDXL_STARTER_API);
      if (["ready", "installed", "existing-compatible"].includes(starter.state)) {
        setNotice(starter.message || "A compatible local image checkpoint is already available.");
        await refresh();
        return;
      }
      if (starter.state !== "missing") throw new Error(starter.message || "The reviewed SDXL starter is not available for this setup.");
      const approved = window.confirm(
        `Download the reviewed local image starter?\n\nModel: ${starter.fileName}\nSource: ${starter.sourceLabel}\nSize: ${starter.sizeLabel}\nLicense: ${starter.license}\nDestination: ${starter.destination}\nSHA-256: ${starter.sha256}\n\nThe download requires internet access once. The model is then used locally.`,
      );
      if (!approved) {
        setNotice("Local model download cancelled. No route was changed.");
        return;
      }
      await request<StarterStatus>(SDXL_STARTER_API, "POST", { approved: true });
      setNotice("The reviewed SDXL starter download has begun. Use Refresh local status after the verified download completes.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The local image starter could not be installed.");
    } finally {
      setWorking("");
    }
  }

  async function chooseCheckpoint(checkpoint: string) {
    setWorking("checkpoint");
    setNotice("");
    try {
      const next = await request<MediaStatus>(`${MEDIA_API}/comfyui/checkpoint`, "POST", { checkpoint });
      setStatus(next);
      setImageResult(null);
      setNotice(`${checkpoint} selected. Run Test Local Image before making ComfyUI the active image route.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The local checkpoint could not be selected.");
    } finally {
      setWorking("");
    }
  }

  async function testImage() {
    setWorking("test");
    setNotice("");
    setImageResult(null);
    try {
      const result = await request<ImageTestResult>(`${MEDIA_API}/test/image`, "POST", { route: "comfyui" });
      setImageResult(result);
      await refresh();
      setNotice("ComfyUI returned a real image to PlotPickle. Local image generation is verified.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The local ComfyUI image test failed.");
    } finally {
      setWorking("");
    }
  }

  async function activateComfyUi() {
    setWorking("activate");
    setNotice("");
    try {
      const next = await request<MediaStatus>(`${MEDIA_API}/routes`, "POST", { imageRoute: "comfyui" });
      setStatus(next);
      setNotice("ComfyUI is now the active local image route. No cloud fallback was enabled.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "ComfyUI could not be selected as the local image route.");
    } finally {
      setWorking("");
    }
  }

  const configured = Boolean(status?.comfyui.reachable && status.comfyui.imageNodesReady && status.comfyui.checkpoint);
  const verified = Boolean(configured && status?.comfyui.imageVerifiedAt);

  return (
    <section style={panel} aria-labelledby="local-comfyui-title">
      <header style={{ ...row, justifyContent: "space-between", alignItems: "start" }}>
        <div>
          <p style={{ margin: 0, color: "#79bd92", fontSize: 12 }}>LOCAL AI / IMAGES</p>
          <h2 id="local-comfyui-title" style={{ margin: "5px 0 8px" }}>ComfyUI on this computer</h2>
          <p style={{ margin: 0, maxWidth: 820, lineHeight: 1.5, color: "#c6d3ca" }}>
            Install, start, diagnose, choose a checkpoint and verify local image generation here. Model or application downloads can require internet access once; generation uses the local engine and does not require cloud AI credentials.
          </p>
        </div>
        <button type="button" onClick={() => void refresh(true)} disabled={Boolean(working)}>Refresh local status</button>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 10, marginTop: 16 }}>
        <div style={card}>
          <strong>Engine</strong>
          <p>{status?.comfyui.reachable ? "RUNNING" : installation?.installed ? "INSTALLED / STOPPED" : "NOT RUNNING"}</p>
          <small>{installation?.location || installation?.detail || status?.comfyui.error || "Local installation status unavailable."}</small>
        </div>
        <div style={card}>
          <strong>Image readiness</strong>
          <p>{verified ? "VERIFIED" : configured ? "TEST NEEDED" : "SETUP NEEDED"}</p>
          <small>{status?.comfyui.imageNodesReady ? "Required image nodes detected." : status?.comfyui.missingImageNodes?.length ? `Missing nodes: ${status.comfyui.missingImageNodes.join(", ")}` : "Waiting for local diagnostics."}</small>
        </div>
        <div style={card}>
          <strong>Active route</strong>
          <p>{status?.imageRoute === "comfyui" ? "COMFYUI / LOCAL" : String(status?.imageRoute || "NOT SELECTED").toUpperCase()}</p>
          <small>Opening this screen never changes the active route.</small>
        </div>
      </div>

      <div style={{ ...card, marginTop: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Local ComfyUI address</span>
          <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} spellCheck={false} placeholder="http://127.0.0.1:8188" />
        </label>
        <div style={{ ...row, marginTop: 10 }}>
          {installation?.installed === false ? <button type="button" onClick={openInstaller}>Install ComfyUI Desktop</button> : null}
          {!status?.comfyui.reachable && installation?.installed !== false ? <button type="button" onClick={() => void startComfyUi()} disabled={Boolean(working)}>{working === "start" ? "Starting..." : "Start local ComfyUI"}</button> : null}
          <button type="button" onClick={() => void runDiagnostic()} disabled={Boolean(working) || !baseUrl.trim()}>{working === "diagnostic" ? "Testing..." : "Run local diagnostic"}</button>
          {status?.comfyui.reachable && !status.comfyui.checkpoints.length ? <button type="button" onClick={() => void installStarter()} disabled={Boolean(working)}>{working === "starter" ? "Preparing..." : "Install reviewed SDXL starter"}</button> : null}
        </div>
      </div>

      {status?.comfyui.checkpoints.length ? (
        <div style={{ ...card, marginTop: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Local image checkpoint</span>
            <select value={status.comfyui.checkpoint} onChange={(event) => void chooseCheckpoint(event.target.value)} disabled={Boolean(working)}>
              {status.comfyui.checkpoints.map((name) => <option value={name} key={name}>{name}</option>)}
            </select>
          </label>
          <div style={{ ...row, marginTop: 10 }}>
            <button type="button" onClick={() => void testImage()} disabled={Boolean(working) || !configured}>{working === "test" ? "Generating test..." : "Test local image"}</button>
            <button type="button" onClick={() => void activateComfyUi()} disabled={Boolean(working) || !verified || status.imageRoute === "comfyui"}>{status.imageRoute === "comfyui" ? "ComfyUI active" : "Use ComfyUI locally"}</button>
          </div>
          <small style={{ display: "block", marginTop: 8 }}>Last successful local image test: {timeLabel(status.comfyui.imageVerifiedAt)}</small>
        </div>
      ) : null}

      {imageResult ? <figure style={{ ...card, margin: "12px 0 0" }}><img src={imageResult.assetUrl} alt="Local ComfyUI verification result" style={{ maxWidth: "100%" }} /><figcaption>Local verification asset{imageResult.assetLocation ? ` · ${imageResult.assetLocation}` : ""}</figcaption></figure> : null}
      {notice ? <p role="status" aria-live="polite" style={{ margin: "12px 0 0", color: "#79bd92" }}>{notice}</p> : null}
    </section>
  );
}
