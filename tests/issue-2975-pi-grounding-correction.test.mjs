import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { draftWithVerifiedGrounding, verifiedRepoPaths } from "../scripts/pi/dsdd-grounding-repair.mjs";

const tick = String.fromCharCode(96);
const tracked = "modules/write/ui/block-native-write-workspace.tsx";
const valid = "# Pi Technical Developer Draft\nInspect " + tick + tracked + tick + ".";
const invalid = "# Pi Technical Developer Draft\nChange " + tick + "modules/write/ui/imaginary-workspace.tsx" + tick + ".";
const secondInvalid = "# Pi Technical Developer Draft\nTest " + tick + "tests/nonexistent.test.mjs" + tick + ".";
const lockedPrompt = "IMMUTABLE HUMAN OUTCOME: Execute Block 1 through Write and Visualize, without rewriting screenplay content.";

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-2975-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "modules", "write", "ui"), { recursive: true });
  await writeFile(path.join(root, tracked), "// verified\n");
  await writeFile(path.join(root, "AGENTS.md"), "# Repo rules\n");
  await writeFile(path.join(root, "modules", "write", "ui", "deleted.ts"), "// removed\n");
  await writeFile(path.join(root, "modules", "write", "ui", "untracked.ts"), "// not indexed\n");
  execFileSync("git", ["init", "-q"], { cwd: root });
  execFileSync("git", ["add", "--", "AGENTS.md", tracked, "modules/write/ui/deleted.ts"], { cwd: root });
  await unlink(path.join(root, "modules", "write", "ui", "deleted.ts"));
  return root;
}

test("#2975 tracked and present files are bounded evidence, not deleted or untracked names", async (t) => {
  const root = await fixture(t);
  const first = verifiedRepoPaths(root, "Block Write Visualize");
  const second = verifiedRepoPaths(root, "Block Write Visualize");
  assert.deepEqual(first, second, "path selection must be deterministic");
  assert.ok(first.includes(tracked));
  assert.ok(first.includes("AGENTS.md"));
  assert.ok(!first.some((name) => name.includes("deleted.ts") || name.includes("untracked.ts")));
  assert.ok(first.length <= 32);
  assert.ok(first.reduce((sum, name) => sum + name.length + 3, 0) <= 4000);
  assert.deepEqual(verifiedRepoPaths(root, "Block Write", {
    trackedListing: "modules\\write\\ui\\block-native-write-workspace.tsx\0../outside.ts\0modules/write/ui/deleted.ts\0",
  }), [tracked], "Windows slashes normalize but traversal and deleted entries are never evidence");
  assert.throws(() => verifiedRepoPaths(root, "Write", { trackedListing: "" }), /tracked repository evidence/i);
});

test("#2975 valid first Pi draft is accepted without correction", async (t) => {
  const root = await fixture(t);
  const prompts = [];
  const result = await draftWithVerifiedGrounding({
    lockedPrompt, intentText: "Write Visualize Block", repoRoot: root,
    runDraft: async (prompt) => { prompts.push(prompt); return { stdout: valid }; },
  });
  assert.equal(result.attempts, 1);
  assert.deepEqual(result.grounding.missing, []);
  assert.equal(result.text, valid);
  assert.equal(prompts.length, 1);
  assert.ok(prompts[0].startsWith(lockedPrompt));
  assert.ok(prompts[0].includes(tracked));
  assert.ok(!prompts[0].includes("untracked.ts"));
});

test("#2975 at most one bounded correction keeps the identical locked Human intent", async (t) => {
  const root = await fixture(t);
  const prompts = [];
  const outputs = [invalid, valid];
  const result = await draftWithVerifiedGrounding({
    lockedPrompt, intentText: "Write Visualize Block", repoRoot: root,
    runDraft: async (prompt) => { prompts.push(prompt); return { stdout: outputs[prompts.length - 1] }; },
  });
  assert.equal(result.attempts, 2);
  assert.equal(result.text, valid);
  assert.equal(prompts.length, 2);
  for (const prompt of prompts) {
    assert.ok(prompt.startsWith(lockedPrompt));
    assert.equal(prompt.split(lockedPrompt).length - 1, 1, "do not restate or transform the locked intent");
  }
  assert.ok(prompts[1].includes("ONE BOUNDED CORRECTION"));
  assert.ok(prompts[1].includes("imaginary-workspace.tsx"));
  assert.ok(!prompts[0].includes("ONE BOUNDED CORRECTION"));
});

test("#2975 second invented path is rejected without a third attempt", async (t) => {
  const root = await fixture(t);
  let count = 0;
  await assert.rejects(() => draftWithVerifiedGrounding({
    lockedPrompt, intentText: "Write Visualize", repoRoot: root,
    runDraft: async () => ({ stdout: ++count === 1 ? invalid : secondInvalid }),
  }), /not found: tests\/nonexistent\.test\.mjs/);
  assert.equal(count, 2);
});

test("#2975 local runtime failure and empty output never launch a fallback or a retry", async (t) => {
  const root = await fixture(t);
  for (const failure of ["throw", "empty"]) {
    let count = 0;
    await assert.rejects(() => draftWithVerifiedGrounding({
      lockedPrompt, intentText: "Write", repoRoot: root,
      runDraft: async () => {
        count += 1;
        if (failure === "throw") throw new Error("Local model unavailable");
        return { stdout: "" };
      },
    }), failure === "throw" ? /Local model unavailable/ : /without producing/);
    assert.equal(count, 1);
  }
});

test("#2975 entry stays read-only with final grounding guard and existing DSDD authority", async () => {
  const { readFile } = await import("node:fs/promises");
  const entry = await readFile(new URL("../scripts/dsdd-pi-draft.mjs", import.meta.url), "utf8");
  assert.match(entry, /draftWithVerifiedGrounding/u);
  assert.match(entry, /assertPiDraftGrounding\(text, repoRoot\)/u);
  assert.match(entry, /runPiReadOnly/u);
  assert.match(entry, /purpose: "dsdd-brief"/u);
  assert.doesNotMatch(entry, /runPiCloud|cloudFallback|run-uat-repair-agent/u);
});
