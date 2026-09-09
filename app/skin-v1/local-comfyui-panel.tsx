"use client";

import { useEffect, useState } from "react";

const MEDIA_API = "/api/media-routing";
const DIAGNOSTICS_API = "/api/provider-diagnostics/comfyui";
const COMFY_START_API = `${MEDIA_API}/comfyui/start`;
const SDXL_STARTER_API = `${MEDIA_API}/comfyui/sdxl-starter`;
const LOCAL_COMFY_URL = "http://127.0.0.1:8188";
const REVIEWED_SDXL = "sd_xl_base_1.0.safetensors";

type ComfyStatus = {
  reachable: boolean;
  baseUrl: string;
  version: string;
  checkpoints: string[];
  imageNodesReady: boolean;
  missingImageNodes: string[];
  checkpoint: string;
  selectedCheckpoint?: string;
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

function preferredSdxlCheckpoint(checkpoints: readonly string[]) {
  return checkpoints.find((checkpoint) => checkpoint.trim().toLowerCase() === REVIEWED_SDXL) || "";
}

function timeLabel(value: string) {
  if (!value) return "Not tested";
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? value : parsed.toLocaleString();
}

function announceReadyChange() {
  window.dispatchEvent(new CustomEvent("plotpickle:setup-status-refresh"));
}

export default function LocalComfyUiPanel() {
  const [status, setStatus] = useState<MediaStatus | null>(null);
  const [installation, setInstallation] = useState<InstallationStatus | null>(null);
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("Checking the live ComfyUI image server...");
  const [imageResult, setImageResult] = useState<ImageTestResult | null>(null);

  async function bindLiveSdxl(next: MediaStatus) {
    const checkpoint = preferredSdxlCheckpoint(next.comfyui.checkpoints);
    if (!checkpoint || !next.comfyui.reachable || !next.comfyui.imageNodesReady) return next;
    if ((next.comfyui.selectedCheckpoint || "").toLowerCase() === checkpoint.toLowerCase()) return next;
    return request<MediaStatus>(`${MEDIA_API}/comfyui/checkpoint`, "POST", { checkpoint });
  }

  async function refresh(announce = false) {
    try {
      const next = await request<MediaStatus>(`${MEDIA_API}/status`);
      const [diagnostic, install] = await Promise.all([
        request<DiagnosticResponse>(DIAGNOSTICS_API, "POST", { baseUrl: LOCAL_COMFY_URL }).catch(() => null),
        request<{ installation: InstallationStatus }>(COMFY_START_API).catch(() => null),
      ]);
      let merged = mergeDiagnostic(next, diagnostic);
      merged = await bindLiveSdxl(merged).catch(() => merged);
      setStatus(merged);
      setInstallation(install?.installation ?? null);
      const ready = Boolean(merged.comfyui.reachable && merged.comfyui.imageNodesReady && preferredSdxlCheckpoint(merged.comfyui.checkpoints));
      if (ready) {
        setNotice(announce ? "IMAGES READY — live ComfyUI exposes PlotPickle's SDXL 1.0 default." : "Live ComfyUI + SDXL 1.0 detected. Local images are ready.");
        announceReadyChange();
      } else if (announce) {
        setNotice("Local image status refreshed.");
      }
      return merged;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Local image status could not be checked.");
      return null;
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function openInstaller() {
    const destination = installation?.officialDownloadUrl || "https://comfy.org/download";
    window.open(destination, "_blank", "noopener,noreferrer");
    setNotice("Opened the official ComfyUI Desktop download page. Install it once, then return here.");
  }

  async function startComfyUi() {
    const approved = window.confirm("Start the detected local ComfyUI image engine on this computer? This does not enable or contact a cloud AI provider.");
    if (!approved) return;
    setWorking("start");
    setNotice("");
    try {
      await request<{ ready: boolean }>(COMFY_START_API, "POST", { approved: true });
      await refresh(true);
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
      const diagnostic = await request<DiagnosticResponse>(DIAGNOSTICS_API, "POST", { baseUrl: LOCAL_COMFY_URL });
      const next = await request<MediaStatus>(`${MEDIA_API}/status`);
      const merged = await bindLiveSdxl(mergeDiagnostic(next, diagnostic)).catch(() => mergeDiagnostic(next, diagnostic));
      setStatus(merged);
      const checkpoint = preferredSdxlCheckpoint(merged.comfyui.checkpoints);
      setNotice(merged.comfyui.reachable
        ? checkpoint
          ? `ComfyUI ${merged.comfyui.version || "service"} is live and exposes ${REVIEWED_SDXL}.`
          : `ComfyUI ${merged.comfyui.version || "service"} is live, but ${REVIEWED_SDXL} is not exposed by the running server.`
        : merged.comfyui.error || "ComfyUI did not respond locally.");
      announceReadyChange();
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
      if (["ready", "installed"].includes(starter.state)) {
        setNotice(`${REVIEWED_SDXL} is installed. Restart ComfyUI if the live server does not expose it yet.`);
        await refresh(true);
        return;
      }
      if (starter.state === "installing") {
        setNotice(starter.task?.message || starter.message || "SDXL 1.0 is still downloading.");
        return;
      }
      if (starter.state !== "missing") throw new Error(starter.message || "The reviewed SDXL 1.0 starter is not available for this setup.");
      const approved = window.confirm(
        `Download PlotPickle's fixed local image model?\n\nModel: SDXL 1.0\nFile: ${starter.fileName}\nSource: ${starter.sourceLabel}\nSize: ${starter.sizeLabel}\nLicense: ${starter.license}\nDestination: ${starter.destination}\nSHA-256: ${starter.sha256}\n\nThis requires internet access once. Image generation remains local afterward.`,
      );
      if (!approved) {
        setNotice("SDXL 1.0 download cancelled. Nothing was changed.");
        return;
      }
      await request<StarterStatus>(SDXL_STARTER_API, "POST", { approved: true });
      setNotice("SDXL 1.0 is downloading and being verified. When complete, restart ComfyUI so its live server exposes the model, then return here.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The local SDXL 1.0 model could not be installed.");
    } finally {
      setWorking("");
    }
  }

  async function activateLocalImages(next: MediaStatus) {
    if (next.imageRoute === "comfyui") return next;
    return request<MediaStatus>(`${MEDIA_API}/routes`, "POST", { imageRoute: "comfyui" });
  }

  async function makeImagesReady() {
    if (working) return;
    setWorking("ready");
    setNotice("Checking PlotPickle's fixed local image default...");
    setImageResult(null);
    try {
      let next = await request<MediaStatus>(`${MEDIA_API}/status`);
      const installResponse = await request<{ installation: InstallationStatus }>(COMFY_START_API).catch(() => null);
      const install = installResponse?.installation ?? null;
      setInstallation(install);

      if (!next.comfyui.reachable) {
        if (install?.installed === false) {
          openInstaller();
          return;
        }
        const approved = window.confirm("ComfyUI Desktop is installed but its local server is not running. Start ComfyUI now?");
        if (!approved) {
          setNotice("ComfyUI startup cancelled. Nothing was changed.");
          return;
        }
        await request<{ ready: boolean }>(COMFY_START_API, "POST", { approved: true });
        next = await request<MediaStatus>(`${MEDIA_API}/status`);
      }

      const diagnostic = await request<DiagnosticResponse>(DIAGNOSTICS_API, "POST", { baseUrl: LOCAL_COMFY_URL }).catch(() => null);
      next = mergeDiagnostic(next, diagnostic);
      if (!next.comfyui.reachable) {
        setStatus(next);
        setNotice("ComfyUI has not finished starting yet. Wait a moment and try again.");
        return;
      }
      if (!next.comfyui.imageNodesReady) {
        setStatus(next);
        setNotice(next.comfyui.missingImageNodes?.length
          ? `ComfyUI is running but required image nodes are missing: ${next.comfyui.missingImageNodes.join(", ")}.`
          : "ComfyUI is running but its required image nodes are not ready.");
        return;
      }

      const checkpoint = preferredSdxlCheckpoint(next.comfyui.checkpoints);
      if (!checkpoint) {
        setStatus(next);
        const starter = await request<StarterStatus>(SDXL_STARTER_API);
        if (starter.state === "missing") {
          const approved = window.confirm(
            `PlotPickle local images use only SDXL 1.0. Download ${starter.sizeLabel} from ${starter.sourceLabel}?\n\nThis is a one-time internet download.`,
          );
          if (!approved) {
            setNotice("SDXL 1.0 download cancelled. Nothing was changed.");
            return;
          }
          await request<StarterStatus>(SDXL_STARTER_API, "POST", { approved: true });
          setNotice("SDXL 1.0 is downloading and being verified. Restart ComfyUI after it completes, then PlotPickle will detect it automatically.");
          return;
        }
        if (starter.state === "installing") {
          setNotice(starter.task?.message || starter.message || "SDXL 1.0 is still downloading.");
          return;
        }
        setNotice(`${REVIEWED_SDXL} is installed on disk but the running ComfyUI server does not expose it. Restart ComfyUI, then return here.`);
        return;
      }

      next = await bindLiveSdxl(next);
      next = await activateLocalImages(next);
      setStatus(next);
      announceReadyChange();
      setNotice("IMAGES READY — ComfyUI is live, SDXL 1.0 is exposed by the running server, and the local image route is active.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "PlotPickle could not finish local image setup.");
    } finally {
      setWorking("");
    }
  }

  async function testImage() {
    if (working) return;
    setWorking("test");
    setNotice("");
    setImageResult(null);
    try {
      let next = await request<MediaStatus>(`${MEDIA_API}/status`);
      const checkpoint = preferredSdxlCheckpoint(next.comfyui.checkpoints);
      if (!next.comfyui.reachable || !next.comfyui.imageNodesReady || !checkpoint) {
        throw new Error(`Local images are not ready. ComfyUI must expose ${REVIEWED_SDXL} first.`);
      }
      next = await bindLiveSdxl(next);
      next = await activateLocalImages(next);
      setStatus(next);
      const result = await request<ImageTestResult>(`${MEDIA_API}/test/image`, "POST", { route: "comfyui" });
      setImageResult(result);
      await refresh();
      announceReadyChange();
      setNotice("SDXL 1.0 returned a real local image to PlotPickle. Verification passed.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The local SDXL 1.0 image test failed.");
    } finally {
      setWorking("");
    }
  }

  const liveCheckpoint = preferredSdxlCheckpoint(status?.comfyui.checkpoints || []);
  const ready = Boolean(status?.comfyui.reachable && status.comfyui.imageNodesReady && liveCheckpoint);
  const active = Boolean(ready && status?.imageRoute === "comfyui");

  return (
    <section style={panel} aria-labelledby="local-comfyui-title">
      <header style={{ ...row, justifyContent: "space-between", alignItems: "start" }}>
        <div>
          <p style={{ margin: 0, color: "#79bd92", fontSize: 12 }}>LOCAL AI / IMAGES</p>
          <h2 id="local-comfyui-title" style={{ margin: "5px 0 8px" }}>PLOTPICKLE IMAGE DEFAULT</h2>
          <p style={{ margin: 0, fontSize: 16 }}><strong>COMFYUI + SDXL 1.0</strong></p>
          <p style={{ margin: "8px 0 0", maxWidth: 820, lineHeight: 1.5, color: "#c6d3ca" }}>
            PlotPickle local images are fixed to ComfyUI Desktop at {LOCAL_COMFY_URL} and {REVIEWED_SDXL}. No MiniMax H3 or cloud provider is part of the image default. There is no local model selector.
          </p>
        </div>
        <span style={{ border: `1px solid ${ready ? "#79bd92" : "#365342"}`, padding: "5px 9px", color: ready ? "#79bd92" : "#9eafa3" }}>
          {active ? "ACTIVE" : ready ? "READY" : "NEEDS ATTENTION"}
        </span>
      </header>

      <div style={{ ...card, marginTop: 16, background: "linear-gradient(110deg, #0b180f, #080b09)" }}>
        <div style={{ ...row, justifyContent: "space-between" }}>
          <div>
            <strong>{active ? "LOCAL IMAGES ARE ACTIVE" : ready ? "LOCAL IMAGES ARE READY" : "LET PLOTPICKLE FINISH LOCAL IMAGE SETUP"}</strong>
            <p style={{ margin: "6px 0 0", color: "#c6d3ca", lineHeight: 1.45 }}>
              {ready
                ? `The live ComfyUI server exposes ${REVIEWED_SDXL}. A test image is optional and does not control the green status light.`
                : `PlotPickle checks the live ComfyUI server for exactly ${REVIEWED_SDXL}.`}
            </p>
          </div>
          <button type="button" style={primaryButton} onClick={() => void makeImagesReady()} disabled={Boolean(working) || active}>
            {active ? "IMAGES ACTIVE" : working === "ready" ? "PREPARING..." : "MAKE IMAGES READY"}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, marginTop: 12 }}>
        <div style={card}>
          <strong>ComfyUI Desktop</strong>
          <p>{status?.comfyui.reachable ? "SERVER RUNNING" : installation?.installed ? "INSTALLED / SERVER STOPPED" : "NOT READY"}</p>
          <small>{LOCAL_COMFY_URL}</small>
        </div>
        <div style={card}>
          <strong>Local model</strong>
          <p>{liveCheckpoint || REVIEWED_SDXL}</p>
          <small>{liveCheckpoint ? "EXPOSED BY LIVE SERVER" : "NOT EXPOSED BY LIVE SERVER"}</small>
        </div>
        <div style={card}>
          <strong>PlotPickle route</strong>
          <p>{active ? "COMFYUI / ACTIVE" : ready ? "COMFYUI / READY" : "WAITING"}</p>
          <small>The green light means the fixed local image stack is ready; a render test is secondary.</small>
        </div>
        <div style={card}>
          <strong>Last render test</strong>
          <p>{status?.comfyui.imageVerifiedAt ? "VERIFIED" : "NOT TESTED"}</p>
          <small>{timeLabel(status?.comfyui.imageVerifiedAt || "")}</small>
        </div>
      </div>

      <details style={{ ...card, marginTop: 12 }}>
        <summary style={{ cursor: "pointer", color: "#79bd92" }}>ADVANCED / MANUAL IMAGE CONTROLS</summary>
        <div style={{ marginTop: 12 }}>
          <p style={{ margin: "0 0 10px" }}>Local ComfyUI address: <strong>{LOCAL_COMFY_URL}</strong></p>
          <p style={{ margin: "0 0 10px" }}>Fixed checkpoint: <strong>{REVIEWED_SDXL}</strong></p>
          <div style={row}>
            {installation?.installed === false ? <button type="button" onClick={openInstaller}>Install ComfyUI Desktop</button> : null}
            {!status?.comfyui.reachable && installation?.installed !== false ? <button type="button" onClick={() => void startComfyUi()} disabled={Boolean(working)}>{working === "start" ? "Starting..." : "Start local ComfyUI"}</button> : null}
            <button type="button" onClick={() => void runDiagnostic()} disabled={Boolean(working)}>{working === "diagnostic" ? "Testing..." : "Run local diagnostic"}</button>
            {status?.comfyui.reachable && !liveCheckpoint ? <button type="button" onClick={() => void installStarter()} disabled={Boolean(working)}>{working === "starter" ? "Preparing..." : "Install SDXL 1.0"}</button> : null}
            <button type="button" onClick={() => void testImage()} disabled={Boolean(working) || !ready}>{working === "test" ? "Generating test..." : "Test local image"}</button>
          </div>
        </div>
      </details>

      {imageResult ? <figure style={{ ...card, margin: "12px 0 0" }}><img src={imageResult.assetUrl} alt="Local ComfyUI SDXL 1.0 verification result" style={{ maxWidth: "100%" }} /><figcaption>Local SDXL 1.0 verification asset{imageResult.assetLocation ? ` · ${imageResult.assetLocation}` : ""}</figcaption></figure> : null}
      {notice ? <p role="status" aria-live="polite" style={{ margin: "12px 0 0", color: "#79bd92" }}>{notice}</p> : null}
    </section>
  );
}
