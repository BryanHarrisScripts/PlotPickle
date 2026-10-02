import { FFramesLocalMediaEngine } from "./fframes-local-media-engine";
import type { PlotPickleMediaEngine, PlotPickleMediaEngineCapability } from "./media-engine-contract";

export type LiveMediaRuntimeStatus = Readonly<{
  state: "ready" | "degraded";
  primaryEngine: string;
  capability: PlotPickleMediaEngineCapability;
  fallbackModes: readonly ["flip-book", "graphic-novel", "webp"];
  automaticInstall: false;
  cloudFallback: false;
}>;

export function liveMediaEngine(repositoryRoot = process.cwd()): PlotPickleMediaEngine {
  return new FFramesLocalMediaEngine(repositoryRoot);
}

export async function probeLiveMediaRuntime(repositoryRoot = process.cwd()): Promise<LiveMediaRuntimeStatus> {
  const engine = liveMediaEngine(repositoryRoot);
  const capability = await engine.capabilities();
  return Object.freeze({
    state: capability.state === "ready" ? "ready" : "degraded",
    primaryEngine: engine.id,
    capability,
    fallbackModes: Object.freeze(["flip-book", "graphic-novel", "webp"]),
    automaticInstall: false,
    cloudFallback: false,
  });
}
