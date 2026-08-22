"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  BUZZ_IDENTITY_ONBOARDING_URL,
  DEFAULT_HUMAN_LORE_GLYPH,
  PLOTPICKLE_BUZZ_COMMUNITY,
} from "../../lib/buzz-default-community";
import styles from "./profile-identity-panel.module.css";

type Profile = { readonly profileId: string; readonly displayName: string; readonly avatarRef: string | null; readonly status: string };
type Presentation = { displayName: string; avatarUrl: string; publicBio: string };
type BuzzIdentity = {
  ready: boolean;
  identityVerified: boolean;
  humanCommunityAllowed: boolean;
  pubkey: string;
  displayName: string;
  nip05?: string;
  picture?: string;
  about?: string;
  kind: "human" | "agent" | "unknown";
  message: string;
};
type BuzzStatus = {
  connection?: {
    configured?: boolean;
    relayUrl?: string;
    community?: string;
    identityConfigured?: boolean;
    identityVerified?: boolean;
  };
};
type SetupMode = "connect" | null;

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "same-origin",
    cache: "no-store",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(body.message || `Request failed with ${response.status}.`);
  return body;
}

function shortKey(value: string) {
  const key = value.trim();
  if (!key) return "";
  return key.length <= 24 ? key : `${key.slice(0, 12)}…${key.slice(-10)}`;
}

