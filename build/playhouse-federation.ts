import { createPrivateKey, createPublicKey, randomUUID, sign, verify } from "node:crypto";
import { readStudioSigningIdentity, readStudioIdentity } from "./studio-identity";

export const PLAYHOUSE_PROTOCOL = "plotpickle-playhouse/1";
export const STUDIO_EVENT_MARKER = "[PLOTPICKLE_STUDIO_EVENT]";
export type Availability = "online" | "away" | "busy" | "offline";
export type Visibility = "public" | "contacts" | "invisible";
export type PresenceInput = { availability: Availability; visibility: Visibility; publicRooms: string[]; agents: string[] };
export type StudioEvent = {
  protocol: typeof PLAYHOUSE_PROTOCOL;
  eventId: string;
  type: "studio.presence" | "studio.withdrawn" | "studio.test";
  studioId: string;
  displayName: string;
  shortCode: string;
  availability: Availability;
  visibility: Visibility;
  compatibility: { protocol: number; app: string };
  publicRooms: string[];
  agents: string[];
  sentAt: string;
  signing: { algorithm: "Ed25519"; publicKeyPem: string; signature: string };
};

function safeList(value: string[], maximum = 12) {
  return value.filter((item) => /^[a-z0-9][a-z0-9-]{0,39}$/i.test(item)).slice(0, maximum);
}

export async function createStudioEvent(type: StudioEvent["type"], input: PresenceInput, now = new Date()): Promise<StudioEvent> {
  const [identity, signing] = await Promise.all([readStudioIdentity(), readStudioSigningIdentity()]);
  if (!identity || !signing) throw new Error("Create a PlotPickle Studio identity before joining the Playhouse.");
  const payload = {
    protocol: PLAYHOUSE_PROTOCOL,
    eventId: randomUUID(),
    type,
    studioId: identity.studioId,
    displayName: identity.displayName,
    shortCode: identity.shortCode,
    availability: type === "studio.withdrawn" ? "offline" as const : input.availability,
    visibility: input.visibility,
    compatibility: { protocol: 1, app: "PlotPickle" },
    publicRooms: safeList(input.publicRooms),
    agents: safeList(input.agents),
    sentAt: now.toISOString(),
  };
  const canonical = JSON.stringify(payload);
  const signature = sign(null, Buffer.from(canonical), createPrivateKey(signing.privateKeyPem)).toString("base64");
  return { ...payload, signing: { algorithm: "Ed25519", publicKeyPem: signing.publicKeyPem, signature } };
}

export function verifyStudioEvent(event: Record<string, unknown>) {
  const signing = event.signing as { algorithm?: unknown; publicKeyPem?: unknown; signature?: unknown } | undefined;
  if (signing?.algorithm !== "Ed25519" || typeof signing.publicKeyPem !== "string" || typeof signing.signature !== "string") return false;
  const { signing: _signing, ...payload } = event;
  try {
    return verify(null, Buffer.from(JSON.stringify(payload)), createPublicKey(signing.publicKeyPem), Buffer.from(signing.signature, "base64"));
  } catch { return false; }
}

function validStudioEvent(value: unknown): value is StudioEvent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const event = value as Partial<StudioEvent>;
  return event.protocol === PLAYHOUSE_PROTOCOL
    && ["studio.presence", "studio.withdrawn", "studio.test"].includes(String(event.type))
    && typeof event.eventId === "string"
    && /^pp_studio_[A-Z0-9]{8}$/.test(event.studioId || "")
    && typeof event.displayName === "string"
    && /^Studio [A-Z0-9]{4}$/.test(event.shortCode || "")
    && ["online", "away", "busy", "offline"].includes(String(event.availability))
    && ["public", "contacts", "invisible"].includes(String(event.visibility))
    && Array.isArray(event.publicRooms)
    && Array.isArray(event.agents)
    && typeof event.sentAt === "string"
    && Boolean(event.signing);
}

export function parseStudioEvent(content: string): StudioEvent | null {
  if (!content.startsWith(`${STUDIO_EVENT_MARKER}\n`)) return null;
  try {
    const value: unknown = JSON.parse(content.slice(STUDIO_EVENT_MARKER.length).trim());
    if (!validStudioEvent(value)) return null;
    return verifyStudioEvent(value as unknown as Record<string, unknown>) ? value : null;
  } catch { return null; }
}

export function serializeStudioEvent(event: Record<string, unknown>) {
  return `${STUDIO_EVENT_MARKER}\n${JSON.stringify(event)}`;
}
