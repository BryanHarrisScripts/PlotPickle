import { spawn } from "node:child_process";
import type { IncomingMessage } from "node:http";
import type { Plugin } from "vite";
import { BUZZ_GUILDHALL_ACTORS } from "../lib/buzz-guildhall";
import { resolveBuzzCliExecutable } from "./buzz-desktop-discovery";
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

async function inspectConnectedHuman(): Promise<HumanIdentityStatus> {
  const stored = await readCredentialJson<unknown>(CONNECTION_FILE);
  if (!stored || typeof stored !== "object" || Array.isArray(stored)) return UNVERIFIED;
  const connection = stored as Record<string, unknown>;
  const verified = connection.verificationVersion === 2
    && typeof connection.verifiedAt === "string" && Boolean(connection.verifiedAt)
    && typeof connection.privateKey === "string" && Boolean(connection.privateKey);
  if (!verified || typeof connection.relayUrl !== "string" || typeof connection.cliPath !== "string") return UNVERIFIED;

  const resolution = await resolveBuzzCliExecutable(connection.cliPath);
  const relay = new URL(connection.relayUrl);
  if (relay.protocol === "ws:") relay.protocol = "http:";
  if (relay.protocol === "wss:") relay.protocol = "https:";
  relay.hash = "";
  relay.search = "";

  const stdout = await new Promise<string>((resolve, reject) => {
    const child = spawn(resolution.executable, ["--format", "compact", "users", "get"], {
      env: {
        ...process.env,
        BUZZ_RELAY_URL: relay.toString().replace(/\/$/, ""),
        BUZZ_PRIVATE_KEY: connection.privateKey as string,
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
    child.stdout.on("data", (chunk: Buffer) => {
      outputBytes += chunk.length;
      if (outputBytes <= MAX_IDENTITY_OUTPUT) output.push(chunk);
      else if (!settled) {
        settled = true;
        clearTimeout(timer);
        child.kill("SIGKILL");
        reject(new Error("Buzz CLI returned more identity data than PlotPickle permits."));
      }
    });
    child.stderr.on("data", (chunk: Buffer) => {
      outputBytes += chunk.length;
      if (outputBytes <= MAX_IDENTITY_OUTPUT) errors.push(chunk);
      else if (!settled) {
        settled = true;
        clearTimeout(timer);
        child.kill("SIGKILL");
        reject(new Error("Buzz CLI returned more identity data than PlotPickle permits."));
      }
    });
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error(`Buzz CLI could not start for the human identity check: ${error.message}`));
    });
    child.once("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      const text = Buffer.concat(output).toString("utf8").trim();
      const stderr = Buffer.concat(errors).toString("utf8").trim();
      if ((code ?? 1) !== 0) reject(new Error(stderr || text || `Buzz CLI identity check exited with code ${code ?? 1}.`));
      else resolve(text);
    });
  });

  const decoded: unknown = JSON.parse(stdout || "null");
  let candidates: Record<string, unknown>[] = [];
  if (Array.isArray(decoded)) {
    candidates = decoded.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry));
  } else if (decoded && typeof decoded === "object") {
    const root = decoded as Record<string, unknown>;
    if (["pubkey", "public_key", "publicKey", "npub", "display_name", "displayName", "name"].some((key) => key in root)) {
      candidates = [root];
    } else {
      const collection = ["users", "items", "data", "results"].map((key) => root[key]).find(Array.isArray);
      if (Array.isArray(collection)) candidates = collection.filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry));
    }
  }
  const profile = candidates.find((item) => item.owned_by_me === true || item.ownedByMe === true) ?? candidates[0] ?? null;
  if (!profile) {
    return { ...UNVERIFIED, identityVerified: true, message: "Buzz verified the signing key, but PlotPickle could not resolve its profile. Reconnect your personal Buzz identity before posting as a human caller." };
  }

  let pubkey = "";
  for (const key of ["pubkey", "public_key", "publicKey", "npub"]) {
    if (typeof profile[key] === "string" && profile[key].trim()) { pubkey = profile[key].trim(); break; }
  }
  let displayName = "";
  for (const key of ["display_name", "displayName", "name", "username"]) {
    if (typeof profile[key] === "string" && profile[key].trim()) { displayName = profile[key].trim(); break; }
  }
  if (!displayName) {
    return { ...UNVERIFIED, identityVerified: true, pubkey, message: "Buzz verified the signing key, but PlotPickle could not resolve its profile name. Reconnect your personal Buzz identity before posting as a human caller." };
  }

  const normalized = displayName.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const agent = BUZZ_GUILDHALL_ACTORS.find((actor) => {
    const fullName = actor.displayName.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const actorId = actor.id.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const firstName = fullName.split(" ")[0] || "";
    return normalized === fullName
      || normalized === actorId
      || (firstName.length >= 4 && !["master", "critics"].includes(firstName) && normalized === firstName);
  }) ?? null;
  if (agent) {
    return {
      ready: false,
      identityVerified: true,
      humanCommunityAllowed: false,
      pubkey,
      displayName,
      kind: "agent",
      agentId: agent.id,
      message: `${displayName} is a PlotPickle agent identity, not the human Community caller. Sage is your PlotPickle guide; Sage is not your Community identity. Connect your personal Buzz identity in Settings.`,
    };
  }

  return {
    ready: true,
    identityVerified: true,
    humanCommunityAllowed: true,
    pubkey,
    displayName,
    kind: "human",
    agentId: "",
    message: `Community caller verified as ${displayName}.`,
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
          const message = (error instanceof Error ? error.message : "Buzz identity could not be resolved.")
            .replace(/nsec1[a-z0-9]+/gi, "[redacted-nsec]")
            .replace(/\b[a-f0-9]{64}\b/gi, "[redacted-secret]")
            .replace(/(password|secret|private[_ -]?key|api[_ -]?key|token)\s*[=:]\s*\S+/gi, "$1=[redacted]")
            .slice(0, 500);
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

        if (request.method === "POST" && url.pathname === `${API}/messages` && isBrowserAuthoredRequest(request)) {
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
