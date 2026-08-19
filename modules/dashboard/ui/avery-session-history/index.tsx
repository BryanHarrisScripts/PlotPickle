"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./avery-session-history.module.css";

const API = "/api/writer-in-residence/sessions";
const EMPTY_ART = "/brand/plotpickle-ouroboros-v2.png";
const SLOT_COUNT = 4;

type SessionSummary = {
  id: string;
  synthetic: true;
  syntheticOwner: string;
  generatedAt: string;
  projectName: string;
  completionFrontier: string;
  completionState: string;
  finishedReason: string;
  findingCount: number;
  frictionCount: number;
  stageCount: number;
  representativeVisualUrl: string;
  posterUrl: string;
  trailerUrl: string;
};

type SessionDetail = {
  summary: SessionSummary;
  report: {
    persona?: { name?: string; disclosure?: string };
    storySeed?: { title?: string; premise?: string; format?: string; creativeGoal?: string };
    generatedAt?: string;
    finishedReason?: string;
    storyMemory?: string;
    sageConversation?: { requested?: number; completed?: number };
    journeyCoverage?: { complete?: boolean; writerVisitedScreens?: string[]; areaCounts?: Record<string, number> };
    diary?: Array<{ turn?: string | number; area?: string; route?: string; summary?: string; action?: { type?: string; target?: string; text?: string; route?: string }; result?: { ok?: boolean; detail?: string }; observations?: Array<{ kind?: string; severity?: string; summary?: string }> }>;
    observations?: Array<{ kind?: string; severity?: string; summary?: string; expectation?: string; impact?: string }>;
    promotedFindings?: Array<{ kind?: string; severity?: string; summary?: string; expectation?: string; impact?: string }>;
    visualReview?: { screens?: Array<{ id?: string; label?: string; findings?: Array<{ severity?: string; summary?: string }> }> };
    runnerFindings?: Array<{ turn?: string | number; message?: string }>;
  };
};

function friendlyDate(value: string, fallback = "Date unavailable") {
  const timestamp = Date.parse(value);
  return value && Number.isFinite(timestamp) ? new Date(timestamp).toLocaleString() : value || fallback;
}

function selectedSessionId() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("averySession") || "";
}

function openSession(sessionId: string) {
  const destination = new URL(window.location.href);
  destination.searchParams.set("workspace", "dashboard");
  destination.searchParams.set("averySession", sessionId);
  window.location.assign(`${destination.pathname}${destination.search}`);
}

function closeSession() {
  const destination = new URL(window.location.href);
  destination.searchParams.delete("averySession");
  destination.searchParams.set("workspace", "dashboard");
  window.location.assign(`${destination.pathname}${destination.search}`);
}

function artifactButton(label: "POSTER" | "TRAILER", url: string) {
  return (
    <button
      className={styles.artifactPill}
      disabled={!url}
      onClick={() => {
        if (url) window.open(url, "_blank", "noopener,noreferrer");
      }}
      title={url ? `Open this Avery session's ${label.toLowerCase()}` : `${label} unavailable for this session`}
      type="button"
    >
      {label}
    </button>
  );
}

