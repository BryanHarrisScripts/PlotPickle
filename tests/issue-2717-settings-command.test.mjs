import assert from "node:assert/strict";
import test from "node:test";
import { HunkReviewController, hunkReviewArguments, hunkAgentContext } from "../build/dsdd/hunk-review-controller.mjs";
import { access, readFile } from "node:fs/promises";
import { ensureManagedPiInstalled } from "../scripts/pi-managed-install.mjs";

function fixture(overrides = {}) {
  const calls = [];
  let live = true;
  const controller = new HunkReviewController({ platform: "win32", repositoryRoot: process.cwd(), run: async (command, args) => {
    calls.push({ command, args });
    if (command === "where.exe") return { stdout: "C:\\review-tools\\hunk.cmd\n" };
    if (args[0] === "--version") return { stdout: "hunk 0.23.0\n" };
    const action = args[args.indexOf("-Action") + 1];
    return { stdout: JSON.stringify(action === "Start" ? { pid: 2717, startTicks: "123456" } : action === "Status" ? { running: live } : { stopped: true }) };
  }, ...overrides });
  return { controller, calls, close: () => { live = false; } };
}

test("review accepts only fixed checkout or PlotPickle PR targets", () => {
  assert.deepEqual(hunkReviewArguments({ kind: "working-tree" }), ["--no-extensions", "diff"]);
  assert.deepEqual(hunkReviewArguments({ kind: "pull-request", number: 2718 }), ["--no-extensions", "gh", "pr", "2718", "--repo", "BryanHarrisScripts/PlotPickle"]);
  for (const target of [null, [], { kind: "shell", command: "whoami" }, { kind: "working-tree", path: "../other" }, { kind: "pull-request", number: "2718" }, { kind: "pull-request", number: 0 }, { kind: "pull-request", number: 2**32 }, { kind: "pull-request", number: 2718, repo: "other/repo" }]) assert.throws(() => hunkReviewArguments(target));
});

test("native review admission is exclusive, per-profile and cancellation retains owned process identity", async () => {
  const { controller, calls } = fixture();
  const results = await Promise.allSettled([controller.start("owner-a", { kind: "working-tree" }), controller.start("owner-a", { kind: "working-tree" })]);
  assert.equal(results.filter(item => item.status === "fulfilled").length, 1);
  const review = results.find(item => item.status === "fulfilled").value;
  assert.equal(calls.filter(item => item.args.includes("Start")).length, 1);
  assert.equal(review.repositoryMutation, false); assert.equal(review.mergeAuthority, false);
  assert.equal(await controller.current("owner-b"), null);
  await assert.rejects(controller.cancel("owner-b", review.id), /not found/);
  assert.equal(calls.filter(item => item.args.includes("Stop")).length, 0);
  assert.equal((await controller.current("owner-a")).id, review.id);
  assert.equal((await controller.cancel("owner-a", review.id)).state, "cancelled");
  const stop = calls.find(item => item.args.includes("Stop"));
  assert.deepEqual(stop.args.slice(-4), ["-OwnedPid", "2717", "-OwnedStartTicks", "123456"]);
  await controller.cancel("owner-a", review.id);
  assert.equal(calls.filter(item => item.args.includes("Stop")).length, 1);
});

test("closed native review is discovered and the profile can reopen", async () => {
  const f = fixture();
  await f.controller.start("owner", { kind: "working-tree" });
  f.close();
  assert.equal((await f.controller.current("owner")).state, "closed");
  assert.equal((await f.controller.start("owner", { kind: "pull-request", number: 2718 })).state, "running");
});

test("advisory agent notes use bounded relative anchors and an owned temporary sidecar", async () => {
  for (const filePath of ["../other", "/absolute", "C:\\other", "./local", "file;command", "foo//bar"]) assert.throws(() => hunkAgentContext([{ filePath, newLine: 1, summary: "Note" }]));
  assert.throws(() => hunkAgentContext([{ filePath: "app/test.ts", newLine: 0, summary: "Note" }]));
  assert.throws(() => hunkAgentContext([{ filePath: "app/test.ts", newLine: 1, summary: "" }]));
  const f = fixture();
  const note = { filePath: "app/test.ts", newLine: 17, summary: "Agent advisory; inspect this change." };
  const review = await f.controller.start("owner", { kind: "working-tree" }, [note]);
  assert.equal(review.agentNotes, 1);
  const args = f.calls.find(call => call.args.includes("Start")).args;
  const sidecar = args[args.indexOf("-AgentContext") + 1];
  const loaded = JSON.parse(await readFile(sidecar, "utf8"));
  assert.equal(loaded.files[0].annotations[0].summary, note.summary);
  assert.deepEqual(loaded.files[0].annotations[0].newRange, [17, 17]);
  assert.equal(review.repositoryMutation, false);
  await f.controller.cancel("owner", review.id);
  await assert.rejects(access(sidecar));
});

test("missing, unsupported and failed native tools stay unavailable and release admission", async () => {
  const linux = fixture({ platform: "linux", run: () => { assert.fail("Unsupported host must not launch or probe tools"); } });
  assert.equal((await linux.controller.capabilities()).state, "unavailable");
  await assert.rejects(linux.controller.start("owner", { kind: "working-tree" }), /Windows/);
  const unavailable = fixture({ run: async () => { throw new Error("missing tool"); } });
  assert.equal((await unavailable.controller.capabilities()).state, "unavailable");
  for (let i = 0; i < 2; i++) await assert.rejects(unavailable.controller.start("owner", { kind: "working-tree" }), /missing tool/);
});

test("managed Pi refuses a mismatched reviewed lock before npm execution", async () => {
  let runs = 0, writes = 0;
  await assert.rejects(ensureManagedPiInstalled({ nodeVersion: "24.19.0", root: "synthetic-private-pi", existsSync: () => false,
    npmCommand: "npm", mkdir: async () => {}, writeFile: async () => { writes++; },
    readFile: async url => JSON.stringify(url.pathname.endsWith("package-lock.json") ? { packages: { "node_modules/@earendil-works/pi-coding-agent": { version: "0.99.1" } } } : { dependencies: { "@earendil-works/pi-coding-agent": "1.0.1" } }),
    runPortableCommand: async () => { runs++; },
  }), /lock must match exactly/);
  assert.equal(runs, 0); assert.equal(writes, 0);
});
