#!/usr/bin/env node

import assert from "node:assert/strict";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { McpClient, delay, resultText } from "./creative-uat/mcp-runtime.mjs";
import {
  endpointRuntimeEnvironment,
  startManagedPlotPickleEndpoint,
  stopManagedLocalEndpoint,
} from "./local-endpoint-runtime.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jobId = `auth-smoke-${randomUUID().replaceAll("-", "").slice(0, 24)}`;
const AUTH_GATE = /Create your local profile|Unlock your profile|PlotPickle login is not available yet/u;
let runtime = null;
let client = null;
let syntheticHome = "";

function status(label, state, detail = "") {
  process.stdout.write(`${String(label).padEnd(42, ".")} ${state}${detail ? `  ${detail}` : ""}\n`);
}

async function waitForAuthenticatedSnapshot(client) {
  let snapshot = "";
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    snapshot = resultText(await client.call("browser_snapshot", {}));
    if (AUTH_GATE.test(snapshot)) return snapshot;
    if (snapshot.includes("PlotPickle global workflow") && snapshot.includes("Settings Config") && snapshot.includes("Profile")) return snapshot;
    await delay(500);
  }
  return snapshot;
}

try {
  status("Synthetic Human endpoint", "START");
  runtime = await startManagedPlotPickleEndpoint({
    repoRoot,
    jobId,
    serviceKind: "plotpickle-full-verification",
    startupContract: "plotpickle-full-verification-synthetic-human-smoke-v1",
    timeoutMs: 180_000,
    onStatus: (state, detail) => status("Synthetic Human endpoint", state.toUpperCase(), detail),
    onOutput: (text, stream) => (stream === "stderr" ? process.stderr : process.stdout).write(text),
  });
  syntheticHome = runtime.verificationAuthHome;
  const env = endpointRuntimeEnvironment(runtime);
  assert.equal(env.PLOTPICKLE_VERIFICATION_AUTH_MODE, "synthetic-human");
  assert.ok(env.PLOTPICKLE_VERIFICATION_AUTH_COOKIE?.startsWith("ppsid="));
  assert.ok(env.PLOTPICKLE_VERIFICATION_AUTH_CSRF);
  assert.ok(env.PLOTPICKLE_VERIFICATION_STORAGE_STATE);

  const authenticatedResponse = await fetch(`${runtime.baseUrl}/api/auth/profile`, {
    headers: { Accept: "application/json", Cookie: env.PLOTPICKLE_VERIFICATION_AUTH_COOKIE },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const authenticated = await authenticatedResponse.json();
  assert.equal(authenticatedResponse.ok, true);
  assert.equal(authenticated.authenticated, true);
  assert.equal(authenticated.profile?.displayName, "PlotPickle Verification Human");
  status("Synthetic Human API session", "PASS", "real profile/session boundary authenticated");

  const privateResponse = await fetch(`${runtime.baseUrl}/api/auth/profile-private`, {
    headers: { Accept: "application/json", Cookie: env.PLOTPICKLE_VERIFICATION_AUTH_COOKIE },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const privateState = await privateResponse.json();
  assert.equal(privateResponse.ok, true, `private profile boundary returned ${privateResponse.status}: ${JSON.stringify(privateState)}`);
  assert.equal(Object.hasOwn(privateState, "project"), true);
  assert.equal(Object.hasOwn(privateState, "wyrmwood"), true);
  status("Synthetic Human private state", "PASS", "same Node-host session opened encrypted private storage");

  const presentationResponse = await fetch(`${runtime.baseUrl}/api/auth/profile-presentation`, {
    headers: { Accept: "application/json", Cookie: env.PLOTPICKLE_VERIFICATION_AUTH_COOKIE },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  const presentation = await presentationResponse.json();
  assert.equal(
    presentationResponse.ok,
    true,
    `profile presentation boundary returned ${presentationResponse.status}: ${JSON.stringify(presentation)}`,
  );
  assert.equal(presentation.profile?.displayName, "PlotPickle Verification Human");
  status("Synthetic Human presentation", "PASS", "current Profile presentation resolved from authenticated Human");

  const browserOutput = path.join(syntheticHome, "browser-smoke");
  await mkdir(browserOutput, { recursive: true, mode: 0o700 });
  client = new McpClient(process.execPath, [
    path.join(repoRoot, "scripts", "run-npx-stdio.mjs"),
    "-y",
    "@playwright/mcp@0.0.78",
    "--headless",
    "--isolated",
    "--browser",
    "chrome",
    "--console-level",
    "warning",
    "--output-dir",
    browserOutput,
    "--allowed-origins",
    "http://127.0.0.1:*;http://localhost:*",
  ], { cwd: repoRoot, env });
  await client.initialize();
  const tools = await client.tools();
  const names = new Set(tools.map((tool) => tool.name));
  for (const required of ["browser_navigate", "browser_snapshot"]) assert.equal(names.has(required), true, `missing ${required}`);
  await client.call("browser_navigate", { url: runtime.baseUrl });
  const snapshot = await waitForAuthenticatedSnapshot(client);
  assert.match(snapshot, /PlotPickle global workflow/u);
  assert.match(snapshot, /Settings Config/u);
  assert.match(snapshot, /Profile/u);
  assert.doesNotMatch(snapshot, AUTH_GATE);
  status("Synthetic Human Playwright session", "PASS", "isolated MCP browser opened current authenticated Profile workspace");

  if (names.has("browser_close")) await client.call("browser_close", {});
  await client.close();
  client = null;
} finally {
  if (client) await client.close().catch(() => undefined);
  if (runtime) await stopManagedLocalEndpoint(runtime);
}

if (syntheticHome) {
  let removed = false;
  try {
    await access(syntheticHome);
  } catch (error) {
    if (error?.code === "ENOENT") removed = true;
    else throw error;
  }
  assert.equal(removed, true, "synthetic Human runtime home must be removed after endpoint shutdown");
  status("Synthetic Human cleanup", "PASS", "isolated auth/profile runtime removed");
}

process.stdout.write("FULL VERIFICATION SYNTHETIC HUMAN PASS\n");
