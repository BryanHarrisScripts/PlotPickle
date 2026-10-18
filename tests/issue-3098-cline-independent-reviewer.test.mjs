import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createClineEngineeringPlanAdapter } from "../scripts/engineering-team/cline-plan-adapter.mjs";
import { parseEngineeringCommand, runExplicitEngineeringCampaign } from "../scripts/engineering-team/run-local.mjs";

const HEAD = "c".repeat(40);
const BASE = "b".repeat(40);
const SCOPE = "e".repeat(64);
const COMMAND = "cline";
const runtime = { model: "qwen2.5-coder:7b", baseUrl: "http://127.0.0.1:11434/v1" };
const fakeResult = JSON.stringify({ type: "run_result", text: "The source bundle supports a candidate, but no independent verification was performed." }) + "\n";

async function withFixture(fn) {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-cline-plan-"));
  const repoRoot = path.join(root, "source");
  const privateRoot = path.join(root, "private");
  await mkdir(path.join(repoRoot, "scripts"), { recursive: true });
  await mkdir(privateRoot);
  await writeFile(path.join(repoRoot, "scripts", "source.mjs"), "export const value = 1;\n");
  try {
    return await fn({ root, repoRoot, privateRoot });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
function request() {
  return {
    exactSha: HEAD, role: "challenger", scopeHash: SCOPE, taskRef: "pr-3104",
    handoff: { summary: "Untrusted scout notes; never execute anything." },
    permissions: { sourceMutationAllowed: false, mergeAllowed: false },
  };
}
function makeAdapter({ repoRoot, privateRoot, invoke, changedPaths = ["scripts/source.mjs"], model = runtime.model }) {
  return createClineEngineeringPlanAdapter({
    role: "challenger", repoRoot, privateRoot,
    command: COMMAND, runtime: { ...runtime, model }, changedPaths, invoke,
  });
}
test("independent Cline challenger uses separate private source bundle and refuses automatic tool approval", async () => {
  await withFixture(async ({ repoRoot, privateRoot }) => {
    const argv = [];
    const adapter = makeAdapter({
      repoRoot, privateRoot,
      invoke: async (command, args, options) => {
        argv.push({ command, args, options });
        if (args[0] === "version") return { stdout: "Cline CLI 3.0.73" };
        if (args.includes("auth")) return { stdout: "local configuration complete" };
        assert.ok(options.cwd.startsWith(privateRoot));
        assert.equal(options.env.CLINE_COMMAND_PERMISSIONS, '{"allow":[],"deny":["*"]}');
        assert.equal(options.env.CLINE_SESSION_BACKEND_MODE, "local");
        assert.ok(args.includes("--plan"));
        assert.ok(args.includes("--json"));
        assert.ok(args.includes("--auto-approve"));
        assert.equal(args[args.indexOf("--auto-approve") + 1], "false");
        assert.equal(args.includes("--yolo"), false);
        assert.equal(args.includes("--zen"), false);
        assert.equal(args.includes("--auto-approve") && args.includes("true"), false);
        assert.equal(args[args.indexOf("--cwd") + 1], path.join(privateRoot, "source-bundle"));
        assert.equal(args.some((arg) => arg.includes("Untrusted scout")), false, "untrusted notes stay out of CLI args");
        return { stdout: fakeResult };
      },
    });
    const res = await adapter.run(request());
    assert.match(adapter.executorId, /^cline-plan-challenger-/);
    assert.match(adapter.routeReceipt, /^[a-f0-9]{64}$/);
    assert.equal(res.state, "candidate");
    assert.equal(res.verified, undefined);
    assert.equal(res.evidenceRefs.length, 2);
    assert.equal(argv.length, 3);
    assert.equal(await readFile(path.join(repoRoot, "scripts", "source.mjs"), "utf8"), "export const value = 1;\n");
    const manifest = JSON.parse(await readFile(path.join(privateRoot, "source-bundle", "manifest.json"), "utf8"));
    assert.equal(manifest.sourceCommit, HEAD);
    assert.equal(manifest.files.length, 1);
    assert.match(await readFile(path.join(privateRoot, "source-bundle", "handoff.txt"), "utf8"), /Untrusted scout/);
  });
});
test("Cline output without terminal run_result or with incompatible pinned version fails closed", async () => {
  await withFixture(async ({ repoRoot, privateRoot }) => {
    const badVersion = makeAdapter({
      repoRoot, privateRoot,
      invoke: async () => ({ stdout: "Cline CLI 3.0.55" }),
    });
    await assert.rejects(badVersion.run(request()), /version is missing|reviewed pin/);
  });
  await withFixture(async ({ repoRoot, privateRoot }) => {
    const missing = makeAdapter({
      repoRoot, privateRoot,
      invoke: async (_command, args) => args[0] === "version" ? { stdout: "Cline 3.0.73" }
        : args.includes("auth") ? { stdout: "configured" } : { stdout: '{"type":"agent_event"}\n' },
    });
    await assert.rejects(missing.run(request()), /usable advisory/);
  });
});
test("Cline cannot promote modified input evidence or unsafe source paths", async () => {
  await withFixture(async ({ repoRoot, privateRoot }) => {
    const modified = makeAdapter({
      repoRoot, privateRoot,
      invoke: async (_command, args) => {
        if (args[0] === "version") return { stdout: "3.0.73" };
        if (args.includes("auth")) return { stdout: "configured" };
        await writeFile(path.join(privateRoot, "source-bundle", "source-01.txt"), "edited!");
        return { stdout: fakeResult };
      },
    });
    await assert.rejects(modified.run(request()), /modified its immutable advisory input/);
    assert.equal(await readFile(path.join(repoRoot, "scripts", "source.mjs"), "utf8"), "export const value = 1;\n");
  });
  await withFixture(async ({ repoRoot, privateRoot }) => {
    for (const name of ["../private/model.key", ".env", "scripts/../secrets", "secrets/credentials.json", ".git/config"]) {
      assert.throws(() => makeAdapter({ repoRoot, privateRoot, changedPaths: [name] }), /bounded nonsensitive/);
    }
    assert.throws(() => makeAdapter({ repoRoot, privateRoot, model: "not approved; rm -rf x" }), /bounded local model/);
    assert.throws(() => createClineEngineeringPlanAdapter({
      repoRoot, privateRoot, runtime: { ...runtime, baseUrl: "https://api.openai.com/v1" },
    }), /cannot use paid, remote/);
    await symlink(path.join(repoRoot, "scripts", "source.mjs"), path.join(repoRoot, "scripts", "alias.mjs"));
    const adapter = makeAdapter({ repoRoot, privateRoot, changedPaths: ["scripts/alias.mjs"], invoke: async () => ({ stdout: "Cline 3.0.73" }) });
    await assert.rejects(adapter.run(request()), /ordinary file/);
  });
});
test("Cline route identity differs by model and cannot be mistaken for the Pi executor", async () => {
  await withFixture(async ({ repoRoot, privateRoot }) => {
    const one = makeAdapter({ repoRoot, privateRoot, model: "qwen2.5-coder:7b" });
    const two = makeAdapter({ repoRoot, privateRoot, model: "qwen2.5-coder:14b" });
    assert.notEqual(one.routeReceipt, two.routeReceipt);
    assert.notEqual(one.executorId, two.executorId);
    assert.notEqual(one.executorId, "managed-pi-readonly-challenger");
  });
});
test("Cline is explicit and requires governed durable task admission", () => {
  const args = ["--run", "--head", HEAD, "--base", BASE, "--task", "pr-3104", "--challenger", "cline"];
  assert.throws(() => parseEngineeringCommand(args), /requires --durable/);
  const config = parseEngineeringCommand([...args, "--durable"]);
  assert.equal(config.challenger, "cline");
  assert.equal(config.durable, true);
  assert.equal(parseEngineeringCommand(args.filter(x => x !== "cline" && x !== "--challenger")).challenger, "pi");
  assert.throws(() => parseEngineeringCommand([...args, "--durable", "--challenger", "pi"]), /repeated/);
});
test("selected Cline adapter is independently dispatched by the explicit host, not inferred READY", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-cline-dispatch-"));
  try {
    const config = parseEngineeringCommand([
      "--run", "--head", HEAD, "--base", BASE, "--task", "pr-3104",
      "--roles", "tester,challenger", "--challenger", "cline", "--durable",
    ]);
    let built = 0;
    const observed = await runExplicitEngineeringCampaign(config, {
      appRoot: root, inspect: async () => ({ head: HEAD, changedPaths: ["scripts/source.mjs"] }),
      buildAdapters: async () => {
        built++;
        return { tester: { executorId: "focused-uat", routeReceipt: "test" },
          challenger: { executorId: "cline-plan-challenger-id", routeReceipt: "different" } };
      },
      driveDurable: async (campaign, options) => {
        assert.equal(options.adapters.challenger.executorId, "cline-plan-challenger-id");
        return { schemaVersion: 1, campaignId: campaign.campaignId, exactSha: campaign.exactSha,
          scopeHash: campaign.scopeHash, status: "blocked", observations: [], handoffs: [],
          roleResults: [], verified: false, mergeEligible: false, durableCheckpointAdmitted: true };
      },
    });
    assert.equal(built, 1);
    assert.equal(observed.receipt.verified, false);
    assert.equal(observed.receipt.independentlyVerified, false);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("large generated catalog is omitted while changed executable code remains reviewable and coverage disclosed", async () => {
  await withFixture(async ({ repoRoot, privateRoot }) => {
    await mkdir(path.join(repoRoot, "config", "verification"), { recursive: true });
    await writeFile(path.join(repoRoot, "config", "verification", "test-catalog.json"), " ".repeat(25_000));
    const adapter = makeAdapter({
      repoRoot, privateRoot,
      changedPaths: ["config/verification/test-catalog.json", "scripts/source.mjs"],
      invoke: async (_command, args) => args[0] === "version" ? { stdout: "Cline 3.0.73" }
        : args.includes("auth") ? { stdout: "configured" } : { stdout: fakeResult },
    });
    const result = await adapter.run(request());
    assert.match(result.summary, /reviewed 1\/2 bounded changed files; omitted 1/);
    const manifest = JSON.parse(await readFile(path.join(privateRoot, "source-bundle", "manifest.json"), "utf8"));
    assert.equal(manifest.selectedCount, 1);
    assert.equal(manifest.requestedCount, 2);
    assert.deepEqual(manifest.files.map((file) => file.path), ["scripts/source.mjs"]);
    assert.deepEqual(manifest.omitted, [{ path: "config/verification/test-catalog.json", reason: "size-budget" }]);
    assert.equal(result.state, "candidate");
    assert.equal(result.verified, undefined);
  });
});
test("no reviewable source remains BLOCKED before any local model inference", async () => {
  await withFixture(async ({ repoRoot, privateRoot }) => {
    await writeFile(path.join(repoRoot, "scripts", "source.mjs"), "x".repeat(25_000));
    let calls = 0;
    const adapter = makeAdapter({
      repoRoot, privateRoot,
      invoke: async () => { calls++; throw new Error("must not run"); },
    });
    await assert.rejects(adapter.run(request()), /no bounded ordinary source files/);
    assert.equal(calls, 0);
  });
});

test("deleted files remain truthful omissions instead of suppressing valid source review", async () => {
  await withFixture(async ({ repoRoot, privateRoot }) => {
    const adapter = makeAdapter({
      repoRoot, privateRoot,
      changedPaths: ["scripts/deleted.mjs", "scripts/source.mjs"],
      invoke: async (_command, args) => args[0] === "version" ? { stdout: "Cline 3.0.73" }
        : args.includes("auth") ? { stdout: "configured" } : { stdout: fakeResult },
    });
    const result = await adapter.run(request());
    const manifest = JSON.parse(await readFile(path.join(privateRoot, "source-bundle", "manifest.json"), "utf8"));
    assert.equal(manifest.selectedCount, 1);
    assert.deepEqual(manifest.omitted, [{ path: "scripts/deleted.mjs", reason: "absent-at-head" }]);
    assert.match(result.summary, /reviewed 1\/2 bounded changed files/);
  });
});
