"use client";

import { useEffect, useState } from "react";

const MEDIA_API = "/api/media-routing";
const DIAGNOSTICS_API = "/api/provider-diagnostics/comfyui";
const COMFY_START_API = `${MEDIA_API}/comfyui/start`;
const SDXL_STARTER_API = `${MEDIA_API}/comfyui/sdxl-starter`;
const LOCAL_COMFY_URL = "http://127.0.0.1:8188";
const LOCAL_SDXL_CHECKPOINT = "sd_xl_base_1.0.safetensors";

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

type StartAttempt = {
  ready: boolean;
  state: string;
  manager: string;
  detail: string;
  message: string;
  attemptedAt: string;
};

type InstallResponse = {
  installation: InstallationStatus;
  lastStart?: StartAttempt | null;
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
  border: "var(--pp-skin-border-thin) solid var(--pp-skin-accent)",
  background: "var(--pp-skin-surface-1)",
  color: "var(--pp-skin-ink)",
  padding: 18,
  fontFamily: "var(--pp-skin-font-ui)",
  boxShadow: "var(--pp-skin-shadow-control)",
};

const row: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  alignItems: "center",
};

const card: React.CSSProperties = {
  border: "var(--pp-skin-border-thin) solid var(--pp-skin-line)",
  background: "var(--pp-skin-surface-2)",
  padding: 14,
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

const warningButton: React.CSSProperties = {
  minHeight: "var(--pp-skin-control-height)",
  padding: "8px 14px",
  border: "var(--pp-skin-border-thin) solid var(--pp-skin-warning)",
  borderRadius: "var(--pp-skin-radius)",
  background: "var(--pp-skin-warning-surface)",
  color: "var(--pp-skin-warning-ink)",
  font: "inherit",
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "var(--pp-skin-shadow-control)",
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

async function requestManagedStart() {
  const response = await fetch(COMFY_START_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ approved: true }),
  });
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) throw new Error("The managed ComfyUI start gateway is unavailable.");
  const value = await response.json() as StartAttempt & { message?: string };
  return { ok: response.ok, value };
}

function mergeDiagnostic(status: MediaStatus, diagnostic: DiagnosticResponse | null) {
  if (!diagnostic) return status;
  return { ...status, comfyui: { ...status.comfyui, ...diagnostic.comfyui } };
}

function timeLabel(value: string) {
  if (!value) return "Not tested yet";
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? value : parsed.toLocaleString();
}

function attemptTimeLabel(value: string) {
  if (!value) return "No managed start attempt recorded this session";
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? value : parsed.toLocaleString();
}

function exactSdxlAvailable(checkpoints: readonly string[]) {
  return checkpoints.some((checkpoint) => checkpoint.toLowerCase() === LOCAL_SDXL_CHECKPOINT.toLowerCase());
}

function announceReadyChange() {
  window.dispatchEvent(new CustomEvent("plotpickle:setup-status-refresh"));
}

function startFailureLabel(attempt: StartAttempt | null) {
  if (!attempt || attempt.ready) return "";
  const detail = attempt.detail || attempt.message || "No detailed startup evidence was returned.";
  return `START FAILED — ${attempt.state || "unknown"}: ${detail}`;
}

