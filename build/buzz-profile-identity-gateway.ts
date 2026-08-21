import { spawn } from "node:child_process";
import { createECDH } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { Plugin } from "vite";
import { BUZZ_GUILDHALL_ACTORS } from "../lib/buzz-guildhall";
import { resolveBuzzCliExecutable } from "./buzz-desktop-discovery";
import { readCredentialJson, writeCredentialJson } from "./local-credentials";

const API = "/api/local-buzz";
const CONNECTION_FILE = "buzz-connection.json";
const MAX_BODY = 64 * 1024;
const MAX_OUTPUT = 2 * 1024 * 1024;

type BuzzConnection = {
  version: 1;
  mode: "existing-relay" | "managed";
  relayUrl: string;
  community: string;
  identityLabel: string;
  cliPath: string;
  privateKey: string;
  verifiedAt: string;
  verificationVersion?: 2;
  identitySource?: "generated" | "imported";
};

type PublicIdentity = {
  ready: boolean;
  identityVerified: boolean;
  humanCommunityAllowed: boolean;
  pubkey: string;
  displayName: string;
  kind: "human" | "agent" | "unknown";
  message: string;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function safeError(error: unknown) {
  return (error instanceof Error ? error.message : "The BUZZ identity operation failed.")
    .replace(/nsec1[a-z0-9]+/gi, "[redacted-nsec]")
    .replace(/\b[a-f0-9]{64}\b/gi, "[redacted-secret]")
    .replace(/(password|secret|private[_ -]?key|api[_ -]?key|token)\s*[=:]\s*\S+/gi, "$1=[redacted]")
    .slice(0, 700);
}

async function readIdentityPayload(request: IncomingMessage, byteLimit: number, label: string) {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += value.length;
    if (bytes > byteLimit) throw new Error(`The ${label} request is too large.`);
    chunks.push(value);
  }
  const decoded: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) throw new Error(`The ${label} request is invalid.`);
  return decoded as Record<string, unknown>;
}

function normalizeRelayUrl(value: unknown) {
  const source = text(value);
  if (!source) throw new Error("Enter the BUZZ community address before creating or connecting an identity.");
  const withProtocol = /^[a-z]+:\/\//i.test(source) ? source : `https://${source}`;
  if (!URL.canParse(withProtocol)) throw new Error("Enter a complete BUZZ community address.");
  const url = new URL(withProtocol);
  if (!["http:", "https:", "ws:", "wss:"].includes(url.protocol)) throw new Error("BUZZ community addresses must use HTTP, HTTPS, WS or WSS.");
  if (url.username || url.password) throw new Error("Do not put credentials in the BUZZ community address.");
  url.hash = "";
  url.search = "";
  return url.toString().replace(/\/$/, "");
}

function generatedPrivateKey() {
  const identity = createECDH("secp256k1");
  identity.generateKeys();
  return identity.getPrivateKey("hex").padStart(64, "0");
}

function publicKeyFromHexPrivateKey(privateKey: string) {
  if (!/^[a-f0-9]{64}$/i.test(privateKey)) return "";
  const identity = createECDH("secp256k1");
  identity.setPrivateKey(Buffer.from(privateKey, "hex"));
  const compressed = identity.getPublicKey("hex", "compressed");
  return compressed.slice(2);
}

function connectionFrom(value: unknown): BuzzConnection | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Partial<BuzzConnection>;
  if (item.version !== 1 || (item.mode !== "existing-relay" && item.mode !== "managed")
    || typeof item.relayUrl !== "string" || typeof item.community !== "string"
    || typeof item.identityLabel !== "string" || typeof item.cliPath !== "string"
    || typeof item.privateKey !== "string" || typeof item.verifiedAt !== "string") return null;
  return item as BuzzConnection;
}

function nextConnection(existing: BuzzConnection | null, relayUrl: string, privateKey: string, source: "generated" | "imported") {
  return {
    version: 1,
    mode: existing?.mode === "managed" ? "managed" : "existing-relay",
    relayUrl,
    community: existing?.community || "",
    identityLabel: existing?.identityLabel || "",
    cliPath: existing?.cliPath || "",
    privateKey,
    verifiedAt: "",
    identitySource: source,
  } satisfies BuzzConnection;
}

