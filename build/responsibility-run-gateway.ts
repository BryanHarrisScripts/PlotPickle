import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import path from "node:path";
import type { Plugin } from "vite";
import { persistentHome } from "./local-credentials";
import { CONNECTOR_POLICY_SCOPES, type ConnectorPolicyScope } from "../lib/connector-trust-policy";
import { projectResponsibilityRunLifecycleStatus } from "../lib/agents/responsibility/responsibility-run-lifecycle-status.mjs";
import {
  addResponsibilityArtifact,
  beginResponsibilityAttempt,
  cancelResponsibilityRun,
  createCreativeResponsibilityRun,
  createDeterministicResponsibilityRun,
  createResponsibilityRun,
  pauseResponsibilityRun,
  prepareResponsibilityRun,
  redirectResponsibilityRun,
  requestWriterApproval,
  restartResponsibilityRunContext,
  resumeResponsibilityRun,
  type ResponsibilityRun,
  type ResponsibilityRunContextRef,
  type ResponsibilityRunHandoff,
  type ResponsibilityRunKind,
  type ResponsibilityVerificationMode,
} from "../lib/responsibility-runs";

const API = "/api/responsibility-runs";
const MAX_BODY = 64 * 1024;
const SAFE_RUN_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{5,180}$/;
const ALLOWED_SCOPES = new Set<string>(CONNECTOR_POLICY_SCOPES);

function root() {
  return path.join(persistentHome(), "responsibility-runs");
}

function local(request: IncomingMessage) {
  const address = request.socket.remoteAddress || "";
  if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(address)) return false;
  return /^(?:127\.0\.0\.1|localhost|\[::1\])(?::\d+)?$/.test(request.headers.host || "");
}

function send(response: ServerResponse, status: number, value: Record<string, unknown>) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(value));
}

async function body(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += part.length;
    if (size > MAX_BODY) throw new Error("Responsibility Run request is too large.");
    chunks.push(part);
  }
  const value: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Enter a valid Responsibility Run request.");
  return value as Record<string, unknown>;
}

function runFile(runId: string) {
  if (!SAFE_RUN_ID.test(runId)) throw new Error("Choose a valid Responsibility Run ID.");
  return path.join(root(), `${runId}.json`);
}

function validRun(value: unknown): value is ResponsibilityRun {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const run = value as Partial<ResponsibilityRun>;
  return run.version === 1 && typeof run.runId === "string" && SAFE_RUN_ID.test(run.runId)
    && typeof run.goal === "string" && typeof run.profileId === "string" && typeof run.state === "string"
    && Array.isArray(run.events) && Boolean(run.limits) && Boolean(run.usage);
}

function withLifecycleStatus(run: ResponsibilityRun) {
  return { ...run, lifecycleStatus: projectResponsibilityRunLifecycleStatus(run) };
}

async function readRun(runId: string) {
  try {
    const value: unknown = JSON.parse(await readFile(runFile(runId), "utf8"));
    if (!validRun(value)) throw new Error("Responsibility Run record failed integrity checks.");
    return value;
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === "ENOENT") return null;
    throw error;
  }
}

async function saveRun(run: ResponsibilityRun) {
  if (!validRun(run)) throw new Error("Responsibility Run record failed integrity checks.");
  await mkdir(root(), { recursive: true, mode: 0o700 });
  const file = runFile(run.runId);
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(run, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, file);
  return run;
}

async function listRuns() {
  await mkdir(root(), { recursive: true, mode: 0o700 });
  const entries = (await readdir(root(), { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name.slice(0, -5))
    .filter((id) => SAFE_RUN_ID.test(id))
    .slice(-100);
  const runs = (await Promise.all(entries.map((id) => readRun(id)))).filter((run): run is ResponsibilityRun => Boolean(run));
  return runs.sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)).slice(0, 50);
}

function strings(value: unknown, maximum = 128) {
  return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string" && item.trim().length > 0))].slice(0, maximum) : [];
}

function scopes(value: unknown): ConnectorPolicyScope[] {
  return strings(value).filter((item): item is ConnectorPolicyScope => ALLOWED_SCOPES.has(item));
}

function limits(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, number> : {};
}

function context(value: unknown): ResponsibilityRunContextRef | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const taskId = typeof source.taskId === "string" ? source.taskId.trim().slice(0, 180) : "";
  const receiptGeneratedAt = typeof source.receiptGeneratedAt === "string" ? source.receiptGeneratedAt : "";
  if (!taskId || !Number.isFinite(Date.parse(receiptGeneratedAt))) throw new Error("Responsibility Run context requires a taskId and valid receipt timestamp.");
  return {
    taskId,
    sourceIds: strings(source.sourceIds, 256).map((item) => item.slice(0, 240)),
    receiptGeneratedAt: new Date(receiptGeneratedAt).toISOString(),
  };
}

