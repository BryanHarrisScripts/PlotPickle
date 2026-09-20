import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { finalizeWebMcpFullQaArtifacts } from "../lib/verification/webmcp-qa/artifacts.mjs";

const read = (target) => readFile(new URL("../" + target, import.meta.url), "utf8");

test("#2298 Runtime hidden-focus probe uses the declared rendered-state helper", async () => {
  const runtime = await read("lib/verification/browser-probes/runtime.mjs");
  assert.match(runtime, /root\.contains\(active\) && !isRendered\(active\)/u);
  assert.doesNotMatch(runtime, /!visible\(active\)/u);
});

test("#2298 Full QA creates and verifies both run-specific and predictable latest ZIPs", async () => {
  const repoRoot = await mkdtemp(path.join(os.tmpdir(), "plotpickle-2298-"));
  try {
    const result = await finalizeWebMcpFullQaArtifacts({
      repoRoot,
      runId: "webmcp-full-qa-test-run",
      startedAt: "2026-09-20T17:35:13.479Z",
      profileResults: [
        {
          id: "1",
          key: "standard",
          label: "STANDARD",
          status: "PASS",
          blockers: 0,
          advisories: 0,
          report: "",
        },
        {
          id: "5",
          key: "runtime",
          label: "RUNTIME",
          status: "PASS",
          blockers: 0,
          advisories: 0,
          report: "",
        },
      ],
      overall: "PASS",
    });

    assert.equal(result.zipVerification.verified, true);
    assert.equal(result.latestZipVerification.verified, true);
    assert.equal(path.basename(result.latestZipPath), "webmcp-full-qa-latest.zip");
    assert.notEqual(result.zipPath, result.latestZipPath);

    for (const target of [result.zipPath, result.latestZipPath]) {
      const buffer = await readFile(target);
      assert.ok(buffer.length > 22);
      assert.equal(buffer.subarray(0, 4).toString("binary"), "PK\u0003\u0004");
    }
  } finally {
    await rm(repoRoot, { recursive: true, force: true });
  }
});

test("#2298 CLI gives one obvious verified evidence handoff and preserves the run archive", async () => {
  const cli = await read("lib/verification/webmcp-qa/cli.mjs");
  const runner = await read("lib/verification/webmcp-qa/runner.mjs");
  assert.match(cli, /Full QA evidence bundle verified and ready\./u);
  assert.match(cli, /Share this ZIP/u);
  assert.match(cli, /Run archive ZIP/u);
  assert.match(runner, /latestZipPath: artifacts\.latestZipPath/u);
});

test("#2298 Vite ignores generated .artifacts output", async () => {
  const vite = await read("vite.config.ts");
  assert.match(vite, /"\*\*\/\.artifacts\/\*\*"/u);
  assert.match(vite, /watch:[\s\S]*ignored: ignoredWatchPaths/u);
});
