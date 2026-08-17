import { spawn } from "node:child_process";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { BUZZ_GUILDHALL_ACTORS, BUZZ_GUILDHALL_CHANNELS } from "../lib/buzz-guildhall";
import { projectCommunityConversationFeed, type CommunityConversationItem } from "../lib/community-conversation";
import { resolveBuzzCliExecutable } from "./buzz-desktop-discovery";
import { readCredentialJson } from "./local-credentials";

const API = "/api/local-buzz/community";
const CONNECTION_FILE = "buzz-connection.json";
const MAX_BODY = 64 * 1024;
const MAX_COMMAND_OUTPUT = 4 * 1024 * 1024;
const VALID_ROLES = new Set(["owner", "admin", "member", "guest", "bot"]);

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
type BuzzChannel = { id: string; name: string; description: string };
type BuzzMember = { pubkey: string; displayName: string; presence: string; updatedAt: string };
type BuzzActivity = { id: string; content: string; author: string; createdAt: string };

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

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += buffer.length;
    if (bytes > MAX_BODY) throw new Error("The Buzz community request is too large.");
    chunks.push(buffer);
  }
  const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The Buzz community request is invalid.");
  return value as Record<string, unknown>;
}

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : "The Buzz Community operation failed.";
  return message
    .replace(/nsec1[a-z0-9]+/gi, "[redacted-nsec]")
    .replace(/\b[a-f0-9]{64}\b/gi, "[redacted-secret]")
    .replace(/(password|secret|private[_ -]?key|api[_ -]?key|token)\s*[=:]\s*\S+/gi, "$1=[redacted]")
    .slice(0, 700);
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
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
      reject(new Error("Buzz CLI did not finish within the allowed time."));
    }, 45_000);
    const collect = (target: Buffer[], chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes <= MAX_COMMAND_OUTPUT) target.push(chunk);
      else if (!settled) {
        settled = true;
        clearTimeout(timer);
        child.kill("SIGKILL");
        reject(new Error("Buzz CLI returned too much output."));
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
  catch { throw new Error("Buzz CLI returned invalid JSON."); }
}

function array(value: unknown) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [] as unknown[];
  const item = value as Record<string, unknown>;
  for (const key of ["channels", "messages", "items", "data", "results"]) {
    if (Array.isArray(item[key])) return item[key] as unknown[];
  }
  return [] as unknown[];
}

function firstString(item: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function channelsFrom(value: unknown): BuzzChannel[] {
  return array(value).flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const item = entry as Record<string, unknown>;
    const id = firstString(item, ["channel_id", "id", "channelId", "uuid"]);
    const name = firstString(item, ["name", "title", "slug"]);
    if (!id || !name) return [];
    return [{ id, name, description: firstString(item, ["description", "purpose", "topic"]) }];
  });
}

function activityFrom(value: unknown): BuzzActivity[] {
  return array(value).flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const item = entry as Record<string, unknown>;
    const rawCreated = item.created_at ?? item.createdAt ?? item.timestamp;
    const createdAt = typeof rawCreated === "number" ? new Date(rawCreated * 1000).toISOString() : text(rawCreated);
    const content = firstString(item, ["content", "body", "text"]);
    if (!content) return [];
    return [{
      id: firstString(item, ["id", "event_id", "eventId"]) || `${createdAt}-${content.slice(0, 24)}`,
      content,
      author: firstString(item, ["author_name", "display_name", "author", "pubkey"]),
      createdAt,
    }];
  });
}

async function findGreatHall(connection: BuzzConnection) {
  const channels = channelsFrom(await runBuzz(connection, ["--format", "compact", "channels", "list", "--member"]));
  const definition = BUZZ_GUILDHALL_CHANNELS.find((room) => room.id === "great-hall");
  return definition ? channels.find((channel) => channel.name === definition.name) ?? null : null;
}

function memberPubkeys(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && /^[a-f0-9]{64}$/i.test(entry))
    : [];
}

async function loadMembers(connection: BuzzConnection, channel: BuzzChannel): Promise<BuzzMember[]> {
  const pubkeys = memberPubkeys(await runBuzz(connection, ["channels", "members", "--channel", channel.id]));
  if (!pubkeys.length) return [];
  const userArgs = ["--format", "compact", "users", "get"];
  for (const pubkey of pubkeys) userArgs.push("--pubkey", pubkey);
  const [profilesRaw, presenceRaw] = await Promise.all([
    runBuzz(connection, userArgs),
    runBuzz(connection, ["users", "presence", "--pubkeys", pubkeys.join(",")]).catch(() => []),
  ]);
  const profiles = array(profilesRaw).filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry));
  const presence = array(presenceRaw).filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry));
  return pubkeys.map((pubkey) => {
    const profile = profiles.find((item) => firstString(item, ["pubkey"]) === pubkey);
    const state = presence.find((item) => firstString(item, ["pubkey"]) === pubkey);
    const rawUpdated = state?.updated_at ?? state?.updatedAt;
    return {
      pubkey,
      displayName: profile ? firstString(profile, ["display_name", "name"]) || `${pubkey.slice(0, 8)}…` : `${pubkey.slice(0, 8)}…`,
      presence: state ? firstString(state, ["status"]) || "offline" : "offline",
      updatedAt: typeof rawUpdated === "number" ? new Date(rawUpdated * 1000).toISOString() : text(rawUpdated),
    };
  });
}

