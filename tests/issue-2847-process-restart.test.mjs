import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

// PP-SAVE-001 T6: these are two complete, distinct Node processes using the
// current authenticated PlotPickle loopback server + encrypted vault in the
// same isolated test home, NOT a browser refresh or reset of a JS module.
test("PP-SAVE-001 T6: saved/locked Afterglow image survives a genuine process exit and new authenticated process", async (t) => {
  const home = await mkdtemp(path.resolve("node_modules/.pp-save-001-restart-"));
  const worker = path.resolve("tests/support/issue-2847-process-restart-worker.mjs");
  const env = {
    ...process.env,
    PLOTPICKLE_HOME: home,
    PLOTPICKLE_AUTH_STATE_PATH: path.join(home, "auth", "state.json"),
    PLOTPICKLE_ACCESS_MODE: "desktop-loopback",
  };
  const phase = (name) => {
    const child = spawnSync(process.execPath, [worker, name], {
      cwd: process.cwd(), env, encoding: "utf8", timeout: 120000, maxBuffer: 2 * 1024 * 1024,
    });
    assert.equal(child.error, undefined, name + " child process failure: " + (child.error?.message ?? ""));
    assert.equal(child.signal, null, name + " child process terminated by signal " + child.signal);
    assert.equal(child.status, 0, name + " must independently succeed (exit " + child.status
      + ")\\nstdout:\\n" + child.stdout + "\\nstderr:\\n" + child.stderr);
    const result = JSON.parse(child.stdout.trim().split(/\r?\n/u).at(-1));
    assert.equal(result.phase, name);
    return result;
  };
  try {
    const first = phase("save-and-lock");
    const expected = JSON.parse(await readFile(path.join(home, "expected.json"), "utf8"));
    assert.equal(first.pid, expected.originalPid);
    assert.equal(first.artifactId, expected.artifactId);
    assert.equal(first.digest, expected.digest);
    const recovered = phase("recover");
    const observed = JSON.parse(await readFile(path.join(home, "observed.json"), "utf8"));
    assert.notEqual(first.pid, recovered.pid, "the second authority must be a different OS process");
    assert.equal(observed.originalPid, first.pid);
    assert.equal(observed.newPid, recovered.pid);
    assert.equal(recovered.projectId, expected.projectId);
    assert.equal(recovered.artifactId, expected.artifactId);
    assert.equal(recovered.digest, expected.digest);
    assert.equal(recovered.revision, expected.revision);
    assert.equal(recovered.saved, true);
    assert.equal(recovered.locked, true);
    assert.equal(recovered.previsEligible, true,
      "recovered exact saved+locked artifact must be the authoritative Previs input");
    t.diagnostic(JSON.stringify({
      contract: "PP-SAVE-001", truth: "T6+T7", result: "PASS in isolated Windows/Node process-restart fixture",
      sameHome: true, distinctProcessIds: [first.pid, recovered.pid], projectId: expected.projectId,
      artifactId: expected.artifactId, mediaSha256: expected.digest,
      contractLimit: "Does not certify Human's own Windows launcher, cross-device recovery or paid provider generation",
    }));
  } finally {
    await rm(home, { recursive: true, force: true });
  }
});
