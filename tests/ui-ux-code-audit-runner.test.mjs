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
