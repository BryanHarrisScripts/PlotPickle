import { spawn } from "node:child_process";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { BUZZ_GUILDHALL_ACTORS } from "../lib/buzz-guildhall";
import { resolveBuzzCliExecutable } from "./buzz-desktop-discovery";
import { readCredentialJson } from "./local-credentials";

const API = "/api/local-buzz";
const CONNECTION_FILE = "buzz-connection.json";
const MAX_COMMAND_OUTPUT = 2 * 1024 * 1024;

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
};

type CommandResult = { stdout: string; stderr: string; code: number };

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

function isBrowserAuthoredRequest(request: IncomingMessage) {
  return typeof request.headers.origin === "string" || typeof request.headers["sec-fetch-site"] === "string";
}

function sendJson(response: ServerResponse, statusCode: number, body: Record<string, unknown>) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(body));
}

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Buzz identity could not be resolved.";
  return message
    .replace(/nsec1[a-z0-9]+/gi, "[redacted-nsec]")
    .replace(/\b[a-f0-9]{64}\b/gi, "[redacted-secret]")
    .replace(/(password|secret|private[_ -]?key|api[_ -]?key|token)\s*[=:]\s*\S+/gi, "$1=[redacted]")
    .slice(0, 500);
}

function validConnection(value: unknown): value is BuzzConnection {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Partial<BuzzConnection>;
  return item.version === 1
    && (item.mode === "existing-relay" || item.mode === "managed")
    && typeof item.relayUrl === "string"
    && typeof item.community === "string"
    && typeof item.identityLabel === "string"
    && typeof item.cliPath === "string"
    && typeof item.privateKey === "string"
    && typeof item.verifiedAt === "string";
}

async function readConnection() {
  const value = await readCredentialJson<unknown>(CONNECTION_FILE);
  return validConnection(value) ? value : null;
}

function relayHttpUrl(value: string) {
  const url = new URL(value);
  if (url.protocol === "ws:") url.protocol = "http:";
  if (url.protocol === "wss:") url.protocol = "https:";
  return url.toString().replace(/\/$/, "");
}

function command(executable: string, args: string[], env: NodeJS.ProcessEnv) {
  return new Promise<CommandResult>((resolve, reject) => {
    const child = spawn(executable, args, {
      env: { ...process.env, ...env },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let bytes = 0;
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(new Error("Buzz CLI did not finish the human identity check in time."));
    }, 15_000);
    const collect = (target: Buffer[], chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes <= MAX_COMMAND_OUTPUT) target.push(chunk);
      else if (!settled) {
        settled = true;
        clearTimeout(timer);
        child.kill("SIGKILL");
        reject(new Error("Buzz CLI returned too much identity output."));
      }
    };
    child.stdout.on("data", (chunk: Buffer) => collect(stdout, chunk));
    child.stderr.on("data", (chunk: Buffer) => collect(stderr, chunk));
    child.once("error", () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error("Buzz CLI is not installed or could not start."));
    });
    child.once("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const result = {
        stdout: Buffer.concat(stdout).toString("utf8").trim(),
        stderr: Buffer.concat(stderr).toString("utf8").trim(),
        code: code ?? 1,
      };
      if (result.code !== 0) reject(new Error(result.stderr || result.stdout || `Buzz CLI exited with code ${result.code}.`));
      else resolve(result);
    });
  });
}

async function runBuzz(connection: BuzzConnection, args: string[]) {
  if (!connection.privateKey) throw new Error("Authorize PlotPickle with your Buzz identity before using Community.");
  const resolution = await resolveBuzzCliExecutable(connection.cliPath);
  const result = await command(resolution.executable, args, {
    BUZZ_RELAY_URL: relayHttpUrl(connection.relayUrl),
    BUZZ_PRIVATE_KEY: connection.privateKey,
  });
  try { return JSON.parse(result.stdout || "null") as unknown; }
  catch { throw new Error("Buzz CLI returned invalid identity JSON."); }
}

function records(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry));
  if (!value || typeof value !== "object") return [];
  const item = value as Record<string, unknown>;
  if (["pubkey", "public_key", "publicKey", "npub", "display_name", "displayName", "name"].some((key) => key in item)) return [item];
  for (const key of ["users", "items", "data", "results"]) {
    if (Array.isArray(item[key])) return records(item[key]);
  }
  return [];
}