export default function LocalComfyUiPanel() {
  const [status, setStatus] = useState<MediaStatus | null>(null);
  const [installation, setInstallation] = useState<InstallationStatus | null>(null);
  const [lastStart, setLastStart] = useState<StartAttempt | null>(null);
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("Checking PlotPickle's fixed local image stack...");
  const [imageResult, setImageResult] = useState<ImageTestResult | null>(null);

  function statusMessage(next: MediaStatus, install: InstallationStatus | null, attempt: StartAttempt | null) {
    const modelReady = exactSdxlAvailable(next.comfyui.checkpoints);
    if (!next.comfyui.reachable) {
      if (attempt && !attempt.ready) return startFailureLabel(attempt);
      return install?.installed === false
        ? "ComfyUI is not installed."
        : "The managed ComfyUI engine is installed, but its local service is not running on 127.0.0.1:8188.";
    }
    if (!next.comfyui.imageNodesReady) {
      return next.comfyui.missingImageNodes.length
        ? `ComfyUI is running, but required image nodes are missing: ${next.comfyui.missingImageNodes.join(", ")}.`
        : "ComfyUI is running, but its required image nodes are not ready.";
    }
    if (!modelReady) return `ComfyUI is running, but ${LOCAL_SDXL_CHECKPOINT} is not reported by the live server.`;
    if (next.imageRoute !== "comfyui") return "The fixed local image stack is ready, but a different image route is currently active.";
    return "IMAGES ACTIVE — ComfyUI + SDXL 1.0 is ready locally.";
  }

  async function refresh(announce = false) {
    try {
      const next = await request<MediaStatus>(`${MEDIA_API}/status`);
      const [diagnostic, installResponse] = await Promise.all([
        request<DiagnosticResponse>(DIAGNOSTICS_API, "POST", { baseUrl: LOCAL_COMFY_URL }).catch(() => null),
        request<InstallResponse>(COMFY_START_API).catch(() => null),
      ]);
      const merged = mergeDiagnostic(next, diagnostic);
      const install = installResponse?.installation ?? null;
      const attempt = installResponse?.lastStart ?? null;
      setStatus(merged);
      setInstallation(install);
      setLastStart(attempt);
      if (announce || !notice || notice.startsWith("Checking PlotPickle")) setNotice(statusMessage(merged, install, attempt));
      if (merged.imageRoute === "comfyui" && merged.comfyui.reachable && merged.comfyui.imageNodesReady && exactSdxlAvailable(merged.comfyui.checkpoints)) {
        announceReadyChange();
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
    setNotice("Opened the official ComfyUI Desktop download page. Install it once, then return to PlotPickle.");
  }

  async function startComfyUi() {
    const approved = window.confirm("Retry the managed local ComfyUI service for PlotPickle images? This starts only the local engine and does not contact a cloud AI provider.");
    if (!approved) return false;
    setWorking("start");
    setNotice("Starting managed local ComfyUI service...");
    try {
      const result = await requestManagedStart();
      setLastStart(result.value);
      if (!result.ok || !result.value.ready) {
        setNotice(startFailureLabel(result.value));
        return false;
      }
      await refresh(true);
      return true;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The managed ComfyUI service could not be started.");
      return false;
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
        setNotice(starter.message || "The reviewed SDXL 1.0 local image model is already installed.");
        await refresh(true);
        return;
      }
      if (starter.state === "installing") {
        setNotice(starter.task?.message || starter.message || "The reviewed SDXL 1.0 model is still downloading.");
        return;
      }
      if (starter.state !== "missing") throw new Error(starter.message || "The reviewed SDXL 1.0 local image model is not available for this setup.");
      const approved = window.confirm(
        `Download PlotPickle's fixed local image model?\n\nModel: SDXL 1.0\nFile: ${starter.fileName}\nSource: ${starter.sourceLabel}\nSize: ${starter.sizeLabel}\nLicense: ${starter.license}\nDestination: ${starter.destination}\nSHA-256: ${starter.sha256}\n\nThe download requires internet access once. Image generation is local afterward.`,
      );
      if (!approved) {
        setNotice("SDXL 1.0 download cancelled. Nothing was changed.");
        return;
      }
      await request<StarterStatus>(SDXL_STARTER_API, "POST", { approved: true });
      setNotice("SDXL 1.0 is downloading and being verified. When it finishes, restart or refresh ComfyUI so its live server reports the model.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The local SDXL 1.0 model could not be installed.");
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
      const installResponse = await request<InstallResponse>(COMFY_START_API).catch(() => null);
      const attempt = installResponse?.lastStart ?? lastStart;
      const merged = mergeDiagnostic(next, diagnostic);
      setStatus(merged);
      if (installResponse?.installation) setInstallation(installResponse.installation);
      setLastStart(attempt);
      setNotice(statusMessage(merged, installResponse?.installation ?? installation, attempt));
      if (merged.imageRoute === "comfyui" && merged.comfyui.reachable && merged.comfyui.imageNodesReady && exactSdxlAvailable(merged.comfyui.checkpoints)) announceReadyChange();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The local ComfyUI diagnostic failed.");
    } finally {
      setWorking("");
    }
  }

  async function testImage() {
    setWorking("test");
    setNotice("Generating one local SDXL verification image...");
    setImageResult(null);
    try {
      const result = await request<ImageTestResult>(`${MEDIA_API}/test/image`, "POST", { route: "comfyui" });
      setImageResult(result);
      await refresh();
      setNotice("Verification passed — PlotPickle received a real image from local ComfyUI + SDXL 1.0.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The local SDXL image test failed.");
    } finally {
      setWorking("");
    }
  }

  async function makeImagesReady() {
    if (working) return;
    setWorking("ready");
    setNotice("Checking the fixed local image stack...");
    setImageResult(null);
    try {
      let next = await request<MediaStatus>(`${MEDIA_API}/status`);
      const installResponse = await request<InstallResponse>(COMFY_START_API).catch(() => null);
      const install = installResponse?.installation ?? null;
      const attempt = installResponse?.lastStart ?? null;
      setInstallation(install);
      setLastStart(attempt);

      if (!next.comfyui.reachable) {
        if (install?.installed === false) {
          openInstaller();
          return;
        }
        const started = await startComfyUi();
        if (!started) return;
        next = await request<MediaStatus>(`${MEDIA_API}/status`);
      }

      const diagnostic = await request<DiagnosticResponse>(DIAGNOSTICS_API, "POST", { baseUrl: LOCAL_COMFY_URL }).catch(() => null);
      next = mergeDiagnostic(next, diagnostic);
      setStatus(next);

      if (!next.comfyui.reachable) {
        setNotice("The managed ComfyUI service has not reached 127.0.0.1:8188 yet. Review LAST START RESULT below, then retry only after that service issue is fixed.");
        return;
      }
      if (!next.comfyui.imageNodesReady) {
        setNotice(next.comfyui.missingImageNodes.length
          ? `ComfyUI is running but required image nodes are missing: ${next.comfyui.missingImageNodes.join(", ")}.`
          : "ComfyUI is running but its required image nodes are not ready yet.");
        return;
      }
      if (!exactSdxlAvailable(next.comfyui.checkpoints)) {
        await installStarter();
        return;
      }
      if (next.imageRoute !== "comfyui") {
        next = await request<MediaStatus>(`${MEDIA_API}/routes`, "POST", { imageRoute: "comfyui" });
        setStatus(next);
      }

      announceReadyChange();
      setNotice("IMAGES ACTIVE — PlotPickle detected the running ComfyUI server and fixed SDXL 1.0 model. No manual test is required for the green light.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "PlotPickle could not finish local image setup.");
    } finally {
      setWorking("");
    }
  }

  const engineLabel = installation === null ? "CHECKING..." : installation.installed ? "FOUND" : "NOT FOUND";
  const serverReady = Boolean(status?.comfyui.reachable);
  const nodesReady = Boolean(status?.comfyui.imageNodesReady);
  const modelReady = exactSdxlAvailable(status?.comfyui.checkpoints || []);
  const activeReady = Boolean(serverReady && nodesReady && modelReady && status?.imageRoute === "comfyui");
  const verified = Boolean(status?.comfyui.imageVerifiedAt);
  const serviceLabel = status === null ? "CHECKING..." : serverReady ? "RUNNING" : lastStart && !lastStart.ready ? "FAILED TO START" : "STOPPED";
  const modelLabel = status === null ? "CHECKING..." : !serverReady ? "WAITING FOR SERVICE" : modelReady ? "FOUND" : "NOT FOUND";

  return (
    <section style={panel} aria-labelledby="local-comfyui-title">
      <header style={{ ...row, justifyContent: "space-between", alignItems: "start" }}>
        <div>
          <p style={{ margin: 0, color: "var(--pp-skin-accent-bright)", fontSize: 12 }}>LOCAL AI / IMAGES</p>
          <h2 id="local-comfyui-title" style={{ margin: "5px 0 8px" }}>PLOTPICKLE IMAGE DEFAULT</h2>
          <p style={{ margin: 0, fontSize: 16 }}><strong>COMFYUI + SDXL 1.0</strong></p>
          <p style={{ margin: "8px 0 0", maxWidth: 820, lineHeight: 1.5, color: "var(--pp-skin-ink-soft)" }}>
            Local images are fixed to PlotPickle&apos;s managed ComfyUI service at {LOCAL_COMFY_URL} with {LOCAL_SDXL_CHECKPOINT}. Broader image choices belong to cloud providers.
          </p>
        </div>
        <span style={{ border: `var(--pp-skin-border-thin) solid ${activeReady ? "var(--pp-skin-accent-bright)" : "var(--pp-skin-line)"}`, padding: "5px 9px", color: activeReady ? "var(--pp-skin-accent-bright)" : "var(--pp-skin-ink-muted)" }}>
          {activeReady ? "READY" : "NEEDS ATTENTION"}
        </span>
      </header>

      <div style={{ ...card, marginTop: 16, background: "var(--pp-skin-surface-2)" }}>
        <div style={{ ...row, justifyContent: "space-between" }}>
          <div>
            <strong>{activeReady ? "LOCAL IMAGES ARE ACTIVE" : lastStart && !lastStart.ready ? "LOCAL IMAGE SERVICE NEEDS RECOVERY" : "LET PLOTPICKLE CHECK LOCAL IMAGES"}</strong>
            <p style={{ margin: "6px 0 0", color: "var(--pp-skin-ink-soft)", lineHeight: 1.45 }}>
              {activeReady
                ? "The fixed local image stack is present and active. A test render is optional verification, not a readiness requirement."
                : lastStart && !lastStart.ready
                  ? "PlotPickle already attempted the managed local service. The exact failure is shown below before SDXL is evaluated."
                  : "PlotPickle checks the managed ComfyUI service, the fixed SDXL 1.0 model and the active local image route."}
            </p>
          </div>
          <button type="button" style={primaryButton} onClick={() => void makeImagesReady()} disabled={Boolean(working) || activeReady}>
            {activeReady ? "READY" : working === "ready" ? "RUNNING..." : "RUN"}
          </button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10, marginTop: 12 }}>
        <div style={card}>
          <strong>ComfyUI Engine</strong>
          <p>{engineLabel}</p>
        </div>
        <div style={card}>
          <strong>Service</strong>
          <p>{serviceLabel}</p>
          <small>{LOCAL_COMFY_URL}</small>
        </div>
        <div style={card}>
          <strong>SDXL 1.0</strong>
          <p>{modelLabel}</p>
          <small>{LOCAL_SDXL_CHECKPOINT}</small>
        </div>
        <div style={card}>
          <strong>Images</strong>
          <p>{activeReady ? "ACTIVE / GREEN" : "INACTIVE"}</p>
          <small>{serverReady ? nodesReady ? "Required image nodes ready." : "Waiting for image nodes." : "Waiting for ComfyUI service."}</small>
        </div>
      </div>

      <div style={{ ...card, marginTop: 12 }} aria-live="polite">
        <strong>LAST START RESULT</strong>
        {lastStart ? (
          <div style={{ marginTop: 10 }}>
            <p style={{ margin: "0 0 6px" }}>STATE: {lastStart.state || "unknown"}</p>
            <p style={{ margin: "0 0 6px" }}>MANAGER: {lastStart.manager || "unknown"}</p>
            <p style={{ margin: "0 0 10px" }}>ATTEMPTED: {attemptTimeLabel(lastStart.attemptedAt)}</p>
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere", color: lastStart.ready ? "var(--pp-skin-accent-bright)" : "var(--pp-skin-warning)", font: "inherit", lineHeight: 1.5 }}>
              {lastStart.detail || lastStart.message || "No detailed startup evidence was returned."}
            </pre>
          </div>
        ) : (
          <p style={{ margin: "8px 0 0", color: "var(--pp-skin-ink-soft)" }}>No managed start attempt recorded this session.</p>
        )}
      </div>

      <details style={{ ...card, marginTop: 12 }}>
        <summary style={{ cursor: "pointer", color: "var(--pp-skin-accent-bright)" }}>LOCAL IMAGE DIAGNOSTICS</summary>
        <div style={{ marginTop: 12 }}>
          <p style={{ margin: "0 0 8px" }}>Fixed local address: {LOCAL_COMFY_URL}</p>
          <p style={{ margin: "0 0 10px" }}>Fixed local model: {LOCAL_SDXL_CHECKPOINT}</p>
          <div style={row}>
            {installation?.installed === false ? <button type="button" onClick={openInstaller}>Install ComfyUI Desktop</button> : null}
            {!serverReady && installation?.installed !== false ? <button type="button" onClick={() => void startComfyUi()} disabled={Boolean(working)}>{working === "start" ? "Starting..." : "Retry ComfyUI Service"}</button> : null}
            {serverReady && !modelReady ? <button type="button" onClick={() => void installStarter()} disabled={Boolean(working)}>{working === "starter" ? "Preparing..." : "Install SDXL 1.0"}</button> : null}
            <button type="button" style={warningButton} onClick={() => void runDiagnostic()} disabled={Boolean(working)}>{working === "diagnostic" ? "CHECKING..." : "RUN LOCAL DIAGNOSTIC"}</button>
            <button type="button" style={warningButton} onClick={() => void testImage()} disabled={Boolean(working) || !activeReady}>{working === "test" ? "GENERATING..." : "TEST LOCAL IMAGE"}</button>
          </div>
          <p style={{ margin: "10px 0 0", color: "var(--pp-skin-ink-soft)" }}>Last successful local image test: {timeLabel(status?.comfyui.imageVerifiedAt || "")}{verified ? "" : " — not required for READY"}</p>
        </div>
      </details>

      {imageResult ? <figure style={{ ...card, margin: "12px 0 0" }}><img src={imageResult.assetUrl} alt="Local ComfyUI SDXL verification result" style={{ maxWidth: "100%", filter: "var(--pp-skin-media-filter)" }} /><figcaption>Optional local verification asset{imageResult.assetLocation ? ` · ${imageResult.assetLocation}` : ""}</figcaption></figure> : null}
      {notice ? <p role="status" aria-live="polite" style={{ margin: "12px 0 0", color: "var(--pp-skin-accent-bright)" }}>{notice}</p> : null}
    </section>
  );
}
