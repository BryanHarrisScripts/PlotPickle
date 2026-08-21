"use client";

import { useEffect, useState } from "react";
import { PLOTPICKLE_BUZZ_COMMUNITY } from "../lib/buzz-default-community";
import { describeBuzzManagedRuntime, getBuzzManagedRuntimeActions } from "../lib/buzz-managed-runtime";
import {
  UNVERIFIED_HUMAN_BUZZ_IDENTITY,
  humanBuzzFingerprint,
  isKnownHumanBuzzIdentity,
  type HumanBuzzIdentity,
} from "../lib/buzz-story-room";
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
type GuildhallSteward = { id: string; displayName: string; title: string; summary: string; primaryChannel: string; systemPrompt: string; ownerReviewRequired: boolean };
type GuildhallStatus = {
  configured: boolean;
  identityVerified: boolean;
  canSetup: boolean;
  ready: boolean;
  operational: boolean;
  readyCount: number;
  totalCount: number;
  readyRooms: Array<{ id: string; name: string; label: string; channelId: string }>;
  missingRooms: Array<{ id: string; name: string; label: string }>;
  stewards: GuildhallSteward[];
  upstreamAgentBoundary: string;
  message: string;
};
type FormState = { mode: ConnectionMode; relayUrl: string; cliPath: string };
type ConnectionState = "loading" | "disconnected" | "detected" | "connecting" | "connected" | "degraded";
const EMPTY: FormState = { mode: "existing-relay", relayUrl: PLOTPICKLE_BUZZ_COMMUNITY.relayUrl, cliPath: "" };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const body = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(body.message || `Buzz returned ${response.status}.`);
  return body;
}

