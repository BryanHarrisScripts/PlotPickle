"use client";

import { useEffect, useState } from "react";
import styles from "./buzz-community-workspace.module.css";

const COMMUNITY_PORTAL_URL = "https://app.builderlab.xyz/buzz";
const PLOTPICKLE_SERVER_INVITE_URL = "https://plotpickleplayhouse.communities.buzz.xyz/invite/v2.tdZwBnmvMuZ_E3lh_cEjbo4qeJHdTvFogatjMfVgB-k";
const BUZZ_STATUS_API = "/api/local-buzz/status";

type BuzzCommunityStatus = {
  connection?: {
    configured?: boolean;
    relayUrl?: string;
    community?: string;
    identityVerified?: boolean;
  };
  cli?: { available?: boolean };
};

function buzzDesktopUrl(value: string, name: string) {
  try {
    const url = new URL(value);
    if (!["ws:", "wss:"].includes(url.protocol)) return "";
    url.hash = "";
    url.search = "";
    const query = new URLSearchParams({ relay: url.toString().replace(/\/$/, "") });
    if (name.trim()) query.set("name", name.trim());
    return `buzz://add-community?${query.toString()}`;
  } catch {
    return "";
  }
}

export default function BuzzCommunityWorkspace({ onOpenSettings }: { onOpenSettings: () => void }) {
  const [status, setStatus] = useState<BuzzCommunityStatus | null>(null);
  const [statusError, setStatusError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetch(BUZZ_STATUS_API, { headers: { Accept: "application/json" } })
      .then(async (response) => {
        if (!response.ok) throw new Error("Buzz status is unavailable.");
        return response.json() as Promise<BuzzCommunityStatus>;
      })
      .then((body) => { if (!cancelled) setStatus(body); })
      .catch((error) => { if (!cancelled) setStatusError(error instanceof Error ? error.message : "Buzz status is unavailable."); });
    return () => { cancelled = true; };
  }, []);

  const relayUrl = status?.connection?.relayUrl?.trim() || "";
  const communityName = status?.connection?.community?.trim() || "";
  const desktopUrl = buzzDesktopUrl(relayUrl, communityName);
  const desktopReady = Boolean(desktopUrl && status?.cli?.available);
  const verified = Boolean(status?.connection?.identityVerified);

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div>
          <p>Community</p>
          <h1>Your Buzz community, inside PlotPickle.</h1>
          <span>Create or manage the hosted community here, then open that same community in Buzz Desktop for channels, messages and huddles.</span>
        </div>
        <div className={styles.actions}>
          {desktopReady ? <a className={styles.primary} href={desktopUrl}>Open in Buzz Desktop</a> : <button type="button" className={styles.primary} disabled>Buzz Desktop needs setup</button>}
          <a href={COMMUNITY_PORTAL_URL} target="_blank" rel="noreferrer">Open in browser</a>
          <button type="button" onClick={onOpenSettings}>Writers’ Room setup</button>
        </div>
      </header>

      <section className={styles.communityChoices} aria-label="Choose a Buzz community path">
        <article className={styles.recommendedChoice}>
          <span>Fastest start</span>
          <h2>Join PlotPickleServer</h2>
          <p>Accept the PlotPickle Playhouse invitation and add its ready-made community to Buzz.</p>
          <a href={PLOTPICKLE_SERVER_INVITE_URL} target="_blank" rel="noreferrer">Join PlotPickleServer</a>
        </article>
        <article>
          <span>Your own hosted space</span>
          <h2>Create a new community</h2>
          <p>Sign in to BuilderLab, create a separate Buzz community and bring its address back to PlotPickle.</p>
          <a href={COMMUNITY_PORTAL_URL} target="_blank" rel="noreferrer">Create a new community</a>
        </article>
        <article>
          <span>Advanced</span>
          <h2>Be your own RELAY</h2>
          <p>Keep using PlotPickle&apos;s existing managed local Buzz relay and lifecycle controls.</p>
          <button type="button" onClick={onOpenSettings}>Configure local relay</button>
        </article>
      </section>

      <section className={styles.connectionBar} aria-label="Buzz community status">
        <div>
          <span>PlotPickle community</span>
          <strong>{communityName || (relayUrl ? "Saved Buzz community" : "No community saved")}</strong>
          <small>{relayUrl || "Save the wss:// community address in Writers’ Room setup."}</small>
        </div>
        <div className={verified && desktopReady ? styles.ready : styles.setup} role="status">
          {statusError ? "Status unavailable" : verified && desktopReady ? "Ready" : "Setup needed"}
        </div>
      </section>

      <section className={styles.portal} aria-labelledby="buzz-community-portal-title">
        <div className={styles.portalHeading}>
          <div><span>Hosted community manager</span><h2 id="buzz-community-portal-title">Buzz Communities</h2></div>
          <small>If the hosted page does not appear, use Open in browser above. PlotPickle keeps the Desktop button available here.</small>
        </div>
        <iframe
          src={COMMUNITY_PORTAL_URL}
          title="Buzz Communities"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="clipboard-read; clipboard-write"
        />
      </section>
    </div>
  );
}
