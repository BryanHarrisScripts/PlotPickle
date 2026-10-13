"use client";

import { useEffect, useState, type FormEvent } from "react";
import { PROJECT_LIBRARY_ACTIVE_PROFILE_KEY } from "../../../core/storage/project-library-browser";
import { refreshProfilePrivateBrowserSession } from "../../../core/storage/profile-private-browser";

type Status = {
  authenticated: boolean;
  profile: { profileId: string; displayName: string } | null;
  profiles: { profileId: string; displayName: string }[];
  csrfToken: string | null;
  sessionState: string;
  sessionIdleExpiresAt: string | null;
  sessionAbsoluteExpiresAt: string | null;
  profileDiagnostics: { profileId: string; vaultState: string; lastLockReason: string | null; lastLockAt: string | null }[];
};

async function readStatus(): Promise<Status> {
  const response = await fetch("/api/auth/profile", { credentials: "same-origin", cache: "no-store" });
  const body = await response.json();
  if (!response.ok) throw new Error(body.message || "Profile status could not be verified.");
  return body;
}

export default function ProfileSessionPanel({ onVerified, verifiedActionLabel = "provider setup" }: { readonly onVerified?: () => void | Promise<void>; readonly verifiedActionLabel?: string }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [profileId, setProfileId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let live = true;
    void readStatus().then(next => {
      if (!live) return;
      setStatus(next);
      setProfileId(next.profile?.profileId || window.sessionStorage.getItem(PROJECT_LIBRARY_ACTIVE_PROFILE_KEY)
        || (next.profiles.length === 1 ? next.profiles[0].profileId : ""));
    }).catch(cause => { if (live) setNotice(cause instanceof Error ? cause.message : "Profile status unavailable."); });
    return () => { live = false; };
  }, []);

  async function verify(unlock: boolean) {
    if (busy) return;
    setBusy(true); setNotice("");
    try {
      if (unlock) {
        if (!profileId) throw new Error("Use the normal profile logon gate to choose your working profile.");
        const response = await fetch("/api/auth/profile", {
          method: "POST", credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "login", locator: profileId, password }),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || "Profile unlock failed.");
      }
      const next = await readStatus();
      setStatus(next);
      if (!next.authenticated || !next.profile || !next.csrfToken
          || next.profile.profileId !== profileId
          || next.profileDiagnostics?.find(item => item.profileId === profileId)?.vaultState !== "unlocked") {
        throw new Error("Profile unlock and session refresh are not verified. Retry with your passphrase.");
      }
      await refreshProfilePrivateBrowserSession(profileId);
      await onVerified?.();
      setNotice(`Profile unlocked and session verified. You can retry ${verifiedActionLabel}.`);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Profile verification failed.");
      // Read back after rejection, without converting a failed refresh into success.
      try { setStatus(await readStatus()); } catch { setStatus(null); }
    } finally { setPassword(""); setBusy(false); }
  }

  const diagnostic = status?.profileDiagnostics?.find(item => item.profileId === profileId);
  return <section id="profile-session-status" aria-label="Profile status and unlock">
    <h3>Profile status and unlock</h3>
    <p>Profile: {status?.profile?.displayName || status?.profiles.find(item => item.profileId === profileId)?.displayName || "Unknown"} · Vault: {diagnostic?.vaultState || "Unknown"}</p>
    <p>Session: {status?.sessionState || "Unknown"}. A missing or expired session does not by itself mean the vault is locked.</p>
    <p>Last recorded lock reason: {diagnostic?.lastLockReason || "Unknown"}. Last recorded lock time: {diagnostic?.lastLockAt || "Unknown"}.</p>
    <p>Session idle expiry: {status?.sessionIdleExpiresAt || "Unknown"}. Absolute expiry: {status?.sessionAbsoluteExpiresAt || "Unknown"}.</p>
    <form onSubmit={(event: FormEvent) => { event.preventDefault(); void verify(true); }}>
      <label>Profile passphrase <input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required disabled={busy} /></label>
      <button type="submit" disabled={busy || !profileId}>Unlock and refresh session</button>
      <button type="button" disabled={busy} onClick={() => void verify(false)}>Verify session</button>
    </form>
    {notice ? <p role="status" aria-live="polite">{notice}</p> : null}
  </section>;
}
