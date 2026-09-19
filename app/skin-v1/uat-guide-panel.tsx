"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createLibraryWorkingCopy,
  listLibraryProjects,
  switchActiveLibraryProject,
} from "../../core/storage/project-library-browser";
import { persistActiveProfileProject } from "../../core/storage/profile-private-browser";
import type { ReviewStageSession } from "../../lib/review-stage";
import styles from "./uat-guide-panel.module.css";

type GuideEvent = {
  at?: string;
  label?: string;
  detail?: string;
  surface?: string;
  state?: string;
};

type GuideStatus = {
  runId?: string;
  status?: "running" | "pass" | "fail";
  startedAt?: string;
  completedAt?: string;
  current?: {
    agent?: string;
    check?: string;
    surface?: string;
    storyAddress?: string;
    state?: string;
  };
  events?: GuideEvent[];
  evidence?: {
    webmcp?: string;
    findings?: string;
    afterglow?: string;
  };
};

type HumanReview = {
  runId: string;
  eventKey: string;
  decision: "acknowledge" | "needs-review" | "continue";
  comment: string;
  updatedAt: string;
};

type Payload = {
  available: boolean;
  status: GuideStatus | null;
  reviews: HumanReview[];
  reviewStage?: ReviewStageSession | null;
  isolation: string;
  providerSpendAllowed: boolean;
  message?: string;
};

const AFTERGLOW_UAT_SOURCE_ID = "afterglow-v9";
const AFTERGLOW_UAT_TITLE = "Afterglow: Reflections of Sentience";

const PREPRODUCTION_UAT_BUCKETS = [
  { id: "outline", label: "Outline", href: "/?workspace=dashboard&block=17&mini=1" },
  { id: "storyboard", label: "Storyboard", href: "/storyboard?block=17&mini=1" },
  { id: "previs", label: "Previs", href: "/previs?block=17&mini=1" },
] as const;

async function json<T>(response: Response): Promise<T> {
  const body = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(body.message || "UAT Semantic Review request failed.");
  return body;
}

async function csrfToken() {
  const response = await fetch("/api/auth/profile", { credentials: "same-origin", cache: "no-store" });
  const body = await json<{ authenticated: boolean; csrfToken: string | null }>(response);
  if (!body.authenticated || !body.csrfToken) throw new Error("PROFILE_UNLOCK_REQUIRED");
  return body.csrfToken;
}

async function ensureLocalStoryMode() {
  const response = await fetch("/api/story-mode/policy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "local" }),
  });
  const body = await response.json() as { ok?: boolean; mode?: string; message?: string };
  if (!response.ok || !body.ok || body.mode !== "local") throw new Error(body.message || "PlotPickle could not switch Story Mode to Local.");
  window.dispatchEvent(new CustomEvent("plotpickle:story-mode-policy-change", { detail: "local" }));
}

async function ensureAfterglowWorkingCopy(csrf: string) {
  const existing = listLibraryProjects().find((item) => (
    !item.archivedAt
    && item.sourceKind === "example"
    && item.sourceId === AFTERGLOW_UAT_SOURCE_ID
  ));

  const project = existing
    ? switchActiveLibraryProject(existing.id)
    : createLibraryWorkingCopy({
      sourceProject: (await import("../../modules/library/reference/afterglow-v9-foundations")).createAfterglowV9FoundationsReference(),
      sourceKind: "example",
      sourceId: AFTERGLOW_UAT_SOURCE_ID,
      title: AFTERGLOW_UAT_TITLE,
      genre: "Science Fiction · Drama",
      format: "Screenplay · v9 reference",
    });

  await persistActiveProfileProject(csrf);
  return { project, reused: Boolean(existing) };
}

