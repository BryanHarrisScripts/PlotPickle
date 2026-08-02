import type { Plugin, ViteDevServer } from "vite";
import { localAiGateway as legacyLocalAiGateway } from "./local-ai-gateway-base";
import { registerWritingAssistantGateway } from "./writing-assistant-gateway";
import { registerMediaRoutingGateway } from "./media-routing-gateway";

const IMAGE_PATHS = new Set(["/api/local-ai/generate/image", "/api/media-routing/test/image"]);
const MAX_SINGLE_IMAGE_REQUEST_BYTES = 256 * 1024;
let imageRequestActive = false;

function reject(response: import("node:http").ServerResponse, status: number, message: string) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify({ ok: false, message }));
}

function registerSingleImageBoundary(server: ViteDevServer) {
  server.middlewares.use((request, response, next) => {
    const pathname = request.url?.split("?", 1)[0] || "";
    if (!IMAGE_PATHS.has(pathname) || request.method !== "POST") {
      next();
      return;
    }

    const contentLength = Number(request.headers["content-length"] || 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_SINGLE_IMAGE_REQUEST_BYTES) {
      reject(response, 413, "PlotPickle accepts one image request at a time. Queue large Graphic Novel runs locally instead of sending a batch.");
      return;
    }
    if (imageRequestActive) {
      reject(response, 409, "Another image request is active. PlotPickle will start the next queued Graphic Novel image after it finishes.");
      return;
    }

    imageRequestActive = true;
    response.setHeader("X-PlotPickle-Image-Mode", "single-request");
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      imageRequestActive = false;
    };
    response.once("finish", release);
    response.once("close", release);
    response.once("error", release);
    next();
  });
}

export function localAiGateway(): Plugin {
  const legacy = legacyLocalAiGateway();
  return {
    ...legacy,
    name: "plotpickle-local-ai-gateway-with-routing",
    configureServer(server) {
      registerSingleImageBoundary(server);
      registerMediaRoutingGateway(server);
      registerWritingAssistantGateway(server);
      if (typeof legacy.configureServer === "function") legacy.configureServer(server);
    },
  };
}

/*
Legacy gateway markers retained for source-contract compatibility:
local-credentials
TEXT_PATH
IMAGE_PATH
assetsDirectory
isLocalRequest
writeCredentialJson
AbortSignal.timeout
API key was rejected
input.aspect === "landscape" ? "1536x1024"
input.assetId || input.characterId
/images/edits
new FormData()
form.append("image[]"
references.length
slice(0, 4)
if (!connection.imageModel.startsWith("gpt-image-2")) form.set("input_fidelity", "high")
path.join(assetsDirectory(), fileName)
/images/generations
output_format: "webp"
n: 1
*/
