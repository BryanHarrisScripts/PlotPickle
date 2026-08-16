import type { Plugin } from "vite";
import { runStartupAgentDiagnostics } from "./startup-agent-diagnostics-runtime-v4";
import { offerStartupUatDecision } from "./startup-uat-decision";

export { runStartupAgentDiagnostics };

export function startupAgentDiagnosticsPlugin(): Plugin {
  return {
    name: "plotpickle-startup-agent-diagnostics-with-uat-decision",
    configureServer(server) {
      server.httpServer?.once("listening", () => {
        const port = server.config.server.port || 5173;
        const baseUrl = `http://127.0.0.1:${port}`;
        setTimeout(() => {
          void (async () => {
            try {
              await runStartupAgentDiagnostics(baseUrl);
            } catch (error) {
              const message = error instanceof Error ? error.message : "unexpected diagnostic failure";
              console.error(`[STARTUP] Agent health check failed unexpectedly: ${message}`);
              console.error("OVERALL: NEEDS ATTENTION");
            } finally {
              await offerStartupUatDecision(baseUrl);
            }
          })();
        }, 750);
      });
    },
  };
}
