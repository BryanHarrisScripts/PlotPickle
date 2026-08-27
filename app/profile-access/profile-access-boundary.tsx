"use client";

import { FormEvent, ReactNode, useCallback, useEffect, useState } from "react";
import { createEmptyProject } from "@/core/project/project";
import {
  saveFoundationProject,
} from "@/core/storage/foundation-project-browser";
import { PROJECT_LIBRARY_ACTIVE_PROFILE_KEY } from "@/core/storage/project-library-browser";
import { PROJECT_LIBRARY_CHANGED_EVENT } from "@/core/storage/project-library-browser";
import {
  clearProfilePrivateBrowser,
  flushProfilePrivateWrites,
  hydrateProfilePrivateBrowser,
  migrateLegacyBrowserProjects,
  persistActiveProfileProject,
} from "@/core/storage/profile-private-browser";
import styles from "./profile-access-boundary.module.css";

type Profile = { readonly profileId: string; readonly displayName: string; readonly avatarRef: string | null; readonly status: string };
type Status = {
  readonly configured: boolean;
  readonly authenticated: boolean;
  readonly accessMode: "desktop-loopback" | "server-network";
  readonly profiles: readonly Profile[];
  readonly profile: Profile | null;
  readonly csrfToken: string | null;
  readonly serverReady: boolean;
  readonly readinessReasons: readonly string[];
};
type Screen = "loading" | "chooser" | "login" | "create" | "recovery" | "guest" | "ready" | "server-unavailable";
type Recovery = { readonly profile: Profile; readonly secret: string; readonly password: string; readonly guestDraft: string; readonly migrateLegacyBrowser: boolean };

async function profileRequest(action: string, payload: Record<string, unknown> = {}, csrfToken?: string | null) {
  const result = await fetch("/api/auth/profile", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...(csrfToken ? { "X-PlotPickle-CSRF": csrfToken } : {}) },
    body: JSON.stringify({ action, ...payload }),
  });
  const body = await result.json() as Record<string, unknown>;
  if (!result.ok) throw new Error(typeof body.message === "string" ? body.message : "The profile action could not be completed.");
  return body;
}

function clearPrivateScreen() {
  clearProfilePrivateBrowser();
  window.localStorage.removeItem(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY);
  document.title = "PlotPickle — Profile locked";
  window.history.replaceState({ profileBoundary: "locked" }, "", "/");
}

function saveGuestDraft(profileId: string, draft: string) {
  const content = draft.trim();
  if (!content) return;
  window.sessionStorage.setItem(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY, profileId);
  const now = new Date().toISOString();
  const project = createEmptyProject({ id: globalThis.crypto.randomUUID(), now, title: "Guest Draft" });
  saveFoundationProject({ ...project, foundations: { ...project.foundations, brief: { content, savedAt: now } } });
}

function lockedScreen(next: Status): Screen {
  if (next.accessMode === "server-network") {
    if (!next.serverReady) return "server-unavailable";
    return next.configured ? "login" : "create";
  }
  return next.configured ? "chooser" : "create";
}