function createFromInput(input: Record<string, unknown>) {
  const kind: ResponsibilityRunKind = input.kind === "creative-proposal" ? "creative-proposal" : input.kind === "deterministic-verification" ? "deterministic-verification" : "general";
  const common = {
    runId: typeof input.runId === "string" ? input.runId : undefined,
    goal: typeof input.goal === "string" ? input.goal : "",
    profileId: typeof input.profileId === "string" ? input.profileId : "",
    skillUris: strings(input.skillUris),
    allowedScopes: scopes(input.allowedScopes),
    allowedConnectorIds: strings(input.allowedConnectorIds),
    context: context(input.context),
    limits: limits(input.limits),
    parentRunId: typeof input.parentRunId === "string" ? input.parentRunId : "",
  };
  if (kind === "creative-proposal") return createCreativeResponsibilityRun(common);
  if (kind === "deterministic-verification") return createDeterministicResponsibilityRun(common);
  const verificationMode: ResponsibilityVerificationMode = input.verificationMode === "writer-approval" ? "writer-approval" : "deterministic";
  return createResponsibilityRun({ ...common, kind: "general", verificationMode });
}

async function mutate(input: Record<string, unknown>) {
  const action = String(input.action || "");
  if (action === "create") return saveRun(createFromInput(input));
  const runId = typeof input.runId === "string" ? input.runId : "";
  const current = await readRun(runId);
  if (!current) throw new Error("Responsibility Run was not found.");
  if (action === "start") {
    const characters = Math.max(0, Math.floor(Number(input.contextCharacters) || 0));
    const prepared = prepareResponsibilityRun(current, characters);
    return saveRun(prepared.state === "failed" ? prepared : beginResponsibilityAttempt(prepared));
  }
  if (action === "proposal-ready") {
    const resultId = typeof input.resultId === "string" ? input.resultId.trim().slice(0, 180) : "";
    if (!resultId) throw new Error("A proposal result ID is required.");
    const producedAt = typeof input.producedAt === "string" && Number.isFinite(Date.parse(input.producedAt))
      ? new Date(input.producedAt).toISOString()
      : new Date().toISOString();
    const ref = typeof input.ref === "string" && input.ref.trim() ? input.ref.trim().slice(0, 500) : `story-result:${resultId}`;
    const withArtifact = addResponsibilityArtifact(current, { id: resultId, kind: "proposal", ref, producedAt });
    return saveRun(requestWriterApproval(withArtifact, producedAt));
  }
  if (action === "pause") return saveRun(pauseResponsibilityRun(current));
  if (action === "resume") return saveRun(resumeResponsibilityRun(current));
  if (action === "cancel") return saveRun(cancelResponsibilityRun(current, typeof input.reason === "string" ? input.reason : "Cancelled by the user."));
  if (action === "redirect") return saveRun(redirectResponsibilityRun(current, {
    writerId: typeof input.writerId === "string" ? input.writerId : "",
    goal: typeof input.goal === "string" ? input.goal : "",
    note: typeof input.note === "string" ? input.note : "",
  }));
  if (action === "fresh-context") {
    const handoffSource = input.handoff && typeof input.handoff === "object" && !Array.isArray(input.handoff) ? input.handoff as Record<string, unknown> : {};
    const handoff: Omit<ResponsibilityRunHandoff, "createdAt"> = {
      status: typeof handoffSource.status === "string" ? handoffSource.status : "",
      summary: typeof handoffSource.summary === "string" ? handoffSource.summary : "",
      evidence: strings(handoffSource.evidence, 24),
      nextSteps: strings(handoffSource.nextSteps, 24),
      blocker: typeof handoffSource.blocker === "string" ? handoffSource.blocker : "",
    };
    return saveRun(restartResponsibilityRunContext(current, handoff));
  }
  throw new Error("Choose create, start, proposal-ready, pause, resume, cancel, redirect or fresh-context.");
}

export function responsibilityRunGateway(): Plugin {
  return {
    name: "plotpickle-responsibility-run-gateway",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
        if (url.pathname !== API) { next(); return; }
        if (!local(request)) { send(response, 403, { ok: false, message: "Responsibility Runs are available only inside this local PlotPickle Studio." }); return; }
        void (async () => {
          try {
            if (request.method === "GET") {
              const requested = url.searchParams.get("runId") || "";
              if (requested) {
                const run = await readRun(requested);
                if (!run) { send(response, 404, { ok: false, message: "Responsibility Run was not found." }); return; }
                send(response, 200, { ok: true, run: withLifecycleStatus(run) });
                return;
              }
              const runs = await listRuns();
              send(response, 200, { ok: true, runs: runs.map(withLifecycleStatus), count: runs.length });
              return;
            }
            if (request.method === "POST") {
              const run = await mutate(await body(request));
              send(response, 200, { ok: true, run: withLifecycleStatus(run) });
              return;
            }
            send(response, 405, { ok: false, message: "Use GET or POST for Responsibility Runs." });
          } catch (error) {
            send(response, 400, { ok: false, message: error instanceof Error ? error.message : "Responsibility Run action failed." });
          }
        })();
      });
    },
  };
}
