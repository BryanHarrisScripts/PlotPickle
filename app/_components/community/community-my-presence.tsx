"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./community-my-presence.module.css";

const API = "/api/community-federation";

type Availability = "online" | "away" | "busy" | "offline";
type Visibility = "public" | "contacts" | "invisible";
type PresenceState = {
  identity?: {
    configured?: boolean;
    displayName?: string;
    studioId?: string;
  } | null;
  presence?: {
    availability?: Availability;
    visibility?: Visibility;
    announcedAt?: string;
    withdrawnAt?: string;
    lastTransportError?: string;
  } | null;
  message?: string;
  localCreativeWorkAvailable?: boolean;
};

function timeLabel(value: string | undefined) {
  if (!value) return "Not yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not yet" : date.toLocaleString();
}

export default function CommunityMyPresence() {
  const [state, setState] = useState<PresenceState | null>(null);
  const [availability, setAvailability] = useState<Availability>("online");
  const [visibility, setVisibility] = useState<Visibility>("contacts");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  const apply = useCallback((next: PresenceState) => {
    setState(next);
    setAvailability(next.presence?.availability || "online");
    setVisibility(next.presence?.visibility || "contacts");
  }, []);

  const refresh = useCallback(async (showNotice = false) => {
    const response = await fetch(API, { cache: "no-store", headers: { Accept: "application/json" } });
    const body = await response.json() as PresenceState;
    if (!response.ok) throw new Error(body.message || "Community presence could not be loaded.");
    apply(body);
    if (showNotice) setNotice(body.message || "Community presence is current.");
  }, [apply]);

  useEffect(() => {
    let cancelled = false;
    void fetch(API, { cache: "no-store", headers: { Accept: "application/json" } })
      .then(async (response) => {
        const body = await response.json() as PresenceState;
        if (!response.ok) throw new Error(body.message || "Community presence could not be loaded.");
        if (!cancelled) apply(body);
      })
      .catch((error) => { if (!cancelled) setNotice(error instanceof Error ? error.message : "Community presence could not be loaded."); });
    return () => { cancelled = true; };
  }, [apply]);

  async function run(action: "announce" | "withdraw") {
    setBusy(action);
    setNotice("");
    try {
      const response = await fetch(API, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ action, availability, visibility, publicRooms: ["great-hall"], agents: [] }),
      });
      const body = await response.json() as PresenceState;
      if (!response.ok) throw new Error(body.message || "Community presence could not be updated.");
      apply(body);
      setNotice(action === "announce"
        ? "Presence was signed and announced through BUZZ."
        : "Presence was withdrawn through BUZZ.");
    } catch (error) {
      const detail = error instanceof Error ? error.message : "BUZZ transport failed.";
      setNotice(`${detail} Local PlotPickle creative work remains available.`);
    } finally {
      setBusy("");
    }
  }

  const configured = state?.identity?.configured === true;

  return <section className={styles.card} aria-label="My Community Presence" data-community-presence-governed="true">
    <header className={styles.header}>
      <div>
        <span>My Presence</span>
        <h2>{configured ? (state?.identity?.displayName || "This PlotPickle Studio") : "Studio presence is not configured yet."}</h2>
        <p>Control how this Studio appears to other permitted PlotPickle Studios without leaving Community. Only the signed minimal presence envelope is announced through BUZZ.</p>
      </div>
      <button type="button" disabled={Boolean(busy)} onClick={() => void refresh(true)}>Refresh</button>
    </header>

    {configured ? <>
      <div className={styles.controls}>
        <label><span>Availability</span><select value={availability} disabled={Boolean(busy)} onChange={(event) => setAvailability(event.target.value as Availability)}><option value="online">Online</option><option value="away">Away</option><option value="busy">Busy</option><option value="offline">Offline</option></select></label>
        <label><span>Visibility</span><select value={visibility} disabled={Boolean(busy)} onChange={(event) => setVisibility(event.target.value as Visibility)}><option value="public">Public</option><option value="contacts">Contacts</option><option value="invisible">Invisible</option></select></label>
      </div>
      <div className={styles.actions}>
        <button type="button" disabled={Boolean(busy)} onClick={() => void run("announce")}>{busy === "announce" ? "Announcing…" : "Announce / update presence"}</button>
        <button type="button" disabled={Boolean(busy)} onClick={() => void run("withdraw")}>{busy === "withdraw" ? "Withdrawing…" : "Withdraw presence"}</button>
      </div>
      <dl className={styles.meta}>
        <div><dt>Last announced</dt><dd>{timeLabel(state?.presence?.announcedAt)}</dd></div>
        <div><dt>Last withdrawn</dt><dd>{timeLabel(state?.presence?.withdrawnAt)}</dd></div>
      </dl>
    </> : <p className={styles.empty}>A permanent Studio Identity is required before PlotPickle can sign Community presence. Community browsing remains available; no presence event is sent until the Studio identity exists.</p>}

    {state?.presence?.lastTransportError ? <p className={styles.transport}>Last transport issue: {state.presence.lastTransportError}</p> : null}
    {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
  </section>;
}
