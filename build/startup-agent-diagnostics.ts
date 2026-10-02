import type { Plugin } from "vite";
import { runStartupAgentDiagnostics, runStartupAgentInventory } from "./startup-agent-diagnostics-runtime-v6";

export { runStartupAgentDiagnostics };

export function startupAgentDiagnosticsPlugin(): Plugin {
  return {
    name: "plotpickle-startup-agent-diagnostics",
    configureServer(server) {
      server.httpServer?.once("listening", () => {
        setTimeout(() => {
          void (async () => {
            try {
              await runStartupAgentInventory();
            } catch (error) {
              const message = error instanceof Error ? error.message : "unexpected diagnostic failure";
              console.error(`[STARTUP] Agent inventory failed unexpectedly: ${message}`);
              console.error("RUNTIME INVENTORY: NEEDS ATTENTION");
            }
          })();
        }, 750);
      });
    },
  };
}
