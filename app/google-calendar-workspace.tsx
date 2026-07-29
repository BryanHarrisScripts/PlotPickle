"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { PublicConnectionStatus } from "@/lib/connection-status";
import type { PlotPickleProject } from "@/lib/project";
import styles from "./collab-workspace.module.css";

type CalendarEvent = {
  eventId: string;
  providerEventId: string;
  projectId: string;
  title: string;
  start: string;
  end: string;
  timeZone: string;
  status: "confirmed" | "cancelled" | "tentative";
  organizer: string;
  attendeeCount: number;
  updatedAt: string;
};

type Draft = { eventId: string; title: string; description: string; start: string; end: string; attendees: string };

function localInput(value: string) {
  const date = value ? new Date(value) : new Date(Date.now() + 60 * 60 * 1000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function blankDraft(): Draft {
  const start = new Date(Date.now() + 60 * 60 * 1000);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return { eventId: crypto.randomUUID(), title: "Project meeting", description: "", start: localInput(start.toISOString()), end: localInput(end.toISOString()), attendees: "" };
}

function messageFrom(value: unknown) {
  return value && typeof value === "object" && typeof (value as { message?: unknown }).message === "string"
    ? (value as { message: string }).message
    : "The Calendar operation did not complete.";
}

export default function GoogleCalendarWorkspace({
  project,
  google,
  onOpenSettings,
}: {
  project: PlotPickleProject;
  google: PublicConnectionStatus;
  onOpenSettings: () => void;
}) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [draft, setDraft] = useState<Draft>(() => blankDraft());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const connected = google.state === "connected";
  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", []);

  const load = useCallback(async () => {
    if (!connected) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/local-google/calendar?projectId=${encodeURIComponent(project.id)}`, { cache: "no-store" });
      const body = await response.json() as { ok?: boolean; events?: CalendarEvent[]; message?: string };
      if (!response.ok || !body.ok) throw new Error(messageFrom(body));
      setEvents(Array.isArray(body.events) ? body.events : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : messageFrom(reason));
    } finally {
      setBusy(false);
    }
  }, [connected, project.id]);

  useEffect(() => {
    const refreshTimer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(refreshTimer);
  }, [load]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const existing = events.some((item) => item.eventId === draft.eventId);
      const response = await fetch("/api/local-google/calendar", {
        method: existing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          eventId: draft.eventId,
          title: draft.title,
          description: draft.description,
          start: new Date(draft.start).toISOString(),
          end: new Date(draft.end).toISOString(),
          timeZone,
          attendees: draft.attendees.split(/[;,\n]/).map((item) => item.trim()).filter(Boolean),
        }),
      });
      const body = await response.json() as { ok?: boolean; event?: CalendarEvent; message?: string };
      if (!response.ok || !body.ok) throw new Error(messageFrom(body));
      setDraft(blankDraft());
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : messageFrom(reason));
    } finally {
      setBusy(false);
    }
  }

  async function cancel(item: CalendarEvent) {
    setBusy(true);
    setError("");
    try {
      const query = new URLSearchParams({ projectId: project.id, eventId: item.eventId });
      const response = await fetch(`/api/local-google/calendar?${query}`, { method: "DELETE" });
      const body = await response.json() as { ok?: boolean; message?: string };
      if (!response.ok || !body.ok) throw new Error(messageFrom(body));
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : messageFrom(reason));
    } finally {
      setBusy(false);
    }
  }

  if (!connected) {
    return (
      <section className={styles.emptyState}>
        <div className={styles.emptyIcon} aria-hidden="true">+</div>
        <div><span>Calendar · Project dates only</span><h2>Connect Google Calendar for shared project dates</h2><p>Only PlotPickle-created events for this project are shown. PlotPickle does not import the complete personal calendar.</p><button type="button" onClick={onOpenSettings}>Open Google settings</button></div>
      </section>
    );
  }

  return (
    <div className={styles.stack}>
      <section className={styles.sectionHeading}>
        <div><span>Calendar · Project dates only</span><h2>Schedule and manage {project.metadata.title} events</h2><p>Events are tagged privately with this project ID. Tokens remain in encrypted local credential storage; only sanitized event metadata reaches this screen.</p></div>
        <button type="button" onClick={() => void load()} disabled={busy}>{busy ? "Working…" : "Refresh"}</button>
      </section>

      {error ? <section className={styles.privacyCard}><strong>Calendar needs attention</strong><p>{error}</p></section> : null}

      <form className={styles.ruleCard} onSubmit={save}>
        <span>{events.some((item) => item.eventId === draft.eventId) ? "Update event" : "New project event"}</span>
        <h2>{draft.title || "Project event"}</h2>
        <label>Title<input required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
        <label>Description<textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
        <label>Start<input required type="datetime-local" value={draft.start} onChange={(event) => setDraft({ ...draft, start: event.target.value })} /></label>
        <label>End<input required type="datetime-local" value={draft.end} onChange={(event) => setDraft({ ...draft, end: event.target.value })} /></label>
        <label>Attendees<textarea placeholder="name@example.com; another@example.com" value={draft.attendees} onChange={(event) => setDraft({ ...draft, attendees: event.target.value })} /></label>
        <div><button type="submit" disabled={busy}>{events.some((item) => item.eventId === draft.eventId) ? "Update Calendar event" : "Create Calendar event"}</button>{events.some((item) => item.eventId === draft.eventId) ? <button type="button" onClick={() => setDraft(blankDraft())}>Cancel edit</button> : null}</div>
      </form>

      <section className={styles.summaryGrid} aria-label="Upcoming project events">
        {events.length ? events.map((item) => (
          <article key={item.eventId}>
            <span>{item.status}</span><strong>{item.title}</strong>
            <p>{new Date(item.start).toLocaleString()} – {new Date(item.end).toLocaleString()}</p>
            <small>{item.attendeeCount} attendee{item.attendeeCount === 1 ? "" : "s"} · {item.timeZone || timeZone}</small>
            <button type="button" onClick={() => setDraft({ eventId: item.eventId, title: item.title, description: "", start: localInput(item.start), end: localInput(item.end), attendees: "" })}>Reschedule</button>
            <button type="button" onClick={() => void cancel(item)} disabled={busy}>Cancel event</button>
          </article>
        )) : <article><span>Upcoming events</span><strong>No project events scheduled</strong><p>Create the first Calendar event above. Personal calendar entries are never listed here.</p></article>}
      </section>
    </div>
  );
}
