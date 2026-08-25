import { createHash } from "node:crypto";

const FIELD_P = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn;
const GROUP_N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const GENERATOR = {
  x: 0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n,
  y: 0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n,
};
const HEX_32 = /^[a-f0-9]{64}$/i;
const HEX_64 = /^[a-f0-9]{128}$/i;

function mod(value, modulus = FIELD_P) {
  const result = value % modulus;
  return result >= 0n ? result : result + modulus;
}

function powMod(base, exponent, modulus = FIELD_P) {
  let result = 1n;
  let factor = mod(base, modulus);
  let power = exponent;
  while (power > 0n) {
    if (power & 1n) result = mod(result * factor, modulus);
    factor = mod(factor * factor, modulus);
    power >>= 1n;
  }
  return result;
}

function inverse(value) {
  if (mod(value) === 0n) throw new Error("Point inversion is undefined.");
  return powMod(value, FIELD_P - 2n);
}

function jacobianInfinity() {
  return { x: 0n, y: 1n, z: 0n };
}

function fromAffine(point) {
  return point ? { x: point.x, y: point.y, z: 1n } : jacobianInfinity();
}

function jacobianDouble(point) {
  if (point.z === 0n || point.y === 0n) return jacobianInfinity();
  const yy = mod(point.y * point.y);
  const yyyy = mod(yy * yy);
  const xx = mod(point.x * point.x);
  const s = mod(4n * point.x * yy);
  const m = mod(3n * xx);
  const x = mod(m * m - 2n * s);
  const y = mod(m * (s - x) - 8n * yyyy);
  const z = mod(2n * point.y * point.z);
  return { x, y, z };
}

function jacobianAdd(left, right) {
  if (left.z === 0n) return right;
  if (right.z === 0n) return left;

  const z1z1 = mod(left.z * left.z);
  const z2z2 = mod(right.z * right.z);
  const u1 = mod(left.x * z2z2);
  const u2 = mod(right.x * z1z1);
  const s1 = mod(left.y * right.z * z2z2);
  const s2 = mod(right.y * left.z * z1z1);
  if (u1 === u2) return s1 === s2 ? jacobianDouble(left) : jacobianInfinity();

  const h = mod(u2 - u1);
  const i = mod((2n * h) * (2n * h));
  const j = mod(h * i);
  const r = mod(2n * (s2 - s1));
  const v = mod(u1 * i);
  const x = mod(r * r - j - 2n * v);
  const y = mod(r * (v - x) - 2n * s1 * j);
  const z = mod(((left.z + right.z) * (left.z + right.z) - z1z1 - z2z2) * h);
  return { x, y, z };
}

function toAffine(point) {
  if (point.z === 0n) return null;
  const zInverse = inverse(point.z);
  const z2 = mod(zInverse * zInverse);
  const z3 = mod(z2 * zInverse);
  return { x: mod(point.x * z2), y: mod(point.y * z3) };
}

function scalarMultiply(point, scalar) {
  let result = jacobianInfinity();
  let addend = fromAffine(point);
  let value = mod(scalar, GROUP_N);
  while (value > 0n) {
    if (value & 1n) result = jacobianAdd(result, addend);
    addend = jacobianDouble(addend);
    value >>= 1n;
  }
  return result;
}

function liftX(x) {
  if (x < 0n || x >= FIELD_P) return null;
  const c = mod(x * x * x + 7n);
  let y = powMod(c, (FIELD_P + 1n) / 4n);
  if (mod(y * y) !== c) return null;
  if (y & 1n) y = FIELD_P - y;
  return { x, y };
}

function sha256(value) {
  return createHash("sha256").update(value).digest();
}

function taggedHash(tag, value) {
  const tagHash = sha256(Buffer.from(tag, "utf8"));
  return sha256(Buffer.concat([tagHash, tagHash, value]));
}

function bytesFromHex(value) {
  return Buffer.from(value, "hex");
}

function bigintFromBuffer(value) {
  return BigInt(`0x${value.toString("hex") || "0"}`);
}

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

function nestedEvent(value) {
  const root = record(value);
  if (!root) return null;
  return record(root.event) || record(root.raw_event) || record(root.rawEvent) || root;
}

function validTags(value) {
  return Array.isArray(value)
    && value.length <= 256
    && value.every((tag) => Array.isArray(tag)
      && tag.length <= 64
      && tag.every((item) => typeof item === "string" && item.length <= 4096));
}

export function normalizeNostrEvent(value) {
  const event = nestedEvent(value);
  if (!event) return null;
  const id = typeof event.id === "string" ? event.id.trim().toLowerCase() : "";
  const pubkey = typeof event.pubkey === "string" ? event.pubkey.trim().toLowerCase() : "";
  const sig = typeof event.sig === "string" ? event.sig.trim().toLowerCase() : "";
  const content = typeof event.content === "string" ? event.content : "";
  const createdAt = Number(event.created_at ?? event.createdAt);
  const kind = Number(event.kind);
  const tags = event.tags;
  if (!HEX_32.test(id) || !HEX_32.test(pubkey) || !HEX_64.test(sig)) return null;
  if (!Number.isSafeInteger(createdAt) || createdAt < 0 || !Number.isSafeInteger(kind) || kind < 0 || !validTags(tags)) return null;
  if (Buffer.byteLength(content, "utf8") > 64 * 1024) return null;
  return { id, pubkey, sig, content, created_at: createdAt, kind, tags };
}

export function canonicalNostrEventId(value) {
  const event = normalizeNostrEvent(value);
  if (!event) return "";
  return sha256(Buffer.from(JSON.stringify([
    0,
    event.pubkey,
    event.created_at,
    event.kind,
    event.tags,
    event.content,
  ]), "utf8")).toString("hex");
}

export function verifyNostrEventSignature(value) {
  const event = normalizeNostrEvent(value);
  if (!event) return { valid: false, eventId: "", pubkey: "", reason: "BUZZ did not return a complete signed Nostr event." };
  const canonicalId = canonicalNostrEventId(event);
  if (!canonicalId || canonicalId !== event.id) {
    return { valid: false, eventId: event.id, pubkey: event.pubkey, reason: "The BUZZ event id does not match its signed event content." };
  }

  const signature = bytesFromHex(event.sig);
  const r = bigintFromBuffer(signature.subarray(0, 32));
  const s = bigintFromBuffer(signature.subarray(32));
  if (r >= FIELD_P || s >= GROUP_N) {
    return { valid: false, eventId: event.id, pubkey: event.pubkey, reason: "The BUZZ event signature is outside the secp256k1 Schnorr range." };
  }
  const publicPoint = liftX(BigInt(`0x${event.pubkey}`));
  if (!publicPoint) {
    return { valid: false, eventId: event.id, pubkey: event.pubkey, reason: "The BUZZ signer public key is not a valid x-only secp256k1 point." };
  }
  const challenge = bigintFromBuffer(taggedHash(
    "BIP0340/challenge",
    Buffer.concat([signature.subarray(0, 32), bytesFromHex(event.pubkey), bytesFromHex(event.id)]),
  )) % GROUP_N;
  const candidate = toAffine(jacobianAdd(
    scalarMultiply(GENERATOR, s),
    scalarMultiply(publicPoint, GROUP_N - challenge),
  ));
  const valid = Boolean(candidate && (candidate.y & 1n) === 0n && candidate.x === r);
  return {
    valid,
    eventId: event.id,
    pubkey: event.pubkey,
    reason: valid
      ? "The Nostr event id and BIP-340 signature are valid. This proves signer provenance only, not story truth or canon authority."
      : "The BUZZ event failed BIP-340 signature verification.",
  };
}
