"use client";

import { useEffect, useState } from "react";

type LtxSetupTask = {
  state: "idle" | "installing" | "installed" | "failed";
  message: string;
  startedAt: string;
  finishedAt: string;
};

type LtxStatus = {
  blockers: string[];
  ok?: boolean;
  enabled: boolean;
  configuredAt: string;
  verifiedAt: string;
  lastError: string;
  reachable: boolean;
  version: string;
  manifestConfigured: boolean;
  missingNodes: string[];
  missingModels: string[];
  ready: boolean;
  model: string;
  error: string;
  setupTask?: LtxSetupTask;
  reviewedDownloadSize?: string;
};

type LtxTestResult = {
  ok?: boolean;
  status?: string;
  outputAssetUrl?: string;
  error?: string;
  message?: string;
};

const STATUS_API = "/api/local-ai/ltx-video";
const MANIFEST_API = "/api/local-ai/ltx-video/manifest";
const SETUP_API = "/api/local-ai/ltx-video/setup";
const TEST_API = "/api/local-ai/ltx-video/test";

const panel: React.CSSProperties = {
  border: "1px solid #287a4b",
  background: "#050705",
  color: "#ededed",
  padding: 18,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
};

const card: React.CSSProperties = {
  border: "1px solid #23412e",
  background: "#090d0a",
  padding: 14,
};

const button: React.CSSProperties = {
  minHeight: 38,
  padding: "8px 14px",
  border: "1px solid #79bd92",
  background: "#102116",
  color: "#f2fff5",
  font: "inherit",
  fontWeight: 700,
  cursor: "pointer",
};

const yellowButton: React.CSSProperties = {
  ...button,
  borderColor: "#d8c85d",
  background: "#211f0d",
  color: "#fff0a6",
};

async function readJson<T>(response: Response, fallback: string) {
  const type = response.headers.get("content-type") || "";
  if (!type.includes("application/json")) throw new Error(fallback);
  const value = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(value.message || fallback);
  return value;
}

function setupBlocker(status: LtxStatus | null) {
  if (!status) return { title: "CHECKING LTX", detail: "Reading the local LTX-Video setup." };
  if (status.setupTask?.state === "installing") return { title: "INSTALLING LTX MODELS", detail: status.setupTask.message };
  if (status.setupTask?.state === "failed") return { title: "LTX MODEL INSTALL FAILED", detail: status.setupTask.message };
  if (!status.reachable) return { title: "COMFYUI SERVICE NOT READY", detail: status.error || "Start the managed ComfyUI service first." };
  if (!status.manifestConfigured) return { title: "LTX WORKFLOW NOT CONFIGURED", detail: "Press SET UP LTX to load the bundled PlotPickle workflow." };
  if (status.missingNodes.length) return { title: "LTX NODES MISSING / CORE", detail: status.missingNodes.map((name) => `MISSING NODE: ${name}`).join("; ") };
  if (status.missingModels.length) return { title: "LTX MODELS MISSING", detail: status.missingModels.map((name) => `MISSING MODEL: ${name}`).join("; ") };
  if (!status.ready) return { title: "LTX SETUP INCOMPLETE", detail: status.error || status.lastError || "The reviewed LTX workflow is not ready yet." };
  if (status.lastError) return { title: "LOCAL TEST FAILED", detail: status.lastError };
  return { title: "LTX READY", detail: "The reviewed local LTX text-to-video workflow is ready for a test render." };
}