function SessionReview({ detail }: { readonly detail: SessionDetail }) {
  const { report, summary } = detail;
  const visited = report.journeyCoverage?.writerVisitedScreens || [];
  const diary = report.diary || [];
  const findings = report.promotedFindings?.length ? report.promotedFindings : report.observations || [];
  const visualScreens = report.visualReview?.screens || [];
  const reachedBuild = visited.includes("world-build") || summary.completionFrontier === "BUILD";
  const firstTimeSummary = reachedBuild && report.journeyCoverage?.complete
    ? "Yes. Avery reached the current BUILD frontier through the visible writer journey."
    : `Not yet. Avery stopped at ${summary.completionFrontier || "the recorded frontier"}; review the evidence below before treating BUILD as reachable.`;

  return (
    <section className={styles.review} aria-label="Avery Writer-in-Residence session review">
      <header className={styles.reviewHeader}>
        <div>
          <p className={styles.kicker}>Writer-in-Residence · read-only synthetic evidence</p>
          <h2>{summary.projectName}</h2>
          <p>{report.storySeed?.premise || "Synthetic test story premise was not recorded."}</p>
        </div>
        <button onClick={closeSession} type="button">Back to Dashboard</button>
      </header>

      <div className={styles.reviewSummary}>
        <div><span>Run</span><strong>{friendlyDate(summary.generatedAt)}</strong></div>
        <div><span>Frontier</span><strong>{summary.completionFrontier}</strong></div>
        <div><span>State</span><strong>{summary.completionState}</strong></div>
        <div><span>Findings</span><strong>{summary.findingCount} promoted · {summary.frictionCount} friction</strong></div>
      </div>

      <article className={styles.answerCard}>
        <p className={styles.kicker}>Could a first-time writer reach BUILD?</p>
        <h3>{firstTimeSummary}</h3>
        <p>Stopped because: {report.finishedReason || summary.finishedReason || "not recorded"}.</p>
      </article>

      <div className={styles.artifactReview}>
        {summary.posterUrl ? <a href={summary.posterUrl} rel="noreferrer" target="_blank">Open session POSTER</a> : <span>POSTER not produced in this session</span>}
        {summary.trailerUrl ? <a href={summary.trailerUrl} rel="noreferrer" target="_blank">Open session TRAILER</a> : <span>TRAILER not produced in this session</span>}
      </div>

      <section className={styles.reviewSection}>
        <h3>Story and persisted creative memory</h3>
        <p><strong>Format:</strong> {report.storySeed?.format || "Not recorded"}</p>
        <p><strong>Creative goal:</strong> {report.storySeed?.creativeGoal || "Not recorded"}</p>
        <p>{report.storyMemory || "Avery did not leave a cumulative story-memory note in this run."}</p>
        <p><strong>Sage conversation:</strong> {report.sageConversation?.completed || 0} of {report.sageConversation?.requested || 0} required exchanges completed.</p>
      </section>

      <section className={styles.reviewSection}>
        <h3>Stages visited in order</h3>
        <div className={styles.stageTrail}>
          {visited.length ? visited.map((stage, index) => <span key={`${stage}-${index}`}>{index + 1}. {stage}</span>) : <span>No stages recorded.</span>}
        </div>
      </section>

      <section className={styles.reviewSection}>
        <h3>Avery's visible actions and first-person decisions</h3>
        <div className={styles.timeline}>
          {diary.length ? diary.map((entry, index) => (
            <article key={`${entry.turn ?? index}-${index}`}>
              <header><strong>{entry.area || "journey"}</strong><span>Turn {entry.turn ?? index + 1}</span></header>
              <p>{entry.summary || "No first-person summary recorded."}</p>
              <small>{entry.action?.type || "action"}{entry.action?.target ? ` · ${entry.action.target}` : ""} · {entry.result?.detail || "result recorded"}</small>
            </article>
          )) : <p>No diary entries were recorded.</p>}
        </div>
      </section>

      <section className={styles.reviewSection}>
        <h3>Confusion, friction, needs and possible bugs</h3>
        <div className={styles.findings}>
          {findings.length ? findings.map((finding, index) => (
            <article key={`${finding.kind || "finding"}-${index}`}>
              <header><strong>{(finding.kind || "finding").toUpperCase()}</strong><span>{finding.severity || "unrated"}</span></header>
              <p>{finding.summary || "Finding recorded without a summary."}</p>
              {finding.impact ? <small>{finding.impact}</small> : null}
            </article>
          )) : <p>No promoted writer findings were recorded.</p>}
        </div>
      </section>

      <section className={styles.reviewSection}>
        <h3>Screenshots and visual observations</h3>
        <div className={styles.visualList}>
          {visualScreens.length ? visualScreens.map((screen, index) => (
            <article key={`${screen.id || screen.label || "screen"}-${index}`}>
              <strong>{screen.label || screen.id || "Reviewed screen"}</strong>
              {(screen.findings || []).length
                ? (screen.findings || []).map((finding, findingIndex) => <p key={findingIndex}>{finding.severity || "review"}: {finding.summary}</p>)
                : <p>No deterministic visual-layout finding.</p>}
            </article>
          )) : <p>No rendered visual review was recorded.</p>}
        </div>
      </section>

      {report.runnerFindings?.length ? (
        <section className={styles.reviewSection}>
          <h3>Runner recovery notes</h3>
          {report.runnerFindings.map((finding, index) => <p key={index}>{String(finding.turn ?? "run")}: {finding.message}</p>)}
        </section>
      ) : null}
    </section>
  );
}

