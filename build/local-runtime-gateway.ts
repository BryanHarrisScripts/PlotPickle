import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "vite";
import type { LocalTextRole } from "../lib/ai/local-runtime";
import { localGpuSchedulerState } from "./local-gpu-resource-manager";
import {
  localRuntimeSnapshot,
  managedLlamaInstallPlan,
  readLocalRuntimeSettings,
  startManagedLlama,
  writeLocalRuntimeSettings,
  type LocalRuntimeSettings,
} from "./local-runtime-manager";

const API_ROOT = "/api/local-ai/runtime";
const SETTINGS_PATH = `${API_ROOT}/settings`;
const INSTALL_PLAN_PATH = `${API_ROOT}/install-plan`;
const ROLE_LOAD_PREFIX = `${API_ROOT}/model/`;

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

function requestedRole(pathname: string): LocalTextRole | null {
  if (!pathname.startsWith(ROLE_LOAD_PREFIX) || !pathname.endsWith("/load")) return null;
  const role = pathname.slice(ROLE_LOAD_PREFIX.length, -"/load".length);
  return role === "fast" || role === "quality" || role === "deep" ? role : null;
}

function sendJson(response: ServerResponse, status: number, body: Record<string, unknown>) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(body));
}

async function readBody(request: IncomingMessage, maximum = 64 * 1024): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += value.length;
    if (length > maximum) throw new Error("The local runtime settings request is too large.");
    chunks.push(value);
  }
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Enter valid local runtime settings.");
  return parsed as Record<string, unknown>;
}

async function saveSettings(body: Record<string, unknown>) {
  const current = await readLocalRuntimeSettings();
  const next: LocalRuntimeSettings = {
    ...current,
    preferredRuntime: body.preferredRuntime === "auto"
      || body.preferredRuntime === "llama.cpp"
      || body.preferredRuntime === "lm-studio"
      || body.preferredRuntime === "ollama"
      || body.preferredRuntime === "openai-compatible"
      ? body.preferredRuntime
      : current.preferredRuntime,
    contextTokens: body.contextTokens === 32768 ? 32768 : body.contextTokens === 16384 ? 16384 : current.contextTokens,
    endpointOverrides: body.endpointOverrides && typeof body.endpointOverrides === "object"
      ? body.endpointOverrides as LocalRuntimeSettings["endpointOverrides"]
      : current.endpointOverrides,
    modelOverrides: body.modelOverrides && typeof body.modelOverrides === "object"
      ? body.modelOverrides as LocalRuntimeSettings["modelOverrides"]
      : current.modelOverrides,
    managedLlama: body.managedLlama && typeof body.managedLlama === "object"
      ? { ...current.managedLlama, ...(body.managedLlama as Partial<LocalRuntimeSettings["managedLlama"]>) }
      : current.managedLlama,
  };
  return writeLocalRuntimeSettings(next);
}

export function registerLocalRuntimeGateway(server: ViteDevServer) {
  server.middlewares.use((request, response, next) => {
    const pathname = request.url?.split("?", 1)[0] || "";
    const roleToLoad = requestedRole(pathname);
    if (pathname !== API_ROOT && pathname !== SETTINGS_PATH && pathname !== INSTALL_PLAN_PATH && !roleToLoad) {
      next();
      return;
    }
    if (!isLocalRequest(request)) {
      sendJson(response, 403, { ok: false, message: "Local runtime information is restricted to this computer." });
      return;
    }
    void (async () => {
      if (pathname === API_ROOT && request.method === "GET") {
        const snapshot = await localRuntimeSnapshot();
        sendJson(response, 200, { ok: true, ...snapshot, scheduler: localGpuSchedulerState() });
        return;
      }
      if (pathname === SETTINGS_PATH && request.method === "POST") {
        await saveSettings(await readBody(request));
        const snapshot = await localRuntimeSnapshot();
        sendJson(response, 200, { ok: true, ...snapshot, scheduler: localGpuSchedulerState() });
        return;
      }
      if (roleToLoad && request.method === "POST") {
        const settings = await readLocalRuntimeSettings();
        const configuredManagedPath = settings.managedLlama.modelPaths[roleToLoad];
        const shouldStartManaged = settings.managedLlama.enabled
          && (settings.preferredRuntime === "auto" || settings.preferredRuntime === "llama.cpp")
          && Boolean(configuredManagedPath);
        const managedStarted = shouldStartManaged ? await startManagedLlama(roleToLoad) : false;
        const snapshot = await localRuntimeSnapshot();
        const roleStatus = snapshot.roles[roleToLoad];
        const common = {
          role: roleToLoad,
          managedStarted,
          roleStatus,
          ...snapshot,
          scheduler: localGpuSchedulerState(),
        };
        if (!snapshot.activeRuntime.reachable) {
          sendJson(response, 409, {
            ok: false,
            message: "No local OpenAI-compatible runtime is reachable. Start Ollama, LM Studio, llama.cpp, or the configured compatible server, then refresh readiness.",
            ...common,
          });
          return;
        }
        if (!roleStatus.available) {
          sendJson(response, 409, {
            ok: false,
            message: snapshot.activeRuntime.models.length
              ? `The ${roleToLoad} role is not assigned to a model reported by ${snapshot.activeRuntime.label}. Choose one of the detected models in Settings and save before testing again.`
              : `${snapshot.activeRuntime.label} is reachable but did not report any installed model. Load or install a model in that runtime, then refresh readiness.`,
            availableModels: snapshot.activeRuntime.models,
            ...common,
          });
          return;
        }
        sendJson(response, 200, { ok: true, ...common });
        return;
      }
      if (pathname === INSTALL_PLAN_PATH && request.method === "GET") {
        const [snapshot, llamaPlan] = await Promise.all([localRuntimeSnapshot(), managedLlamaInstallPlan()]);
        sendJson(response, 200, {
          ok: true,
          hardwareProfile: snapshot.hardware.profile,
          llamaCpp: llamaPlan,
          retrieval: {
            service: "services/curriculum-rag/server.py",
            models: [snapshot.retrieval.embedding, snapshot.retrieval.reranker],
            device: "CPU",
          },
          image: {
            engine: "ComfyUI",
            defaultWorkflow: snapshot.image.workflow,
            optionalExperimental: snapshot.image.experimental,
          },
          video: {
            engine: "ComfyUI",
            defaultWorkflow: snapshot.video.workflow,
          },
          pascal: snapshot.hardware.compatibility.prohibitCuda13PyTorch ? {
            pytorchCuda: "12.6-compatible",
            llamaCpp: "CUDA 12.x preferred",
            fallback: "Vulkan",
            cuda13AutomaticInstall: false,
          } : null,
        });
        return;
      }
      sendJson(response, 405, { ok: false, message: "Method not allowed." });
    })().catch((error) => {
      sendJson(response, 500, {
        ok: false,
        message: error instanceof Error ? error.message : "The local runtime could not be inspected.",
      });
    });
  });
}