import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cp, copyFile, mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (process.platform !== "win32") throw new Error("#2789 cold runtime proof requires a real Windows host.");

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const temporary = await mkdtemp(path.join(process.env.RUNNER_TEMP || os.tmpdir(), "plotpickle-2789-"));
const runtime = path.join(temporary, "runtime");
const artifact = path.join(repo, ".artifacts", "runtime-2789", "windows-cold-runtime.json");
const vendorRelative = path.join("vendor", "braces-3.0.3-depth-guard");
const report = {
  schemaVersion: 1,
  issue: 2789,
  platform: process.platform,
  node: process.versions.node,
  runtime,
  result: "UNPROVEN",
};

async function run(command, args, { cwd = repo, timeoutMs = 480000 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: process.env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      if (child.pid) spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
      reject(new Error(`${path.basename(command)} exceeded ${timeoutMs} ms`));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      const text = String(chunk);
      stdout = (stdout + text).slice(-100000);
      process.stdout.write(text);
    });
    child.stderr.on("data", (chunk) => {
      const text = String(chunk);
      stderr = (stderr + text).slice(-100000);
      process.stderr.write(text);
    });
    child.once("error", (error) => { clearTimeout(timer); reject(error); });
    child.once("exit", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

try {
  await mkdir(runtime, { recursive: true });
  await copyFile(path.join(repo, "package.json"), path.join(runtime, "package.json"));
  await copyFile(path.join(repo, "package-lock.json"), path.join(runtime, "package-lock.json"));
  await cp(path.join(repo, vendorRelative), path.join(runtime, vendorRelative), { recursive: true });

  const install = await run("npm.cmd", [
    "ci",
    "--prefix", runtime,
    "--omit=dev",
    "--prefer-offline",
    "--no-audit",
    "--no-fund",
    "--progress=false",
    "--loglevel=notice",
  ]);
  report.npmExitCode = install.code;
  report.npmOutputTail = (install.stderr + install.stdout).slice(-12000);
  assert.equal(install.code, 0, report.npmOutputTail);
  assert.doesNotMatch(report.npmOutputTail, /EALLOWGIT|Fetching packages of type ["']?git/iu);

  const modules = path.join(runtime, "node_modules");
  const verify = await run(process.execPath, ["scripts/windows-runtime.mjs", "verify-modules", modules], { timeoutMs: 60000 });
  report.runtimeVerifyExitCode = verify.code;
  report.runtimeVerifyOutput = (verify.stderr + verify.stdout).slice(-12000);
  assert.equal(verify.code, 0, report.runtimeVerifyOutput);
  assert.match(report.runtimeVerifyOutput, /Runtime verification passed/u);
  assert.match(report.runtimeVerifyOutput, /Native binding verified/u);
  assert.match(report.runtimeVerifyOutput, /Sharp runtime verified/u);

  const bracesPath = await realpath(path.join(modules, "braces"));
  const expectedBracesPath = await realpath(path.join(runtime, vendorRelative));
  report.bracesRealPath = bracesPath;
  assert.equal(bracesPath.toLowerCase(), expectedBracesPath.toLowerCase());

  const runtimeRequire = createRequire(path.join(runtime, "plotpickle-cold-runtime-proof.cjs"));
  const braces = runtimeRequire("braces");
  assert.deepEqual(braces.expand("a/{b,c}/d"), ["a/b/d", "a/c/d"]);
  const hostile = "{".repeat(101) + "a,b" + "}".repeat(101);
  assert.throws(() => braces.expand(hostile), /exceeds max depth/u);

  report.result = "PASS";
} catch (error) {
  report.result = "FAIL";
  report.error = error instanceof Error ? error.message : String(error);
  process.exitCode = 1;
} finally {
  await mkdir(path.dirname(artifact), { recursive: true });
  await writeFile(artifact, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(`#2789 Windows cold runtime proof: ${report.result}. Evidence: ${artifact}`);
  await rm(temporary, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }).catch(() => {});
}