function PasswordField({ value, onChange, purpose = "current", confirm = false }: { readonly value: string; readonly onChange: (value: string) => void; readonly purpose?: "current" | "new"; readonly confirm?: boolean }) {
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  return (
    <label className={styles.field}>
      <span>{confirm ? "Confirm passphrase" : "Password or passphrase"}</span>
      <div className={styles.passwordRow}>
        <input
          type={visible ? "text" : "password"}
          autoComplete={`${purpose}-password`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyUp={(event) => setCapsLock(event.getModifierState("CapsLock"))}
          required
        />
        <button type="button" onClick={() => setVisible((current) => !current)}>{visible ? "Hide" : "Show"}</button>
      </div>
      {capsLock ? <small role="status">Caps Lock is on.</small> : null}
    </label>
  );
}

export default function ProfileAccessBoundary({ children }: { readonly children: ReactNode }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [screen, setScreen] = useState<Screen>("loading");
  const [selected, setSelected] = useState<Profile | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [bootstrapProof, setBootstrapProof] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState<Recovery | null>(null);
  const [recoverySaved, setRecoverySaved] = useState(false);
  const [guestDraft, setGuestDraft] = useState("");
  const [addingProfile, setAddingProfile] = useState(false);

  const refresh = useCallback(async () => {
    const result = await fetch("/api/auth/profile", { credentials: "same-origin", cache: "no-store" });
    const next = await result.json() as Status;
    if (!result.ok) throw new Error("The local profile service is unavailable.");
    setStatus(next);
    if (next.authenticated && next.profile) {
      await hydrateProfilePrivateBrowser(next.profile.profileId, next.csrfToken || "");
      document.title = "PlotPickle - AI-native Visual Writing and Creative Direction";
      setScreen("ready");
    } else {
      setScreen(lockedScreen(next));
    }
  }, []);

  useEffect(() => {
    const start = window.setTimeout(() => void refresh().catch((cause) => { setError(String(cause)); setScreen("server-unavailable"); }), 0);
    return () => window.clearTimeout(start);
  }, [refresh]);
  useEffect(() => {
    const persist = () => void persistActiveProfileProject().catch(() => undefined);
    window.addEventListener(PROJECT_LIBRARY_CHANGED_EVENT, persist);
    return () => window.removeEventListener(PROJECT_LIBRARY_CHANGED_EVENT, persist);
  }, []);
  useEffect(() => {
    if (screen !== "ready") return;
    const heartbeat = window.setInterval(() => {
      void fetch("/api/auth/profile", { credentials: "same-origin", cache: "no-store" })
        .then((result) => result.json() as Promise<Status>)
        .then((next) => {
          if (next.authenticated) { setStatus(next); return; }
          clearPrivateScreen(); setStatus(next); setSelected(null); setBootstrapProof("");
          setScreen(lockedScreen(next));
        })
        .catch(() => undefined);
    }, 30_000);
    return () => window.clearInterval(heartbeat);
  }, [screen]);
  useEffect(() => {
    const handleAction = (event: Event) => {
      const action = (event as CustomEvent<string>).detail;
      if (action === "add-profile") { setAddingProfile(true); setName(""); setPassword(""); setConfirmation(""); setBootstrapProof(""); setScreen("create"); return; }
      if (action === "lock" || action === "logout" || action === "switch-profile") void leave(action);
    };
    window.addEventListener("plotpickle:profile-action", handleAction);
    return () => window.removeEventListener("plotpickle:profile-action", handleAction);
  });

  async function signIn(event?: FormEvent) {
    event?.preventDefault();
    setBusy(true); setError("");
    try {
      const locator = selected?.profileId || name;
      const result = await profileRequest("login", { locator, password });
      const profile = result.profile as Profile;
      const token = String(result.csrfToken || "");
      if (status?.accessMode === "desktop-loopback" && status.profiles.length === 1) await migrateLegacyBrowserProjects(token);
      window.sessionStorage.setItem(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY, profile.profileId);
      if (recovery?.guestDraft) saveGuestDraft(profile.profileId, recovery.guestDraft);
      setPassword(""); setConfirmation(""); setBootstrapProof(""); setRecovery(null); setGuestDraft(""); setAddingProfile(false);
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  }

  async function createProfile(event: FormEvent) {
    event.preventDefault(); setError("");
    if (password !== confirmation) { setError("The passphrases do not match."); return; }
    if (password.length < 12 || /^\d+$/u.test(password)) { setError("Use at least 12 characters; a numeric PIN cannot protect the vault by itself."); return; }
    const creatingFirstProfile = status?.configured === false;
    const firstServerProfile = status?.accessMode === "server-network" && creatingFirstProfile;
    const firstDesktopProfile = status?.accessMode === "desktop-loopback" && creatingFirstProfile;
    if (firstServerProfile && !bootstrapProof.trim()) { setError("The one-time server bootstrap proof is required for the first Human profile."); return; }
    setBusy(true);
    try {
      const action = status?.configured ? "create-profile" : "create-first-profile";
      const result = await profileRequest(action, {
        displayName: name.trim(),
        password,
        ...(firstServerProfile ? { bootstrapProof: bootstrapProof.trim() } : {}),
      }, status?.csrfToken);
      setBootstrapProof("");
      setRecovery({ profile: result.profile as Profile, secret: String(result.recoverySecret), password, guestDraft, migrateLegacyBrowser: firstDesktopProfile });
      setRecoverySaved(false); setScreen("recovery");
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  }

  async function finishRecovery() {
    if (!recovery || !recoverySaved) return;
    setBusy(true); setError("");
    try {
      const result = await profileRequest("login", { locator: recovery.profile.profileId, password: recovery.password });
      const profile = result.profile as Profile;
      const token = String(result.csrfToken || "");
      if (recovery.migrateLegacyBrowser) await migrateLegacyBrowserProjects(token);
      window.sessionStorage.setItem(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY, profile.profileId);
      if (recovery.guestDraft) saveGuestDraft(profile.profileId, recovery.guestDraft);
      setPassword(""); setConfirmation(""); setBootstrapProof(""); setRecovery(null); setGuestDraft(""); setAddingProfile(false);
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  }

  async function leave(action: "lock" | "logout" | "switch-profile") {
    if (!status?.csrfToken) return;
    setBusy(true); setError("");
    try {
      await persistActiveProfileProject();
      await flushProfilePrivateWrites();
      await profileRequest(action, {}, status.csrfToken);
      clearPrivateScreen(); setStatus(null); setSelected(null); setBootstrapProof(""); setScreen("loading");
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setBusy(false); }
  }

  if (screen === "ready" && status?.profile) {
    return <><div className={styles.activeHuman} aria-label="Active PlotPickle Human"><div><span>Human</span><strong>{status.profile.displayName}</strong><small>BUZZ identity is separate</small></div><details><summary>Profile</summary><button type="button" onClick={() => { setAddingProfile(true); setName(""); setPassword(""); setConfirmation(""); setBootstrapProof(""); setScreen("create"); }}>Add profile</button><button type="button" onClick={() => void leave("lock")}>Lock</button><button type="button" onClick={() => void leave("switch-profile")}>Switch profile</button><button type="button" onClick={() => void leave("logout")}>Log out</button></details></div>{children}</>;
  }

  if (screen === "guest") {
    return <main className={styles.boundary} data-profile-access-boundary="locked"><section className={styles.card}><p className={styles.eyebrow}>Isolated Guest</p><h1>Temporary writing space</h1><p>Guest cannot see Human profiles, projects, recent items, credentials, agents, or BUZZ identities. This draft exists only until you leave this screen.</p><label className={styles.field}><span>Guest story notes</span><textarea value={guestDraft} onChange={(event) => setGuestDraft(event.target.value)} rows={12} autoFocus /></label><div className={styles.actions}><button type="button" onClick={() => { setAddingProfile(true); setName(""); setPassword(""); setConfirmation(""); setBootstrapProof(""); setScreen("create"); }}>Save as new profile</button><button type="button" onClick={() => { setGuestDraft(""); setScreen("chooser"); }}>Delete Guest work and exit</button></div></section></main>;
  }

  if (screen === "recovery" && recovery) {
    return <main className={styles.boundary} data-profile-access-boundary="locked"><section className={styles.card}><p className={styles.eyebrow}>Recovery</p><h1>Save your recovery secret</h1><p>PlotPickle shows this once and does not keep a hidden copy. It is never uploaded to BUZZ, cloud providers, GitHub, diagnostics, or support reports.</p><output className={styles.recovery}>{recovery.secret}</output><div className={styles.actions}><button type="button" onClick={() => void navigator.clipboard.writeText(recovery.secret)}>Copy deliberately</button><a download="plotpickle-recovery.txt" href={`data:text/plain;charset=utf-8,${encodeURIComponent(recovery.secret)}`}>Save recovery file</a></div><label className={styles.check}><input type="checkbox" checked={recoverySaved} onChange={(event) => setRecoverySaved(event.target.checked)} /><span>I saved the recovery secret somewhere safe.</span></label><button type="button" disabled={!recoverySaved || busy} onClick={() => void finishRecovery()}>Continue into PlotPickle</button>{error ? <p role="alert" className={styles.error}>{error}</p> : null}</section></main>;
  }

  if (screen === "create") {
    const firstServerProfile = status?.accessMode === "server-network" && status.configured === false;
    return <main className={styles.boundary} data-profile-access-boundary="locked"><section className={styles.card}><p className={styles.eyebrow}>{status?.configured ? "Add Human" : "Welcome to PlotPickle"}</p><h1>{status?.configured ? "Create another local profile" : firstServerProfile ? "Create the first PlotPickle profile" : "Create your local profile"}</h1><p>No email, phone, cloud account, Internet connection, BUZZ identity, GitHub, or Google login is required. This passphrase protects the encrypted Human profile and cannot be reset by email.</p><form onSubmit={createProfile}><label className={styles.field}><span>Name</span><input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" maxLength={120} required autoFocus /></label>{firstServerProfile ? <label className={styles.field}><span>Server bootstrap proof</span><input type="password" autoComplete="off" value={bootstrapProof} onChange={(event) => setBootstrapProof(event.target.value)} required /><small>This one-time operator proof prevents an exposed fresh server from being claimed by the first remote visitor. It is used only for first-profile creation.</small></label> : null}<PasswordField value={password} onChange={setPassword} purpose="new" /><PasswordField value={confirmation} onChange={setConfirmation} purpose="new" confirm /><small>Use a long, memorable passphrase. Password-manager paste and autofill are allowed; arbitrary symbol and uppercase rules are not imposed.</small>{error ? <p role="alert" className={styles.error}>{error}</p> : null}<div className={styles.actions}><button type="submit" disabled={busy}>{busy ? "Creating…" : "Create local profile"}</button>{status?.configured || addingProfile ? <button type="button" onClick={() => { setAddingProfile(false); setBootstrapProof(""); setScreen(status?.authenticated ? "ready" : "chooser"); }}>Cancel</button> : null}</div></form></section></main>;
  }

  if (screen === "login" && (selected || status?.accessMode === "server-network")) {
    return <main className={styles.boundary} data-profile-access-boundary="locked"><section className={styles.card}><p className={styles.eyebrow}>Local profile</p><h1>{selected ? `Unlock ${selected.displayName}` : "Sign in to PlotPickle"}</h1><p>Unlocking protects the selected Human’s private work. BUZZ remains an optional, separate identity.</p><form onSubmit={signIn}>{!selected ? <label className={styles.field}><span>Profile name</span><input value={name} onChange={(event) => setName(event.target.value)} autoComplete="username" required /></label> : null}<PasswordField value={password} onChange={setPassword} />{error ? <p role="alert" className={styles.error}>{error}</p> : null}<div className={styles.actions}><button type="submit" disabled={busy}>{busy ? "Unlocking…" : "Unlock profile"}</button><button type="button" onClick={() => { setPassword(""); setBootstrapProof(""); setError(""); setSelected(null); setScreen("chooser"); }}>Back</button></div></form></section></main>;
  }

  if (screen === "server-unavailable") {
    return <main className={styles.boundary} data-profile-access-boundary="locked"><section className={styles.card}><p className={styles.eyebrow}>Secure profile boundary</p><h1>PlotPickle login is not available yet</h1><p>The profile service must be ready before login can accept credentials. A server Node also requires HTTPS, host/origin allowlists, a bind address, and completed operator bootstrap configuration.</p>{status?.readinessReasons.length ? <p role="status">Readiness: {status.readinessReasons.join(", ")}</p> : null}{error ? <p role="alert" className={styles.error}>{error}</p> : null}</section></main>;
  }

  return <main className={styles.boundary} data-profile-access-boundary="locked"><section className={styles.card} aria-busy={screen === "loading"}><p className={styles.eyebrow}>PlotPickle profiles</p><h1>{screen === "loading" ? "Opening the local profile boundary…" : "Choose a PlotPickle profile"}</h1>{screen !== "loading" ? <><p>Profiles belong to this PlotPickle Node. The chooser shows only a safe name and optional avatar—never stories, activity, projects, agents, files, or BUZZ membership.</p><div className={styles.profileList}>{status?.profiles.filter((profile) => profile.status === "active").map((profile) => <button type="button" key={profile.profileId} onClick={() => { setSelected(profile); setPassword(""); setBootstrapProof(""); setError(""); setScreen("login"); }}><span aria-hidden="true">{profile.displayName.slice(0, 1).toUpperCase()}</span><strong>{profile.displayName}</strong><small>Locked</small></button>)}</div><div className={styles.actions}><button type="button" onClick={() => { setName(""); setPassword(""); setConfirmation(""); setBootstrapProof(""); setScreen("create"); }}>Add profile</button><button type="button" onClick={() => setScreen("guest")}>Use isolated Guest</button></div>{error ? <p role="alert" className={styles.error}>{error}</p> : null}</> : null}</section></main>;
}
