"use client";

import { useCallback, useEffect, useState } from "react";
import { authenticatedProfileFetch } from "../../core/auth/profile-request-browser";
import { humanBuzzFingerprint } from "../../lib/buzz/buzz-story-room";
import type {
  StoryRoomAccessDecision,
  StoryRoomAccessRequest,
  StoryRoomDirectoryListing,
} from "../../lib/buzz/story-room-directory";
import styles from "./story-room-directory.module.css";

type DirectoryPayload = {
  ok: boolean;
  listings: StoryRoomDirectoryListing[];
  viewerPublicKey: string;
  invalidMarkedEvents: number;
  capabilities: { openMembership: boolean; federatedPublication: boolean };
  message: string;
};

type RequestPayload = {
  ok: boolean;
  status: "pending" | "approved" | "declined" | "revoked" | "expired";
  message: string;
};

type BuzzChannel = { id: string; name: string; description: string };
type OwnerRequestState = {
  request: StoryRoomAccessRequest;
  decision: StoryRoomAccessDecision | null;
  status: "pending" | "approved" | "declined" | "revoked" | "expired";
};
type OwnerPayload = {
  ok: boolean;
  requests: OwnerRequestState[];
  listingId: string;
  invalidMarkedEvents: number;
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
        const requestLabel = status === "pending"
          ? "Check request"
          : status === "approved"
            ? "Access approved"
            : status === "declined"
              ? "Request declined"
              : status === "revoked"
                ? "Access revoked"
                : "Request Access";
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
              : requestable ? <button type="button" disabled={Boolean(busy) || status === "approved"} onClick={() => void requestAccess(listing)}>{busy === listing.listingId ? "Checking…" : requestLabel}</button>
              : <span className={styles.status}>New requests are unavailable.</span>}
          </div>
        </article>;
      })}
    </section> : <p className={styles.empty}>{payload?.message || "No Story Rooms are listed for discovery right now."}</p>}

    <p className={styles.status}>Open auto-admission and publication into other Human-owned BUZZ Communities remain unavailable until BUZZ exposes safe owner-authorized capabilities. PlotPickle does not simulate either behavior.</p>
    {payload?.invalidMarkedEvents ? <p className={styles.status}>PlotPickle ignored {payload.invalidMarkedEvents} invalid signed-directory event{payload.invalidMarkedEvents === 1 ? "" : "s"}; none were trusted as access authority.</p> : null}
    {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
  </main>;
}

export function CommunityStoryRoomOwnerRequests({ channel }: { readonly channel: BuzzChannel }) {
  const [payload, setPayload] = useState<OwnerPayload | null>(null);
  const [busy, setBusy] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async (showNotice = false) => {
    const next = await request<OwnerPayload>(`/api/local-buzz/story-room-directory?ownerRequests=1&channel=${encodeURIComponent(channel.id)}`);
    setPayload(next);
    if (showNotice) setNotice(next.message);
  }, [channel.id]);

  useEffect(() => {
    setPayload(null);
    setNotice("");
    void refresh(false).catch((error) => setNotice(error instanceof Error ? error.message : "Story Room requests could not be loaded."));
  }, [refresh]);

  async function decide(item: OwnerRequestState, status: "approved" | "declined" | "revoked") {
    setBusy(`${item.request.requestId}:${status}`);
    setNotice("");
    try {
      const result = await request<{ message: string }>("/api/local-buzz/story-room-directory", {
        method: "POST",
        body: JSON.stringify({ action: "decide", channel: channel.id, request: item.request, status }),
      });
      await refresh(false);
      setNotice(result.message);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Story Room access decision could not be completed.");
    } finally {
      setBusy("");
    }
  }

  const requests = payload?.requests ?? [];

  return <section className={styles.panel} aria-label="Pending Story Room access requests">
    <header className={styles.header}>
      <div>
        <span className={styles.eyebrow}>Owner access decisions</span>
        <h2>Story Room requests</h2>
        <p>Approval adds only normal BUZZ membership and is shown as approved only after BUZZ confirms that membership. Decline grants nothing; revoke removes BUZZ access.</p>
      </div>
      <button type="button" disabled={Boolean(busy)} onClick={() => void refresh(true)}>Refresh requests</button>
    </header>

    {requests.length ? <div className={styles.requestList}>
      {requests.map((item) => {
        const fingerprint = `${item.request.requesterPublicKey.slice(0, 8)}…${item.request.requesterPublicKey.slice(-6)}`;
        const pending = item.status === "pending";
        const approved = item.status === "approved";
        return <article className={styles.requestCard} key={item.request.requestId}>
          <div>
            <span className={styles.eyebrow}>{item.status}</span>
            <h4>Access request</h4>
            <p className={styles.identity}>{fingerprint}</p>
            <p>Requested {new Date(item.request.requestedAt).toLocaleString()} · expires {new Date(item.request.expiresAt).toLocaleString()}</p>
          </div>
          <div className={styles.actions}>
            {pending ? <>
              <button type="button" disabled={Boolean(busy)} onClick={() => void decide(item, "approved")}>{busy === `${item.request.requestId}:approved` ? "Approving…" : "Approve"}</button>
              <button type="button" disabled={Boolean(busy)} onClick={() => void decide(item, "declined")}>{busy === `${item.request.requestId}:declined` ? "Declining…" : "Decline"}</button>
            </> : null}
            {approved ? <button type="button" disabled={Boolean(busy)} onClick={() => void decide(item, "revoked")}>{busy === `${item.request.requestId}:revoked` ? "Revoking…" : "Revoke access"}</button> : null}
            {!pending && !approved ? <span className={styles.status}>No membership action is available for this {item.status} request.</span> : null}
          </div>
        </article>;
      })}
    </div> : <p className={styles.empty}>{payload?.message || "No Story Room access requests yet."}</p>}

    {payload?.invalidMarkedEvents ? <p className={styles.status}>Invalid marked request events were ignored and did not gain access authority.</p> : null}
    {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
  </section>;
}