export default function ProfileIdentityPanel({
  profile,
  csrfToken,
  onProfileChanged,
  onAddProfile,
  onLock,
  onSwitchProfile,
  onLogout,
}: {
  readonly profile: Profile;
  readonly csrfToken: string;
  readonly onProfileChanged: () => Promise<void>;
  readonly onAddProfile: () => void;
  readonly onLock: () => void;
  readonly onSwitchProfile: () => void;
  readonly onLogout: () => void;
}) {
  const [presentation, setPresentation] = useState<Presentation>({ displayName: profile.displayName, avatarUrl: "", publicBio: "" });
  const [buzz, setBuzz] = useState<BuzzIdentity | null>(null);
  const [buzzStatus, setBuzzStatus] = useState<BuzzStatus | null>(null);
  const [setupMode, setSetupMode] = useState<SetupMode>(null);
  const [privateKey, setPrivateKey] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");

  const refresh = useCallback(async () => {
    const [profileBody, identityBody, statusBody] = await Promise.all([
      jsonRequest<{ profile: Presentation }>("/api/auth/profile-presentation"),
      jsonRequest<BuzzIdentity & { ok: true }>("/api/local-buzz/human-identity").catch(() => null),
      jsonRequest<BuzzStatus & { ok: true }>("/api/local-buzz/status").catch(() => null),
    ]);
    setPresentation(profileBody.profile);
    setBuzz(identityBody);
    setBuzzStatus(statusBody);
  }, []);

  useEffect(() => {
    void refresh().catch((cause) => setNotice(cause instanceof Error ? cause.message : "Profile details could not be loaded."));
  }, [refresh]);

  async function publishToBuzz(next: Presentation) {
    return jsonRequest<{ ok: true; message?: string; identity?: BuzzIdentity }>("/api/local-buzz/human-identity", {
      method: "POST",
      headers: { "X-PlotPickle-CSRF": csrfToken },
      body: JSON.stringify({
        action: "publish-profile",
        displayName: next.displayName,
        avatarUrl: next.avatarUrl,
        publicBio: next.publicBio,
      }),
    });
  }

  async function savePresentation(event: FormEvent) {
    event.preventDefault();
    setBusy("profile"); setNotice("");
    try {
      const result = await jsonRequest<{ profile: Presentation; localSaved: true }>("/api/auth/profile-presentation", {
        method: "POST",
        headers: { "X-PlotPickle-CSRF": csrfToken },
        body: JSON.stringify({ action: "update", ...presentation }),
      });
      setPresentation(result.profile);
      await onProfileChanged();
      if (buzzStatus?.connection?.identityConfigured) {
        try {
          const published = await publishToBuzz(result.profile);
          setNotice(published.message || "Profile saved locally and published to BUZZ.");
        } catch {
          setNotice("Profile saved locally. BUZZ publication is unavailable right now; your local Profile was not rolled back.");
        }
      } else {
        setNotice("Profile saved locally.");
      }
      await refresh();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "Profile could not be saved.");
    } finally { setBusy(""); }
  }

  async function finishBuzzSetup() {
    setBusy("import"); setNotice("");
    try {
      const body = await jsonRequest<{ ok: true; message?: string; communityReady?: boolean; identity?: BuzzIdentity }>("/api/local-buzz/human-identity", {
        method: "POST",
        headers: { "X-PlotPickle-CSRF": csrfToken },
        body: JSON.stringify({
          action: "import",
          relayUrl: PLOTPICKLE_BUZZ_COMMUNITY.relayUrl,
          privateKey: privateKey.trim(),
          displayName: presentation.displayName,
        }),
      });
      setPrivateKey("");
      setSetupMode(null);
      if (body.communityReady === false) {
        setNotice(body.message || `BUZZ identity connected. ${PLOTPICKLE_BUZZ_COMMUNITY.displayName} access is still pending.`);
        await refresh();
        return;
      }
      try {
        const published = await publishToBuzz(presentation);
        setNotice(published.message || `BUZZ identity connected to ${PLOTPICKLE_BUZZ_COMMUNITY.displayName} and your Profile was published.`);
      } catch (cause) {
        setNotice(`${body.message || "BUZZ identity saved securely."} ${cause instanceof Error ? cause.message : "Profile publication is still pending."}`.trim());
      }
      await refresh();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "BUZZ identity setup failed.");
    } finally { setBusy(""); }
  }

  async function disconnectBuzz() {
    setBusy("disconnect"); setNotice("");
    try {
      const result = await jsonRequest<{ ok: true; message?: string }>("/api/local-buzz/human-identity", {
        method: "POST",
        headers: { "X-PlotPickle-CSRF": csrfToken },
        body: JSON.stringify({ action: "disconnect" }),
      });
      setSetupMode(null);
      setNotice(result.message || "BUZZ identity disconnected from this Human profile.");
      await refresh();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : "BUZZ identity could not be disconnected.");
    } finally { setBusy(""); }
  }

  const identityConfigured = Boolean(buzzStatus?.connection?.identityConfigured);
  const connected = Boolean(buzz?.humanCommunityAllowed && buzz.identityVerified && buzz.kind === "human");
  const identityLabel = connected ? "Connected" : identityConfigured ? "Connected · Community access pending" : "Not configured";

  return (
    <div className={styles.profileColumns} data-profile-identity-surface="v1">
      <section className={styles.identityColumn} aria-labelledby="profile-identity-heading">
        <header><span>Identity</span><h2 id="profile-identity-heading">Your Profile</h2><p>One Human profile for PlotPickle and, when connected, your public BUZZ presence.</p></header>

        <div className={styles.avatarRow}>
          {presentation.avatarUrl ? <img src={presentation.avatarUrl} alt="Current profile avatar" /> : <div aria-hidden="true" data-default-lore-glyph="true">{DEFAULT_HUMAN_LORE_GLYPH}</div>}
          <span><strong>{presentation.displayName}</strong><small>{presentation.publicBio || "Add a short public bio if you want one."}</small></span>
        </div>

        <form className={styles.identityForm} onSubmit={savePresentation}>
          <label><span>Display name</span><input value={presentation.displayName} maxLength={120} required onChange={(event) => setPresentation((current) => ({ ...current, displayName: event.target.value }))} /></label>
          <label><span>Avatar</span><input type="url" inputMode="url" placeholder="https://…" value={presentation.avatarUrl} onChange={(event) => setPresentation((current) => ({ ...current, avatarUrl: event.target.value }))} /><small>Leave blank to use the PlotPickle lore glyph. A custom secure image is published to BUZZ when connected.</small></label>
          <label><span>Public bio / description</span><textarea rows={3} maxLength={500} value={presentation.publicBio} onChange={(event) => setPresentation((current) => ({ ...current, publicBio: event.target.value }))} /><small>{presentation.publicBio.length}/500 · The same bio is published to BUZZ when connected.</small></label>
          <button type="submit" disabled={Boolean(busy)}>{busy === "profile" ? "Saving…" : "Save Profile"}</button>
        </form>

        <section className={styles.buzzCard} aria-labelledby="profile-buzz-heading">
          <div className={styles.buzzHeading}><span><b id="profile-buzz-heading">BUZZ Identity</b><small>{identityLabel}</small></span><i data-connected={connected ? "true" : "false"} aria-hidden="true" /></div>

          {connected ? <>
            <p>{buzz?.displayName ? `Signed Community identity verified as ${buzz.displayName}.` : "Your Human BUZZ identity is verified."}</p>
            <p><small>Default community: {PLOTPICKLE_BUZZ_COMMUNITY.displayName} · always connected</small></p>
            <details><summary>View identity details</summary><dl><div><dt>Public key</dt><dd>{shortKey(buzz?.pubkey || "") || "Unavailable"}</dd></div>{buzz?.nip05 ? <div><dt>NIP-05</dt><dd>{buzz.nip05}</dd></div> : null}</dl></details>
            <div className={styles.buzzActions}><button type="button" disabled={Boolean(busy)} onClick={() => void publishToBuzz(presentation).then(() => refresh()).then(() => setNotice("Profile published to BUZZ.")).catch((cause) => setNotice(cause instanceof Error ? cause.message : "BUZZ publication failed."))}>Publish Profile now</button><button type="button" disabled={Boolean(busy)} onClick={() => void disconnectBuzz()}>Disconnect identity</button></div>
          </> : identityConfigured ? <>
            <p>{buzz?.message || "The private signer is encrypted for this Human profile. BUZZ verification still needs the default Community to be reachable."}</p>
            <div className={styles.buzzActions}><button type="button" disabled={Boolean(busy)} onClick={() => void publishToBuzz(presentation).then(() => refresh()).then(() => setNotice("BUZZ identity verified and Profile published.")).catch((cause) => setNotice(cause instanceof Error ? cause.message : "BUZZ verification is still pending."))}>Verify & publish</button><button type="button" disabled={Boolean(busy)} onClick={() => setSetupMode("connect")}>Replace identity</button><button type="button" disabled={Boolean(busy)} onClick={() => void disconnectBuzz()}>Disconnect</button></div>
          </> : <>
            <p>BUZZ is optional. PlotPickle Playhouse is the built-in Community connection; connect a Human BUZZ identity when you want people, presence and signed conversation.</p>
            <div className={styles.buzzActions} data-buzz-setup-choices="true"><a href={BUZZ_IDENTITY_ONBOARDING_URL} target="_blank" rel="noreferrer">Get BUZZ Identity</a><button type="button" onClick={() => setSetupMode("connect")}>Connect Existing Identity</button><button type="button" onClick={() => { setSetupMode(null); setNotice("BUZZ remains unconfigured. PlotPickle continues normally."); }}>Not Now</button></div>
            <small>BUZZ creates and owns the identity. Return here afterward and connect the identity you created there.</small>
          </>}

          {setupMode ? <div className={styles.buzzSetup}>
            <h3>Connect Existing Identity</h3>
            <p>Paste the private key for the BUZZ identity you already own. PlotPickle validates the signer locally, stores it securely for this Human, then checks access to PlotPickle Playhouse.</p>
            <div data-buzz-default-community="true"><strong>{PLOTPICKLE_BUZZ_COMMUNITY.displayName}</strong><br /><small>{PLOTPICKLE_BUZZ_COMMUNITY.relayUrl} · required connection</small></div>
            <label><span>Private identity key</span><input type="password" autoComplete="off" value={privateKey} placeholder="nsec1… or 64-character key" onChange={(event) => setPrivateKey(event.target.value)} /></label>
            <div className={styles.buzzActions}><button type="button" disabled={Boolean(busy) || !privateKey.trim()} onClick={() => void finishBuzzSetup()}>{busy === "import" ? "Working…" : "Connect identity"}</button><button type="button" disabled={Boolean(busy)} onClick={() => { setSetupMode(null); setPrivateKey(""); }}>Cancel</button></div>
          </div> : null}
        </section>
      </section>

      <section className={styles.actionColumn} aria-labelledby="profile-access-heading">
        <header><span>Access</span><h2 id="profile-access-heading">Security</h2><p>These controls affect only the authenticated PlotPickle Human profile.</p></header>
        <button type="button" disabled={Boolean(busy)} onClick={onLock}>Lock</button>
        <button type="button" disabled={Boolean(busy)} onClick={onSwitchProfile}>Switch profile</button>
      </section>

      <section className={styles.actionColumn} aria-labelledby="profile-actions-heading">
        <header><span>Profile actions</span><h2 id="profile-actions-heading">Profile</h2><p>Create another Human or leave this authenticated session.</p></header>
        <button type="button" disabled={Boolean(busy)} onClick={onAddProfile}>Add profile</button>
        <button type="button" disabled={Boolean(busy)} onClick={onLogout}>Log out</button>
      </section>

      {notice ? <p className={styles.notice} role="status" aria-live="polite">{notice}</p> : null}
    </div>
  );
}
