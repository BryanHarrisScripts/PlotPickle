"use client";

import { useEffect, useState } from "react";
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
  created?: string[];
  kept?: string[];
};
type FormState = { mode: ConnectionMode; relayUrl: string; community: string; cliPath: string };
type ConnectionState = "loading" | "disconnected" | "detected" | "connecting" | "connected" | "degraded";
const EMPTY: FormState = { mode: "existing-relay", relayUrl: "", community: "", cliPath: "" };

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

  function openProfile() {
    window.dispatchEvent(new CustomEvent("plotpickle:open-profile"));
  }

  function applyStatus(body: BuzzStatus) {
    setStatus(body);
    setForm((current) => ({
      ...current,
      mode: body.connection.mode,
      relayUrl: body.connection.relayUrl,
      community: body.connection.community,
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
    if (showNotice) setNotice(humanBody.humanCommunityAllowed ? (body.connection.configured ? body.relay.detail : body.cli.available ? "Buzz Desktop is detected. Add your community details to finish runtime setup." : "Buzz Desktop was not detected.") : humanBody.message);
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

  async function saveRuntime() {
    setBusy("save");
    setNotice("");
    try {
      await request("/connection", {
        method: "PUT",
        body: JSON.stringify({
          ...form,
          identityLabel: status?.connection.identityLabel || "",
          privateKey: "",
        }),
      });
      await refresh();
      refreshDashboardLights();
      setNotice(identityConfigured ? "Buzz runtime settings were saved. Your Human BUZZ identity remains managed from Profile." : "Buzz runtime settings were saved. Open Profile when you are ready to create or connect your Human BUZZ identity.");
    } catch (error) {
      await refresh().catch(() => undefined);
      refreshDashboardLights();
      setNotice(error instanceof Error ? error.message : "Buzz runtime settings could not be saved.");
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
    const text = `${steward.displayName} · ${steward.title}\n\n${steward.systemPrompt}`;
    try {
      await navigator.clipboard.writeText(text);
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
    loading: { title: "Checking Buzz", tone: "Checking", detail: "PlotPickle is looking for Buzz Desktop and any saved community." },
    disconnected: { title: "Buzz Desktop not detected", tone: "Setup needed", detail: "Install and open Buzz Desktop once, then refresh this screen." },
    detected: { title: "Buzz Desktop detected", tone: "Desktop ready", detail: "Buzz is installed. Save the community/runtime details here; create or connect your Human BUZZ identity from Profile." },
    connecting: { title: "Verifying Buzz", tone: "Connecting", detail: "PlotPickle is checking the community, Desktop CLI and configured Human BUZZ identity." },
    connected: { title: "Buzz is ready", tone: "Ready", detail: "The community, Desktop CLI and verified Human signer are ready. PlotPickle can post Community messages under the correct identity." },
    degraded: { title: identityMismatch ? "Community identity mismatch" : reachable ? "Human BUZZ identity is not ready" : "Community cannot be reached", tone: identityMismatch ? "Wrong signer" : reachable ? "Open Profile" : "Check address", detail: identityMismatch ? humanIdentity?.message || "A PlotPickle agent identity cannot be used as the Human Community caller." : reachable ? humanIdentity?.message || "The hosted community responded, but the Human BUZZ identity has not passed the Community check." : status?.relay.detail || "The saved community address did not respond." },
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
  const signerFingerprint = humanBuzzFingerprint(humanIdentity?.pubkey || "");

  return <div className={styles.page}>
    <header className={styles.heading}>
      <p>{"Settings · Repository & Collab · Buzz"}</p>
      <h1>Buzz runtime and Community diagnostics.</h1>
      <span>Your Human avatar, display name, public bio and BUZZ identity are managed once from Profile. Settings only manages the community address, local runtime, CLI diagnostics and Guildhall infrastructure.</span>
    </header>

    <section className={styles.statusCard}>
      <div><p>Current Buzz setup</p><h2>{stateCopy.title}</h2><p>{stateCopy.detail}</p></div>
      <div className={styles.statusBadge} data-state={connectionState} role="status" aria-live="polite"><i aria-hidden="true" /><b>{stateCopy.tone}</b></div>
    </section>

    <section className={styles.statusCard} data-buzz-human-identity="true">
      <div>
        <p>Human BUZZ identity</p>
        <h2>{humanIdentityReady ? humanIdentity?.displayName : identityMismatch ? "Agent signer cannot be the Human" : "Human identity not verified"}</h2>
        <p>{humanIdentity?.message || UNVERIFIED_HUMAN_BUZZ_IDENTITY.message}</p>
        {signerFingerprint ? <small>Verified signer: {signerFingerprint}</small> : null}
      </div>
      <div className={styles.actions}>
        <button type="button" onClick={openProfile}>{humanIdentityReady ? "Open Profile" : "Set up identity in Profile"}</button>
        <div className={styles.statusBadge} data-state={humanIdentityReady ? "connected" : identityMismatch ? "degraded" : "disconnected"} role="status" aria-live="polite"><i aria-hidden="true" /><b>{humanIdentityReady ? "Human verified" : identityMismatch ? "Identity mismatch" : "Profile setup"}</b></div>
      </div>
    </section>

    <section className={styles.statusCard} aria-labelledby="plotpickle-guildhall-title">
      <div>
        <p>PlotPickle Guildhall</p>
        <h2 id="plotpickle-guildhall-title">{guildhallReady ? "Guildhall operational" : guildhall ? `${guildhall.readyCount}/${guildhall.totalCount} private rooms ready` : "Checking Guildhall"}</h2>
        <p>{guildhall?.message || "PlotPickle is checking the shared coordination rooms."}</p>
      </div>
      <div className={styles.statusBadge} data-state={guildhallReady ? "connected" : identityVerified ? "detected" : "disconnected"} role="status" aria-live="polite"><i aria-hidden="true" /><b>{guildhallReady ? "Operational" : identityVerified ? "Ready to build" : "Waiting for Buzz"}</b></div>
    </section>

    <section className={styles.setupGuide} aria-labelledby="guildhall-setup-title">
      <div className={styles.guideHeading}>
        <span>One-click coordination setup</span>
        <h2 id="guildhall-setup-title">Create the PlotPickle Guildhall inside your Buzz community.</h2>
      </div>
      <div className={styles.setupSteps}>
        <article data-complete={identityVerified ? "true" : "false"}>
          <span>1</span>
          <div><b>Verified Human BUZZ identity</b><strong>{identityVerified ? "Ready" : "Required"}</strong><p>The Human signer is created or connected in Profile and remains encrypted inside that Human profile. Settings never asks for the private signer.</p></div>
        </article>
        <article data-complete={guildhallReady ? "true" : "false"}>
          <span>2</span>
          <div><b>Guildhall rooms</b><strong>{guildhall ? `${guildhall.readyCount}/${guildhall.totalCount} ready` : "Checking"}</strong><p>{guildhallReady ? "The Great Hall, Lore Library, Wayfarer Journal, Wyrmwood Ring, Story Council, Thread Vault, Lantern Watch, Gatehouse, Forge, GitHub Herald and Long Archive are ready." : guildhall?.missingRooms.length ? `Missing: ${guildhall.missingRooms.map((room) => room.label).join(", ")}.` : "PlotPickle will create only the missing private rooms."}</p></div>
        </article>
        <article data-complete={guildhallReady ? "true" : "false"}>
          <span>3</span>
          <div><b>PlotPickle bridge</b><strong>{guildhallReady ? "Live" : "Waiting for rooms"}</strong><p>When all 11 rooms exist, Sage, Avery, Wyrmwood, visual review, UAT and development handoffs can route signed summaries into explicit Guildhall rooms instead of the Human Great Hall.</p></div>
        </article>
      </div>
      <div className={styles.actions}>
        <button type="button" disabled={blocked || !guildhall?.canSetup || guildhallReady} onClick={() => void setupGuildhall()}>{busy === "guildhall" ? "Building Guildhall…" : guildhallReady ? "Guildhall ready" : "Set up PlotPickle Guildhall"}</button>
        <button type="button" disabled={blocked} onClick={() => void refreshGuildhall(true)}>Refresh Guildhall status</button>
        {openInBuzzUrl ? <a href={openInBuzzUrl}>Open Guildhall community in Buzz Desktop</a> : null}
      </div>
      <aside className={styles.terminologyNote}>
        <b>No GitHub BUZZ secret is needed</b>
        <p>The Human signer stays in encrypted profile-private storage and is passed only to the local Buzz CLI when a signed action is requested. It is never copied into GitHub.</p>
      </aside>
    </section>

    {guildhall?.stewards.length ? <section className={styles.setupGuide} aria-labelledby="guildhall-stewards-title">
      <div className={styles.guideHeading}>
        <span>Optional separate Buzz identities</span>
        <h2 id="guildhall-stewards-title">Orin and Fen still require your approval in Buzz Desktop.</h2>
        <p>The Guildhall works without separate steward identities. Buzz intentionally requires personal-agent creation to be reviewed by the owner, so PlotPickle will not bypass that control.</p>
      </div>
      <div className={styles.setupSteps}>
        {guildhall.stewards.map((steward, index) => <article key={steward.id} data-complete="false">
          <span>{index + 1}</span>
          <div><b>{steward.displayName}</b><strong>{steward.title}</strong><p>{steward.summary}</p><button type="button" disabled={blocked} onClick={() => void copySteward(steward)}>Copy {steward.displayName} setup</button></div>
        </article>)}
      </div>
      <aside className={styles.terminologyNote}>
        <b>Why this is not automatic</b>
        <p>Buzz&apos;s external agent-draft command is reserved for an already owner-authorized Buzz agent and requires its NIP-OA owner authorization. Your normal Human BUZZ identity is not that delegated agent credential. PlotPickle keeps this safety boundary intact.</p>
      </aside>
    </section> : null}

    <section className={styles.setupGuide} aria-labelledby="buzz-settings-steps-title">
      <div className={styles.guideHeading}>
        <span>Profile first, runtime here</span>
        <h2 id="buzz-settings-steps-title">One Human identity, one Buzz runtime connection.</h2>
      </div>
      <div className={styles.setupSteps}>
        <article data-complete={cliAvailable ? "true" : "false"}>
          <span>1</span>
          <div><b>Buzz Desktop</b><strong>{cliAvailable ? "Detected" : "Not detected"}</strong><p>{cliAvailable ? `${status?.cli.version || "Buzz Desktop"}${status && status.cli.source === "buzz-desktop" ? " · found automatically" : ""}` : "Install the current Buzz Desktop release, open it once, then select Refresh status below."}</p></div>
        </article>
        <article data-complete={reachable ? "true" : "false"}>
          <span>2</span>
          <div><b>Hosted community address</b><strong>{reachable ? "Reached" : configured ? "Saved, not reached" : "Copy from Communities"}</strong><p>On Buzz&apos;s Communities page, find your community and copy the address beside <strong>Open in Buzz</strong>. It begins with wss:// and ends with .communities.buzz.xyz.</p></div>
        </article>
        <article data-complete={humanIdentityReady ? "true" : "false"}>
          <span>3</span>
          <div><b>Human BUZZ identity</b><strong>{humanIdentityReady ? `${humanIdentity?.displayName} verified` : identityMismatch ? "Agent identity rejected" : identityConfigured ? "Saved, verification pending" : "Set up in Profile"}</strong><p>Open Profile and choose <strong>Create BUZZ Identity</strong> or <strong>Connect Existing Identity</strong>. Your Profile owns the Human avatar, display name and public bio; Settings never asks you to paste the private signer.</p></div>
        </article>
      </div>
      <aside className={styles.terminologyNote}>
        <b>Sage is your PlotPickle guide; Sage is not your Community identity.</b>
        <p>The Human BUZZ identity configured in Profile decides signed Community authorship. Sage and other agents keep their own identities and cannot unlock Human Community access.</p>
      </aside>
      <aside className={styles.terminologyNote}>
        <b>Public and private BUZZ identity details stay separated</b>
        <p>Profile may show safe public identity details such as the public key or verification status. Private signing material remains encrypted and is not exposed in Settings, diagnostics, PPF data or GitHub.</p>
      </aside>
      <aside className={styles.terminologyNote}>
        <b>Buzz channels become PlotPickle Story Rooms</b>
        <p>Buzz already uses <strong>channels</strong> for discussion and <strong>huddles</strong> for live voice. PlotPickle presents Great Hall as Hall 1 and five specialist Story Rooms as Halls 2-6. The legacy broad story channel remains compatibility data rather than a duplicate visible hall.</p>
      </aside>
    </section>

    <section className={styles.runtimeGrid} aria-label="Buzz status details">
      <article><span>Buzz Desktop / CLI</span><strong>{cliAvailable ? "Detected" : "Not detected"}</strong><small>{status?.cli.executable || status?.cli.error || "Open Buzz Desktop once, then refresh."}</small></article>
      <article><span>Community</span><strong>{reachable ? `${status?.relay.latencyMs} ms` : configured ? "Not verified" : "Not connected"}</strong><small>{status?.connection.relayUrl || "No community URL saved"}</small></article>
      <article><span>Human Profile identity</span><strong>{identityConfigured ? "Configured in Profile" : "Not configured"}</strong><small>{identityConfigured ? "Private signer remains encrypted and profile-scoped." : "Create or connect it from Profile when Community access is needed."}</small></article>
      <article><span>Verified Buzz signer / profile</span><strong>{humanIdentityReady ? humanIdentity?.displayName : identityMismatch ? "Agent identity blocked" : identityVerified ? "Signer unresolved" : "Not verified"}</strong><small>{signerFingerprint || "No verified Human public identity available"}</small></article>
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
      <div><span>Runtime connection details</span><h2>{form.mode === "managed" ? "Managed local community" : "Your existing Buzz community"}</h2><p>Identity belongs in Profile. Settings stores only the BUZZ community/runtime information needed to reach the network and local CLI.</p></div>
      <div className={styles.formGrid}>
        <label><span>Buzz community WebSocket address</span><input value={form.relayUrl} disabled={form.mode === "managed"} onChange={(event) => patch({ relayUrl: event.target.value })} placeholder="wss://plotpickleplayhouse.communities.buzz.xyz" /><small>Copy the complete wss:// address beside your community on Buzz&apos;s Communities page.</small></label>
        <label><span>Community name (optional)</span><input value={form.community} onChange={(event) => patch({ community: event.target.value })} placeholder="plotpickleplayhouse" /><small>A friendly runtime label in PlotPickle; it does not create or rename the Buzz community.</small></label>
      </div>
      <details className={styles.advancedField}>
        <summary>Advanced: Buzz CLI path</summary>
        <label><span>Buzz CLI path (optional)</span><input value={form.cliPath} onChange={(event) => patch({ cliPath: event.target.value })} placeholder="Leave blank to use Buzz Desktop automatically" /><small>Buzz Desktop includes the supported CLI sidecar. Leave this blank unless automatic detection fails.</small></label>
      </details>
    </section>

    <section className={styles.actions}>
      <button type="button" disabled={blocked || !form.relayUrl.trim()} onClick={() => void saveRuntime()}>{busy === "save" ? "Saving runtime…" : "Save Buzz runtime"}</button>
      <button type="button" disabled={!configured || !identityConfigured || blocked} onClick={() => void run("test", () => request("/test", { method: "POST" }))}>{busy === "test" ? "Testing…" : "Test Buzz connection"}</button>
      <button type="button" disabled={blocked} onClick={() => void run("refresh", async () => { await refresh(true); return { message: "Buzz status refreshed." }; })}>Refresh status</button>
      <button type="button" disabled={blocked} onClick={openProfile}>Open Profile</button>
      {storyRoomReady ? <a href="/buzz">Open Story Room</a> : <button type="button" disabled title="Connect a verified Human BUZZ identity in Profile before opening the live Story Room.">Story Room not ready</button>}
      {openInBuzzUrl ? <a href={openInBuzzUrl}>Open this community in Buzz Desktop</a> : null}
    </section>

    {configured && reachable && (!cliAvailable || !humanIdentityReady) ? <section className={styles.boundary}><span>One step remains</span><h2>{identityMismatch ? "The connected signer is an agent, not the Human Community identity." : "The community address works, but the Human BUZZ identity is not ready yet."}</h2><p>{identityMismatch ? "Open Profile and connect your Human BUZZ identity. Sage and the other PlotPickle agents keep their own identities and routes. " : !cliAvailable ? "Open Buzz Desktop or select its supported CLI. " : !identityConfigured ? "Open Profile and choose Create BUZZ Identity or Connect Existing Identity. " : !identityVerified ? "Use Profile to verify and publish the configured Human identity, then test the runtime here. " : "The signing key was verified but its Human profile could not be resolved. "}Settings never asks for or displays the private signer.</p></section> : null}

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

    <section className={styles.boundary}><span>Authority boundary</span><h2>Discussion does not become canon by itself.</h2><p>Buzz messages can be linked to story entities and converted into local proposals. Only an explicit Human approval applies a selected proposal to the active PPF project.</p><ul><li>No Buzz service starts when PlotPickle is installed.</li><li>Human BUZZ identity creation, connection and presentation happen only in Profile; Settings never exposes the private signer.</li><li>Removing or changing Buzz runtime infrastructure never changes PlotPickle project canon.</li></ul></section>
    {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
  </div>;
}