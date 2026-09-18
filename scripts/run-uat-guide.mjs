#!/usr/bin/env node

import { mkdir, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { agentCompleted, agentLoaded, agentNeedsAttention, agentStatus, keepAgentWindowOpen } from "../lib/agents/agent-window-status.mjs";
import { cleanupVerificationSyntheticHome, prepareVerificationSyntheticHome } from "./full-verification-auth.mjs";
import { runWebMcpStartupUat } from "./run-webmcp-startup-uat.mjs";
import { spawnCommand } from "./spawn-command.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const argument = (name, fallback = "") => {
  const index = argv.indexOf(name);
  return index >= 0 && argv[index + 1] ? argv[index + 1] : fallback;
};

const LOOPBACK = new Set(["127.0.0.1", "localhost", "::1"]);
const server = new URL(argument("--server", "http://127.0.0.1:4173"));
if (server.protocol !== "http:" || !LOOPBACK.has(server.hostname)) throw new Error("UAT Guide accepts only a local PlotPickle server.");

const runId = argument("--run-id") || `uat-${randomUUID()}`;
if (!/^[a-zA-Z0-9._-]{8,160}$/u.test(runId)) throw new Error("UAT Guide run id is invalid.");

const localRoot = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
const guideRoot = path.join(localRoot, "PlotPickle", "uat-guide");
const statusFile = path.resolve(argument("--status-file", path.join(guideRoot, "latest.json")));
if (!statusFile.startsWith(path.resolve(guideRoot))) throw new Error("UAT Guide status must stay inside the local PlotPickle UAT directory.");
const syntheticHome = path.join(guideRoot, "synthetic-humans", runId);
const toolRoot = path.join(localRoot, "PlotPickle", "verification-tools", "webmcp-surface-uat");
const stayOpen = argv.includes("--stay-open");

const state = {
  schemaVersion: 1,
  runId,
  pid: process.pid,
  status: "running",
  startedAt: new Date().toISOString(),
  completedAt: "",
  current: {
    agent: "UAT Semantic Review",
    check: "Starting",
    surface: "",
    storyAddress: "Block 17 / Mini-Block 1",
    state: "RUNNING",
  },
  events: [],
  evidence: {
    verificationInbox: "/verification-inbox",
    webmcp: ".artifacts/webmcp-startup/summary.json",
    findings: ".artifacts/webmcp-startup/uat-findings.json",
    afterglow: "tests/issue-2174-afterglow-story-to-screen-acceptance.test.mjs",
  },
  privacy: {
    syntheticHuman: true,
    humanCookiesInherited: false,
    privateStoryRead: false,
    providerSpendAllowed: false,
    hiddenReasoningRecorded: false,
  },
};

function safeText(value) {
  return String(value || "")
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g, "[redacted-token]")
    .replace(/\b(?:sk-[A-Za-z0-9_-]{16,}|xai-[A-Za-z0-9_-]{16,})\b/g, "[redacted-api-key]")
    .replace(/((?:password|secret|private[_ -]?key|api[_ -]?key|token)\s*[=:]\s*)\S+/gi, "$1[redacted]")
    .replace(/\b[A-Za-z]:\\Users\\[^\\\s]+/gi, "%USERPROFILE%")
    .replace(/\/home\/[^/\s]+/g, "/home/[redacted]")
    .slice(0, 900);
}

