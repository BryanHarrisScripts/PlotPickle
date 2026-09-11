import {
  getProfileExperienceRuntime,
  requestBoundary,
} from "../../../../core/auth/profile-experience/profile-experience-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CREDENTIAL_NAME = "comfy-cloud.json";
const BASE_URL = "https://cloud.comfy.org";
const OBJECT_INFO_PATH = "/api/object_info";

type AccessMode = "browser" | "api";
type OutputHandling = "download" | "cloud";
type WorkflowLane = "cinematic" | "marketing" | "utility";
type Concurrency = 1 | 2 | 4;

type ComfyCloudSettings = {
  version: 1;
  apiKey: string;
  accessMode: AccessMode;
  concurrency: Concurrency;
  outputHandling: OutputHandling;
  defaultLane: WorkflowLane;
  savedAt: string;
  testedAt: string;
  testedNodeCount: number;
};

function response(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function authorized(request: Request, mutation = false) {
  const runtimeState = await getProfileExperienceRuntime();
  const boundary = runtimeState.boundaryFor(new URL(request.url).origin);
  const { authContext } = await boundary.authorizeRequest(
    requestBoundary(request),
    mutation ? { mutation: true } : undefined,
  );
  return { runtimeState, authContext };
}

function normalized(value: unknown): ComfyCloudSettings {
  const item = value && typeof value === "object" && !Array.isArray(value)
    ? value as Partial<ComfyCloudSettings>
    : {};
  const concurrency: Concurrency = item.concurrency === 2 || item.concurrency === 4 ? item.concurrency : 1;
  const accessMode: AccessMode = item.accessMode === "api" ? "api" : "browser";
  const outputHandling: OutputHandling = item.outputHandling === "cloud" ? "cloud" : "download";
  const defaultLane: WorkflowLane = item.defaultLane === "marketing" || item.defaultLane === "utility" ? item.defaultLane : "cinematic";
  return {
    version: 1,
    apiKey: typeof item.apiKey === "string" ? item.apiKey.trim() : "",
    accessMode,
    concurrency,
    outputHandling,
    defaultLane,
    savedAt: typeof item.savedAt === "string" ? item.savedAt : "",
    testedAt: typeof item.testedAt === "string" ? item.testedAt : "",
    testedNodeCount: Number.isInteger(item.testedNodeCount) && Number(item.testedNodeCount) >= 0 ? Number(item.testedNodeCount) : 0,
  };
}

function publicSettings(settings: ComfyCloudSettings) {
  const configured = Boolean(settings.apiKey);
  const tested = configured && Boolean(settings.testedAt);
  return {
    ok: true,
    baseUrl: BASE_URL,
    configured,
    tested,
    testedAt: settings.testedAt,
    testedNodeCount: settings.testedNodeCount,
    accessMode: settings.accessMode,
    concurrency: settings.concurrency,
    outputHandling: settings.outputHandling,
    defaultLane: settings.defaultLane,
    transports: {
      directApi: tested ? "tested" : configured ? "configured" : "not-configured",
      mcp: "not-connected",
      cli: "advanced-not-managed",
    },
  };
}

function cleanApiKey(value: unknown) {
  const key = typeof value === "string" ? value.trim() : "";
  if (key.length > 4096 || /[\r\n\0]/u.test(key)) throw new Error("The Comfy Cloud API key is invalid.");
  return key;
}

function accessMode(value: unknown): AccessMode {
  if (value === "browser" || value === "api") return value;
  throw new Error("Choose Browser / Manual or API Automation.");
}

function concurrency(value: unknown): Concurrency {
  if (value === 1 || value === 2 || value === 4) return value;
  throw new Error("Choose a PlotPickle concurrency cap of 1, 2 or 4.");
}

function outputHandling(value: unknown): OutputHandling {
  if (value === "download" || value === "cloud") return value;
  throw new Error("Choose whether completed outputs are downloaded or left in Comfy Cloud.");
}

function workflowLane(value: unknown): WorkflowLane {
  if (value === "cinematic" || value === "marketing" || value === "utility") return value;
  throw new Error("Choose Cinematic, Marketing or Utility as the default workflow lane.");
}

async function readSettings(runtimeState: Awaited<ReturnType<typeof getProfileExperienceRuntime>>, authContext: Parameters<typeof runtimeState.privateStorage.readCredential>[0]) {
  return normalized(await runtimeState.privateStorage.readCredential(authContext, CREDENTIAL_NAME));
}

async function testConnection(settings: ComfyCloudSettings) {
  if (!settings.apiKey) throw new Error("Save a Comfy Cloud API key before testing the connection.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const remote = await fetch(`${BASE_URL}${OBJECT_INFO_PATH}`, {
      method: "GET",
      headers: { "X-API-Key": settings.apiKey, Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!remote.ok) throw new Error(`Comfy Cloud rejected the non-generative connection test (HTTP ${remote.status}).`);
    const body: unknown = await remote.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("Comfy Cloud returned an unexpected object-info response.");
    return Object.keys(body as Record<string, unknown>).length;
  } finally {
    clearTimeout(timeout);
  }
}

export async function GET(request: Request) {
  try {
    const { runtimeState, authContext } = await authorized(request);
    return response(publicSettings(await readSettings(runtimeState, authContext)));
  } catch {
    return response({ ok: false, message: "Comfy Cloud authority could not be read for this authenticated Human profile." }, 403);
  }
}

export async function POST(request: Request) {
  try {
    const { runtimeState, authContext } = await authorized(request, true);
    const input = await request.json() as Record<string, unknown>;
    const current = await readSettings(runtimeState, authContext);

    if (input.action === "save") {
      const next: ComfyCloudSettings = {
        ...current,
        accessMode: accessMode(input.accessMode),
        concurrency: concurrency(input.concurrency),
        outputHandling: outputHandling(input.outputHandling),
        defaultLane: workflowLane(input.defaultLane),
        apiKey: cleanApiKey(input.apiKey) || current.apiKey,
        savedAt: new Date().toISOString(),
      };
      if (next.accessMode === "api" && !next.apiKey) {
        return response({ ok: false, message: "API Automation requires a user-owned Comfy Cloud API key." }, 400);
      }
      if (next.apiKey !== current.apiKey) {
        next.testedAt = "";
        next.testedNodeCount = 0;
      }
      await runtimeState.privateStorage.writeCredential(authContext, CREDENTIAL_NAME, next);
      return response({
        ...publicSettings(next),
        message: "Comfy Cloud preferences saved for this Human profile. No workflow was submitted and no generation credits were used.",
      });
    }

    if (input.action === "test") {
      const nodeCount = await testConnection(current);
      const next: ComfyCloudSettings = {
        ...current,
        testedAt: new Date().toISOString(),
        testedNodeCount: nodeCount,
      };
      await runtimeState.privateStorage.writeCredential(authContext, CREDENTIAL_NAME, next);
      return response({
        ...publicSettings(next),
        message: `Comfy Cloud connection verified with a non-generative object-info request (${nodeCount} node definitions reported).`,
      });
    }

    return response({ ok: false, message: "Choose Save or Test Connection for Comfy Cloud." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Comfy Cloud setup failed.";
    return response({ ok: false, message }, 400);
  }
}
