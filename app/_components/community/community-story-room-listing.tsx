"use client";

import { useEffect, useMemo, useState } from "react";
import { authenticatedProfileFetch } from "../../../core/auth/profile-request-browser";
import { humanBuzzFingerprint } from "../../../lib/buzz/buzz-story-room";
import type { StoryRoomDirectoryAnnouncement } from "../../../lib/buzz/story-room-directory";
import type { BuzzStoryRoomAccessMode, BuzzStoryRoomListing } from "../../../lib/buzz/story-room-listing";
import styles from "./community-story-room-listing.module.css";

type BuzzChannel = { id: string; name: string; description: string };
type PublicPreview = {
  version: 1;
  listingId: string;
  title: string;
  description: string;
  genre: string;
  ownerDisplayName: string;
  ownerPublicKey: string;
  hostingCommunityName: string;
  accessMode: BuzzStoryRoomAccessMode;
  requestsOpen: boolean;
  updatedAt: string;
};
type ListingPayload = {
  ok: boolean;
  listing: BuzzStoryRoomListing | null;
  publicPreview: PublicPreview | null;
  defaults: {
    ownerDisplayName: string;
    ownerPublicKey: string;
    hostingCommunityName: string;
    suggestedTitle: string;
  };
  capabilities: { openMembership: boolean };
  message: string;
};

type Props = { readonly channel: BuzzChannel };