async function persist() {
  await mkdir(path.dirname(statusFile), { recursive: true });
  await writeFile(statusFile, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

async function emit({ type = "status", label, detail = "", surface = "", state: eventState = "RUNNING" }) {
  const event = {
    at: new Date().toISOString(),
    type,
    label: safeText(label),
    detail: safeText(detail),
    surface: safeText(surface),
    state: eventState,
  };
  state.current = {
    ...state.current,
    check: event.label,
    surface: event.surface,
    state: event.state,
  };
  state.events.push(event);
  if (state.events.length > 160) state.events.splice(0, state.events.length - 160);
  agentStatus(event.label, event.detail);
  await persist();
}

async function forceLocalStoryMode() {
  const response = await fetch(new URL("/api/story-mode/policy", server.origin), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "local" }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok !== true || body?.mode !== "local") {
    throw new Error(body?.message || "UAT Semantic Review could not switch Story Mode to LOCAL.");
  }
}

function runNodeTest(files) {
  return new Promise((resolve, reject) => {
    const child = spawnCommand(process.execPath, ["--test", ...files], {
      cwd: repoRoot,
      stdio: "inherit",
      windowsHide: false,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`Deterministic acceptance failed${signal ? ` with signal ${signal}` : ` with exit code ${code}`}.`));
    });
  });
}

async function main() {
  agentLoaded({
    name: "PlotPickle UAT Semantic Review",
    purpose: "Run and narrate the deterministic PlotPickle Writer-to-Screen acceptance checks for the in-page Human review surface.",
    instructions: "None. This guide reports observable test operations only; deterministic verification owns PASS/FAIL.",
    automatic: true,
  });

  await emit({
    label: "UAT Semantic Review started",
    detail: "Checking the current Skin V1 Writer-to-Screen workflow with an isolated synthetic Human while the Human reviews progress in PlotPickle.",
  });
  await forceLocalStoryMode();
  await emit({
    label: "Story Mode switched to LOCAL",
    detail: "UAT uses Local Story Mode automatically. Cloud providers are not eligible for the default acceptance run.",
    surface: "story-mode",
  });

  await prepareVerificationSyntheticHome(syntheticHome);
  const webmcp = await runWebMcpStartupUat({
    serverUrl: server.origin,
    home: syntheticHome,
    toolRoot,
    allowBaselinePrompt: false,
    onEvent: emit,
  });
  if (webmcp !== 0) throw new Error("The rendered WebMCP acceptance pass found an issue.");

  await emit({
    label: "Checking Afterglow story-to-screen evidence",
    detail: "Verifying Block 17.1 through the provider-neutral Production inspection. No provider will be called.",
    surface: "production-inspection",
  });
  await runNodeTest([
    "tests/issue-2174-afterglow-story-to-screen-acceptance.test.mjs",
    "tests/issue-2189-canonical-routing-fence.test.mjs",
    "tests/issue-2189-uat-surface-coverage.test.mjs",
  ]);

  await emit({
    type: "result",
    label: "UAT Semantic Review complete",
    detail: "Rendered workflow and deterministic Afterglow acceptance passed. No provider was called and no candidate was promoted to canon.",
    surface: "verification-inbox",
    state: "PASS",
  });
  state.status = "pass";
  state.completedAt = new Date().toISOString();
  state.current.state = "PASS";
  await persist();
  agentCompleted("UAT Semantic Review PASS. The in-page review and Verification Inbox retain the bounded result and linked evidence.");
  return 0;
}

try {
  process.exitCode = await main();
} catch (error) {
  const message = safeText(error instanceof Error ? error.message : String(error));
  state.status = "fail";
  state.completedAt = new Date().toISOString();
  state.current.state = "NEEDS_ATTENTION";
  await emit({
    type: "result",
    label: "UAT Semantic Review needs attention",
    detail: message,
    surface: state.current.surface,
    state: "NEEDS_ATTENTION",
  }).catch(() => undefined);
  await persist().catch(() => undefined);
  agentNeedsAttention(`${message}\nOpen the in-app UAT Semantic Review and Verification Inbox/evidence for the bounded result.`);
  process.exitCode = 1;
} finally {
  await cleanupVerificationSyntheticHome(syntheticHome).catch(() => undefined);
  await rm(path.join(guideRoot, "synthetic-humans", runId), { recursive: true, force: true }).catch(() => undefined);
  if (stayOpen) await keepAgentWindowOpen("PlotPickle UAT Semantic Review");
}
