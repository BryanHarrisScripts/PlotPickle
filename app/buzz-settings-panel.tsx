"use client";

import { useEffect, useState } from "react";
import { describeBuzzManagedRuntime, getBuzzManagedRuntimeActions } from "../lib/buzz-managed-runtime";
import styles from "./buzz-settings.module.css";

const API = "/api/local-buzz";
type ConnectionMode = "existing-relay" | "managed";
type BuzzStatus = {
  connection: { configured: boolean; mode: ConnectionMode; relayUrl: string; community: string; identityLabel: string; cliPath: string; identityConfigured: boolean; identityVerified: boolean; verifiedAt: string };
  relay: { reachable: boolean; checkedAt: string; latencyMs: number; detail: string };
  cli: { available: boolean; executable: string; version: string; error: string; source: "configured" | "environment" | "buzz-desktop" | "path"; discovered: boolean; releaseTag: string };
  managed: {
    bundle: { available: boolean; sourceTag: string; sourceRevision: string; relayImage: string; validationGate: string; error: string };
    docker: { available: boolean; engine: string; compose: string; error: string };
    installed: boolean; configured: boolean; running: boolean; reachable: boolean; relayUrl: string; backups: string[]; lifecycle: string; message: string;
  };
};
type FormState = { mode: ConnectionMode; relayUrl: string; community: string; identityLabel: string; cliPath: string; privateKey: string };
type ConnectionState = "loading" | "disconnected" | "detected" | "connecting" | "connected" | "degraded";
const EMPTY: FormState = { mode: "existing-relay", relayUrl: "", community: "", identityLabel: "", cliPath: "", privateKey: "" };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const body = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(body.message || `Buzz returned ${response.status}.`);
  return body;
}

function buzzDesktopUrl(value: string, name: string) {
  try {
    const url = new URL(value);
    if (!["ws:", "wss:"].includes(url.protocol)) return "";
    url.hash = "";
    url.search = "";
    const query = new URLSearchParams({ relay: url.toString().replace(/\/$/, "") });
    if (name.trim()) query.set("name", name.trim());
    return `buzz://add-community?${query.toString()}`;
  } catch { return ""; }
}