async function communityStatus() {
  const connection = await readConnection();
  const verified = Boolean(connection?.verificationVersion === 2 && connection.verifiedAt && connection.privateKey);
  const base = {
    ok: true,
    configured: Boolean(connection),
    identityVerified: verified,
    community: connection?.community || "",
    relayUrl: connection?.relayUrl || "",
    identityLabel: connection?.identityLabel || "",
    greatHall: null as BuzzChannel | null,
    members: [] as BuzzMember[],
    recentActivity: [] as CommunityConversationItem[],
    actors: BUZZ_GUILDHALL_ACTORS.map((actor) => ({
      id: actor.id,
      displayName: actor.displayName,
      title: actor.title,
      kind: actor.kind,
      primaryChannel: actor.primaryChannel,
      buzzPresence: actor.buzzPresence,
      summary: actor.summary,
    })),
    canManageGreatHall: false,
    fullRosterSupported: false,
    inviteManagement: "buzz-desktop" as const,
    message: "Connect and verify Buzz in Settings before using PlotPickle Community.",
  };
  if (!connection || !verified) return base;
  try {
    const greatHall = await findGreatHall(connection);
    if (!greatHall) return { ...base, message: "The Buzz identity is verified, but the Great Hall has not been created yet." };
    const [members, rawActivity] = await Promise.all([
      loadMembers(connection, greatHall),
      runBuzz(connection, ["messages", "get", "--channel", greatHall.id, "--limit", "40"]).then(activityFrom).catch(() => []),
    ]);
    const namedActivity = rawActivity.map((item) => {
      const member = members.find((candidate) => candidate.pubkey.toLowerCase() === item.author.toLowerCase());
      return member ? { ...item, author: member.displayName } : item;
    });
    const recentActivity = projectCommunityConversationFeed(namedActivity).slice(0, 20);
    return {
      ...base,
      greatHall,
      members,
      recentActivity,
      canManageGreatHall: true,
      message: "PlotPickle Community is connected to the Great Hall. Human conversation, members and presence are ready; operational BUZZ evidence stays in diagnostics.",
    };
  } catch (error) {
    return { ...base, message: safeError(error) };
  }
}

async function addGreatHallMember(body: Record<string, unknown>) {
  const connection = await readConnection();
  if (!connection || connection.verificationVersion !== 2) throw new Error("Verify Buzz before changing Great Hall access.");
  const greatHall = await findGreatHall(connection);
  if (!greatHall) throw new Error("Set up the PlotPickle Guildhall before adding Great Hall members.");
  const pubkey = text(body.pubkey).toLowerCase();
  const role = text(body.role).toLowerCase() || "member";
  if (!/^[a-f0-9]{64}$/.test(pubkey)) throw new Error("Enter the existing Buzz member's 64-character public key.");
  if (!VALID_ROLES.has(role)) throw new Error("Choose a valid Great Hall role.");
  await runBuzz(connection, ["channels", "add-member", "--channel", greatHall.id, "--pubkey", pubkey, "--role", role]);
  return communityStatus();
}

async function removeGreatHallMember(body: Record<string, unknown>) {
  const connection = await readConnection();
  if (!connection || connection.verificationVersion !== 2) throw new Error("Verify Buzz before changing Great Hall access.");
  const greatHall = await findGreatHall(connection);
  if (!greatHall) throw new Error("The Great Hall is not available.");
  const pubkey = text(body.pubkey).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(pubkey)) throw new Error("Choose a valid Great Hall member.");
  await runBuzz(connection, ["channels", "remove-member", "--channel", greatHall.id, "--pubkey", pubkey]);
  return communityStatus();
}

async function handle(request: IncomingMessage, response: ServerResponse, url: URL) {
  if (request.method === "GET" && url.pathname === `${API}/status`) {
    sendJson(response, 200, await communityStatus());
    return;
  }
  if (request.method === "POST" && url.pathname === `${API}/members`) {
    sendJson(response, 200, await addGreatHallMember(await readBody(request)));
    return;
  }
  if (request.method === "DELETE" && url.pathname === `${API}/members`) {
    sendJson(response, 200, await removeGreatHallMember(await readBody(request)));
    return;
  }
  sendJson(response, 404, { ok: false, message: "Buzz Community operation not found." });
}

export function buzzCommunityGateway(): Plugin {
  return {
    name: "plotpickle-buzz-community-gateway",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const rawUrl = request.url;
        if (!rawUrl) { next(); return; }
        let url: URL;
        try { url = new URL(rawUrl, "http://127.0.0.1"); } catch { next(); return; }
        if (!url.pathname.startsWith(API)) { next(); return; }
        if (!isLocalRequest(request)) {
          sendJson(response, 403, { ok: false, message: "Buzz Community controls are available only from the local PlotPickle application." });
          return;
        }
        void handle(request, response, url).catch((error) => sendJson(response, 500, { ok: false, message: safeError(error) }));
      });
    },
  };
}