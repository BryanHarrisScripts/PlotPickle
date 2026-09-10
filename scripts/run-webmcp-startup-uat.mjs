#!/usr/bin/env node

import { createRequire } from "node:module";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  cleanupVerificationSyntheticHome,
  establishVerificationSyntheticHuman,
  prepareVerificationSyntheticHome,
} from "./full-verification-auth.mjs";
import { spawnCommand } from "./spawn-command.mjs";
import {
  DASHBOARD_SCREENSHOT_PATH,
  WEBMCP_ALLOWED_TARGETS,
  runWebMcpSurfaceVisualAudit,
} from "../lib/verification/webmcp-surface-visual-audit.mjs";
import {
  buildWebMcpRuntimeFinding,
  findingsFromWebMcpError,
} from "../lib/verification/webmcp-uat-findings.mjs";
import {
  WEBMCP_UAT_SKILLS,
  WEBMCP_UAT_SKILL_POLICY,
} from "../lib/verification/webmcp-uat-skills.mjs";
import { validateLocalServer, waitForUiServer } from "../lib/verification/ui-axe-audit.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const WEBMCP_STARTUP_PACKAGES = Object.freeze([
  "@playwright/test@1.63.0",
  "@mcp-b/webmcp-polyfill@5.1.0",
]);
export const WEBMCP_STARTUP_EVIDENCE = ".artifacts/webmcp-startup/summary.json";
export const WEBMCP_UAT_FINDINGS = ".artifacts/webmcp-startup/uat-findings.json";
export const WEBMCP_SURFACE_LABELS = Object.freeze({
  dashboard: "Dashboard",
  community: "Community",
  settings: "Settings",
  "cloud-story-mode": "Cloud Story Mode",
  agents: "PlotPickle Agents",
  profile: "Profile",
  "local-ai": "Local Story Mode",
  node: "Node",
});

function argument(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

export function commandName(name) {
  return process.platform === "win32" ? `${name}.cmd` : name;
}

export function formatPassTag({ color = Boolean(process.stdout.isTTY && process.env.NO_COLOR === undefined && process.env.TERM !== "dumb") } = {}) {
  return color ? "\u001b[32m[PASS]\u001b[0m" : "[PASS]";
}

export function visualBaselineApprovalLines(targets = WEBMCP_ALLOWED_TARGETS) {
  const lines = [`Captured ${targets.length} surfaces:`];
  targets.forEach((surface, index) => {
    const label = WEBMCP_SURFACE_LABELS[surface] || surface;
    lines.push(`[${index + 1}] ${surface} (${label})`);
    lines.push(`    node scripts/lock-skin-visual-baseline.mjs ${surface}`);
  });
  lines.push("");
  lines.push('Note: none of the screenshots are automatically declared "locked."');
  lines.push("That prevents PlotPickle from blessing its own regressions.");
  lines.push("After you run WebMCP locally and visually approve a surface, run the matching command above.");
  lines.push("Dashboard example: node scripts/lock-skin-visual-baseline.mjs dashboard");
  lines.push("That copies the approved PNG into tests/visual-baselines/skin-v1/dashboard.png and marks Dashboard locked.");
  lines.push("Commit that PNG and tests/visual-baselines/skin-v1/manifest.json. From then on Dashboard is a permanent repo baseline.");
  return lines;
}

export function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnCommand(command, args, { stdio: "inherit", windowsHide: false, ...options });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) return resolve();
      reject(new Error(`${command} ${args.join(" ")} failed${signal ? ` with signal ${signal}` : ` with exit code ${code}`}.`));
    });
  });
}

function runExistingScript(relativePath, scriptArgs = []) {
  return runCommand(process.execPath, [path.join(repoRoot, relativePath), ...scriptArgs], { cwd: repoRoot });
}

async function installedVersion(toolRoot, packageName) {
  try {
    const packageJson = JSON.parse(await readFile(path.join(toolRoot, "node_modules", ...packageName.split("/"), "package.json"), "utf8"));
    return String(packageJson.version || "");
  } catch {
    return "";
  }
}

