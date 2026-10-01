import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("Mastra startup status reports the installed package version instead of stale metadata", async () => {
  const runtime = await read("build/mastra-agent-runtime.ts");
  assert.match(runtime, /node_modules\/@mastra\/core\/package\.json/);
  assert.match(runtime, /MASTRA_RUNTIME_VERSION/);
  assert.match(runtime, /version: MASTRA_RUNTIME_VERSION/);
  assert.doesNotMatch(runtime, /version:\s*["']1\.57\.0["']/);
});

test("startup anti-echo recovery checks near-verbatim restatement instead of ordinary semantic overlap", async () => {
  const adapter = await read("build/startup-agent-diagnostics-runtime-v5.ts");
  assert.match(adapter, /export function strictAntiEchoPass/);
  assert.match(adapter, /answerText === questionText/);
  assert.match(adapter, /answerText\.includes\(questionText\)/);
  assert.match(adapter, /longestContiguousMatch/);
  assert.match(adapter, /Math\.max\(8, Math\.ceil\(questionWords\.length \* 0\.7\)\)/);
  assert.doesNotMatch(adapter, /overlap\s*<\s*0\.85/);
});

test("anti-echo adapter remains active beneath host-owned Agent Profile validation", async () => {
  const [entrypoint, profileAdapter, antiEchoAdapter] = await Promise.all([
    read("build/startup-agent-diagnostics.ts"),
    read("build/startup-agent-diagnostics-runtime-v6.ts"),
    read("build/startup-agent-diagnostics-runtime-v5.ts"),
  ]);
  assert.match(entrypoint, /startup-agent-diagnostics-runtime-v6/);
  assert.match(profileAdapter, /runStartupAgentDiagnostics as runV5/);
  assert.match(profileAdapter, /assertAgentProfilesValid/);
  assert.match(antiEchoAdapter, /remainingFailures\.some\(\(line\) => line\.includes\("Sage anti-echo check"\)\)/);
  assert.match(antiEchoAdapter, /remainingFailures = remainingFailures\.filter\(\(line\) => !line\.includes\("Sage anti-echo check"\)\)/);
  assert.match(antiEchoAdapter, /verifySageAntiEcho/);
  assert.match(antiEchoAdapter, /verified by strict no-restatement probe/);
  assert.match(antiEchoAdapter, /const recoveredHealthy = failedChecks\.length > 0 && remainingFailures\.length === 0/);
  assert.match(antiEchoAdapter, /return recoveredHealthy \? \{ healthy: true, warnings: result\.warnings \} : result/);
  assert.doesNotMatch(antiEchoAdapter, /failedChecks\.length === 1/);
});
