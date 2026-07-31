"use client";

import { useEffect, useState } from "react";
import ApplicationShellHeader from "../../application-shell-header";
import styles from "../../buzz-settings.module.css";
import type { ProductNavigationId } from "@/lib/product-direction";

const API = "/api/local-buzz";

type ConnectionMode = "existing-relay" | "managed";
type BuzzStatus = {
  connection: { configured: boolean; mode: ConnectionMode; relayUrl: string; community: string; identityLabel: string; cliPath: string; identityConfigured: boolean; verifiedAt: string };
  relay: { reachable: boolean; checkedAt: string; latencyMs: number; detail: string };
  cli: { available: boolean; executable: string; version: string; error: string };
  managed: {
    bundle: { available: boolean; sourceTag: string; sourceRevision: string; relayImage: string; validationGate: string; error: string };
    docker: { available: boolean; engine: string; compose: string; error: string };
    installed: boolean; configured: boolean; running: boolean; reachable: boolean; relayUrl: string; backups: string[]; lifecycle: string; message: string;
  };
};

type FormState = { mode: ConnectionMode; relayUrl: string; community: string; identityLabel: string; cliPath: string; privateKey: string };
const EMPTY: FormState = { mode: "existing-relay", relayUrl: "", community: "", identityLabel: "", cliPath: "", privateKey: "" };

const WORKSPACE_QUERY: Partial<Record<ProductNavigationId, string>> = {
  dashboard: "dashboard", learn: "learn", planner: "plan", visuals: "storyboard", script: "write", pitch: "pitch", build: "build", feedback: "feedback", engines: "refine", reports: "reports", collab: "collab", settings: "settings",
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const body = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(body.message || `Buzz returned ${response.status}.`);
  return body;
}

