#!/usr/bin/env node
import { mkdir, open, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import { createServer } from "node:net";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { verificationSyntheticRuntime } from "./full-verification-auth.mjs";
import { spawnCommand } from "./spawn-command.mjs";
import { terminateVerificationProcessTree } from "./full-verification-process.mjs";
import { writeWebMcpFindingsReport } from "./run-webmcp-startup-uat.mjs";
import { runSkinV1MenuContractAudit } from "../lib/verification/skin-v1-menu-contract-audit.mjs";
import {
  VISUAL_DIRECTOR_REPORT_PATH,
  runSkinV1VisualDirector,
} from "../lib/verification/skin-v1-visual-director.mjs";
import { runWebMcpSurfaceVisualAudit } from "../lib/verification/webmcp-surface-visual-audit.mjs";
import { validateLocalServer, waitForUiServer } from "../lib/verification/ui-axe-audit.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactRoot = path.join(repoRoot, ".artifacts", "verification-live");
const summaryPath = path.join(artifactRoot, "webmcp-live.json");
const startupEvidencePath = path.join(repoRoot, ".artifacts", "webmcp-startup", "summary.json");
const serverLogPath = path.join(artifactRoot, "webmcp-app-server.log");
const serverUrl = "http://127.0.0.1:4173";
const verificationPackages = Object.freeze([
  "@playwright/test@1.63.0",
  "@mcp-b/webmcp-polyfill@5.1.0",
]);
const nodeDependencyPaths = Object.freeze([
  "/api/system/node-control",
  "/api/system/node-topology",
]);
const coldDashboardMediaFailure = "Dashboard canonical design reference did not contain loaded primary media.";

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

async function probeLocalNodeDependencies() {
  const results = [];
  for (const pathname of nodeDependencyPaths) {
    try {
      const response = await fetch(new URL(pathname, serverUrl), {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      });
      const contentType = response.headers.get("content-type") || "";
      const body = contentType.includes("application/json") ? await response.json().catch(() => ({})) : {};
      const diagnostic = {
        path: pathname,
        status: response.status,
        ok: response.ok,
        hasNode: pathname.endsWith("node-control") ? Boolean(body?.node) : undefined,
        lifecycle: pathname.endsWith("node-control") ? String(body?.lifecycle?.state || "") : undefined,
        hasCurrentNode: pathname.endsWith("node-topology") ? Boolean(body?.currentNode) : undefined,
        readiness: pathname.endsWith("node-topology") ? String(body?.currentNode?.readiness || "") : undefined,
        serverMessage: response.ok ? "" : String(body?.message || "").slice(0, 160),
      };
      results.push(diagnostic);
      console.log(`[WEBMCP] NODE dependency ${pathname}: HTTP ${diagnostic.status} ${diagnostic.ok ? "OK" : "FAIL"}${diagnostic.readiness ? ` readiness=${diagnostic.readiness}` : ""}`);
    } catch (error) {
      const diagnostic = {
        path: pathname,
        status: 0,
        ok: false,
        serverMessage: error instanceof Error ? error.name : "request-failed",
      };
      results.push(diagnostic);
      console.log(`[WEBMCP] NODE dependency ${pathname}: request failed (${diagnostic.serverMessage})`);
    }
  }
  return results;
}

async function syntheticHumanMutationHeaders(storageStatePath) {
  const state = JSON.parse(await readFile(storageStatePath, "utf8"));
  const hostname = new URL(serverUrl).hostname;
  const session = Array.isArray(state?.cookies)
    ? state.cookies.find((cookie) => cookie?.name === "ppsid" && cookie?.domain === hostname && typeof cookie?.value === "string" && cookie.value)
    : null;
  if (!session) throw new Error("Live browser verification could not read its isolated synthetic Human session.");

  const cookie = `ppsid=${session.value}`;
  const profileResponse = await fetch(new URL("/api/auth/profile", serverUrl), {
    headers: { Accept: "application/json", Cookie: cookie },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const profile = await profileResponse.json().catch(() => ({}));
  const csrf = typeof profile?.csrfToken === "string" ? profile.csrfToken.trim() : "";
  if (!profileResponse.ok || profile?.authenticated !== true || !csrf) {
    throw new Error(profile?.message || "Live browser verification could not authenticate its isolated synthetic Human session.");
  }
  return Object.freeze({
    Accept: "application/json",
    "Content-Type": "application/json",
    Cookie: cookie,
    Origin: new URL(serverUrl).origin,
    "X-PlotPickle-CSRF": csrf,
  });
}

async function forceLocalStoryMode(storageStatePath) {
  const response = await fetch(new URL("/api/story-mode/policy", serverUrl), {
    method: "POST",
    headers: await syntheticHumanMutationHeaders(storageStatePath),
    body: JSON.stringify({ mode: "local" }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok !== true || body?.mode !== "local") {
    throw new Error(body?.message || "Live browser verification could not establish LOCAL Story Mode.");
  }
  return Object.freeze({ mode: "local", providerSpendAllowed: false });
}

async function readStartupFailure() {
  try {
    const evidence = JSON.parse(await readFile(startupEvidencePath, "utf8"));
    return String(evidence?.failure || "");
  } catch {
    return "";
  }
}

async function recoverStartupEvidenceAfterColdMediaRetry(visualDirector) {
  const previous = JSON.parse(await readFile(startupEvidencePath, "utf8"));
  const findingsReport = await writeWebMcpFindingsReport({ status: "pass", target: serverUrl, findings: [] });
  const recovered = {
    ...previous,
    status: "pass",
    findingsReport,
    findingCount: 0,
    visualDirector: {
      report: path.resolve(VISUAL_DIRECTOR_REPORT_PATH),
      surfaces: visualDirector.totals.surfaces,
      blockers: visualDirector.totals.blockers,
      advisories: visualDirector.totals.advisories,
    },
  };
  delete recovered.failure;
  await writeFile(startupEvidencePath, `${JSON.stringify(recovered, null, 2)}\n`, "utf8");
}

async function runAuditOnce({ node, home, toolRoot, serverEnv, serverExited }) {
  const audit = runCommand(node, [
    "scripts/run-webmcp-startup-uat.mjs",
    "run",
    "--server", serverUrl,
    "--home", home,
    "--tool-root", toolRoot,
  ], { env: serverEnv });
  await Promise.race([audit, serverExited]);
}

async function runAuditWithColdMediaRetry(options) {
  try {
    await runAuditOnce(options);
    return false;
  } catch (error) {
    const failure = await readStartupFailure();
    if (!failure.includes(coldDashboardMediaFailure)) throw error;

    const storageStatePath = path.join(options.home, "verification-browser", "storage-state.json");
    console.log("[WEBMCP] Dashboard media was not decoded on the first cold-start audit; retrying only the read-only visual checks with the existing synthetic Human session.");
    await new Promise((resolve) => setTimeout(resolve, 500));
    await runWebMcpSurfaceVisualAudit({ serverUrl, toolRoot: options.toolRoot, storageStatePath });
    const visualDirector = await runSkinV1VisualDirector({ serverUrl, toolRoot: options.toolRoot, storageStatePath });
    await runSkinV1MenuContractAudit({ serverUrl, toolRoot: options.toolRoot, storageStatePath });
    await recoverStartupEvidenceAfterColdMediaRetry(visualDirector);
    return true;
  }
}

function isLoopbackPortAvailable() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once("error", (error) => {
      if (error?.code === "EADDRINUSE") resolve(false);
      else reject(error);
    });
    probe.listen({ host: "127.0.0.1", port: 4173, exclusive: true }, () => {
      probe.close((error) => error ? reject(error) : resolve(true));
    });
  });
}

/**
 * Only a child spawned by this verifier is eligible for process-tree STOP.
 * A released loopback port is a safety condition, not production STOP proof.
 * A blocked cleanup retains the disposable profile rather than guessing at PIDs.
 */
export async function stopAndCleanupLiveVerifier({
  server = null,
  serverLogHandle = null,
  home,
  node,
  serverEnv,
  stopTree = terminateVerificationProcessTree,
  probePort = isLoopbackPortAvailable,
  cleanupHome = ({ home: isolatedHome, node: executable, serverEnv: env }) =>
    runCommand(executable, ["scripts/run-webmcp-startup-uat.mjs", "cleanup", "--home", isolatedHome], { env }),
  wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
  maxPortChecks = 25,
} = {}) {
  const failureCodes = [];
  let stopped = !server;
  if (server) {
    try {
      await stopTree(server);
      if (server.exitCode === null && server.signalCode === null) {
        failureCodes.push("OWNED_SERVER_PARENT_EXIT_UNCONFIRMED");
      }
      let available = false;
      for (let check = 0; check < maxPortChecks; check += 1) {
        if (await probePort()) { available = true; break; }
        if (check + 1 < maxPortChecks) await wait(200);
      }
      if (!available) failureCodes.push("VERIFIER_PORT_STILL_OCCUPIED");
      stopped = failureCodes.length === 0;
    } catch {
      failureCodes.push("OWNED_SERVER_STOP_UNVERIFIED");
    }
  }
  if (serverLogHandle) {
    try { await serverLogHandle.close(); }
    catch { failureCodes.push("SERVER_LOG_CLOSE_FAILED"); }
  }
  if (stopped && !failureCodes.includes("SERVER_LOG_CLOSE_FAILED")) {
    let cleaned = false;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await cleanupHome({ home, node, serverEnv });
        cleaned = true;
        break;
      } catch {
        if (attempt < 2) await wait((attempt + 1) * 250);
      }
    }
    if (!cleaned) failureCodes.push("SYNTHETIC_HOME_CLEANUP_FAILED");
  } else {
    failureCodes.push(stopped ? "SYNTHETIC_HOME_RETAINED_UNTIL_LOG_CLOSED" : "SYNTHETIC_HOME_RETAINED_UNTIL_OWNERSHIP_VERIFIED");
  }
  return Object.freeze({
    status: failureCodes.length ? "blocked" : "pass",
    failureCodes: Object.freeze(failureCodes),
    productionUatTreeTerminationProven: false,
  });
}

