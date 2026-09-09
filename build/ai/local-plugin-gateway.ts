import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "vite";
import {
  localPluginsForCapability,
  recommendLocalPlugin,
  type AiLocalPluginDefinition,
  type AiSourceCapability,
} from "../../lib/runtime/ai/source-registry";
import { detectLocalHardware } from "../local-hardware-detection";
import { probeLocalAiPluginAdapter } from "./local-plugin-adapters";

const API_ROOT = "/api/local-ai/plugins";
const CAPABILITIES: readonly AiSourceCapability[] = ["text", "image", "video"];

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

function sendJson(response: ServerResponse, status: number, body: Record<string, unknown>) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(body));
}

function requestedCapability(pathname: string): AiSourceCapability | null {
  if (pathname === API_ROOT) return null;
  if (!pathname.startsWith(`${API_ROOT}/`)) return null;
  const value = pathname.slice(API_ROOT.length + 1);
  return CAPABILITIES.includes(value as AiSourceCapability) ? value as AiSourceCapability : null;
}

function publicPlugin(plugin: AiLocalPluginDefinition, hardwareProfileId: string) {
  return {
    id: plugin.id,
    capability: plugin.capability,
    label: plugin.label,
    description: plugin.description,
    runtimeProviderId: plugin.runtimeProviderId,
    adapterId: plugin.adapterId,
    modes: plugin.modes,
    advanced: plugin.advanced,
    preset: plugin.preset,
    hardwarePriority: plugin.hardwarePriority[hardwareProfileId] ?? null,
  };
}

async function capabilitySnapshot(capability: AiSourceCapability, hardwareProfileId: string) {
  const recommendation = recommendLocalPlugin(capability, hardwareProfileId);
  const candidates = localPluginsForCapability(capability)
    .map((plugin) => publicPlugin(plugin, hardwareProfileId))
    .filter((plugin) => typeof plugin.hardwarePriority === "number")
    .sort((left, right) => (left.hardwarePriority as number) - (right.hardwarePriority as number) || left.id.localeCompare(right.id));
  if (!recommendation) {
    return {
      capability,
      automatic: true,
      hardwareProfileId,
      selected: null,
      candidates,
      ready: false,
      active: false,
      error: `No reviewed local ${capability} plug-in supports hardware profile ${hardwareProfileId}.`,
    };
  }
  const probe = await probeLocalAiPluginAdapter(recommendation.plugin.adapterId);
  return {
    capability,
    automatic: true,
    hardwareProfileId,
    selected: publicPlugin(recommendation.plugin, hardwareProfileId),
    candidates,
    ready: probe.ready,
    active: probe.active,
    configured: probe.configured,
    runtimeReady: probe.runtimeReady,
    error: probe.error,
    details: probe.details,
  };
}

export function registerLocalPluginGateway(server: ViteDevServer) {
  server.middlewares.use((request, response, next) => {
    const pathname = request.url?.split("?", 1)[0] || "";
    const capability = requestedCapability(pathname);
    const handlesRoot = pathname === API_ROOT;
    if ((!handlesRoot && !capability) || request.method !== "GET") {
      next();
      return;
    }
    if (!isLocalRequest(request)) {
      sendJson(response, 403, { ok: false, message: "Local AI plug-in information is restricted to this computer." });
      return;
    }
    void (async () => {
      const hardware = await detectLocalHardware();
      if (capability) {
        sendJson(response, 200, {
          ok: true,
          hardware: {
            profileId: hardware.profile.id,
            profileLabel: hardware.profile.label,
            gpuName: hardware.gpuName,
            gpuGeneration: hardware.gpuGeneration,
            vramGb: hardware.vramGb,
            ramGb: hardware.ramGb,
          },
          recommendation: await capabilitySnapshot(capability, hardware.profile.id),
        });
        return;
      }
      const entries = await Promise.all(CAPABILITIES.map(async (item) => [
        item,
        await capabilitySnapshot(item, hardware.profile.id),
      ] as const));
      sendJson(response, 200, {
        ok: true,
        hardware: {
          profileId: hardware.profile.id,
          profileLabel: hardware.profile.label,
          gpuName: hardware.gpuName,
          gpuGeneration: hardware.gpuGeneration,
          vramGb: hardware.vramGb,
          ramGb: hardware.ramGb,
        },
        recommendations: Object.fromEntries(entries),
      });
    })().catch((error) => {
      sendJson(response, 500, {
        ok: false,
        message: error instanceof Error ? error.message : "Local AI plug-in selection failed.",
      });
    });
  });
}
