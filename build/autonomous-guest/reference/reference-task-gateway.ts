import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import { getAutonomousGuestAuthority } from "../../../core/auth/autonomous-guest/guest-authority";
import {
  claimAutonomousGuestReferenceRouteTask,
  finishAutonomousGuestReferenceRouteTask,
  initializeAutonomousGuestReferenceTasks,
  readAutonomousGuestReferenceTaskStatus,
} from "./reference-route-tasks";

const API = "/api/autonomous-guest/reference-tasks";
const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
const MAX_BODY = 64 * 1024;

function send(response: ServerResponse, status: number, body: unknown) {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.setHeader("referrer-policy", "no-referrer");
  response.setHeader("x-content-type-options", "nosniff");
  response.end(`${JSON.stringify(body)}\n`);
}

function localOrigin(request: IncomingMessage) {
  const remote = String(request.socket.remoteAddress || "").toLowerCase();
  if (!LOOPBACK.has(remote)) throw new Error("Autonomous Guest reference tasks are loopback-only.");
  const host = String(request.headers.host || "").trim();
  if (!host) throw new Error("Autonomous Guest reference tasks require a local Host header.");
  const origin = new URL(`http://${host}`);
  if (!LOOPBACK_HOSTS.has(origin.hostname)) throw new Error("Autonomous Guest reference tasks require a loopback host.");
  const suppliedOrigin = String(request.headers.origin || "").trim();
  if (suppliedOrigin && new URL(suppliedOrigin).host !== origin.host) {
    throw new Error("Autonomous Guest reference tasks reject cross-origin requests.");
  }
  return origin.origin;
}

function parseRequestObject(source: string) {
  const parsed: unknown = JSON.parse(source || "{}");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Autonomous Guest reference task request is invalid.");
  }
  return parsed as Record<string, unknown>;
}

async function readReferenceRequest(request: IncomingMessage) {
  let bytes = 0;
  const chunks: Buffer[] = [];
  for await (const raw of request) {
    const chunk = Buffer.from(raw);
    bytes += chunk.byteLength;
    if (bytes > MAX_BODY) throw new Error("Autonomous Guest reference task request is too large.");
    chunks.push(chunk);
  }
  return parseRequestObject(Buffer.concat(chunks).toString("utf8"));
}

function stringRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, String(entry ?? "")]));
}

function safeError(error: unknown) {
  return (error instanceof Error ? error.message : "Autonomous Guest reference task request failed.")
    .replace(/(password|secret|private[_ -]?key|api[_ -]?key|token)\s*[=:]\s*\S+/gi, "$1=[redacted]")
    .slice(0, 900);
}

async function handle(request: IncomingMessage, response: ServerResponse) {
  try {
    const origin = localOrigin(request);
    const authority = getAutonomousGuestAuthority(origin, "desktop-loopback");
    if (!authority) {
      send(response, 409, { code: "AUTONOMOUS_GUEST_UNAVAILABLE", message: "Autonomous Guest reference tasks are unavailable for this local runtime." });
      return;
    }
    if (request.method === "GET") {
      send(response, 200, await readAutonomousGuestReferenceTaskStatus(authority));
      return;
    }
    if (request.method !== "POST") {
      send(response, 405, { code: "AUTONOMOUS_GUEST_REFERENCE_METHOD", message: "Autonomous Guest reference tasks support GET and POST only." });
      return;
    }
    const input = await readReferenceRequest(request);
    const action = String(input.action || "");
    if (action === "initialize") {
      const routeIds = Array.isArray(input.routeIds) ? input.routeIds.map(String) : [];
      send(response, 200, await initializeAutonomousGuestReferenceTasks(authority, {
        projectId: String(input.projectId || ""),
        currentRevision: String(input.currentRevision || ""),
        routeIds,
        routeInputs: stringRecord(input.routeInputs),
      }));
      return;
    }
    if (action === "claim") {
      send(response, 200, await claimAutonomousGuestReferenceRouteTask(authority, String(input.routeId || "")));
      return;
    }
    if (action === "finish") {
      send(response, 200, await finishAutonomousGuestReferenceRouteTask(authority, {
        routeId: String(input.routeId || ""),
        taskId: String(input.taskId || ""),
        leaseId: String(input.leaseId || ""),
        disposition: String(input.disposition || ""),
        actionId: typeof input.actionId === "string" ? input.actionId : undefined,
        revision: typeof input.revision === "string" ? input.revision : undefined,
      }));
      return;
    }
    if (action === "status") {
      send(response, 200, await readAutonomousGuestReferenceTaskStatus(authority));
      return;
    }
    send(response, 400, { code: "AUTONOMOUS_GUEST_REFERENCE_ACTION_UNKNOWN", message: "Autonomous Guest reference task action is not supported." });
  } catch (error) {
    send(response, 400, { code: "AUTONOMOUS_GUEST_REFERENCE_TASK_REJECTED", message: safeError(error) });
  }
}

export function autonomousGuestReferenceTaskGateway(): Plugin {
  return {
    name: "plotpickle-autonomous-guest-reference-tasks",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url || "/", "http://127.0.0.1").pathname;
        if (pathname !== API) { next(); return; }
        void handle(request, response);
      });
    },
  };
}
