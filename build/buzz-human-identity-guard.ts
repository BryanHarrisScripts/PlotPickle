import { spawn } from "node:child_process";
import type { IncomingMessage } from "node:http";
import type { Plugin } from "vite";
import { BUZZ_GUILDHALL_ACTORS } from "../lib/buzz-guildhall";
import { buzzCliFailure, redactBuzzDiagnostic } from "./buzz-cli-failure";
import { resolveBuzzCliExecutable } from "./buzz-desktop-discovery";
import { publicKeyFromPrivateKey } from "./buzz-key-identity";
import { readCredentialJson } from "./local-credentials";

const API = "/api/local-buzz";
const CONNECTION_FILE = "buzz-connection.json";
const MAX_IDENTITY_OUTPUT = 2 * 1024 * 1024;

type HumanIdentityStatus = {
  ready: boolean;
  identityVerified: boolean;
  humanCommunityAllowed: boolean;
  pubkey: string;
  displayName: string;
  kind: "human" | "agent" | "unknown";
  agentId: string;
  message: string;
};

type StoredConnection = {
  verificationVersion?: number;
  verifiedAt?: string;
  privateKey?: string;
  relayUrl?: string;
  cliPath?: string;
  identityLabel?: string;
};

type IdentityCliAttempt =
  | { ok: true; output: string }
  | { ok: false; error: unknown };

const UNVERIFIED: HumanIdentityStatus = {
  ready: false,
  identityVerified: false,
  humanCommunityAllowed: false,
  pubkey: "",
  displayName: "",
  kind: "unknown",
  agentId: "",
  message: "Connect and verify your personal Buzz identity before posting to PlotPickle Community.",
};

function isBrowserAuthoredRequest(request: IncomingMessage) {
  return typeof request.headers.origin === "string" || typeof request.headers["sec-fetch-site"] === "string";
}

function connectionFrom(value: unknown): StoredConnection | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as StoredConnection;
}

function recordsFrom(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry));
  if (!value || typeof value !== "object") return [];
  const root = value as Record<string, unknown>;
  if (["pubkey", "public_key", "publicKey", "npub", "display_name", "displayName", "name"].some((key) => key in root)) return [root];
  const collection = ["users", "items", "data", "results"].map((key) => root[key]).find(Array.isArray);
  return Array.isArray(collection) ? recordsFrom(collection) : [];
}

function firstText(item: Record<string, unknown> | null, keys: string[]) {
  if (!item) return "";
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function agentForDisplayName(displayName: string) {
  const normalized = displayName.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return BUZZ_GUILDHALL_ACTORS.find((actor) => {
    const fullName = actor.displayName.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const actorId = actor.id.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const firstName = fullName.split(" ")[0] || "";
    return normalized === fullName
      || normalized === actorId
      || (firstName.length >= 4 && !["master", "critics"].includes(firstName) && normalized === firstName);
  }) ?? null;
}

async function runIdentityCli(connection: Required<Pick<StoredConnection, "privateKey" | "relayUrl" | "cliPath">>, args: string[]) {
  const resolution = await resolveBuzzCliExecutable(connection.cliPath);
  const relay = new URL(connection.relayUrl);
  if (relay.protocol === "ws:") relay.protocol = "http:";
  if (relay.protocol === "wss:") relay.protocol = "https:";
  relay.hash = "";
  relay.search = "";

  return new Promise<string>((resolve, reject) => {
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
      reject(new Error("Buzz CLI did not finish the human identity check within 15 seconds."));
    }, 15_000);
    const capture = (target: Buffer[], chunk: Buffer) => {
      outputBytes += chunk.length;
      if (outputBytes <= MAX_IDENTITY_OUTPUT) {
        target.push(chunk);
        return;
      }
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.kill("SIGKILL");
      reject(new Error("Buzz CLI returned more identity data than PlotPickle permits."));
    };
    child.stdout.on("data", (chunk: Buffer) => capture(output, chunk));
    child.stderr.on("data", (chunk: Buffer) => capture(errors, chunk));
    child.once("error", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error("Buzz CLI could not start for the human identity check."));
    });
    child.once("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const stdout = Buffer.concat(output).toString("utf8").trim();
      const stderr = Buffer.concat(errors).toString("utf8").trim();
      if ((code ?? 1) !== 0) reject(buzzCliFailure(code, stderr || stdout));
      else resolve(stdout);
    });
  });
}

async function attemptIdentityCli(
  connection: Required<Pick<StoredConnection, "privateKey" | "relayUrl" | "cliPath">>,
  args: string[],
): Promise<IdentityCliAttempt> {
  try {
    return { ok: true, output: await runIdentityCli(connection, args) };
  } catch (error) {
    return { ok: false, error };
  }
}