export default function AverySessionHistory() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [notice, setNotice] = useState("Loading local Avery sessions…");
  const requested = useMemo(selectedSessionId, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(requested ? `${API}?session=${encodeURIComponent(requested)}` : API, { cache: "no-store" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.message || "Avery session history could not be loaded.");
        if (cancelled) return;
        if (requested) {
          setDetail(body.session || null);
          setNotice("");
        } else {
          setSessions(Array.isArray(body.sessions) ? body.sessions : []);
          setNotice("");
        }
      } catch (error) {
        if (!cancelled) setNotice(error instanceof Error ? error.message : "Avery session history is unavailable.");
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [requested]);

  if (requested) {
    if (detail) return <SessionReview detail={detail} />;
    return <section className={styles.panel}><p>{notice || "Opening Avery session…"}</p><button onClick={closeSession} type="button">Back to Dashboard</button></section>;
  }

  const slots = Array.from({ length: SLOT_COUNT }, (_, index) => sessions[index] || null);

  return (
    <section className={styles.panel} aria-label="Avery Writer-in-Residence sessions">
      <header className={styles.heading}>
        <div>
          <p className={styles.kicker}>Writer-in-Residence · Avery North</p>
          <h2>Latest synthetic writer sessions</h2>
          <p>Exactly four Dashboard positions stay reserved. These are read-only test sessions and never replace your active project.</p>
        </div>
        <span>{sessions.length} local session{sessions.length === 1 ? "" : "s"}</span>
      </header>

      {notice ? <p className={styles.notice}>{notice}</p> : null}

      <div className={styles.slotGrid}>
        {slots.map((session, index) => (
          <div className={styles.slotWrap} key={session?.id || `empty-${index}`}>
            <button
              className={styles.sessionCard}
              data-empty={!session}
              disabled={!session}
              onClick={() => session && openSession(session.id)}
              type="button"
            >
              <span className={styles.artwork}>
                <img alt="" src={session?.representativeVisualUrl || EMPTY_ART} />
              </span>
              <span className={styles.cardCopy}>
                {session ? (
                  <>
                    <small>SYNTHETIC AVERY SESSION</small>
                    <strong>{session.projectName}</strong>
                    <span>{friendlyDate(session.generatedAt)}</span>
                    <span>{session.completionFrontier} · {session.completionState}</span>
                    <span>{session.findingCount} findings · {session.frictionCount} friction</span>
                  </>
                ) : (
                  <>
                    <small>UNUSED SESSION SLOT {index + 1}</small>
                    <strong>Waiting for Avery</strong>
                    <span>No synthetic run is stored here yet.</span>
                  </>
                )}
              </span>
            </button>
            <div className={styles.pills} aria-label={`Avery session ${index + 1} artifacts`}>
              {artifactButton("POSTER", session?.posterUrl || "")}
              {artifactButton("TRAILER", session?.trailerUrl || "")}
            </div>
          </div>
        ))}
      </div>

      {sessions.length > SLOT_COUNT ? (
        <details className={styles.history}>
          <summary>Full Writer-in-Residence history · {sessions.length} sessions</summary>
          <div>
            {sessions.map((session) => (
              <button key={session.id} onClick={() => openSession(session.id)} type="button">
                <strong>{session.projectName}</strong>
                <span>{friendlyDate(session.generatedAt)} · {session.completionFrontier} · {session.completionState}</span>
              </button>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}
