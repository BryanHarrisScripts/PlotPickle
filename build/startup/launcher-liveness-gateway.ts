import { existsSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

function isPowerShellRequest(request: IncomingMessage) {
  const userAgent = request.headers["user-agent"];
  const value = Array.isArray(userAgent) ? userAgent.join(" ") : (userAgent ?? "");
  return /powershell/i.test(value);
}

export function isLauncherLivenessProbe(request: IncomingMessage) {
  const browserState = process.env.PLOTPICKLE_BROWSER_STATE;
  return Boolean(
    browserState &&
      existsSync(browserState) &&
      request.method === "GET" &&
      request.url === "/" &&
      isPowerShellRequest(request),
  );
}

function answerLauncherLivenessProbe(response: ServerResponse) {
  response.statusCode = 204;
  response.setHeader("Cache-Control", "no-store");
  response.end();
}

export function launcherLivenessGateway(): Plugin {
  return {
    name: "plotpickle:launcher-liveness-gateway",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (!isLauncherLivenessProbe(request)) return next();
        answerLauncherLivenessProbe(response);
      });
    },
  };
}
