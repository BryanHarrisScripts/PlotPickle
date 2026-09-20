#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { prepareWebMcpProfileGateSession } from "../skin-v1/profile-gate-capture.mjs";
import { validateLocalServer } from "../ui-axe-audit.mjs";
import {
  WEBMCP_STARTUP_EVIDENCE,
  ensureVerificationTools,
  runWebMcpStartupUat,
} from "../../../scripts/run-webmcp-startup-uat.mjs";
import { runWebMcpQaProfile } from "./runner.mjs";
import {
  resolveWebMcpQaProfile,
  webMcpQaProfileMenuLines,
} from "./profiles.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function argument(name, fallback = "") {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

async function readStandardResult() {
  const evidencePath = path.resolve(repoRoot, WEBMCP_STARTUP_EVIDENCE);
  const evidence = JSON.parse(await readFile(evidencePath, "utf8"));
  return {
    status: evidence.status === "pass" ? "PASS" : "FAIL",
    evidence: evidencePath,
    findingsReport: evidence.findingsReport || "",
    standardCatalogue: evidence.standardSurfaceCatalogue || {},
    visualDirector: {
      totals: {
        surfaces: Number(evidence.visualDirector?.surfaces || 0),
        blockers: Number(evidence.visualDirector?.blockers || 0),
        advisories: Number(evidence.visualDirector?.advisories || 0),
      },
      report: evidence.visualDirector?.report || "",
    },
  };
}

export async function runWebMcpQaCli({
  profile = "1",
  serverUrl = "http://127.0.0.1:4173",
  home,
  toolRoot,
  githubReport = false,
  repair = false,
  repairWorker = "pi",
} = {}) {
  if (!home) throw new Error("Pass --home for the isolated WebMCP synthetic test home.");
  if (!toolRoot) throw new Error("Pass --tool-root pointing to the isolated WebMCP verification install.");

  const selected = resolveWebMcpQaProfile(profile);
  const server = validateLocalServer(serverUrl);
  const resolvedHome = path.resolve(home);
  const resolvedToolRoot = path.resolve(toolRoot);
  let storageStatePromise;

  const getStorageStatePath = async () => {
    if (!storageStatePromise) {
      storageStatePromise = (async () => {
        await ensureVerificationTools(resolvedToolRoot);
        const auth = await prepareWebMcpProfileGateSession({
          baseUrl: server.origin,
          home: resolvedHome,
          toolRoot: resolvedToolRoot,
        });
        if (!auth?.storageStatePath) {
          throw new Error("Synthetic WebMCP profile authentication did not return browser storage state.");
        }
        return auth.storageStatePath;
      })();
    }
    return storageStatePromise;
  };

  const result = await runWebMcpQaProfile({
    profile: selected.id,
    serverUrl: server.origin,
    toolRoot: resolvedToolRoot,
    getStorageStatePath,
    runStandard: async () => {
      const code = await runWebMcpStartupUat({
        serverUrl: server.origin,
        home: resolvedHome,
        toolRoot: resolvedToolRoot,
        githubReport,
        repair,
        repairWorker,
        allowBaselinePrompt: selected.id === "1",
      });
      if (code !== 0) throw new Error("Standard WebMCP did not establish a passing governed application baseline.");
      storageStatePromise = Promise.resolve(
        path.join(resolvedHome, "verification-browser", "storage-state.json"),
      );
      return readStandardResult();
    },
  });

  const tag = result.overall === "PASS" ? "[PASS]" : "[FAIL]";
  if (selected.id !== "1") {
    console.log("");
    console.log(`${tag} WebMCP ${selected.label}: ${result.overall}`);
    for (const entry of result.profiles) {
      const suffix = entry.skipped ? ` — skipped: ${entry.skippedReason}` : "";
      console.log(
        `[${entry.status}] ${entry.label}: ${entry.blockers} blocker(s), ${entry.advisories} advisory finding(s)${suffix}`,
      );
    }
    const census = result.profiles.find((entry) => entry.key === "surface-census" && entry.raw?.summary);
    if (census) {
      const summary = census.raw.summary;
      console.log("");
      console.log("[WEBMCP] Surface Census");
      console.log(`[WEBMCP] Discovered user-visible surfaces: ${summary.discoveredUserVisibleSurfaces}`);
      console.log(`[WEBMCP] WebMCP governed surfaces: ${summary.webmcpGovernedSurfaces}`);
      console.log(`[WEBMCP] Missing from WebMCP: ${summary.missingFromWebMcp.length}`);
      console.log(`[WEBMCP] Governed but unreachable: ${summary.governedButUnreachable.length}`);
      console.log(`[WEBMCP] Legacy/unclassified reachable: ${summary.legacyUnclassifiedReachable.length}`);
      console.log(`[WEBMCP] Navigation failures: ${summary.navigationFailures.length}`);
      console.log(`[WEBMCP] Skipped/state-only: ${summary.skippedUnsafe.length}`);
      console.log(`[WEBMCP] Reconciliation coverage: ${summary.reconciliationCoveragePct}%`);
      console.log(`[WEBMCP] Governance coverage: ${summary.governanceCoveragePct}%`);
      for (const [label, values] of [
        ["Missing from WebMCP", summary.missingFromWebMcp],
        ["Governed but unreachable", summary.governedButUnreachable],
        ["Legacy/unclassified reachable", summary.legacyUnclassifiedReachable],
        ["Navigation failures", summary.navigationFailures],
      ]) {
        if (values.length) console.log(`[WEBMCP] ${label}: ${values.join(", ")}`);
      }
    }
    if (result.latestZipPath) {
      console.log("[WEBMCP] Full QA evidence bundle verified and ready.");
      console.log(`[WEBMCP] Share this ZIP: ${result.latestZipPath}`);
    }
    if (result.zipPath) console.log(`[WEBMCP] Run archive ZIP: ${result.zipPath}`);
    if (result.manifestPath) console.log(`[WEBMCP] Full QA manifest: ${result.manifestPath}`);
  }
  return result.overall === "PASS" ? 0 : 1;
}

const directExecution = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
if (directExecution) {
  const command = process.argv[2] || "run";
  if (command === "profiles") {
    for (const line of webMcpQaProfileMenuLines()) console.log(line);
  } else if (command === "run") {
    runWebMcpQaCli({
      profile: argument("--profile", process.env.PLOTPICKLE_WEBMCP_QA_PROFILE || "1"),
      serverUrl: argument("--server", "http://127.0.0.1:4173"),
      home: argument("--home"),
      toolRoot: argument("--tool-root"),
      githubReport: process.argv.includes("--github-report"),
      repair: process.argv.includes("--repair"),
      repairWorker: argument("--repair-worker", process.env.PLOTPICKLE_REPAIR_WORKER || "pi"),
    }).then((code) => {
      process.exitCode = code;
    }).catch((error) => {
      console.error(`[FAIL] WebMCP QA: ${error instanceof Error ? error.message : String(error)}`);
      process.exitCode = 1;
    });
  } else {
    console.error(`Unknown WebMCP QA command: ${command}`);
    process.exitCode = 1;
  }
}
