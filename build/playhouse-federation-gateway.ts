import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "vite";
import { readCredentialJson, writeCredentialJson } from "./local-credentials";
import { createStudioEvent, serializeStudioEvent, type Availability, type PresenceInput, type Visibility } from "./playhouse-federation";
import { readPublicStudioIdentity } from "./studio-identity";

const API = "/api/playhouse-federation";
const FILE = "playhouse-presence.json";
type PresenceStore = { version: 1; availability: Availability; visibility: Visibility; publicRooms: string[]; agents: string[]; announcedAt: string; withdrawnAt: string; lastTransportError: string };
const DEFAULTS: PresenceStore = { version: 1, availability: "online", visibility: "contacts", publicRooms: ["great-hall"], agents: [], announcedAt: "", withdrawnAt: "", lastTransportError: "" };

function local(request: IncomingMessage) {
  const address = request.socket.remoteAddress || "";
  if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address)) return false;
  const host = request.headers.host || "";
  return host.startsWith("127.0.0.1") || host.startsWith("localhost") || host.startsWith("[::1]");
}
function send(response: ServerResponse, status: number, value: Record<string, unknown>) { response.statusCode = status; response.setHeader("Content-Type", "application/json; charset=utf-8"); response.setHeader("Cache-Control", "no-store"); response.end(JSON.stringify(value)); }
async function body(request: IncomingMessage) { const chunks: Buffer[] = []; let size = 0; for await (const chunk of request) { const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); size += part.length; if (size > 16 * 1024) throw new Error("The federation request is too large."); chunks.push(part); } const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"); if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Enter a valid federation request."); return value as Record<string, unknown>; }
async function readStore() { return (await readCredentialJson<PresenceStore>(FILE)) || structuredClone(DEFAULTS); }
function list(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 12) : []; }
function presence(input: Record<string, unknown>, previous: PresenceStore): PresenceInput {
  const availability: Availability = ["online", "away", "busy", "offline"].includes(String(input.availability)) ? input.availability as Availability : previous.availability;
  const visibility: Visibility = ["public", "contacts", "invisible"].includes(String(input.visibility)) ? input.visibility as Visibility : previous.visibility;
  return { availability, visibility, publicRooms: input.publicRooms ? list(input.publicRooms) : previous.publicRooms, agents: input.agents ? list(input.agents) : previous.agents };
}
function localBase(request: IncomingMessage) { const host = request.headers.host || ""; if (!/^(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(host)) throw new Error("Federation transport requires the local PlotPickle server."); return `http://${host}`; }
async function jsonFetch(url: string, init?: RequestInit) { const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) }, signal: AbortSignal.timeout(15_000) }); const value = await response.json() as Record<string, unknown>; if (!response.ok) throw new Error(typeof value.message === "string" ? value.message : `Local BUZZ transport returned ${response.status}.`); return value; }
async function deliver(request: IncomingMessage, content: string) {
  const base = localBase(request);
  const status = await jsonFetch(`${base}/api/local-buzz/community/status`);
  const hall = status.greatHall as { id?: unknown } | null;
  if (!hall || typeof hall.id !== "string") throw new Error("Connect BUZZ and prepare the Great Hall before announcing Studio presence.");
  await jsonFetch(`${base}/api/local-buzz/messages`, { method: "POST", body: JSON.stringify({ channel: hall.id, content }) });
  return hall.id;
}

export function registerPlayhouseFederationGateway(server: ViteDevServer) {
  server.middlewares.use((request, response, next) => {
    const pathname = request.url?.split("?", 1)[0] || "";
    if (pathname !== API) { next(); return; }
    if (!local(request)) { send(response, 403, { ok: false, message: "Playhouse federation is available only from this local Studio." }); return; }
    void (async () => {
      try {
        if (request.method === "GET") { send(response, 200, { ok: true, identity: await readPublicStudioIdentity(), presence: await readStore(), topology: "PlotPickle Studio -> BUZZ / PlotPickle Playhouse -> permitted Studios" }); return; }
        if (request.method !== "POST") { send(response, 405, { ok: false, message: "Use GET or POST for Playhouse federation." }); return; }
        const input = await body(request); const action = input.action === "withdraw" ? "withdraw" : input.action === "test" ? "test" : "announce";
        const store = await readStore(); const next = presence(input, store);
        const type = action === "withdraw" ? "studio.withdrawn" : action === "test" ? "studio.test" : "studio.presence";
        const event = await createStudioEvent(type, next); const channelId = await deliver(request, serializeStudioEvent(event)); const now = new Date().toISOString();
        store.availability = next.availability; store.visibility = next.visibility; store.publicRooms = next.publicRooms; store.agents = next.agents; store.lastTransportError = "";
        if (action === "withdraw") store.withdrawnAt = now; else store.announcedAt = now;
        await writeCredentialJson(FILE, store);
        send(response, 200, { ok: true, action, channelId, event: { type: event.type, studioId: event.studioId, displayName: event.displayName, availability: event.availability, visibility: event.visibility, sentAt: event.sentAt }, presence: store });
      } catch (error) {
        const store = await readStore().catch(() => structuredClone(DEFAULTS)); store.lastTransportError = error instanceof Error ? error.message : "BUZZ transport failed."; await writeCredentialJson(FILE, store).catch(() => undefined);
        send(response, 503, { ok: false, message: store.lastTransportError, localCreativeWorkAvailable: true });
      }
    })();
  });
}
