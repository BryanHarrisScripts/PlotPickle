import type { EnvironmentOptions, Plugin } from "vite";

export const VINEXT_PREFETCH_QUEUE_SHIM = "vinext/dist/shims/internal/app-prefetch-fetch-queue.js";

const TARGET_SERVER_ENVIRONMENTS = new Set(["rsc", "ssr"]);
const REQUEST_TIMING_GUARD = Symbol.for("plotpickle.vinextRequestTimingGuard");
const MAX_CROSS_RUNTIME_CLOCK_DRIFT_MS = 60_000;

function durationMs(value: string, unit: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return null;
  return unit === "s" ? amount * 1000 : amount;
}

export function sanitizeVinextRequestTimingOutput(text: string) {
  const totalMatch = text.match(/\bin\s+(\d+(?:\.\d+)?)(ms|s)\b/);
  const compileMatch = text.match(/compile:\s+(\d+(?:\.\d+)?)(ms|s)\b/);
  if (!totalMatch || !compileMatch) return text;

  const totalMs = durationMs(totalMatch[1], totalMatch[2]);
  const compileMs = durationMs(compileMatch[1], compileMatch[2]);
  if (totalMs === null || compileMs === null) return text;

  // vinext currently combines a Node performance.now() request timestamp with a
  // Cloudflare/workerd RSC timestamp that may use a different clock origin. When
  // those origins differ, the resulting "compile" value can be decades larger
  // than the whole request. Keep credible timings untouched and remove only the
  // impossible compile fragment so total and render timings remain useful.
  if (compileMs <= totalMs + MAX_CROSS_RUNTIME_CLOCK_DRIFT_MS) return text;

  return text.replace(/compile:\s+\d+(?:\.\d+)?(?:ms|s),\s*/i, "");
}

export function installVinextRequestTimingOutputGuard() {
  const output = process.stdout as typeof process.stdout & { [key: symbol]: boolean | undefined };
  if (output[REQUEST_TIMING_GUARD]) return;
  output[REQUEST_TIMING_GUARD] = true;

  const originalWrite = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((chunk: string | Uint8Array, ...args: unknown[]) => {
    const nextChunk = typeof chunk === "string" ? sanitizeVinextRequestTimingOutput(chunk) : chunk;
    return Reflect.apply(originalWrite, process.stdout, [nextChunk, ...args]);
  }) as typeof process.stdout.write;
}

function environmentOptimizeDeps(config: EnvironmentOptions) {
  const existing = config.optimizeDeps?.exclude ?? [];
  return {
    optimizeDeps: {
      ...config.optimizeDeps,
      exclude: [...new Set([...existing, VINEXT_PREFETCH_QUEUE_SHIM])],
    },
  } satisfies EnvironmentOptions;
}

export function vinextRscOptimizationCompatibilityPlugin(): Plugin {
  return {
    name: "plotpickle:vinext-rsc-optimization-compatibility",
    enforce: "post",
    configEnvironment(name, config) {
      if (!TARGET_SERVER_ENVIRONMENTS.has(name)) return;
      return environmentOptimizeDeps(config);
    },
  };
}
