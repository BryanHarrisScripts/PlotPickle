"use client";

import { useCallback, useEffect, useState } from "react";
import type { PublicConnectionStatus } from "@/lib/connection-status";
import type { PlotPickleProject } from "@/lib/project";
import styles from "./collab-workspace.module.css";

type ConferenceStatus = "none" | "pending" | "success" | "failure";

type ProjectMeeting = {
  eventId: string;
  providerEventId: string;
  projectId: string;
  title: string;
  start: string;
  end: string;
  timeZone: string;
  status: "confirmed" | "cancelled" | "tentative";
  meetingId: string;
  meetUrl: string;
  conferenceStatus: ConferenceStatus;
};

function messageFrom(value: unknown) {
  return value && typeof value === "object" && typeof (value as { message?: unknown }).message === "string"
    ? (value as { message: string }).message
    : "The Google Meet operation did not complete.";
}

function conferenceLabel(status: ConferenceStatus) {
  if (status === "success") return "Ready";
  if (status === "pending") return "Creating link";
  if (status === "failure") return "Needs attention";
  return "Not created";
}

export default function GoogleMeetWorkspace({
  project,
  google,
  onOpenSettings,
}: {
  project: PlotPickleProject;
  google: PublicConnectionStatus;
  onOpenSettings: () => void;
}) {
  const [meetings, setMeetings] = useState<ProjectMeeting[]>([]);
  const [busyEventId, setBusyEventId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const connected = google.state === "connected";

  const load = useCallback(async () => {
    if (!connected) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/local-google/calendar?projectId=${encodeURIComponent(project.id)}`, { cache: "no-store" });
      const body = await response.json() as { ok?: boolean; events?: ProjectMeeting[]; message?: string };
      if (!response.ok || !body.ok) throw new Error(messageFrom(body));
      setMeetings(Array.isArray(body.events) ? body.events : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : messageFrom(reason));
    } finally {
      setLoading(false);
    }
  }, [connected, project.id]);

  useEffect(() => {
    const refreshTimer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(refreshTimer);
  }, [load]);

  async function createMeetLink(item: ProjectMeeting) {
    setBusyEventId(item.eventId);
    setError("");
    try {
      const response = await fetch("/api/local-google/meet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id, eventId: item.eventId }),
      });
      const body = await response.json() as { ok?: boolean; event?: ProjectMeeting; message?: string };
      if (!response.ok || !body.ok) throw new Error(messageFrom(body));
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : messageFrom(reason));
    } finally {
      setBusyEventId("");
    }
  }

  function openMeetLink(item: ProjectMeeting) {
    try {
      const url = new URL(item.meetUrl);
      if (url.protocol !== "https:" || url.hostname !== "meet.google.com" || url.username || url.password) {
        throw new Error("PlotPickle received an invalid Google Meet link.");
      }
      const opened = window.open(url.toString(), "_blank", "noopener,noreferrer");
      if (!opened) setError("Your browser blocked the Google Meet window. Allow pop-ups for this local PlotPickle server and try again.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : messageFrom(reason));
    }
  }

  if (!connected) {
    return (
      <section className={styles.emptyState}>
        <div className={styles.emptyIcon} aria-hidden="true">+</div>
        <div><span>Meetings · Google Meet</span><h2>Connect Google to create project meeting links</h2><p>Google is optional. PlotPickle remains fully usable for local writing and GitHub collaboration without it.</p><button type="button" onClick={onOpenSettings}>Open Google settings</button></div>
      </section>
    );
  }

  return (
    <div className={styles.stack}>
      <section className={styles.sectionHeading}>
        <div><span>Meetings · Google Meet</span><h2>{project.metadata.title} meeting room</h2><p>Each Calendar event receives its own conference request. Only the sanitized meeting ID, event ID, join URL and status reach this screen.</p></div>
        <button type="button" onClick={() => void load()} disabled={loading}>{loading ? "Refreshing…" : "Refresh"}</button>
      </section>

      {error ? (
        <section className={styles.privacyCard}>
          <strong>Google Meet needs attention</strong>
          <p>{error} The Calendar event remains available; reconnect or review permissions in Settings if needed.</p>
          <button type="button" onClick={onOpenSettings}>Open Google settings</button>
        </section>
      ) : null}

      <section className={styles.summaryGrid} aria-label="Upcoming project meetings">
        {meetings.length ? meetings.map((item) => {
          const working = busyEventId === item.eventId;
          const ready = item.conferenceStatus === "success" && Boolean(item.meetUrl);
          return (
            <article key={item.eventId}>
              <span>Google Meet · {conferenceLabel(item.conferenceStatus)}</span>
              <strong>{item.title}</strong>
              <p>{new Date(item.start).toLocaleString()} – {new Date(item.end).toLocaleString()}</p>
              <small>Calendar event {item.providerEventId.slice(0, 12)}</small>
              {ready ? <button type="button" onClick={() => openMeetLink(item)}>Open Google Meet</button> : null}
              {item.conferenceStatus === "none" ? <button type="button" onClick={() => void createMeetLink(item)} disabled={working}>{working ? "Creating…" : "Create Meet link"}</button> : null}
              {item.conferenceStatus === "pending" ? <p>The Calendar event is saved. Conference creation is still processing; refresh shortly.</p> : null}
              {item.conferenceStatus === "failure" ? <p>The Calendar event is safe, but Google did not create its conference. Review the Google connection before creating a new meeting.</p> : null}
            </article>
          );
        }) : (
          <article>
            <span>Upcoming meetings</span>
            <strong>No project meetings scheduled</strong>
            <p>Create the first event in Collab → Calendar. PlotPickle will request one unique Meet conference for it.</p>
          </article>
        )}
      </section>

      <section className={styles.privacyCard}>
        <strong>Deliberate join boundary</strong>
        <p>PlotPickle never opens a meeting automatically. The Google Meet page opens only when you choose Open Google Meet.</p>
      </section>
    </div>
  );
}
