"use client";
import { useCallback, useEffect, useState } from "react";
import { authenticatedComputeFetch as fetch } from "../../core/auth/profile-request-browser";
import ProviderConsentSetup from "./provider-consent-setup";
import ComputeReadyMarker from "./compute-ready-marker";

export default function LocalComfyUiApiVideoSetup() {
  const [workflow, setWorkflow] = useState("");
  const [source, setSource] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [ready, setReady] = useState(false);
  const [requirements, setRequirements] = useState<Array<{ id: string; label: string; ready: boolean }>>([]);
  const [job, setJob] = useState("");
  const [asset, setAsset] = useState("");
  const [working, setWorking] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const log = (message: string) => setHistory((items) => [...items.slice(-39), message]);
  const refresh = useCallback(async () => {
    const response = await fetch("/api/media-routing/status", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || "Video setup status unavailable.");
    setReady(body.hybridGate?.ready === true); setRequirements(body.hybridGate?.requirements || []);
  }, []);
  useEffect(() => { void refresh().catch((error) => log(error.message)); }, [refresh]);
  async function run(action: "import" | "test" | "poll") {
    if (working) return;
    setWorking(true);
    try {
      let response;
      if (action === "import") response = await fetch("/api/media-routing/comfyui/h3-workflow", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workflow: JSON.parse(workflow) }) });
      else if (action === "test") {
        if (!authorized || !source.trim()) throw new Error("Choose a saved source image and authorize one paid image-to-video test.");
        response = await fetch("/api/media-routing/test/video", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ route: "minimax-comfyui", sourceAssetUrl: source.trim(), billingAcknowledged: true, dataSharingAcknowledged: true }) });
      } else response = await fetch(`/api/local-ai/video/${encodeURIComponent(job)}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok || body.ok === false) throw new Error(body.message || "Video setup action failed.");
      if (body.id) setJob(body.id);
      if (body.outputAssetUrl) setAsset(body.outputAssetUrl);
      log(action === "import" ? "Reviewed workflow imported. Test required; route selection unchanged." : `Job ${body.id}: ${body.status || "submitted"}${body.error ? ` · ${body.error}` : ""}`);
      if (action === "test") setAuthorized(false);
      await refresh();
      window.dispatchEvent(new CustomEvent("plotpickle:setup-status-refresh"));
    } catch (error) { log(error instanceof Error ? error.message : "Video setup failed."); }
    finally { setWorking(false); }
  }
  return <section style={{ padding: 16, border: "1px solid var(--pp-skin-line)" }} aria-label="Local ComfyUI API video setup">
    <h2>ComfyUI · MiniMax API video</h2>
    <p>ComfyUI runs on this computer. MiniMax generates video using your MiniMax API account. Configure your key in Cloud → MiniMax; Comfy Cloud credits are not required.</p>
    <p><ComputeReadyMarker ready={ready} /> {ready ? "Ready" : "Setup / test needed"}</p>
    {requirements.map((item) => <p key={item.id}><ComputeReadyMarker ready={item.ready} label={item.label} /> {item.label}</p>)}
    <ProviderConsentSetup provider="minimax" />
    <label style={{ display: "block" }}>Import API workflow JSON<input type="file" accept=".json,application/json" onChange={(event) => { const file = event.target.files?.[0]; if (file) void file.text().then(setWorkflow); }} /></label>
    <textarea aria-label="MiniMax ComfyUI API workflow JSON" value={workflow} onChange={(event) => setWorkflow(event.target.value)} rows={8} style={{ width: "100%" }} />
    <button type="button" disabled={working || !workflow.trim()} onClick={() => void run("import")}>Import workflow</button>
    <label style={{ display: "block" }}>Saved image asset URL<input value={source} onChange={(event) => setSource(event.target.value)} placeholder="/api/local-ai/assets/storyboard-frame.webp" style={{ width: "100%" }} /></label>
    <label style={{ display: "block" }}><input type="checkbox" checked={authorized} onChange={(event) => setAuthorized(event.target.checked)} /> I authorize one paid MiniMax image-to-video test using this image and the bounded test prompt.</label>
    <button type="button" disabled={working || !authorized || !source.trim()} onClick={() => void run("test")}>Run one paid video test</button>
    <button type="button" disabled={working || !job} onClick={() => void run("poll")}>Refresh job status</button>
    {asset ? <video src={asset} controls style={{ maxWidth: "100%" }} /> : null}
    <div role="log" aria-live="polite" style={{ maxHeight: 200, overflow: "auto" }}>{history.map((message, index) => <p key={index}>{message}</p>)}</div>
    <p>Choose the ready workflow in Hybrid. Importing and testing leave the active route unchanged.</p>
  </section>;
}
