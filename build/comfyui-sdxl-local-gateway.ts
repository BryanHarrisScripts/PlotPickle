import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "vite";
import { probeComfyUI } from "./comfyui-media-provider";
import { generateSdxlImage } from "./comfyui-sdxl-local-provider";
import { readMediaRoutingStore, writeMediaRoutingStore } from "./media-routing-store";
import type { ImageGenerationInput } from "./media-provider-common";

const IMAGE_PATH = "/api/local-ai/generate/image";
const TEST_IMAGE_PATH = "/api/media-routing/test/image";
const SDXL_PATTERN = /(sdxl|stable.?diffusion.?xl|juggernaut.?xl|realvis.?xl|dreamshaper.?xl)/i;

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
  } catch { return false; }
}

function sendJson(response: ServerResponse, status: number, body: Record<string, unknown>) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(body));
}

async function readBody(request: IncomingMessage, maximum = 256 * 1024): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += value.length;
    if (length > maximum) throw new Error("The local SDXL request is too large.");
    chunks.push(value);
  }
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Enter a valid local image request.");
  return parsed as Record<string, unknown>;
}

function defaultSdxlCheckpoint(checkpoints: readonly string[]) {
  return checkpoints.find((checkpoint) => SDXL_PATTERN.test(checkpoint)) || "";
}

export function registerSdxlLocalImageGateway(server: ViteDevServer) {
  server.middlewares.use((request, response, next) => {
    const pathname = request.url?.split("?", 1)[0] || "";
    if ((pathname !== IMAGE_PATH && pathname !== TEST_IMAGE_PATH) || request.method !== "POST") {
      next();
      return;
    }
    if (!isLocalRequest(request)) {
      sendJson(response, 403, { ok: false, message: "Local SDXL generation is restricted to this PlotPickle server." });
      return;
    }
    void (async () => {
      const store = await readMediaRoutingStore();
      if (store.imageRoute !== "comfyui") {
        next();
        return;
      }
      const probe = await probeComfyUI(store.comfyui.baseUrl, store.comfyui.h3Workflow);
      if (!probe.reachable || !probe.imageNodesReady) {
        throw new Error(probe.error || `ComfyUI is missing required image nodes: ${probe.missingImageNodes.join(", ")}`);
      }
      const explicitlySelected = store.comfyui.checkpoint && probe.checkpoints.includes(store.comfyui.checkpoint)
        ? store.comfyui.checkpoint
        : "";
      const checkpoint = explicitlySelected || defaultSdxlCheckpoint(probe.checkpoints);
      if (!checkpoint) {
        throw new Error("ComfyUI is running, but PlotPickle could not find an SDXL checkpoint. Install SDXL 1.0 or select an advanced checkpoint override in Settings.");
      }
      if (!explicitlySelected && store.comfyui.checkpoint !== checkpoint) {
        store.comfyui.checkpoint = checkpoint;
        await writeMediaRoutingStore(store);
      }
      const body = await readBody(request);
      const input: ImageGenerationInput = pathname === TEST_IMAGE_PATH ? {
        prompt: typeof body.prompt === "string" ? body.prompt : "A cinematic PlotPickle storyboard frame, clear composition, expressive natural light, no text.",
        aspect: "landscape",
        quality: "low",
        assetId: "sdxl-local-image-test",
        requestCount: 1,
      } : body;
      try {
        const result = await generateSdxlImage(store.comfyui.baseUrl, checkpoint, input);
        store.comfyui.imageVerifiedAt = new Date().toISOString();
        store.comfyui.lastError = "";
        await writeMediaRoutingStore(store);
        sendJson(response, 200, {
          ok: true,
          route: "comfyui",
          localProfile: "SDXL 1.0",
          checkpoint,
          continuityLayer: "provider-independent",
          ...result,
        });
      } catch (error) {
        store.comfyui.lastError = error instanceof Error ? error.message : "The SDXL image render failed.";
        await writeMediaRoutingStore(store);
        throw error;
      }
    })().catch((error) => {
      sendJson(response, 400, {
        ok: false,
        message: error instanceof Error ? error.message : "The local SDXL operation failed.",
      });
    });
  });
}
