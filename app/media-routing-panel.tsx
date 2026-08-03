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
type MediaStatus = {
  imageRoute: ImageRoute;
  videoRoute: VideoRoute;
  profiles: { openai: PublicProfile; minimax: PublicProfile };
  comfyui: {
    reachable: boolean;
    baseUrl: string;
    version: string;
    checkpoints: string[];
    imageNodesReady: boolean;
    missingImageNodes: string[];
    workflowNodesReady: boolean;
    missingWorkflowNodes: string[];
    error: string;
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
  hybridGate: { ready: boolean; requirements: Requirement[] };
};
type ImageTestResult = { assetUrl: string; route: ImageRoute; providerRequestId?: string };
type VideoJob = {
  id: string;
  route: VideoRoute;
  model: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled" | "expired";
  outputAssetUrl?: string;
  error?: string;
};

const API = "/api/media-routing";
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

export default function MediaRoutingPanel({ onManage }: { onManage: (target: string) => void }) {
  const [status, setStatus] = useState<MediaStatus | null>(null);
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
      setStatus(next);
      setComfyBaseUrl(next.comfyui.baseUrl || "http://127.0.0.1:8188");
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
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The route could not be selected.");
    } finally {
      setWorking("");
    }
  }

  async function testComfyConnection() {
    setWorking("comfy-connection");
    setNotice("");
    try {
      const next = await jsonRequest<MediaStatus>(`${API}/comfyui/connection`, "POST", { baseUrl: comfyBaseUrl });
      setStatus(next);
      setComfyBaseUrl(next.comfyui.baseUrl);
      setNotice(next.comfyui.reachable
        ? `ComfyUI ${next.comfyui.version || "service"} responded. ${next.comfyui.checkpoints.length} checkpoint${next.comfyui.checkpoints.length === 1 ? "" : "s"} detected.`
        : next.comfyui.error || "ComfyUI did not respond.");
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
      setNotice(`${imageOptions.find((item) => item.id === route)?.label} returned a real image to PlotPickle.`);
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
              return (
                <div className={styles.option} data-active={status.imageRoute === option.id} key={option.id}>
                  <button type="button" className={styles.select} onClick={() => void chooseRoutes({ imageRoute: option.id })} disabled={Boolean(working) || !configured}>
                    <span><b>{option.label}</b><small>{option.detail}</small></span>
                    <em>{verified ? "Ready" : configured ? "Test needed" : "Setup needed"}</em>
                  </button>
                  {option.id !== "manual" ? (
                    <button type="button" className={styles.test} onClick={() => void testImage(option.id)} disabled={Boolean(working) || !configured}>
                      {working === `image-${option.id}` ? "Testing…" : "Test image"}
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
              <strong data-state={status.comfyui.reachable && status.comfyui.imageNodesReady && status.comfyui.checkpoint ? "ready" : "attention"}>
                {status.comfyui.reachable ? status.comfyui.checkpoint ? "Connected" : "Checkpoint needed" : "Not connected"}
              </strong>
            </header>
            <label>
              <span>ComfyUI server address</span>
              <input value={comfyBaseUrl} onChange={(event) => setComfyBaseUrl(event.target.value)} placeholder="http://127.0.0.1:8188" spellCheck={false} />
            </label>
            <button type="button" onClick={() => void testComfyConnection()} disabled={Boolean(working) || !comfyBaseUrl.trim()}>
              {working === "comfy-connection" ? "Testing ComfyUI…" : "Save & test ComfyUI connection"}
            </button>
            <small>{status.comfyui.reachable
              ? `${status.comfyui.version ? `Version ${status.comfyui.version} · ` : ""}${status.comfyui.imageNodesReady ? "required image nodes found" : `missing nodes: ${status.comfyui.missingImageNodes.join(", ")}`}`
              : status.comfyui.error || "Start ComfyUI, then run this live connection test."}</small>
          </section>
          {status.comfyui.checkpoints.length ? (
            <label className={styles.checkpoint}><span>ComfyUI checkpoint</span><select value={status.comfyui.checkpoint} onChange={(event) => void chooseCheckpoint(event.target.value)} disabled={Boolean(working)}>{status.comfyui.checkpoints.map((name) => <option value={name} key={name}>{name}</option>)}</select></label>
          ) : <p className={styles.warning}>ComfyUI is {status.comfyui.reachable ? "running, but no checkpoint is available" : "not responding on 127.0.0.1:8188"}.</p>}
          {imageResult ? <figure className={styles.preview}><img src={imageResult.assetUrl} alt="Generated media route connection test" /><figcaption>{imageResult.route} test asset stored locally</figcaption></figure> : null}
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