async function readHumanIdentity() {
  return request<HumanBuzzIdentity & { ok: true }>("/human-identity").catch((error) => ({
    ...UNVERIFIED_HUMAN_BUZZ_IDENTITY,
    ok: true as const,
    message: error instanceof Error ? error.message : UNVERIFIED_HUMAN_BUZZ_IDENTITY.message,
  }));
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
  const [humanIdentity, setHumanIdentity] = useState<HumanBuzzIdentity | null>(null);
  const [guildhall, setGuildhall] = useState<GuildhallStatus | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  function refreshDashboardLights() {
    window.dispatchEvent(new CustomEvent("plotpickle:connection-status-refresh"));
    window.dispatchEvent(new CustomEvent("plotpickle:setup-status-refresh"));
  }

  function applyStatus(body: BuzzStatus) {
    setStatus(body);
    setForm((current) => ({
      ...current,
      mode: body.connection.mode,
      relayUrl: body.connection.mode === "managed" ? body.connection.relayUrl : PLOTPICKLE_BUZZ_COMMUNITY.relayUrl,
      cliPath: body.connection.cliPath,
    }));
  }

  async function refreshGuildhall(showNotice = false) {
    const body = await request<GuildhallStatus & { ok: true }>("/guildhall/status");
    setGuildhall(body);
    if (showNotice) setNotice(body.message);
    return body;
  }

  async function refresh(showNotice = false) {
    const [body, humanBody] = await Promise.all([
      request<BuzzStatus & { ok: true }>("/status"),
      readHumanIdentity(),
    ]);
    applyStatus(body);
    setHumanIdentity(humanBody);
    await refreshGuildhall(false).catch(() => undefined);
    if (showNotice) setNotice(humanBody.humanCommunityAllowed ? body.relay.detail : humanBody.message);
  }

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      request<BuzzStatus & { ok: true }>("/status"),
      request<GuildhallStatus & { ok: true }>("/guildhall/status"),
      readHumanIdentity(),
    ])
      .then(([buzzBody, guildhallBody, humanBody]) => {
        if (cancelled) return;
        applyStatus(buzzBody);
        setGuildhall(guildhallBody);
        setHumanIdentity(humanBody);
      })
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
      refreshDashboardLights();
      setNotice(result.message || "Buzz operation completed.");
    } catch (error) {
      await refresh().catch(() => undefined);
      refreshDashboardLights();
      setNotice(error instanceof Error ? error.message : "Buzz operation failed.");
    } finally { setBusy(""); }
  }

  async function saveTransport() {
    setBusy("save");
    setNotice("");
    try {
      await request("/connection", {
        method: "PUT",
        body: JSON.stringify({
          mode: form.mode,
          relayUrl: form.mode === "managed" ? form.relayUrl : PLOTPICKLE_BUZZ_COMMUNITY.relayUrl,
          community: PLOTPICKLE_BUZZ_COMMUNITY.name,
          identityLabel: status?.connection.identityLabel || "",
          cliPath: form.cliPath,
        }),
      });
      const humanBody = await readHumanIdentity();
      if (humanBody.humanCommunityAllowed) {
        const result = await request<{ message?: string }>("/test", { method: "POST" });
        setNotice(result.message || "BUZZ transport and saved Profile identity verified successfully.");
      } else {
        setNotice(`BUZZ transport saved. Connect the Human BUZZ identity from Profile before Community posting. ${humanBody.message}`.trim());
      }
      await refresh();
      refreshDashboardLights();
    } catch (error) {
      await refresh().catch(() => undefined);
      refreshDashboardLights();
      setNotice(error instanceof Error ? error.message : "BUZZ transport could not be saved.");
    } finally { setBusy(""); }
  }

  async function setupGuildhall() {
    setBusy("guildhall");
    setNotice("");
    try {
      const body = await request<GuildhallStatus & { ok: true }>("/guildhall/setup", { method: "POST" });
      setGuildhall(body);
      refreshDashboardLights();
      setNotice(body.message);
    } catch (error) {
      await refreshGuildhall().catch(() => undefined);
      setNotice(error instanceof Error ? error.message : "The PlotPickle Guildhall could not be set up.");
    } finally { setBusy(""); }
  }

  async function copySteward(steward: GuildhallSteward) {
    const content = `${steward.displayName} · ${steward.title}\n\n${steward.systemPrompt}`;
    try {
      await navigator.clipboard.writeText(content);
      setNotice(`${steward.displayName} setup copied. Create a new personal agent in Buzz Desktop, paste these instructions, review the form and save it.`);
    } catch {
      setNotice(`Could not copy ${steward.displayName}. Open Buzz Desktop and create this steward manually from the role shown here.`);
    }
  }

  const configured = Boolean(status?.connection.configured);
  const reachable = Boolean(status?.relay.reachable);
  const cliAvailable = Boolean(status?.cli.available);
  const identityConfigured = Boolean(status?.connection.identityConfigured);
  const identityVerified = Boolean(status?.connection.identityVerified);
  const humanIdentityReady = isKnownHumanBuzzIdentity(humanIdentity);
  const identityMismatch = humanIdentity?.kind === "agent";
  const connectionState: ConnectionState = !status
    ? "loading"
    : busy === "test" || busy === "save"
      ? "connecting"
      : !configured
        ? cliAvailable ? "detected" : "disconnected"
        : reachable && identityVerified && humanIdentityReady ? "connected" : "degraded";
  const storyRoomReady = connectionState === "connected" && cliAvailable && identityConfigured && identityVerified && humanIdentityReady;
  const guildhallReady = Boolean(guildhall?.operational);
  const stateCopy = {
    loading: { title: "Checking Buzz", tone: "Checking", detail: "PlotPickle is checking Buzz Desktop, the built-in Community and the current Human signer." },
    disconnected: { title: "Buzz Desktop not detected", tone: "Setup needed", detail: "Install and open Buzz Desktop once, then refresh this screen." },
    detected: { title: "Buzz Desktop detected", tone: "Desktop ready", detail: "The default PlotPickle Community is built in. Connect your Human BUZZ identity from Profile." },
    connecting: { title: "Verifying Buzz", tone: "Connecting", detail: "PlotPickle is checking the relay, Desktop CLI and Profile-owned Human signer." },
    connected: { title: "Buzz is ready", tone: "Ready", detail: "The default Community, Desktop CLI and verified Human signer are ready." },
    degraded: { title: identityMismatch ? "Community identity mismatch" : reachable ? "Human identity is not ready" : "Community cannot be reached", tone: identityMismatch ? "Wrong signer" : reachable ? "Open Profile" : "Relay unavailable", detail: identityMismatch ? humanIdentity?.message || "A PlotPickle agent identity cannot be used as the Human Community caller." : reachable ? humanIdentity?.message || "Open Profile and connect the Human BUZZ identity." : status?.relay.detail || "The built-in Community relay did not respond." },
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
  const activeRelay = form.mode === "managed" ? form.relayUrl : PLOTPICKLE_BUZZ_COMMUNITY.relayUrl;
  const openInBuzzUrl = buzzDesktopUrl(activeRelay, PLOTPICKLE_BUZZ_COMMUNITY.name);
  const signerFingerprint = humanBuzzFingerprint(humanIdentity?.pubkey || "");

  return <div className={styles.page}>
    <header className={styles.heading}>
      <p>{"Settings · Repository & Collab · Buzz"}</p>
      <h1>BUZZ transport, runtime and Guildhall diagnostics.</h1>
      <span>Your Human BUZZ signer is owned by Profile. Settings can inspect/test the transport and manage the optional local runtime, but it cannot replace the Human identity.</span>
    </header>

    <section className={styles.statusCard}>
      <div><p>Current Buzz setup</p><h2>{stateCopy.title}</h2><p>{stateCopy.detail}</p></div>
      <div className={styles.statusBadge} data-state={connectionState} role="status" aria-live="polite"><i aria-hidden="true" /><b>{stateCopy.tone}</b></div>
    </section>

    <section className={styles.statusCard} data-buzz-human-identity="true">
      <div><p>Profile-owned Community writer identity</p><h2>{humanIdentityReady ? humanIdentity?.displayName : identityMismatch ? "Agent signer cannot be the writer" : "Connect in Profile"}</h2><p>{humanIdentity?.message || UNVERIFIED_HUMAN_BUZZ_IDENTITY.message}</p>{signerFingerprint ? <small>Verified signer: {signerFingerprint}</small> : null}</div>
      <div className={styles.statusBadge} data-state={humanIdentityReady ? "connected" : identityMismatch ? "degraded" : "disconnected"} role="status" aria-live="polite"><i aria-hidden="true" /><b>{humanIdentityReady ? "Human verified" : identityMismatch ? "Identity mismatch" : "Profile required"}</b></div>
    </section>

    <section className={styles.formCard} data-buzz-default-community="true">
      <div><span>Built-in Community</span><h2>{PLOTPICKLE_BUZZ_COMMUNITY.name}</h2><p>Every normal PlotPickle profile targets this Community automatically. The relay host is product-owned configuration rather than a value each Human must re-enter.</p></div>
      <div className={styles.formGrid}><label><span>Default relay</span><input value={PLOTPICKLE_BUZZ_COMMUNITY.relayUrl} readOnly /><small>Human identity setup remains in Profile. BUZZ signatures—not this label—determine authorship.</small></label></div>
    </section>

    <section className={styles.statusCard} aria-labelledby="plotpickle-guildhall-title">
      <div><p>PlotPickle Guildhall</p><h2 id="plotpickle-guildhall-title">{guildhallReady ? "Guildhall operational" : guildhall ? `${guildhall.readyCount}/${guildhall.totalCount} private rooms ready` : "Checking Guildhall"}</h2><p>{guildhall?.message || "PlotPickle is checking the shared coordination rooms."}</p></div>
      <div className={styles.statusBadge} data-state={guildhallReady ? "connected" : identityVerified ? "detected" : "disconnected"} role="status" aria-live="polite"><i aria-hidden="true" /><b>{guildhallReady ? "Operational" : identityVerified ? "Ready to build" : "Waiting for Profile"}</b></div>
    </section>

    <section className={styles.setupGuide} aria-labelledby="guildhall-setup-title">
      <div className={styles.guideHeading}><span>One-click coordination setup</span><h2 id="guildhall-setup-title">Create or repair the PlotPickle Guildhall inside the active BUZZ relay.</h2></div>
      <div className={styles.setupSteps}>
        <article data-complete={identityVerified ? "true" : "false"}><span>1</span><div><b>Profile-owned signing key</b><strong>{identityVerified ? "Ready" : "Required"}</strong><p>Settings never asks for the nsec. Connect or replace the Human signer from Profile.</p></div></article>
        <article data-complete={guildhallReady ? "true" : "false"}><span>2</span><div><b>Guildhall rooms</b><strong>{guildhall ? `${guildhall.readyCount}/${guildhall.totalCount} ready` : "Checking"}</strong><p>{guildhallReady ? "All Guildhall rooms are ready." : guildhall?.missingRooms.length ? `Missing: ${guildhall.missingRooms.map((room) => room.label).join(", ")}.` : "PlotPickle will create only missing rooms."}</p></div></article>
        <article data-complete={guildhallReady ? "true" : "false"}><span>3</span><div><b>PlotPickle bridge</b><strong>{guildhallReady ? "Live" : "Waiting"}</strong><p>Local agent coordination remains separate from Human Great Hall authorship.</p></div></article>
      </div>
      <div className={styles.actions}><button type="button" disabled={blocked || !guildhall?.canSetup || guildhallReady} onClick={() => void setupGuildhall()}>{busy === "guildhall" ? "Building Guildhall…" : guildhallReady ? "Guildhall ready" : "Set up PlotPickle Guildhall"}</button><button type="button" disabled={blocked} onClick={() => void refreshGuildhall(true)}>Refresh Guildhall status</button>{openInBuzzUrl ? <a href={openInBuzzUrl}>Open Guildhall community in Buzz Desktop</a> : null}</div>
    </section>

    {guildhall?.stewards.length ? <section className={styles.setupGuide} aria-labelledby="guildhall-stewards-title">
      <div className={styles.guideHeading}><span>Optional separate Buzz identities</span><h2 id="guildhall-stewards-title">Orin and Fen still require your approval in Buzz Desktop.</h2><p>The Guildhall works without separate steward identities. PlotPickle does not bypass owner review.</p></div>
      <div className={styles.setupSteps}>{guildhall.stewards.map((steward, index) => <article key={steward.id} data-complete="false"><span>{index + 1}</span><div><b>{steward.displayName}</b><strong>{steward.title}</strong><p>{steward.summary}</p><button type="button" disabled={blocked} onClick={() => void copySteward(steward)}>Copy {steward.displayName} setup</button></div></article>)}</div>
    </section> : null}

    <section className={styles.runtimeGrid} aria-label="Buzz status details">
      <article><span>Buzz Desktop / CLI</span><strong>{cliAvailable ? "Detected" : "Not detected"}</strong><small>{status?.cli.executable || status?.cli.error || "Open Buzz Desktop once, then refresh."}</small></article>
      <article><span>Community</span><strong>{reachable ? `${status?.relay.latencyMs} ms` : configured ? "Not verified" : "Built-in default"}</strong><small>{status?.connection.relayUrl || PLOTPICKLE_BUZZ_COMMUNITY.relayUrl}</small></article>
      <article><span>Human signer owner</span><strong>{identityConfigured ? "Profile" : "Not connected"}</strong><small>Signer creation/import/disconnect belongs to Profile.</small></article>
      <article><span>Verified Buzz signer / profile</span><strong>{humanIdentityReady ? humanIdentity?.displayName : identityMismatch ? "Agent identity blocked" : identityVerified ? "Signer unresolved" : "Not verified"}</strong><small>{signerFingerprint || "No verified Human public identity available"}</small></article>
    </section>

    <section className={styles.choiceGrid} aria-label="Buzz connection mode">
      <article className={form.mode === "existing-relay" ? styles.selectedChoice : undefined}><span>Recommended</span><h2>Block-hosted Buzz community</h2><p>The official PlotPickle Community relay is built in and shared by every normal Node.</p><button type="button" onClick={() => patch({ mode: "existing-relay", relayUrl: PLOTPICKLE_BUZZ_COMMUNITY.relayUrl })}>Use PlotPickle Community</button></article>
      <article className={form.mode === "managed" ? styles.selectedChoice : undefined}><span>Advanced</span><h2>Managed local Buzz</h2><p>Self-host the pinned Docker Compose bundle on this computer for local/operator testing. This is an explicit advanced override, not the normal Human Community.</p><button type="button" onClick={() => patch({ mode: "managed", relayUrl: status?.managed.relayUrl || "http://127.0.0.1:3000" })}>Use managed local relay</button></article>
    </section>

    <section className={styles.formCard}>
      <div><span>Transport diagnostics</span><h2>{form.mode === "managed" ? "Managed local relay" : PLOTPICKLE_BUZZ_COMMUNITY.name}</h2><p>Settings owns runtime/transport diagnostics only. Human BUZZ identity setup is intentionally absent here.</p></div>
      {form.mode === "managed" ? <div className={styles.formGrid}><label><span>Managed relay address</span><input value={form.relayUrl} onChange={(event) => patch({ relayUrl: event.target.value })} /><small>Advanced local/operator override only.</small></label></div> : null}
      <details className={styles.advancedField}><summary>Advanced: Buzz CLI path</summary><label><span>Buzz CLI path (optional)</span><input value={form.cliPath} onChange={(event) => patch({ cliPath: event.target.value })} placeholder="Leave blank to use Buzz Desktop automatically" /><small>Buzz Desktop includes the supported CLI sidecar. Leave this blank unless automatic detection fails.</small></label></details>
    </section>

    <section className={styles.actions}>
      <button type="button" disabled={blocked} onClick={() => void saveTransport()}>{busy === "save" ? "Saving & testing…" : "Save & test transport"}</button>
      <button type="button" disabled={!configured || !identityConfigured || blocked} onClick={() => void run("test", () => request("/test", { method: "POST" }))}>{busy === "test" ? "Testing…" : "Test BUZZ with Profile identity"}</button>
      <button type="button" disabled={blocked} onClick={() => void run("refresh", async () => { await refresh(true); return { message: "Buzz status refreshed." }; })}>Refresh status</button>
      {storyRoomReady ? <a href="/buzz">Open Story Room</a> : <button type="button" disabled title="Connect a verified Human BUZZ identity from Profile before opening the live Story Room.">Story Room not ready</button>}
      {openInBuzzUrl ? <a href={openInBuzzUrl}>Open this community in Buzz Desktop</a> : null}
    </section>

    {configured && reachable && !humanIdentityReady ? <section className={styles.boundary}><span>One step remains</span><h2>Connect the Human BUZZ identity from Profile.</h2><p>{humanIdentity?.message || "The relay is available, but Settings does not own Human signing credentials."}</p></section> : null}

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

    <section className={styles.boundary}><span>Authority boundary</span><h2>Discussion does not become canon by itself.</h2><p>Buzz messages can be linked to story entities and converted into local proposals. Only an explicit Human approval applies a selected proposal to the active PPF project.</p><ul><li>No Buzz service starts merely because PlotPickle is installed.</li><li>Profile owns Human signer creation/import/disconnect.</li><li>Settings owns transport, runtime and health diagnostics.</li><li>Removing or changing BUZZ never changes PlotPickle projects or approved canon.</li></ul></section>
    {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
  </div>;
}
