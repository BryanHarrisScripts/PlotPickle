import { readFile, stat } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import type { Plugin } from "vite";
import {
  createLegacyCredentialMigrationSource,
  credentialFilePath,
  persistentHome,
} from "./local-credentials";
import {
  currentProfileRequestContext,
  withoutProfileRequestContext,
} from "./profile-request-context";

const API = "/api/local-buzz/profile-migration";
const CONNECTION_FILE = "buzz-connection.json";
let migrationQueue = Promise.resolve();

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

function markerPath() {
  return path.join(persistentHome(), "migration", "legacy-credentials.read-only.json");
}

async function marker() {
  try {
    const value = JSON.parse(await readFile(markerPath(), "utf8")) as Record<string, unknown>;
    return value && typeof value === "object" ? value : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    if (error instanceof SyntaxError) throw new Error("The legacy credential migration marker is invalid.");
    throw error;
  }
}

async function legacyExists() {
  try {
    const information = await stat(credentialFilePath(CONNECTION_FILE));
    return information.isFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

async function status() {
  const context = currentProfileRequestContext();
  if (!context) throw new Error("Unlock a PlotPickle Human profile before checking legacy BUZZ migration.");
  const [legacyAvailable, assignment, current] = await Promise.all([
    legacyExists(),
    marker(),
    context.privateStorage.readCredential(context.authContext, CONNECTION_FILE),
  ]);
  const assignedProfileId = assignment?.state === "migrated-read-only" && typeof assignment.profileId === "string"
    ? assignment.profileId
    : null;
  return {
    ok: true,
    legacyAvailable,
    currentProfileConfigured: current !== null,
    assignedToCurrentProfile: assignedProfileId === context.profileId,
    assignedElsewhere: Boolean(assignedProfileId && assignedProfileId !== context.profileId),
    message: current !== null
      ? "This Human profile already has its own BUZZ identity."
      : assignedProfileId === context.profileId
        ? "The legacy BUZZ identity was already migrated to this Human profile."
        : assignedProfileId
          ? "The legacy BUZZ identity was already assigned to another Human profile and cannot be duplicated."
          : legacyAvailable
            ? "A legacy single-user BUZZ identity is available for explicit migration into this unlocked Human profile."
            : "No legacy single-user BUZZ identity is available.",
  };
}

async function migrate() {
  const context = currentProfileRequestContext();
  if (!context) throw new Error("Unlock a PlotPickle Human profile before migrating a legacy BUZZ identity.");
  const previous = migrationQueue;
  let release = () => undefined;
  migrationQueue = new Promise<void>((resolve) => { release = resolve; });
  await previous.catch(() => undefined);
  try {
    const current = await context.privateStorage.readCredential(context.authContext, CONNECTION_FILE);
    if (current !== null) return status();
    if (!await legacyExists()) throw new Error("No legacy single-user BUZZ identity is available to migrate.");
    const assignment = await marker();
    if (assignment?.state === "migrated-read-only" && typeof assignment.profileId === "string" && assignment.profileId !== context.profileId) {
      throw new Error("The legacy BUZZ identity was already assigned to another Human profile and cannot be duplicated.");
    }

    const legacy = createLegacyCredentialMigrationSource([CONNECTION_FILE]);
    const source = Object.freeze({
      ...legacy,
      async listCredentials() {
        return withoutProfileRequestContext(() => legacy.listCredentials());
      },
    });
    await context.privateStorage.migrateLegacyProfile(context.authContext, source);
    if (await context.privateStorage.readCredential(context.authContext, CONNECTION_FILE) === null) {
      throw new Error("The legacy BUZZ migration completed without a verified Human identity record.");
    }
    return status();
  } finally {
    release();
  }
}

export function buzzProfileMigrationGateway(): Plugin {
  return {
    name: "plotpickle-buzz-profile-migration-gateway",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const rawUrl = request.url;
        if (!rawUrl) { next(); return; }
        let url: URL;
        try { url = new URL(rawUrl, "http://127.0.0.1"); } catch { next(); return; }
        if (url.pathname !== API) { next(); return; }
        if (!isLocalRequest(request)) {
          sendJson(response, 403, { ok: false, message: "Legacy BUZZ migration is available only from the local PlotPickle application." });
          return;
        }
        const operation = request.method === "GET"
          ? status
          : request.method === "POST"
            ? migrate
            : null;
        if (!operation) {
          sendJson(response, 405, { ok: false, message: "Legacy BUZZ migration method not allowed." });
          return;
        }
        void operation()
          .then((result) => sendJson(response, 200, result))
          .catch((error) => sendJson(response, 409, {
            ok: false,
            message: error instanceof Error ? error.message.replace(/nsec1[a-z0-9]+/gi, "[redacted-nsec]").slice(0, 500) : "Legacy BUZZ migration failed.",
          }));
      });
    },
  };
}
