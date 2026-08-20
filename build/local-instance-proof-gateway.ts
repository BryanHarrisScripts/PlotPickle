import { spawnSync } from "node:child_process";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

const API = "/api/local-instance-proof";
const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

function actualCommit() {
  const result = spawnSync("git", ["rev-parse", "HEAD"], {
    cwd: process.cwd(),
    encoding: "utf8",
    windowsHide: true,
    stdio: ["ignore", "pipe", "ignore"],
    timeout: 5_000,
  });
  if (result.error || result.status !== 0) return "";
  return String(result.stdout || "").trim().toLowerCase();
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(`${JSON.stringify(body)}\n`);
}

function handle(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "GET") return send(res, 405, { error: "method_not_allowed" });
  const remote = String(req.socket.remoteAddress || "").toLowerCase();
  if (!LOOPBACK.has(remote)) return send(res, 403, { error: "loopback_only" });

  const instanceRef = String(process.env.PLOTPICKLE_INSTANCE_ID || "").trim();
  const endpointId = String(process.env.PLOTPICKLE_ENDPOINT_ID || "").trim();
  const expectedCommit = String(process.env.PLOTPICKLE_EXPECTED_COMMIT || "").trim().toLowerCase();
  const worktreeRef = String(process.env.PLOTPICKLE_ENDPOINT_WORKTREE || "").trim();
  const jobId = String(process.env.PLOTPICKLE_ENDPOINT_JOB || "").trim();
  const generation = Number(process.env.PLOTPICKLE_ENDPOINT_GENERATION || 0);
  if (!instanceRef || !endpointId || !expectedCommit || !worktreeRef || !jobId || !Number.isInteger(generation) || generation < 1) {
    return send(res, 404, { error: "managed_instance_proof_unavailable" });
  }

  const commitSha = actualCommit();
  return send(res, 200, {
    schemaVersion: 1,
    endpointId,
    generation,
    instanceRef,
    jobId,
    worktreeRef,
    commitSha,
    exactHead: Boolean(commitSha) && commitSha === expectedCommit,
    startupContract: String(process.env.PLOTPICKLE_STARTUP_CONTRACT || "unverified").slice(0, 120),
  });
}

export function localInstanceProofGateway(): Plugin {
  return {
    name: "plotpickle-local-instance-proof",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = new URL(req.url || "/", "http://127.0.0.1").pathname;
        if (pathname !== API) return next();
        handle(req, res);
      });
    },
  };
}