export default function BuzzSettingsPanel() {
  const [status, setStatus] = useState<BuzzStatus | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  function applyStatus(body: BuzzStatus) {
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
  }

  async function refresh(showNotice = false) {
    const body = await request<BuzzStatus & { ok: true }>("/status");
    applyStatus(body);
    if (showNotice) setNotice(body.connection.configured ? body.relay.detail : body.cli.available ? "Buzz Desktop is detected. Add your community details to finish setup." : "Buzz Desktop was not detected.");
  }

  useEffect(() => {
    let cancelled = false;
    void request<BuzzStatus & { ok: true }>("/status")
      .then((body) => { if (!cancelled) applyStatus(body); })
      .catch((error) => { if (!cancelled) setNotice(error instanceof Error ? error.message : "Buzz status could not be loaded."); });
    return () => { cancelled = true; };
  }, []);

  function patch(value: Partial<FormState>) {
    setForm((current) => ({ ...current, ...value }));
    setNotice("");
  }

  async function run(name: string, operation: () => Promise<{ message?: string }>) {
    setBusy(name);
    setNotice("");
    try {
      const result = await operation();
      await refresh();
      setNotice(result.message || "Buzz operation completed.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Buzz operation failed.");
    } finally { setBusy(""); }
  }

  async function saveAndTest() {
    setBusy("save");
    setNotice("");
    try {
      await request("/connection", { method: "PUT", body: JSON.stringify(form) });
      const result = await request<{ message?: string }>("/test", { method: "POST" });
      await refresh();
      setNotice(result.message || "Buzz was saved securely and connected successfully.");
    } catch (error) {
      await refresh().catch(() => undefined);
      setNotice(error instanceof Error ? error.message : "Buzz could not be saved and tested.");
    } finally { setBusy(""); }
  }

  const configured = Boolean(status?.connection.configured);
  const reachable = Boolean(status?.relay.reachable);
  const cliAvailable = Boolean(status?.cli.available);
  const identityConfigured = Boolean(status?.connection.identityConfigured);
  const identityVerified = Boolean(status?.connection.identityVerified);
  const connectionState: ConnectionState = !status
    ? "loading"
    : busy === "test" || busy === "save"
      ? "connecting"
      : !configured
        ? cliAvailable ? "detected" : "disconnected"
        : reachable && identityVerified ? "connected" : "degraded";
  const storyRoomReady = connectionState === "connected" && cliAvailable && identityConfigured && identityVerified;
  const stateCopy = {
    loading: { title: "Checking Buzz", tone: "Checking", detail: "PlotPickle is looking for Buzz Desktop and any saved community." },
    disconnected: { title: "Buzz Desktop not detected", tone: "Setup needed", detail: "Install and open Buzz Desktop once, then refresh this screen." },
    detected: { title: "Buzz Desktop detected", tone: "Desktop ready", detail: "Buzz is installed. Copy your hosted community address and explicitly authorize PlotPickle with the same Buzz identity." },
    connecting: { title: "Verifying Buzz", tone: "Connecting", detail: "PlotPickle is checking the community, the Desktop CLI and your Buzz identity together." },
    connected: { title: "Buzz is ready", tone: "Ready", detail: "The community, Desktop CLI and identity are verified. PlotPickle can now create signed Story Rooms." },
    degraded: { title: reachable ? "PlotPickle is not authorized yet" : "Community cannot be reached", tone: reachable ? "Finish identity" : "Check address", detail: reachable ? "The hosted community responded, but the saved Buzz identity has not passed an authenticated check." : status?.relay.detail || "The saved community address did not respond." },
  }[connectionState];
  const managedState = {
    bundleAvailable: Boolean(status?.managed.bundle.available),
    dockerAvailable: Boolean(status?.managed.docker.available),
    installed: Boolean(status?.managed.installed),
    configured: Boolean(status?.managed.configured),
    running: Boolean(status?.managed.running),
    reachable: Boolean(status?.managed.reachable),
    backups: status?.managed.backups.length || 0,
    lifecycle: status?.managed.lifecycle || "unconfigured",
  };
  const managedActions = getBuzzManagedRuntimeActions(managedState);
  const managedCopy = describeBuzzManagedRuntime(managedState);
  const blocked = Boolean(busy);
  const openInBuzzUrl = buzzDesktopUrl(status?.connection.relayUrl || form.relayUrl, status?.connection.community || form.community);

  return <div className={styles.page}>
    <header className={styles.heading}>
      <p>{"Settings · Repository & Collab · Buzz"}</p>
      <h1>Connect PlotPickle to the Buzz community you already created.</h1>
      <span>Buzz owns the community and identity. PlotPickle only stores the community&apos;s WebSocket address and an explicitly copied identity key, encrypted for the current Windows user.</span>
    </header>

    <section className={styles.statusCard}>
      <div><p>Current Buzz setup</p><h2>{stateCopy.title}</h2><p>{stateCopy.detail}</p></div>
      <div className={styles.statusBadge} data-state={connectionState} role="status" aria-live="polite"><i aria-hidden="true" /><b>{stateCopy.tone}</b></div>
    </section>

    <section className={styles.setupGuide} aria-labelledby="buzz-settings-steps-title">
      <div className={styles.guideHeading}>
        <span>Match the Buzz screens</span>
        <h2 id="buzz-settings-steps-title">Use the community and identity already shown in Buzz.</h2>
      </div>
      <div className={styles.setupSteps}>
        <article data-complete={cliAvailable ? "true" : "false"}>
          <span>1</span>
          <div><b>Buzz Desktop</b><strong>{cliAvailable ? "Detected" : "Not detected"}</strong><p>{cliAvailable ? `${status?.cli.version || "Buzz Desktop v0.5.3"}${status && status.cli.source === "buzz-desktop" ? " · found automatically" : ""}` : "Install Buzz Desktop v0.5.3, open it once, then select Refresh status below."}</p></div>
        </article>
        <article data-complete={reachable ? "true" : "false"}>
          <span>2</span>
          <div><b>Hosted community address</b><strong>{reachable ? "Reached" : configured ? "Saved, not reached" : "Copy from Communities"}</strong><p>On Buzz&apos;s Communities page, find your community and copy the address beside <strong>Open in Buzz</strong>. It begins with wss:// and ends with .communities.buzz.xyz.</p></div>
        </article>
        <article data-complete={identityVerified ? "true" : "false"}>
          <span>3</span>
          <div><b>Authorize PlotPickle</b><strong>{identityVerified ? "Same identity verified" : identityConfigured ? "Saved, not verified" : "Private key required"}</strong><p>In Buzz Desktop, open your profile menu, then Settings &gt; Profile &gt; Identity &gt; Private key. Select Reveal, copy the nsec key and paste it below.</p></div>
        </article>
      </div>
      <aside className={styles.terminologyNote}>
        <b>The npub shown on the Communities page is not the key PlotPickle needs</b>
        <p>The npub is your public identity. PlotPickle needs the private nsec only because Buzz&apos;s CLI must sign channel and message actions. PlotPickle encrypts it locally and never puts it in a PPF, export or GitHub.</p>
      </aside>
      <aside className={styles.terminologyNote}>
        <b>Buzz channels become PlotPickle Story Rooms</b>
        <p>Buzz already uses <strong>channels</strong> for discussion and <strong>huddles</strong> for live voice. After verification, PlotPickle creates six private project channels and presents them as Story Rooms. There is no separate Hangouts feature to find.</p>
      </aside>
    </section>

    <section className={styles.runtimeGrid} aria-label="Buzz status details">
      <article><span>Buzz Desktop / CLI</span><strong>{cliAvailable ? "Detected" : "Not detected"}</strong><small>{status?.cli.executable || status?.cli.error || "Open Buzz Desktop once, then refresh."}</small></article>
      <article><span>Community</span><strong>{reachable ? `${status?.relay.latencyMs} ms` : configured ? "Not verified" : "Not connected"}</strong><small>{status?.connection.relayUrl || "No community URL saved"}</small></article>
      <article><span>Buzz identity authorization</span><strong>{identityVerified ? "Verified" : identityConfigured ? "Stored, not verified" : "Not authorized"}</strong><small>{status?.connection.identityLabel || "Required for signed channel and message actions"}</small></article>
    </section>

    <section className={styles.choiceGrid} aria-label="Buzz connection mode">
      <article className={form.mode === "existing-relay" ? styles.selectedChoice : undefined}>
        <span>Recommended</span><h2>Block-hosted Buzz community</h2><p>Use the wss:// address shown for your community on Buzz&apos;s Communities page. PlotPickle connects to it but does not create, host or own it.</p>
        <button type="button" onClick={() => patch({ mode: "existing-relay" })}>Use my hosted community</button>
      </article>
      <article className={form.mode === "managed" ? styles.selectedChoice : undefined}>
        <span>Advanced</span><h2>Managed local Buzz</h2><p>Self-host the pinned Docker Compose bundle on this computer. Choose this only if you intentionally want to operate the Buzz relay yourself.</p>
        <button type="button" onClick={() => patch({ mode: "managed", relayUrl: status?.managed.relayUrl || "http://127.0.0.1:3000" })}>Use managed local relay</button>
      </article>
    </section>

    <section className={styles.formCard}>
      <div><span>Secure connection details</span><h2>{form.mode === "managed" ? "Managed local community" : "Your existing Buzz community"}</h2><p>Installing Buzz lets PlotPickle find the CLI, but Buzz deliberately does not give another application its community or identity automatically. You choose both values below.</p></div>
      <div className={styles.formGrid}>
        <label><span>Buzz community WebSocket address</span><input value={form.relayUrl} disabled={form.mode === "managed"} onChange={(event) => patch({ relayUrl: event.target.value })} placeholder="wss://plotpickleplayhouse.communities.buzz.xyz" /><small>Copy the complete wss:// address beside your community on Buzz&apos;s Communities page.</small></label>
        <label><span>Community name (optional)</span><input value={form.community} onChange={(event) => patch({ community: event.target.value })} placeholder="plotpickleplayhouse" /><small>A friendly label in PlotPickle; it does not create or rename the Buzz community.</small></label>
        <label><span>Your identity label (optional)</span><input value={form.identityLabel} onChange={(event) => patch({ identityLabel: event.target.value })} placeholder="Bryan · PlotPickle" /><small>Shown in PlotPickle so you know which identity is connected.</small></label>
        <label><span>Buzz private identity key</span><input type="password" autoComplete="off" value={form.privateKey} onChange={(event) => patch({ privateKey: event.target.value })} placeholder={identityConfigured ? "Leave blank to retain the saved encrypted key" : "nsec1…"} /><small>Buzz Desktop: profile menu &gt; Settings &gt; Profile &gt; Identity &gt; Private key &gt; Reveal. Do not paste the public npub shown on the Communities page.</small></label>
      </div>
      <details className={styles.advancedField}>
        <summary>Advanced: Buzz CLI path</summary>
        <label><span>Buzz CLI path (optional)</span><input value={form.cliPath} onChange={(event) => patch({ cliPath: event.target.value })} placeholder="Leave blank to use Buzz Desktop automatically" /><small>Buzz Desktop v0.5.3 includes the supported CLI sidecar. Leave this blank unless automatic detection fails.</small></label>
      </details>
    </section>

    <section className={styles.actions}>
      <button type="button" disabled={blocked || !form.relayUrl.trim() || (!identityConfigured && !form.privateKey.trim())} onClick={() => void saveAndTest()}>{busy === "save" ? "Saving and verifying…" : "Save & verify all three pieces"}</button>
      <button type="button" disabled={!configured || blocked} onClick={() => void run("test", () => request("/test", { method: "POST" }))}>{busy === "test" ? "Testing…" : "Test Buzz connection"}</button>
      <button type="button" disabled={blocked} onClick={() => void run("refresh", async () => { await refresh(true); return { message: "Buzz status refreshed." }; })}>Refresh status</button>
      {storyRoomReady ? <a href="/buzz">Open Story Room</a> : <button type="button" disabled title="Complete all three setup steps before opening the live Story Room.">Story Room not ready</button>}
      {openInBuzzUrl ? <a href={openInBuzzUrl}>Open this community in Buzz Desktop</a> : null}
      <button className={styles.removeAction} type="button" disabled={!configured || blocked} onClick={() => void run("disconnect", () => request("/connection", { method: "DELETE" }))}>Remove connection and identity</button>
    </section>

    {configured && reachable && (!cliAvailable || !identityVerified) ? <section className={styles.boundary}><span>One step remains</span><h2>The community address works, but PlotPickle is not authorized yet.</h2><p>{!cliAvailable ? "Open Buzz Desktop or select its supported CLI. " : ""}{!identityConfigured ? "Reveal and save the nsec key from Buzz Desktop. " : !identityVerified ? "Select Test Buzz connection to verify that this identity belongs to the community. " : ""}The public npub cannot sign these actions.</p></section> : null}

    {form.mode === "managed" ? <section className={styles.lifecycleCard}>
      <div><span>Managed runtime lifecycle</span><h2>{managedCopy.title}</h2><p>{managedCopy.detail}</p><small>{status?.managed.message || status?.managed.bundle.validationGate || "Managed Buzz remains optional."}</small></div>
      <div className={styles.lifecycleActions}>
        <button type="button" disabled={!managedActions.install || blocked} onClick={() => void run("install", () => request("/managed/install", { method: "POST" }))}>Install</button>
        <button type="button" disabled={!managedActions.start || blocked} onClick={() => void run("start", () => request("/managed/start", { method: "POST" }))}>Start</button>
        <button type="button" disabled={!managedActions.stop || blocked} onClick={() => void run("stop", () => request("/managed/stop", { method: "POST" }))}>Stop</button>
        <button type="button" disabled={!managedActions.restart || blocked} onClick={() => void run("restart", () => request("/managed/restart", { method: "POST" }))}>Restart</button>
        <button type="button" disabled={!managedActions.repair || blocked} onClick={() => void run("repair", () => request("/managed/repair", { method: "POST" }))}>Repair</button>
        <button type="button" disabled={!managedActions.update || blocked} onClick={() => void run("update", () => request("/managed/update", { method: "POST" }))}>Update pinned bundle</button>
        <button type="button" disabled={!managedActions.backup || blocked} onClick={() => void run("backup", () => request("/managed/backup", { method: "POST" }))}>Back up</button>
        <button type="button" disabled={!managedActions.remove || blocked} title={managedState.running ? "Stop managed Buzz before removing its runtime and data." : undefined} onClick={() => void run("remove", () => request("/managed", { method: "DELETE", body: JSON.stringify({ removeBackups: false }) }))}>Remove runtime and data</button>
      </div>
    </section> : null}

    <section className={styles.boundary}><span>Authority boundary</span><h2>Discussion does not become canon by itself.</h2><p>Buzz messages can be linked to story entities and converted into local proposals. Only an explicit human approval applies a selected proposal to the active PPF project.</p><ul><li>No Buzz service starts when PlotPickle is installed.</li><li>PlotPickle never creates or pairs a Buzz identity; it stores only the copy you explicitly authorize.</li><li>Removing Buzz preserves PlotPickle projects and their approved canon.</li></ul></section>
    {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
  </div>;
}
