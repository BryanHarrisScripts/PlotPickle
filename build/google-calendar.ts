import { createHash } from "node:crypto";
import { GOOGLE_CALENDAR_SCOPE } from "../lib/connection-status";
import { checkGoogleConnection } from "./google-desktop-oauth";

const CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const PLOTPICKLE_PRIVATE_KEY = "plotpickle";

export type PlotPickleCalendarEventInput = {
  projectId: string;
  eventId: string;
  title: string;
  description: string;
  start: string;
  end: string;
  timeZone: string;
  attendees: string[];
};

export type PlotPickleCalendarEvent = {
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

type GoogleEvent = Record<string, unknown>;

function requiredText(value: unknown, label: string, maximum = 500) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim().slice(0, maximum);
}

function optionalText(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function validDateTime(value: unknown, label: string) {
  const text = requiredText(value, label, 80);
  if (!Number.isFinite(Date.parse(text))) throw new Error(`${label} must be a valid date and time.`);
  return text;
}

function attendees(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.flatMap((item) => {
    if (typeof item !== "string") return [];
    const email = item.trim().toLowerCase();
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? [email] : [];
  }))].slice(0, 50);
}

export function normalizeCalendarInput(value: unknown): PlotPickleCalendarEventInput {
  const candidate = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const start = validDateTime(candidate.start, "Start time");
  const end = validDateTime(candidate.end, "End time");
  if (Date.parse(end) <= Date.parse(start)) throw new Error("End time must be after the start time.");
  return {
    projectId: requiredText(candidate.projectId, "Project ID", 160),
    eventId: requiredText(candidate.eventId, "PlotPickle event ID", 160),
    title: requiredText(candidate.title, "Event title", 300),
    description: optionalText(candidate.description, 8_000),
    start,
    end,
    timeZone: requiredText(candidate.timeZone, "Time zone", 100),
    attendees: attendees(candidate.attendees),
  };
}

function providerEventId(projectId: string, eventId: string) {
  // Google custom event IDs accept base32hex characters. A deterministic ID makes
  // interrupted create requests safe to retry without creating another event.
  return createHash("sha256").update(`${projectId}\0${eventId}`).digest("hex").slice(0, 48);
}

async function authorizedRequest(path: string, init: RequestInit = {}) {
  const connection = await checkGoogleConnection();
  if (!connection.scopes.includes(GOOGLE_CALENDAR_SCOPE)) throw new Error("Google Calendar permission is not granted. Open Settings → Google Services and reconnect.");
  const response = await fetch(`${CALENDAR_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${connection.accessToken}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  let body: Record<string, unknown> = {};
  try { body = text ? JSON.parse(text) as Record<string, unknown> : {}; } catch { /* Safe message below. */ }
  if (!response.ok) {
    const providerMessage = body.error && typeof body.error === "object" && typeof (body.error as Record<string, unknown>).message === "string"
      ? (body.error as Record<string, unknown>).message as string
      : "Google Calendar did not complete the request.";
    throw new Error(providerMessage);
  }
  return body;
}

function dateTime(value: unknown) {
  if (!value || typeof value !== "object") return { dateTime: "", timeZone: "" };
  const row = value as Record<string, unknown>;
  return {
    dateTime: typeof row.dateTime === "string" ? row.dateTime : typeof row.date === "string" ? row.date : "",
    timeZone: typeof row.timeZone === "string" ? row.timeZone : "",
  };
}

function sanitizeEvent(value: GoogleEvent): PlotPickleCalendarEvent {
  const extended = value.extendedProperties && typeof value.extendedProperties === "object"
    ? (value.extendedProperties as Record<string, unknown>).private
    : null;
  const privateProperties = extended && typeof extended === "object" ? extended as Record<string, unknown> : {};
  const start = dateTime(value.start);
  const end = dateTime(value.end);
  const organizer = value.organizer && typeof value.organizer === "object" ? value.organizer as Record<string, unknown> : {};
  const status = value.status === "cancelled" || value.status === "tentative" ? value.status : "confirmed";
  return {
    eventId: typeof privateProperties.plotpickleEventId === "string" ? privateProperties.plotpickleEventId : "",
    providerEventId: typeof value.id === "string" ? value.id : "",
    projectId: typeof privateProperties.plotpickleProjectId === "string" ? privateProperties.plotpickleProjectId : "",
    title: typeof value.summary === "string" ? value.summary : "Untitled event",
    start: start.dateTime,
    end: end.dateTime,
    timeZone: start.timeZone || end.timeZone,
    status,
    organizer: typeof organizer.email === "string" ? organizer.email : "",
    attendeeCount: Array.isArray(value.attendees) ? value.attendees.length : 0,
    updatedAt: typeof value.updated === "string" ? value.updated : "",
  };
}

function providerBody(input: PlotPickleCalendarEventInput) {
  return {
    id: providerEventId(input.projectId, input.eventId),
    summary: input.title,
    description: input.description,
    start: { dateTime: input.start, timeZone: input.timeZone },
    end: { dateTime: input.end, timeZone: input.timeZone },
    attendees: input.attendees.map((email) => ({ email })),
    extendedProperties: {
      private: {
        [PLOTPICKLE_PRIVATE_KEY]: "calendar-event-v1",
        plotpickleProjectId: input.projectId,
        plotpickleEventId: input.eventId,
      },
    },
  };
}

export async function createCalendarEvent(value: unknown) {
  const input = normalizeCalendarInput(value);
  const id = providerEventId(input.projectId, input.eventId);
  try {
    return sanitizeEvent(await authorizedRequest(`/calendars/primary/events/${encodeURIComponent(id)}`));
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!/not found|404/i.test(message)) throw error;
  }
  const created = await authorizedRequest("/calendars/primary/events?sendUpdates=all", {
    method: "POST",
    body: JSON.stringify(providerBody(input)),
  });
  return sanitizeEvent(created);
}

export async function listCalendarEvents(projectIdValue: unknown) {
  const projectId = requiredText(projectIdValue, "Project ID", 160);
  const query = new URLSearchParams({
    singleEvents: "true",
    showDeleted: "false",
    orderBy: "startTime",
    timeMin: new Date().toISOString(),
    maxResults: "100",
    privateExtendedProperty: `plotpickleProjectId=${projectId}`,
  });
  const body = await authorizedRequest(`/calendars/primary/events?${query}`);
  return (Array.isArray(body.items) ? body.items : [])
    .filter((item): item is GoogleEvent => Boolean(item && typeof item === "object"))
    .map(sanitizeEvent)
    .filter((item) => item.projectId === projectId && item.eventId);
}

export async function updateCalendarEvent(value: unknown) {
  const input = normalizeCalendarInput(value);
  const id = providerEventId(input.projectId, input.eventId);
  const updated = await authorizedRequest(`/calendars/primary/events/${encodeURIComponent(id)}?sendUpdates=all`, {
    method: "PUT",
    body: JSON.stringify(providerBody(input)),
  });
  return sanitizeEvent(updated);
}

export async function cancelCalendarEvent(projectIdValue: unknown, eventIdValue: unknown) {
  const projectId = requiredText(projectIdValue, "Project ID", 160);
  const eventId = requiredText(eventIdValue, "PlotPickle event ID", 160);
  const id = providerEventId(projectId, eventId);
  await authorizedRequest(`/calendars/primary/events/${encodeURIComponent(id)}?sendUpdates=all`, { method: "DELETE" });
  return { eventId, providerEventId: id, projectId, status: "cancelled" as const };
}