async function inspectConnectedHuman(): Promise<HumanIdentityStatus> {
  const connection = connectionFrom(await readCredentialJson<unknown>(CONNECTION_FILE));
  const verified = connection?.verificationVersion === 2
    && typeof connection.verifiedAt === "string" && Boolean(connection.verifiedAt)
    && typeof connection.privateKey === "string" && Boolean(connection.privateKey)
    && typeof connection.relayUrl === "string" && Boolean(connection.relayUrl)
    && typeof connection.cliPath === "string";
  if (!connection || !verified) return UNVERIFIED;

  const privateKey = connection.privateKey as string;
  const relayUrl = connection.relayUrl as string;
  const cliPath = connection.cliPath as string;
  const localPubkey = publicKeyFromPrivateKey(privateKey);
  if (!localPubkey) return { ...UNVERIFIED, message: "The saved BUZZ signer is invalid. Disconnect it and reconnect the Human BUZZ identity." };

  const cliConnection = { privateKey, relayUrl, cliPath };
  let profile: Record<string, unknown> | null = null;
  const profileAttempt = await attemptIdentityCli(cliConnection, ["--format", "compact", "users", "get"]);
  if (profileAttempt.ok) {
    const decoded: unknown = JSON.parse(profileAttempt.output || "null");
    const candidates = recordsFrom(decoded);
    profile = candidates.find((item) => item.owned_by_me === true || item.ownedByMe === true) ?? candidates[0] ?? null;
  } else {
    const channelAttempt = await attemptIdentityCli(cliConnection, ["--format", "compact", "channels", "list"]);
    if (!channelAttempt.ok) {
      const profileMessage = redactBuzzDiagnostic(profileAttempt.error instanceof Error ? profileAttempt.error.message : profileAttempt.error);
      const channelMessage = redactBuzzDiagnostic(channelAttempt.error instanceof Error ? channelAttempt.error.message : channelAttempt.error);
      throw new Error(`BUZZ signer verification failed: ${profileMessage} · ${channelMessage}`.slice(0, 700));
    }
  }

  const remotePubkey = firstText(profile, ["pubkey", "public_key", "publicKey"]);
  if (/^[a-f0-9]{64}$/i.test(remotePubkey) && remotePubkey.toLowerCase() !== localPubkey) {
    return { ...UNVERIFIED, message: "BUZZ returned a different signer than the Human profile credential. Reconnect the intended Human identity." };
  }

  const displayName = firstText(profile, ["display_name", "displayName", "name", "username"])
    || (typeof connection.identityLabel === "string" ? connection.identityLabel.trim() : "")
    || "PlotPickle Human";
  const agent = agentForDisplayName(displayName);
  if (agent) {
    return {
      ready: false,
      identityVerified: true,
      humanCommunityAllowed: false,
      pubkey: remotePubkey || localPubkey,
      displayName,
      kind: "agent",
      agentId: agent.id,
      message: `${displayName} is a PlotPickle agent identity, not the human Community caller. Sage is your PlotPickle guide; Sage is not your Community identity. Connect your personal Buzz identity in Profile.`,
    };
  }

  return {
    ready: true,
    identityVerified: true,
    humanCommunityAllowed: true,
    pubkey: remotePubkey || localPubkey,
    displayName,
    kind: "human",
    agentId: "",
    message: profile
      ? `Community caller verified as ${displayName}.`
      : `Community signer verified as ${displayName}; BUZZ profile metadata can publish separately.`,
  };
}

export function buzzHumanIdentityGuard(): Plugin {
  return {
    name: "plotpickle-buzz-human-identity-guard",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const rawUrl = request.url;
        if (!rawUrl) { next(); return; }
        const url = new URL(rawUrl, "http://127.0.0.1");
        const remoteAddress = request.socket.remoteAddress;
        const host = request.headers.host;
        const loopback = remoteAddress === "127.0.0.1" || remoteAddress === "::1" || remoteAddress === "::ffff:127.0.0.1";
        if (!loopback || !host) { next(); return; }

        let sameOrigin = true;
        try {
          const hostUrl = new URL(`http://${host}`);
          sameOrigin = ["127.0.0.1", "localhost", "[::1]"].includes(hostUrl.hostname)
            && (!request.headers.origin || new URL(request.headers.origin).host === hostUrl.host);
        } catch (error) {
          response.statusCode = 400;
          response.setHeader("Content-Type", "application/json; charset=utf-8");
          response.end(JSON.stringify({ ok: false, message: `PlotPickle rejected malformed local Buzz request metadata: ${error instanceof Error ? error.message : "invalid URL"}.` }));
          return;
        }
        if (!sameOrigin) { next(); return; }

        const returnFailure = (error: unknown) => {
          const message = redactBuzzDiagnostic(error instanceof Error ? error.message : "Buzz identity could not be resolved.").slice(0, 500);
          response.statusCode = 500;
          response.setHeader("Content-Type", "application/json; charset=utf-8");
          response.setHeader("Cache-Control", "no-store");
          response.end(JSON.stringify({ ok: false, message }));
        };

        if (request.method === "GET" && url.pathname === `${API}/human-identity`) {
          void inspectConnectedHuman().then((status) => {
            response.statusCode = 200;
            response.setHeader("Content-Type", "application/json; charset=utf-8");
            response.setHeader("Cache-Control", "no-store");
            response.end(JSON.stringify({ ok: true, ...status }));
          }).catch(returnFailure);
          return;
        }

        const humanWrite = request.method === "POST"
          && isBrowserAuthoredRequest(request)
          && (url.pathname === `${API}/messages` || url.pathname === `${API}/guildhall/dms/open`);
        if (humanWrite) {
          void inspectConnectedHuman().then((status) => {
            if (status.humanCommunityAllowed) { next(); return; }
            response.statusCode = 403;
            response.setHeader("Content-Type", "application/json; charset=utf-8");
            response.setHeader("Cache-Control", "no-store");
            response.end(JSON.stringify({ ok: false, code: "human-buzz-identity-required", ...status }));
          }).catch(returnFailure);
          return;
        }

        next();
      });
    },
  };
}
