import type { EnvironmentOptions, Plugin } from "vite";

export const VINEXT_PACKAGE = "vinext";
export const VINEXT_LINK_SHIM = "vinext/shims/link";
export const VINEXT_PREFETCH_QUEUE_SHIM = "vinext/dist/shims/internal/app-prefetch-fetch-queue.js";
export const VINEXT_OPTIONAL_RSC_STATIC_ENTRY = "react-server-dom-webpack/static.edge";

const TARGET_OPTIMIZER_ENVIRONMENTS = new Set(["client", "rsc", "ssr"]);
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

function reconcileEnvironmentOptimizeDeps(name: string, config: EnvironmentOptions) {
  const optimizeDeps = (config.optimizeDeps ??= {});
  const existingExclude = optimizeDeps.exclude ?? [];
  optimizeDeps.exclude = [
    ...new Set([
      ...existingExclude,
      VINEXT_PACKAGE,
      VINEXT_LINK_SHIM,
      VINEXT_PREFETCH_QUEUE_SHIM,
    ]),
  ];

  // @vitejs/plugin-rsc records optimizer metadata from the client environment,
  // then warns when a "use client" module reached through a server-imported
  // package is also present in that client optimizer bundle. Vinext aliases
  // next/link to vinext/shims/link, so excluding only the package and its final
  // internal queue file can still let the aliased client shim be prebundled.
  // Current Vinext upstream explicitly excludes this public shim for the same
  // plugin-rsc metadata contract; backport that narrow compatibility rule here.

  // vinext 0.2.1 treats react-server-dom-webpack as an optional peer, while
  // @vitejs/plugin-rsc 0.5.34 can use its vendored RSC runtime when that peer is
  // absent. vinext still inserts static.edge into the RSC optimizer include list,
  // which makes Vite print a failed-resolution warning on every fresh optimizer
  // pass. Remove only that optional prebundle entry; plugin-rsc continues to own
  // its vendored runtime and genuine dependency-resolution errors remain visible.
  if (name === "rsc" && optimizeDeps.include?.includes(VINEXT_OPTIONAL_RSC_STATIC_ENTRY)) {
    optimizeDeps.include = optimizeDeps.include.filter(
      (entry) => entry !== VINEXT_OPTIONAL_RSC_STATIC_ENTRY,
    );
  }
}

export function vinextRscOptimizationCompatibilityPlugin(): Plugin {
  return {
    name: "plotpickle:vinext-rsc-optimization-compatibility",
    enforce: "post",
    configEnvironment(name, config) {
      if (!TARGET_OPTIMIZER_ENVIRONMENTS.has(name)) return;
      reconcileEnvironmentOptimizeDeps(name, config);
    },
  };
}
