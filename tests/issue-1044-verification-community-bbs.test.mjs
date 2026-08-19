import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { transientBuzzVerificationFailure, withTransientBuzzRetry } from "../scripts/buzz-verification-retry.mjs";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("#1044 retries only transient BUZZ transport failures", async () => {
  let attempts = 0;
  const result = await withTransientBuzzRetry(async () => {
    attempts += 1;
    if (attempts < 3) throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    return "ready";
  }, { attempts: 3, delayMs: 1, sleepImpl: async () => {} });
  assert.equal(result, "ready");
  assert.equal(attempts, 3);
  assert.equal(transientBuzzVerificationFailure(new DOMException("timeout", "TimeoutError")), true);

  let functionalAttempts = 0;
  await assert.rejects(
    () => withTransientBuzzRetry(async () => {
      functionalAttempts += 1;
      throw new Error("Guildhall room 'forge' is missing.");
    }, { attempts: 3, delayMs: 1, sleepImpl: async () => {} }),
    /Guildhall room/,
  );
  assert.equal(functionalAttempts, 1);
});

test("#1044 Community BBS owns its visible identity without renaming the BUZZ relay", async () => {
  const [workspace, terminal] = await Promise.all([
    read("app/community-workspace.tsx"),
    read("app/community-backdoor-terminal.tsx"),
  ]);
  assert.match(workspace, /PlotPickle Community BBS/);
  assert.match(workspace, /const nodeName = community\?\.community\.trim\(\) \|\| ""/);
  assert.match(workspace, /BUZZ NODE UNAVAILABLE/);
  assert.doesNotMatch(workspace, /COMMUNITY_BBS_NODE|plotpickle-community/);
  assert.doesNotMatch(workspace, /Playhouse/i);
  assert.match(terminal, /PLOTPICKLE COMMUNITY BBS/);
  assert.match(terminal, /readonly nodeName: string/);
  assert.match(terminal, /BUZZ NODE UNAVAILABLE/);
  assert.doesNotMatch(terminal, /COMMUNITY_BBS_NODE|plotpickle-community/);
  assert.match(terminal, /DRAGON|dragon/);
  assert.doesNotMatch(terminal, /Playhouse/i);
});

test("#1044 Community Presence replaces the user-facing Playhouse route while preserving local federation compatibility", async () => {
  const [presence, gateway] = await Promise.all([
    read("app/community-presence/page.tsx"),
    read("build/playhouse-federation-gateway.ts"),
  ]);
  assert.match(presence, /Community Presence/);
  assert.match(presence, /\/api\/community-federation/);
  assert.doesNotMatch(presence, /Playhouse/i);
  await assert.rejects(read("app/playhouse-presence/page.tsx"), (error) => error?.code === "ENOENT");
  assert.match(gateway, /const API = "\/api\/community-federation"/);
  assert.match(gateway, /playhouse-presence\.json/);
});

test("#1044 Sage gets one bounded quality repair without weakening the health rubric or Agent Profile boundary", async () => {
  const [source, profileLayer] = await Promise.all([
    read("build/startup-agent-diagnostics-runtime-v5.ts"),
    read("build/startup-agent-diagnostics-runtime-v6.ts"),
  ]);
  assert.match(source, /Quality repair/);
  assert.match(source, /SAGE_DIAGNOSTIC_QUALITY_REPAIR_INSTRUCTION/);
  assert.match(source, /strictAntiEchoPass\(text, question\)/);
  assert.match(source, /repetitionPass\(text\)/);
  assert.match(source, /groundingPass\(text\)/);
  assert.match(source, /60_000/);
  assert.match(source, /failedChecks\.every/);
  assert.ok(profileLayer.indexOf("assertAgentProfilesValid()") < profileLayer.indexOf("return runV5(baseUrl)"));
});

test("#1044 missing Pi is reported as optional repair capability rather than a product failure", async () => {
  const source = await read("scripts/full-verification-progress-runner.mjs");
  assert.match(source, /OPTIONAL REPAIR CAPABILITY UNAVAILABLE/);
  assert.match(source, /Pi is not installed or not available on PATH/);
  assert.match(source, /status: "PASS"/);
  assert.match(source, /no cloud fallback/i);
});
