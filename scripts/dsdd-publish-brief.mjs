#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";

const exec = promisify(execFile);
const REPOSITORY = "BryanHarrisScripts/PlotPickle";
const MAX_INPUT_BYTES = 64 * 1024;
const MAX_BODY_CHARS = 50_000;

async function readStdin() {
  let source = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) {
    source += chunk;
    if (Buffer.byteLength(source, "utf8") > MAX_INPUT_BYTES) throw new Error("DSDD Publish Brief input is too large.");
  }
  const value = JSON.parse(source || "{}");
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("DSDD Publish Brief input is invalid.");
  return value;
}

function clean(value, maximum) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

async function gh(args, options = {}) {
  const result = await exec("gh", args, {
    cwd: process.cwd(),
    windowsHide: true,
    timeout: options.timeout || 60_000,
    maxBuffer: 2 * 1024 * 1024,
  });
  return String(result.stdout || "").trim();
}

async function main() {
  const input = await readStdin();
  const title = clean(input.title, 180);
  const body = clean(input.body, MAX_BODY_CHARS);
  if (!title || !body) throw new Error("DSDD Publish Brief requires a title and developer brief body.");

  await gh(["auth", "status", "--hostname", "github.com"], { timeout: 30_000 });
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), "plotpickle-dsdd-brief-"));
  const bodyPath = path.join(tempRoot, "issue.md");
  try {
    await writeFile(bodyPath, `${body}\n`, "utf8");
    const url = await gh([
      "issue", "create",
      "--repo", REPOSITORY,
      "--title", title,
      "--body-file", bodyPath,
    ]);
    const match = url.match(/\/issues\/(\d+)(?:\s|$)/u);
    if (!match) throw new Error(`GitHub created the DSDD brief but returned an unexpected URL: ${url || "<empty>"}`);
    process.stdout.write(JSON.stringify({
      ok: true,
      repository: REPOSITORY,
      number: Number(match[1]),
      title,
      url: url.trim(),
    }));
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
  process.exitCode = 1;
});
