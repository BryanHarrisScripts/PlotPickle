"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  COMFY_CLOUD_WORKFLOW_CATALOG,
  COMFY_WORKFLOW_LANES,
  type ComfyWorkflowLane,
} from "../../lib/runtime/ai/comfy-cloud-workflow-catalog";

type AccessMode = "browser" | "api";
type OutputHandling = "download" | "cloud";
type Concurrency = 1 | 2 | 4;

type ComfyCloudStatus = {
  ok: boolean;
  baseUrl: string;
  configured: boolean;
  tested: boolean;
  testedAt: string;
  testedNodeCount: number;
  accessMode: AccessMode;
  concurrency: Concurrency;
  outputHandling: OutputHandling;
  defaultLane: ComfyWorkflowLane;
  transports: {
    directApi: "not-configured" | "configured" | "tested";
    mcp: "not-connected";
    cli: "advanced-not-managed";
  };
  message?: string;
};

type ProfileStatus = {
  authenticated?: boolean;
  csrfToken?: string | null;
};

const panel: React.CSSProperties = {
  marginBottom: "var(--pp-skin-space-4)",
  padding: "var(--pp-skin-space-4)",
  border: "var(--pp-skin-border-thin) solid var(--pp-skin-line)",
  background: "var(--pp-skin-surface-1)",
  color: "var(--pp-skin-ink)",
  boxShadow: "var(--pp-skin-inset-highlight)",
};

const field: React.CSSProperties = {
  display: "grid",
  gap: "var(--pp-skin-space-2)",
  color: "var(--pp-skin-ink-soft)",
  fontSize: 13,
};

const control: React.CSSProperties = {
  minHeight: "var(--pp-skin-touch-target)",
  padding: "var(--pp-skin-space-2) var(--pp-skin-space-3)",
  border: "var(--pp-skin-border-thin) solid var(--pp-skin-line-strong)",
  borderRadius: "var(--pp-skin-radius)",
  background: "var(--pp-skin-surface-0)",
  color: "var(--pp-skin-ink)",
  font: "inherit",
};

const button: React.CSSProperties = {
  ...control,
  cursor: "pointer",
};

const card: React.CSSProperties = {
  padding: "var(--pp-skin-space-3)",
  border: "var(--pp-skin-border-thin) solid var(--pp-skin-line)",
  background: "var(--pp-skin-surface-0)",
};

const emptyStatus: ComfyCloudStatus = {
  ok: true,
  baseUrl: "https://cloud.comfy.org",
  configured: false,
  tested: false,
  testedAt: "",
  testedNodeCount: 0,
  accessMode: "browser",
  concurrency: 1,
  outputHandling: "download",
  defaultLane: "cinematic",
  transports: {
    directApi: "not-configured",
    mcp: "not-connected",
    cli: "advanced-not-managed",
  },
};

async function json<T>(path: string, init?: RequestInit) {
  const response = await fetch(path, init);
  const body = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(body.message || "The Comfy Cloud request failed.");
  return body;
}

function statusLabel(value: string) {
  return value.replaceAll("-", " ").toUpperCase();
}

