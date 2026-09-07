import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const runner = new URL("../scripts/ui-ux-code-audit.mjs", import.meta.url);

async function runAudit(environment = {}, files = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-ui-audit-"));
  try {
    for (const [relative, source] of Object.entries(files)) {
      await writeFile(path.join(root, relative), source, "utf8");
    }
    const result = spawnSync(process.execPath, [runner.pathname], {
      cwd: root,
      env: { ...process.env, ...environment },
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(await readFile(path.join(root, "audit-result.json"), "utf8"));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("runner passes without calling a provider when no UI files changed", async () => {
  const result = await runAudit({ CHANGED_FILES: "" });
  assert.equal(result.verdict, "pass");
  assert.equal(result.issueCount, 0);
  assert.equal(result.skipped, true);
});

test("runner fails closed when a UI audit credential is unavailable", async () => {
  const result = await runAudit(
    { CHANGED_FILES: "sample.tsx", OPENAI_API_KEY: "" },
    { "sample.tsx": "export default function Sample(){ return <button>Save</button>; }" },
  );
  assert.equal(result.verdict, "fail");
  assert.equal(result.issueCount, 1);
  assert.match(result.summary, /OPENAI_API_KEY is not configured/);
});

test("runner retries temporary audit-provider throttling before returning a verdict", async () => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.OPENAI_API_KEY;
  const originalDelays = process.env.OPENAI_UI_AUDIT_RETRY_DELAYS_MS;
  let calls = 0;
  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_UI_AUDIT_RETRY_DELAYS_MS = "0";
  globalThis.fetch = async () => {
    calls += 1;
    if (calls === 1) return new Response("throttled", { status: 429 });
    return Response.json({ choices: [{ message: { content: JSON.stringify({ verdict: "pass", summary: "Passed after retry.", findings: [] }) } }] });
  };
  try {
    const { callAuditModel } = await import(`../scripts/ui-ux-code-audit.mjs?retry-test=${Date.now()}`);
    const result = await callAuditModel("export default function Sample(){ return <button>Save</button>; }");
    assert.equal(calls, 2);
    assert.equal(result.verdict, "pass");
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalKey;
    if (originalDelays === undefined) delete process.env.OPENAI_UI_AUDIT_RETRY_DELAYS_MS;
    else process.env.OPENAI_UI_AUDIT_RETRY_DELAYS_MS = originalDelays;
  }
});