async function ensureVerificationTools(toolRoot) {
  if (!toolRoot || !path.isAbsolute(toolRoot)) throw new Error("WebMCP startup testing requires an absolute isolated tool root.");
  await mkdir(toolRoot, { recursive: true });
  const packageFile = path.join(toolRoot, "package.json");
  await writeFile(packageFile, `${JSON.stringify({ private: true, name: "plotpickle-webmcp-startup-tools" }, null, 2)}\n`, "utf8");

  const playwrightVersion = await installedVersion(toolRoot, "@playwright/test");
  const webmcpVersion = await installedVersion(toolRoot, "@mcp-b/webmcp-polyfill");
  if (playwrightVersion !== "1.63.0" || webmcpVersion !== "5.1.0") {
    console.log("[WEBMCP] Preparing isolated verification tooling. This is separate from the PlotPickle runtime.");
    await runCommand(commandName("npm"), [
      "install",
      "--prefix", toolRoot,
      "--no-save",
      "--package-lock=false",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      ...WEBMCP_STARTUP_PACKAGES,
    ]);
  }

  const toolRequire = createRequire(packageFile);
  const { chromium } = toolRequire("@playwright/test");
  let browserReady = true;
  try {
    await access(chromium.executablePath());
  } catch {
    browserReady = false;
  }
  if (!browserReady) {
    console.log("[WEBMCP] Installing the isolated Chromium test browser. This is a one-time verification download.");
    const playwrightCli = path.join(toolRoot, "node_modules", "playwright", "cli.js");
    await access(playwrightCli);
    await runCommand(process.execPath, [playwrightCli, "install", "chromium"]);
  }

  return toolRoot;
}

