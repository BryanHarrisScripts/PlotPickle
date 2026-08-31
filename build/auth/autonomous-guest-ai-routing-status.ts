import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "vite";
import { getAutonomousGuestAuthority } from "../../core/auth/autonomous-guest/guest-authority";
import { getProfileExperienceRuntime } from "../../core/auth/profile-experience/profile-experience-runtime";
import { isLocalPlotPickleRequest } from "../projects/portable-ppf-reader";

const STATUS_PATH = "/api/ai-routing/status";

function requestOrigin(request: IncomingMessage) {
  const host = request.headers.host;
  if (!host) throw new Error("Autonomous Guest AI status requires a local Host header.");
  if (request.headers.origin) return new URL(request.headers.origin).origin;
  return `http://${host}`;
}

function sendGuestStatus(response: ServerResponse, body: Record<string, unknown>) {
  response.statusCode = 200;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(body));
}

function unavailable(locality: "local" | "cloud", settingsTarget: string, cost: string) {
  return {
    configured: false,
    ready: false,
    model: "",
    verifiedAt: "",
    error: "Autonomous Guest does not inherit Human provider configuration or credentials.",
    locality,
    cost,
    settingsTarget,
  };
}

function guestStatus(authority: NonNullable<ReturnType<typeof getAutonomousGuestAuthority>>) {
  return {
    ok: true,
    authorityScope: authority.authorityClass,
    guestPolicy: {
      workspaceId: authority.workspaceId,
      humanCredentialsInherited: false,
      silentPaidFallback: false,
      providerSelection: "run-scoped-explicit",
    },
    choice: { version: 1, text: "off", image: "manual", video: "off", updatedAt: "" },
    consent: {
      cloudSelectionRequiresCostAcknowledgement: true,
      cloudVideoRequiresDataSharingAcknowledgement: true,
      silentPaidFallback: false,
    },
    text: {
      selected: "off",
      options: {
        ollama: unavailable("local", "ollama", "No per-request provider charge"),
        openai: unavailable("cloud", "openai", "Paid API usage"),
        minimax: unavailable("cloud", "minimax", "Paid API usage"),
        gemini: unavailable("cloud", "gemini", "Provider account usage"),
        off: { configured: true, ready: true, model: "", verifiedAt: "", error: "", locality: "off", cost: "No AI cost", settingsTarget: "" },
      },
    },
    image: {
      selected: "manual",
      options: {
        comfyui: unavailable("local", "comfyui", "No per-request provider charge"),
        "ollama-comfyui": unavailable("local", "ollama", "No per-request provider charge"),
        openai: unavailable("cloud", "openai", "Paid API usage"),
        minimax: unavailable("cloud", "minimax", "Paid API usage"),
        manual: { configured: true, ready: true, model: "", verifiedAt: "", error: "", locality: "manual", cost: "No AI cost", settingsTarget: "" },
      },
    },
    video: {
      selected: "off",
      options: {
        "comfyui-native": unavailable("local", "comfyui", "No per-request provider charge"),
        minimax: unavailable("cloud", "minimax", "Paid API usage"),
        openai: unavailable("cloud", "openai", "Paid API usage"),
        off: { configured: true, ready: true, model: "", verifiedAt: "", error: "", locality: "off", cost: "No video generation cost", settingsTarget: "" },
      },
    },
  };
}

export function registerAutonomousGuestRoutingStatus(server: ViteDevServer) {
  server.middlewares.use((request, response, next) => {
    const pathname = request.url?.split("?", 1)[0] || "";
    if (pathname !== STATUS_PATH || request.method !== "GET") { next(); return; }
    if (!isLocalPlotPickleRequest(request)) { next(); return; }

    void (async () => {
      const runtime = await getProfileExperienceRuntime();
      const authority = getAutonomousGuestAuthority(requestOrigin(request), runtime.accessMode);
      if (!authority) { next(); return; }
      sendGuestStatus(response, guestStatus(authority));
    })().catch((error) => {
      if (response.headersSent) return;
      response.statusCode = 500;
      response.setHeader("Content-Type", "application/json; charset=utf-8");
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.end(JSON.stringify({ ok: false, message: error instanceof Error ? error.message : "Autonomous Guest AI status is unavailable." }));
    });
  });
}