function time(value?: string) {
  if (!value) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? "" : parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function reviewEventKey(event: GuideEvent, runId?: string) {
  return [runId || "run", event.at || "time", event.surface || "surface", event.label || "event"].join("|").slice(0, 320);
}

export default function UatGuidePanel() {
  const [payload, setPayload] = useState<Payload | null>(null);
  const [busy, setBusy] = useState(false);
  const [startPending, setStartPending] = useState(false);
  const [message, setMessage] = useState("");
  const [workingCopy, setWorkingCopy] = useState("");
  const [workingProjectId, setWorkingProjectId] = useState("");
  const [comment, setComment] = useState("");

  const refresh = useCallback(async () => {
    try {
      const next = await json<Payload>(await fetch("/api/auth/uat-guide", { credentials: "same-origin", cache: "no-store" }));
      setPayload(next);
      if (next.status) setStartPending(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "UAT Semantic Review is unavailable.");
    }
  }, []);

  useEffect(() => {
    const existing = listLibraryProjects().find((item) => (
      !item.archivedAt
      && item.sourceKind === "example"
      && item.sourceId === AFTERGLOW_UAT_SOURCE_ID
    ));
    if (existing) {
      setWorkingCopy(existing.title);
      setWorkingProjectId(existing.id);
    }
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (payload?.status?.status !== "running" && !startPending) return;
    const timer = window.setInterval(() => void refresh(), 1200);
    return () => window.clearInterval(timer);
  }, [payload?.status?.status, refresh, startPending]);

  const events = useMemo(() => payload?.status?.events || [], [payload?.status?.events]);
  const latestEvent = events.at(-1);
  const latestEventKey = latestEvent ? reviewEventKey(latestEvent, payload?.status?.runId) : "";
  const latestReview = latestEventKey
    ? payload?.reviews?.find((item) => item.runId === payload?.status?.runId && item.eventKey === latestEventKey)
    : undefined;

  function reportProfileLocked() {
    setMessage("Your Human profile session is locked or expired. Unlock the profile using PlotPickle's normal profile control, then return here and start UAT Review again. Your local Afterglow working copy is not discarded.");
  }

  async function start() {
    setBusy(true);
    setMessage("");
    try {
      const csrf = await csrfToken();
      await ensureLocalStoryMode();
      setMessage("Preparing the persistent Afterglow working copy before semantic testing starts…");
      const prepared = await ensureAfterglowWorkingCopy(csrf);
      setWorkingCopy(prepared.project.title);
      setWorkingProjectId(prepared.project.id);
      const response = await fetch("/api/auth/uat-guide", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-PlotPickle-CSRF": csrf },
        body: JSON.stringify({ action: "start" }),
      });
      const body = await response.json() as { message?: string };
      if (!response.ok && response.status !== 409) throw new Error(body.message || "UAT Semantic Review could not start.");
      setStartPending(true);
      setMessage(`${prepared.reused ? "Reused" : "Created"} the local Afterglow working copy and saved it to the encrypted Human profile. ${body.message || "UAT Semantic Review started."}`);
      await refresh();
    } catch (error) {
      setStartPending(false);
      const detail = error instanceof Error ? error.message : "UAT Semantic Review could not start.";
      if (detail === "PROFILE_UNLOCK_REQUIRED" || /session is invalid or expired|unlock a human profile|human profile is locked/i.test(detail)) reportProfileLocked();
      else setMessage(detail);
    } finally {
      setBusy(false);
    }
  }

  async function reviewCurrent(decision: HumanReview["decision"]) {
    if (!latestEvent || !latestEventKey || !payload?.status?.runId) return;
    setBusy(true);
    try {
      const csrf = await csrfToken();
      await json(await fetch("/api/auth/uat-guide", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-PlotPickle-CSRF": csrf },
        body: JSON.stringify({
          action: "review-event",
          runId: payload.status.runId,
          eventKey: latestEventKey,
          decision,
          comment,
        }),
      }));
      setMessage("Your review was attached to this UAT event. Deterministic PASS/FAIL is unchanged.");
      setComment("");
      await refresh();
    } catch (error) {
      const detail = error instanceof Error ? error.message : "PlotPickle could not save the UAT review.";
      if (detail === "PROFILE_UNLOCK_REQUIRED" || /session is invalid or expired|unlock a human profile|human profile is locked/i.test(detail)) reportProfileLocked();
      else setMessage(detail);
    } finally {
      setBusy(false);
    }
  }

  const status = payload?.status;
  const running = status?.status === "running";
  const resultLabel = status?.status === "pass" ? "PASS" : status?.status === "fail" ? "NEEDS ATTENTION" : running ? "RUNNING" : "READY";

  return (
    <section
      className={styles.panel}
      aria-labelledby="uat-review-title"
      data-uat-semantic-review="built-in"
      data-review-stage-domain={payload?.reviewStage?.domain || "developer"}
      data-review-stage-session={payload?.reviewStage?.sessionId || status?.runId || ""}
      data-review-stage-projection={String(payload?.reviewStage?.projectionOnly ?? true)}
    >
      <header className={styles.heading}>
        <div>
          <p>QUALITY / UAT SEMANTIC TESTING</p>
          <h2 id="uat-review-title">UAT Semantic Review</h2>
          <span>Run the local Afterglow Writer-to-Screen acceptance path, watch the checks on this page, review evidence as it appears, then open the same persistent working copy in the real PlotPickle surfaces.</span>
        </div>
        <strong data-state={status?.status || "ready"}>{resultLabel}</strong>
      </header>

      <div className={styles.actions}>
        <button type="button" onClick={() => void start()} disabled={busy || running || startPending}>
          {running ? "UAT RUNNING" : busy || startPending ? "STARTING…" : "START UAT REVIEW"}
        </button>
      </div>

      <div className={styles.current} aria-live="polite">
        <span><b>Story Mode</b>LOCAL</span>
        <span><b>Reference</b>Afterglow v9</span>
        <span><b>Story address</b>{status?.current?.storyAddress || "Block 17 / Mini-Block 1"}</span>
        <span><b>Working copy</b>{workingCopy || AFTERGLOW_UAT_TITLE}</span>
        <span><b>Project ID</b>{workingProjectId || "Prepared on start"}</span>
      </div>

      <p className={styles.boundary}>Semantic UAT only · persistent Human working copy · immutable Afterglow reference · synthetic verification isolation · no cloud spend · deterministic verification owns PASS/FAIL.</p>
      {message ? <p className={styles.message} role="status">{message}</p> : null}

      <section className={styles.console} aria-labelledby="uat-live-console-title">
        <div className={styles.consoleHeading}>
          <div>
            <p>LIVE REVIEW</p>
            <h3 id="uat-live-console-title">In-page command window</h3>
          </div>
          <strong>{resultLabel}</strong>
        </div>
        <div className={styles.consoleBody} role="log" aria-live="polite" aria-relevant="additions text">
          {events.length ? events.slice(-24).map((event, index) => (
            <div className={styles.consoleLine} key={`${event.at || "event"}-${index}`}>
              <time dateTime={event.at}>{time(event.at)}</time>
              <b>{event.surface || "uat"}</b>
              <span><strong>{event.label || "UAT event"}</strong>{event.detail ? ` — ${event.detail}` : ""}</span>
              <em data-state={(event.state || "RUNNING").toLowerCase().replace(/_/g, "-")}>{event.state || "RUNNING"}</em>
            </div>
          )) : <p className={styles.consoleEmpty}>Ready. Start UAT Review to prepare Afterglow and begin semantic testing.</p>}
        </div>
      </section>

      {latestEvent && status?.runId ? (
        <section className={styles.review} aria-labelledby="uat-human-review-title">
          <div>
            <p>HUMAN / AGENT REVIEW</p>
            <h3 id="uat-human-review-title">Review the current finding</h3>
            <span>{latestEvent.label || "Current UAT event"}{latestEvent.detail ? ` — ${latestEvent.detail}` : ""}</span>
          </div>
          <textarea
            aria-label="Optional Human review comment"
            placeholder="Add a comment, challenge, observation or direction for this finding…"
            rows={3}
            value={comment}
            onChange={(event) => setComment(event.currentTarget.value)}
          />
          <div className={styles.reviewActions}>
            <button type="button" disabled={busy} onClick={() => void reviewCurrent("acknowledge")}>Acknowledge</button>
            <button type="button" disabled={busy} onClick={() => void reviewCurrent("needs-review")}>Needs review</button>
            <button type="button" disabled={busy} onClick={() => void reviewCurrent("continue")}>Continue</button>
          </div>
          {latestReview ? <small>Saved Human response: {latestReview.decision}{latestReview.comment ? ` — ${latestReview.comment}` : ""}. This annotation does not alter deterministic PASS/FAIL.</small> : null}
        </section>
      ) : null}

      <section className={styles.surfaces} aria-labelledby="uat-tested-surfaces-title">
        <div>
          <p>PRE-PRODUCTION UAT BUCKETS</p>
          <h3 id="uat-tested-surfaces-title">Confirm the same Afterglow project in each current bucket</h3>
          <span>Human UAT currently checks three pre-production buckets: Outline, Storyboard and Previs. Confirm the story, Project ID and Block 17 / Mini-Block 1 remain the same in each. This explicit bucket list can expand as the planned five-bucket pre-production model becomes canonical.</span>
        </div>
        <nav aria-label="Afterglow pre-production UAT buckets" data-uat-project-id={workingProjectId || undefined}>
          {PREPRODUCTION_UAT_BUCKETS.map((surface) => <Link data-uat-bucket={surface.id} href={surface.href} key={surface.id}>{surface.label}</Link>)}
        </nav>
      </section>

      {status?.evidence ? (
        <details className={styles.evidence}>
          <summary>Evidence references</summary>
          <code>{status.evidence.webmcp}</code>
          <code>{status.evidence.findings}</code>
          <code>{status.evidence.afterglow}</code>
        </details>
      ) : null}
    </section>
  );
}