async function request(path: string, init?: RequestInit) {
  const response = await authenticatedProfileFetch(path, {
    ...init,
    cache: "no-store",
    headers: { Accept: "application/json", "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await response.json() as ListingPayload & { message?: string };
  if (!response.ok) throw new Error(body.message || `BUZZ returned ${response.status}.`);
  return body;
}

function directoryAnnouncement(payload: ListingPayload): StoryRoomDirectoryAnnouncement | null {
  const listing = payload.listing;
  if (!listing) return null;
  if (listing.accessMode === "closed") {
    return {
      version: 1,
      type: "closed",
      listingId: listing.listingId,
      ownerPublicKey: listing.ownerPublicKey,
      updatedAt: listing.updatedAt,
    };
  }
  const preview = payload.publicPreview;
  if (!preview || preview.accessMode !== "listed") return null;
  return {
    version: 1,
    type: "listing",
    listingId: preview.listingId,
    title: preview.title,
    description: preview.description,
    genre: preview.genre,
    ownerDisplayName: preview.ownerDisplayName,
    ownerPublicKey: preview.ownerPublicKey,
    hostingCommunityName: preview.hostingCommunityName,
    accessMode: "listed",
    requestsOpen: preview.requestsOpen,
    updatedAt: preview.updatedAt,
  };
}

async function publishDirectory(payload: ListingPayload) {
  const announcement = directoryAnnouncement(payload);
  if (!announcement) throw new Error("PlotPickle could not prepare the signed directory announcement for this listing state.");
  const response = await authenticatedProfileFetch("/api/local-buzz/story-room-directory", {
    method: "POST",
    cache: "no-store",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ action: "publish", announcement }),
  });
  const body = await response.json() as { message?: string };
  if (!response.ok) throw new Error(body.message || `BUZZ returned ${response.status}.`);
  return body.message || "Story Rooms Directory updated.";
}

export default function CommunityStoryRoomListing({ channel }: Props) {
  const [payload, setPayload] = useState<ListingPayload | null>(null);
  const [accessMode, setAccessMode] = useState<BuzzStoryRoomAccessMode>("closed");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [genre, setGenre] = useState("");
  const [requestsOpen, setRequestsOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [directorySyncWarning, setDirectorySyncWarning] = useState("");

  const fingerprint = useMemo(() => humanBuzzFingerprint(payload?.defaults.ownerPublicKey || ""), [payload?.defaults.ownerPublicKey]);

  function apply(next: ListingPayload) {
    setPayload(next);
    const listing = next.listing;
    setAccessMode(listing?.accessMode ?? "closed");
    setTitle(listing?.title || next.defaults.suggestedTitle || "");
    setDescription(listing?.description || "");
    setGenre(listing?.genre || "");
    setRequestsOpen(listing?.requestsOpen ?? true);
  }

  async function refresh(showNotice = false) {
    const next = await request(`/api/local-buzz/story-room-listing?channel=${encodeURIComponent(channel.id)}`);
    apply(next);
    if (showNotice) setNotice(next.message);
  }

  useEffect(() => {
    setPayload(null);
    setNotice("");
    setDirectorySyncWarning("");
    void refresh(false).catch((error) => setNotice(error instanceof Error ? error.message : "Story Room listing could not be loaded."));
  }, [channel.id]);

  async function save() {
    setBusy(true);
    setNotice("");
    try {
      const next = await request("/api/local-buzz/story-room-listing", {
        method: "POST",
        body: JSON.stringify({
          channel: channel.id,
          accessMode,
          title,
          description,
          genre,
          requestsOpen,
        }),
      });
      apply(next);
      try {
        const publicationMessage = await publishDirectory(next);
        setDirectorySyncWarning("");
        setNotice(`${next.message} ${publicationMessage}`);
      } catch (error) {
        const detail = error instanceof Error ? error.message : "The signed directory update failed.";
        setDirectorySyncWarning("Directory not synchronized: the local owner setting was saved, but BUZZ did not confirm the public directory update. A previous public listing may still be visible. Retry Save & withdraw/publish until synchronization succeeds.");
        setNotice(detail);
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Story Room listing could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  const preview = payload?.publicPreview ?? null;
  const openAvailable = payload?.capabilities.openMembership === true;

  return <section className={styles.card} aria-label="Story Rooms Directory owner listing">
    <header>
      <div>
        <span>Story Rooms Directory</span>
        <h3>Owner listing & public preview</h3>
        <p>Closed is the default. PlotPickle publishes only the metadata you approve here; the private BUZZ channel, conversation, project files and PPF stay private.</p>
      </div>
      <button type="button" disabled={busy} onClick={() => void refresh(true)}>Refresh listing</button>
    </header>

    <div className={styles.identityStrip}>
      <div><span>Verified owner</span><strong>{payload?.defaults.ownerDisplayName || "Verifying…"}</strong><small>{fingerprint}</small></div>
      <div><span>Hosting Community</span><strong>{payload?.defaults.hostingCommunityName || "—"}</strong><small>BUZZ remains membership authority</small></div>
      <div><span>Private room</span><strong>Mapped</strong><small>Channel identity is not published</small></div>
    </div>

    <div className={styles.formGrid}>
      <label><span>Directory access</span><select value={accessMode} onChange={(event) => setAccessMode(event.target.value as BuzzStoryRoomAccessMode)} disabled={!payload || busy}><option value="closed">Closed · hidden</option><option value="listed">Listed · Request Access</option><option value="open" disabled={!openAvailable}>Open · unavailable until BUZZ supports safe admission</option></select></label>
      <label><span>Story title</span><input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} disabled={!payload || busy} /></label>
      <label><span>Genre</span><input value={genre} maxLength={80} onChange={(event) => setGenre(event.target.value)} placeholder="Optional" disabled={!payload || busy} /></label>
      <label className={styles.description}><span>Short description</span><textarea value={description} maxLength={500} rows={4} onChange={(event) => setDescription(event.target.value)} placeholder="Write only what you want other people to see." disabled={!payload || busy} /></label>
      <label className={styles.checkbox}><input type="checkbox" checked={requestsOpen} onChange={(event) => setRequestsOpen(event.target.checked)} disabled={!payload || busy || accessMode !== "listed"} /><span>Accept new access requests while Listed</span></label>
    </div>

    <div className={styles.actions}>
      <button type="button" disabled={!payload || busy || !title.trim()} onClick={() => void save()}>{busy ? "Saving…" : accessMode === "closed" ? "Save & withdraw listing" : "Save & publish listing"}</button>
      <p>Open is capability-gated. PlotPickle will not simulate automatic admission or silently fall back while claiming the room is Open.</p>
    </div>

    {directorySyncWarning ? <p className={styles.notice} role="alert">{directorySyncWarning}</p> : null}

    <div className={styles.preview}>
      <span>Exactly what other people can see</span>
      {preview ? <article>
        <div><small>{preview.genre || "Story Room"}</small><h4>{preview.title}</h4></div>
        {preview.description ? <p>{preview.description}</p> : <p>No public description provided.</p>}
        <dl><div><dt>Owner</dt><dd>{preview.ownerDisplayName} · {humanBuzzFingerprint(preview.ownerPublicKey)}</dd></div><div><dt>Community</dt><dd>{preview.hostingCommunityName || "Not shown"}</dd></div><div><dt>Access</dt><dd>{preview.accessMode === "listed" ? (preview.requestsOpen ? "Request Access" : "Listed · requests closed") : "Open"}</dd></div></dl>
      </article> : <p className={styles.closedPreview}>Nothing is public. Closed Story Rooms do not appear in the Story Rooms Directory.</p>}
    </div>

    {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
  </section>;
}
