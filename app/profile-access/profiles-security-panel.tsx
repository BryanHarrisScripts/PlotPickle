"use client";

import { FormEvent, useEffect, useState } from "react";
import styles from "./profiles-security-panel.module.css";

type Session = { readonly sessionRef: string; readonly current: boolean; readonly issuedAt: string; readonly lastSeenAt: string; readonly authStrength: string; readonly deviceLabel: string; readonly originLabel: string };
type Snapshot = { readonly profile: { readonly displayName: string } | null; readonly csrfToken: string | null; readonly sessions: readonly Session[] };

async function loadSnapshot() {
  const response = await fetch("/api/auth/profile", { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) throw new Error("Profile security status is unavailable.");
  return response.json() as Promise<Snapshot>;
}

export default function ProfilesSecurityPanel() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => { void loadSnapshot().then(setSnapshot).catch((error) => setNotice(String(error))); }, []);

  function requestProfileAction(action: string) {
    window.dispatchEvent(new CustomEvent("plotpickle:profile-action", { detail: action }));
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault(); setNotice("");
    const response = await fetch("/api/auth/profile", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-PlotPickle-CSRF": snapshot?.csrfToken || "" }, body: JSON.stringify({ action: "change-password", currentPassword, newPassword }) });
    const body = await response.json() as Record<string, unknown>;
    if (!response.ok) { setNotice(String(body.message || "The passphrase could not be changed.")); return; }
    setCurrentPassword(""); setNewPassword(""); setNotice("Passphrase changed. Other sessions were locked."); setSnapshot(await loadSnapshot());
  }

  async function revokeOthers() {
    const response = await fetch("/api/auth/profile", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "X-PlotPickle-CSRF": snapshot?.csrfToken || "" }, body: JSON.stringify({ action: "revoke-other-sessions" }) });
    const body = await response.json() as Record<string, unknown>;
    setNotice(response.ok ? `${Number(body.revoked || 0)} other session(s) locked.` : String(body.message || "Sessions could not be locked."));
    if (response.ok) setSnapshot(await loadSnapshot());
  }

  return <section className={styles.panel} aria-label="Profiles and security controls"><article><p>Current Human</p><h2>{snapshot?.profile?.displayName || "Loading…"}</h2><span>This local PlotPickle profile is separate from the Node, Sage, agents, and your optional BUZZ identity.</span><div><button type="button" onClick={() => requestProfileAction("lock")}>Lock</button><button type="button" onClick={() => requestProfileAction("switch-profile")}>Switch profile</button><button type="button" onClick={() => requestProfileAction("logout")}>Log out</button><button type="button" onClick={() => requestProfileAction("add-profile")}>Add profile</button></div></article><article><p>Passphrase</p><h2>Change the local vault passphrase</h2><form onSubmit={changePassword}><label>Current passphrase<input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></label><label>New passphrase<input type="password" autoComplete="new-password" minLength={12} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></label><button type="submit">Change passphrase</button></form></article><article><p>Recovery</p><h2>Recovery material created</h2><span>The secret is not displayed here or stored in plaintext. Recovery rotation requires the existing offline recovery secret and creates a replacement secret; PlotPickle has no email or operator reset.</span></article><article><p>Sessions</p><h2>{snapshot?.sessions.length || 0} browser session(s)</h2><ul>{snapshot?.sessions.map((session) => <li key={session.sessionRef}><strong>{session.current ? "This session" : session.deviceLabel}</strong><span>{session.originLabel} · {session.authStrength} · last active {new Date(session.lastSeenAt).toLocaleString()}</span></li>)}</ul><button type="button" onClick={() => void revokeOthers()}>Lock all other sessions</button></article>{notice ? <p role="status" className={styles.notice}>{notice}</p> : null}</section>;
}
