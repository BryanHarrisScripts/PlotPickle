import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import test from "node:test";
import { resolveManagedPiCliEntry } from "../Utilities/DeveloperWorkbench/pi-managed-node-launch.mjs";

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-3291-pi-"));
  const packageRoot = path.join(root, "node_modules", "@earendil-works", "pi-coding-agent");
  const bundle = path.join(packageRoot, "dist", "bundle", "cli.js");
  const unbundled = path.join(packageRoot, "dist", "cli.js");
  await mkdir(path.dirname(bundle), { recursive: true });
  await writeFile(path.join(packageRoot, "package.json"), JSON.stringify({
    name: "@earendil-works/pi-coding-agent",
    version: "1.3.0",
    bin: { pi: "dist/bundle/cli.js" },
  }));
  await writeFile(bundle, "throw new Error('embedded Undici must not launch');\n");
  return { root, packageRoot, bundle, unbundled };
}

test("#3291 managed Pi selects the unbundled CLI, never the published bundled bin", async () => {
  const f = await fixture();
  try {
    await writeFile(f.unbundled, "#!/usr/bin/env node\n");
    const selected = await resolveManagedPiCliEntry({ root: f.root });
    assert.equal(selected, f.unbundled);
    assert.notEqual(selected, f.bundle);
    assert.equal(await readFile(f.bundle, "utf8"), "throw new Error('embedded Undici must not launch');\n");
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test("#3291 missing unbundled CLI fails closed rather than falling back to the vulnerable bundle", async () => {
  const f = await fixture();
  try {
    await assert.rejects(resolveManagedPiCliEntry({ root: f.root }), /CLI entry is missing or unreadable/);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test("#3291 unbundled CLI symlink outside private Pi package is rejected", {
  skip: process.platform === "win32" && "Windows symlink privileges are host-dependent",
}, async () => {
  const f = await fixture();
  try {
    const outside = path.join(f.root, "outside-cli.js");
    await writeFile(outside, "// attacker-controlled\n");
    await symlink(outside, f.unbundled);
    await assert.rejects(resolveManagedPiCliEntry({ root: f.root }), /outside its private package root/);
  } finally {
    await rm(f.root, { recursive: true, force: true });
  }
});

test("#3291 managed reviewers use direct unbundled Node launch, never bundled Pi shim", async () => {
  for (const script of [
    "../scripts/run-pi-code-quality-review.mjs",
    "../scripts/pi/run-architecture-review.mjs",
  ]) {
    const text = await readFile(new URL(script, import.meta.url), "utf8");
    assert.match(text, /runManagedPiReadOnly/);
    assert.match(text, /\bpi, runtime,/);
    assert.doesNotMatch(text, /\brunPiReadOnly\b/);
    assert.doesNotMatch(text, /command:\s*pi\.command/);
    assert.doesNotMatch(text, /PLOTPICKLE_PI_COMMAND\s*=\s*pi\.command/);
  }
});