export default function BuzzSettingsPage() {
  const [status, setStatus] = useState<BuzzStatus | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh(showNotice = false) {
    const body = await request<BuzzStatus & { ok: true }>("/status");
    setStatus(body);
    setForm((current) => ({
      ...current,
      mode: body.connection.mode,
      relayUrl: body.connection.relayUrl,
      community: body.connection.community,
      identityLabel: body.connection.identityLabel,
      cliPath: body.connection.cliPath,
      privateKey: "",
    }));
    if (showNotice) setNotice(body.connection.configured ? body.relay.detail : "Buzz remains optional and unconfigured.");
  }

  useEffect(() => {
    let cancelled = false;
    void request<BuzzStatus & { ok: true }>("/status")
      .then((body) => {
        if (cancelled) return;
        setStatus(body);
        setForm((current) => ({
          ...current,
          mode: body.connection.mode,
          relayUrl: body.connection.relayUrl,
          community: body.connection.community,
          identityLabel: body.connection.identityLabel,
          cliPath: body.connection.cliPath,
          privateKey: "",
        }));
      })
      .catch((error) => {
        if (!cancelled) setNotice(error instanceof Error ? error.message : "Buzz status could not be loaded.");
      });
    return () => { cancelled = true; };
  }, []);

  function navigate(tab: ProductNavigationId) {
    if (tab === "buzz") { window.location.assign("/buzz"); return; }
    window.location.assign(`/?workspace=${encodeURIComponent(WORKSPACE_QUERY[tab] ?? "dashboard")}`);
  }

  function patch(value: Partial<FormState>) { setForm((current) => ({ ...current, ...value })); setNotice(""); }

  async function run(name: string, operation: () => Promise<{ message?: string }>) {
    setBusy(name);
    setNotice("");
    try {
      const result = await operation();
      await refresh();
      setNotice(result.message || "Buzz operation completed.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Buzz operation failed."); }
    finally { setBusy(""); }
  }

  const connected = Boolean(status?.connection.configured);
  const reachable = Boolean(status?.relay.reachable);
  const bundleReady = Boolean(status?.managed.bundle.available && status?.managed.docker.available);
  const tone = reachable ? "Green · connected" : connected ? "Yellow · degraded" : "Neutral · optional";

  return (
    <div className="app-shell">
      <ApplicationShellHeader activeTab="settings" onNavigate={navigate} onProjectAction={(action) => window.location.assign(`/?workspace=dashboard&action=${encodeURIComponent(action)}`)} onOpenLanding={() => window.location.assign("/")} />
      <main className="workspace-main"><div className={styles.page}>
        <header className={styles.heading}><p>Settings · Integrations · Buzz</p><h1>Connect a Buzz Story Room or manage a local relay.</h1><span>Buzz owns discussion. PPF remains authoritative. Credentials are encrypted for the current operating-system user and are never written into the PPF.</span></header>

        <section className={styles.statusCard}><div><p>Current Buzz status</p><h2>{reachable ? "Ready" : connected ? "Connection needs attention" : "Not configured"}</h2><p>{status?.relay.detail || "PlotPickle remains fully usable without Buzz."}</p></div><div className={styles.statusBadge} role="status"><i aria-hidden="true" /><b>{tone}</b></div></section>

        <section className={styles.runtimeGrid} aria-label="Buzz status details">
          <article><span>Connection</span><strong>{connected ? status?.connection.mode : "Optional"}</strong><small>{status?.connection.identityLabel || "No encrypted Buzz identity"}</small></article>
          <article><span>Relay</span><strong>{reachable ? `${status?.relay.latencyMs} ms` : "Not reachable"}</strong><small>{status?.connection.relayUrl || "No relay address"}</small></article>
          <article><span>Buzz CLI</span><strong>{status?.cli.available ? status.cli.version || "Available" : "Unavailable"}</strong><small>{status?.cli.executable || status?.cli.error || "Used for signed rooms and messages"}</small></article>
          <article><span>Managed runtime</span><strong>{status?.managed.lifecycle || "unavailable"}</strong><small>{status?.managed.message || "Docker validation has not run."}</small></article>
        </section>

        <section className={styles.choiceGrid} aria-label="Buzz connection mode">
          <article className={form.mode === "existing-relay" ? styles.selectedChoice : undefined}><span>Phase 1A</span><h2>Existing Buzz relay</h2><p>Use a relay you already operate or trust. PlotPickle tests reachability and uses the Buzz CLI for signed room operations.</p><button type="button" onClick={() => patch({ mode: "existing-relay" })}>Select existing relay</button></article>
          <article className={form.mode === "managed" ? styles.selectedChoice : undefined}><span>Phase 1B</span><h2>Managed local Buzz</h2><p>Install the pinned Docker Compose bundle, keep it bound to localhost, and manage its lifecycle from PlotPickle.</p><button type="button" onClick={() => patch({ mode: "managed", relayUrl: status?.managed.relayUrl || "http://127.0.0.1:3000" })}>Select managed Buzz</button></article>
        </section>

        <section className={styles.formCard}><div><span>Encrypted connection</span><h2>{form.mode === "managed" ? "Managed local identity" : "Existing relay identity"}</h2></div><div className={styles.formGrid}>
          <label><span>Relay address</span><input value={form.relayUrl} onChange={(event) => patch({ relayUrl: event.target.value })} placeholder="https://buzz.example.com" /></label>
          <label><span>Community / workspace</span><input value={form.community} onChange={(event) => patch({ community: event.target.value })} placeholder="PlotPickle writers room" /></label>
          <label><span>Identity label</span><input value={form.identityLabel} onChange={(event) => patch({ identityLabel: event.target.value })} placeholder="Bryan · PlotPickle" /></label>
          <label><span>Buzz CLI path</span><input value={form.cliPath} onChange={(event) => patch({ cliPath: event.target.value })} placeholder="buzz or C:\\Tools\\buzz.exe" /></label>
          <label><span>Buzz private key</span><input type="password" autoComplete="off" value={form.privateKey} onChange={(event) => patch({ privateKey: event.target.value })} placeholder={status?.connection.identityConfigured ? "Leave blank to retain saved encrypted key" : "nsec1… or 64-character private key"} /></label>
        </div></section>

        <section className={styles.actions}>
          <button type="button" disabled={Boolean(busy)} onClick={() => void run("save", () => request("/connection", { method: "PUT", body: JSON.stringify(form) }))}>{busy === "save" ? "Saving…" : "Save encrypted connection"}</button>
          <button type="button" disabled={!connected || Boolean(busy)} onClick={() => void run("test", () => request("/test", { method: "POST" }))}>{busy === "test" ? "Testing…" : "Test Buzz connection"}</button>
          <button type="button" disabled={Boolean(busy)} onClick={() => void run("refresh", async () => { await refresh(true); return { message: "Buzz status refreshed." }; })}>Refresh status</button>
          <a href="/buzz">Open Story Room</a>
          <button className={styles.removeAction} type="button" disabled={!connected || Boolean(busy)} onClick={() => void run("disconnect", () => request("/connection", { method: "DELETE" }))}>Remove connection and identity</button>
        </section>

        <section className={styles.lifecycleCard}><div><span>Managed runtime lifecycle</span><h2>Install only from the pinned verified bundle.</h2><p>{status?.managed.bundle.validationGate || "The runtime remains unavailable until its manifest and local Docker prerequisites pass validation."}</p></div><div className={styles.lifecycleActions}>
          <button type="button" disabled={!bundleReady || status?.managed.installed || Boolean(busy)} onClick={() => void run("install", () => request("/managed/install", { method: "POST" }))}>Install</button>
          <button type="button" disabled={!status?.managed.installed || status?.managed.running || Boolean(busy)} onClick={() => void run("start", () => request("/managed/start", { method: "POST" }))}>Start</button>
          <button type="button" disabled={!status?.managed.running || Boolean(busy)} onClick={() => void run("stop", () => request("/managed/stop", { method: "POST" }))}>Stop</button>
          <button type="button" disabled={!status?.managed.running || Boolean(busy)} onClick={() => void run("restart", () => request("/managed/restart", { method: "POST" }))}>Restart</button>
          <button type="button" disabled={!status?.managed.installed || Boolean(busy)} onClick={() => void run("repair", () => request("/managed/repair", { method: "POST" }))}>Repair</button>
          <button type="button" disabled={!status?.managed.installed || Boolean(busy)} onClick={() => void run("update", () => request("/managed/update", { method: "POST" }))}>Update pinned bundle</button>
          <button type="button" disabled={!status?.managed.running || Boolean(busy)} onClick={() => void run("backup", () => request("/managed/backup", { method: "POST" }))}>Back up</button>
          <button type="button" disabled={!status?.managed.installed || Boolean(busy)} onClick={() => void run("remove", () => request("/managed", { method: "DELETE", body: JSON.stringify({ removeBackups: false }) }))}>Remove runtime and data</button>
        </div></section>

        <section className={styles.boundary}><span>Authority boundary</span><h2>Discussion does not become canon by itself.</h2><p>Buzz messages can be linked to story entities and converted into local proposals. Only an explicit human approval applies a selected proposal to the active PPF project.</p><ul><li>No Buzz service starts when PlotPickle is installed.</li><li>No identity or credential is created until Save encrypted connection is selected.</li><li>Managed services bind to the local computer by default.</li><li>Removing Buzz preserves PlotPickle projects and their approved canon.</li></ul></section>
        {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
      </div></main>
    </div>
  );
}
