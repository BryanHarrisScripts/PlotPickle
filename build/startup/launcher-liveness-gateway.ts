import { existsSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

const STARTUP_PROBE_HEADER = "x-plotpickle-startup-probe";
type StartupProbePurpose = "warmup" | "liveness" | "existing-session" | "companion-maintenance";

function isPowerShellRequest(request: IncomingMessage) {
  const userAgent = request.headers["user-agent"];
  const value = Array.isArray(userAgent) ? userAgent.join(" ") : (userAgent ?? "");
  return /powershell/i.test(value);
}

export function startupProbePurpose(request: IncomingMessage): StartupProbePurpose | null {
  const header = request.headers[STARTUP_PROBE_HEADER];
  const value = Array.isArray(header) ? header[0] : header;
  return value === "warmup" || value === "liveness" || value === "existing-session" || value === "companion-maintenance" ? value : null;
}

function isManagedAppRoute(url: string | undefined) {
  return url === "/" || url === "/skin-v1";
}

export function isLauncherWarmupProbe(request: IncomingMessage) {
  return request.method === "GET"
    && isManagedAppRoute(request.url)
    && ["warmup", "companion-maintenance"].includes(startupProbePurpose(request) ?? "");
}

export function isLauncherLivenessProbe(request: IncomingMessage) {
  const browserState = process.env.PLOTPICKLE_BROWSER_STATE;
  const explicitLiveness = startupProbePurpose(request) === "liveness";
  return Boolean(
    request.method === "GET"
      && isManagedAppRoute(request.url)
      && (
        explicitLiveness
        || (
          browserState
          && existsSync(browserState)
          && isPowerShellRequest(request)
        )
      ),
  );
}

function answerLauncherLivenessProbe(response: ServerResponse) {
  response.statusCode = 204;
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-PlotPickle-Startup-Probe", "liveness-no-render");
  response.end();
}

export function launcherLivenessGateway(): Plugin {
  return {
    name: "plotpickle:launcher-liveness-gateway",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (isLauncherWarmupProbe(request)) {
          response.setHeader("X-PlotPickle-Startup-Probe", "warmup-render");
          return next();
        }
        if (!isLauncherLivenessProbe(request)) return next();
        answerLauncherLivenessProbe(response);
      });
    },
  };
}