export default function ComfyCloudSetupPanel() {
  const [status, setStatus] = useState<ComfyCloudStatus>(emptyStatus);
  const [apiKey, setApiKey] = useState("");
  const [csrfToken, setCsrfToken] = useState("");
  const [working, setWorking] = useState("");
  const [notice, setNotice] = useState("Checking Comfy Cloud authority…");

  const refresh = useCallback(async () => {
    try {
      const [profile, next] = await Promise.all([
        json<ProfileStatus>("/api/auth/profile", { cache: "no-store", credentials: "same-origin" }),
        json<ComfyCloudStatus>("/api/cloud-story-mode/comfy-cloud", { cache: "no-store", credentials: "same-origin" }),
      ]);
      if (!profile.authenticated || !profile.csrfToken) throw new Error("Comfy Cloud setup requires an authenticated Human profile.");
      setCsrfToken(profile.csrfToken);
      setStatus(next);
      setNotice(next.configured
        ? `Comfy Cloud authority is saved${next.tested ? " and connection-tested" : "; connection test pending"}. Secret values are not displayed.`
        : "Use Browser / Manual without an API key, or save a user-owned Comfy Cloud API key to enable API Automation.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Comfy Cloud authority could not be checked.");
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const workflows = useMemo(
    () => COMFY_CLOUD_WORKFLOW_CATALOG.filter((entry) => entry.lane === status.defaultLane),
    [status.defaultLane],
  );

  function update<K extends "accessMode" | "concurrency" | "outputHandling" | "defaultLane">(key: K, value: ComfyCloudStatus[K]) {
    setStatus((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    if (working || !csrfToken) return;
    setWorking("save");
    setNotice("Saving Comfy Cloud preferences without running a workflow…");
    try {
      const next = await json<ComfyCloudStatus>("/api/cloud-story-mode/comfy-cloud", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-PlotPickle-CSRF": csrfToken },
        body: JSON.stringify({
          action: "save",
          apiKey,
          accessMode: status.accessMode,
          concurrency: status.concurrency,
          outputHandling: status.outputHandling,
          defaultLane: status.defaultLane,
        }),
      });
      setApiKey("");
      setStatus(next);
      setNotice(next.message || "Comfy Cloud preferences saved. No workflow was submitted.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Comfy Cloud preferences could not be saved.");
    } finally {
      setWorking("");
    }
  }

  async function testConnection() {
    if (working || !csrfToken) return;
    setWorking("test");
    setNotice("Testing Comfy Cloud with a non-generative object-info request…");
    try {
      const next = await json<ComfyCloudStatus>("/api/cloud-story-mode/comfy-cloud", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-PlotPickle-CSRF": csrfToken },
        body: JSON.stringify({ action: "test" }),
      });
      setStatus(next);
      setNotice(next.message || "Comfy Cloud connection verified without running a workflow.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Comfy Cloud connection test failed.");
    } finally {
      setWorking("");
    }
  }

  return (
    <div data-comfy-cloud-setup="true">
      <section style={panel} aria-labelledby="comfy-cloud-connection-title">
        <p style={{ margin: 0, color: "var(--pp-skin-accent-bright)", fontSize: 12, letterSpacing: ".08em" }}>COMFYUI CLOUD / USER-OWNED AUTHORITY</p>
        <h2 id="comfy-cloud-connection-title" style={{ margin: "5px 0" }}>CONNECTION & EXECUTION POLICY</h2>
        <p style={{ marginTop: 0, color: "var(--pp-skin-ink-soft)" }}>
          Local ComfyUI remains in Local Story Mode. This screen configures Comfy Cloud only. Saving or testing authority never submits a paid workflow, and PlotPickle never silently falls back from local to cloud.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "var(--pp-skin-space-3)" }}>
          <label style={field}>
            <span>API access</span>
            <select style={control} value={status.accessMode} onChange={(event) => update("accessMode", event.target.value as AccessMode)}>
              <option value="browser">Browser / Manual</option>
              <option value="api">API Automation</option>
            </select>
          </label>
          <label style={field}>
            <span>PlotPickle submission concurrency cap</span>
            <select style={control} value={status.concurrency} onChange={(event) => update("concurrency", Number(event.target.value) as Concurrency)}>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={4}>4</option>
            </select>
          </label>
          <label style={field}>
            <span>Completed output handling</span>
            <select style={control} value={status.outputHandling} onChange={(event) => update("outputHandling", event.target.value as OutputHandling)}>
              <option value="download">Download into active PlotPickle project</option>
              <option value="cloud">Leave in Comfy Cloud until explicitly fetched</option>
            </select>
          </label>
          <label style={field}>
            <span>Default workflow lane</span>
            <select style={control} value={status.defaultLane} onChange={(event) => update("defaultLane", event.target.value as ComfyWorkflowLane)}>
              {COMFY_WORKFLOW_LANES.map((lane) => <option key={lane.id} value={lane.id}>{lane.label}</option>)}
            </select>
          </label>
        </div>

        <label style={{ ...field, marginTop: "var(--pp-skin-space-3)" }}>
          <span>Comfy Cloud API key {status.configured ? "(leave blank to keep protected key)" : "(required for API Automation)"}</span>
          <input
            style={control}
            type="password"
            autoComplete="off"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={status.configured ? "Protected key already saved" : "Enter user-owned Comfy Cloud API key"}
          />
        </label>

        <div style={{ ...card, marginTop: "var(--pp-skin-space-3)" }}>
          <strong>FIXED CLOUD ENDPOINT</strong>
          <p style={{ margin: "6px 0 0", color: "var(--pp-skin-ink-soft)" }}>{status.baseUrl}</p>
          <p style={{ margin: "6px 0 0", color: "var(--pp-skin-ink-soft)" }}>Comfy Cloud API execution may require an eligible paid subscription. The PlotPickle connection test reads object metadata only and does not generate media.</p>
        </div>

        <div style={{ display: "flex", gap: "var(--pp-skin-space-2)", flexWrap: "wrap", marginTop: "var(--pp-skin-space-3)" }}>
          <button type="button" style={button} onClick={() => void save()} disabled={Boolean(working)}>{working === "save" ? "SAVING..." : "SAVE COMFY CLOUD"}</button>
          <button type="button" style={button} onClick={() => void testConnection()} disabled={Boolean(working) || !status.configured}>{working === "test" ? "TESTING..." : "TEST CONNECTION"}</button>
          <a href="https://cloud.comfy.org" target="_blank" rel="noreferrer" style={{ ...button, display: "inline-grid", placeItems: "center", textDecoration: "none" }}>OPEN COMFY CLOUD</a>
        </div>
      </section>

      <section style={panel} aria-labelledby="comfy-agent-integration-title">
        <h2 id="comfy-agent-integration-title" style={{ marginTop: 0 }}>AGENT INTEGRATION</h2>
        <p style={{ marginTop: 0, color: "var(--pp-skin-ink-soft)" }}>These are transports around one Comfy capability, not competing PlotPickle providers. They do not expand Agent permissions.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "var(--pp-skin-space-3)" }}>
          <article style={card}><strong>DIRECT API</strong><p style={{ color: "var(--pp-skin-accent-bright)" }}>{statusLabel(status.transports.directApi)}</p><p style={{ marginBottom: 0, color: "var(--pp-skin-ink-soft)" }}>Deterministic production transport. A reviewed API-format workflow is still required before paid execution.</p></article>
          <article style={card}><strong>COMFY MCP</strong><p style={{ color: "var(--pp-skin-ink-soft)" }}>{statusLabel(status.transports.mcp)}</p><p style={{ marginBottom: 0, color: "var(--pp-skin-ink-soft)" }}>Preferred future agent-facing bridge for inspecting and operating reviewed workflows. It remains bounded by PlotPickle Agent authority.</p></article>
          <article style={card}><strong>COMFY CLI · ADVANCED</strong><p style={{ color: "var(--pp-skin-ink-soft)" }}>{statusLabel(status.transports.cli)}</p><p style={{ marginBottom: 0, color: "var(--pp-skin-ink-soft)" }}>Developer/batch/CI fallback only. PlotPickle does not silently install or invoke it from setup.</p></article>
        </div>
      </section>

      <section style={panel} aria-labelledby="comfy-workflow-lanes-title">
        <h2 id="comfy-workflow-lanes-title" style={{ marginTop: 0 }}>CURATED WORKFLOW NEEDS</h2>
        <p style={{ marginTop: 0, color: "var(--pp-skin-ink-soft)" }}>PlotPickle stores original classification and source metadata only—no copied prompt text and no third-party workflow graph. Selecting a source does not run it.</p>
        <div style={{ display: "flex", gap: "var(--pp-skin-space-2)", flexWrap: "wrap", marginBottom: "var(--pp-skin-space-3)" }}>
          {COMFY_WORKFLOW_LANES.map((lane) => (
            <button
              key={lane.id}
              type="button"
              style={{ ...button, borderColor: status.defaultLane === lane.id ? "var(--pp-skin-accent-bright)" : "var(--pp-skin-line-strong)", background: status.defaultLane === lane.id ? "var(--pp-skin-accent-deep)" : "var(--pp-skin-surface-0)" }}
              onClick={() => update("defaultLane", lane.id)}
            >
              {lane.label}
            </button>
          ))}
        </div>
        <div style={{ display: "grid", gap: "var(--pp-skin-space-3)" }}>
          {workflows.map((entry) => (
            <article key={entry.id} style={card} data-comfy-workflow-need={entry.id}>
              <div style={{ display: "flex", gap: 12, justifyContent: "space-between", alignItems: "start", flexWrap: "wrap" }}>
                <div>
                  <strong>{entry.title.toUpperCase()}</strong>
                  <p style={{ margin: "6px 0", color: "var(--pp-skin-ink-soft)" }}>{entry.need}</p>
                  <p style={{ margin: 0, color: "var(--pp-skin-ink-muted)", fontSize: 12 }}>{entry.mediaType.toUpperCase()} · {entry.providerHints.join(" / ")} · {entry.reviewStatus.replaceAll("-", " ").toUpperCase()}</p>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  {entry.requiresApiWorkflowImport ? <span style={{ color: "var(--pp-skin-accent-bright)" }}>IMPORT + REVIEW REQUIRED</span> : null}
                  <a href={entry.sourceUrl} target="_blank" rel="noreferrer" style={{ ...button, display: "inline-grid", placeItems: "center", textDecoration: "none" }}>VIEW SOURCE</a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <p role="status" aria-live="polite" style={{ ...panel, color: "var(--pp-skin-ink-soft)" }}>{notice}</p>
    </div>
  );
}
