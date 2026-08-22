"use client";

import { useEffect, useMemo, useState } from "react";
import { requestConnectionStatusRefresh } from "./use-connection-status";
import styles from "./media-routing-panel.module.css";

type ImageRoute = "comfyui" | "openai" | "minimax" | "manual";
type VideoRoute = "minimax-direct" | "minimax-comfyui" | "none";
type PublicProfile = {
  configured: boolean;
  provider?: "openai" | "minimax";
  imageModel?: string;
  videoModel?: string;
  imageVerifiedAt?: string;
  videoVerifiedAt?: string;
  lastError?: string;
};
type Requirement = { id: string; label: string; ready: boolean };
type ComfyUiStatus = {
  reachable: boolean;
  serviceReady?: boolean;
  baseUrl: string;
  version: string;
  checkpoints: string[];
  imageNodesReady: boolean;
  missingImageNodes: string[];
  workflowNodesReady: boolean;
  missingWorkflowNodes: string[];
  checkedAt?: string;
  latencyMs?: number;
  error: string;
  capabilityError?: string;
  checkpoint: string;
  selectedCheckpoint: string;
  imageVerifiedAt: string;
  lastError: string;
  h3Workflow: {
    configured: boolean;
    hash?: string;
    nodeClasses?: string[];
    configuredAt?: string;
    verifiedAt?: string;
    verifiedHash?: string;
    lastError?: string;
  };
};
type MediaStatus = {
  imageRoute: ImageRoute;
  videoRoute: VideoRoute;
  profiles: { openai: PublicProfile; minimax: PublicProfile };
  comfyui: ComfyUiStatus;
  hybridGate: { ready: boolean; requirements: Requirement[] };
};
type DiagnosticResponse = { comfyui: Partial<ComfyUiStatus> & Pick<ComfyUiStatus, "reachable" | "baseUrl" | "checkpoints" | "imageNodesReady" | "missingImageNodes" | "workflowNodesReady" | "missingWorkflowNodes" | "error"> };
type ComfyInstallationStatus = {
  installed: boolean;
  running: boolean;
  canStart: boolean;
  state: string;
  detail: string;
  location: string;
  officialDownloadUrl: string;
};
type ComfyInstallResponse = { installation: ComfyInstallationStatus };
type ImageTestResult = { assetUrl: string; assetLocation?: string; route: ImageRoute; providerRequestId?: string };
type SdxlStarterStatus = {
  state: string;
  message: string;
  destination: string;
  fileName: string;
  sizeBytes: number;
  sizeLabel: string;
  sha256: string;
  license: string;
  sourceLabel: string;
  task?: { state?: string; message?: string };
};
type VideoJob = {
  id: string;
  route: VideoRoute;
  model: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled" | "expired";
  outputAssetUrl?: string;
  error?: string;
};

const API = "/api/media-routing";
const COMFY_START_API = `${API}/comfyui/start`;
const SDXL_STARTER_API = `${API}/comfyui/sdxl-starter`;
const DIAGNOSTICS_API = "/api/provider-diagnostics/comfyui";
const imageOptions: Array<{ id: ImageRoute; label: string; detail: string }> = [
  { id: "comfyui", label: "ComfyUI", detail: "Local reviewed workflow on this computer" },
  { id: "openai", label: "OpenAI Images", detail: "Cloud generation using your OpenAI API account" },
  { id: "minimax", label: "MiniMax image-01", detail: "Cloud generation using your MiniMax account" },
  { id: "manual", label: "Manual Import", detail: "Create elsewhere and import the finished asset" },
];
const videoOptions: Array<{ id: VideoRoute; label: string; detail: string }> = [
  { id: "minimax-direct", label: "MiniMax H3 Direct", detail: "PlotPickle calls MiniMax with your key" },
  { id: "minimax-comfyui", label: "MiniMax H3 through ComfyUI", detail: "A verified local custom-node workflow controls the job" },
  { id: "none", label: "None", detail: "No video provider is active" },
];

async function jsonRequest<T>(path: string, method: "GET" | "POST" = "GET", body?: object) {
  const response = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) throw new Error("The local Media Engines gateway is unavailable.");
  const value = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(value.message || "The media-routing request failed.");
  return value;
}

function formatDate(value?: string) {
  if (!value) return "Not tested";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
}

