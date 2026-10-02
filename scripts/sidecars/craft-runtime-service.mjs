import { LIVE_CRAFT_CAPABILITIES, liveCraftRoute } from "../../core/learning/live-craft-runtime.ts";
import { startContractService } from "./service-process.mjs";

await startContractService("craft-runtime", async () => {
  if (liveCraftRoute("learn", ["theme"]).primary?.id !== "craft-theme") throw new Error("Craft routing contract unavailable.");
  return { state: "ready", evidence: [{ kind: "capabilities-loaded", summary: `${LIVE_CRAFT_CAPABILITIES.length} host-owned craft capabilities registered; curriculum and Human acceptance remain authoritative.`, observedAt: new Date().toISOString() }] };
});
