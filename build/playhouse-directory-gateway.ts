import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "vite";
import { readCredentialJson, writeCredentialJson } from "./local-credentials";
import { parseStudioEvent, type StudioEvent } from "./playhouse-federation";
import { readPublicStudioIdentity } from "./studio-identity";

const API = "/api/playhouse-directory";
const FILE = "playhouse-directory-moderation.json";
const STUDIO_ID = /^pp_studio_[2-9A-HJ-NP-Z]{8}$/;
type Report = { studioId: string; displayName: string; shortCode: string; reason: string; createdAt: string };
type DirectoryStore = { version: 1; contacts: string[]; blocked: string[]; reports: Report[] };
const EMPTY: DirectoryStore = { version: 1, contacts: [], blocked: [], reports: [] };

type RawMessage = { content?: unknown; createdAt?: unknown };
type PublicStudio = {
  studioId: string; displayName: string; shortCode: string; availability: StudioEvent["availability"];
  visibility: StudioEvent["visibility"]; publicRooms: string[]; agents: string[]; lastSeen: string;
  relationship: "public" | "contact"; compatible: boolean;
};

function local(request: IncomingMessage) {
  const address = request.socket.remoteAddress || "";
  if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address)) return false;
  return /^(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(request.headers.host || "");
}
function send(response: ServerResponse, status: number, value: Record<string, unknown>) {
  response.statusCode = status; response.setHeader("Content-Type", "application/json; charset=utf-8"); response.setHeader("Cache-Control", "no-store"); response.end(JSON.stringify(value));
}
async function body(request: IncomingMessage) {
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of request) { const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); size += part.length; if (size > 12 * 1024) throw new Error("The Connected Studios request is too large."); chunks.push(part); }
  const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Enter a valid Connected Studios request.");
  return value as Record<string, unknown>;
}
async function store() { return (await readCredentialJson<DirectoryStore>(FILE)) || structuredClone(EMPTY); }
function localBase(request: IncomingMessage) { return `http://${request.headers.host}`; }
async function jsonFetch(url: string) {
  const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12_000) });
  const value = await response.json() as Record<string, unknown>;
  if (!response.ok) throw new Error(typeof value.message === "string" ? value.message : `BUZZ returned ${response.status}.`);
  return value;
}
function latestByStudio(messages: RawMessage[]) {
  const latest = new Map<string, StudioEvent>();
  for (const message of messages) {
    if (typeof message.content !== "string") continue;
    const event = parseStudioEvent(message.content);
    if (!event || event.type === "studio.test") continue;
    const previous = latest.get(event.studioId);
    if (!previous || Date.parse(event.sentAt) >= Date.parse(previous.sentAt)) latest.set(event.studioId, event);
  }
  return latest;
}
async function rawEvents(request: IncomingMessage) {
  const base = localBase(request);
  const status = await jsonFetch(`${base}/api/local-buzz/community/status`);
  const hall = status.greatHall as { id?: unknown } | null;
  if (!hall || typeof hall.id !== "string") throw new Error("Connect BUZZ and prepare the Great Hall to discover Playhouse Studios.");
  const result = await jsonFetch(`${base}/api/local-buzz/messages?channel=${encodeURIComponent(hall.id)}&limit=100`);
  return latestByStudio(Array.isArray(result.messages) ? result.messages as RawMessage[] : []);
}
function publicStudio(event: StudioEvent, contacts: Set<string>): PublicStudio {
  return {
    studioId: event.studioId,
    displayName: event.displayName.slice(0, 90),
    shortCode: event.shortCode,
    availability: event.type === "studio.withdrawn" ? "offline" : event.availability,
    visibility: event.visibility,
    publicRooms: event.publicRooms.slice(0, 12),
    agents: event.agents.slice(0, 12),
    lastSeen: event.sentAt,
    relationship: contacts.has(event.studioId) ? "contact" : "public",
    compatible: event.compatibility?.app === "PlotPickle" && event.compatibility?.protocol === 1,
  };
}
async function directory(request: IncomingMessage) {
  const moderation = await store();
  const contacts = new Set(moderation.contacts); const blocked = new Set(moderation.blocked);
  const own = await readPublicStudioIdentity();
  try {
    const events = await rawEvents(request);
    const studios = [...events.values()].flatMap((event) => {
      if (own.configured && event.studioId === own.studioId) return [];
      if (blocked.has(event.studioId) || event.visibility === "invisible") return [];
      if (event.visibility === "contacts" && !contacts.has(event.studioId)) return [];
      return [publicStudio(event, contacts)];
    }).sort((left, right) => Date.parse(right.lastSeen) - Date.parse(left.lastSeen));
    return { ok: true, playhouseOnline: true, studios, contacts: moderation.contacts, blockedCount: moderation.blocked.length, reportCount: moderation.reports.length, message: studios.length ? `${studios.length} permitted PlotPickle Studio${studios.length === 1 ? "" : "s"} found.` : "No permitted Studios are advertising presence right now.", localCreativeWorkAvailable: true };
  } catch (error) {
    return { ok: true, playhouseOnline: false, studios: [] as PublicStudio[], contacts: moderation.contacts, blockedCount: moderation.blocked.length, reportCount: moderation.reports.length, message: `${error instanceof Error ? error.message : "Playhouse discovery is offline."} Local creative work remains available.`, localCreativeWorkAvailable: true };
  }
}
function studioId(value: unknown) { const id = typeof value === "string" ? value : ""; if (!STUDIO_ID.test(id)) throw new Error("Choose a valid PlotPickle Studio."); return id; }
async function mutate(request: IncomingMessage, input: Record<string, unknown>) {
  const action = String(input.action || ""); const id = studioId(input.studioId); const current = await store();
  if (action === "contact") current.contacts = [...new Set([...current.contacts, id])];
  else if (action === "remove-contact") current.contacts = current.contacts.filter((item) => item !== id);
  else if (action === "block") { current.blocked = [...new Set([...current.blocked, id])]; current.contacts = current.contacts.filter((item) => item !== id); }
  else if (action === "unblock") current.blocked = current.blocked.filter((item) => item !== id);
  else if (action === "report") {
    const events = await rawEvents(request).catch(() => new Map<string, StudioEvent>()); const event = events.get(id);
    const reason = typeof input.reason === "string" ? input.reason.replace(/\s+/g, " ").trim().slice(0, 500) : "";
    current.reports = [...current.reports, { studioId: id, displayName: event?.displayName || "Unknown Studio", shortCode: event?.shortCode || id.slice(-4), reason: reason || "Reported from Connected Studios", createdAt: new Date().toISOString() }].slice(-100);
  } else throw new Error("Choose a supported Connected Studios action.");
  await writeCredentialJson(FILE, current);
  return directory(request);
}

export function registerPlayhouseDirectoryGateway(server: ViteDevServer) {
  server.middlewares.use((request, response, next) => {
    const pathname = request.url?.split("?", 1)[0] || "";
    if (pathname !== API) { next(); return; }
    if (!local(request)) { send(response, 403, { ok: false, message: "Connected Studios is available only inside this local PlotPickle Studio." }); return; }
    void (async () => {
      try {
        if (request.method === "GET") { send(response, 200, await directory(request)); return; }
        if (request.method === "POST") { send(response, 200, await mutate(request, await body(request))); return; }
        send(response, 405, { ok: false, message: "Use GET or POST for Connected Studios." });
      } catch (error) { send(response, 400, { ok: false, message: error instanceof Error ? error.message : "Connected Studios could not complete that action." }); }
    })();
  });
}
