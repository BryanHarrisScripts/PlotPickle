import path from "node:path";
import os from "node:os";
import type { Plugin } from "vite";

function clock() {
  return new Date().toTimeString().slice(0, 8);
}

export function uatDiscoveryPlugin(): Plugin {
  return {
    name: "plotpickle-uat-discovery",
    configureServer(server) {
      server.httpServer?.once("listening", () => {
        setTimeout(() => {
          const localRoot = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
          const reportRoot = path.join(localRoot, "PlotPickle", "uat-focused");
          console.log(`[${clock()}] Focused UAT runner ................. READY  node scripts/run-uat-closed-loop.mjs --github-report`);
          console.log(`[${clock()}] Focused UAT evidence ............... READY  ${reportRoot}`);
          console.log(`[${clock()}] Startup blocker reporting .......... ACTIVE  hard startup findings -> same UAT evidence + GitHub reporter`);
          console.log(`[${clock()}] UAT repair handoff ................. READY  blocker -> GitHub issue -> draft repair PR`);
        }, 1_250);
      });
    },
  };
}