export default function LocalLtxSetupPanel() {
  const [status, setStatus] = useState<LtxStatus | null>(null);
  const [notice, setNotice] = useState("Checking LTX-Video setup...");
  const [working, setWorking] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [manifestText, setManifestText] = useState("");
  const [testResult, setTestResult] = useState<LtxTestResult | null>(null);

  async function refresh() {
    try {
      const response = await fetch(STATUS_API, { cache: "no-store" });
      const next = await readJson<LtxStatus>(response, "The local LTX-Video gateway is unavailable.");
      setStatus(next);
      const blocker = setupBlocker(next);
      setNotice(blocker.detail);
      return next;
    } catch (error) {
      setStatus(null);
      setTestResult(null);
      setNotice(error instanceof Error ? error.message : "LTX-Video setup could not be checked.");
      return null;
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (status?.setupTask?.state !== "installing") return;
    const timer = window.setInterval(() => { void refresh(); }, 2500);
    return () => window.clearInterval(timer);
  }, [status?.setupTask?.state]);

  async function setupDefault() {
    if (working || status?.setupTask?.state === "installing") return;
    const needsModels = Boolean(status?.missingModels.length);
    const downloadSize = status?.reviewedDownloadSize || "16.13 GB";
    if (needsModels && !window.confirm(`PlotPickle needs to download and verify up to ${downloadSize} of reviewed LTX model files for local video. Continue?`)) return;

    setWorking(true);
    setTestResult(null);
    setNotice(needsModels ? `Starting the reviewed ${downloadSize} LTX model installation...` : "Configuring the bundled LTX workflow...");
    try {
      const response = await fetch(SETUP_API, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ approved: needsModels }),
      });
      const next = await readJson<LtxStatus>(response, "LTX setup failed.");
      setStatus(next);
      setNotice(next.setupTask?.message || setupBlocker(next).detail);
      if (next.setupTask?.state !== "installing") await refresh();
      window.dispatchEvent(new CustomEvent("plotpickle:setup-status-refresh"));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "LTX setup failed.");
    } finally { setWorking(false); }
  }

  async function importManifest() {
    if (working) return;
    setWorking(true);
    setTestResult(null);
    setNotice("Importing reviewed LTX manifest...");
    try {
      const manifest = JSON.parse(manifestText) as unknown;
      const response = await fetch(MANIFEST_API, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ manifest }),
      });
      await readJson<LtxStatus>(response, "PlotPickle could not import the LTX manifest.");
      setNotice("LTX manifest imported. Checking local nodes and model files...");
      setManifestText("");
      await refresh();
      window.dispatchEvent(new CustomEvent("plotpickle:setup-status-refresh"));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The LTX manifest could not be imported.");
    } finally {
      setWorking(false);
    }
  }

  async function testLocalVideo() {
    if (working || !status?.ready) return;
    setWorking(true);
    setTestResult(null);
    setNotice("Running a short local LTX text-to-video test...");
    try {
      const response = await fetch(TEST_API, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          prompt: "A short black-and-white cinematic shot of a person walking slowly through a dim room, subtle motion, steady camera.",
        }),
      });
      const result = await readJson<LtxTestResult>(response, "The local LTX test failed.");
      if (result.ok !== true || result.status !== "succeeded" || !result.outputAssetUrl) {
        throw new Error(result.error || result.message || "The LTX test returned no completed video.");
      }
      await refresh();
      setTestResult(result);
      setNotice("Local LTX video test passed.");
      window.dispatchEvent(new CustomEvent("plotpickle:setup-status-refresh"));
    } catch (error) {
      const message = error instanceof Error ? error.message : "The local LTX test failed.";
      setTestResult({ error: message });
      setNotice(message);
    } finally {
      setWorking(false);
    }
  }

  const blocker = setupBlocker(status);
  const installing = status?.setupTask?.state === "installing";
  const nodesReady = Boolean(status?.manifestConfigured && status.missingNodes.length === 0);
  const modelsReady = Boolean(status?.manifestConfigured && status.missingModels.length === 0);
  const testPassed = Boolean(status?.ready && !testResult?.error && !status.lastError && (status.verifiedAt || testResult?.outputAssetUrl));

  return (
    <section style={panel} aria-labelledby="local-ltx-title">
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 14, flexWrap: "wrap" }}>
        <div>
          <p style={{ margin: 0, color: "#79bd92", fontSize: 12 }}>LOCAL AI / LTX-VIDEO</p>
          <h2 id="local-ltx-title" style={{ margin: "5px 0 8px" }}>LTX-VIDEO 2B 0.9.8 DISTILLED</h2>
          <p style={{ margin: 0, maxWidth: 880, lineHeight: 1.5, color: "#c9d3cc" }}>
            PlotPickle's current hardware-optimized local text-to-video plug-in. ComfyUI remains the managed runtime; this screen configures, installs the reviewed model files, and tests the LTX workflow itself.
          </p>
        </div>
        <span style={{ border: `1px solid ${status?.ready ? "#79bd92" : "#6c6632"}`, padding: "5px 9px", color: status?.ready ? "#79bd92" : "#d8c85d" }}>
          {installing ? "INSTALLING" : status?.ready ? "READY" : "SETUP NEEDED"}
        </span>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 10, marginTop: 16 }}>
        <div style={card}><strong>ComfyUI Service</strong><p>{status === null ? "CHECKING..." : status.reachable ? "READY" : "STOPPED"}</p><small>127.0.0.1:8188{status?.version ? ` · ${status.version}` : ""}</small></div>
        <div style={card}><strong>PlotPickle LTX Workflow</strong><p>{status?.manifestConfigured ? "CONFIGURED" : "SETUP NEEDED"}</p><small>Bundled text-to-video workflow</small></div>
        <div style={card}><strong>LTX Nodes</strong><p>{nodesReady ? "READY" : "SETUP NEEDED"}</p><small>{status?.missingNodes.length ? status.missingNodes.join(", ") : "ComfyUI core nodes only"}</small></div>
        <div style={card}><strong>LTX Models</strong><p>{installing ? "INSTALLING" : modelsReady ? "READY" : "SETUP NEEDED"}</p><small>{status?.missingModels.length ? status.missingModels.join(", ") : "Reviewed local model files"}</small></div>
        <div style={card}><strong>Video Status</strong><p>{testPassed ? "VERIFIED / GREEN" : status?.ready ? "READY TO TEST" : "BLOCKED"}</p><small>640 × 352 / 25 frames / 8 steps / no upscaling</small></div>
        <div style={card}><strong>Local Test</strong><p>{testResult?.error || status?.lastError ? "FAILED" : testPassed ? "PASSED" : "NOT TESTED"}</p><small>{status?.verifiedAt || "Short local text-to-video verification"}</small></div>
      </div>

      <div style={{ ...card, marginTop: 12, borderColor: status?.ready ? "#287a4b" : "#746a24", background: status?.ready ? "#0b160e" : "#171508" }}>
        <p style={{ margin: 0, color: status?.ready ? "#79bd92" : "#d8c85d", fontSize: 12, letterSpacing: ".08em" }}>{status?.ready ? "ENGINE STATUS" : "SETUP BLOCKER"}</p>
        <h3 style={{ margin: "7px 0" }}>{blocker.title}</h3>
        <p style={{ margin: 0, color: "#d7ded8", lineHeight: 1.5 }}>{installing ? blocker.detail : status?.blockers?.length ? status.blockers.join("; ") : blocker.detail}</p>
        {status?.missingModels.length ? <p style={{ margin: "8px 0 0", color: "#b9c6bd" }}>SET UP LTX can download and SHA-256 verify the reviewed files after one explicit approval. Maximum download: {status.reviewedDownloadSize || "16.13 GB"}.</p> : null}
        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          <button type="button" style={yellowButton} onClick={() => void setupDefault()} disabled={working || installing}>{installing ? "INSTALLING LTX MODELS..." : "SET UP LTX"}</button>
          <button type="button" style={yellowButton} onClick={() => void refresh()} disabled={working}>{working ? "WORKING..." : "CHECK AGAIN"}</button>
          <button type="button" style={status?.ready ? button : { ...button, opacity: 0.45, cursor: "not-allowed" }} onClick={() => void testLocalVideo()} disabled={working || installing || !status?.ready}>TEST LOCAL VIDEO</button>
        </div>
      </div>

      <p role="status" aria-live="polite" style={{ margin: "12px 0 0", color: testResult?.error || status?.setupTask?.state === "failed" ? "#fff0a6" : "#79bd92" }}>{notice}</p>
      {testResult?.outputAssetUrl ? <p style={{ margin: "8px 0 0" }}><a href={testResult.outputAssetUrl} target="_blank" rel="noreferrer" style={{ color: "#d8c85d" }}>OPEN TEST VIDEO</a></p> : null}

      <details open={advancedOpen} onToggle={(event) => setAdvancedOpen(event.currentTarget.open)} style={{ marginTop: 16, border: "1px solid #23412e", background: "#060806", padding: 12 }}>
        <summary style={{ cursor: "pointer", color: "#d8c85d", fontWeight: 700 }}>ADVANCED SETUP</summary>
        <p style={{ color: "#b9c6bd", lineHeight: 1.5 }}>
          Paste only a reviewed PlotPickle LTX-Video 2B 0.9.8 Distilled manifest in ComfyUI API format. PlotPickle validates the manifest and refuses network, installer or code-execution nodes.
        </p>
        <textarea
          value={manifestText}
          onChange={(event) => setManifestText(event.target.value)}
          spellCheck={false}
          placeholder="Paste reviewed LTX manifest JSON"
          style={{ width: "100%", minHeight: 180, boxSizing: "border-box", background: "#020302", color: "#ededed", border: "1px solid #4a5a4e", padding: 10, font: "inherit" }}
        />
        <div style={{ marginTop: 10 }}>
          <button type="button" style={yellowButton} onClick={() => void importManifest()} disabled={working || !manifestText.trim()}>{working ? "WORKING..." : "IMPORT REVIEWED MANIFEST"}</button>
        </div>
      </details>
    </section>
  );
}
