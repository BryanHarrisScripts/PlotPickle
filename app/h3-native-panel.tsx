"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./h3-native-panel.module.css";

type ModelRequirement = {
  id: string;
  label: string;
  directory: string;
  filenames: string[];
  found: string;
  ready: boolean;
};

type NativeH3Status = {
  active: boolean;
  allowConstrainedVram: boolean;
  configuredAt: string;
  verifiedAt: string;
  lastError: string;
  baseUrl: string;
  reachable: boolean;
  version: string;
  manifestConfigured: boolean;
  manifestHash?: string;
  minimumComfyUIVersion?: string;
  compatibleVersion: boolean;
  workflowFamily: string;
  officialSource: string;
  nodeClasses: string[];
  missingNodes: string[];
  modelRequirements: ModelRequirement[];
  modelsReady: boolean;
  vramGiB: number;
  vramProfile: string;
  vramWarning: string;
  ready: boolean;
  error: string;
  setup: {
    installsWeights: boolean;
    installsCustomNodes: boolean;
    executesDownloadedCode: boolean;
    officialSources: string[];
  };
};

type NativeH3Job = {
  id: string;
  route: "minimax-h3-native";
  model: "MiniMax-H3";
  family: string;
  status: "queued" | "running" | "succeeded" | "failed" | "expired";
  outputAssetUrl?: string;
  error?: string;
};

const API = "/api/media-routing/comfyui/h3-native";
const families = [
  ["text-to-video", "Text to video"],
  ["image-to-video", "Image to video"],
  ["first-last-frame", "First and last frame"],
  ["reference-to-video", "Reference to video"],
  ["in-place-edit", "In-place editing"],
] as const;

async function jsonRequest<T>(path: string, method: "GET" | "POST" = "GET", body?: object) {
  const response = await fetch(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) throw new Error("The local native H3 gateway is unavailable.");
  const value = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(value.message || "The native H3 request failed.");
  return value;
}

function formatDate(value: string) {
  if (!value) return "Not yet";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString();
}