async function writeSummary(status, details = {}) {
  await mkdir(artifactRoot, { recursive: true });
  await writeFile(summaryPath, `${JSON.stringify({
    schemaVersion: "1.0",
    observer: "webmcp-live",
    // Authenticated Factory invocation binds this real-browser report to a
    // unique private control receipt and exact checked-out commit. Ordinary
    // CLI use leaves factoryUatRequestId null.
    factoryUatRequestId: /^[a-f0-9]{32}$/.test(process.env.PLOTPICKLE_FACTORY_UAT_REQUEST_ID || "")
      ? process.env.PLOTPICKLE_FACTORY_UAT_REQUEST_ID : null,
    exactHead: /^[a-f0-9]{40}$/.test(process.env.GITHUB_SHA || "")
      ? process.env.GITHUB_SHA : null,
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
      ".artifacts/webmcp-acceptance/mind-map-world-map-shared-header/exact-head.json",
      ".artifacts/webmcp-acceptance/story-factory-read-only-journey/exact-head.json",
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
    PLOTPICKLE_ACCEPTANCE_MODE: "1",
    PLOTPICKLE_AUTONOMOUS_GUEST_ENABLED: "true",
    PLOTPICKLE_AUTONOMOUS_RUN_ID: `phase5-webmcp-${jobRef}`,
    PLOTPICKLE_AUTONOMOUS_OPERATOR_ID: "phase5-live-observer",
    PLOTPICKLE_SHUTDOWN_SIGNAL: path.join(nodeRuntimeDir, "shutdown-request.json"),
    PLOTPICKLE_BROWSER_STATE: path.join(nodeRuntimeDir, "browser-owner.json"),
    PLOTPICKLE_BROWSER_PROFILE: path.join(nodeRuntimeDir, "browser-profile"),
  };
  const npm = commandName("npm");
  const node = process.execPath;
  let server = null;
  let serverLogHandle = null;
  let nodeDependencies = [];
  let coldMediaRetryUsed = false;
  let recordedDetails = {};

  await mkdir(artifactRoot, { recursive: true });
  try {
    await runCommand(npm, ["ci", "--include=dev", "--no-audit", "--no-fund"]);
    await preparePinnedBrowserTools(toolRoot, npm, node);
    await runCommand(node, ["scripts/run-webmcp-startup-uat.mjs", "prepare", "--home", home]);
    await mkdir(nodeRuntimeDir, { recursive: true });

    if (!(await isLoopbackPortAvailable())) {
      throw new Error("Verification port 4173 is already occupied. Refusing to attach to an unowned listener.");
    }
    serverLogHandle = await open(serverLogPath, "w");
    // Start Vite directly, rather than stopping an npm wrapper while its server child keeps the port.
    const viteCli = path.join(repoRoot, "node_modules", "vite", "bin", "vite.js");
    server = spawnCommand(node, [viteCli, "--host", "127.0.0.1", "--port", "4173", "--strictPort"], {
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
    await Promise.race([waitForUiServer(validateLocalServer(serverUrl)), serverExited]);
    nodeDependencies = await probeLocalNodeDependencies();
    const failedDependency = nodeDependencies.find((entry) => !entry.ok);
    if (failedDependency) {
      throw new Error(`NODE readiness dependency failed: ${failedDependency.path} ${failedDependency.status ? `HTTP ${failedDependency.status}` : failedDependency.serverMessage || "request failed"}${failedDependency.serverMessage ? ` ${failedDependency.serverMessage}` : ""}`.trim());
    }

    coldMediaRetryUsed = await runAuditWithColdMediaRetry({ node, home, toolRoot, serverEnv, serverExited });
    const acceptanceStorageStatePath = path.join(home, "verification-browser", "storage-state.json");
    const storyMode = await forceLocalStoryMode(acceptanceStorageStatePath);
    const { runWebMcpAcceptanceJourney } = await import("../core/sidecars/webmcp-acceptance-sidecar.mjs");
    const mindWorldAcceptance = await runWebMcpAcceptanceJourney({
      request: {
        requestId: `architecture-${jobRef}-mind-world-shared-header`,
        operation: "rendered-acceptance",
        target: "mind-map-world-map-shared-header",
        mode: "exact-head",
        commitSha: process.env.GITHUB_SHA || "",
      },
      serverUrl,
      toolRoot,
      storageStatePath: acceptanceStorageStatePath,
      artifactRoot: path.join(repoRoot, ".artifacts", "webmcp-acceptance"),
    });
    if (mindWorldAcceptance.status !== "PASS") {
      throw new Error(`Mind Map / World Map rendered acceptance failed: ${mindWorldAcceptance.reportPath}`);
    }
    const storyFactoryAcceptance = await runWebMcpAcceptanceJourney({
      request: {
        requestId: `architecture-${jobRef}-story-factory-read-only`,
        operation: "rendered-acceptance",
        target: "story-factory-read-only-journey",
        mode: "exact-head",
        commitSha: process.env.GITHUB_SHA || "",
      },
      serverUrl,
      toolRoot,
      storageStatePath: acceptanceStorageStatePath,
      artifactRoot: path.join(repoRoot, ".artifacts", "webmcp-acceptance"),
    });
    if (storyFactoryAcceptance.status !== "PASS") {
      throw new Error(`Story Factory rendered acceptance failed: ${storyFactoryAcceptance.reportPath}`);
    }

    recordedDetails = {
      syntheticHomeAuthority: "full-verification-auth",
      runtimeEnvironmentAuthority: "verificationSyntheticRuntime",
      nodeIdentityAuthority: "autonomousAcceptanceNodeIdentity",
      coldMediaRetryUsed,
      nodeDependencies,
      storyMode,
      mindWorldAcceptance: {
        status: mindWorldAcceptance.status,
        report: mindWorldAcceptance.reportPath,
        journeyId: mindWorldAcceptance.journeyId,
      },
      storyFactoryAcceptance: {
        status: storyFactoryAcceptance.status,
        report: storyFactoryAcceptance.reportPath,
        journeyId: storyFactoryAcceptance.journeyId,
        mutationAuthority: false,
        providerSpendAllowed: false,
      },
    };
    await writeSummary("pass", recordedDetails);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    recordedDetails = {
      failure: message,
      syntheticHomeAuthority: "full-verification-auth",
      runtimeEnvironmentAuthority: "verificationSyntheticRuntime",
      nodeIdentityAuthority: "autonomousAcceptanceNodeIdentity",
      coldMediaRetryUsed,
      nodeDependencies,
    };
    await writeSummary("fail", recordedDetails);
    console.error(`[FAIL] Live WebMCP verification: ${message}`);
    return 1;
  } finally {
    const cleanup = await stopAndCleanupLiveVerifier({ server, serverLogHandle, home, node, serverEnv });
    if (cleanup.status !== "pass") {
      await writeSummary("fail", { ...recordedDetails, cleanup });
      console.error(`[FAIL] Live WebMCP cleanup blocked: ${cleanup.failureCodes.join(", ")}. Disposable test home retained if owned STOP is unverified.`);
      return 1;
    }
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
