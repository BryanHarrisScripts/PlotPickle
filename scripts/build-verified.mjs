#!/usr/bin/env node

import { access, mkdir, readFile } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { spawnCommand } from "./spawn-command.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const runtimeSetting = process.env.SITES_RUNTIME_ROOT;
const RUNTIME_ROOT = runtimeSetting
  ? (isAbsolute(runtimeSetting) ? runtimeSetting : resolve(ROOT, runtimeSetting))
  : join(ROOT, ".sites-runtime");

function run(command, args, env) {
  return new Promise((resolvePromise, reject) => {
    const child = spawnCommand(command, args, {
      cwd: ROOT,
      env,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`${command} ${args.join(" ")} failed with ${signal ?? `exit ${code}`}`));
    });
  });
}

async function prepareEnvironment() {
  const directories = {
    home: join(RUNTIME_ROOT, "home"),
    cache: join(RUNTIME_ROOT, "npm-cache"),
    config: join(RUNTIME_ROOT, "xdg-config"),
    temp: join(RUNTIME_ROOT, "tmp"),
    wranglerLogs: join(RUNTIME_ROOT, "wrangler", "logs"),
    miniflare: join(RUNTIME_ROOT, "wrangler", "registry"),
  };

  await Promise.all(Object.values(directories).map((directory) => mkdir(directory, { recursive: true })));

  const env = { ...process.env };
  for (const name of [
    "NPM_CONFIG_CACHE",
    "npm_config_cache",
    "NPM_CONFIG_PROXY",
    "npm_config_proxy",
    "NPM_CONFIG_HTTP_PROXY",
    "npm_config_http_proxy",
    "NPM_CONFIG_HTTPS_PROXY",
    "npm_config_https_proxy",
  ]) {
    delete env[name];
  }

  Object.assign(env, {
    SITES_ENV_READY: "1",
    SITES_PROJECT_ROOT: ROOT,
    HOME: directories.home,
    XDG_CONFIG_HOME: directories.config,
    TMPDIR: directories.temp,
    TEMP: directories.temp,
    TMP: directories.temp,
    WRANGLER_WRITE_LOGS: "false",
    WRANGLER_LOG_PATH: directories.wranglerLogs,
    MINIFLARE_REGISTRY_PATH: directories.miniflare,
    VITE_CONFIG_NATIVE_IGNORE_WARNING: "true",
    npm_config_cache: directories.cache,
    npm_config_audit: "false",
    npm_config_fund: "false",
    npm_config_update_notifier: "false",
  });

  return env;
}

async function validateArtifact(env) {
  const workerPath = join(ROOT, "dist", "server", "index.js");
  const hostingPath = join(ROOT, "dist", ".openai", "hosting.json");

  try {
    await access(workerPath);
  } catch {
    console.log("PLOTPICKLE_BUILD_ARTIFACT_STAGE=missing-worker-entry");
    throw new Error("Missing Sites Worker entry: dist/server/index.js");
  }

  let hosting;
  try {
    hosting = JSON.parse(await readFile(hostingPath, "utf8"));
  } catch (error) {
    console.log("PLOTPICKLE_BUILD_ARTIFACT_STAGE=missing-or-invalid-hosting-manifest");
    throw new Error(`Missing or invalid packaged Sites manifest: dist/.openai/hosting.json (${error.message})`);
  }
  void hosting;

  await run(process.execPath, ["--check", workerPath], env);
  const workerSource = await readFile(workerPath, "utf8");
  const hasDefaultExport = /export\s+default\b/u.test(workerSource)
    || /export\s*\{[\s\S]*?\bas\s+default\b/u.test(workerSource);
  const hasFetchShape = /\bfetch\s*(?:[:(])/u.test(workerSource);
  if (!hasDefaultExport || !hasFetchShape) {
    console.log("PLOTPICKLE_BUILD_ARTIFACT_STAGE=invalid-worker-export");
    throw new Error("dist/server/index.js must contain a valid default Worker export with fetch.");
  }

  if (process.platform !== "win32") {
    // A Worker may import cloudflare: intrinsics, which Node cannot execute.
    // Validate its entire JavaScript graph offline without running module
    // initializers or making requests. Windows retains its supported check.
    const { build } = await import("esbuild");
    await build({ entryPoints: [workerPath], bundle: true, platform: "neutral",
      format: "esm", packages: "external", external: ["cloudflare:*", "node:*"],
      loader: { ".wasm": "binary" }, write: false, logLevel: "silent" });
  }

  console.log("Validated Sites artifact: Worker default/fetch shape and hosting manifest are present.");
}

async function main() {
  const env = await prepareEnvironment();
  const vinext = join(ROOT, "node_modules", ".bin", process.platform === "win32" ? "vinext.cmd" : "vinext");
  const runner = join(ROOT, "scripts", "run-command-with-timeout.mjs");

  try {
    await access(vinext);
  } catch {
    throw new Error("vinext is unavailable. Run npm ci and wait for it to finish before building.");
  }

  try {
    await access(runner);
  } catch {
    throw new Error("The cross-platform build timeout runner is unavailable.");
  }

  await run(process.execPath, [join(ROOT, "scripts", "write-public-source-provenance.mjs")], env);
  console.log(`Running bounded vinext build on ${process.platform}...`);
  await run(
    process.execPath,
    [
      runner,
      env.SITES_BUILD_TIMEOUT ?? "3m",
      env.SITES_BUILD_KILL_AFTER ?? "10s",
      "--",
      vinext,
      "build",
    ],
    env,
  );
  await validateArtifact(env);
}

main().catch(() => {
  console.error("Verified build failed. Review the preceding build output for the failing step.");
  process.exitCode = 1;
});
