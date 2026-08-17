"use client";

import { useEffect, useState } from "react";
import styles from "./connected-studios-panel.module.css";

type Studio = {
  studioId: string;
  displayName: string;
  shortCode: string;
  availability: "online" | "away" | "busy" | "offline";
  visibility: "public" | "contacts" | "invisible";
  publicRooms: string[];
  agents: string[];
  lastSeen: string;
  relationship: "public" | "contact";
  compatible: boolean;
};
type Directory = {
  ok: boolean;
  playhouseOnline: boolean;
  studios: Studio[];
  contacts: string[];
  blockedCount: number;
  reportCount: number;
  message: string;
  localCreativeWorkAvailable: boolean;
};

function when(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return date.toLocaleString();
}

export default function ConnectedStudiosPanel({ onOpenGreatHall }: { readonly onOpenGreatHall: () => void }) {
  const [directory, setDirectory] = useState<Directory | null>(null);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  async function refresh(showNotice = false) {
    const response = await fetch("/api/playhouse-directory", { headers: { Accept: "application/json" } });
    const body = await response.json() as Directory & { message?: string };
    if (!response.ok) throw new Error(body.message || "Connected Studios could not be loaded.");
    setDirectory(body);
    if (showNotice) setNotice(body.message);
    return body;
  }

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/playhouse-directory", { headers: { Accept: "application/json" } })
      .then(async (response) => {
        const body = await response.json() as Directory & { message?: string };
        if (!response.ok) throw new Error(body.message || "Connected Studios could not be loaded.");
        if (!cancelled) setDirectory(body);
      })
      .catch((error) => { if (!cancelled) setNotice(error instanceof Error ? error.message : "Connected Studios could not be loaded."); });
    return () => { cancelled = true; };
  }, []);

  async function act(action: "contact" | "remove-contact" | "block" | "report", studio: Studio) {
    setBusy(`${action}:${studio.studioId}`);
    setNotice("");
    try {
      const response = await fetch("/api/playhouse-directory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, studioId: studio.studioId, reason: action === "report" ? "Reported from Connected Studios" : undefined }),
      });
      const body = await response.json() as Directory & { message?: string };
      if (!response.ok) throw new Error(body.message || "That Playhouse action could not be completed.");
      setDirectory(body);
      if (action === "block") setSelected("");
      setNotice(action === "contact"
        ? `${studio.displayName} is now an approved Studio contact.`
        : action === "remove-contact"
          ? `${studio.displayName} was removed from approved Studio contacts.`
          : action === "block"
            ? `${studio.displayName} was blocked by permanent Studio ID. Renaming will not bypass the block.`
            : `A moderation report was saved with ${studio.displayName} and its permanent Studio ID.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "That Playhouse action could not be completed.");
    } finally { setBusy(""); }
  }

  const studios = directory?.studios ?? [];

  return <div className={styles.wrap}>
    <section className={styles.heading}>
      <div>
        <span>Connected Studios</span>
        <h2>Find the PlotPickle Studios you are permitted to see.</h2>
        <p>This is a community directory, not a server list. BUZZ carries signed presence; private local PlotPickle services remain private.</p>
      </div>
      <button type="button" disabled={Boolean(busy)} onClick={() => void refresh(true)}>Refresh Studios</button>
    </section>

    <section className={styles.networkState} data-online={directory?.playhouseOnline ? "true" : "false"} role="status">
      <i aria-hidden="true" />
      <div>
        <strong>{directory?.playhouseOnline ? "Playhouse discovery online" : "Playhouse discovery offline"}</strong>
        <p>{directory?.message || "Checking permitted Studio presence…"}</p>
      </div>
      {!directory?.playhouseOnline ? <a href="/playhouse-presence">Check my Playhouse presence</a> : null}
    </section>

    {studios.length ? <section className={styles.grid} aria-label="Permitted PlotPickle Studios">
      {studios.map((studio) => {
        const open = selected === studio.studioId;
        const working = busy.endsWith(studio.studioId);
        return <article key={studio.studioId} className={styles.card} data-presence={studio.availability}>
          <header>
            <img src="/assets/workflow-relics/community.svg" alt="" aria-hidden="true" />
            <div><strong>{studio.displayName}</strong><small>Studio {studio.shortCode} · {studio.relationship === "contact" ? "Contact" : "Public"}</small></div>
            <span>{studio.availability}</span>
          </header>
          <p>Last seen {when(studio.lastSeen)}</p>
          <div className={styles.actions}>
            <button type="button" onClick={() => setSelected(open ? "" : studio.studioId)}>{open ? "Close Studio" : "Open Studio"}</button>
            {studio.publicRooms.includes("great-hall") ? <button type="button" onClick={onOpenGreatHall}>Visit Great Hall</button> : null}
          </div>
          {open ? <div className={styles.details}>
            <p><b>Public rooms</b><span>{studio.publicRooms.length ? studio.publicRooms.map((room) => room.replace(/-/g, " ")).join(" · ") : "No public rooms advertised"}</span></p>
            <p><b>Available agents</b><span>{studio.agents.length ? studio.agents.join(" · ") : "No agents shared"}</span></p>
            <p><b>Compatibility</b><span>{studio.compatible ? "Ready for this Playhouse protocol" : "Compatibility needs attention"}</span></p>
            <div className={styles.moderation}>
              <button type="button" disabled={working} onClick={() => void act(studio.relationship === "contact" ? "remove-contact" : "contact", studio)}>{studio.relationship === "contact" ? "Remove Contact" : "Add to Contacts"}</button>
              <button type="button" disabled={working} onClick={() => void act("block", studio)}>Block</button>
              <button type="button" disabled={working} onClick={() => void act("report", studio)}>Report</button>
            </div>
            <small>Block and report attach to the permanent Studio ID, not this changeable display name.</small>
          </div> : null}
        </article>;
      })}
    </section> : directory?.playhouseOnline ? <section className={styles.empty}><h3>No permitted Studios are visible right now.</h3><p>Invisible Studios never appear here. Contacts/Guilds Studios appear only after this Studio has an approved relationship with their permanent Studio ID.</p><a href="/playhouse-presence">Review my visibility</a></section> : null}

    {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
  </div>;
}
