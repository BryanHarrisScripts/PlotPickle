"use client";

import { useEffect, useMemo, useState } from "react";
import { createEmptyProject } from "../../../../core/project/project";
import {
  archiveLibraryProject, createLibraryWorkingCopy, deleteArchivedLibraryProject,
  listLibraryProjects, stageSessionActiveProjectHandoff, switchActiveLibraryProject,
} from "../../../../core/storage/project-library-browser";
import { deleteArchivedProfileProjectFromVault, persistActiveProfileProject } from "../../../../core/storage/profile-private-browser";
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
  destination.searchParams.set("workspace", "library");
  destination.searchParams.set("averySession", sessionId);
  window.location.assign(`${destination.pathname}${destination.search}`);
}

function closeSession() {
  const destination = new URL(window.location.href);
  destination.searchParams.delete("averySession");
  destination.searchParams.set("workspace", "dashboard");
  window.location.assign(`${destination.pathname}${destination.search}`);
}

function SessionReview({ detail }: { readonly detail: SessionDetail }) {
  const { report, summary } = detail;
  const visited = report.journeyCoverage?.writerVisitedScreens || [];
  const diary = report.diary || [];
  const findings = report.promotedFindings?.length ? report.promotedFindings : report.observations || [];
  const visualScreens = report.visualReview?.screens || [];

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
        <div><span>Last stage</span><strong>{summary.completionFrontier || "Not recorded"}</strong></div>
        <div><span>Status</span><strong>{summary.completionState || "Recorded"}</strong></div>
        <div><span>Review notes</span><strong>{summary.findingCount + summary.frictionCount}</strong></div>
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
        <h3>Review notes</h3>
        <div className={styles.findings}>
          {findings.length ? findings.map((finding, index) => (
            <article key={`${finding.kind || "finding"}-${index}`}>
              <header><strong>{(finding.kind || "finding").toUpperCase()}</strong><span>{finding.severity || "unrated"}</span></header>
              <p>{finding.summary || "Finding recorded without a summary."}</p>
              {finding.impact ? <small>{finding.impact}</small> : null}
            </article>
          )) : <p>No review notes were recorded.</p>}
        </div>
      </section>

      <section className={styles.reviewSection}>
        <h3>Visual review</h3>
        <div className={styles.visualList}>
          {visualScreens.length ? visualScreens.map((screen, index) => (
            <article key={`${screen.id || screen.label || "screen"}-${index}`}>
              <strong>{screen.label || screen.id || "Reviewed screen"}</strong>
              {(screen.findings || []).length
                ? (screen.findings || []).map((finding, findingIndex) => <p key={findingIndex}>{finding.severity || "review"}: {finding.summary}</p>)
                : <p>No visual-layout note.</p>}
            </article>
          )) : <p>No visual review was recorded.</p>}
        </div>
      </section>

      {report.runnerFindings?.length ? (
        <section className={styles.reviewSection}>
          <h3>Session recovery notes</h3>
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
  const [deleting, setDeleting] = useState("");
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
  const latestSession = sessions[0] || null;
  const storyCount = new Set(sessions.map((session) => session.projectName)).size;

  async function openStory(session: SessionSummary) {
    setNotice("Opening Avery's synthetic story…");
    try {
      const existing = listLibraryProjects().find((item) => item.sourceKind === "synthetic" && item.sourceId === session.id);
      if (existing) switchActiveLibraryProject(existing.id);
      else {
        const response = await fetch(`${API}?session=${encodeURIComponent(session.id)}`, { cache: "no-store" });
        const body = await response.json();
        if (!response.ok || !body.session?.report) throw new Error(body.message || "Avery session report is unavailable.");
        const report = body.session.report as SessionDetail["report"];
        const now = new Date().toISOString();
        const reference = createEmptyProject({ id: `avery-session-${session.id}`, title: session.projectName, now });
        const provenance = `Synthetic Avery session ${session.id}. Reconstructed from the saved session report; this is not a complete project snapshot.`;
        const content = [provenance, report.storySeed?.premise, report.storyMemory].filter(Boolean).join("\n\n");
        createLibraryWorkingCopy({
          sourceProject: { ...reference, foundations: { ...reference.foundations, brief: { content, savedAt: now } } },
          sourceKind: "synthetic", sourceId: session.id, title: session.projectName,
          genre: "Avery synthetic story", format: report.storySeed?.format || "Story",
        });
      }
      await persistActiveProfileProject();
      if (window.location.pathname === "/skin-v1") {
        window.dispatchEvent(new CustomEvent("plotpickle:return-dashboard", {
          detail: { sourceSurface: "library-avery" },
        }));
      } else {
        stageSessionActiveProjectHandoff();
        window.location.assign("/?workspace=dashboard");
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Avery story could not be opened.");
    }
  }

  async function deleteSession(session: SessionSummary) {
    if (!window.confirm(`Permanently delete Avery story “${session.projectName}”? This cannot be undone.`)) return;
    setDeleting(session.id);
    try {
      const copy = listLibraryProjects().find((item) => item.sourceKind === "synthetic" && item.sourceId === session.id);
      if (copy) {
        archiveLibraryProject(copy.id);
        await persistActiveProfileProject();
        await deleteArchivedProfileProjectFromVault(copy.id);
        deleteArchivedLibraryProject(copy.id);
      }
      const response = await fetch(`${API}?session=${encodeURIComponent(session.id)}`, { method: "DELETE" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message || "Avery story could not be deleted.");
      setSessions((current) => current.filter((item) => item.id !== session.id));
      setNotice(`${session.projectName} was deleted permanently.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Avery story could not be deleted.");
    } finally {
      setDeleting("");
    }
  }

  return (
    <section className={styles.panel} aria-label="Avery Writer-in-Residence sessions">
      <header className={styles.heading}>
        <div>
          <p className={styles.kicker}>Writer-in-Residence · Avery North</p>
          <h2>Synthetic writer history</h2>
          <p>Read-only Avery work stays separate from Human-owned stories and never enters the Human archive lifecycle.</p>
        </div>
      </header>

      <div className={styles.kpiGrid} aria-label="Avery status">
        <div><span>Sessions</span><strong>{sessions.length}</strong></div>
        <div><span>Synthetic stories</span><strong>{storyCount}</strong></div>
        <div><span>Latest activity</span><strong>{latestSession ? friendlyDate(latestSession.generatedAt) : "No runs yet"}</strong></div>
        <div><span>Status</span><strong>{latestSession?.completionState || "Idle"}</strong></div>
      </div>

      {notice ? <p aria-atomic="true" aria-live="polite" className={styles.notice} role="status">{notice}</p> : null}

      <div className={styles.slotGrid}>
        {slots.map((session, index) => (
          <div className={styles.slotWrap} key={session?.id || `empty-${index}`}>
            <div
              className={styles.sessionCard}
              data-empty={!session}
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
                    <span>{session.completionState || "Recorded"}</span>
                  </>
                ) : (
                  <>
                    <small>UNUSED SESSION SLOT {index + 1}</small>
                    <strong>Waiting for Avery</strong>
                    <span>No synthetic run is stored here yet.</span>
                  </>
                )}
              </span>
            </div>
            {session ? <div className={styles.pills} aria-label={`Avery story ${index + 1} actions`}>
              <button className={styles.storyAction} onClick={() => void openStory(session)} type="button">Open Story</button>
              <button className={styles.deleteAction} disabled={deleting === session.id} onClick={() => void deleteSession(session)} type="button">{deleting === session.id ? "Deleting…" : "Delete"}</button>
            </div> : null}
          </div>
        ))}
      </div>

      {sessions.length > SLOT_COUNT ? (
        <details className={styles.history}>
          <summary>Full Writer-in-Residence history · {sessions.length} sessions</summary>
          <div>
            {sessions.map((session) => (
              <div key={session.id}>
                <strong>{session.projectName}</strong>
                <span>{friendlyDate(session.generatedAt)} · {session.completionState || "Recorded"}</span>
                <button onClick={() => void openStory(session)} type="button">Open Story</button>
                <button disabled={deleting === session.id} onClick={() => void deleteSession(session)} type="button">Delete</button>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}