function runCli(connection: BuzzConnection, args: string[]) {
  return new Promise<string>((resolve, reject) => {
    void resolveBuzzCliExecutable(connection.cliPath).then((resolution) => {
      const relay = new URL(connection.relayUrl);
      if (relay.protocol === "ws:") relay.protocol = "http:";
      if (relay.protocol === "wss:") relay.protocol = "https:";
      const child = spawn(resolution.executable, args, {
        env: {
          ...process.env,
          BUZZ_RELAY_URL: relay.toString().replace(/\/$/, ""),
          BUZZ_PRIVATE_KEY: connection.privateKey,
        },
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
      const output: Buffer[] = [];
      const errors: Buffer[] = [];
      let outputBytes = 0;
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill("SIGKILL");
        reject(new Error("BUZZ Desktop did not finish the identity operation within 20 seconds."));
      }, 20_000);
      const capture = (target: Buffer[], chunk: Buffer, streamName: string) => {
        outputBytes += chunk.length;
        if (outputBytes <= MAX_OUTPUT) {
          target.push(chunk);
          return;
        }
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        child.kill("SIGKILL");
        reject(new Error(`BUZZ Desktop returned too much ${streamName} data for the Profile identity operation.`));
      };
      child.stdout.on("data", (chunk: Buffer) => capture(output, chunk, "profile"));
      child.stderr.on("data", (chunk: Buffer) => capture(errors, chunk, "diagnostic"));
      child.once("error", () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new Error("BUZZ Desktop could not start the identity operation."));
      });
      child.once("close", (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const stdout = Buffer.concat(output).toString("utf8").trim();
        const stderr = Buffer.concat(errors).toString("utf8").trim();
        if ((code ?? 1) !== 0) reject(new Error(stderr || stdout || `BUZZ Desktop identity operation exited with code ${code ?? 1}.`));
        else resolve(stdout);
      });
    }).catch(reject);
  });
}

function recordsFrom(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry));
  if (!value || typeof value !== "object") return [];
  const root = value as Record<string, unknown>;
  if (["pubkey", "public_key", "publicKey", "npub", "display_name", "displayName", "name"].some((key) => key in root)) return [root];
  for (const key of ["users", "items", "data", "results"]) {
    if (Array.isArray(root[key])) return recordsFrom(root[key]);
  }
  return [];
}