function firstString(item: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function normalizeIdentityName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function matchingAgent(displayName: string) {
  const normalized = normalizeIdentityName(displayName);
  if (!normalized) return null;
  return BUZZ_GUILDHALL_ACTORS.find((actor) => {
    const fullName = normalizeIdentityName(actor.displayName);
    const actorId = normalizeIdentityName(actor.id);
    const firstName = fullName.split(" ")[0] || "";
    return normalized === fullName
      || normalized === actorId
      || (firstName.length >= 4 && !["master", "critics"].includes(firstName) && normalized === firstName);
  }) ?? null;
}

function identityProfile(value: unknown) {
  const candidates = records(value);
  const profile = candidates.find((item) => item.owned_by_me === true || item.ownedByMe === true) ?? candidates[0] ?? null;
  if (!profile) return { pubkey: "", displayName: "" };
  return {
    pubkey: firstString(profile, ["pubkey", "public_key", "publicKey", "npub"]),
    displayName: firstString(profile, ["display_name", "displayName", "name", "username"]),
  };
}

async function humanIdentityStatus(): Promise<HumanIdentityStatus> {
  const connection = await readConnection();
  const identityVerified = Boolean(connection?.verificationVersion === 2 && connection.verifiedAt && connection.privateKey);
  if (!connection || !identityVerified) {
    return {
      ready: false,
      identityVerified,
      humanCommunityAllowed: false,
      pubkey: "",
      displayName: "",
      kind: "unknown",
      agentId: "",
      message: "Connect and verify your personal Buzz identity before posting to PlotPickle Community.",
    };
  }
  try {
    const profile = identityProfile(await runBuzz(connection, ["--format", "compact", "users", "get"]));
    if (!profile.displayName) {
      return {
        ready: false,
        identityVerified: true,
        humanCommunityAllowed: false,
        pubkey: profile.pubkey,
        displayName: "",
        kind: "unknown",
        agentId: "",
        message: "Buzz verified the signing key, but PlotPickle could not resolve its profile name. Reconnect your personal Buzz identity before posting as a human caller.",
      };
    }
    const agent = matchingAgent(profile.displayName);
    if (agent) {
      return {
        ready: false,
        identityVerified: true,
        humanCommunityAllowed: false,
        pubkey: profile.pubkey,
        displayName: profile.displayName,
        kind: "agent",
        agentId: agent.id,
        message: `${profile.displayName} is a PlotPickle agent identity, not the human Community caller. Sage is your PlotPickle guide; Sage is not your Community identity. Connect your personal Buzz identity in Settings.`,
      };
    }
    return {
      ready: true,
      identityVerified: true,
      humanCommunityAllowed: true,
      pubkey: profile.pubkey,
      displayName: profile.displayName,
      kind: "human",
      agentId: "",
      message: `Community caller verified as ${profile.displayName}.`,
    };
  } catch (error) {
    return {
      ready: false,
      identityVerified: true,
      humanCommunityAllowed: false,
      pubkey: "",
      displayName: "",
      kind: "unknown",
      agentId: "",
      message: `PlotPickle could not verify the human Buzz profile. ${safeError(error)}`,
    };
  }
}

export function buzzHumanIdentityGuard(): Plugin {
  return {
    name: "plotpickle-buzz-human-identity-guard",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const rawUrl = request.url;
        if (!rawUrl) { next(); return; }
        let url: URL;
        try { url = new URL(rawUrl, "http://127.0.0.1"); } catch { next(); return; }
        if (!isLocalRequest(request)) { next(); return; }

        if (request.method === "GET" && url.pathname === `${API}/human-identity`) {
          void humanIdentityStatus()
            .then((status) => sendJson(response, 200, { ok: true, ...status }))
            .catch((error) => sendJson(response, 500, { ok: false, message: safeError(error) }));
          return;
        }

        if (request.method === "POST" && url.pathname === `${API}/messages` && isBrowserAuthoredRequest(request)) {
          void humanIdentityStatus()
            .then((status) => {
              if (!status.humanCommunityAllowed) {
                sendJson(response, 403, { ok: false, code: "human-buzz-identity-required", ...status });
                return;
              }
              next();
            })
            .catch((error) => sendJson(response, 500, { ok: false, message: safeError(error) }));
          return;
        }

        next();
      });
    },
  };
}
