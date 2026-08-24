import assert from "node:assert/strict";
import test from "node:test";
import { runManagedPiProcess } from "../Utilities/DeveloperWorkbench/pi-managed-node-launch.mjs";

test("#1382 managed Pi subprocess receives EOF instead of an open stdin pipe", async () => {
  const script = [
    "process.stdin.setEncoding('utf8');",
    "let input = '';",
    "process.stdin.on('data', (chunk) => { input += chunk; });",
    "process.stdin.on('end', () => { process.stdout.write(`EOF:${input.length}`); });",
    "process.stdin.resume();",
  ].join(" ");

  const result = await runManagedPiProcess(["-e", script], { timeout: 2_000 });
  assert.equal(result.stdout, "EOF:0");
  assert.equal(result.stderr, "");
});

test("#1382 Pi timeout diagnostics retain captured child output", async () => {
  const script = [
    "process.stderr.write('PI_STAGE=waiting-for-runtime\\n');",
    "setInterval(() => {}, 1000);",
  ].join(" ");

  await assert.rejects(
    runManagedPiProcess(["-e", script], { timeout: 100 }),
    (error) => {
      assert.equal(error.code, "ETIMEDOUT");
      assert.match(String(error.stderr || ""), /PI_STAGE=waiting-for-runtime/);
      return true;
    },
  );
});