async function writeEvidence(status, details = {}) {
  const target = path.resolve(WEBMCP_STARTUP_EVIDENCE);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify({
    format: "plotpickle-webmcp-startup-uat",
    version: 1,
    status,
    mode: "webmcp-testing",
    canonicalScreenshot: DASHBOARD_SCREENSHOT_PATH,
    skills: WEBMCP_UAT_SKILLS.map(({ name, purpose }) => ({ name, purpose })),
    policy: WEBMCP_UAT_SKILL_POLICY,
    ...details,
  }, null, 2)}\n`, "utf8");
  return target;
}

export async function writeWebMcpFindingsReport({ status, target, findings = [] }) {
  const reportPath = path.resolve(WEBMCP_UAT_FINDINGS);
  await mkdir(path.dirname(reportPath), { recursive: true });
  const report = {
    schemaVersion: 2,
    generatedAt: new Date().toISOString(),
    target,
    overall: status === "pass" ? "PASS" : "FAIL",
    runs: {
      webmcpSurfaceVisual: {
        code: status === "pass" ? 0 : 1,
        source: "lib/verification/webmcp-surface-visual-audit.mjs",
      },
    },
    findings,
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return reportPath;
}

async function reportFindings(reportPath) {
  await runExistingScript("scripts/report-uat-findings.mjs", ["--report", reportPath]);
}

async function repairFindings(reportPath, findings, worker) {
  if (!new Set(["pi", "cline"]).has(worker)) {
    throw new Error(`WebMCP repair worker must be pi or cline; received ${worker || "empty"}.`);
  }

  await runExistingScript("scripts/ensure-local-repair-model.mjs", ["--worker", worker]).catch((error) => {
    console.error(`[WEBMCP] Existing local repair-model preparation did not complete: ${error.message}`);
  });
  await runExistingScript("scripts/run-semantic-uat-repair.mjs", ["--worker", worker, "--preflight", "--require-ready"]);

  for (const finding of findings) {
    await runExistingScript("scripts/run-semantic-uat-repair.mjs", [
      "--worker", worker,
      "--report", reportPath,
      "--fingerprint", finding.fingerprint,
    ]);
  }
}

async function prepare(home) {
  if (!home) throw new Error("Pass --home for the isolated WebMCP synthetic test home.");
  await prepareVerificationSyntheticHome(path.resolve(home));
  console.log(`[WEBMCP] Isolated test home ready: ${home}`);
}

async function cleanup(home) {
  if (!home) return;
  await cleanupVerificationSyntheticHome(path.resolve(home));
}

async function run({ serverUrl, home, toolRoot, githubReport = false, repair = false, repairWorker = "pi" }) {
  if (!home) throw new Error("Pass --home for the isolated WebMCP synthetic test home.");
  if (!toolRoot) throw new Error("Pass --tool-root pointing to the isolated WebMCP verification install.");
  const resolvedHome = path.resolve(home);
  const resolvedToolRoot = path.resolve(toolRoot);
  const server = validateLocalServer(serverUrl || "http://127.0.0.1:4173");
  console.log("============================================================");
  console.log("  PlotPickle - WebMCP Testing");
  console.log("============================================================");
  console.log("Waiting for the private PlotPickle test session...");

  try {
    await ensureVerificationTools(resolvedToolRoot);
    await waitForUiServer(server);
    const auth = await establishVerificationSyntheticHuman({ baseUrl: server.origin, home: resolvedHome });
    await runWebMcpSurfaceVisualAudit({
      serverUrl: server.origin,
      toolRoot: resolvedToolRoot,
      storageStatePath: auth.storageStatePath,
    });
    const findingsReport = await writeWebMcpFindingsReport({ status: "pass", target: server.origin, findings: [] });
    const evidence = await writeEvidence("pass", { findingsReport, findingCount: 0 });
    console.log("");
    for (const line of visualBaselineApprovalLines()) console.log(line);
    console.log("");
    const pass = formatPassTag();
    console.log(`${pass} WebMCP interface, surface, navigation and Skin V1 checks passed.`);
    console.log(`${pass} Dashboard remains the sole canonical screenshot: ${DASHBOARD_SCREENSHOT_PATH}`);
    console.log(`${pass} UAT findings report: ${findingsReport}`);
    console.log(`${pass} Evidence report: ${evidence}`);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const structured = findingsFromWebMcpError(error);
    const findings = structured.length ? structured : [buildWebMcpRuntimeFinding()];
    const findingsReport = await writeWebMcpFindingsReport({ status: "fail", target: server.origin, findings }).catch(() => "");
    const evidence = await writeEvidence("fail", {
      failure: message,
      findingsReport,
      findingCount: findings.length,
    }).catch(() => "");

    console.error("");
    console.error(`[FAIL] WebMCP UAT: ${message}`);
    if (findingsReport) console.error(`[FAIL] Repair-ready UAT findings: ${findingsReport}`);
    if (evidence) console.error(`[FAIL] Evidence report: ${evidence}`);

    if (githubReport && findingsReport) {
      await reportFindings(findingsReport).catch((reportError) => {
        console.error(`[FAIL] Existing GitHub UAT reporter did not complete: ${reportError.message}`);
      });
    }

    if (repair && findingsReport) {
      await repairFindings(findingsReport, findings, repairWorker.toLowerCase()).then(() => {
        console.error("[WEBMCP] Developer repair workflow completed, but this running WebMCP session remains FAIL until the repaired build is independently rerun.");
      }).catch((repairError) => {
        console.error(`[FAIL] Existing ${repairWorker} repair workflow did not complete: ${repairError.message}`);
      });
    }

    return 1;
  }
}

const directExecution = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (directExecution) {
  const command = process.argv[2] || "run";
  const home = argument("--home");
  if (command === "prepare") {
    prepare(home).catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
  } else if (command === "cleanup") {
    cleanup(home).catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
  } else if (command === "run") {
    run({
      serverUrl: argument("--server", "http://127.0.0.1:4173"),
      home,
      toolRoot: argument("--tool-root"),
      githubReport: process.argv.includes("--github-report"),
      repair: process.argv.includes("--repair"),
      repairWorker: argument("--repair-worker", process.env.PLOTPICKLE_REPAIR_WORKER || "pi"),
    }).then((code) => {
      process.exitCode = code;
    });
  } else {
    console.error(`Unknown WebMCP startup UAT command: ${command}`);
    process.exitCode = 1;
  }
}
