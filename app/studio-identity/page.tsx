"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./studio-identity.module.css";

const API = "/api/studio-identity";
const SUFFIX = "PlotPickle Studio";
type Identity = {
  configured: boolean; studioId?: string; prefix?: string; displayName?: string; shortCode?: string;
  createdAt?: string; renamedAt?: string; nextRenameAt?: string; canRename?: boolean;
  renameHistory?: Array<{ prefix: string; displayName: string; changedAt: string }>;
  signing?: { algorithm: string; publicKeyPem: string };
};

async function request(init?: RequestInit) {
  const response = await fetch(API, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  const body = await response.json() as Identity & { message?: string };
  if (!response.ok) throw new Error(body.message || "Studio identity could not be updated.");
  return body;
}

function date(value?: string) {
  if (!value) return "Not yet";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

export default function StudioIdentityPage() {
  const [identity, setIdentity] = useState<Identity>({ configured: false });
  const [prefix, setPrefix] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void request().then((value) => { setIdentity(value); setPrefix(value.prefix || ""); }).catch((error) => setNotice(error.message));
  }, []);

  const cleanPrefix = prefix.replace(/\s+/g, " ").trim();
  const preview = cleanPrefix ? `${cleanPrefix} ${SUFFIX}` : `Your Name ${SUFFIX}`;

  async function save() {
    setBusy(true); setNotice("");
    try {
      const action = identity.configured ? "rename" : "create";
      const next = await request({ method: "POST", body: JSON.stringify({ action, prefix: cleanPrefix }) });
      setIdentity(next); setPrefix(next.prefix || cleanPrefix);
      setNotice(identity.configured ? "Studio name updated. The permanent Studio ID and signing identity did not change." : "Studio identity created and encrypted for this computer account.");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Studio identity could not be saved."); }
    finally { setBusy(false); }
  }

  return <main className={styles.page}>
    <header className={styles.header}>
      <div><Link href="/?workspace=settings">Settings</Link> / <span>Studio Identity</span></div>
      <p>PlotPickle Playhouse</p>
      <h1>Name this PlotPickle Studio without tying its identity to the computer or the name.</h1>
      <span>Your permanent Studio ID and Ed25519 signing key are generated randomly and stored in PlotPickle&apos;s encrypted local credential store. They never belong in a PPF story project.</span>
    </header>

    <section className={styles.card}>
      <div className={styles.form}>
        <label><span>Studio name prefix</span><input value={prefix} maxLength={60} onChange={(event) => setPrefix(event.target.value)} placeholder="Barry's" disabled={busy || Boolean(identity.configured && !identity.canRename)} /></label>
        <div className={styles.preview}><small>Public name preview</small><strong>{preview}</strong><span>The suffix “{SUFFIX}” is reserved and added by PlotPickle.</span></div>
        <button type="button" onClick={() => void save()} disabled={busy || !cleanPrefix || Boolean(identity.configured && !identity.canRename)}>{busy ? "Saving…" : identity.configured ? "Rename Studio" : "Create Studio Identity"}</button>
        {identity.configured && !identity.canRename ? <p className={styles.cooldown}>Rename available again after {date(identity.nextRenameAt)}.</p> : null}
      </div>
    </section>

    {identity.configured ? <section className={styles.grid}>
      <article><span>Permanent identity</span><h2>{identity.studioId}</h2><p>Stable across renames, updates and normal restarts.</p></article>
      <article><span>Public disambiguator</span><h2>Studio {identity.shortCode}</h2><p>Used only when two Studios choose the same display name.</p></article>
      <article><span>Signing identity</span><h2>{identity.signing?.algorithm || "Ed25519"}</h2><p>Public key available to Playhouse federation. Private signing key never leaves encrypted local storage.</p></article>
    </section> : null}

    {identity.renameHistory?.length ? <section className={styles.history}><h2>Rename history</h2>{identity.renameHistory.map((item) => <article key={`${item.changedAt}-${item.displayName}`}><strong>{item.displayName}</strong><span>Changed {date(item.changedAt)}</span></article>)}</section> : null}

    {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
    <footer><Link href="/?workspace=community">Open Community</Link><Link href="/?workspace=settings">Back to Settings</Link></footer>
  </main>;
}