export default function H3NativePanel() {
  const [status, setStatus] = useState<NativeH3Status | null>(null);
  const [baseUrl, setBaseUrl] = useState("http://127.0.0.1:8188");
  const [manifestText, setManifestText] = useState("");
  const [performanceAcknowledged, setPerformanceAcknowledged] = useState(false);
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("");
  const [job, setJob] = useState<NativeH3Job | null>(null);

  async function refresh() {
    try {
      const next = await jsonRequest<NativeH3Status>(`${API}/status`);
      setStatus(next);
      setBaseUrl(next.baseUrl || "http://127.0.0.1:8188");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Native H3 status could not be checked.");
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const requirements = useMemo(() => {
    if (!status) return [];
    return [
      { label: "ComfyUI responds locally", ready: status.reachable },
      { label: "Official-source H3 manifest imported", ready: status.manifestConfigured },
      { label: `ComfyUI ${status.minimumComfyUIVersion || "compatible version"} or newer`, ready: status.compatibleVersion },
      { label: "Every workflow node is available", ready: status.missingNodes.length === 0 && status.manifestConfigured },
      { label: "Every user-owned model file is detected", ready: status.modelsReady },
      { label: "GPU profile acknowledged", ready: status.vramProfile !== "impractical" && (status.vramProfile !== "constrained" || performanceAcknowledged || status.allowConstrainedVram) },
    ];
  }, [performanceAcknowledged, status]);

  async function saveConnection() {
    setWorking("connection");
    setNotice("");
    try {
      const next = await jsonRequest<NativeH3Status>(`${API}/connection`, "POST", { baseUrl });
      setStatus(next);
      setNotice(next.reachable ? `ComfyUI ${next.version || "service"} responded.` : next.error);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "ComfyUI could not be checked.");
    } finally {
      setWorking("");
    }
  }

  async function importManifest() {
    setWorking("manifest");
    setNotice("");
    try {
      const manifest: unknown = JSON.parse(manifestText);
      const next = await jsonRequest<NativeH3Status>(`${API}/manifest`, "POST", { manifest });
      setStatus(next);
      setNotice("Official-source native H3 workflow manifest saved. PlotPickle did not download weights or execute installer code.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The native H3 manifest could not be saved.");
    } finally {
      setWorking("");
    }
  }

  async function setActive(active: boolean) {
    setWorking("activation");
    setNotice("");
    try {
      const next = await jsonRequest<NativeH3Status>(`${API}/activation`, "POST", {
        active,
        allowConstrainedVram: status?.vramProfile === "constrained" ? performanceAcknowledged : false,
      });
      setStatus(next);
      setNotice(active
        ? "Native MiniMax H3 is now the local PlotPickle video route. Cloud MiniMax remains separate."
        : "Native H3 is off. No local workflow will receive PlotPickle video requests.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Native H3 activation failed.");
      await refresh();
    } finally {
      setWorking("");
    }
  }

  async function pollJob(initial: NativeH3Job) {
    let current = initial;
    for (let attempt = 0; attempt < 240 && (current.status === "queued" || current.status === "running"); attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 3_000));
      current = await jsonRequest<NativeH3Job>(`/api/local-ai/video/${encodeURIComponent(current.id)}`);
      setJob(current);
    }
    if (current.status === "succeeded") {
      setNotice("Native H3 completed locally and returned the video to PlotPickle assets.");
      await refresh();
      return;
    }
    throw new Error(current.error || `Native H3 ended with status ${current.status}.`);
  }

  async function testNative() {
    if (!status) return;
    if (status.vramProfile === "constrained" && !performanceAcknowledged) {
      setNotice("Acknowledge the 8 GB VRAM warning before testing native H3.");
      return;
    }
    if (status.workflowFamily !== "text-to-video") {
      setNotice("This official workflow needs a selected PlotPickle reference asset. Test it from a storyboard or scene asset context.");
      return;
    }
    setWorking("test");
    setNotice("");
    setJob(null);
    try {
      const next = await jsonRequest<NativeH3Job>(`${API}/test`, "POST", { performanceAcknowledged });
      setJob(next);
      setNotice("ComfyUI accepted the local H3 test. PlotPickle is checking the returned asset.");
      await pollJob(next);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The native H3 test failed.");
    } finally {
      setWorking("");
    }
  }

  if (!status) return <section className={styles.panel}><p>{notice || "Checking native MiniMax H3 readiness…"}</p></section>;

  return (
    <section className={styles.panel} aria-labelledby="native-h3-title">
      <header className={styles.header}>
        <div>
          <p>Local video model</p>
          <h2 id="native-h3-title">MiniMax H3 · Native ComfyUI</h2>
          <span>Runs user-owned H3 weights locally. No MiniMax cloud key, automatic model download, custom-node installer or silent code execution.</span>
        </div>
        <strong data-ready={status.active && status.ready}>{status.active && status.ready ? "Active" : status.ready ? "Ready" : "Setup required"}</strong>
      </header>

      <div className={styles.grid}>
        <article className={styles.card}>
          <h3>Live readiness</h3>
          <div className={styles.requirements}>
            {requirements.map((item) => <div key={item.label} data-ready={item.ready}><i aria-hidden="true" /><span>{item.label}</span><b>{item.ready ? "Ready" : "Required"}</b></div>)}
          </div>
          <dl className={styles.facts}>
            <div><dt>ComfyUI</dt><dd>{status.reachable ? status.version || "Connected" : "Not connected"}</dd></div>
            <div><dt>Workflow</dt><dd>{status.workflowFamily || "Waiting for official manifest"}</dd></div>
            <div><dt>VRAM</dt><dd>{status.vramGiB ? `${status.vramGiB} GB · ${status.vramProfile}` : "Not detected"}</dd></div>
            <div><dt>Last local output</dt><dd>{formatDate(status.verifiedAt)}</dd></div>
          </dl>
          <p className={styles.warning}>{status.vramWarning}</p>
          {status.vramProfile === "constrained" ? (
            <label className={styles.acknowledgement}>
              <input type="checkbox" checked={performanceAcknowledged} onChange={(event) => setPerformanceAcknowledged(event.target.checked)} />
              <span><b>8 GB compatibility acknowledgement</b><small>Generation may fail, take a very long time, or require a lower-resolution official workflow. PlotPickle does not promise 2K or 15 seconds locally.</small></span>
            </label>
          ) : null}
          <div className={styles.actions}>
            <button type="button" onClick={() => void setActive(!status.active)} disabled={Boolean(working) || (!status.active && !status.ready)}>
              {working === "activation" ? "Updating…" : status.active ? "Turn native H3 off" : "Use native H3 for video"}
            </button>
            <button type="button" onClick={() => void testNative()} disabled={Boolean(working) || !status.active || !status.ready}>
              {working === "test" ? "Testing locally…" : "Run local H3 test"}
            </button>
          </div>
          {job ? <div className={styles.job} data-state={job.status}><b>{job.model}</b><span>{job.status}</span>{job.outputAssetUrl ? <video src={job.outputAssetUrl} controls preload="metadata" /> : null}</div> : null}
        </article>

        <article className={styles.card}>
          <h3>Official workflow setup</h3>
          <label className={styles.field}>
            <span>Local ComfyUI address</span>
            <input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} spellCheck={false} />
          </label>
          <button type="button" onClick={() => void saveConnection()} disabled={Boolean(working) || !baseUrl.trim()}>
            {working === "connection" ? "Checking…" : "Save and inspect ComfyUI"}
          </button>
          <details>
            <summary>Import official H3 workflow manifest</summary>
            <p>The manifest must cite MiniMax or ComfyUI, declare the minimum compatible ComfyUI version, list expected model files and contain an API-format workflow. Cloud authorization fields and installer or network nodes are rejected.</p>
            <textarea value={manifestText} onChange={(event) => setManifestText(event.target.value)} rows={10} placeholder='{"schemaVersion":1,"model":"MiniMax-H3","workflowFamily":"text-to-video","officialSource":"https://github.com/MiniMax-AI/...","minimumComfyUIVersion":"0.0.0","requiredModels":[],"workflow":{}}' />
            <button type="button" onClick={() => void importManifest()} disabled={working === "manifest" || !manifestText.trim()}>
              {working === "manifest" ? "Validating…" : "Validate and save manifest"}
            </button>
          </details>
          <div className={styles.families} aria-label="Supported MiniMax H3 workflow families">
            {families.map(([id, label]) => <span key={id} data-available={status.workflowFamily === id}>{label}</span>)}
          </div>
          {status.modelRequirements.length ? (
            <div className={styles.models}>
              <h4>Required model files</h4>
              {status.modelRequirements.map((item) => (
                <div key={item.id} data-ready={item.ready}>
                  <span><b>{item.label}</b><small>ComfyUI/models/{item.directory} · {item.found || item.filenames.join(" or ")}</small></span>
                  <em>{item.ready ? "Found" : "Missing"}</em>
                </div>
              ))}
            </div>
          ) : null}
          <nav className={styles.sources} aria-label="Official native H3 setup sources">
            {status.setup.officialSources.map((source) => <a href={source} target="_blank" rel="noreferrer" key={source}>{new URL(source).hostname}</a>)}
          </nav>
        </article>
      </div>

      {notice || status.error || status.lastError ? <p className={styles.notice} role="status">{notice || status.error || status.lastError}</p> : null}
    </section>
  );
}
