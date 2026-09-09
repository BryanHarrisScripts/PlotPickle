"use client";

import { useEffect, useState } from "react";

const MEDIA_API = "/api/media-routing";
const DIAGNOSTICS_API = "/api/provider-diagnostics/comfyui";
const COMFY_START_API = `${MEDIA_API}/comfyui/start`;
const SDXL_STARTER_API = `${MEDIA_API}/comfyui/sdxl-starter`;
const REVIEWED_SDXL = "sd_xl_base_1.0.safetensors";
const SDXL_COMPATIBLE = /(sd.?xl|stable.?diffusion.?xl|juggernaut.?xl|realvis.?xl|dreamshaper.?xl)/i;

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

function timeLabel(value: string) {
  if (!value) return "Not tested";
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? value : parsed.toLocaleString();
}

function preferredSdxlCheckpoint(checkpoints: readonly string[]) {
  return checkpoints.find((checkpoint) => checkpoint.toLowerCase() === REVIEWED_SDXL.toLowerCase())
    || checkpoints.find((checkpoint) => SDXL_COMPATIBLE.test(checkpoint))
    || "";
}

function announceReadyChange() {
  window.dispatchEvent(new CustomEvent("plotpickle:setup-status-refresh"));
}

export default function LocalComfyUiPanel() {
  const [status, setStatus] = useState<MediaStatus | null>(null);
  const [installation, setInstallation] = useState<InstallationStatus | null>(null);
  const [baseUrl, setBaseUrl] = useState("http://127.0.0.1:8188");
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("Checking local images...");
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
      if (announce) setNotice("Local image status refreshed.");
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
    setNotice("Opened the official ComfyUI Desktop download page. Install it once, then return here and choose MAKE IMAGES READY again.");
  }

  async function startComfyUi() {
    const approved = window.confirm("Start the detected local ComfyUI image engine on this computer? This does not enable or contact a cloud AI provider.");
    if (!approved) return;
    setWorking("start");
    setNotice("");
    try {
      await request<{ ready: boolean; state: string; detail?: string }>(COMFY_START_API, "POST", { approved: true });
      await refresh();
      setNotice("ComfyUI start requested. The live local image status is shown below.");
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
        setNotice(starter.message || "A compatible local SDXL image checkpoint is already available.");
        await refresh();
        return;
      }
      if (starter.state === "installing") {
        setNotice(starter.task?.message || starter.message || "The reviewed SDXL starter is still downloading.");
        return;
      }
      if (starter.state !== "missing") throw new Error(starter.message || "The reviewed SDXL starter is not available for this setup.");
      const approved = window.confirm(
        `Download the PlotPickle local image default?\n\nModel: SDXL 1.0\nFile: ${starter.fileName}\nSource: ${starter.sourceLabel}\nSize: ${starter.sizeLabel}\nLicense: ${starter.license}\nDestination: ${starter.destination}\nSHA-256: ${starter.sha256}\n\nThe download requires internet access once. Image generation is local afterward.`,
      );
      if (!approved) {
        setNotice("Local model download cancelled. No image route was changed.");
        return;
      }
      await request<StarterStatus>(SDXL_STARTER_API, "POST", { approved: true });
      setNotice("The reviewed SDXL 1.0 download has begun. When it finishes, choose MAKE IMAGES READY again to verify the image and turn the status green.");
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
      setNotice(`${checkpoint} selected. Run Test Local Image before making it the verified image default.`);
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
      if (status?.imageRoute !== "comfyui") {
        const activated = await request<MediaStatus>(`${MEDIA_API}/routes`, "POST", { imageRoute: "comfyui" });
        setStatus(activated);
      }
      const result = await request<ImageTestResult>(`${MEDIA_API}/test/image`, "POST", { route: "comfyui" });
      setImageResult(result);
      await refresh();
      announceReadyChange();
      setNotice("Local SDXL returned a real image to PlotPickle. IMAGES is ready.");
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
      announceReadyChange();
      setNotice("ComfyUI is now the active local image route. No cloud fallback was enabled.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "ComfyUI could not be selected as the local image route.");
    } finally {
      setWorking("");
    }
  }

  async function makeImagesReady() {
    if (working) return;
    setWorking("ready");
    setNotice("Preparing PlotPickle's local image default...");
    setImageResult(null);
    try {
      let next = await request<MediaStatus>(`${MEDIA_API}/status`);
      const installResponse = await request<{ installation: InstallationStatus }>(COMFY_START_API).catch(() => null);
      const install = installResponse?.installation ?? null;
      setInstallation(install);
      setStatus(next);
      setBaseUrl(next.comfyui.baseUrl || "http://127.0.0.1:8188");

      if (!next.comfyui.reachable) {
        if (install?.installed === false) {
          openInstaller();
          return;
        }
        const approved = window.confirm("PlotPickle found the local image engine but it is not running. Start ComfyUI now?");
        if (!approved) {
          setNotice("Local image startup cancelled. Nothing was changed.");
          return;
        }
        await request<{ ready: boolean }>(COMFY_START_API, "POST", { approved: true });
        next = await request<MediaStatus>(`${MEDIA_API}/status`);
      }

      const diagnostic = await request<DiagnosticResponse>(DIAGNOSTICS_API, "POST", { baseUrl: next.comfyui.baseUrl || baseUrl }).catch(() => null);
      next = mergeDiagnostic(next, diagnostic);
      setStatus(next);

      if (!next.comfyui.reachable) {
        setNotice("ComfyUI has not finished starting yet. Wait a moment, then choose MAKE IMAGES READY again.");
        return;
      }
      if (!next.comfyui.imageNodesReady) {
        setNotice(next.comfyui.missingImageNodes?.length
          ? `The local image engine is running but required image nodes are missing: ${next.comfyui.missingImageNodes.join(", ")}.`
          : "The local image engine is running but its required image nodes are not ready yet.");
        return;
      }

      let checkpoint = preferredSdxlCheckpoint(next.comfyui.checkpoints);
      if (!checkpoint) {
        const starter = await request<StarterStatus>(SDXL_STARTER_API);
        if (starter.state === "installing") {
          setNotice(starter.task?.message || starter.message || "The reviewed SDXL 1.0 default is still downloading. Choose MAKE IMAGES READY again when it finishes.");
          return;
        }
        if (starter.state === "missing") {
          const approved = window.confirm(
            `PlotPickle's preferred local image default is SDXL 1.0.\n\nDownload ${starter.sizeLabel} from ${starter.sourceLabel}?\nLicense: ${starter.license}\n\nThis is a one-time internet download. Generation stays local afterward.`,
          );
          if (!approved) {
            setNotice("SDXL 1.0 download cancelled. Nothing was changed.");
            return;
          }
          await request<StarterStatus>(SDXL_STARTER_API, "POST", { approved: true });
          setNotice("SDXL 1.0 is downloading and being verified. When complete, choose MAKE IMAGES READY again.");
          return;
        }
        if (["ready", "installed", "existing-compatible"].includes(starter.state)) {
          const refreshed = await refresh();
          checkpoint = preferredSdxlCheckpoint(refreshed?.comfyui.checkpoints || []);
          if (!checkpoint) {
            setNotice("An SDXL-compatible model is installed, but ComfyUI has not reported it yet. Refresh or restart ComfyUI, then choose MAKE IMAGES READY again.");
            return;
          }
          next = refreshed || next;
        } else {
          throw new Error(starter.message || "PlotPickle could not prepare its SDXL image default.");
        }
      }

      if (next.comfyui.checkpoint !== checkpoint) {
        next = await request<MediaStatus>(`${MEDIA_API}/comfyui/checkpoint`, "POST", { checkpoint });
        setStatus(next);
      }
      if (next.imageRoute !== "comfyui") {
        next = await request<MediaStatus>(`${MEDIA_API}/routes`, "POST", { imageRoute: "comfyui" });
        setStatus(next);
      }

      const result = await request<ImageTestResult>(`${MEDIA_API}/test/image`, "POST", { route: "comfyui" });
      setImageResult(result);
      const verified = await refresh();
      announceReadyChange();
      if (verified?.imageRoute === "comfyui" && verified.comfyui.imageVerifiedAt) {
        setNotice("IMAGES READY — PlotPickle verified ComfyUI + SDXL locally. The Local AI image light will now be green.");
      } else {
        setNotice("The local image test completed. Refresh Local AI to confirm the green image status.");
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "PlotPickle could not finish local image setup.");
    } finally {
      setWorking("");
    }
  }

  const configured = Boolean(status?.comfyui.reachable && status.comfyui.imageNodesReady && preferredSdxlCheckpoint(status.comfyui.checkpoints));
  const verified = Boolean(configured && status?.comfyui.imageVerifiedAt && status.imageRoute === "comfyui");
  const preferredCheckpoint = preferredSdxlCheckpoint(status?.comfyui.checkpoints || []);

  return (
    <section style={panel} aria-labelledby="local-comfyui-title">
      <header style={{ ...row, justifyContent: "space-between", alignItems: "start" }}>
        <div>
          <p style={{ margin: 0, color: "#79bd92", fontSize: 12 }}>LOCAL AI / IMAGES</p>
          <h2 id="local-comfyui-title" style={{ margin: "5px 0 8px" }}>PLOTPICKLE IMAGE DEFAULT</h2>
          <p style={{ margin: 0, fontSize: 16 }}><strong>COMFYUI + SDXL 1.0</strong></p>
          <p style={{ margin: "8px 0 0", maxWidth: 820, lineHeight: 1.5, color: "#c6d3ca" }}>
            PlotPickle uses a compatible local SDXL checkpoint when one is already installed; otherwise it offers the reviewed SDXL 1.0 starter. No MiniMax H3 or cloud provider is part of the image default.
          </p>
        </div>
        <span style={{ border: `1px solid ${verified ? "#79bd92" : "#365342"}`, padding: "5px 9px", color: verified ? "#79bd92" : "#9eafa3" }}>
          {verified ? "READY" : "NEEDS ATTENTION"}
        </span>
      </header>

      <div style={{ ...card, marginTop: 16, background: "linear-gradient(110deg, #0b180f, #080b09)" }}>
        <div style={{ ...row, justifyContent: "space-between" }}>
          <div>
            <strong>{verified ? "LOCAL IMAGES ARE READY" : "LET PLOTPICKLE FINISH LOCAL IMAGE SETUP"}</strong>
            <p style={{ margin: "6px 0 0", color: "#c6d3ca", lineHeight: 1.45 }}>
              {verified
                ? `Verified locally with ${status?.comfyui.checkpoint || preferredCheckpoint || "SDXL"}.`
                : "This checks the local engine, uses the preferred SDXL default, generates a real test image and turns the IMAGES status green."}
            </p>
          </div>
          <button type="button" style={primaryButton} onClick={() => void makeImagesReady()} disabled={Boolean(working) || verified}>
            {verified ? "IMAGES READY" : working === "ready" ? "PREPARING..." : "MAKE IMAGES READY"}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 10, marginTop: 12 }}>
        <div style={card}>
          <strong>Engine</strong>
          <p>{status?.comfyui.reachable ? "COMFYUI / RUNNING" : installation?.installed ? "COMFYUI / STOPPED" : "COMFYUI / NOT READY"}</p>
        </div>
        <div style={card}>
          <strong>Model</strong>
          <p>{status?.comfyui.checkpoint || preferredCheckpoint || "SDXL 1.0 DEFAULT"}</p>
          <small>{preferredCheckpoint ? "Compatible SDXL detected locally." : "PlotPickle will use the reviewed SDXL 1.0 starter when needed."}</small>
        </div>
        <div style={card}>
          <strong>Verification</strong>
          <p>{verified ? "GREEN / VERIFIED" : configured ? "TEST NEEDED" : "SETUP NEEDED"}</p>
          <small>Last local image test: {timeLabel(status?.comfyui.imageVerifiedAt || "")}</small>
        </div>
      </div>

      <details style={{ ...card, marginTop: 12 }}>
        <summary style={{ cursor: "pointer", color: "#79bd92" }}>ADVANCED / MANUAL IMAGE CONTROLS</summary>
        <div style={{ marginTop: 12 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span>Local ComfyUI address</span>
            <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} spellCheck={false} placeholder="http://127.0.0.1:8188" />
          </label>
          <div style={{ ...row, marginTop: 10 }}>
            {installation?.installed === false ? <button type="button" onClick={openInstaller}>Install ComfyUI Desktop</button> : null}
            {!status?.comfyui.reachable && installation?.installed !== false ? <button type="button" onClick={() => void startComfyUi()} disabled={Boolean(working)}>{working === "start" ? "Starting..." : "Start local ComfyUI"}</button> : null}
            <button type="button" onClick={() => void runDiagnostic()} disabled={Boolean(working) || !baseUrl.trim()}>{working === "diagnostic" ? "Testing..." : "Run local diagnostic"}</button>
            {status?.comfyui.reachable && !preferredCheckpoint ? <button type="button" onClick={() => void installStarter()} disabled={Boolean(working)}>{working === "starter" ? "Preparing..." : "Install reviewed SDXL 1.0"}</button> : null}
          </div>

          {status?.comfyui.checkpoints.length ? (
            <div style={{ marginTop: 12 }}>
              <label style={{ display: "grid", gap: 6 }}>
                <span>Advanced checkpoint override</span>
                <select value={status.comfyui.checkpoint} onChange={(event) => void chooseCheckpoint(event.target.value)} disabled={Boolean(working)}>
                  {status.comfyui.checkpoints.map((name) => <option value={name} key={name}>{name}</option>)}
                </select>
              </label>
              <div style={{ ...row, marginTop: 10 }}>
                <button type="button" onClick={() => void testImage()} disabled={Boolean(working) || !configured}>{working === "test" ? "Generating test..." : "Test local image"}</button>
                <button type="button" onClick={() => void activateComfyUi()} disabled={Boolean(working) || !status?.comfyui.imageVerifiedAt || status.imageRoute === "comfyui"}>{status?.imageRoute === "comfyui" ? "ComfyUI active" : "Use ComfyUI locally"}</button>
              </div>
            </div>
          ) : null}
        </div>
      </details>

      {imageResult ? <figure style={{ ...card, margin: "12px 0 0" }}><img src={imageResult.assetUrl} alt="Local ComfyUI verification result" style={{ maxWidth: "100%" }} /><figcaption>Local verification asset{imageResult.assetLocation ? ` · ${imageResult.assetLocation}` : ""}</figcaption></figure> : null}
      {notice ? <p role="status" aria-live="polite" style={{ margin: "12px 0 0", color: "#79bd92" }}>{notice}</p> : null}
    </section>
  );
}
