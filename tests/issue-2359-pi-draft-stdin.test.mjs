import assert from "node:assert/strict";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { runPiReadOnly, runPortableCommand } from "../scripts/pi-worker-runtime.mjs";
import { windowsBatchInvocation } from "../scripts/windows-batch-command.mjs";
import { promptFor } from "../scripts/dsdd-pi-draft.mjs";

const narration = 'Human: Keep "Block 01" & its shots!\r\n100% → café | <preview> ^ ready\n';

test("#2359 the original multiline prompt is rejected as a Windows batch argument", () => {
  assert.throws(() => windowsBatchInvocation("pi.cmd", ["-p", narration]), /unsupported command-shell characters/u);
});

test("#2359 portable commands receive exact UTF-8 stdin and EOF", async () => {
  const code = "let s='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>process.stdout.write(JSON.stringify(s)))";
  const result = await runPortableCommand(process.execPath, ["-e", code], { input: narration, timeout: 2000 });
  assert.equal(JSON.parse(result.stdout), narration);
  const empty = await runPortableCommand(process.execPath, ["-e", code], { timeout: 2000 });
  assert.equal(JSON.parse(empty.stdout), "");
});

test("#2359 read-only Pi receives a large prompt once outside argv and batch environment", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-2359-"));
  const previous = process.env.LOCALAPPDATA;
  process.env.LOCALAPPDATA = root;
  t.after(async () => {
    if (previous === undefined) delete process.env.LOCALAPPDATA;
    else process.env.LOCALAPPDATA = previous;
    await rm(root, { recursive: true, force: true });
  });
  const probe = path.join(root, "pi probe.mjs");
  await writeFile(probe, [
    "#!/usr/bin/env node",
    "let input = ''; process.stdin.setEncoding('utf8');",
    "for await (const chunk of process.stdin) input += chunk;",
    "process.stdout.write(JSON.stringify({input, args:process.argv.slice(2), batch:Object.entries(process.env).filter(([k])=>k.startsWith('PLOTPICKLE_BATCH_'))}));",
  ].join("\n"));
  await chmod(probe, 0o755);
  let command = probe;
  if (process.platform === "win32") {
    command = path.join(root, "pi probe.cmd");
    await writeFile(command, `@"${process.execPath}" "${probe}" %*\r\n`);
  }
  const prompt = `${narration}${"bounded context ".repeat(3000)}`;
  const result = await runPiReadOnly({
    command,
    runtime: { model: "fixture-model", baseUrl: "http://127.0.0.1:1234/v1" },
    prompt,
    cwd: root,
    purpose: "stdin-fixture",
    timeout: 3000,
  });
  const received = JSON.parse(result.stdout);
  assert.equal(received.input, prompt);
  assert.deepEqual(received.args, [
    "-p", "--no-session", "--tools", "read,grep,find,ls",
    "--no-extensions", "--no-skills", "--no-prompt-templates", "--no-themes",
    "--provider", "plotpickle-local", "--model", "fixture-model",
  ]);
  assert.ok(received.batch.every(([, value]) => !value.includes("Human:")));
});

test("#2359 failed launch and early exit reject without exposing input", async () => {
  await assert.rejects(
    runPortableCommand(process.execPath, ["-e", "process.exit(0)"], { input: narration.repeat(10000), timeout: 2000 }),
    (error) => !String(error.message).includes(narration),
  );
  await assert.rejects(runPortableCommand(path.join(os.tmpdir(), "plotpickle-no-such-command-2359"), [], {
    input: narration, timeout: 2000,
  }));
});

test("#2359 a timed-out reader retains process failure without echoing the prompt", async () => {
  await assert.rejects(runPortableCommand(process.execPath, ["-e", "setInterval(()=>{},1000)"], {
    input: narration, timeout: 100,
  }), (error) => error.killed === true && !String(error.message).includes(narration));
});

test("#2359 the draft includes each bounded intent field once and does not replay history", () => {
  const prompt = promptFor({
    humanStatement: "UNIQUE_HUMAN_2359",
    understoodMeaning: "UNIQUE_MEANING_2359",
    requirements: [{ id: "R1", text: "UNIQUE_REQUIREMENT_2359" }],
    conversation: Array.from({ length: 80 }, () => ({ text: "OLD_TRANSCRIPT_2359" })),
    context: { surfaceId: "dashboard", route: "/skin-v1" },
  });
  for (const field of ["UNIQUE_HUMAN_2359", "UNIQUE_MEANING_2359", "UNIQUE_REQUIREMENT_2359"]) {
    assert.equal(prompt.split(field).length - 1, 1);
  }
  assert.ok(!prompt.includes("OLD_TRANSCRIPT_2359"));
  assert.ok(prompt.includes('"surfaceId":"dashboard"'));
});
