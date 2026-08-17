import { createPrivateKey, createPublicKey, randomUUID, sign, verify } from "node:crypto";
import { readStudioSigningIdentity, readStudioIdentity } from "./studio-identity";

export const PLAYHOUSE_PROTOCOL = "plotpickle-playhouse/1";
export const STUDIO_EVENT_MARKER = "[PLOTPICKLE_STUDIO_EVENT]";
export type Availability = "online" | "away" | "offline";
export type Visibility = "public" | "contacts" | "invisible";
export type PresenceInput = { availability: Availability; visibility: Visibility; publicRooms: string[]; agents: string[] };

function safeList(value: string[], maximum = 12) {
  return value.filter((item) => /^[a-z0-9][a-z0-9-]{0,39}$/i.test(item)).slice(0, maximum);
}

export async function createStudioEvent(type: "studio.presence" | "studio.withdrawn" | "studio.test", input: PresenceInput, now = new Date()) {
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
  return { ...payload, signing: { algorithm: "Ed25519" as const, publicKeyPem: signing.publicKeyPem, signature } };
}

export function verifyStudioEvent(event: Record<string, unknown>) {
  const signing = event.signing as { algorithm?: unknown; publicKeyPem?: unknown; signature?: unknown } | undefined;
  if (signing?.algorithm !== "Ed25519" || typeof signing.publicKeyPem !== "string" || typeof signing.signature !== "string") return false;
  const { signing: _signing, ...payload } = event;
  try {
    return verify(null, Buffer.from(JSON.stringify(payload)), createPublicKey(signing.publicKeyPem), Buffer.from(signing.signature, "base64"));
  } catch { return false; }
}

export function serializeStudioEvent(event: Record<string, unknown>) {
  return `${STUDIO_EVENT_MARKER}\n${JSON.stringify(event)}`;
}
