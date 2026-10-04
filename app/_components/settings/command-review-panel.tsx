"use client";

import { useEffect, useState } from "react";
import { authenticatedProfileFetch } from "../../../core/auth/profile-request-browser";
import styles from "../../skin-v1/settings-workspace-panel.module.css";

type Review = { id: string; state: "running" | "cancelled" | "closed"; target: { kind: string; number?: number } };
export default function CommandReviewPanel() {
  const [state, setState] = useState("loading");
  const [message, setMessage] = useState("Checking native review availability…");
  const [number, setNumber] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    void authenticatedProfileFetch("/api/dsdd/review", { signal: abort.signal, cache: "no-store" })
      .then(async response => {
        const body = await response.json();
        if (!response.ok || !body.ok) throw new Error();
        if (!abort.signal.aborted) { setState(body.state); setMessage(body.message); setReview(body.review ?? null); }
      }).catch(() => { if (!abort.signal.aborted) { setState("unavailable"); setMessage("Review is unavailable. Check the local runtime and unlock the profile."); } });
    return () => abort.abort();
  }, []);
  useEffect(() => {
    if (review?.state !== "running") return;
    const abort = new AbortController();
    const timer = setInterval(() => {
      void authenticatedProfileFetch("/api/dsdd/review", { signal: abort.signal, cache: "no-store" })
        .then(async response => {
          const body = await response.json();
          if (!response.ok || !body.ok || abort.signal.aborted) return;
          setReview(body.review ?? null);
          if (body.review?.state === "closed") setMessage("Review closed. Proposed changes remain unchanged.");
        }).catch(() => {});
    }, 5000);
    return () => { clearInterval(timer); abort.abort(); };
  }, [review?.id, review?.state]);
  async function action(body: unknown) {
    if (busy) return;
    setBusy(true);
    try {
      const response = await authenticatedProfileFetch("/api/dsdd/review", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok || !result.ok || !result.review) throw new Error(result.message || "Review is unavailable.");
      setReview(result.review);
      setMessage(result.review.state === "cancelled" ? "Review closed. Proposed changes remain unchanged." : "Review opened in Hunk. Agent annotations are advisory; review grants no permission to apply or merge changes.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Review could not open."); }
    finally { setBusy(false); }
  }
  const validNumber = /^\d{1,10}$/u.test(number) && Number.isSafeInteger(Number(number)) && Number(number) > 0 && Number(number) <= 2_147_483_647;
  const running = review?.state === "running";
  return <section className={styles.form} aria-label="Proposed changes" data-command-review-state={state}>
    <h2>Proposed changes</h2>
    <p>Open the current code changes or a PlotPickle pull request in Hunk for review.</p>
    <p role="status">{message}</p>
    <button type="button" disabled={busy || state !== "ready" || running} onClick={() => void action({ action: "start", target: { kind: "working-tree" } })}>Review current changes</button>
    <label><span>Pull request number</span><input inputMode="numeric" value={number} onChange={event => setNumber(event.currentTarget.value)} disabled={busy || running} /></label>
    <button type="button" disabled={busy || state !== "ready" || running || !validNumber} onClick={() => void action({ action: "start", target: { kind: "pull-request", number: Number(number) } })}>Review pull request</button>
    {running ? <button type="button" disabled={busy} onClick={() => void action({ action: "cancel", id: review.id })}>Close review</button> : null}
  </section>;
}
