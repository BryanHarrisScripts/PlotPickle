import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import {
  attachMeetConference,
  cancelCalendarEvent,
  createCalendarEvent,
  listCalendarEvents,
  updateCalendarEvent,
} from "./google-calendar";

const CALENDAR_API = "/api/local-google/calendar";
const MEET_API = "/api/local-google/meet";

function isLoopback(value: string | undefined) {
  return value === "127.0.0.1" || value === "::1" || value === "::ffff:127.0.0.1";
}

function isLocalRequest(request: IncomingMessage) {
  if (!isLoopback(request.socket.remoteAddress)) return false;
  const host = request.headers.host;
  if (!host) return false;
  try {
    const hostUrl = new URL(`http://${host}`);
    if (!["127.0.0.1", "localhost", "[::1]"].includes(hostUrl.hostname)) return false;
    const origin = request.headers.origin;
    return !origin || new URL(origin).host === hostUrl.host;
  } catch {
    return false;
  }
}

function sendJson(response: ServerResponse, statusCode: number, body: Record<string, unknown>) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(body));
}

async function readBody(request: IncomingMessage, maximum = 48 * 1024): Promise<unknown> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += value.length;
    if (length > maximum) throw new Error("The Google Calendar or Meet request is too large.");
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : "The Google Calendar or Meet operation failed.";
  return message
    .replace(/ya29\.[A-Za-z0-9._-]+/g, "[redacted]")
    .replace(/1\/\/[A-Za-z0-9._-]+/g, "[redacted]")
    .replace(/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted-token]")
    .slice(0, 500);
}

async function handle(request: IncomingMessage, response: ServerResponse, url: URL) {
  if (request.method === "GET" && url.pathname === CALENDAR_API) {
    const events = await listCalendarEvents(url.searchParams.get("projectId"));
    sendJson(response, 200, { ok: true, events });
    return;
  }
  if (request.method === "POST" && url.pathname === CALENDAR_API) {
    const event = await createCalendarEvent(await readBody(request));
    sendJson(response, 200, { ok: true, event });
    return;
  }
  if (request.method === "PUT" && url.pathname === CALENDAR_API) {
    const event = await updateCalendarEvent(await readBody(request));
    sendJson(response, 200, { ok: true, event });
    return;
  }
  if (request.method === "DELETE" && url.pathname === CALENDAR_API) {
    const result = await cancelCalendarEvent(url.searchParams.get("projectId"), url.searchParams.get("eventId"));
    sendJson(response, 200, { ok: true, event: result });
    return;
  }
  if (request.method === "POST" && url.pathname === MEET_API) {
    const value = await readBody(request);
    const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const event = await attachMeetConference(input.projectId, input.eventId);
    sendJson(response, 200, { ok: true, event });
    return;
  }
  sendJson(response, 404, { ok: false, message: "Google Calendar or Meet operation not found." });
}

export function googleCalendarGateway(): Plugin {
  return {
    name: "plotpickle-google-calendar-gateway",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const rawUrl = request.url;
        if (!rawUrl) { next(); return; }
        const url = new URL(rawUrl, "http://127.0.0.1");
        if (url.pathname !== CALENDAR_API && url.pathname !== MEET_API) { next(); return; }
        if (!isLocalRequest(request)) {
          sendJson(response, 403, { ok: false, message: "Calendar and Meet actions accept requests only from this local PlotPickle server." });
          return;
        }
        void handle(request, response, url).catch((error) => {
          sendJson(response, 400, { ok: false, message: safeError(error) });
        });
      });
    },
  };
}
