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

test("anti-echo adapter can repair only an isolated anti-echo false red", async () => {
  const [entrypoint, adapter] = await Promise.all([
    read("build/startup-agent-diagnostics.ts"),
    read("build/startup-agent-diagnostics-runtime-v5.ts"),
  ]);
  assert.match(entrypoint, /startup-agent-diagnostics-runtime-v5/);
  assert.match(adapter, /failedChecks\.length === 1/);
  assert.match(adapter, /failedChecks\[0\]\.includes\("Sage anti-echo check"\)/);
  assert.match(adapter, /verifySageAntiEcho/);
  assert.match(adapter, /verified by strict no-restatement probe/);
  assert.match(adapter, /return \{ healthy: true, warnings: result\.warnings \}/);
});
