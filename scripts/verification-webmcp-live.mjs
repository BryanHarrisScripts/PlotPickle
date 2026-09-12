#!/usr/bin/env node
import { mkdir, open, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { verificationSyntheticRuntime } from "./full-verification-auth.mjs";
import { spawnCommand } from "./spawn-command.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactRoot = path.join(repoRoot, ".artifacts", "verification-live");
const summaryPath = path.join(artifactRoot, "webmcp-live.json");
const serverLogPath = path.join(artifactRoot, "webmcp-app-server.log");
const serverUrl = "http://127.0.0.1:4173";
const verificationPackages = Object.freeze([
  "@playwright/test@1.63.0",
  "@mcp-b/webmcp-polyfill@5.1.0",
]);

function commandName(name) {
  return process.platform === "win32" ? `${name}.cmd` : name;
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnCommand(command, args, {
      cwd: repoRoot,
      stdio: "inherit",
      windowsHide: false,
      ...options,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} failed${signal ? ` with signal ${signal}` : ` with exit code ${code}`}.`));
    });
  });
}

async function preparePinnedBrowserTools(toolRoot, npm, node) {
  await mkdir(toolRoot, { recursive: true });
  await writeFile(path.join(toolRoot, "package.json"), `${JSON.stringify({
    private: true,
    name: "plotpickle-architecture-webmcp-tools",
  }, null, 2)}\n`, "utf8");
  await runCommand(npm, [
    "install",
    "--prefix", toolRoot,
    "--no-save",
    "--package-lock=false",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    ...verificationPackages,
  ]);
  const playwrightCli = path.join(toolRoot, "node_modules", "playwright", "cli.js");
  const installArgs = [playwrightCli, "install"];
  if (process.platform === "linux" && process.env.CI) installArgs.push("--with-deps");
  installArgs.push("chromium");
  await runCommand(node, installArgs);
}

async function writeSummary(status, details = {}) {
  await mkdir(artifactRoot, { recursive: true });
  await writeFile(summaryPath, `${JSON.stringify({
    schemaVersion: "1.0",
    observer: "webmcp-live",
    status,
    server: serverUrl,
    authority: "read-only-observer",
    externalProviderCalls: false,
    secretsAccessed: false,
    verificationNetworkScope: ["repository-dependencies", "pinned-playwright-webmcp-tooling"],
    evidence: [
      ".artifacts/webmcp-startup/summary.json",
      ".artifacts/webmcp-startup/uat-findings.json",
      ".artifacts/visual-readiness/dashboard-canonical.png",
      ".artifacts/visual-readiness/visual-director-report.json",
    ],
    ...details,
  }, null, 2)}\n`, "utf8");
}

export async function runLiveWebMcpEvidence() {
  const tempRoot = path.resolve(process.env.RUNNER_TEMP || path.join(os.tmpdir(), "plotpickle-live-verification"));
  const jobRef = process.env.GITHUB_RUN_ID || process.env.GITHUB_RUN_NUMBER || `local-${process.pid}`;
  const runtime = verificationSyntheticRuntime(`architecture-webmcp-${jobRef}`);
  const home = runtime.home;
  const toolRoot = path.join(tempRoot, "plotpickle-webmcp-tools");
  const nodeRuntimeDir = path.join(home, "node", "runtime");
  const serverEnv = {
    ...process.env,
    ...runtime.runtimeEnv,
    PLOTPICKLE_STARTUP_TESTING_MODE: "webmcp",
    PLOTPICKLE_SHUTDOWN_SIGNAL: path.join(nodeRuntimeDir, "shutdown-request.json"),
    PLOTPICKLE_BROWSER_STATE: path.join(nodeRuntimeDir, "browser-owner.json"),
    PLOTPICKLE_BROWSER_PROFILE: path.join(nodeRuntimeDir, "browser-profile"),
  };
  const npm = commandName("npm");
  const node = process.execPath;
  let server = null;
  let serverLogHandle = null;

  await mkdir(artifactRoot, { recursive: true });
  try {
    await runCommand(npm, ["ci", "--include=dev", "--no-audit", "--no-fund"]);
    await preparePinnedBrowserTools(toolRoot, npm, node);
    await runCommand(node, ["scripts/run-webmcp-startup-uat.mjs", "prepare", "--home", home]);
    await mkdir(nodeRuntimeDir, { recursive: true });

    serverLogHandle = await open(serverLogPath, "w");
    server = spawnCommand(npm, ["run", "dev:local", "--", "--host", "127.0.0.1", "--port", "4173"], {
      cwd: repoRoot,
      env: serverEnv,
      stdio: ["ignore", serverLogHandle.fd, serverLogHandle.fd],
      windowsHide: true,
    });

    const serverExited = new Promise((_, reject) => {
      server.once("error", reject);
      server.once("exit", (code, signal) => {
        reject(new Error(`PlotPickle live verification server exited early${signal ? ` with signal ${signal}` : ` with exit code ${code}`}.`));
      });
    });
    const audit = runCommand(node, [
      "scripts/run-webmcp-startup-uat.mjs",
      "run",
      "--server", serverUrl,
      "--home", home,
      "--tool-root", toolRoot,
    ]);
    await Promise.race([audit, serverExited]);
    await writeSummary("pass", {
      syntheticHomeAuthority: "full-verification-auth",
      runtimeEnvironmentAuthority: "verificationSyntheticRuntime",
    });
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await writeSummary("fail", {
      failure: message,
      syntheticHomeAuthority: "full-verification-auth",
      runtimeEnvironmentAuthority: "verificationSyntheticRuntime",
    });
    console.error(`[FAIL] Live WebMCP verification: ${message}`);
    return 1;
  } finally {
    if (server && !server.killed) server.kill("SIGTERM");
    if (serverLogHandle) await serverLogHandle.close().catch(() => {});
    await runCommand(node, ["scripts/run-webmcp-startup-uat.mjs", "cleanup", "--home", home]).catch(() => {});
  }
}

const directExecution = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (directExecution) {
  runLiveWebMcpEvidence().then((code) => {
    process.exitCode = code;
  }).catch((error) => {
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  });
}
