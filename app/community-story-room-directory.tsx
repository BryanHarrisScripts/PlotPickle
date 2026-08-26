"use client";

import { useCallback, useEffect, useState } from "react";
import { authenticatedProfileFetch } from "../core/auth/profile-request-browser";
import { humanBuzzFingerprint } from "../lib/buzz/buzz-story-room";
import type { StoryRoomDirectoryListing } from "../lib/buzz/story-room-directory";
import styles from "./community-story-room-directory.module.css";

type DirectoryPayload = {
  ok: boolean;
  listings: StoryRoomDirectoryListing[];
  viewerPublicKey: string;
  invalidMarkedEvents: number;
  capabilities: { openMembership: boolean };
  message: string;
};

type RequestPayload = {
  ok: boolean;
  status: "pending" | "approved" | "declined" | "revoked" | "expired";
  message: string;
};

async function request<T>(path: string, init?: RequestInit) {
  const response = await authenticatedProfileFetch(path, {
    ...init,
    cache: "no-store",
    headers: { Accept: "application/json", "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(body.message || `BUZZ returned ${response.status}.`);
  return body;
}

export default function CommunityStoryRoomDirectory() {
  const [payload, setPayload] = useState<DirectoryPayload | null>(null);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");
  const [statuses, setStatuses] = useState<Record<string, string>>({});

  const refresh = useCallback(async (showNotice = false) => {
    const next = await request<DirectoryPayload>("/api/local-buzz/story-room-directory");
    setPayload(next);
    if (showNotice) setNotice(next.message);
  }, []);

  useEffect(() => {
    void refresh(false).catch((error) => setNotice(error instanceof Error ? error.message : "Story Rooms Directory could not be loaded."));
  }, [refresh]);

  async function requestAccess(listing: StoryRoomDirectoryListing) {
    setBusy(listing.listingId);
    setNotice("");
    try {
      const result = await request<RequestPayload>("/api/local-buzz/story-room-directory", {
        method: "POST",
        body: JSON.stringify({
          action: "request",
          listingId: listing.listingId,
          ownerPublicKey: listing.ownerPublicKey,
        }),
      });
      setStatuses((current) => ({ ...current, [listing.listingId]: result.status }));
      setNotice(result.message);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Story Room access request could not be sent.");
    } finally {
      setBusy("");
    }
  }

  const listings = payload?.listings ?? [];

  return <main className={styles.panel} aria-label="Story Rooms Directory">
    <header className={styles.header}>
      <div>
        <span className={styles.eyebrow}>Community discovery</span>
        <h2>Story Rooms Directory</h2>
        <p>Writers choose exactly what appears here. Listings never expose the private BUZZ channel, messages, project files, screenplay, PPF, credentials, or private member list.</p>
      </div>
      <button type="button" disabled={Boolean(busy)} onClick={() => void refresh(true)}>Refresh directory</button>
    </header>

    {listings.length ? <section className={styles.grid} aria-label="Listed Story Rooms">
      {listings.map((listing) => {
        const owned = payload?.viewerPublicKey === listing.ownerPublicKey;
        const status = statuses[listing.listingId] || "";
        const requestable = listing.accessMode === "listed" && listing.requestsOpen && !owned;
        return <article className={styles.card} key={listing.listingId}>
          <div>
            <span className={styles.eyebrow}>{listing.genre || "Story Room"}</span>
            <h3>{listing.title}</h3>
            <p>{listing.description || "No public description provided."}</p>
          </div>
          <dl className={styles.meta}>
            <div><dt>Owner</dt><dd>{listing.ownerDisplayName} · {humanBuzzFingerprint(listing.ownerPublicKey)}</dd></div>
            <div><dt>Community</dt><dd>{listing.hostingCommunityName || "Not shown"}</dd></div>
            <div><dt>Access</dt><dd>{listing.accessMode === "listed" ? (listing.requestsOpen ? "Request Access" : "Requests closed") : "Open unavailable"}</dd></div>
          </dl>
          <div className={styles.actions}>
            {owned ? <span className={styles.status}>This is your listing.</span>
              : requestable ? <button type="button" disabled={Boolean(busy) || status === "pending" || status === "approved"} onClick={() => void requestAccess(listing)}>{busy === listing.listingId ? "Sending…" : status === "pending" ? "Request pending" : status === "approved" ? "Access approved" : status === "declined" ? "Request declined" : status === "revoked" ? "Access revoked" : "Request Access"}</button>
              : <span className={styles.status}>New requests are unavailable.</span>}
          </div>
        </article>;
      })}
    </section> : <p className={styles.empty}>{payload?.message || "No Story Rooms are listed for discovery right now."}</p>}

    {payload?.invalidMarkedEvents ? <p className={styles.status}>PlotPickle ignored {payload.invalidMarkedEvents} invalid signed-directory event{payload.invalidMarkedEvents === 1 ? "" : "s"}; none were trusted as access authority.</p> : null}
    {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
  </main>;
}
