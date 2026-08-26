"use client";

import { useCallback, useEffect, useState } from "react";
import { authenticatedProfileFetch } from "../core/auth/profile-request-browser";
import type { StoryRoomAccessDecision, StoryRoomAccessRequest } from "../lib/buzz/story-room-directory";
import styles from "./community-story-room-directory.module.css";

type BuzzChannel = { id: string; name: string; description: string };
type OwnerRequestState = {
  request: StoryRoomAccessRequest;
  decision: StoryRoomAccessDecision | null;
  status: "pending" | "approved" | "declined" | "revoked" | "expired";
};
type OwnerPayload = { ok: boolean; requests: OwnerRequestState[]; listingId: string; message: string };

type Props = { readonly channel: BuzzChannel };

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

export default function CommunityStoryRoomOwnerRequests({ channel }: Props) {
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
        body: JSON.stringify({
          action: "decide",
          channel: channel.id,
          request: item.request,
          status,
        }),
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

    {notice ? <p className={styles.notice} role="status">{notice}</p> : null}
  </section>;
}