function imageVerified(status: MediaStatus, route: ImageRoute) {
  if (route === "comfyui") return status.comfyui.imageVerifiedAt;
  if (route === "openai" || route === "minimax") return status.profiles[route].imageVerifiedAt;
  return route === "manual" ? "manual" : "";
}

function mergeDiagnostic(status: MediaStatus, diagnostic: DiagnosticResponse | null) {
  if (!diagnostic) return status;
  return { ...status, comfyui: { ...status.comfyui, ...diagnostic.comfyui } };
}

export default function MediaRoutingPanel({ onManage }: { onManage: (target: string) => void }) {
  const [status, setStatus] = useState<MediaStatus | null>(null);
  const [comfyInstallation, setComfyInstallation] = useState<ComfyInstallationStatus | null>(null);
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("");
  const [paidImageConsent, setPaidImageConsent] = useState(false);
  const [paidVideoConsent, setPaidVideoConsent] = useState(false);
  const [workflowText, setWorkflowText] = useState("");
  const [comfyBaseUrl, setComfyBaseUrl] = useState("http://127.0.0.1:8188");
  const [imageResult, setImageResult] = useState<ImageTestResult | null>(null);
  const [videoJob, setVideoJob] = useState<VideoJob | null>(null);

  function refreshDashboardLights() {
    requestConnectionStatusRefresh();
    window.dispatchEvent(new CustomEvent("plotpickle:setup-status-refresh"));
  }

  async function refresh() {
    try {
      const next = await jsonRequest<MediaStatus>(`${API}/status`);
      const [diagnostic, installResponse] = await Promise.all([
        jsonRequest<DiagnosticResponse>(DIAGNOSTICS_API, "POST", { baseUrl: next.comfyui.baseUrl }).catch(() => null),
        jsonRequest<ComfyInstallResponse>(COMFY_START_API).catch(() => null),
      ]);
      const merged = mergeDiagnostic(next, diagnostic);
      setStatus(merged);
      setComfyInstallation(installResponse?.installation ?? null);
      setComfyBaseUrl(merged.comfyui.baseUrl || "http://127.0.0.1:8188");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Media routing status could not be checked.");
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const hybridCanTest = useMemo(() => {
    if (!status) return false;
    return status.hybridGate.requirements.filter((item) => item.id !== "test").every((item) => item.ready);
  }, [status]);

  function routeConfigured(route: ImageRoute) {
    if (!status) return false;
    if (route === "openai" || route === "minimax") return status.profiles[route].configured;
    if (route === "comfyui") return status.comfyui.reachable && status.comfyui.imageNodesReady && Boolean(status.comfyui.checkpoint);
    return true;
  }

  async function chooseRoutes(body: { imageRoute?: ImageRoute; videoRoute?: VideoRoute }) {
    setWorking("route");
    setNotice("");
    try {
      setStatus(await jsonRequest<MediaStatus>(`${API}/routes`, "POST", body));
      refreshDashboardLights();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The route could not be selected.");
    } finally {
      setWorking("");
    }
  }

  async function installAndVerifySdxlStarter(previousRoute: ImageRoute) {
    const starter = await jsonRequest<SdxlStarterStatus>(SDXL_STARTER_API);
    if (["ready", "existing-compatible"].includes(starter.state)) return true;
    if (starter.state !== "missing") {
      setNotice(`${starter.message} ${previousRoute} remains the active image provider.`);
      return false;
    }

    const confirmed = window.confirm(
      `ComfyUI is running, but it has no SDXL image checkpoint.\n\nPlotPickle can download one reviewed local starter:\n\n` +
      `Model: ${starter.fileName}\nSource: ${starter.sourceLabel}\nSize: ${starter.sizeLabel}\nLicense: ${starter.license}\nDestination: ${starter.destination}\nSHA-256: ${starter.sha256}\n\n` +
      "The download stays local. PlotPickle will write to a .partial file, verify the exact size and SHA-256, then activate it. No H3/video model pack or paid cloud provider will be enabled.\n\nDownload and verify SDXL 1.0 now?",
    );
    if (!confirmed) {
      setNotice(`SDXL was not downloaded. ${previousRoute} remains the active image provider.`);
      return false;
    }

    setWorking("sdxl-starter");
    await jsonRequest<SdxlStarterStatus>(SDXL_STARTER_API, "POST", { approved: true });
    setNotice(`Downloading and verifying ${starter.fileName} (${starter.sizeLabel}). Keep PlotPickle and ComfyUI open.`);

    let current = starter;
    for (let attempt = 0; attempt < 1800; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 2_000));
      current = await jsonRequest<SdxlStarterStatus>(SDXL_STARTER_API);
      if (["ready", "installed", "existing-compatible"].includes(current.state)) break;
      if (["failed", "conflict", "unsupported"].includes(current.state) || current.task?.state === "failed") {
        throw new Error(current.task?.message || current.message || "The reviewed SDXL starter installation failed.");
      }
    }
    if (!["ready", "installed", "existing-compatible"].includes(current.state) && current.task?.state !== "installed") {
      throw new Error("The reviewed SDXL starter download is still running. Leave PlotPickle open and refresh Settings after it finishes.");
    }

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const next = await jsonRequest<MediaStatus>(`${API}/status`);
      const diagnostic = await jsonRequest<DiagnosticResponse>(DIAGNOSTICS_API, "POST", { baseUrl: next.comfyui.baseUrl }).catch(() => null);
      const merged = mergeDiagnostic(next, diagnostic);
      const checkpoint = merged.comfyui.checkpoints.find((name) => name === starter.fileName) || merged.comfyui.checkpoints[0] || "";
      if (checkpoint) {
        await jsonRequest<MediaStatus>(`${API}/comfyui/checkpoint`, "POST", { checkpoint });
        await jsonRequest<MediaStatus>(`${API}/routes`, "POST", { imageRoute: "comfyui", videoRoute: "none" });
        const result = await jsonRequest<ImageTestResult>(`${API}/test/image`, "POST", { route: "comfyui" });
        setImageResult(result);
        await refresh();
        setNotice("SDXL 1.0 is installed, ComfyUI detected the checkpoint, and the local verification image returned to PlotPickle.");
        refreshDashboardLights();
        return true;
      }
      await new Promise((resolve) => window.setTimeout(resolve, 1_500));
    }

    setNotice("SDXL 1.0 was installed and verified on disk, but the running ComfyUI process has not refreshed its checkpoint list yet. Restart the managed ComfyUI instance, then run the live diagnostic again.");
    return false;
  }

  function openComfyInstaller() {
    const destination = comfyInstallation?.officialDownloadUrl || "https://comfy.org/download";
    window.open(destination, "_blank", "noopener,noreferrer");
    setNotice("Opened the official ComfyUI Desktop download page. Complete the visible installer, then return here and choose Refresh status.");
  }

  async function startComfyUiAndSelect() {
    if (!status) return;
    if (comfyInstallation?.installed === false) {
      openComfyInstaller();
      return;
    }
    const confirmed = window.confirm(
      "PlotPickle found or can manage a local ComfyUI installation. It can open/start the local engine and wait for its server on 127.0.0.1:8188.\n\nPlotPickle will not download MiniMax H3, video packs, or other large optional models. If the running image engine has no SDXL checkpoint, PlotPickle will show a separate source/size/license/destination approval before any image-model download. Continue?",
    );
    if (!confirmed) {
      setNotice("ComfyUI was not changed. Your current image provider remains active; you can try again from Settings at any time.");
      return;
    }

    setWorking("comfy-start");
    setNotice("");
    const previousRoute = status.imageRoute;
    try {
      await jsonRequest<{ ready: boolean; state: string; detail?: string }>(COMFY_START_API, "POST", { approved: true });
      const next = await jsonRequest<MediaStatus>(`${API}/status`);
      const [diagnostic, installResponse] = await Promise.all([
        jsonRequest<DiagnosticResponse>(DIAGNOSTICS_API, "POST", { baseUrl: next.comfyui.baseUrl }).catch(() => null),
        jsonRequest<ComfyInstallResponse>(COMFY_START_API).catch(() => null),
      ]);
      let merged = mergeDiagnostic(next, diagnostic);
      setStatus(merged);
      setComfyInstallation(installResponse?.installation ?? comfyInstallation);
      setComfyBaseUrl(merged.comfyui.baseUrl || "http://127.0.0.1:8188");

      if (!merged.comfyui.reachable) {
        setNotice(`ComfyUI did not become reachable. ${previousRoute} remains the active image provider.`);
        return;
      }
      if (!merged.comfyui.imageNodesReady) {
        setNotice(`ComfyUI is running, but required image nodes are missing: ${merged.comfyui.missingImageNodes.join(", ")}. ${previousRoute} remains active.`);
        return;
      }
      if (!merged.comfyui.checkpoint) {
        const installed = await installAndVerifySdxlStarter(previousRoute);
        if (!installed) return;
        const refreshed = await jsonRequest<MediaStatus>(`${API}/status`);
        const refreshedDiagnostic = await jsonRequest<DiagnosticResponse>(DIAGNOSTICS_API, "POST", { baseUrl: refreshed.comfyui.baseUrl }).catch(() => null);
        merged = mergeDiagnostic(refreshed, refreshedDiagnostic);
        if (merged.comfyui.checkpoint) return;
      }

      const activated = await jsonRequest<MediaStatus>(`${API}/routes`, "POST", { imageRoute: "comfyui" });
      setStatus(activated);
      setNotice("ComfyUI is running, required image nodes and a checkpoint are ready. Run Test Image to verify real generation before PlotPickle reports the local route as ready.");
      refreshDashboardLights();
    } catch (error) {
      setNotice(`${error instanceof Error ? error.message : "ComfyUI could not be started."} Your current image provider remains active.`);
      await refresh();
      refreshDashboardLights();
    } finally {
      setWorking("");
    }
  }

  async function selectImageRoute(route: ImageRoute) {
    if (route === "comfyui" && !routeConfigured("comfyui")) {
      if (comfyInstallation?.installed === false) openComfyInstaller();
      else await startComfyUiAndSelect();
      return;
    }
    await chooseRoutes({ imageRoute: route });
  }

  async function testComfyConnection() {
    setWorking("comfy-connection");
    setNotice("");
    try {
      const diagnostic = await jsonRequest<DiagnosticResponse>(DIAGNOSTICS_API, "POST", { baseUrl: comfyBaseUrl });
      const [next, installResponse] = await Promise.all([
        jsonRequest<MediaStatus>(`${API}/status`),
        jsonRequest<ComfyInstallResponse>(COMFY_START_API).catch(() => null),
      ]);
      const merged = mergeDiagnostic(next, diagnostic);
      setStatus(merged);
      setComfyInstallation(installResponse?.installation ?? comfyInstallation);
      setComfyBaseUrl(merged.comfyui.baseUrl);
      setNotice(!merged.comfyui.reachable
        ? merged.comfyui.error || "ComfyUI did not respond."
        : merged.comfyui.capabilityError
          ? merged.comfyui.capabilityError
          : `ComfyUI ${merged.comfyui.version || "service"} responded in ${merged.comfyui.latencyMs ?? 0} ms. ${merged.comfyui.checkpoints.length} checkpoint${merged.comfyui.checkpoints.length === 1 ? "" : "s"} detected.`);
      refreshDashboardLights();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "ComfyUI could not be checked.");
      refreshDashboardLights();
    } finally {
      setWorking("");
    }
  }

  async function chooseCheckpoint(checkpoint: string) {
    setWorking("checkpoint");
    setNotice("");
    try {
      setStatus(await jsonRequest<MediaStatus>(`${API}/comfyui/checkpoint`, "POST", { checkpoint }));
      setImageResult(null);
      setNotice(`${checkpoint} is now the selected ComfyUI image checkpoint. Run Test Image before the route turns green.`);
      refreshDashboardLights();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The checkpoint could not be selected.");
    } finally {
      setWorking("");
    }
  }

  async function testImage(route: ImageRoute) {
    if ((route === "openai" || route === "minimax") && !paidImageConsent) {
      setNotice("Confirm the one paid cloud image test before sending it.");
      return;
    }
    setWorking(`image-${route}`);
    setNotice("");
    setImageResult(null);
    try {
      const result = await jsonRequest<ImageTestResult>(`${API}/test/image`, "POST", {
        route,
        billingAcknowledged: route === "openai" || route === "minimax" ? paidImageConsent : false,
      });
      setImageResult(result);
      setNotice(`${imageOptions.find((item) => item.id === route)?.label} returned a real image to PlotPickle and the route is verified.`);
      await refresh();
      refreshDashboardLights();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The image test failed.");
      await refresh();
      refreshDashboardLights();
    } finally {
      setWorking("");
    }
  }

  async function saveWorkflow() {
    setWorking("workflow");
    setNotice("");
    try {
      const workflow: unknown = JSON.parse(workflowText);
      if (!workflow || typeof workflow !== "object" || Array.isArray(workflow)) throw new Error("Paste a ComfyUI API-format JSON object.");
      setStatus(await jsonRequest<MediaStatus>(`${API}/comfyui/h3-workflow`, "POST", { workflow }));
      setNotice("The reviewed workflow contract was saved without an embedded provider key. Run the paid H3 test to unlock the hybrid route.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The ComfyUI workflow could not be saved.");
    } finally {
      setWorking("");
    }
  }

  async function pollVideo(job: VideoJob) {
    let current = job;
    for (let attempt = 0; attempt < 160 && (current.status === "queued" || current.status === "running"); attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 3_000));
      current = await jsonRequest<VideoJob>(`/api/local-ai/video/${encodeURIComponent(current.id)}`);
      setVideoJob(current);
    }
    if (current.status === "succeeded") {
      setNotice("The H3 test completed and PlotPickle received the local video asset.");
      if (current.route === "minimax-direct") await chooseRoutes({ videoRoute: "minimax-direct" });
      else await refresh();
    } else if (current.status !== "queued" && current.status !== "running") {
      throw new Error(current.error || `The H3 test ended with status ${current.status}.`);
    } else throw new Error("The H3 test is still running. Its job remains available after this polling window.");
  }

  async function testVideo(route: Exclude<VideoRoute, "none">) {
    if (!paidVideoConsent) {
      setNotice("Confirm that this creates one paid four-second MiniMax-H3 test clip using your account.");
      return;
    }
    const confirmed = window.confirm("Create one paid four-second MiniMax-H3 test clip now? Charges go directly to your MiniMax account.");
    if (!confirmed) return;
    setWorking(`video-${route}`);
    setNotice("");
    setVideoJob(null);
    try {
      const job = await jsonRequest<VideoJob>(`${API}/test/video`, "POST", {
        route,
        billingAcknowledged: true,
        dataSharingAcknowledged: true,
      });
      setVideoJob(job);
      setNotice("H3 accepted the test job. PlotPickle is waiting for the returned asset.");
      await pollVideo(job);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The H3 test failed.");
      await refresh();
    } finally {
      setWorking("");
    }
  }

  if (!status) {
    return <section className={styles.panel}><p>{notice || "Checking image and video engines…"}</p></section>;
  }

  const comfyConfigured = status.comfyui.reachable && status.comfyui.imageNodesReady && Boolean(status.comfyui.checkpoint);
  const comfyReady = comfyConfigured && Boolean(status.comfyui.imageVerifiedAt);
  const comfyState = comfyReady ? "ready" : status.comfyui.reachable || comfyInstallation?.installed ? "attention" : "error";
  const comfyStateLabel = comfyReady
    ? "Tested · ready"
    : comfyConfigured
      ? "Running · test needed"
      : status.comfyui.reachable
        ? "Running · setup needed"
        : comfyInstallation?.installed
          ? "Installed · stopped"
          : comfyInstallation
            ? "Not installed"
            : "Not connected";

  return (
    <section className={styles.panel} aria-labelledby="media-routing-title">
      <header className={styles.header}>
        <div>
          <p>Independent creative engines</p>
          <h2 id="media-routing-title">Images &amp; Video</h2>
          <span>Choose and test each route separately. PlotPickle never falls back to a paid provider automatically.</span>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={Boolean(working)}>Refresh status</button>
      </header>

      <div className={styles.columns}>
        <article className={styles.routeCard}>
          <header><div><p>Image engine</p><h3>Where should PlotPickle create images?</h3></div><strong>{status.imageRoute}</strong></header>
          <div className={styles.options}>
            {imageOptions.map((option) => {
              const verified = imageVerified(status, option.id);
              const configured = routeConfigured(option.id);
              const stateLabel = option.id === "comfyui"
                ? verified ? "Ready" : configured ? "Test needed" : status.comfyui.reachable ? "Setup needed" : comfyInstallation?.installed ? "Installed" : "Set up"
                : verified ? "Ready" : configured ? "Test needed" : "Setup needed";
              return (
                <div className={styles.option} data-active={status.imageRoute === option.id} key={option.id}>
                  <button type="button" className={styles.select} onClick={() => void selectImageRoute(option.id)} disabled={Boolean(working) || (option.id !== "comfyui" && !configured)}>
                    <span><b>{option.label}</b><small>{option.detail}</small></span>
                    <em>{stateLabel}</em>
                  </button>
                  {option.id !== "manual" ? (
                    <button type="button" className={styles.test} onClick={() => void testImage(option.id)} disabled={Boolean(working) || !configured}>
                      {working === `image-${option.id}` ? "Testing…" : "Test Image"}
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
          <label className={styles.consent}><input type="checkbox" checked={paidImageConsent} onChange={(event) => setPaidImageConsent(event.target.checked)} /><span><b>Cloud image test approval</b><small>Allow one low-quality paid test through the selected OpenAI or MiniMax account.</small></span></label>
          <div className={styles.actions}>
            <button type="button" onClick={() => onManage("Cloud images & video")}>Configure OpenAI or MiniMax</button>
          </div>
          <section id="plotpickle-comfyui-connection" className={styles.comfyConnection} aria-label="ComfyUI connection setup">
            <header>
              <span>Local ComfyUI connection</span>
              <strong data-state={comfyState}>{comfyStateLabel}</strong>
            </header>
            <label>
              <span>ComfyUI server address</span>
              <input value={comfyBaseUrl} onChange={(event) => setComfyBaseUrl(event.target.value)} placeholder="http://127.0.0.1:8188" spellCheck={false} />
            </label>
            {!status.comfyui.reachable && comfyInstallation?.installed === false ? (
              <button type="button" onClick={openComfyInstaller} disabled={Boolean(working)}>Install ComfyUI Desktop</button>
            ) : !comfyConfigured ? (
              <button type="button" onClick={() => void startComfyUiAndSelect()} disabled={Boolean(working)}>
                {working === "sdxl-starter" ? "Downloading / verifying SDXL 1.0…" : working === "comfy-start" ? "Starting ComfyUI…" : status.comfyui.reachable ? "Finish ComfyUI setup" : "Start ComfyUI"}
              </button>
            ) : null}
            <button type="button" onClick={() => void testComfyConnection()} disabled={Boolean(working) || !comfyBaseUrl.trim()}>
              {working === "comfy-connection" ? "Running live diagnostic…" : "Save & run live ComfyUI diagnostic"}
            </button>
            <small>PlotPickle detects ComfyUI without launching it. If Desktop is installed but stopped, Start ComfyUI launches the existing local engine. If no SDXL checkpoint exists, PlotPickle shows source, size, license, destination and SHA-256 before asking separately for download approval. H3/video packs and cloud providers remain separate.</small>
            <small>{status.comfyui.reachable
              ? status.comfyui.capabilityError || `${status.comfyui.version ? `Version ${status.comfyui.version} · ` : ""}service responded${status.comfyui.latencyMs !== undefined ? ` in ${status.comfyui.latencyMs} ms` : ""}. ${status.comfyui.imageNodesReady ? "Required image nodes found." : `Missing nodes: ${status.comfyui.missingImageNodes.join(", ")}.`}`
              : comfyInstallation?.detail || status.comfyui.error || "ComfyUI is not responding on port 8188."}</small>
            {comfyInstallation?.location ? <small>Detected at {comfyInstallation.location}.</small> : null}
            {status.comfyui.checkedAt ? <small>Last checked {formatDate(status.comfyui.checkedAt)}.</small> : null}
          </section>
          {status.comfyui.checkpoints.length ? (
            <label className={styles.checkpoint}><span>ComfyUI checkpoint</span><select value={status.comfyui.checkpoint} onChange={(event) => void chooseCheckpoint(event.target.value)} disabled={Boolean(working)}>{status.comfyui.checkpoints.map((name) => <option value={name} key={name}>{name}</option>)}</select></label>
          ) : <p className={styles.warning}>{status.comfyui.reachable ? status.comfyui.capabilityError || "ComfyUI is running, but no checkpoint is available. Choose Finish ComfyUI setup to review the recommended SDXL 1.0 starter." : comfyInstallation?.installed ? "ComfyUI is installed but stopped. Choose Start ComfyUI." : status.comfyui.error || "ComfyUI is not responding on port 8188."}</p>}
          {imageResult ? <figure className={styles.preview}><img src={imageResult.assetUrl} alt="Generated media route connection test" /><figcaption>{imageResult.route} test asset stored locally{imageResult.assetLocation ? ` · ${imageResult.assetLocation}` : ""}</figcaption></figure> : null}
        </article>

        <article className={styles.routeCard}>
          <header><div><p>Video engine</p><h3>How should MiniMax-H3 run?</h3></div><strong>{status.videoRoute}</strong></header>
          <div className={styles.options}>
            {videoOptions.map((option) => {
              const configured = option.id === "none" || (option.id === "minimax-direct" ? status.profiles.minimax.configured : status.hybridGate.ready);
              const directReady = Boolean(status.profiles.minimax.videoVerifiedAt);
              const state = option.id === "minimax-comfyui"
                ? status.hybridGate.ready ? "Ready" : "Locked"
                : option.id === "minimax-direct"
                  ? !configured ? "Setup needed" : directReady ? "Ready" : "Test needed"
                  : "Off";
              return (
                <div className={styles.option} data-active={status.videoRoute === option.id} key={option.id}>
                  <button type="button" className={styles.select} onClick={() => void chooseRoutes({ videoRoute: option.id })} disabled={Boolean(working) || !configured}>
                    <span><b>{option.label}</b><small>{option.detail}</small></span>
                    <em>{state}</em>
                  </button>
                  {option.id !== "none" ? <button type="button" className={styles.test} onClick={() => void testVideo(option.id)} disabled={Boolean(working) || !status.profiles.minimax.configured || (option.id === "minimax-comfyui" && !hybridCanTest)}>{working === `video-${option.id}` ? "Testing…" : "Paid H3 test"}</button> : null}
                </div>
              );
            })}
          </div>
          <label className={styles.consent}><input type="checkbox" checked={paidVideoConsent} onChange={(event) => setPaidVideoConsent(event.target.checked)} /><span><b>Paid H3 test approval</b><small>Create one four-second test clip and upload only the displayed prompt through your MiniMax account.</small></span></label>
          {videoJob ? <div className={styles.job} data-state={videoJob.status}><b>{videoJob.model}</b><span>{videoJob.status}</span>{videoJob.outputAssetUrl ? <video src={videoJob.outputAssetUrl} controls preload="metadata" /> : null}</div> : null}
        </article>
      </div>

      <article className={styles.hybrid}>
        <header><div><p>Hybrid prerequisite gate</p><h3>MiniMax-H3 through ComfyUI</h3><span>This route stays locked until the local service, workflow nodes, MiniMax profile and returned test asset are all verified.</span></div><strong>{status.hybridGate.ready ? "Unlocked" : "Locked"}</strong></header>
        <div className={styles.requirements}>{status.hybridGate.requirements.map((item) => <div data-ready={item.ready} key={item.id}><i aria-hidden="true" /><span>{item.label}</span><b>{item.ready ? "Ready" : "Required"}</b></div>)}</div>
        <details>
          <summary>Import reviewed ComfyUI API workflow</summary>
          <p>Export the workflow in ComfyUI’s API format. Use <code>{"{{PLOTPICKLE_PROMPT}}"}</code> and <code>{"{{PLOTPICKLE_MINIMAX_KEY}}"}</code> placeholders. PlotPickle rejects embedded credentials and verifies every class_type node.</p>
          <textarea value={workflowText} onChange={(event) => setWorkflowText(event.target.value)} placeholder='{"1":{"class_type":"YourMiniMaxH3Node","inputs":{"prompt":"{{PLOTPICKLE_PROMPT}}","api_key":"{{PLOTPICKLE_MINIMAX_KEY}}"}}}' rows={9} />
          <button type="button" onClick={() => void saveWorkflow()} disabled={working === "workflow" || !workflowText.trim()}>{working === "workflow" ? "Checking workflow…" : "Save and verify workflow nodes"}</button>
          {status.comfyui.h3Workflow.configured ? <small>{status.comfyui.h3Workflow.nodeClasses?.length || 0} nodes · configured {formatDate(status.comfyui.h3Workflow.configuredAt)} · tested {formatDate(status.comfyui.h3Workflow.verifiedAt)}</small> : null}
        </details>
      </article>

      {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
      <footer><span>Active image route: <b>{status.imageRoute}</b> · Active video route: <b>{status.videoRoute}</b></span><span>ComfyUI image test: {formatDate(status.comfyui.imageVerifiedAt)} · MiniMax H3 test: {formatDate(status.profiles.minimax.videoVerifiedAt)}</span></footer>
    </section>
  );
}