function profileText(item: Record<string, unknown>, primaryKey: string, fallbackKeys: readonly string[]) {
  const keys = [primaryKey, ...fallbackKeys];
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function agentIdForDisplayName(displayName: string) {
  const normalized = displayName.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return BUZZ_GUILDHALL_ACTORS.find((actor) => {
    const fullName = actor.displayName.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const actorId = actor.id.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const firstName = fullName.split(" ")[0] || "";
    return normalized === fullName || normalized === actorId
      || (firstName.length >= 4 && !["master", "critics"].includes(firstName) && normalized === firstName);
  })?.id || "";
}

async function readConnectedProfile(connection: BuzzConnection) {
  const source = await runCli(connection, ["--format", "compact", "users", "get"]);
  const decoded: unknown = JSON.parse(source || "null");
  const candidates = recordsFrom(decoded);
  return candidates.find((item) => item.owned_by_me === true || item.ownedByMe === true) ?? candidates[0] ?? null;
}

function safeIdentity(connection: BuzzConnection, profile: Record<string, unknown> | null, displayNameFallback: string): PublicIdentity {
  const displayName = profile ? profileText(profile, "display_name", ["displayName", "name", "username"]) || displayNameFallback : displayNameFallback;
  const publicKey = profile ? profileText(profile, "pubkey", ["public_key", "publicKey", "npub"]) : "";
  const pubkey = publicKey || publicKeyFromHexPrivateKey(connection.privateKey);
  const agentId = agentIdForDisplayName(displayName);
  return agentId ? {
    ready: false,
    identityVerified: true,
    humanCommunityAllowed: false,
    pubkey,
    displayName,
    kind: "agent",
    message: `${displayName} is a PlotPickle agent identity, not the Human Community identity.`,
  } : {
    ready: true,
    identityVerified: true,
    humanCommunityAllowed: true,
    pubkey,
    displayName,
    kind: "human",
    message: `BUZZ identity verified as ${displayName}.`,
  };
}

function profileDisplayName(value: unknown) {
  const name = text(value);
  if (!name || name.length > 120 || /[\u0000-\u001f\u007f]/u.test(name)) throw new Error("Display name must be 1-120 characters without control characters.");
  return name;
}

function publicBio(value: unknown) {
  const bio = text(value);
  if (bio.length > 500 || /[\u0000-\u001f\u007f]/u.test(bio)) throw new Error("Public bio must be 500 characters or fewer without control characters.");
  return bio;
}

function avatarUrl(value: unknown) {
  const source = text(value);
  if (!source) return "";
  if (source.length > 2_048) throw new Error("Avatar image address is too long.");
  if (!URL.canParse(source)) throw new Error("BUZZ avatar images must use a complete secure https:// address.");
  const url = new URL(source);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("BUZZ avatar images must use a secure https:// address without credentials.");
  return url.toString();
}

async function handleIdentityAction(body: Record<string, unknown>) {
  const existing = connectionFrom(await readCredentialJson<unknown>(CONNECTION_FILE));
  const action = text(body.action);

  if (action === "create") {
    const relayUrl = normalizeRelayUrl(body.relayUrl || existing?.relayUrl);
    const privateKey = generatedPrivateKey();
    const connection = nextConnection(existing, relayUrl, privateKey, "generated");
    connection.identityLabel = profileDisplayName(body.displayName || "PlotPickle Human");
    await writeCredentialJson(CONNECTION_FILE, connection);
    return {
      ok: true,
      recoveryPrivateKey: privateKey,
      message: "A new BUZZ identity was created and encrypted inside this Human profile. Save the recovery key before closing the Profile surface.",
    };
  }

  if (action === "import") {
    const relayUrl = normalizeRelayUrl(body.relayUrl || existing?.relayUrl);
    const privateKey = text(body.privateKey);
    if (!/^(nsec1[a-z0-9]+|[a-f0-9]{64})$/i.test(privateKey)) throw new Error("The BUZZ private identity key must be an nsec or a 64-character hexadecimal key.");
    const connection = nextConnection(existing, relayUrl, privateKey, "imported");
    connection.identityLabel = profileDisplayName(body.displayName || existing?.identityLabel || "PlotPickle Human");
    await writeCredentialJson(CONNECTION_FILE, connection);
    return { ok: true, message: "The existing BUZZ identity was encrypted inside this Human profile. Verification is still required before Community can use it." };
  }

  if (action === "disconnect") {
    if (!existing) return { ok: true, message: "No BUZZ identity is connected to this Human profile." };
    await writeCredentialJson(CONNECTION_FILE, {
      ...existing,
      privateKey: "",
      verifiedAt: "",
      verificationVersion: undefined,
      identitySource: undefined,
    });
    return { ok: true, message: "The BUZZ identity was disconnected from this Human profile. Relay/runtime settings were kept." };
  }

  if (action === "publish-profile") {
    if (!existing?.privateKey) throw new Error("Create or connect a BUZZ identity before publishing the Human Profile.");
    if (!existing.relayUrl) throw new Error("A BUZZ community address is required before publishing the Human Profile.");
    const displayName = profileDisplayName(body.displayName);
    const bio = publicBio(body.publicBio);
    const picture = avatarUrl(body.avatarUrl);

    if (existing.identitySource === "imported") {
      const before = await readConnectedProfile(existing);
      const priorName = before ? profileText(before, "display_name", ["displayName", "name", "username"]) : "";
      if (priorName && agentIdForDisplayName(priorName)) throw new Error("A PlotPickle agent BUZZ identity cannot be connected as the Human Profile.");
    }

    const args = ["users", "set-profile", "--name", displayName, "--about", bio];
    if (picture) args.push("--picture", picture);
    await runCli(existing, args);
    const profile = await readConnectedProfile(existing);
    const identity = safeIdentity(existing, profile, displayName);
    if (!identity.humanCommunityAllowed) throw new Error(identity.message);
    const verifiedConnection: BuzzConnection = { ...existing, identityLabel: displayName, verifiedAt: new Date().toISOString(), verificationVersion: 2 };
    await writeCredentialJson(CONNECTION_FILE, verifiedConnection);
    return { ok: true, identity, message: "Profile saved locally and published to BUZZ with the same avatar, display name and public bio." };
  }

  throw new Error("That BUZZ identity action is unavailable.");
}

export function buzzProfileIdentityGateway(): Plugin {
  return {
    name: "plotpickle-buzz-profile-identity-gateway",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const rawUrl = request.url;
        if (!rawUrl || !URL.canParse(rawUrl, "http://127.0.0.1")) { next(); return; }
        const url = new URL(rawUrl, "http://127.0.0.1");
        if (request.method !== "POST" || url.pathname !== `${API}/human-identity`) { next(); return; }

        const remoteAddress = request.socket.remoteAddress;
        const host = request.headers.host || "";
        const origin = request.headers.origin || "";
        const loopback = remoteAddress === "127.0.0.1" || remoteAddress === "::1" || remoteAddress === "::ffff:127.0.0.1";
        const hostSource = `http://${host}`;
        const localHost = URL.canParse(hostSource) && ["127.0.0.1", "localhost", "[::1]"].includes(new URL(hostSource).hostname);
        const sameOrigin = !origin || (URL.canParse(origin) && new URL(origin).host === new URL(hostSource).host);
        if (!loopback || !localHost || !sameOrigin) {
          response.statusCode = 403;
          response.setHeader("Content-Type", "application/json; charset=utf-8");
          response.setHeader("Cache-Control", "no-store");
          response.setHeader("X-Content-Type-Options", "nosniff");
          response.setHeader("Referrer-Policy", "no-referrer");
          response.end(JSON.stringify({ ok: false, message: "BUZZ identity controls are available only from the local PlotPickle application." }));
          return;
        }

        void readIdentityPayload(request, MAX_BODY, "BUZZ identity")
          .then(handleIdentityAction)
          .then((result) => {
            response.statusCode = 200;
            response.setHeader("Content-Type", "application/json; charset=utf-8");
            response.setHeader("Cache-Control", "no-store");
            response.setHeader("X-Content-Type-Options", "nosniff");
            response.setHeader("Referrer-Policy", "no-referrer");
            response.end(JSON.stringify(result));
          })
          .catch((error) => {
            response.statusCode = 400;
            response.setHeader("Content-Type", "application/json; charset=utf-8");
            response.setHeader("Cache-Control", "no-store");
            response.setHeader("X-Content-Type-Options", "nosniff");
            response.setHeader("Referrer-Policy", "no-referrer");
            response.end(JSON.stringify({ ok: false, message: safeError(error) }));
          });
      });
    },
  };
}