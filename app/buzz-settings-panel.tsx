"use client";

import { useEffect, useState } from "react";
import { describeBuzzManagedRuntime, getBuzzManagedRuntimeActions } from "../lib/buzz-managed-runtime";
import styles from "./buzz-settings.module.css";

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
type ConnectionState = "loading" | "disconnected" | "connecting" | "connected" | "degraded";
const EMPTY: FormState = { mode: "existing-relay", relayUrl: "", community: "", identityLabel: "", cliPath: "", privateKey: "" };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const body = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(body.message || `Buzz returned ${response.status}.`);
  return body;
}

export default function BuzzSettingsPanel() {
  const [status, setStatus] = useState<BuzzStatus | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  function applyStatus(body: BuzzStatus) {
    setStatus(body);
    setForm((current) => ({ ...current, mode: body.connection.mode, relayUrl: body.connection.relayUrl, community: body.connection.community, identityLabel: body.connection.identityLabel, cliPath: body.connection.cliPath, privateKey: "" }));
  }

  async function refresh(showNotice = false) {
    const body = await request<BuzzStatus & { ok: true }>("/status");
    applyStatus(body);
    if (showNotice) setNotice(body.connection.configured ? body.relay.detail : "Buzz remains optional and unconfigured.");
  }

  useEffect(() => {
    let cancelled = false;
    void request<BuzzStatus & { ok: true }>("/status")
      .then((body) => { if (!cancelled) applyStatus(body); })
      .catch((error) => { if (!cancelled) setNotice(error instanceof Error ? error.message : "Buzz status could not be loaded."); });
    return () => { cancelled = true; };
  }, []);

  function patch(value: Partial<FormState>) { setForm((current) => ({ ...current, ...value })); setNotice(""); }
  async function run(name: string, operation: () => Promise<{ message?: string }>) {
    setBusy(name); setNotice("");
    try { const result = await operation(); await refresh(); setNotice(result.message || "Buzz operation completed."); }
    catch (error) { setNotice(error instanceof Error ? error.message : "Buzz operation failed."); }
    finally { setBusy(""); }
  }

  const configured = Boolean(status?.connection.configured);
  const reachable = Boolean(status?.relay.reachable);
  const cliAvailable = Boolean(status?.cli.available);
  const identityConfigured = Boolean(status?.connection.identityConfigured);
  const connectionState: ConnectionState = !status ? "loading" : busy === "test" || busy === "save" ? "connecting" : !configured ? "disconnected" : reachable ? "connected" : "degraded";
  const storyRoomReady = connectionState === "connected";
  const stateCopy = {
    loading: { title: "Checking Buzz", tone: "Neutral · checking", detail: "PlotPickle is reading the local Buzz connection state." },
    disconnected: { title: "Not configured", tone: "Neutral · optional", detail: "PlotPickle remains fully usable without Buzz." },
    connecting: { title: "Testing connection", tone: "Blue · connecting", detail: "PlotPickle is checking the saved relay without exposing the private identity." },
    connected: { title: "Ready", tone: "Green · connected", detail: status?.relay.detail || "The saved relay responded successfully." },
    degraded: { title: "Connection needs attention", tone: "Yellow · degraded", detail: status?.relay.detail || "Configuration is saved, but the relay did not pass its latest reachability check." },
  }[connectionState];
  const managedState = {
    bundleAvailable: Boolean(status?.managed.bundle.available), dockerAvailable: Boolean(status?.managed.docker.available),
    installed: Boolean(status?.managed.installed), configured: Boolean(status?.managed.configured), running: Boolean(status?.managed.running),
    reachable: Boolean(status?.managed.reachable), backups: status?.managed.backups.length || 0, lifecycle: status?.managed.lifecycle || "unconfigured",
  };
  const managedActions = getBuzzManagedRuntimeActions(managedState);
  const managedCopy = describeBuzzManagedRuntime(managedState);
  const blocked = Boolean(busy);

  return <div className={styles.page}>
    <header className={styles.heading}><p>Settings · Repository & Collab · Buzz</p><h1>Connect a Buzz Story Room or manage a local relay.</h1><span>Buzz owns discussion. PPF remains authoritative. Credentials are encrypted for the current operating-system user and are never written into the PPF.</span></header>
    <section className={styles.statusCard}><div><p>Current Buzz status</p><h2>{stateCopy.title}</h2><p>{stateCopy.detail}</p></div><div className={styles.statusBadge} role="status" aria-live="polite"><i aria-hidden="true" /><b>{stateCopy.tone}</b></div></section>
    <section className={styles.runtimeGrid} aria-label="Buzz status details">
      <article><span>Configuration</span><strong>{configured ? "Saved locally" : "Optional"}</strong><small>{configured ? status?.connection.mode : "No connection has been saved"}</small></article>
      <article><span>Relay</span><strong>{reachable ? `${status?.relay.latencyMs} ms` : configured ? "Not verified" : "Not configured"}</strong><small>{status?.connection.relayUrl || "No relay address"}</small></article>
      <article><span>Encrypted identity</span><strong>{identityConfigured ? "Stored" : "Not stored"}</strong><small>{status?.connection.identityLabel || "Required for signed room and message operations"}</small></article>
      <article><span>Buzz CLI</span><strong>{cliAvailable ? status?.cli.version || "Available" : "Unavailable"}</strong><small>{status?.cli.executable || status?.cli.error || "Required for signed room and message operations"}</small></article>
    </section>
    <section className={styles.choiceGrid} aria-label="Buzz connection mode">
      <article className={form.mode === "existing-relay" ? styles.selectedChoice : undefined}><span>Phase 1A</span><h2>Existing Buzz relay</h2><p>Use a relay you already operate or trust. Saving configuration does not mark it connected; PlotPickle requires a successful reachability check.</p><button type="button" onClick={() => patch({ mode: "existing-relay" })}>Select existing relay</button></article>
      <article className={form.mode === "managed" ? styles.selectedChoice : undefined}><span>Phase 1B</span><h2>Managed local Buzz</h2><p>Install the pinned Docker Compose bundle, keep it bound to localhost, and manage its lifecycle from PlotPickle.</p><button type="button" onClick={() => patch({ mode: "managed", relayUrl: status?.managed.relayUrl || "http://127.0.0.1:3000" })}>Select managed Buzz</button></article>
    </section>
    <section className={styles.formCard}><div><span>Encrypted connection</span><h2>{form.mode === "managed" ? "Managed local identity" : "Existing relay identity"}</h2></div><div className={styles.formGrid}>
      <label><span>Relay address</span><input value={form.relayUrl} onChange={(event) => patch({ relayUrl: event.target.value })} placeholder="https://buzz.example.com" /></label>
      <label><span>Community / workspace</span><input value={form.community} onChange={(event) => patch({ community: event.target.value })} placeholder="PlotPickle writers room" /></label>
      <label><span>Identity label</span><input value={form.identityLabel} onChange={(event) => patch({ identityLabel: event.target.value })} placeholder="Bryan · PlotPickle" /></label>
      <label><span>Buzz CLI path</span><input value={form.cliPath} onChange={(event) => patch({ cliPath: event.target.value })} placeholder="buzz or C:\\Tools\\buzz.exe" /></label>
      <label><span>Buzz private key</span><input type="password" autoComplete="off" value={form.privateKey} onChange={(event) => patch({ privateKey: event.target.value })} placeholder={identityConfigured ? "Leave blank to retain saved encrypted key" : "nsec1… or 64-character private key"} /></label>
    </div></section>
    <section className={styles.actions}>
      <button type="button" disabled={blocked} onClick={() => void run("save", () => request("/connection", { method: "PUT", body: JSON.stringify(form) }))}>{busy === "save" ? "Saving…" : "Save encrypted connection"}</button>
      <button type="button" disabled={!configured || blocked} onClick={() => void run("test", () => request("/test", { method: "POST" }))}>{busy === "test" ? "Testing…" : "Test Buzz connection"}</button>
      <button type="button" disabled={blocked} onClick={() => void run("refresh", async () => { await refresh(true); return { message: "Buzz status refreshed." }; })}>Refresh status</button>
      {storyRoomReady ? <a href="/buzz">Open Story Room</a> : <button type="button" disabled title="Test the saved relay successfully before opening the Story Room.">Story Room unavailable</button>}
      <button className={styles.removeAction} type="button" disabled={!configured || blocked} onClick={() => void run("disconnect", () => request("/connection", { method: "DELETE" }))}>Remove connection and identity</button>
    </section>
    {configured && reachable && (!cliAvailable || !identityConfigured) ? <section className={styles.boundary}><span>Phase 1A readiness</span><h2>The relay is connected, but signed operations are not ready.</h2><p>{!cliAvailable ? "Install or select the supported Buzz CLI. " : ""}{!identityConfigured ? "Save an encrypted Buzz private identity before creating rooms or sending messages." : ""}</p></section> : null}
    <section className={styles.lifecycleCard}><div><span>Managed runtime lifecycle</span><h2>{managedCopy.title}</h2><p>{managedCopy.detail}</p><small>{status?.managed.message || status?.managed.bundle.validationGate || "Managed Buzz remains optional."}</small></div><div className={styles.lifecycleActions}>
      <button type="button" disabled={!managedActions.install || blocked} onClick={() => void run("install", () => request("/managed/install", { method: "POST" }))}>Install</button>
      <button type="button" disabled={!managedActions.start || blocked} onClick={() => void run("start", () => request("/managed/start", { method: "POST" }))}>Start</button>
      <button type="button" disabled={!managedActions.stop || blocked} onClick={() => void run("stop", () => request("/managed/stop", { method: "POST" }))}>Stop</button>
      <button type="button" disabled={!managedActions.restart || blocked} onClick={() => void run("restart", () => request("/managed/restart", { method: "POST" }))}>Restart</button>
      <button type="button" disabled={!managedActions.repair || blocked} onClick={() => void run("repair", () => request("/managed/repair", { method: "POST" }))}>Repair</button>
      <button type="button" disabled={!managedActions.update || blocked} onClick={() => void run("update", () => request("/managed/update", { method: "POST" }))}>Update pinned bundle</button>
      <button type="button" disabled={!managedActions.backup || blocked} onClick={() => void run("backup", () => request("/managed/backup", { method: "POST" }))}>Back up</button>
      <button type="button" disabled={!managedActions.remove || blocked} title={managedState.running ? "Stop managed Buzz before removing its runtime and data." : undefined} onClick={() => void run("remove", () => request("/managed", { method: "DELETE", body: JSON.stringify({ removeBackups: false }) }))}>Remove runtime and data</button>
    </div></section>
    <section className={styles.boundary}><span>Authority boundary</span><h2>Discussion does not become canon by itself.</h2><p>Buzz messages can be linked to story entities and converted into local proposals. Only an explicit human approval applies a selected proposal to the active PPF project.</p><ul><li>No Buzz service starts when PlotPickle is installed.</li><li>No identity or credential is created until Save encrypted connection is selected.</li><li>Managed services bind to the local computer by default.</li><li>Updates, repairs and removal require the managed runtime to be stopped.</li><li>Removing Buzz preserves PlotPickle projects and their approved canon.</li></ul></section>
    {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
  </div>;
}
