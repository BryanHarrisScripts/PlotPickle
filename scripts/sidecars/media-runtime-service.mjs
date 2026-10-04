import { FFramesLocalMediaEngine } from "../../core/media/fframes-local-media-engine.ts";
import { startContractService } from "./service-process.mjs";

await startContractService("media-runtime", async () => {
  const capability = await new FFramesLocalMediaEngine().capabilities();
  return { state: capability.state === "ready" ? "ready" : "degraded", evidence: [{ kind: "optional-engine-probe", summary: `Optional renderer is not ready: ${capability.reason} Core PlotPickle, Flip Book, Graphic Novel and WebP remain available. No renderer is installed or invoked at startup.`, observedAt: new Date().toISOString() }] };
});
